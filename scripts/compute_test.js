// Working 0G Compute chat pattern.
const { ethers } = require('ethers');
const { createZGComputeNetworkBroker } = require('@0glabs/0g-serving-broker');
require('dotenv').config();

(async () => {
  const provider = new ethers.JsonRpcProvider(process.env.OG_RPC, 16602);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const broker = await createZGComputeNetworkBroker(wallet);
  const PROVIDER = '0xa48f01287233509FD694a22Bf840225062E67836';

  const meta = await broker.inference.getServiceMetadata(PROVIDER, 'chatbot');
  console.log('Endpoint:', meta.endpoint, '| Model:', meta.model);

  // Get auth header
  const authHeader = await broker.inference.requestProcessor.getHeader(PROVIDER);
  console.log('Got auth header');

  // System prompt for the test agent
  const systemPrompt = 'You are a witty pirate captain. Reply briefly.';
  const userMsg = 'Who are you?';
  const body = {
    model: meta.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMsg },
    ],
    max_tokens: 100,
  };

  console.log('\nSending chat...');
  const res = await fetch(`${meta.endpoint}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  console.log('HTTP:', res.status);

  if (res.ok && data.choices?.[0]) {
    const reply = data.choices[0].message.content;
    console.log('\n💬 Reply:', reply);
    console.log('Usage:', data.usage);

    // Settle payment
    const chatID = res.headers.get('ZG-Res-Key') || data.id;
    console.log('Chat ID:', chatID);

    try {
      const settlement = await broker.inference.responseProcessor.processResponse(
        PROVIDER, chatID, body
      );
      console.log('Settlement result:', settlement);
    } catch (e) {
      console.log('Settle non-fatal:', e.message?.slice(0, 200));
    }
  } else {
    console.log('Body:', JSON.stringify(data, null, 2).slice(0, 500));
  }
})().catch(e => { console.error('ERR:', e.message); process.exit(1); });
