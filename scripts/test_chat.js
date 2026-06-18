// Test chat with proper account
const { createZGComputeNetworkBroker } = require("@0glabs/0g-serving-broker");
const { ethers } = require("ethers");
require("dotenv").config();

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.OG_RPC);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  console.log("Wallet:", wallet.address);
  console.log("Balance:", ethers.formatEther(await provider.getBalance(wallet.address)));

  const broker = await createZGComputeNetworkBroker(wallet);
  const providerAddr = "0xa48f01287233509FD694a22Bf840225062E67836";

  // Get service metadata
  const { endpoint, model } = await broker.inference.getServiceMetadata(providerAddr);
  console.log(`Endpoint: ${endpoint}`);
  console.log(`Model: ${model}`);

  // Get request headers
  const headers = await broker.inference.getRequestHeaders(providerAddr);
  console.log("Headers obtained");

  // Test chat
  console.log("\n--- Testing chat ---");
  const response = await fetch(`${endpoint}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({
      messages: [
        { role: "system", content: "You are a wise wizard who answers in riddles." },
        { role: "user", content: "What is 2+2?" },
      ],
      model,
    }),
  });
  console.log("Status:", response.status);
  console.log("ZG-Res-Key:", response.headers.get("ZG-Res-Key")?.slice(0, 50) + "...");
  const data = await response.json();
  console.log("Response:", JSON.stringify(data, null, 2).slice(0, 2000));

  // Process response
  if (response.status === 200 && data.choices) {
    const chatID = response.headers.get("ZG-Res-Key") || data.id;
    try {
      await broker.inference.processResponse(providerAddr, chatID, JSON.stringify(data.usage));
      console.log("✅ processResponse OK");
    } catch (e) {
      console.log("processResponse err:", e.message?.slice(0, 200));
    }
  }
}

main().catch(e => { console.error("ERR:", e); process.exit(1); });
