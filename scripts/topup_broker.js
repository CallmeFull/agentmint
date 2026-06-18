const { ethers } = require('ethers');
const { createZGComputeNetworkBroker } = require('@0glabs/0g-serving-broker');
require('dotenv').config();

(async () => {
  const provider = new ethers.JsonRpcProvider(process.env.OG_RPC, 16602);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  
  const broker = await createZGComputeNetworkBroker(wallet);
  
  const ledger = await broker.ledger.getLedger();
  console.log('Sub-account before:');
  console.log('  total:', ethers.formatEther(ledger.totalBalance), '0G');
  console.log('  available:', ethers.formatEther(ledger.availableBalance), '0G');
  
  // Add 0.5 0G
  const amount = ethers.parseEther('0.5');
  console.log(`Adding ${ethers.formatEther(amount)} 0G to sub-account...`);
  const tx = await broker.ledger.depositFund(amount);
  console.log('Tx:', tx.hash);
  const receipt = await tx.wait();
  console.log('Confirmed in block:', receipt.blockNumber);
  
  const ledger2 = await broker.ledger.getLedger();
  console.log('Sub-account after:');
  console.log('  total:', ethers.formatEther(ledger2.totalBalance), '0G');
  console.log('  available:', ethers.formatEther(ledger2.availableBalance), '0G');
})().catch(e => { console.error('ERR:', e.message || e); process.exit(1); });
