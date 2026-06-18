import { ethers } from "ethers";
import { readFileSync, writeFileSync } from "fs";
import { createHash } from "crypto";

const env = Object.fromEntries(
  readFileSync("/home/ubuntu/agentmint/.env", "utf-8")
    .split("\n")
    .filter(l => l && !l.startsWith("#") && l.includes("="))
    .map(l => {
      const [k, ...v] = l.split("=");
      return [k.trim(), v.join("=").trim().replace(/^['"]|['"]$/g, "")];
    })
);

const PK = env.PRIVATE_KEY;
const RPC = env.OG_RPC || env.NEXT_PUBLIC_OG_RPC;
const CONTRACT = env.NEXT_PUBLIC_AGENTMINT_ADDRESS || "0x8cF902DF7f4E353B02886538d30bF5F170a70B1f";

const ABI = JSON.parse(readFileSync("/home/ubuntu/agentmint/lib/abis/AgentMint.json", "utf-8")).abi;

const provider = new ethers.JsonRpcProvider(RPC, 16602);
const wallet = new ethers.Wallet(PK, provider);
const contract = new ethers.Contract(CONTRACT, ABI, wallet);

console.log(`Deployer: ${wallet.address}`);
console.log(`Balance: ${ethers.formatEther(await provider.getBalance(wallet.address))} 0G`);
console.log(`Contract: ${CONTRACT}`);

const agents = [
  { name: "Captain Jack Sparrow", description: "A witty 18th century pirate captain from the Caribbean", traits: ["cunning", "charming", "drunk", "lucky"], color: "#c2410c" },
  { name: "Hattori Heiji",        description: "A stoic samurai from feudal Japan with honor above all",     traits: ["disciplined", "honorable", "silent", "wise"], color: "#dc2626" },
  { name: "Dr. Luna Stargazer",   description: "An eccentric astrophysicist obsessed with black holes",       traits: ["curious", "eccentric", "intelligent", "playful"], color: "#7c3aed" },
  { name: "Bard the Comedian",    description: "A medieval jester who turns everything into a pun",           traits: ["witty", "chaotic", "warm", "loud"], color: "#facc15" },
];

function keccakRoot(p) {
  return ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(p, Object.keys(p).sort())));
}

const MINT_PRICE = ethers.parseEther("0.001");

for (const agent of agents) {
  const personality = {
    name: agent.name,
    description: agent.description,
    traits: agent.traits,
    color: agent.color,
    soul_hash: ethers.keccak256(ethers.toUtf8Bytes(agent.name)),
    created_at: Math.floor(Date.now() / 1000),
    version: "v2",
  };
  const rootHash = keccakRoot(personality);
  const tokenURI = `0g://${rootHash}`;

  console.log(`\n=== Minting: ${agent.name} ===`);
  console.log(`  rootHash: ${rootHash.slice(0, 18)}…`);

  try {
    const tx = await contract.mint(tokenURI, rootHash, { value: MINT_PRICE });
    console.log(`  tx: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`  status: ${receipt.status} (block ${receipt.blockNumber})`);

    // Get tokenId from logs
    const iface = contract.interface;
    for (const log of receipt.logs) {
      try {
        const parsed = iface.parseLog(log);
        if (parsed && parsed.name === "AgentMinted") {
          console.log(`  ✓ Token ID: ${parsed.args.tokenId}`);
        }
      } catch {}
    }

    writeFileSync(`/tmp/agent_${agent.name.replace(/ /g, "_")}.json`, JSON.stringify(personality, null, 2));
  } catch (e) {
    console.log(`  ❌ ${e.message.slice(0, 100)}`);
  }

  await new Promise(r => setTimeout(r, 1500));
}

const total = await contract.totalMinted();
console.log(`\n✓ Total minted: ${total}`);
