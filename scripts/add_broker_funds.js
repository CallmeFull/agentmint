const { ethers } = require('ethers');
const { createZGComputeNetworkBroker } = require('@0glabs/0g-serving-broker');
require('dotenv').config();

(async () => {
  const provider = new ethers.JsonRpcProvider(process.env.OG_RPC, 16602);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  
  const broker = await createZGComputeNetworkBroker(wallet);
  const account = await broker.ledger.getAccount();
  console.log('Sub-account before:', ethers.formatEther(account.totalBalance), '0G');
  
  // Add funds
  const tx = await broker.ledger.addLedger(ethers.parseEther('1.0'));
  console.log('Tx:', tx.hash);
  const receipt = await tx.wait();
  console.log('Confirmed in block:', receipt.blockNumber);
  
  const account2 = await broker.ledger.getAccount();
  console.log('Sub-account after:', ethers.formatEther(account2.totalBalance), '0G');
})().catch(e => { console.error('ERR:', e.message); process.exit(1); });
