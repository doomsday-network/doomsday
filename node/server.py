import argparse
import asyncio
import json
import os
import time
from typing import Dict, Any, List, Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from node.blockchain import Blockchain
from node.pool import MiningPool
from node.p2p import P2PManager
from core.block import Block
from core.transaction import COIN, Transaction, TxInput, TxOutput

app = FastAPI(title="Doomsday Network Node", version="1.0.0", docs_url="/api/docs", redoc_url=None)

# Initialize Ledger
chain = Blockchain()

# Pool Wallet & Mining Pool Engine
def load_or_create_pool_wallet() -> Dict[str, str]:
    paths = [
        "pool_wallet.json",
        "data/pool_wallet.json",
        os.path.join(os.path.dirname(os.path.dirname(__file__)), "pool_wallet.json"),
        os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "pool_wallet.json")
    ]
    for p in paths:
        if os.path.exists(p):
            try:
                with open(p, "r") as f:
                    return json.load(f)
            except Exception:
                pass
    from core.crypto import generate_keypair, private_key_to_wif, public_key_to_address
    priv, pub = generate_keypair()
    data = {
        "address": public_key_to_address(pub),
        "private_key": private_key_to_wif(priv)
    }
    target = os.path.join(os.path.dirname(os.path.dirname(__file__)), "pool_wallet.json")
    try:
        with open(target, "w") as f:
            json.dump(data, f, indent=2)
    except Exception:
        pass
    return data

pool_wallet = load_or_create_pool_wallet()
pool = MiningPool(chain=chain, pool_address=pool_wallet["address"], fee_pct=0.0)

# P2P Wire Protocol Manager
p2p = P2PManager(chain=chain, listen_port=8334)

# Live Workers State: miner_name -> dict
active_miners: Dict[str, Dict[str, Any]] = {}

# Active WebSocket connections
connected_sockets: List[WebSocket] = []


class SubmitBlockRequest(BaseModel):
    height: int
    nonce: int
    hash: str
    miner_name: str = "Rig-Default"
    miner_address: str
    timestamp: Optional[int] = None


class PoolSubmitRequest(BaseModel):
    height: int
    nonce: int
    worker_address: str
    worker_name: str = "Rig-Default"
    timestamp: Optional[int] = None


class MinerTelemetry(BaseModel):
    name: str
    device: str
    state: str
    hashrate_mhs: float
    temp_c: int
    power_w: float
    util_pct: int
    address: str


class SendTxRequest(BaseModel):
    sender_address: str
    recipient_address: str
    amount_doom: float
    private_key_wif: str


class FaucetClaimRequest(BaseModel):
    recipient_address: str


class P2PHandshakeRequest(BaseModel):
    node_id: str
    version: str = "1.0.0"
    listen_port: int = 8334
    height: int
    tip_hash: str


class P2PBlockGossipRequest(BaseModel):
    block: Dict[str, Any]


class P2PTxGossipRequest(BaseModel):
    transaction: Dict[str, Any]


faucet_claims: Dict[str, float] = {}


def load_faucet_wallet() -> Optional[Dict[str, str]]:
    paths = [
        "faucet_wallet.json",
        "data/faucet_wallet.json",
        os.path.join(os.path.dirname(os.path.dirname(__file__)), "faucet_wallet.json"),
        os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "faucet_wallet.json")
    ]
    for p in paths:
        if os.path.exists(p):
            try:
                with open(p, "r") as f:
                    return json.load(f)
            except Exception:
                pass
    return None


async def broadcast_event(event_type: str, data: Any):
    """Broadcast real-time updates to all connected web dashboards."""
    dead_sockets = []
    message = json.dumps({"type": event_type, "data": data})
    for ws in connected_sockets:
        try:
            await ws.send_text(message)
        except Exception:
            dead_sockets.append(ws)
    for ws in dead_sockets:
        if ws in connected_sockets:
            connected_sockets.remove(ws)


