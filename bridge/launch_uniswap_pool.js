const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

const ENV_FILE = path.resolve(__dirname, '.env.base');

// Verified Uniswap v3 & System Addresses
const NETWORKS = {
  mainnet: {
    name: 'Base Mainnet',
    chainId: 8453,
    rpcUrl: process.env.BASE_MAINNET_RPC || 'https://mainnet.base.org',
    explorer: 'https://basescan.org',
    factory: '0x33128a8fC17869897dcE68Ed026d694621f6FDfD',
    positionManager: '0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1',
    weth: '0x4200000000000000000000000000000000000006'
  },
  sepolia: {
    name: 'Base Sepolia Testnet',
    chainId: 84532,
    rpcUrl: process.env.BASE_SEPOLIA_RPC || 'https://sepolia.base.org',
    explorer: 'https://sepolia.basescan.org',
    factory: '0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24',
    positionManager: '0x27F971cb582BF9E50F397e4d29a5C7A34f11faA2',
    weth: '0x4200000000000000000000000000000000000006'
  }
};

const WETH_ABI = [
  'function deposit() external payable',
  'function withdraw(uint256) external',
  'function balanceOf(address) view returns (uint256)',
  'function approve(address, uint256) returns (bool)'
];

const POSITION_MANAGER_ABI = [
  'function createAndInitializePoolIfNecessary(address token0, address token1, uint24 fee, uint160 sqrtPriceX96) external payable returns (address pool)',
  'function mint((address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline) params) external payable returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)'
];

const FACTORY_ABI = [
  'function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)'
];

function loadEnv() {
  if (fs.existsSync(ENV_FILE)) {
    const content = fs.readFileSync(ENV_FILE, 'utf8');
    content.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [k, ...v] = trimmed.split('=');
        if (!process.env[k.trim()]) {
          process.env[k.trim()] = v.join('=').trim();
        }
      }
    });
  }
}

function calculateSqrtPriceX96(amount0Wei, amount1Wei) {
  const Q96 = 2n ** 96n;
  const ratioX192 = (BigInt(amount1Wei) * (Q96 * Q96)) / BigInt(amount0Wei);
  let z = (ratioX192 + 1n) / 2n;
  let y = ratioX192;
  while (z < y) {
    y = z;
    z = (ratioX192 / z + z) / 2n;
  }
  return y;
}

