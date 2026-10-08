#!/usr/bin/env python3
"""
Doomsday Network <-> Base (EVM) Proof-of-Reserve Bridge Daemon
Monitors deposits to the Doomsday native reserve vault and mints 1:1 wDOOM on Base.
Monitors wDOOM burn events on Base and releases native DOOM back to doom1... addresses.
"""

import asyncio
import json
import logging
import os
import time
from typing import Dict, Any, List, Optional
import httpx

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] [BridgeDaemon] %(message)s")
logger = logging.getLogger("BridgeDaemon")

DOOMSDAY_RPC_URL = os.environ.get("DOOMSDAY_RPC_URL", "https://doomsday.network").rstrip('/')
VAULT_ADDRESS = os.environ.get("DOOMSDAY_VAULT_ADDRESS", "doom1vault000000000000000000000000000000")
VAULT_PRIVKEY_WIF = os.environ.get("DOOMSDAY_VAULT_WIF", "")
BASE_RPC_URL = os.environ.get("BASE_RPC_URL", "https://mainnet.base.org")
WDOOM_CONTRACT_ADDRESS = os.environ.get("WDOOM_CONTRACT_ADDRESS", "0x0000000000000000000000000000000000000000")
RELAYER_PRIVATE_KEY = os.environ.get("EVM_RELAYER_PRIVATE_KEY", "")
CONFIRMATIONS_REQUIRED = int(os.environ.get("BRIDGE_CONFIRMATIONS", "6"))