@app.get("/status")
def get_status():
    tip = chain.get_tip()
    now = time.time()
    active_workers_list = [m for m in active_miners.values() if now - m.get("last_seen", 0) < 15]
    total_mhs = sum(m.get("hashrate_mhs", 0.0) for m in active_workers_list)
    return {
        "network": "Doomsday Network",
        "ticker": "DOOM",
        "height": tip.height,
        "tip_hash": tip.hash,
        "difficulty_bits": hex(tip.header.bits),
        "target": hex(chain.create_block_template("check")["target_high"]),
        "total_mined_doom": (tip.height + 1) * 50.0,
        "max_supply": 21_000_000,
        "active_workers": len(active_workers_list),
        "cluster_hashrate_mhs": round(total_mhs, 2),
        "mempool_size": len(chain.mempool),
        "p2p_peers": len([p for p in p2p.peers.values() if p.is_connected]),
        "p2p_syncing": p2p.is_syncing
    }


def get_subsidy(h: int) -> int:
    from core.consensus import get_block_reward
    return get_block_reward(h)


@app.get("/job")
def get_mining_job(miner_address: str = "doom1miner000000000000000000000000000000"):
    return chain.create_block_template(miner_address)


@app.post("/submit")
async def submit_block(req: SubmitBlockRequest):
    ok, msg = chain.add_block_candidate(
        height=req.height,
        nonce=req.nonce,
        miner_address=req.miner_address,
        miner_name=req.miner_name,
        timestamp=req.timestamp
    )
    if not ok:
        raise HTTPException(status_code=400, detail=msg)

    # Broadcast new block event
    tip = chain.get_tip()
    await broadcast_event("new_block", {
        "height": tip.height,
        "hash": tip.hash,
        "miner": tip.header.miner_address,
        "miner_name": req.miner_name,
        "nonce": tip.header.nonce,
        "timestamp": tip.header.timestamp,
        "reward_doom": 50.0
    })

    # Wire Gossip: Broadcast new block to P2P mesh
    asyncio.create_task(p2p.broadcast_block(tip))
    return {"accepted": True, "height": tip.height, "hash": tip.hash}


@app.get("/pool/job")
def get_pool_job(worker_address: str = "doom1miner000000000000000000000000000000", worker_name: str = "Worker-Default"):
    return pool.get_job(worker_address, worker_name)


@app.post("/pool/submit")
async def submit_pool_share(req: PoolSubmitRequest):
    res = pool.submit_share(
        height=req.height,
        nonce=req.nonce,
        worker_address=req.worker_address,
        worker_name=req.worker_name,
        timestamp=req.timestamp
    )
    if not res.get("accepted"):
        raise HTTPException(status_code=400, detail=res.get("reason", "Share rejected"))

    if res.get("block_solved"):
        tip = chain.get_tip()
        await broadcast_event("new_block", {
            "height": tip.height,
            "hash": tip.hash,
            "miner": tip.header.miner_address,
            "miner_name": f"Pool:[{req.worker_name}]",
            "nonce": tip.header.nonce,
            "timestamp": tip.header.timestamp,
            "reward_doom": 50.0
        })
        # Wire Gossip: Broadcast pool-discovered block to P2P mesh
        asyncio.create_task(p2p.broadcast_block(tip))

    await broadcast_event("pool_stats", pool.get_stats())
    return res


@app.get("/pool/stats")
def get_pool_stats():
    return pool.get_stats()


@app.get("/pool/worker/{address}")
def get_pool_worker(address: str):
    return pool.get_worker_stats(address)


