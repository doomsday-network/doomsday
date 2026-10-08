# Doomsday Network (DOOM)
## A Decentralized Proof-of-Idle-Work Cryptocurrency for Consumer Silicon

**Whitepaper v1.0**  
*Published: October 2026*  
*Repository: https://github.com/doomsday-network/doomsday*

---

### Abstract
Modern cryptocurrency networks have abandoned ordinary users. Bitcoin’s Proof-of-Work has centralized into specialized multi-million-dollar ASIC mining warehouses, while Ethereum and Proof-of-Stake protocols have created plutocratic cartels where capital dictates consensus. Concurrently, billions of dollars of high-performance consumer GPUs (GeForce RTX series) sit idle across the world for over 70% of each day, consuming negligible power while their computational capacity remains dormant.

**Doomsday (`DOOM`)** is a sovereign, decentralized Layer-1 Proof-of-Work blockchain engineered specifically to activate this dormant global computational capacity. Built with an ASIC-resistant consensus algorithm (**DoomHash**), a smooth per-block difficulty adjustment mechanism (ASERT), and a native, zero-lag **Idle Sentinel**, Doomsday enables ordinary gaming and creator workstations to secure a global ledger without degrading user experience. When users work or play, Doomsday sleeps; when the workstation falls idle, the silent silicon awakens.

Doomsday has no venture capital backing, no initial coin offering (ICO), no pre-mine, and no developer taxes. It is a 100% fair-launch network designed to endure as an autonomous, censorship-resistant public ledger.

---

### 1. Philosophy & Problem Statement

#### 1.1 The Centralization of Consensus
Satoshi Nakamoto's original vision of *"one CPU, one vote"* has been systematically dismantled:
1. **The Industrial ASIC Monopoly:** SHA-256 and Scrypt networks are dominated by a handful of ASIC manufacturers and mega-mining pools situated near subsidized hydroelectric grids. A consumer with a high-end desktop GPU cannot participate.
2. **The Staking Aristocracy:** Proof-of-Stake eliminates computational expenditure at the cost of decentralization: those who already own the coins control the block generation, vote on forks, and capture all protocol fees, creating an unassailable financial oligarchy.
3. **Fragility of Cloud-Dependent Networks:** Many modern blockchains rely on nodes hosted on centralized commercial clouds (AWS, Google Cloud, Hetzner). A coordinated regulatory action or infrastructure outage poses an existential risk to their liveness.

#### 1.2 The Latent Silicon Reservoir
Worldwide, millions of desktops possess immense compute capability—ranging from modern high-throughput architectures with high-speed memory subsystems (GDDR6/GDDR7) to multi-threaded modern CPUs. In typical consumer usage patterns, these machines operate at sub-10% capacity for 16 to 20 hours each day.

Doomsday turns this latent hardware reservoir into an unstoppable, decentralized computing fabric.

---

### 2. The DoomHash Proof-of-Work Algorithm

To prevent ASIC dominance and ensure long-term viability on consumer GPUs, Doomsday implements **DoomHash**.

#### 2.1 Design Objectives
1. **GPU-Optimal Compute:** DoomHash leverages high-throughput bitwise SIMD logic, non-linear permutation rounds, and memory-access branchiness that maps natively to GPU Streaming Multiprocessors (SMs).
2. **Zero-Dependency Bare-Metal Execution:** Miners do not require bloated software development kits (SDKs) or external C++ compilers. The reference GPU solver compiles directly via driver-level PTX (Parallel Thread Execution) JIT, allowing any consumer system with standard graphics drivers to participate immediately.
3. **Instant Header Verification:** While finding a valid nonce requires trillions of matrix-hash iterations, verifying a candidate block takes less than 10 microseconds on a standard CPU.

#### 2.2 Mathematical Specification
A candidate block header $H$ consists of:
$$H = \langle \text{Version}, \text{PrevHash}, \text{MerkleRoot}, \text{Timestamp}, \text{Bits}, \text{Nonce}, \text{MinerAddress} \rangle$$

The mining condition requires:
$$\text{DoomHash}(H, \text{Nonce}) < \text{Target}$$

Where $\text{Target}$ is a 256-bit unsigned integer derived from the compact difficulty representation $\text{Bits}$.

The DoomHash function executes two distinct cryptographic stages:
1. **State Mixing:** An initial fast cryptographic digest (Blake3 / Keccak) produces a 64-byte intermediate seed $S$.
2. **Non-Linear Register Permutation:** $S$ is expanded across an 8-round non-linear permutation matrix:
$$R_{i+1} = (R_i \lll k) \oplus (R_i \cdot \phi) \bmod 2^{64}$$
where $\phi$ is the golden ratio integer constant ($0x9E3779B97F4A7C15$), preventing loop unrolling shortcuts in custom ASIC silicon.
3. **Final Compression:** The permuted state is compressed via a final cryptographic digest to produce the 256-bit block hash.

---

### 3. Smooth Dynamic Difficulty (ASERT)