async function main() {
  loadEnv();

  const isSepolia = process.argv.includes('--sepolia');
  const isDryRun = process.argv.includes('--dry-run');
  const net = isSepolia ? NETWORKS.sepolia : NETWORKS.mainnet;

  const privateKey = process.env.EVM_PRIVATE_KEY;
  if (!privateKey) {
    console.error('❌ EVM_PRIVATE_KEY is missing.');
    console.error('Run "node bridge/wallet_manager.js" first to generate your deployment credentials.');
    process.exit(1);
  }

  console.log('=============================================================');
  console.log(`🚀 DOOMSDAY NETWORK | 1-CLICK UNISWAP V3 POOL LAUNCHPAD`);
  console.log(`Target Network: ${net.name} (Chain ID ${net.chainId})`);
  console.log(`Mode:           ${isDryRun ? 'DRY-RUN SIMULATION (Zero Funds Risk)' : 'LIVE ON-CHAIN DEPLOYMENT'}`);
  console.log('=============================================================');

  const provider = new ethers.JsonRpcProvider(net.rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  const balanceWei = await provider.getBalance(wallet.address);
  const balanceEth = parseFloat(ethers.formatEther(balanceWei));

  console.log(`Deployer Address: ${wallet.address}`);
  console.log(`Wallet Balance:   ${balanceEth.toFixed(6)} ETH`);

  if (!isDryRun && balanceEth < 0.001) {
    console.error('\n❌ Insufficient ETH balance to deploy and seed liquidity!');
    console.log(`Please deposit $5-$10 ETH on Base from Coinbase to: ${wallet.address}`);
    console.log('Then run this command again.');
    process.exit(1);
  }

  // Determine Pool Seeding Amounts
  // Reserve 0.0005 ETH for gas, allocate remainder (up to 0.002 ETH) to initial liquidity
  let ethForLiquidity = '0.001';
  if (balanceEth >= 0.0025) {
    ethForLiquidity = '0.002';
  } else if (balanceEth > 0.001) {
    ethForLiquidity = (balanceEth - 0.0005).toFixed(4);
  }

  const wDoomForLiquidity = '100000'; // 100,000 wDOOM initial pool seed
  console.log(`Initial Pool Seed: ${wDoomForLiquidity} wDOOM + ${ethForLiquidity} ETH`);

  // Step 1: Compile & Deploy WrappedDOOM
  const artifactPath = path.resolve(__dirname, 'build', 'WrappedDOOM.json');
  if (!fs.existsSync(artifactPath)) {
    console.log('\n[1/6] Compiling WrappedDOOM contract...');
    require('./compile');
  }

  let wDoomAddress;
  const deploymentFile = path.resolve(__dirname, 'build', `deployment-${isSepolia ? 'sepolia' : 'mainnet'}.json`);
  if (fs.existsSync(deploymentFile)) {
    const existing = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
    wDoomAddress = existing.contractAddress;
    console.log(`\n[2/6] Reusing existing WrappedDOOM contract at: ${wDoomAddress}`);
  } else if (isDryRun) {
    wDoomAddress = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';
    console.log(`\n[2/6] [DRY RUN] Simulated WrappedDOOM deployment -> ${wDoomAddress}`);
  } else {
    console.log('\n[2/6] Deploying WrappedDOOM (wDOOM) to Base...');
    const { abi, bytecode } = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
    const factory = new ethers.ContractFactory(abi, bytecode, wallet);
    const contract = await factory.deploy(wallet.address);
    console.log(`Deployment transaction submitted: ${contract.deploymentTransaction().hash}`);
    await contract.waitForDeployment();
    wDoomAddress = await contract.getAddress();
    console.log(`🎉 WrappedDOOM deployed at: ${wDoomAddress}`);

    fs.writeFileSync(deploymentFile, JSON.stringify({
      network: net.name,
      chainId: net.chainId,
      contractAddress: wDoomAddress,
      deployer: wallet.address,
      deployedAt: new Date().toISOString()
    }, null, 2));
  }

  const { abi: wDoomAbi } = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  const wDoomContract = new ethers.Contract(wDoomAddress, wDoomAbi, wallet);

  // Step 2: Mint wDOOM Liquidity
  console.log(`\n[3/6] Verifying wDOOM deployer reserve balance...`);
  const currentWDoom = isDryRun ? 0n : await wDoomContract.balanceOf(wallet.address);
  const desiredWDoomWei = ethers.parseEther(wDoomForLiquidity);

  if (currentWDoom < desiredWDoomWei) {
    console.log(`Minting ${wDoomForLiquidity} wDOOM backed by native vault reserve...`);
    if (!isDryRun) {
      const mintTx = await wDoomContract.mintFromNative(
        wallet.address,
        desiredWDoomWei,
        `VAULT_RESERVE_SEED_${Date.now()}`
      );
      await mintTx.wait();
      console.log(`✓ Minted ${wDoomForLiquidity} wDOOM to deployer (Tx: ${mintTx.hash})`);
    } else {
      console.log(`✓ [DRY RUN] Simulated mint of ${wDoomForLiquidity} wDOOM`);
    }
  } else {
    console.log(`✓ Deployer already holds ${ethers.formatEther(currentWDoom)} wDOOM`);
  }

  // Step 3: Wrap ETH to WETH
  console.log(`\n[4/6] Wrapping ${ethForLiquidity} ETH into WETH...`);
  const wethContract = new ethers.Contract(net.weth, WETH_ABI, wallet);
  const ethWei = ethers.parseEther(ethForLiquidity);
  if (!isDryRun) {
    const currentWeth = await wethContract.balanceOf(wallet.address);
    if (currentWeth < ethWei) {
      const wrapNeeded = ethWei - currentWeth;
      const depositTx = await wethContract.deposit({ value: wrapNeeded });
      await depositTx.wait();
      console.log(`✓ Deposited ${ethers.formatEther(wrapNeeded)} ETH into WETH (Tx: ${depositTx.hash})`);
    } else {
      console.log(`✓ Already holding ${ethers.formatEther(currentWeth)} WETH`);
    }
  } else {
    console.log(`✓ [DRY RUN] Simulated WETH deposit of ${ethForLiquidity} ETH`);
  }

  // Step 4: Token Order & Mathematical SqrtPriceX96
  console.log(`\n[5/6] Calculating Uniswap v3 Pool parameters...`);
  const isWDoomToken0 = wDoomAddress.toLowerCase() < net.weth.toLowerCase();
  const token0 = isWDoomToken0 ? wDoomAddress : net.weth;
  const token1 = isWDoomToken0 ? net.weth : wDoomAddress;
  const amount0 = isWDoomToken0 ? desiredWDoomWei : ethWei;
  const amount1 = isWDoomToken0 ? ethWei : desiredWDoomWei;

  const sqrtPriceX96 = calculateSqrtPriceX96(amount0, amount1);
  const feeTier = 10000; // 1% fee tier (tick spacing 200)
  const minTick = -887200;
  const maxTick = 887200;

  console.log(`Token0: ${token0} (${isWDoomToken0 ? 'wDOOM' : 'WETH'})`);
  console.log(`Token1: ${token1} (${isWDoomToken0 ? 'WETH' : 'wDOOM'})`);
  console.log(`sqrtPriceX96: ${sqrtPriceX96.toString()}`);

  // Step 5: Initialize Pool & Mint Full-Range Liquidity
  console.log(`\n[6/6] Launching Uniswap v3 Pool on Base...`);
  const factory = new ethers.Contract(net.factory, FACTORY_ABI, wallet);
  const positionManager = new ethers.Contract(net.positionManager, POSITION_MANAGER_ABI, wallet);

  let poolAddress = ethers.ZeroAddress;
  if (!isDryRun) {
    poolAddress = await factory.getPool(token0, token1, feeTier);
    if (poolAddress === ethers.ZeroAddress) {
      console.log('Initializing new Uniswap v3 Pool...');
      const initTx = await positionManager.createAndInitializePoolIfNecessary(
        token0,
        token1,
        feeTier,
        sqrtPriceX96
      );
      await initTx.wait();
      poolAddress = await factory.getPool(token0, token1, feeTier);
      console.log(`🎉 Uniswap v3 Pool Initialized at: ${poolAddress}`);
    } else {
      console.log(`Existing Uniswap v3 Pool found at: ${poolAddress}`);
    }

    // Approve PositionManager to spend tokens
    console.log('Approving token allowances for Uniswap v3 Position Manager...');
    const approveDoomTx = await wDoomContract.approve(net.positionManager, desiredWDoomWei);
    await approveDoomTx.wait();
    const approveWethTx = await wethContract.approve(net.positionManager, ethWei);
    await approveWethTx.wait();

    // Mint Position
    console.log('Minting full-range perpetual liquidity position...');
    const mintParams = {
      token0,
      token1,
      fee: feeTier,
      tickLower: minTick,
      tickUpper: maxTick,
      amount0Desired: amount0,
      amount1Desired: amount1,
      amount0Min: 0,
      amount1Min: 0,
      recipient: wallet.address,
      deadline: Math.floor(Date.now() / 1000) + 1200
    };

    const mintPositionTx = await positionManager.mint(mintParams, { gasLimit: 500000 });
    const receipt = await mintPositionTx.wait();
    console.log(`✓ Liquidity Position Minted! (Tx: ${receipt.hash})`);
  } else {
    poolAddress = '0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640';
    console.log(`✓ [DRY RUN] Simulated pool initialization and liquidity mint -> ${poolAddress}`);
  }

  console.log('\n=============================================================');
  console.log('🎉 UNISWAP V3 DECENTRALIZED EXCHANGE LAUNCH COMPLETE!');
  console.log('=============================================================');
  console.log(`wDOOM Token:      ${wDoomAddress}`);
  console.log(`Uniswap Pool:     ${poolAddress}`);
  console.log(`Basescan Token:   ${net.explorer}/token/${wDoomAddress}`);
  console.log(`Uniswap Trade:    https://app.uniswap.org/explore/tokens/base/${wDoomAddress}`);
  console.log(`DexScreener:      https://dexscreener.com/base/${poolAddress}`);
  console.log(`GeckoTerminal:    https://www.geckoterminal.com/base/pools/${poolAddress}`);
  console.log('=============================================================\n');
}

main().catch(err => {
  console.error('\n❌ Launchpad execution failed:', err);
  process.exit(1);
});
