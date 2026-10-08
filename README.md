# ⚡ Doomsday Network (DOOM)

> *"Doomsday Clock: 90 seconds to midnight. When the world goes dark, the silent silicon awakens."*

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Consensus](https://img.shields.io/badge/Consensus-Proof--of--Idle--Work-red.svg)](#)
[![Algorithm](https://img.shields.io/badge/Algorithm-DoomHash%20(ASIC--Resistant)-purple.svg)](#)
[![Block Time](https://img.shields.io/badge/Block%20Time-20s-green.svg)](#)
[![Zero-Dependency CUDA](https://img.shields.io/badge/GPU%20Engine-Bare--Metal%20PTX%20JIT-blue.svg)](#)

**Doomsday (`DOOM`)** is a sovereign Layer-1 Proof-of-Work cryptocurrency engineered for consumer GPUs. It activates the dormant computational capacity of gaming and creator PCs when they sit idle, automatically standing down the instant you use your computer.

* **100% Fair Launch:** No pre-mine. No ICO. No VC allocations. No founder tax. Block #0 mined live.
* **Native Zero-Lag Idle Sentinel:** Mines in the background when your PC is idle; yields GPU resources immediately (< 50ms) on mouse movement, keystroke, or full-screen gaming.
* **Bare-Metal GPU Solver:** Uses the NVIDIA driver's native JIT compiler (`nvcuda.dll`). No Visual Studio or 10GB CUDA SDKs needed. Double-click and mine.
* **ASERT Per-Block Difficulty:** Smooth target retargeting every 20 seconds. Difficulty smoothly adapts as machines go to sleep or awaken.
* **Built-in Live Explorer:** Every node ships with an integrated real-time web dashboard showing the Doomsday Clock, live blocks, difficulty gauge, and cluster hashrates.

---

## 📊 Specification

| Parameter | Value |
| :--- | :--- |
| **Ticker** | `DOOM` |
| **Max Supply** | `21,000,000 DOOM` |
| **Target Block Time** | `20 seconds` |
| **Initial Block Reward** | `50 DOOM` |
| **Halving Interval** | `2,100,000 blocks` (~1.33 years) |
| **Consensus Algorithm** | `DoomHash` (ASIC-resistant matrix-permutation PoW) |
| **Difficulty Retargeting** | `ASERT` (Anchor-based per-block exponential) |
| **P2P Port** | `8333` |
| **RPC / Explorer Port** | `8334` |

Read the full technical specification in the **[Doomsday Whitepaper](docs/WHITEPAPER.md)**.

---

## 🏗️ Architecture

```
                       +-----------------------------------+
                       |    Doomsday Node & Coordinator    |
                       |    (Runs on Master PC / Server)   |
                       |  - Ledger, Mempool, ASERT Engine  |
                       |  - P2P Gossip (Port 8333)         |
                       |  - Built-in Web Explorer (8334)   |
                       +-----------------+-----------------+
                                         ^
                 +-----------------------+-----------------------+
                 | LAN RPC / Stratum                             | LAN RPC / Stratum
                 v                                               v
   +---------------------------+                   +---------------------------+
   |   Worker Rig 1 (RTX 5080) |                   |   Worker Rig 2 (RTX 4060) |
   | - Idle Sentinel           |                   | - Idle Sentinel           |
   | - Bare-Metal CUDA PTX     |                   | - Bare-Metal CUDA PTX     |
   | - Win32 Zero-Lag Watchdog |                   | - Win32 Zero-Lag Watchdog |
   +---------------------------+                   +---------------------------+
```

---

## 🚀 Quickstart

### Prerequisites
* **OS:** Windows 10/11 or Linux
* **Python:** 3.10+ (standard packages only)
* **GPU (Recommended):** Any NVIDIA GeForce GPU (RTX 3000, 4000, 5000 series). Driver version 520+ recommended.

### 1. Clone & Setup
```bash
git clone https://github.com/doomsday-network/doomsday.git
cd doomsday
python -m pip install -r requirements.txt
```

### 2. Start the Full Node & Block Explorer
On your primary machine:
```bash
python -m node.server --port 8333 --web-port 8334
```
Open **`http://localhost:8334`** in your browser to view the **Doomsday Live Explorer**.

### 3. Generate a Wallet
```bash
python -m wallet.cli generate
# Outputs your private key and public address: doom1q9x...
```

### 4. Start the Idle Miner
On any PC in your home:
```bash
python -m miner.sentinel --node http://<NODE_IP>:8334 --wallet <YOUR_DOOM_ADDRESS> --idle-sec 180
```
* The miner will monitor mouse/keyboard activity.
* Once idle for 180 seconds, the GPU solver will automatically launch.
* The moment you move your mouse or press a key, mining pauses instantly.

---

## 💻 Multi-PC Home Mining Setup

To mine across your home network (e.g. RTX 5080 + RTX 4060 Ti + RTX 4060):

1. **PC 1 (RTX 5080):** Run the node server + local idle miner:
   ```bash
   python -m node.server --host 0.0.0.0 --port 8333 --web-port 8334
   python -m miner.sentinel --node http://127.0.0.1:8334 --wallet <WALLET_ADDR> --name "Rig-5080"
   ```
2. **PC 2 & PC 3 (RTX 4060 Ti / 4060):** Run the idle miner pointing to PC 1's LAN IP:
   ```bash
   python -m miner.sentinel --node http://192.168.1.100:8334 --wallet <WALLET_ADDR> --name "Rig-4060Ti"
   ```
3. Check the **Doomsday Web Dashboard** to see all three rigs reporting hashrate and winning blocks in real-time.

---

## 📜 License
Released under the [MIT License](LICENSE).