@app.post("/pool/payout")
async def request_pool_payout(req: FaucetClaimRequest):
    unpaid = pool.unpaid_sparks.get(req.recipient_address, 0)
    if unpaid < int(1.0 * COIN):
        raise HTTPException(status_code=400, detail=f"Minimum payout is 1.0 DOOM. Unpaid balance: {unpaid / COIN:.4f} DOOM")

    avail = chain.get_balance(pool.pool_address)
    if avail < unpaid:
        raise HTTPException(status_code=503, detail="Pool node does not have sufficient confirmed on-chain balance yet.")

    from core.crypto import private_key_from_wif
    priv = private_key_from_wif(pool_wallet["private_key"])
    inputs = []
    accum = 0
    for outpoint, (rcpt, amt) in chain.utxo_set.items():
        if rcpt == pool.pool_address:
            txid, vout = outpoint.split(":")
            inputs.append(TxInput(txid=txid, vout=int(vout)))
            accum += amt
            if accum >= unpaid:
                break

    outputs = [TxOutput(recipient=req.recipient_address, amount=unpaid)]
    change = accum - unpaid
    if change > 0:
        outputs.append(TxOutput(recipient=pool.pool_address, amount=change))

    tx = Transaction(inputs=inputs, outputs=outputs)
    for idx in range(len(inputs)):
        tx.sign_input(idx, priv)

    ok, reason = chain.add_transaction_to_mempool(tx)
    if not ok:
        raise HTTPException(status_code=400, detail=reason)

    pool.unpaid_sparks[req.recipient_address] = 0
    pool.total_paid_sparks[req.recipient_address] = pool.total_paid_sparks.get(req.recipient_address, 0) + unpaid

    await broadcast_event("new_tx", tx.to_dict())
    await broadcast_event("pool_stats", pool.get_stats())
    asyncio.create_task(p2p.broadcast_tx(tx))
    return {
        "status": "payout_sent",
        "txid": tx.txid,
        "amount_doom": unpaid / COIN,
        "recipient": req.recipient_address
    }


# ==============================================================================
# P2P WIRE PROTOCOL ENDPOINTS
# ==============================================================================

@app.get("/p2p/status")
def get_p2p_status():
    return p2p.get_stats()


@app.post("/p2p/handshake")
async def p2p_handshake(req: P2PHandshakeRequest):
    tip = chain.get_tip()
    return {
        "node_id": p2p.node_id,
        "version": "1.0.0",
        "height": tip.height,
        "tip_hash": tip.hash,
        "known_peers": [p.address for p in p2p.peers.values() if p.is_connected]
    }


@app.get("/p2p/peers")
def get_p2p_peers():
    return [p.to_dict() for p in p2p.peers.values()]


@app.get("/p2p/blocks")
def get_p2p_blocks(start_height: int = 0, limit: int = 50):
    limit = min(max(1, limit), 100)
    selected = chain.blocks[start_height:start_height + limit]
    return [b.to_dict() for b in selected]


@app.post("/p2p/block")
async def receive_p2p_block(req: P2PBlockGossipRequest):
    b = Block.from_dict(req.block)
    if b.hash in p2p.seen_blocks:
        return {"accepted": True, "duplicate": True}

    p2p.seen_blocks.add(b.hash)
    tip = chain.get_tip()

    if b.height == tip.height + 1:
        ok, msg = chain.add_external_block(b)
        if not ok:
            raise HTTPException(status_code=400, detail=msg)

        await broadcast_event("new_block", {
            "height": b.height,
            "hash": b.hash,
            "miner": b.header.miner_address,
            "miner_name": "P2P-Peer",
            "nonce": b.header.nonce,
            "timestamp": b.header.timestamp,
            "reward_doom": 50.0
        })

        asyncio.create_task(p2p.broadcast_block(b))
        return {"accepted": True, "height": b.height, "hash": b.hash}
    elif b.height > tip.height + 1:
        return {"accepted": False, "status": "sync_required", "tip": tip.height}
    else:
        return {"accepted": False, "status": "stale"}


@app.post("/p2p/tx")
async def receive_p2p_tx(req: P2PTxGossipRequest):
    tx = Transaction.from_dict(req.transaction)
    if tx.txid in p2p.seen_txs:
        return {"accepted": True, "duplicate": True}

    p2p.seen_txs.add(tx.txid)
    ok, reason = chain.add_transaction_to_mempool(tx)
    if ok:
        await broadcast_event("new_tx", tx.to_dict())
        asyncio.create_task(p2p.broadcast_tx(tx))
        return {"accepted": True, "txid": tx.txid}
    return {"accepted": False, "reason": reason}


