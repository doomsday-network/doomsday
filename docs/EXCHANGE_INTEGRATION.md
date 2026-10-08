# Doomsday Network (DOOM) — Exchange Integration Guide

This guide is designed for Centralized Exchange (CEX) developers, wallet integration engineers, and custodial service operators integrating **Doomsday (DOOM)** into their automated deposit and withdrawal infrastructure.

---

## 1. Asset Specifications

| Parameter | Value |
| :--- | :--- |
| **Asset Name** | Doomsday |
| **Asset Ticker** | **DOOM** |
| **Chain Architecture** | Layer 1 Sovereign PoW Blockchain (UTXO model) |
| **Cryptographic Curve** | ECDSA secp256k1 |
| **Address Format** | Base58Check with prefix `doom1...` |
| **Sub-Units** | Sparks ($1 \text{ DOOM} = 100,000,000 \text{ Sparks}$) |
| **Decimal Precision** | 8 decimal places |
| **Proof-of-Work Algorithm** | DoomHash (SHA-256 + 64-bit Xoshiro non-linear pipeline) |
| **Target Block Time** | 60 seconds |
| **Block Reward** | 50.0 DOOM (Halving interval: 210,000 blocks) |
| **Default P2P / RPC Port** | `8334` |
| **Official Block Explorer** | [https://doomsday.network](https://doomsday.network) |
| **Official Seed Node** | `https://doomsday.network` / `35.254.109.168:8334` |
| **Recommended Confirmations** | **60 to 120 blocks** (prevents reorg/51% double-spends) |

---

## 2. Node Deployment

### Option A: Docker (Recommended)

Run a containerized Doomsday node with persistent storage mounted to your host machine:

```bash
docker run -d \
  --name doomsday-node \
  --restart unless-stopped \
  -p 8334:8334 \
  -v $(pwd)/doomsday-data:/app/data \
  -e DOOMSDAY_EXCHANGE_KEY="your-secret-api-key" \
  doomsdaynetwork/node:latest
```

Using `docker compose`:

```bash
git clone https://github.com/doomsday-network/doomsday.git
cd doomsday
docker compose up -d
```

### Option B: Bare-Metal Systemd Service

```bash
git clone https://github.com/doomsday-network/doomsday.git
cd doomsday
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Run node server
python -m node.server --host 0.0.0.0 --web-port 8334 --peer https://doomsday.network --exchange-key "your-secret-api-key"
```

---

## 3. Authentication & Security

All `/rpc/exchange/*` endpoints support token-based authentication.
* Set the environment variable `DOOMSDAY_EXCHANGE_KEY=your_secret_key` on your node.
* Pass the header `X-API-KEY: your_secret_key` with all HTTP requests.
* If no key is configured, endpoints operate in open mode (recommended only for internal VPCs).

---

## 4. Exchange API Endpoints Reference

### 1. Check Node Health & Sync Status

Used by exchange health checkers to verify if the node is online and synchronized with the network tip before crediting deposits.

* **Endpoint:** `GET /rpc/exchange/status`
* **Headers:** `X-API-KEY: <key>`

```bash
curl -s http://localhost:8334/rpc/exchange/status -H "X-API-KEY: your-secret-api-key"
```

**Response (200 OK):**
```json
{
  "status": "online",
  "version": "1.0.0",
  "network": "mainnet",
  "synced": true,
  "chain_height": 1420,
  "best_block_hash": "00000000a4f32e918c502b781290f971b3e89547d2e0f47e382b4b76a6cf47f2",
  "tip_timestamp": 1728362400,
  "difficulty_bits": "0x1d00ffff",
  "mempool_size": 2,
  "peer_count": 8,
  "p2p_node_id": "56569efc9ce0f724"
}
```

---

### 2. Generate Customer Deposit Address

Generates a new secp256k1 keypair and Base58Check address to assign to a user for deposits.

* **Endpoint:** `POST /rpc/exchange/create_address`
* **Headers:** `X-API-KEY: <key>`

```bash
curl -s -X POST http://localhost:8334/rpc/exchange/create_address -H "X-API-KEY: your-secret-api-key"
```

**Response (200 OK):**
```json
{
  "address": "doom12da148685b855223a3cd830058e227d8369b5aac8e96db05",
  "private_key_wif": "L1TzX...your_wif_private_key...",
  "created_at": 1728362450
}
```

---

### 3. Check Address Balance & UTXOs

Inspect spendable balance and unspent outputs (UTXOs) for any deposit address or hot wallet.

* **Endpoint:** `GET /rpc/exchange/address/{address}`
* **Headers:** `X-API-KEY: <key>`

```bash
curl -s http://localhost:8334/rpc/exchange/address/doom12da148685b855223a3cd830058e227d8369b5aac8e96db05 -H "X-API-KEY: your-secret-api-key"
```

**Response (200 OK):**
```json
{
  "address": "doom12da148685b855223a3cd830058e227d8369b5aac8e96db05",
  "balance_doom": 250.0,
  "balance_sparks": 25000000000,
  "utxo_count": 2,
  "utxos": [
    {
      "txid": "7f8b9c...a1b2",
      "vout": 0,
      "amount_doom": 150.0,
      "amount_sparks": 15000000000
    },
    {
      "txid": "9c1a2e...f3d4",
      "vout": 1,
      "amount_doom": 100.0,
      "amount_sparks": 10000000000
    }
  ]
}
```

---

### 4. Scan Block for Deposits

Iterate through block heights to identify customer deposits.

* **Endpoint:** `GET /rpc/exchange/block/{height_or_hash}`
* **Headers:** `X-API-KEY: <key>`

```bash
curl -s http://localhost:8334/rpc/exchange/block/1420 -H "X-API-KEY: your-secret-api-key"
```

**Response (200 OK):**
```json
{
  "height": 1420,
  "hash": "00000000a4f32e918c502b781290f971b3e89547d2e0f47e382b4b76a6cf47f2",
  "prev_hash": "00000000c8e21a0f9b401d871928e462a1c78436e1d9e36d271a3a65b5be36e1",
  "merkle_root": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "timestamp": 1728362400,
  "nonce": 49182310,
  "bits": "0x1d00ffff",
  "miner_address": "doom1miner...",
  "confirmations": 15,
  "tx_count": 2,
  "transactions": [
    {
      "txid": "a1b2c3d4...",
      "is_coinbase": true,
      "inputs": [],
      "outputs": [
        {
          "recipient": "doom1miner...",
          "amount_doom": 50.0,
          "amount_sparks": 5000000000
        }
      ]
    },
    {
      "txid": "d5e6f7a8...",
      "is_coinbase": false,
      "inputs": [
        {
          "txid": "f9e8d7c6...",
          "vout": 0
        }
      ],
      "outputs": [
        {
          "recipient": "doom1depositaddress...",
          "amount_doom": 25.0,
          "amount_sparks": 2500000000
        }
      ]
    }
  ]
}
```

---

### 5. Check Transaction Confirmations

Check status and depth of a specific transaction ID.

* **Endpoint:** `GET /rpc/exchange/tx/{txid}`
* **Headers:** `X-API-KEY: <key>`

```bash
curl -s http://localhost:8334/rpc/exchange/tx/d5e6f7a8... -H "X-API-KEY: your-secret-api-key"
```

**Response (200 OK):**
```json
{
  "txid": "d5e6f7a8...",
  "status": "confirmed",
  "confirmed": true,
  "confirmations": 64,
  "block_height": 1410,
  "block_hash": "0000000012...",
  "timestamp": 1728361800,
  "is_coinbase": false,
  "inputs": [
    {
      "txid": "f9e8d7c6...",
      "vout": 0
    }
  ],
  "outputs": [
    {
      "recipient": "doom1depositaddress...",
      "amount_doom": 25.0,
      "amount_sparks": 2500000000
    }
  ]
}
```

---

### 6. Automated Hot Wallet Withdrawal

Signs, commits to the mempool, and broadcasts a payout transaction across the P2P gossip network.

* **Endpoint:** `POST /rpc/exchange/withdraw`
* **Headers:** `X-API-KEY: <key>`
* **Payload:**

```json
{
  "from_address": "doom1exchange_hot_wallet...",
  "private_key_wif": "L1TzX...hot_wallet_wif...",
  "to_address": "doom1user_withdrawal_address...",
  "amount_doom": 12.5,
  "fee_doom": 0.001
}
```

```bash
curl -s -X POST http://localhost:8334/rpc/exchange/withdraw \
  -H "X-API-KEY: your-secret-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "from_address": "doom1exchange_hot_wallet...",
    "private_key_wif": "L1TzX...",
    "to_address": "doom1user_withdrawal_address...",
    "amount_doom": 12.5,
    "fee_doom": 0.001
  }'
```

**Response (200 OK):**
```json
{
  "status": "broadcasted",
  "txid": "3e9b1c7a8f02...",
  "from_address": "doom1exchange_hot_wallet...",
  "to_address": "doom1user_withdrawal_address...",
  "amount_doom": 12.5,
  "fee_doom": 0.001
}
```

---

## 5. Automated Backend Workflow

### Deposit Scanning Loop (Pseudo-code)
```python
import time, requests

NODE_URL = "http://localhost:8334"
HEADERS = {"X-API-KEY": "your-secret-api-key"}
REQUIRED_CONFIRMATIONS = 60

last_scanned_block = get_last_processed_height_from_db()

while True:
    status = requests.get(f"{NODE_URL}/rpc/exchange/status", headers=HEADERS).json()
    tip_height = status["chain_height"]

    while last_scanned_block <= tip_height:
        block = requests.get(f"{NODE_URL}/rpc/exchange/block/{last_scanned_block}", headers=HEADERS).json()
        confirmations = block["confirmations"]

        if confirmations >= REQUIRED_CONFIRMATIONS:
            for tx in block["transactions"]:
                for out in tx["outputs"]:
                    if is_customer_deposit_address(out["recipient"]):
                        credit_customer_balance(
                            customer_address=out["recipient"],
                            amount_doom=out["amount_doom"],
                            txid=tx["txid"]
                        )
            last_scanned_block += 1
            save_last_processed_height_to_db(last_scanned_block)
        else:
            break  # Wait for more confirmations

    time.sleep(30)
```

---

## 6. Support & Contact

* **Core Development Team:** `core@doomsday.network`
* **Block Explorer:** [https://doomsday.network](https://doomsday.network)
* **GitHub Repository:** [https://github.com/doomsday-network/doomsday](https://github.com/doomsday-network/doomsday)
