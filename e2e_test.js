const { ethers } = require('/home/ubuntu/agentmint/node_modules/ethers');
const { ZgFile, Indexer } = require('/home/ubuntu/agentmint/node_modules/@0gfoundation/0g-storage-ts-sdk');
const fs = require('fs');
require('/home/ubuntu/agentmint/node_modules/dotenv').config({ path: '/home/ubuntu/agentmint/.env' });

(async () => {
  console.log('Start...');
  const provider = new ethers.JsonRpcProvider(process.env.OG_RPC, 16602);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  const personality = {
    name: 'Lorekeeper Vance',
    description: 'A weary archivist',
    systemPrompt: 'test',
    traits: ['a','b','c'],
    voice: 'soft',
    avatarPrompt: 'librarian',
    greeting: 'hi',
    createdAt: new Date().toISOString(),
  };

  const tmpPath = '/tmp/vance2.json';
  fs.writeFileSync(tmpPath, JSON.stringify(personality, null, 2));

  const indexer = new Indexer(process.env.OG_STORAGE_INDEXER);
  const file = await ZgFile.fromFilePath(tmpPath);
  const [tree] = await file.merkleTree();
  const rootHash = tree.rootHash();
  console.log('Root:', rootHash);

  const [result] = await indexer.upload(file, process.env.OG_RPC, wallet);
  console.log('Uploaded:', result.txHash);
  await file.close();

  const abiJson = fs.readFileSync('/home/ubuntu/agentmint/lib/abis.ts', 'utf-8');
  const abi = JSON.parse(abiJson.match(/AGENTMINT_ABI = (\[[\s\S]*?\]) as const/)[1]);
  const c = new ethers.Contract(process.env.NEXT_PUBLIC_AGENTMINT_ADDRESS, abi, wallet);
  console.log('Contract:', process.env.NEXT_PUBLIC_AGENTMINT_ADDRESS);

  const tx = await c.mint('0g://' + rootHash, rootHash, { value: ethers.parseEther('0.001') });
  const receipt = await tx.wait();
  console.log('Minted:', receipt.hash, 'block:', receipt.blockNumber);

  const data = await c.getAgentData(1);
  console.log('Agent #1:');
  console.log('  Level:', data[5].toString());
  console.log('  Milestone:', data[6]);
  console.log('  Rarity:', data[9].toString());

  for (let i = 0; i < 7; i++) {
    await (await c.recordSummon(1)).wait();
  }
  const d2 = await c.getAgentData(1);
  console.log('After 7 summons:');
  console.log('  Level:', d2[5].toString());
  console.log('  Milestone:', d2[6]);
  console.log('  Rarity:', d2[9].toString());

  await (await c.vote(1, true)).wait();
  await (await c.vote(1, true)).wait();
  const d3 = await c.getAgentData(1);
  console.log('Score:', d3[8].toString());

  fs.unlinkSync(tmpPath);
  console.log('E2E PASSED');
})().catch(e => { console.error('ERR:', e.message); process.exit(1); });
