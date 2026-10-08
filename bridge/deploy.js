const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

async function main() {
  const isMainnet = process.argv.includes('--mainnet');
  const networkName = isMainnet ? 'Base Mainnet' : 'Base Sepolia Testnet';
  const rpcUrl = isMainnet
    ? process.env.BASE_MAINNET_RPC || 'https://mainnet.base.org'
    : process.env.BASE_SEPOLIA_RPC || 'https://sepolia.base.org';
  const chainId = isMainnet ? 8453 : 84532;

  const privateKey = process.env.EVM_PRIVATE_KEY;
  if (!privateKey) {
    console.error('❌ Error: EVM_PRIVATE_KEY environment variable is required.');
    console.error('Usage: EVM_PRIVATE_KEY=0x... node bridge/deploy.js [--mainnet]');
    process.exit(1);
  }

  console.log(`Connecting to ${networkName} (${rpcUrl})...`);
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  const balance = await provider.getBalance(wallet.address);

  console.log(`Deployer Address: ${wallet.address}`);
  console.log(`Wallet Balance:   ${ethers.formatEther(balance)} ETH`);

  if (balance === 0n) {
    console.error(`❌ Insufficient ETH for gas fees on ${networkName}!`);
    if (!isMainnet) {
      console.log('💡 Get free Base Sepolia testnet ETH at: https://www.alchemy.com/faucets/base-sepolia or https://faucets.chain.link');
    } else {
      console.log('💡 Send ~0.001 ETH ($2-$3) to your deployer address on Base to cover gas.');
    }
    process.exit(1);
  }

  const artifactPath = path.resolve(__dirname, 'build', 'WrappedDOOM.json');
  if (!fs.existsSync(artifactPath)) {
    console.error('❌ Artifact not found. Running compile first...');
    require('./compile');
  }

  const { abi, bytecode } = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  const factory = new ethers.ContractFactory(abi, bytecode, wallet);

  console.log(`Deploying WrappedDOOM (wDOOM) with initial owner: ${wallet.address}...`);
  const contract = await factory.deploy(wallet.address);
  console.log(`Transaction broadcast! Hash: ${contract.deploymentTransaction().hash}`);
  
  console.log('Waiting for block confirmation on Base...');
  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();

  console.log('====================================================');
  console.log(`🎉 Wrapped DOOM (wDOOM) Deployed Successfully!`);
  console.log(`Network:          ${networkName}`);
  console.log(`Contract Address: ${contractAddress}`);
  console.log(`Explorer Link:    https://${isMainnet ? '' : 'sepolia.'}basescan.org/address/${contractAddress}`);
  console.log('====================================================');

  // Save deployment info
  const deploymentRecord = {
    network: networkName,
    chainId,
    contractAddress,
    deployer: wallet.address,
    transactionHash: contract.deploymentTransaction().hash,
    deployedAt: new Date().toISOString(),
  };

  fs.writeFileSync(
    path.resolve(__dirname, 'build', `deployment-${isMainnet ? 'mainnet' : 'sepolia'}.json`),
    JSON.stringify(deploymentRecord, null, 2)
  );
  console.log(`Deployment recorded to bridge/build/deployment-${isMainnet ? 'mainnet' : 'sepolia'}.json`);
}

main().catch((err) => {
  console.error('Deployment failed:', err);
  process.exit(1);
});
