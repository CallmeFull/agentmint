const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Balance:", hre.ethers.formatEther(balance), "0G");

  const AgentMint = await hre.ethers.getContractFactory("AgentMint");
  const contract = await AgentMint.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("✅ AgentMint deployed to:", address);
  console.log(`\nNEXT_PUBLIC_AGENTMINT_ADDRESS=${address}`);

  // Verify it's live
  const name = await contract.name();
  const symbol = await contract.symbol();
  console.log(`Name: ${name}, Symbol: ${symbol}`);

  // Write address to file
  require("fs").writeFileSync("deployed_address.txt", address);
}

main().catch((e) => { console.error(e); process.exit(1); });
