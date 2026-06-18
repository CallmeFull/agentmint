// Upload logo + thumbnail to 0G Storage
const { ZgFile, Indexer } = require("@0gfoundation/0g-storage-ts-sdk");
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

async function upload(filePath) {
  const provider = new ethers.JsonRpcProvider(process.env.OG_RPC);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const indexer = new Indexer(process.env.OG_STORAGE_INDEXER);

  const file = await ZgFile.fromFilePath(filePath);
  try {
    // Compute root hash locally first
    const [tree, err] = await file.merkleTree();
    if (err) throw new Error("merkle: " + err);
    const rootHash = tree.rootHash();
    console.log(`${path.basename(filePath)}: pre-computed root=${rootHash}`);

    // Upload (use OG_RPC as blockchain_rpc)
    const [tx, upErr] = await indexer.upload(file, process.env.OG_RPC, wallet);
    if (upErr) throw new Error("upload: " + upErr);
    console.log(`${path.basename(filePath)}: tx=${tx.txHash} root=${rootHash}`);
    return rootHash;
  } finally {
    await file.close();
  }
}

(async () => {
  const logo = await upload("/home/ubuntu/agentmint/public/logo.png");
  const thumb = await upload("/home/ubuntu/agentmint/public/thumbnail.png");

  const urls = {
    logo: `https://storagescan-galileo.0g.ai/file/${logo}`,
    thumbnail: `https://storagescan-galileo.0g.ai/file/${thumb}`,
  };
  fs.writeFileSync("/home/ubuntu/agentmint/.asset_urls.json", JSON.stringify({...urls, rootHashes: {logo, thumb}}, null, 2));
  console.log("\nURLs:");
  console.log(JSON.stringify(urls, null, 2));
})().catch(e => { console.error("ERR:", e.message || e); process.exit(1); });