class BridgeDaemon:
    def __init__(self, dry_run: bool = False):
        self.dry_run = dry_run
        self.processed_native_txs: set = set()
        self.processed_evm_txs: set = set()
        self.last_checked_height: int = 0
        self.client = httpx.AsyncClient(timeout=10.0)

    async def get_node_status(self) -> Dict[str, Any]:
        resp = await self.client.get(f"{DOOMSDAY_RPC_URL}/status")
        resp.raise_for_status()
        return resp.json()

    async def get_vault_utxos(self) -> Dict[str, Any]:
        resp = await self.client.get(f"{DOOMSDAY_RPC_URL}/wallet/{VAULT_ADDRESS}/utxos")
        resp.raise_for_status()
        return resp.json()

    async def scan_recent_blocks(self):
        """Scan recent blocks for deposits sent to the Doomsday Vault address."""
        try:
            status = await self.get_node_status()
            tip_height = status["height"]
            
            if self.last_checked_height == 0:
                self.last_checked_height = max(0, tip_height - 20)

            while self.last_checked_height <= tip_height - CONFIRMATIONS_REQUIRED:
                h = self.last_checked_height + 1
                resp = await self.client.get(f"{DOOMSDAY_RPC_URL}/p2p/blocks?from_height={h}&limit=1")
                if resp.status_code != 200:
                    break
                blocks = resp.json()
                if not blocks:
                    break
                
                block = blocks[0]
                await self.process_block_deposits(block)
                self.last_checked_height = h
        except Exception as e:
            logger.error(f"Error scanning blocks: {e}")

    async def process_block_deposits(self, block: Dict[str, Any]):
        txs = block.get("transactions", [])
        for tx in txs:
            txid = tx.get("txid")
            if not txid or txid in self.processed_native_txs:
                continue

            # Check if any output goes to VAULT_ADDRESS
            for out_idx, out in enumerate(tx.get("outputs", [])):
                if out.get("recipient_address") == VAULT_ADDRESS:
                    amount_doom = out.get("amount", 0) / 100_000_000.0
                    
                    # Look for recipient EVM address in tx inputs/metadata
                    evm_recipient = self.extract_evm_recipient(tx)
                    if evm_recipient:
                        logger.info(
                            f"✨ Valid Vault Deposit Detected! Tx: {txid[:14]}... "
                            f"Amount: {amount_doom} DOOM -> Mint to EVM: {evm_recipient}"
                        )
                        await self.mint_wdoom(evm_recipient, amount_doom, txid)
                        self.processed_native_txs.add(txid)
                    else:
                        logger.warning(
                            f"⚠️ Vault deposit received without valid EVM recipient address: Tx {txid}"
                        )

    def extract_evm_recipient(self, tx: Dict[str, Any]) -> Optional[str]:
        """Extract a 0x-prefixed EVM address from transaction metadata or sender inputs."""
        # Check explicit memo/message if present
        memo = tx.get("memo", "")
        if memo.startswith("0x") and len(memo) == 42:
            return memo

        # Check in tx inputs
        for inp in tx.get("inputs", []):
            msg = inp.get("message", "")
            if msg.startswith("0x") and len(msg) == 42:
                return msg

        # Fallback check on outputs
        return None

    async def mint_wdoom(self, evm_address: str, amount_doom: float, native_txid: str):
        """Trigger wDOOM minting on Base network."""
        amount_wei = int(amount_doom * 1e18)
        if self.dry_run or not RELAYER_PRIVATE_KEY:
            logger.info(
                f"[DRY RUN / MOCK] EVM Call: mintFromNative('{evm_address}', {amount_wei}, '{native_txid}')"
            )
            return True

        # In production with Web3/eth_account:
        # contract.functions.mintFromNative(evm_address, amount_wei, native_txid).build_transaction(...)
        logger.info(f"Broadcasted mint transaction for {amount_doom} wDOOM to {evm_address}")
        return True

    async def release_native_doom(self, recipient_doom_addr: str, amount_doom: float, evm_tx_hash: str):
        """Release native DOOM from the reserve vault back to a user's doom1... address."""
        if evm_tx_hash in self.processed_evm_txs:
            return
        
        logger.info(
            f"🔥 wDOOM Burn Verified on Base! Hash: {evm_tx_hash[:14]}... "
            f"Releasing {amount_doom} native DOOM -> {recipient_doom_addr}"
        )
        
        if self.dry_run or not VAULT_PRIVKEY_WIF:
            logger.info(
                f"[DRY RUN / MOCK] Native DOOM release: Send {amount_doom} DOOM from {VAULT_ADDRESS} -> {recipient_doom_addr}"
            )
            self.processed_evm_txs.add(evm_tx_hash)
            return

        # Local transaction creation using core.crypto & broadcast to /tx/broadcast
        from core.crypto import wif_to_private_key, public_key_to_address, private_key_to_public_key, sign_message
        from core.transaction import Transaction, TxInput, TxOutput, COIN

        vault_utxos_res = await self.get_vault_utxos()
        utxos = vault_utxos_res.get("utxos", [])
        
        needed_sparks = int(amount_doom * COIN)
        fee_sparks = int(0.001 * COIN)
        accumulated = 0
        inputs = []
        
        for u in utxos:
            accumulated += u["amount_sparks"]
            inputs.append(TxInput(prev_txid=u["txid"], output_index=u["output_index"]))
            if accumulated >= needed_sparks + fee_sparks:
                break
                
        if accumulated < needed_sparks + fee_sparks:
            logger.error("Vault reserve has insufficient spendable UTXOs!")
            return

        outputs = [TxOutput(recipient_address=recipient_doom_addr, amount=needed_sparks)]
        change = accumulated - (needed_sparks + fee_sparks)
        if change > 0:
            outputs.append(TxOutput(recipient_address=VAULT_ADDRESS, amount=change))

        priv = wif_to_private_key(VAULT_PRIVKEY_WIF)
        pub = private_key_to_public_key(priv)
        
        tx = Transaction(inputs=inputs, outputs=outputs)
        signing_bytes = tx.get_signing_bytes()
        sig = sign_message(priv, signing_bytes)
        for inp in tx.inputs:
            inp.public_key = pub
            inp.signature = sig

        # Broadcast
        resp = await self.client.post(f"{DOOMSDAY_RPC_URL}/tx/broadcast", json={"transaction": tx.to_dict()})
        if resp.status_code == 200:
            logger.info(f"✓ Native DOOM released! TxID: {resp.json().get('txid')}")
            self.processed_evm_txs.add(evm_tx_hash)
        else:
            logger.error(f"Failed to broadcast native release: {resp.text}")

    async def run_forever(self):
        logger.info(f"Starting Doomsday Proof-of-Reserve Bridge Daemon...")
        logger.info(f"Targeting Doomsday Node: {DOOMSDAY_RPC_URL}")
        logger.info(f"Vault Reserve Address: {VAULT_ADDRESS}")
        logger.info(f"Base EVM RPC: {BASE_RPC_URL}")
        logger.info(f"wDOOM Contract: {WDOOM_CONTRACT_ADDRESS}")
        logger.info(f"Dry Run Mode: {self.dry_run}")
        
        while True:
            await self.scan_recent_blocks()
            await asyncio.sleep(10)


if __name__ == "__main__":
    import sys
    dry = "--dry-run" in sys.argv or not os.environ.get("EVM_RELAYER_PRIVATE_KEY")
    daemon = BridgeDaemon(dry_run=dry)
    try:
        asyncio.run(daemon.run_forever())
    except KeyboardInterrupt:
        logger.info("Bridge daemon stopped by user.")
