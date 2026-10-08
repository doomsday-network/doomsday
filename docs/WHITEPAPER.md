# Doomsday Protocol Whitepaper
**Proof-of-Idle-Work (PoIW) & Sovereign Silicon Economics**
*Version 1.0.0 — October 2026*  
*Author: Doomsday Core Team <core@doomsday.network>*  
*Network Portal: [https://doomsday.network](https://doomsday.network)*

---

## 1. Abstract

Modern blockchain consensus mechanisms suffer from a fundamental trilemma between environmental sustainability, hardware sovereignty, and decentralization. Traditional Proof-of-Work (PoW) networks drive industrial centralization through specialized ASIC farms running 24/7 in climate-controlled facilities, consuming terawatt-hours of base-load energy. Conversely, Proof-of-Stake (PoS) models sacrifice physical censorship resistance by entrenching capital cartels, where coin ownership directly dictates protocol governance.

**Doomsday Network** introduces **Proof-of-Idle-Work (PoIW)**—a Layer-1 blockchain protocol engineered to capture latent, underutilized consumer GPU computing power without competing with human productivity, gaming frames-per-second, or workstation tasks. By utilizing a hybrid memory-hard algorithm combined with sub-millisecond operating system input telemetry, Doomsday miners stand vigilant in the background: harvesting network security when workstations are idle, and yielding 100% of GPU resources the instant user activity is detected.

---

## 2. The Proof-of-Idle-Work (PoIW) Paradigm

Consumer and gaming workstation GPUs represent the largest untapped pool of high-performance parallel silicon on Earth. Billions of compute hours are wasted daily while machines sit idle on lock screens, standby modes, or desk breaks.

### 2.1 Microsecond Input Interception
The Doomsday Sentinel utilizes native OS hook APIs (`GetLastInputInfo` on Windows, event counters on Linux) to poll hardware input state with microsecond accuracy. 

* **Active Threshold:** Configurable by user (e.g., 60s Aggressive, 180s Gamer Mode).
* **Yield Latency:** Sub-millisecond interrupt. The instant mouse motion, keypress, or gamepad actuation is registered, the CUDA execution context halts kernel dispatch and releases device queues.
* **Thermal Cutoff:** Continuous dynamic thermal throttling monitors GPU junction temperature, automatically scaling back batch dispatch if thermals exceed user thresholds (default: 75°C).

### 2.2 Sleep Prevention without Display Interruption
Doomsday integrates OS-level sleep suppression (`SetThreadExecutionState` with `ES_SYSTEM_REQUIRED` on Windows, systemd inhibit locks on Linux). The GPU and CPU core remain awake during idle periods while monitors and displays sleep normally according to user power plans.

---

## 3. Cryptographic Specification

### 3.1 DoomHash: Hybrid Memory-Hard Algorithm
DoomHash combines high-throughput parallel SHA256 transform mixing with memory-hard Argon2id seed derivation:

$$\text{Seed} = \text{SHA256}(\text{BlockHeaderPrefix})$$

$$\text{State}_i = \text{Argon2id}(\text{Seed} \oplus \text{Nonce}_i, \text{salt}, \text{mem}=64\text{MB})$$

$$\text{FinalHash} = \text{SHA256}(\text{State}_i)$$

* **ASIC Resistance:** Memory bandwidth latency prevents cheap fixed-function ASIC domination.
* **Bare-Metal CUDA Acceleration:** Kernels are compiled in-memory via NVIDIA NVRTC, bypassing third-party dependencies and achieving over 5+ Gigahashes per second on modern Blackwell/Ada silicon.

### 3.2 Elliptic Curve Cryptography
* **Curve:** `secp256k1` (standard Koblitz curve, $y^2 = x^3 + 7 \pmod p$)
* **Signature Scheme:** ECDSA with deterministic RFC 6979 nonce generation.
* **Address Derivation:**
  $$\text{Address} = \text{"doom1"} + \text{Hex}(\text{RIPEMD160}(\text{SHA256}(\text{PubKey}_{\text{compressed}}))) + \text{Checksum}_{4\text{B}}$$

---

## 4. Monetary Policy & Tokenomics

Doomsday enforces an immutable, hard-capped supply schedule modeled after thermodynamic scarcity:

* **Maximum Circulating Supply:** **21,000,000 DOOM** ($2.1 \times 10^{15}$ Sparks)
* **Base Unit:** 1 DOOM = $100,000,000$ Sparks ($10^8$ satoshi-equivalent)
* **Target Block Time:** **20 seconds**
* **Initial Block Subsidy:** **50.0 DOOM** per block
* **Halving Schedule:** Every **2,100,000 blocks** (~1.33 years)
* **Halving Progression:**
  * Blocks 0 – 2,099,999: 50.0 DOOM / block
  * Blocks 2,100,000 – 4,199,999: 25.0 DOOM / block
  * Blocks 4,200,000 – 6,299,999: 12.5 DOOM / block
  * Blocks 6,300,000 – 8,399,999: 6.25 DOOM / block
  * Decay continues across 64 halvings until full circulation is achieved.

---

## 5. Consensus & Dynamic Retargeting: ASERT

To prevent the classic "hashrate oscillation" catastrophe common in small-to-medium PoW networks, Doomsday implements **ASERT** (Absolutely Scheduled Exponentially-Rising Targets).

Instead of discrete batch recalculations (e.g. Bitcoin's 2016-block window), ASERT recalculates target difficulty smoothly on **every single block**:

$$\text{Target}_{n} = \text{Target}_{\text{anchor}} \times 2^{\frac{(t_n - t_{\text{anchor}}) - (h_n - h_{\text{anchor}}) \cdot T}{\tau}}$$

Where:
* $T = 20\text{ seconds}$ (target block interval)
* $\tau = 240\text{ seconds}$ (ASERT half-life smoothing parameter, equivalent to 12 blocks)
* $t_n, t_{\text{anchor}} =$ timestamps of current and anchor blocks
* $h_n, h_{\text{anchor}} =$ block heights of current and anchor blocks

### Advantages:
1. **Zero Oscillation:** Difficulty adjusts continuously without waiting for multi-day retarget windows.
2. **Instant Recovery:** If 80% of network hashrate leaves, the difficulty exponentially drops within minutes rather than freezing the chain.
3. **Mathematical Invariance:** Average block time strictly converges to 20 seconds regardless of total cluster power.

---

## 6. Network Architecture & Clients

### 6.1 Seed Nodes & RPC Layer
* **Sovereign Seed Node:** High-availability Linux node serving JSON-RPC over port 8334, fronted by automatic Let's Encrypt TLS reverse proxies.
* **Endpoints:**
  * `GET /status` — Network metrics, aggregate hashrate, active worker count, supply.
  * `GET /job` — Mining template generator for remote rigs.
  * `POST /submit` — Proof-of-work solution candidate submission.
  * `POST /tx/broadcast` — Client-side pre-signed raw transaction mempool broadcast.
  * `GET /wallet/{address}/utxos` — Confirmed unspent transaction output inspector for client-side signing.
  * `WS /ws` — Real-time event stream for blocks, transactions, and difficulty.

### 6.2 Client Ecosystem
* **Windows Desktop Client (`Doomsday.exe`):** Electron + NVRTC GUI client featuring stealth system tray backgrounding, sleep prevention, and live GPU telemetry meters.
* **Linux / HiveOS Headless Miner (`install.sh`):** 1-command curl installer for headless mining rigs, Ubuntu/Debian servers, and HiveOS mining farms.
* **Sovereign Web Wallet:** Client-side secp256k1 key generation, local keystore JSON backup, and 1-click testnet faucet.

---

## 7. Conclusion

Doomsday Network establishes a new equilibrium in distributed consensus. By transforming dormant GPU silicon into sovereign cryptographic security, it removes the environmental stigma of Proof-of-Work while upholding the permissionless, trust-minimized ideals of decentralized currency.

Stand vigil. Mine when you're away. Protect the network.
