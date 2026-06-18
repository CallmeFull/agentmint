const { ZgFile, Indexer } = require("@0gfoundation/0g-storage-ts-sdk");
const { ethers } = require("ethers");
require("dotenv").config();

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.OG_RPC);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const indexer = new Indexer(process.env.OG_STORAGE_INDEXER);
  console.log("Wallet:", wallet.address);
  console.log("Balance:", ethers.formatEther(await provider.getBalance(wallet.address)));
  console.log("Indexer:", process.env.OG_STORAGE_INDEXER);
  
  // Write a test personality JSON
  const fs = require("fs");
  const data = {
    name: "Test Agent",
    description: "a melancholic poet-bot",
    systemPrompt: "You are a melancholic poet...",
    traits: ["poetic", "haiku", "moody"],
    voice: "soft, contemplative",
    avatarPrompt: "a glowing ghost with quill",
    greeting: "the stars are dim tonight...",
    createdAt: new Date().toISOString(),
  };
  const path = "/tmp/test_personality.json";
  fs.writeFileSync(path, JSON.stringify(data, null, 2));
  console.log("Test file written:", path);
  
  // Upload
  const file = await ZgFile.fromFilePath(path);
  try {
    const [tree, err] = await file.merkleTree();
    if (err) throw new Error("merkle: " + err);
    const rootHash = tree.rootHash();
    console.log("Root hash:", rootHash);
    
    const [tx, upErr] = await indexer.upload(file, process.env.OG_RPC, wallet);
    if (upErr) throw new Error("upload: " + upErr);
    console.log("✅ Upload tx:", tx);
    console.log("Root hash saved:", rootHash);
  } finally {
    await file.close();
  }
}
main().catch(e => { console.error("ERR:", e); process.exit(1); });
