# [ANN] [DOOM] Doomsday Network — Sovereign Proof-of-Idle-Work (PoIW)

**Website / Repository:** https://github.com/doomsday-network/doomsday  
**Whitepaper:** https://github.com/doomsday-network/doomsday/blob/main/docs/WHITEPAPER.md  
**Release Binary:** https://github.com/doomsday-network/doomsday/releases  

---

### [PHILOSOPHY & LORE]

> *"Doomsday Clock: 90 seconds to midnight. When the world goes dark, the silent silicon awakens."*

Cryptocurrency was born to be decentralized, permissionless, and sovereign. Over the last decade, that vision was hijacked. 
Bitcoin’s Proof-of-Work has centralized into multi-million-dollar industrial ASIC warehouses, while Proof-of-Stake has created plutocratic cartels where corporate capital dictates consensus.

Meanwhile, hundreds of millions of everyday gamers and creators own high-performance GPUs (NVIDIA RTX series) that sit **idle 70% to 80% of the day**, drawing 15 watts on a desktop.

**Doomsday (`DOOM`) is a sovereign Layer-1 blockchain engineered to activate this dormant silicon.**
Built with **DoomHash** (an ASIC-resistant memory-matrix PoW algorithm) and an embedded **Zero-Lag Idle Sentinel**, Doomsday enables ordinary gaming rigs to secure the ledger without sacrificing user experience. When you work or game, Doomsday drops all locks in <50ms. When you step away, the silent silicon awakens.

---

### [FAIR LAUNCH MANIFESTO]

* **0% Pre-mine:** No coins were minted prior to Genesis Block #0.
* **0% Founder / Developer Fee:** No hidden taxes or governance cuts.
* **0% ICO / VC Allocations:** No private rounds, no seed funds, no SAFTs.
* **100% Publicly Mined:** Every single coin in existence is forged purely through computational work on consumer silicon.

---

### [SPECIFICATIONS]

* **Ticker:** `DOOM`
* **Algorithm:** `DoomHash` (ASIC-resistant SIMD matrix permutation)
* **Target Block Time:** 20 seconds
* **Difficulty Retargeting:** `ASERT` (Anchor-based smooth per-block exponential)
* **Initial Block Reward:** 50 DOOM
* **Halving Schedule:** Every 2,100,000 blocks (~1.33 years)
* **Max Total Supply:** 21,000,000 DOOM
* **Default Ports:** P2P: `8333` | RPC / Explorer: `8334`

---

### [DOWNLOADS & QUICKSTART]

#### 1. Standalone Desktop Client (Windows / Mac / Linux)
Download the 1-click installer from **GitHub Releases**:
* **Windows:** `Doomsday-Setup-1.0.0.exe`
* Features:
  * 60-Second Onboarding Wizard (Auto-detects RTX GPUs)
  * 1-Click Wallet Generator
  * Minimizes to System Tray
  * Runs on Startup (Optional)
  * Prevents PC Sleep while allowing displays to turn off

#### 2. From Source (Developers / Node Runners)
```bash
git clone https://github.com/doomsday-network/doomsday.git
cd doomsday
python -m pip install -r requirements.txt

# Run Full Node & Live Explorer:
python -m node.server --web-port 8334

# Run Idle GPU Miner:
python -m miner.sentinel --node http://127.0.0.1:8334 --wallet <YOUR_DOOM_ADDRESS> --idle-sec 180
```

---

### [GENESIS BLOCK DETAILS]

* **Height:** 0
* **Hash:** `00000d07471c6ac9087230a51565953a31560592fd591cbd5c4a5fe0a3f1585f`
* **Merkle Root:** `5c3c8aa13c4b5ee74e3c99e57ad4e2b720d805dcc391348713d39e565c75df91`
* **Timestamp:** `1760000000`
* **Quote:** *"Doomsday Clock: 90 seconds to midnight. When the world goes dark, the silent silicon awakens."*

---

### [COMMUNITY & PARTICIPATION]
The code is 100% open-source under the MIT License. Anyone with an Nvidia GPU or CPU can participate immediately.

*When the world goes dark, the silent silicon awakens.*