@app.post("/miner/telemetry")
async def receive_telemetry(req: MinerTelemetry):
    active_miners[req.name] = {
        "name": req.name,
        "device": req.device,
        "state": req.state,
        "hashrate_mhs": req.hashrate_mhs,
        "temp_c": req.temp_c,
        "power_w": req.power_w,
        "util_pct": req.util_pct,
        "address": req.address,
        "last_seen": time.time()
    }
    # OpSec: Broadcast only network-wide aggregate metrics, never individual machine telemetry
    now = time.time()
    active_workers_list = [m for m in active_miners.values() if now - m.get("last_seen", 0) < 15]
    total_mhs = sum(m.get("hashrate_mhs", 0.0) for m in active_workers_list)
    await broadcast_event("network_stats", {
        "active_workers": len(active_workers_list),
        "cluster_hashrate_mhs": round(total_mhs, 2)
    })
    return {"status": "ok"}


@app.get("/blocks")
def get_blocks(limit: int = 20):
    recent = list(reversed(chain.blocks[-limit:]))
    return [b.to_dict() for b in recent]


@app.get("/wallet/{address}")
def get_wallet(address: str):
    sparks = chain.get_balance(address)
    return {
        "address": address,
        "balance_sparks": sparks,
        "balance_doom": sparks / COIN
    }


@app.post("/tx/send")
async def send_transaction(req: SendTxRequest):
    from core.crypto import private_key_from_wif, public_key_to_address
    priv = private_key_from_wif(req.private_key_wif)
    sender_derived = public_key_to_address(priv.public_key())
    if sender_derived != req.sender_address:
        raise HTTPException(status_code=400, detail="Private key does not match sender address")

    amount_sparks = int(req.amount_doom * COIN)
    avail = chain.get_balance(req.sender_address)
    if avail < amount_sparks:
        raise HTTPException(status_code=400, detail=f"Insufficient balance. Available: {avail/COIN} DOOM")

    # Select UTXOs
    inputs = []
    accum = 0
    for outpoint, (rcpt, amt) in chain.utxo_set.items():
        if rcpt == req.sender_address:
            txid, vout = outpoint.split(':')
            inputs.append(TxInput(txid=txid, vout=int(vout)))
            accum += amt
            if accum >= amount_sparks:
                break

    outputs = [TxOutput(recipient=req.recipient_address, amount=amount_sparks)]
    change = accum - amount_sparks
    if change > 0:
        outputs.append(TxOutput(recipient=req.sender_address, amount=change))

    tx = Transaction(inputs=inputs, outputs=outputs)
    for idx in range(len(inputs)):
        tx.sign_input(idx, priv)

    ok, reason = chain.add_transaction_to_mempool(tx)
    if not ok:
        raise HTTPException(status_code=400, detail=reason)

    await broadcast_event("new_tx", tx.to_dict())
    asyncio.create_task(p2p.broadcast_tx(tx))
    return {"txid": tx.txid, "status": "Broadcast to mempool"}


@app.post("/wallet/new")
def generate_new_wallet():
    from core.crypto import generate_keypair, private_key_to_wif, public_key_to_address
    priv, pub = generate_keypair()
    return {
        "address": public_key_to_address(pub),
        "private_key": private_key_to_wif(priv)
    }


@app.get("/faucet/info")
def get_faucet_info():
    faucet = load_faucet_wallet()
    if not faucet:
        return {"active": False, "balance_doom": 0.0, "address": None, "drop_amount": 10.0}
    balance_sparks = chain.get_balance(faucet["address"])
    return {
        "active": True,
        "address": faucet["address"],
        "balance_doom": balance_sparks / COIN,
        "drop_amount": 10.0
    }


