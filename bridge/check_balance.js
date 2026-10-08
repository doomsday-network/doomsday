const fs = require('fs');
const path = require('path');
const https = require('https');
const { ethers } = require('ethers');

const ENV_FILE = path.resolve(__dirname, '.env.base');

function loadEnv() {
  if (!fs.existsSync(ENV_FILE)) {
    console.error('❌ bridge/.env.base not found. Run "node bridge/wallet_manager.js" first.');
    process.exit(1);
  }
  const content = fs.readFileSync(ENV_FILE, 'utf8');
  const env = {};
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const [k, ...v] = trimmed.split('=');
      env[k.trim()] = v.join('=').trim();
    }
  });
  return env;
}

async function getEthPriceUsd() {
  return new Promise((resolve) => {
    https.get('https://api.coinbase.com/v2/prices/ETH-USD/spot', { timeout: 3000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const price = parseFloat(json.data?.amount);
          resolve(price > 0 ? price : 3200);
        } catch {
          resolve(3200);
        }
      });
    }).on('error', () => resolve(3200));
  });
}

async function main() {
  const env = loadEnv();
  const isSepolia = process.argv.includes('--sepolia');
  const networkName = isSepolia ? 'Base Sepolia Testnet' : 'Base Mainnet';
  const rpcUrl = isSepolia
    ? env.BASE_SEPOLIA_RPC || 'https://sepolia.base.org'
    : env.BASE_MAINNET_RPC || 'https://mainnet.base.org';

  const address = env.EVM_ADDRESS;
  if (!address) {
    console.error('❌ EVM_ADDRESS not defined in bridge/.env.base');
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const [balanceWei, ethPrice] = await Promise.all([
    provider.getBalance(address),
    getEthPriceUsd()
  ]);

  const balanceEth = parseFloat(ethers.formatEther(balanceWei));
  const balanceUsd = balanceEth * ethPrice;

  // Check wDOOM balance if deployment record exists
  let wDoomBalance = '0.00';
  const depPath = path.resolve(__dirname, 'build', `deployment-${isSepolia ? 'sepolia' : 'mainnet'}.json`);
  if (fs.existsSync(depPath)) {
    try {
      const depInfo = JSON.parse(fs.readFileSync(depPath, 'utf8'));
      if (depInfo.contractAddress) {
        const erc20 = new ethers.Contract(depInfo.contractAddress, ['function balanceOf(address) view returns (uint256)'], provider);
        const wdoomWei = await erc20.balanceOf(address);
        wDoomBalance = parseFloat(ethers.formatEther(wdoomWei)).toLocaleString(undefined, { minimumFractionDigits: 2 });
      }
    } catch {}
  }

  console.log('\n=============================================================');
  console.log(`🛡️  DOOMSDAY NETWORK | ${networkName.toUpperCase()} STATUS`);
  console.log('=============================================================');
  console.log(`Address:       ${address}`);
  console.log(`Explorer:      https://${isSepolia ? 'sepolia.' : ''}basescan.org/address/${address}`);
  console.log(`ETH Balance:   ${balanceEth.toFixed(6)} ETH (~$${balanceUsd.toFixed(2)} USD @ $${ethPrice.toLocaleString()}/ETH)`);
  if (fs.existsSync(depPath)) {
    console.log(`wDOOM Balance: ${wDoomBalance} wDOOM`);
  }
  console.log('-------------------------------------------------------------');

  if (balanceEth >= 0.001) {
    console.log('🟢 STATUS: FUNDS DETECTED! READY TO DEPLOY LAUNCHPAD');
    console.log('💡 Run the following command to deploy wDOOM and launch the pool:');
    console.log(`   npm run launch:${isSepolia ? 'sepolia' : 'mainnet'}`);
  } else {
    console.log('⏳ STATUS: AWAITING DEPOSIT FROM COINBASE');
    console.log('💡 Once your Coinbase ACH hold clears, send $5-$10 of ETH on Base to:');
    console.log(`   ${address}`);
    console.log('   (Remember to select "Base" network on Coinbase!)');
  }
  console.log('=============================================================\n');
}

main().catch(err => {
  console.error('Balance check failed:', err.message);
  process.exit(1);
});
