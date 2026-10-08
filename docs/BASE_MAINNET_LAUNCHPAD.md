# 🚀 Base Mainnet Launchpad & Uniswap v3 Liquidity Engine

Welcome to the **Doomsday Network Base Mainnet Launchpad**. This guide details how to take Doomsday Network from sovereign Layer-1 Proof-of-Idle-Work mining to decentralized exchange liquidity on **Base** (Coinbase's Ethereum Layer-2).

---

## 📌 Quick Summary

| Component | Target Parameter | Status |
| :--- | :--- | :--- |
| **Network** | Base Mainnet (Chain ID `8453`) | Verified |
| **Token Name / Symbol** | Wrapped DOOM (`wDOOM`) | Compiled (5,602 bytes) |
| **Decimals** | 18 | Standard ERC-20 |
| **Backing Ratio** | 1:1 Proof-of-Reserve Vault | `doom1vault000000000000000000000000000000` |
| **DEX Router** | Uniswap v3 (`wDOOM / WETH`) | Verified on-chain |
| **Pool Fee Tier** | 1.00% (`10000`, Tick Spacing: 200) | Full-Range Perpetual |
| **Estimated Gas Cost** | ~0.000025 ETH (~$0.06 USD) | Ultra-low L2 Blob Gas |

---

## 🔑 1. Your Dedicated Base Deployer Wallet

A dedicated deployment keypair has been generated and securely saved to [`bridge/.env.base`](../bridge/.env.base) *(this file is permanently gitignored to protect your private keys)*:

```text
Public Address:  0x484eD370DEd0D36e36AAD469a2AFE5D69B1A005D
Network:         Base (Ethereum Layer-2)
Chain ID:        8453
```

> [!IMPORTANT]
> **Never commit or share `.env.base`**. It contains the private key that controls the deployer wallet and bridge relayer permissions.

---

## 💳 2. Sending Funds from Coinbase to Base

Once your Coinbase ACH deposit clearance period finishes:

1. Open **Coinbase.com** or the Coinbase mobile app.
2. Click **Transfer** → **Send / Withdraw**.
3. Select **Ethereum (ETH)**.
4. Enter your desired deposit amount (e.g. **$5.00 to $10.00 USD** or ~0.002 to 0.004 ETH).
5. In the recipient address field, paste your Base address:
   ```text
   0x484eD370DEd0D36e36AAD469a2AFE5D69B1A005D
   ```
6. **CRITICAL STEP — Choose Network:**
   - Under **Network / Route**, select **Base** (do **NOT** select Ethereum Mainnet!).
   - *Why Base?* Transfer fees on Base are usually under $0.05, and transactions settle in ~2 seconds.
7. Confirm the transfer.

---

## 📡 3. Checking Wallet Status

To monitor whether your funds have cleared and landed on Base Mainnet, run the automated balance watcher:

```powershell
cd bridge
npm.cmd run wallet:status
```

* **When waiting on hold:**
  ```text
  ETH Balance:   0.000000 ETH (~$0.00 USD)
  -------------------------------------------------------------
  ⏳ STATUS: AWAITING DEPOSIT FROM COINBASE
  ```

* **When funds arrive:**
  ```text
  ETH Balance:   0.003500 ETH (~$8.45 USD @ $2,415.00/ETH)
  -------------------------------------------------------------
  🟢 STATUS: FUNDS DETECTED! READY TO DEPLOY LAUNCHPAD
  💡 Run the following command to deploy wDOOM and launch the pool:
     npm.cmd run launch:mainnet
  ```

---

## ⚡ 4. 1-Click Pool Launch Command

The moment your funds are detected, execute the all-in-one launchpad script:

```powershell
cd bridge
npm.cmd run launch:mainnet
```

### What Happens Automatically:
1. **Verifies Gas:** Confirms you have sufficient ETH on Base.
2. **Deploys WrappedDOOM (wDOOM):** Broadcasts contract deployment to Base Mainnet.
3. **Mints Seed wDOOM:** Mints initial 100,000 wDOOM to the deployer wallet backed by native reserve.
4. **Wraps ETH into WETH:** Wraps your allocated ETH (e.g. 0.002 ETH) into canonical Base WETH.
5. **Initializes Uniswap v3 Pool:** Computes exact `sqrtPriceX96` ratio and initializes the pool via the Uniswap v3 Nonfungible Position Manager.
6. **Mints Full-Range Liquidity:** Adds perpetual liquidity across ticks `[-887200, 887200]`. Full-range liquidity guarantees that the market can never fall out of range.
7. **Saves Deployment Info:** Writes contract address, pool address, and transaction hash to [`bridge/build/deployment-mainnet.json`](../bridge/build/deployment-mainnet.json).

---

## 🧪 5. Testing & Simulation (Zero Real Funds Risk)

You can run full end-to-end dry-run simulations at any time before funds arrive:

```powershell
cd bridge
# Simulate all pricing, tick ranges, calldata, and gas budgets:
npm.cmd run simulate

# Dry-run the complete launch pipeline:
npm.cmd run launch:dry-run
```

---

## 🌐 6. Post-Launch Links Generated

Upon launch, the script will output live direct links for immediate trading and tracking:

* **Uniswap Trading Terminal:**
  `https://app.uniswap.org/explore/tokens/base/<CONTRACT_ADDRESS>`
* **DexScreener Real-Time Candlestick Chart:**
  `https://dexscreener.com/base/<POOL_ADDRESS>`
* **GeckoTerminal Analytics:**
  `https://www.geckoterminal.com/base/pools/<POOL_ADDRESS>`
* **Basescan Block Explorer:**
  `https://basescan.org/token/<CONTRACT_ADDRESS>`

---

## 🛡️ 7. Proof-of-Reserve Bridge Daemon

To keep the 1:1 backing in sync between native DOOM and wDOOM on Base:
```powershell
python -m bridge.bridge_daemon --poll-interval 15
```
* **Native Deposit -> wDOOM Mint:** Scans native block explorer for transactions sent to `doom1vault000000000000000000000000000000` with EVM memo, then mints `wDOOM`.
* **wDOOM Burn -> Native Release:** Listens to EVM `BridgedToNative` events and broadcasts native DOOM transfers from the vault to the miner's native address.
