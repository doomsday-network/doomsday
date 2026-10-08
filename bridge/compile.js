const fs = require('fs');
const path = require('path');
const solc = require('solc');

const contractPath = path.resolve(__dirname, 'contracts', 'WrappedDOOM.sol');
const source = fs.readFileSync(contractPath, 'utf8');

const input = {
  language: 'Solidity',
  sources: {
    'WrappedDOOM.sol': {
      content: source,
    },
  },
  settings: {
    outputSelection: {
      '*': {
        '*': ['abi', 'evm.bytecode.object'],
      },
    },
    optimizer: {
      enabled: true,
      runs: 200,
    },
  },
};

console.log('Compiling WrappedDOOM.sol...');
const output = JSON.parse(solc.compile(JSON.stringify(input)));

if (output.errors) {
  let hasError = false;
  output.errors.forEach((err) => {
    console.log(err.formattedMessage);
    if (err.severity === 'error') hasError = true;
  });
  if (hasError) {
    process.exit(1);
  }
}

const contract = output.contracts['WrappedDOOM.sol']['WrappedDOOM'];
const buildDir = path.resolve(__dirname, 'build');
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}

const artifact = {
  contractName: 'WrappedDOOM',
  abi: contract.abi,
  bytecode: contract.evm.bytecode.object,
};

fs.writeFileSync(
  path.resolve(buildDir, 'WrappedDOOM.json'),
  JSON.stringify(artifact, null, 2)
);

console.log('✓ Successfully compiled WrappedDOOM.sol!');
console.log('Bytecode size:', contract.evm.bytecode.object.length / 2, 'bytes');
console.log('Artifact saved to bridge/build/WrappedDOOM.json');
