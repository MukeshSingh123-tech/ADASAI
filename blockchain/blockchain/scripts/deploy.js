import { network } from "hardhat";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Connect to the network specified via --network CLI flag
const connection = await network.connect();
const { ethers } = connection;
const networkName = connection.networkName;

const [deployer] = await ethers.getSigners();

console.log("============================================");
console.log("  ForensicLogger — Contract Deployment");
console.log("============================================");
console.log(`Network : ${networkName}`);
console.log(`Deployer: ${deployer.address}`);

const balance = await ethers.provider.getBalance(deployer.address);
console.log(`Balance : ${ethers.formatEther(balance)} ETH`);
console.log("--------------------------------------------");

// Deploy
const ForensicLogger = await ethers.getContractFactory("ForensicLogger");
const logger = await ForensicLogger.deploy();
await logger.waitForDeployment();

const contractAddress = await logger.getAddress();

console.log(`\n  ForensicLogger deployed to: ${contractAddress}\n`);
console.log("--------------------------------------------");
console.log("Next steps:");
console.log(`  1. export ADAS_CONTRACT_ADDRESS=${contractAddress}`);
console.log(`  2. python web3_bridge.py --contract ${contractAddress}`);
console.log("============================================\n");

// Save deployment info to a JSON file for the Python bridge to read
const chainId = (await ethers.provider.getNetwork()).chainId.toString();

const deploymentInfo = {
  network: networkName,
  contractAddress: contractAddress,
  deployer: deployer.address,
  deployedAt: new Date().toISOString(),
  chainId: chainId,
};

const outDir = path.join(__dirname, "..", "deployments");
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const outFile = path.join(outDir, `${networkName}.json`);
fs.writeFileSync(outFile, JSON.stringify(deploymentInfo, null, 2));
console.log(`Deployment info saved to: ${outFile}`);

// Also write frontend config for MetaMask dashboard
const frontendDir = path.join(__dirname, "..", "frontend");
if (!fs.existsSync(frontendDir)) {
  fs.mkdirSync(frontendDir, { recursive: true });
}

// Vite serves static files from public/ directory
const publicDir = path.join(frontendDir, "public");
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Read the compiled ABI from artifacts
const artifactPath = path.join(
  __dirname, "..", "artifacts", "contracts",
  "ForensicLogger.sol", "ForensicLogger.json"
);
let abi = [];
if (fs.existsSync(artifactPath)) {
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  abi = artifact.abi;
}

const frontendConfig = {
  contractAddress: contractAddress,
  chainId: chainId,
  network: networkName,
  deployer: deployer.address,
  deployedAt: new Date().toISOString(),
  abi: abi,
};

// Write to both locations (frontend root for legacy, public/ for Vite)
const configFile = path.join(frontendDir, "config.json");
const publicConfigFile = path.join(publicDir, "config.json");
fs.writeFileSync(configFile, JSON.stringify(frontendConfig, null, 2));
fs.writeFileSync(publicConfigFile, JSON.stringify(frontendConfig, null, 2));
console.log(`Frontend config saved to: ${configFile}`);
console.log(`Vite public config saved to: ${publicConfigFile}`);

