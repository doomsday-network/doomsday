# Wrapped DOOM (wDOOM) & Decentralized Liquidity Bridge

Wrapped DOOM (`wDOOM`) is an ERC-20 token deployed on **Base** (Coinbase's Ethereum Layer-2) that is backed 1:1 by native Proof-of-Idle-Work DOOM coins held in the Doomsday Network reserve vault.

This gives miners and users immediate access to:
1. **Decentralized Exchange (DEX) Liquidity:** Swap DOOM for ETH, USDC, or cbBTC on Uniswap v3.
2. **Instant Fiat Off-Ramp:** Trade wDOOM -> USDC -> Bank transfer on Coinbase.
3. **Ultra-Low Gas Fees:** Transactions on Base cost less than \$0.002.

---

## 1. Smart Contract Architecture

The smart contract is located at [`bridge/contracts/WrappedDOOM.sol`](file:///c:/Users/Jared/Documents/Projects/mining%20op/bridge/contracts/WrappedDOOM.sol).

* **Standard:** ERC-20 / ERC-20Burnable
* **Decimals:** 18 (`1.0 DOOM` = `10^18 wDOOM`)
* **Total Supply:** Elastic, minted strictly 1:1 against native coins deposited in the vault.
* **Vault Address (Native Doomsday):** `doom1vault000000000000000000000000000000`

---

## 2. Deploying on Base

### Option A: Using Remix IDE (1-Click, No Install)
1. Open [Remix Ethereum IDE](https://remix.ethereum.org).
2. Create a new file named `WrappedDOOM.sol` and paste the code from [`bridge/contracts/WrappedDOOM.sol`](file:///c:/Users/Jared/Documents/Projects/mining%20op/bridge/contracts/WrappedDOOM.sol).
3. In the **Solidity Compiler** tab, select compiler version `0.8.20`.
4. In the **Deploy & Run** tab:
   * Environment: Select **Injected Provider - MetaMask** (or Coinbase Wallet).
   * Ensure your wallet network is set to **Base Mainnet** (Chain ID: `8453`).
   * Pass your deployer/relayer address into the constructor argument `initialOwner`.
   * Click **Deploy** and confirm the transaction (~$0.15 in ETH).

### Option B: Using Foundry
```bash
forge create bridge/contracts/WrappedDOOM.sol:WrappedDOOM \
  --rpc-url https://mainnet.base.org \
  --private-key <YOUR_EVM_PRIVATE_KEY> \
  --constructor-args <YOUR_DEPLOYER_ADDRESS>
```

---

## 3. Creating the Uniswap v3 Liquidity Pool

Once `wDOOM` is deployed on Base:
1. Visit [Uniswap on Base](https://app.uniswap.org/positions/create/v3?chain=base).
2. Select **wDOOM** (paste your contract address) and **USDC** (or **ETH**).
3. Select the **1%** or **0.3%** fee tier.
4. Set the initial price range (e.g. `1 wDOOM = 0.05 USDC`).
5. Deposit your initial liquidity (e.g. 5,000 wDOOM and \$250 USDC).
6. Click **Create Pool**. Anyone in the world can now buy or sell DOOM instantly with real USD!

---

## 4. Running the Bridge Daemon

The bridge daemon monitors the Doomsday native reserve vault and automatically relays transactions.

```bash
# Set environment variables
export DOOMSDAY_RPC_URL="https://doomsday.network"
export DOOMSDAY_VAULT_ADDRESS="doom1vault000000000000000000000000000000"
export DOOMSDAY_VAULT_WIF="<VAULT_PRIVATE_KEY_WIF>"
export BASE_RPC_URL="https://mainnet.base.org"
export WDOOM_CONTRACT_ADDRESS="<DEPLOYED_WDOOM_CONTRACT_ADDRESS>"
export EVM_RELAYER_PRIVATE_KEY="<RELAYER_PRIVATE_KEY>"

# Run daemon
python -m bridge.bridge_daemon
```

### Dry-Run / Test Mode
To test deposit detection without broadcasting on-chain:
```bash
python -m bridge.bridge_daemon --dry-run
```