In a network where consumer GPUs enter and exit mining mode dynamically as users launch games or step away, traditional multi-day difficulty adjustments (e.g., Bitcoin's 2016-block window) would cause catastrophic oscillation.

Doomsday utilizes **ASERT** (Absolutely Scheduled Exponentially-Rising Targets), an anchor-based difficulty adjustment algorithm evaluated **per block**:

$$\text{Target}_{i} = \text{Target}_{\text{anchor}} \times 2^{\frac{(t_i - t_{\text{anchor}}) - (h_i - h_{\text{anchor}}) \times T}{\tau}}$$

Where:
* $T = 20\text{ seconds}$ (the target block interval).
* $\tau = 600\text{ seconds}$ (half-life smoothing factor).
* $h_i$ is current block height; $t_i$ is block timestamp.

**Properties:**
* If all 3 home GPUs enter idle state simultaneously, difficulty scales up smoothly over 10–20 blocks without sudden spikes.
* If a high-hashrate node exits immediately upon user input, the difficulty adjusts downward within minutes, preventing the blockchain from freezing.

---

### 4. Monetary Policy & Economic Model

Doomsday adopts a strictly predictable, deflationary emission curve inspired by hard money principles.

```
Total Max Supply: 21,000,000 DOOM
Initial Block Reward: 50 DOOM per block
Target Block Time: 20 seconds (~4,320 blocks per day)
Halving Interval: 2,100,000 blocks (~1.33 years)
Pre-mine: 0.00%
Developer Fee: 0.00%
```

#### 4.1 Emission Schedule
* **Era 1 (Blocks 0 – 2,100,000):** 50 DOOM / block (~105,000,000 total mined / era halving)
* **Era 2 (Blocks 2,100,001 – 4,200,000):** 25 DOOM / block
* **Era 3 (Blocks 4,200,001 – 6,300,000):** 12.5 DOOM / block
* Continues until block subsidy terminates, after which miners are compensated purely through transaction fees.

#### 4.2 Genesis Block
Block #0 contains no pre-mined coins and hardcodes the Genesis invocation:
> *"Doomsday Clock: 90 seconds to midnight. When the world goes dark, the silent silicon awakens."*

---

### 5. The Zero-Lag Idle Sentinel Architecture

Consumer hardware cannot be used for mining if it interferes with primary interactive workloads (gaming, rendering, editing).

```
                     +---------------------------+
                     |    User Activity Check    |
                     |  (Win32 GetLastInputInfo) |
                     +-------------+-------------+
                                   |
                   +---------------+---------------+
                   |                               |
          [Idle < Threshold]              [Idle >= Threshold]
                   |                               |
                   v                               v
         +-------------------+           +-------------------+
         | STATE: SUSPENDED  |           |   STATE: MINING   |
         | - 0% GPU Compute  |           | - CUDA Grid Run   |
         | - VRAM Released   |           | - Temp/Power Mon. |
         +-------------------+           +-------------------+
```

1. **Sub-Millisecond Preemption:** The sentinel continuously polls OS input subsystem timers via native Win32 calls. The moment mouse movement or keypress is registered, the CUDA mining process drops locks and yields GPU context within < 50ms.
2. **Foreground Process Awareness:** The sentinel checks for full-screen DirectX/Vulkan windows and known high-demand processes (`steam.exe`, `blender.exe`, `premiere.exe`). If an excluded process is running, mining remains locked out even if no physical input is detected.
3. **Thermal & Acoustic Hysteresis:** Mining starts after an idle ramp period (default: 180 seconds) and throttles back if GPU temperature exceeds user-configured thresholds (default: 72°C).

---

### 6. Network & Peer-to-Peer Protocol

The Doomsday network operates as a decentralized mesh:
* **Wire Protocol:** Binary JSON-RPC over TCP / WebSockets for low-latency block propagation.
* **Peer Discovery:** Hardcoded DNS seed nodes bootstrap newly connected clients into the distributed peer table.
* **Mini-Pool & Stratum:** Every node features an embedded Stratum server, enabling multi-PC households to direct all worker rigs to a single master coordinator without installing third-party pool software.
* **Integrated Explorer:** A local lightweight HTTP dashboard streams live blocks, difficulty targets, and network hashrate without reliance on third-party block explorers.

---

### 7. Security & Threat Model

* **51% Attack Resilience:** With ASERT difficulty adjustment, sudden influxes of malicious hash power are rapidly met with exponential difficulty increases.
* **Sybil Protection:** Peer reputation scoring disconnects nodes that broadcast invalid block headers or malformed transactions.
* **Double Spend Protection:** Transactions use standard UTXO model with secp256k1 ECDSA digital signatures, requiring 6 block confirmations for finality (~2 minutes).

---

### 8. Conclusion

Doomsday (`DOOM`) returns Proof-of-Work to its decentralized origin. By utilizing the massive, untapped pool of idle consumer GPUs through zero-lag background mining, Doomsday builds a resilient, censorship-proof digital currency that belongs to anyone with a home computer.

*When the world goes dark, the silent silicon awakens.*
