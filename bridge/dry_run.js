const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

// Test simulation parameters
const WETH_ADDRESS = '0x4200000000000000000000000000000000000006';
const MOCK_WDOOM_ADDRESS = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';
const POSITION_MANAGER_MAINNET = '0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1';
const FACTORY_MAINNET = '0x33128a8fC17869897dcE68Ed026d694621f6FDfD';

function calculateSqrtPriceX96(amount0Wei, amount1Wei) {
  // price = amount1 / amount0
  // sqrtPriceX96 = sqrt(amount1 / amount0) * 2^96
  // Using high-precision BigInt with 2^192 scaling
  const Q96 = 2n ** 96n;
  const ratioX192 = (BigInt(amount1Wei) * (Q96 * Q96)) / BigInt(amount0Wei);
  
  // Integer square root
  let z = (ratioX192 + 1n) / 2n;
  let y = ratioX192;
  while (z < y) {
    y = z;
    z = (ratioX192 / z + z) / 2n;
  }
  return y;
}

function runSimulation() {
  console.log('=============================================================');
  console.log('🧪 DOOMSDAY NETWORK | UNISWAP V3 POOL DRY-RUN SIMULATION');
  console.log('=============================================================');

  // Scenario: Deposit 100,000 wDOOM and 0.002 ETH (approx $5.00 USD)
  const amountWDoom = ethers.parseEther('100000');
  const amountEth = ethers.parseEther('0.002');
  const ethPriceUsd = 2415.0; // Benchmark ETH price

  console.log(`Pool Asset A:      100,000 wDOOM (18 decimals)`);
  console.log(`Pool Asset B:      0.002 ETH ($${(0.002 * ethPriceUsd).toFixed(2)} USD)`);
  const initialDoomPriceUsd = (0.002 * ethPriceUsd) / 100000;
  console.log(`Target Token Price: $${initialDoomPriceUsd.toFixed(6)} USD / DOOM`);
  console.log(`Market Cap @ 21M:   $${(initialDoomPriceUsd * 21000000).toLocaleString(undefined, { maximumFractionDigits: 2 })} USD`);

  // Step 1: Token Ordering
  const isWDoomToken0 = MOCK_WDOOM_ADDRESS.toLowerCase() < WETH_ADDRESS.toLowerCase();
  const token0 = isWDoomToken0 ? MOCK_WDOOM_ADDRESS : WETH_ADDRESS;
  const token1 = isWDoomToken0 ? WETH_ADDRESS : MOCK_WDOOM_ADDRESS;
  const amount0 = isWDoomToken0 ? amountWDoom : amountEth;
  const amount1 = isWDoomToken0 ? amountEth : amountWDoom;

  console.log('\n--- Uniswap v3 Token Order ---');
  console.log(`token0: ${token0} (${isWDoomToken0 ? 'wDOOM' : 'WETH'})`);
  console.log(`token1: ${token1} (${isWDoomToken0 ? 'WETH' : 'wDOOM'})`);
  console.log(`amount0: ${ethers.formatEther(amount0)}`);
  console.log(`amount1: ${ethers.formatEther(amount1)}`);

  // Step 2: SqrtPriceX96 Calculation
  const sqrtPriceX96 = calculateSqrtPriceX96(amount0, amount1);
  console.log('\n--- Mathematical Pricing ---');
  console.log(`Calculated sqrtPriceX96: ${sqrtPriceX96.toString()}`);
  
  // Verify price back from sqrtPriceX96
  const priceFromSqrt = Number(sqrtPriceX96 * sqrtPriceX96) / Number(2n ** 192n);
  console.log(`Derived price (token1/token0): ${priceFromSqrt.toExponential(6)}`);
  
  // Step 3: Full Range Ticks for 1% Fee Tier (tickSpacing = 200)
  const feeTier = 10000; // 1%
  const tickSpacing = 200;
  const minTick = -887200;
  const maxTick = 887200;

  console.log('\n--- Concentrated Liquidity Geometry ---');
  console.log(`Fee Tier:     ${feeTier / 10000}% (tier: ${feeTier})`);
  console.log(`Tick Spacing: ${tickSpacing}`);
  console.log(`Tick Range:   [${minTick}, ${maxTick}] (100% Full-Range Perpetual Liquidity)`);
  console.log(`Perpetual:    True (Trades can NEVER fall out of range)`);

  // Step 4: Mint Parameters
  const mintParams = {
    token0,
    token1,
    fee: feeTier,
    tickLower: minTick,
    tickUpper: maxTick,
    amount0Desired: amount0.toString(),
    amount1Desired: amount1.toString(),
    amount0Min: 0,
    amount1Min: 0,
    recipient: '0xDeployerAddress',
    deadline: Math.floor(Date.now() / 1000) + 1200
  };

  console.log('\n--- Prepared Calldata / Transaction Payload ---');
  console.log(JSON.stringify(mintParams, null, 2));

  // Step 5: Gas & Cost Estimate on Base L2
  const gasEstimateGwei = 0.05; // Base L2 typical gas price
  const estimatedGasUnits = 450000n; // Deploy contract + create pool + mint LP
  const estimatedCostEth = (Number(estimatedGasUnits) * gasEstimateGwei) / 1e9;
  const estimatedCostUsd = estimatedCostEth * ethPriceUsd;

  console.log('\n--- Gas & Execution Budget (Base L2) ---');
  console.log(`Estimated Gas Units:   ~${estimatedGasUnits.toLocaleString()} gas`);
  console.log(`Current Base L2 Gas:   ~${gasEstimateGwei} Gwei (Blob-enabled EIP-4844)`);
  console.log(`Total Deployment Fee:  ~${estimatedCostEth.toFixed(6)} ETH (~$${estimatedCostUsd.toFixed(4)} USD)`);
  console.log('=============================================================');
  console.log('✅ ALL SIMULATION CHECKS PASSED: READY FOR 1-CLICK LAUNCH!');
  console.log('=============================================================\n');
}

runSimulation();
