const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

const ENV_FILE = path.resolve(__dirname, '.env.base');

function main() {
  const args = process.argv.slice(2);
  const importIdx = args.indexOf('--import');

  let wallet;
  if (importIdx !== -1 && args[importIdx + 1]) {
    const rawKey = args[importIdx + 1].trim();
    try {
      wallet = new ethers.Wallet(rawKey);
      console.log('🔑 Successfully imported existing EVM private key.');
    } catch (e) {
      console.error('❌ Invalid private key provided for import:', e.message);
      process.exit(1);
    }
  } else if (fs.existsSync(ENV_FILE)) {
    const content = fs.readFileSync(ENV_FILE, 'utf8');
    const matchKey = content.match(/EVM_PRIVATE_KEY=(0x[a-fA-F0-9]{64})/);
    if (matchKey) {
      wallet = new ethers.Wallet(matchKey[1]);
      console.log('📁 Loaded existing Base deployer wallet from bridge/.env.base');
    }
  }

  if (!wallet) {
    wallet = ethers.Wallet.createRandom();
    console.log('✨ Generated new dedicated Base deployer keypair.');
  }

  const envContent = [
    '# Doomsday Network - Base L2 Deployment Credentials',
    '# CAUTION: Never share or commit this file! Kept gitignored.',
    `EVM_ADDRESS=${wallet.address}`,
    `EVM_PRIVATE_KEY=${wallet.privateKey}`,
    'BASE_MAINNET_RPC=https://mainnet.base.org',
    'BASE_SEPOLIA_RPC=https://sepolia.base.org',
    ''
  ].join('\n');

  fs.writeFileSync(ENV_FILE, envContent, 'utf8');

  console.log('\n=============================================================');
  console.log('🛡️  DOOMSDAY NETWORK | BASE L2 DEPLOYER WALLET');
  console.log('=============================================================');
  console.log(`Public Address:  ${wallet.address}`);
  console.log(`Network:         Base (Coinbase Ethereum Layer-2)`);
  console.log(`Chain ID:        8453 (Mainnet)`);
  console.log(`Saved To:        bridge/.env.base (Gitignored)`);
  console.log('=============================================================');
  console.log('\n💡 HOW TO FUND FROM COINBASE:');
  console.log('1. On Coinbase.com or Coinbase mobile app, go to "Send".');
  console.log('2. Select Ethereum (ETH).');
  console.log(`3. Paste your Base address: ${wallet.address}`);
  console.log('4. IMPORTANT: Under "Network", select "Base" (NOT Ethereum mainnet).');
  console.log('   (Base transfers take ~2 seconds and cost less than $0.05 in gas!)');
  console.log('5. Once sent, run: npm run wallet:status');
  console.log('=============================================================\n');
}

main();
