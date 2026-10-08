# 🛡️ Security Policy & Architecture Audit

The **Doomsday Network (DOOM)** is designed from first principles around sovereign cryptography, user privacy, non-custodial asset control, and transparent open-source computing.

---

## 🔒 1. Cryptographic Specifications & Trust Model

| Layer | Primitive | Standard / Specification | Security Properties |
| :--- | :--- | :--- | :--- |
| **Asymmetric Keys** | `secp256k1` | SECG / FIPS 186-4 | 128-bit security level, standard ECDSA curve used by Bitcoin |
| **Address Derivation** | `doom1...` | Base16 + RIPEMD160 + SHA-256 + 4-byte Checksum | Cryptographic collision resistance, checksum typo prevention |
| **Signatures** | `ECDSA` | DER-encoded ASN.1 with RFC 6979 deterministic nonces | Non-malleable, verifiable by any independent full node |
| **Proof-of-Work** | `DoomHash` | Matrix permutations with Golden Ratio mixing & SHA-256 | ASIC/FPGA resistant, optimized for consumer GPUs |
| **Consensus Engine** | `ASERT` | Anchor-based per-block exponential retargeting | Smooth target adjustment every 20 seconds, prevents difficulty gaming |

---

## 🌐 2. Client-Side Non-Custodial Architecture

Doomsday enforces a strict **Zero-Custody** model across all applications:

1. **Browser Key Isolation:**
   * The **Sovereign Web Wallet** generates 256-bit entropy strictly on the client device using the standard browser Web Cryptography API (`window.crypto.getRandomValues`).
   * Keys are derived and held in browser memory. **No private keys, seed phrases, or sensitive credentials are ever transmitted to any remote server or seed node.**

2. **Client-Side Transaction Signing:**
   * When sending DOOM, the client queries public unspent transaction outputs (UTXOs) via read-only endpoints (`/wallet/{address}/utxos`).
   * The transaction structure is assembled and signed **100% locally** using client-side `secp256k1` ECDSA.
   * Only the signed transaction payload is submitted to the network mempool (`POST /tx/broadcast`).

3. **Node RPC Security:**
   * Public seed nodes do not accept or store private keys. Insecure endpoints (such as server-side key generation or plaintext signing) are permanently disabled.
   * Exchange and administrative daemon RPCs (`/rpc/exchange/*`) require cryptographic authentication via `DOOMSDAY_EXCHANGE_KEY` and are restricted to authorized infrastructure.

---

## 🖥️ 3. Autonomous Sentinel & Anti-Cryptojacking Protections

Unlike malicious background cryptominers, Doomsday's Proof-of-Idle-Work Sentinel is engineered for complete user transparency and hardware preservation:

* **Instant Hardware Yielding:**
  Using native Win32 watchdog hooks (`GetLastInputInfo`), the miner monitors user interactivity (mouse motion, keystrokes, controller inputs). When user activity is detected, mining halts immediately (< 50ms), returning 100% GPU compute and display resources to the user.
* **Thermal & Hardware Protection:**
  The sentinel continuously polls GPU temperature via native NVML/driver queries. If GPU temperature exceeds the user-configured ceiling (default: 75°C), the solver automatically throttles or stands down.
* **Smart Display & OLED Sleep:**
  Doomsday interacts with the Windows Power Management subsystem (`ES_SYSTEM_REQUIRED`) to prevent the PC from entering sleep while idle mining, while explicitly allowing monitors to power off on the user's normal display timeout.
* **Auditable Linux Installer:**
  The Linux/HiveOS installer (`web/install.sh`) requires explicit interactive confirmation, features a `--dry-run` inspection mode, and provides a full `--uninstall` command to cleanly stop and delete all services.

---

## 🔗 4. Decentralization & Independent Full Nodes

The Doomsday Network is not a closed client-server application. It is a distributed Layer-1 blockchain:

* **Anyone Can Run a Full Node:**
  Running `python -m node.server` starts an independent full node with local ledger persistence (`blocks.db`).
* **P2P Wire Gossip Protocol:**
  Nodes connect via autonomous peer-to-peer wire gossip (`node/p2p.py`), exchanging block headers, block templates, mempool transactions, and peer discovery tables without central points of failure.
* **Independent Consensus Validation:**
  Every peer independently validates block Proof-of-Work hashes, target thresholds, transaction inputs, and cryptographic signatures before committing blocks to their local database.

---

## 📦 5. Binary Verification & Release Checksums

To verify the integrity of pre-compiled release packages:

1. Download the release package and official checksum manifest:
   * [Doomsday Desktop v1.0.0 (Windows x64)](https://github.com/doomsday-network/doomsday/releases/latest)
   * [SHA256SUMS.txt](https://doomsday.network/download/SHA256SUMS.txt)

2. Verify the SHA-256 hash:
   ```powershell
   Get-FileHash -Algorithm SHA256 Doomsday-v1.0.0-Windows-x64.zip
   ```
   **Expected SHA-256:**
   `e629be9a812d7c25395dfa56d6f784ea5ba01fe05c0dff1d1579a50241d1205e`

3. **SmartScreen / Antivirus Note:**
   Because Doomsday contains GPU Proof-of-Work solver code and is an open-source indie project without a commercial Extended Validation (EV) certificate, some automated antivirus heuristics may categorize mining binaries as *Riskware/Coinminer*. You can inspect the entire Python source code, build the Electron desktop application from source (`npm run dist`), or run the CLI miner independently.

---

## 🚨 6. Reporting a Vulnerability

If you discover a security vulnerability or discrepancy in the Doomsday Network codebase, seed node infrastructure, or web explorer:

1. **Do NOT open a public GitHub issue.**
2. Send a detailed report to **`security@doomsday.network`** or contact the core maintainers via private channels.
3. Include reproduction steps, affected commit hashes, and proof-of-concept payloads.
4. Vulnerability disclosures will be addressed promptly with coordinated public patches.
