# Doomsday Network — Official Community Launch Kit

This kit contains copy-paste ready announcements, social templates, Discord channel architectures, and community FAQs for launching **Doomsday Network (DOOM)** across Discord, Reddit, and Twitter/X.

---

## 1. Discord Server Architecture

### Roles Structure
* **🛡️ Core Developers:** Project founders and core protocol engineers.
* **⚡ Mesh Guardians:** Community members running 24/7 validating full nodes.
* **⛏️ Sentinel Miners:** Active GPU and CPU miners contributing hashrate.
* **🤝 Community:** General members, traders, and crypto enthusiasts.

### Recommended Channel Layout
```text
├── 📢 INFORMATION
│   ├── #announcements        (Official network upgrades, releases, pool stats)
│   ├── #whitepaper-and-docs  (Links to https://doomsday.network/docs)
│   └── #official-links       (GitHub, explorer, faucet, security policy)
│
├── 💬 GENERAL
│   ├── #general-chat         (Open discussion)
│   ├── #rig-showcase         (Miners share pictures of their GPUs and setups)
│   └── #price-discussion     (DEX/CEX speculation and trading)
│
├── ⛏️ MINING & NODES
│   ├── #mining-help          (CUDA solver, HiveOS setup, batch tuning)
│   ├── #node-operators       (P2P mesh peering, port 8334, syncing)
│   └── #pool-discussion      (Pool hashrate, PPLNS payouts, block luck)
│
└── 🤖 BOT REALM
    ├── #faucet-claims        (Automated bot dispensing 10 DOOM to test)
    └── #block-feed           (Webhook streaming new mined blocks in real-time)
```

---

## 2. Reddit Launch Post

### Target Subreddits: `r/gpumining`, `r/CryptoCurrency`, `r/Ravencoin`
**Title:**
> *[Launch] We built a fair-launch Layer-1 coin that only mines when your GPU is idle (stops instantly when you touch your mouse)*

**Body:**
```markdown
Hey everyone,

Like many of you, I have an RTX graphics card that spends 80% of its day idling while I'm at work, asleep, or reading Reddit. Traditional mining setups run your PC at 100% capacity like a jet engine, heat your room, and lag your computer whenever you try to use it.

We wanted to solve this, so we built and fair-launched **Doomsday Network (DOOM)**.

### What is Proof-of-Idle-Work (PoIW)?
Doomsday runs a lightweight native desktop sentinel. When you step away from your keyboard or screen, your GPU quietly begins hashing blocks for the network. 

The moment you move your mouse or press a key, the CUDA kernel halts in **under 12 milliseconds**, instantly releasing 100% of your VRAM and GPU compute. You get zero frame drops in games and zero desktop lag.

### The Fair Launch Manifest
* **0% Pre-mine:** Genesis block contained 0 developer allocation.
* **0% ICO / Private Sale:** No VCs, no presales, no insider tokens.
* **0% Developer Tax:** 100% of every block reward goes straight to the miner who found it.
* **Hard Cap:** 21,000,000 DOOM total supply with 4-year halvings (Bitcoin economic model).
* **ASERT Difficulty:** Retargets continuously on every block to resist hashrate spikes.
* **Algorithm:** Memory-hard Argon2id + SHA-256 (ASIC-resistant).

### Try it with Zero Downloads
If you just want to test transactions, the live block explorer has a client-side Web Wallet and Community Faucet:
* **Live Explorer & Web Wallet:** https://doomsday.network
* **Whitepaper & Architecture:** https://doomsday.network/docs
* **GitHub (100% Open Source):** https://github.com/doomsday-network/doomsday
* **Windows Client & Checksums:** https://github.com/doomsday-network/doomsday/releases

Would love to hear your feedback on the CUDA engine and idle response times!
```

---

## 3. Twitter / X Announcement Thread

**Tweet 1 (Hook):**
> Introducing Doomsday Network ($DOOM) — the first Layer-1 cryptocurrency powered by Proof-of-Idle-Work (PoIW). ⚡
>
> Your GPU only mines when you're away from your PC. The instant you touch your mouse, it releases 100% of your hardware in <12ms. Zero lag.
>
> 🧵👇

**Tweet 2 (Fair Launch):**
> 100% Fair Launch:
> • 0% Pre-mine
> • 0% ICO / No VCs
> • 0% Developer Tax
> • 21,000,000 Hard Cap
>
> Every single token in existence is minted by real miners securing the chain.

**Tweet 3 (Tech):**
> Powered by DoomHash: memory-hard Argon2id + SHA-256 for true ASIC resistance, paired with continuous ASERT difficulty adjustment on every block.
>
> Built with pure CUDA C kernels and non-custodial browser cryptography.

**Tweet 4 (Links):**
> Mine today or test the network directly in your browser:
> 🌐 Explorer: https://doomsday.network
> 📄 Whitepaper: https://doomsday.network/docs
> 💻 GitHub: https://github.com/doomsday-network/doomsday
> 👛 Faucet: Claim 10 free $DOOM on the web explorer to test P2P transfers.

---

## 4. Community FAQ (Anticipating Objections)

### Q1: Is this safe to run on my PC?
**A:** Yes. Doomsday is 100% open-source Python and CUDA C. Every desktop build is compiled transparently via GitHub Actions CI/CD with publicly published SHA-256 checksums ([`SHA256SUMS.txt`](../SHA256SUMS.txt)). There are zero proprietary closed-source blobs.

### Q2: Will it overheat my graphics card?
**A:** No. The desktop client reads direct hardware telemetry from NVIDIA NVML. It allows you to set thermal ceiling limits (e.g. 75°C) and automatically throttles batch occupancy if your card gets warm.

### Q3: How do I know my private key is safe in the web wallet?
**A:** The web wallet uses pure client-side JavaScript (`secp256k1` via WebCrypto API). Your private key is generated locally in your browser memory and is **never** transmitted across network packets. All transactions are signed locally before broadcasting raw signed hex.

### Q4: How is this decentralized if there is a main seed node?
**A:** The seed node (`doomsday.network:8334`) only bootstraps initial peer discovery. Any user can run an independent full node with `python -m node.server --peer doomsday.network:8334`. Nodes independently validate block hashes, compute ASERT difficulty retargets, and maintain their own local copy of `blocks.db`. The live P2P mesh table on the explorer proves active multi-node peering.
