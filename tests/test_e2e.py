import os
import shutil
import tempfile
import time
from fastapi.testclient import TestClient
import node.server
from node.blockchain import Blockchain
from miner.cuda_solver import CUDASolver
from core.crypto import generate_keypair, public_key_to_address, doom_hash

def test_full_mining_cycle():
    test_db = os.path.join(tempfile.gettempdir(), f"test_e2e_{int(time.time()*1000)}.db")
    orig_chain = node.server.chain
    orig_pool_chain = node.server.pool.chain
    orig_p2p_chain = node.server.p2p.chain

    test_chain = Blockchain(db_path=test_db)
    node.server.chain = test_chain
    node.server.pool.chain = test_chain
    node.server.p2p.chain = test_chain

    solver = None
    try:
        client = TestClient(node.server.app)

        print("\n--- 1. Testing Node Status ---")
        res = client.get("/status")
        assert res.status_code == 200
        status = res.json()
        print("Initial Node Status:", status)
        initial_height = status["height"]

        print("\n--- 2. Generating Miner Wallet ---")
        priv, pub = generate_keypair()
        addr = public_key_to_address(pub)
        print("Miner Address:", addr)

        print("\n--- 3. Fetching Mining Job from Node ---")
        res = client.get(f"/job?miner_address={addr}")
        assert res.status_code == 200
        job = res.json()
        print(f"Received Job for Block #{job['height']} | Target High: {hex(job['target_high'])}")

        print("\n--- 4. Solving Block with RTX 5080 GPU ---")
        solver = CUDASolver()
        found = False
        start_nonce = 0
        batch_size = 20_000_000
        while not found and start_nonce < 1_000_000_000:
            found, nonce, mhs = solver.mine_batch(
                seed_u64=tuple(job["seed_u64"]),
                start_nonce=start_nonce,
                batch_size=batch_size,
                target_high=job["target_high"]
            )
            if not found:
                start_nonce += batch_size
        assert found, "GPU failed to find block within search space"
        print(f"GPU Found Winning Nonce: {nonce} at {mhs/1e6:.2f} MH/s!")

        # Verify digest
        prefix = bytes.fromhex(job["header_prefix_hex"])
        digest = doom_hash(prefix, nonce).hex()
        print(f"Calculated Block Hash: {digest}")

        print("\n--- 5. Submitting Mined Block to Node ---")
        sub_payload = {
            "height": job["height"],
            "nonce": nonce,
            "hash": digest,
            "miner_name": "Rig-5080",
            "miner_address": addr,
            "timestamp": job["timestamp"]
        }
        res = client.post("/submit", json=sub_payload)
        print("Submit Response:", res.status_code, res.json())
        assert res.status_code == 200
        assert res.json()["accepted"] is True

        print("\n--- 6. Verifying Ledger State & Reward ---")
        res = client.get(f"/wallet/{addr}")
        assert res.status_code == 200
        wallet_data = res.json()
        print(f"Miner Wallet Balance: {wallet_data['balance_doom']} DOOM")
        assert wallet_data['balance_doom'] == 50.0

        res = client.get("/status")
        new_status = res.json()
        print(f"New Chain Height: #{new_status['height']}")
        assert new_status["height"] == initial_height + 1

        solver.close()
        print("\n[SUCCESS] END-TO-END MINING CYCLE SUCCEEDED 100%!")
    finally:
        if solver is not None:
            try:
                solver.close()
            except Exception:
                pass
        node.server.chain = orig_chain
        node.server.pool.chain = orig_pool_chain
        node.server.p2p.chain = orig_p2p_chain
        if os.path.exists(test_db):
            try:
                os.remove(test_db)
            except Exception:
                pass

if __name__ == '__main__':
    test_full_mining_cycle()