@app.post("/faucet/claim")
async def claim_faucet(req: FaucetClaimRequest):
    faucet = load_faucet_wallet()
    if not faucet:
        raise HTTPException(status_code=503, detail="Faucet wallet is currently not loaded on this node.")

    now = time.time()
    last_claim = faucet_claims.get(req.recipient_address, 0)
    if now - last_claim < 60:
        wait_sec = int(60 - (now - last_claim))
        raise HTTPException(status_code=429, detail=f"Rate limit exceeded. Please wait {wait_sec}s before claiming again.")

    amount_sparks = int(10.0 * COIN)
    avail = chain.get_balance(faucet["address"])
    if avail < amount_sparks:
        raise HTTPException(status_code=503, detail="Faucet is depleted. Check back after miners discover more blocks.")

    from core.crypto import private_key_from_wif
    priv = private_key_from_wif(faucet["private_key"])
    inputs = []
    accum = 0
    for outpoint, (rcpt, amt) in chain.utxo_set.items():
        if rcpt == faucet["address"]:
            txid, vout = outpoint.split(":")
            inputs.append(TxInput(txid=txid, vout=int(vout)))
            accum += amt
            if accum >= amount_sparks:
                break

    outputs = [TxOutput(recipient=req.recipient_address, amount=amount_sparks)]
    change = accum - amount_sparks
    if change > 0:
        outputs.append(TxOutput(recipient=faucet["address"], amount=change))

    tx = Transaction(inputs=inputs, outputs=outputs)
    for idx in range(len(inputs)):
        tx.sign_input(idx, priv)

    ok, reason = chain.add_transaction_to_mempool(tx)
    if not ok:
        raise HTTPException(status_code=400, detail=reason)

    faucet_claims[req.recipient_address] = now
    await broadcast_event("new_tx", tx.to_dict())
    asyncio.create_task(p2p.broadcast_tx(tx))
    return {
        "status": "success",
        "txid": tx.txid,
        "amount_doom": 10.0,
        "recipient": req.recipient_address
    }


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_sockets.append(websocket)
    try:
        # Send initial status
        tip = chain.get_tip()
        now = time.time()
        active_workers_list = [m for m in active_miners.values() if now - m.get("last_seen", 0) < 15]
        total_mhs = sum(m.get("hashrate_mhs", 0.0) for m in active_workers_list)
        await websocket.send_text(json.dumps({
            "type": "init",
            "data": {
                "tip": tip.to_dict(),
                "total_blocks": len(chain.blocks),
                "active_workers": len(active_workers_list),
                "cluster_hashrate_mhs": round(total_mhs, 2)
            }
        }))
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        if websocket in connected_sockets:
            connected_sockets.remove(websocket)


# Mount static web explorer
web_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "web")
if os.path.exists(web_dir):
    app.mount("/static", StaticFiles(directory=web_dir), name="static")

    @app.get("/")
    def index():
        return FileResponse(os.path.join(web_dir, "index.html"))

    @app.get("/docs")
    @app.get("/whitepaper")
    def get_docs():
        return FileResponse(os.path.join(web_dir, "docs.html"))

    @app.get("/install.sh")
    def get_install_script():
        script_path = os.path.join(web_dir, "install.sh")
        return FileResponse(script_path, media_type="text/x-shellscript")


@app.on_event("startup")
async def on_startup():
    p2p.start()


def start_server(host: str = "0.0.0.0", port: int = 8334, peers: Optional[List[str]] = None):
    import uvicorn
    p2p.listen_port = port
    if peers:
        for p_addr in peers:
            p2p.register_peer(p_addr)
    print(f"\n=======================================================")
    print(f"[*] DOOMSDAY NODE ACTIVE: http://{host}:{port}")
    print(f"P2P Wire Protocol: Node ID [{p2p.node_id}] | Port {port}")
    print(f"Explorer Dashboard: http://localhost:{port}")
    print(f"=======================================================\n")
    uvicorn.run(app, host=host, port=port, log_level="warning")


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Doomsday Network Node Server")
    parser.add_argument("--host", default="0.0.0.0", help="Binding host")
    parser.add_argument("--web-port", type=int, default=8334, help="HTTP/Explorer port")
    parser.add_argument("--peer", action="append", default=[], help="Connect to specific P2P peer(s)")
    args = parser.parse_args()
    start_server(host=args.host, port=args.web_port, peers=args.peer)
