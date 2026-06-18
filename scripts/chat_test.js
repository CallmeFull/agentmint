const { ethers } = require('ethers');
const { createZGComputeNetworkBroker } = require('@0glabs/0g-serving-broker');
const fs = require('fs');
require('dotenv').config();

(async () => {
  const provider = new ethers.JsonRpcProvider(process.env.OG_RPC, 16602);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const broker = await createZGComputeNetworkBroker(wallet);
  
  // Acknowledge provider (if needed)
  try {
    await broker.inference.acknowledgeProviderSigner(process.env.OG_INFERENCE_PROVIDER || '0xa79F4c8311FF93C06b8CfB403690cc987c93F91E');
    console.log('Provider acknowledged');
  } catch (e) {
    console.log('Provider ack skipped:', e.message);
  }
  
  // List available services
  const services = await broker.inference.listService();
  console.log('Available services:', services.length);
  for (const s of services.slice(0, 3)) {
    console.log(' -', s.serviceType || s.model || JSON.stringify(s).slice(0, 100));
  }
  
  // Get a service for chat
  const svc = services[0];
  if (!svc) {
    console.log('No services available');
    return;
  }
  console.log('\nUsing service:', svc.serviceType || svc.model);
  console.log('Provider:', svc.provider);
  
  // Generate auth header
  const { endpoint, model, headers } = await broker.inference.getRequestHeaders(svc.serviceType || 'inference', svc.provider);
  console.log('Endpoint:', endpoint);
  console.log('Model:', model);
  
  // Send a chat request
  console.log('\nSending chat request...');
  const res = await fetch(`${endpoint}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: 'In one sentence, who are you?' }],
      max_tokens: 100,
    }),
  });
  const data = await res.json();
  console.log('Response:', JSON.stringify(data, null, 2).slice(0, 500));
  
  // Process the response (settle the payment)
  if (data.choices?.[0]) {
    console.log('\nReply:', data.choices[0].message.content);
  }
})().catch(e => { console.error('ERR:', e.message); process.exit(1); });
