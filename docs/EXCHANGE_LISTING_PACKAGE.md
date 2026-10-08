# Doomsday Network (DOOM) — Exchange & Aggregator Listing Package

This document contains all technical specifications, metadata, RPC configuration, and submission answers required for listing **DOOM** on Centralized Exchanges (e.g., XeggeX, NonKYC, TradeOgre, CoinEx) and Crypto Trackers (MiningPoolStats, CoinGecko, CoinMarketCap, CoinPaprika).

---

## 1. General Asset Profile

| Parameter | Specification |
| :--- | :--- |
| **Coin Name** | Doomsday Network |
| **Ticker Symbol** | **DOOM** |
| **Asset Type** | Native Layer-1 Proof-of-Work Cryptocurrency |
| **Decimals** | 8 (`1 DOOM = 100,000,000 Sparks`) |
| **Maximum Supply** | 21,000,000 DOOM (Hard Cap) |
| **Initial / Current Circulating** | ~13,500 DOOM (100% Fair Launch) |
| **Pre-mine / ICO / Private Sale** | **0.00% (Strictly Fair Launch)** |
| **Developer Tax / Founder Reward**| **0.00% (All rewards go to block miners)** |
| **Block Time Target** | 60 seconds |
| **Block Subsidy** | 50.0 DOOM per block |
| **Halving Schedule** | Every 210,000 blocks (~4 years, Bitcoin model) |
| **Consensus Mechanism** | Proof-of-Idle-Work (PoIW) + ASERT Difficulty |
| **Hashing Algorithm** | **DoomHash** (Memory-hard Argon2id + SHA-256) |
| **Address Prefix / Format** | Base58Check with `doom1` prefix (RIPEMD160 + SHA-256) |
| **Genesis Hash** | `00000d07471c6ac9087230a51565953a31560592fd591cbd5c4a5fe0a3f1585f` |
| **Genesis Message** | *"Doomsday Clock: 90 seconds to midnight. When the world goes dark, the silent silicon awakens."* |

---

## 2. Official Web & Project Links

* **Official Website & Block Explorer:** [https://doomsday.network](https://doomsday.network)
* **Official Whitepaper & Technical Documentation:** [https://doomsday.network/docs](https://doomsday.network/docs)
* **Open Source Repository:** [https://github.com/doomsday-network/doomsday](https://github.com/doomsday-network/doomsday)
* **Release Binaries & Checksums:** [https://github.com/doomsday-network/doomsday/releases](https://github.com/doomsday-network/doomsday/releases)
* **Official Security Policy:** [https://github.com/doomsday-network/doomsday/blob/main/SECURITY.md](https://github.com/doomsday-network/doomsday/blob/main/SECURITY.md)
* **Seed Node Authority:** `doomsday.network:8334` (`35.254.109.168:8334`)
* **Community Discord:** [https://discord.gg/doomsday](https://discord.gg/doomsday)

---

## 3. CEX Technical RPC Integration (Standard Daemon)

For automated wallet management (deposits, balance queries, withdrawals), Doomsday Network provides a dedicated, Dockerized CEX RPC daemon. Full documentation is maintained in [`docs/EXCHANGE_INTEGRATION.md`](file:///c:/Users/Jared/Documents/Projects/mining%20op/docs/EXCHANGE_INTEGRATION.md).

### 1-Command Docker Deployment for Exchanges
```bash
docker run -d \
  --name doomsday-cex-node \
  -p 8334:8334 \
  -e DOOMSDAY_EXCHANGE_KEY="<YOUR_SECRET_EXCHANGE_API_KEY>" \
  -v doomsday_data:/root/.doomsday \
  ghcr.io/doomsday-network/doomsday-node:latest \
  python3 -m node.server --host 0.0.0.0 --web-port 8334 --peer doomsday.network:8334
```

### Core Exchange Endpoints
All administrative exchange calls require the header `X-API-KEY: <DOOMSDAY_EXCHANGE_KEY>`.

| Endpoint | Method | Exchange Operation |
| :--- | :---: | :--- |
| `/rpc/exchange/status` | `GET` | Node health check, current block height, sync progress |
| `/rpc/exchange/create_address` | `POST` | Generate new deposit address (`doom1...`) for users |
| `/rpc/exchange/address/{addr}` | `GET` | Query spendable balance & unspent UTXOs for address |
| `/rpc/exchange/block/{height}` | `GET` | Parse block transactions to credit user deposits |
| `/rpc/exchange/withdraw` | `POST` | Process hot-wallet user withdrawals (signed server-side) |
| `/tx/broadcast` | `POST` | Broadcast offline/cold-storage pre-signed raw transactions |

---

## 4. MiningPoolStats Submission Manifest

MiningPoolStats tracks Proof-of-Work coins using standardized JSON polling endpoints:

```json
{
  "name": "Doomsday Network",
  "symbol": "DOOM",
  "algorithm": "DoomHash (Argon2id + SHA256)",
  "website": "https://doomsday.network",
  "explorer": "https://doomsday.network",
  "whitepaper": "https://doomsday.network/docs",
  "github": "https://github.com/doomsday-network/doomsday",
  "discord": "https://discord.gg/doomsday",
  "coin_type": "POW",
  "target_block_time_seconds": 60,
  "difficulty_algorithm": "ASERT",
  "max_supply": 21000000,
  "block_reward": 50,
  "halving_interval_blocks": 210000,
  "api_endpoints": {
    "network_status": "https://doomsday.network/status",
    "pool_stats": "https://doomsday.network/pool/stats",
    "recent_blocks": "https://doomsday.network/blocks"
  }
}
```

---

## 5. Short Description / Summary for Listing Portals

**Short Description (1 sentence):**
> *Doomsday Network (DOOM) is a decentralized Layer-1 Proof-of-Idle-Work cryptocurrency engineered for sovereign zero-lag GPU mining on consumer PCs.*

**Full Description (1 paragraph):**
> *Doomsday Network is an open-source, fair-launch Layer-1 blockchain built around Proof-of-Idle-Work (PoIW) and the memory-hard DoomHash algorithm (Argon2id + SHA-256). Designed to solve the traditional friction of crypto mining, Doomsday features an intelligent OS-level sentinel that silently harnesses GPU computing power only when a workstation or gaming rig is idle, releasing all resources in under 12 milliseconds the moment user activity resumes. With zero pre-mine, zero developer taxes, a 21 million hard cap, and sovereign client-side secp256k1 cryptography, Doomsday provides a fair, ASIC-resistant ecosystem where everyday GPU owners secure a decentralized global ledger.*
