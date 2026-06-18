// Test 0G Compute chat with getHeader (skip topUp).
const { ethers } = require('ethers');
const { createZGComputeNetworkBroker } = require('@0glabs/0g-serving-broker');
require('dotenv').config();

(async () => {
  const provider = new ethers.JsonRpcProvider(process.env.OG_RPC, 16602);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const broker = await createZGComputeNetworkBroker(wallet);

  const PROVIDER = '0xa48f01287233509FD694a22Bf840225062E67836';

  // Get service metadata
  const meta = await broker.inference.getServiceMetadata(PROVIDER, 'chatbot');
  console.log('Endpoint:', meta.endpoint);
  console.log('Model:', meta.model);

  // Get auth header directly (skip topUp that needs ENS)
  console.log('\n--- Creating auth header (getHeader) ---');
  try {
    const headers = await broker.inference.requestProcessor.getHeader(PROVIDER);
    console.log('Got headers. Sending chat...');

    const body = {
      model: meta.model,
      messages: [
        { role: 'system', content: 'You are a witty pirate captain. Reply briefly.' },
        { role: 'user', content: 'Who are you?' },
      ],
      max_tokens: 80,
    };

    const res = await fetch(`${meta.endpoint}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
    console.log('HTTP status:', res.status);
    const data = await res.json();
    console.log('Body:', JSON.stringify(data, null, 2).slice(0, 600));

    if (res.ok && data.choices?.[0]) {
      const reply = data.choices[0].message.content;
      console.log('\n💬 Reply:', reply);

      // Process response to settle payment
      console.log('\n--- Settle payment ---');
      const chatID = res.headers.get('ZG-Res-Key') || data.id;
      try {
        const isVerifiable = await broker.inference.verifier.isVerifiable(PROVIDER, 'chatbot');
        if (isVerifiable) {
          await broker.inference.processResponse(PROVIDER, chatID, body);
        } else {
          await broker.inference.processResponse(PROVIDER, chatID, body);
        }
        console.log('✅ Settled');
      } catch (e) {
        console.log('Settle err (may not be fatal):', e.message);
      }
    } else {
      console.log('\n❌ Request failed');
    }
  } catch (e) {
    console.log('ERR:', e.message);
  }
})().catch(console.error);
