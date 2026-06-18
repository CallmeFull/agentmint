const { createZGComputeNetworkBroker } = require("@0glabs/0g-serving-broker");
const { ethers } = require("ethers");
require("dotenv").config();

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.OG_RPC);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  console.log("Wallet:", wallet.address);
  console.log("Balance:", ethers.formatEther(await provider.getBalance(wallet.address)));

  const broker = await createZGComputeNetworkBroker(wallet);
  console.log("Broker created");

  // List services
  const services = await broker.inference.listService();
  console.log(`Found ${services.length} services`);

  // Find chatbot services
  const chatbots = services.filter(s => s[1] === "chatbot");
  console.log(`Chatbots: ${chatbots.length}`);

  if (chatbots.length > 0) {
    for (const s of chatbots.slice(0, 3)) {
      console.log(`  - ${s[6]} (${s[0]}) TEE: ${s[10]}`);
    }
  } else {
    // Try all service types
    const types = {};
    for (const s of services) {
      types[s[1]] = (types[s[1]] || 0) + 1;
    }
    console.log("Service types:", types);
  }
}
main().catch(e => { console.error("ERR:", e.message || e); process.exit(1); });
