import { readFileSync, writeFileSync } from "fs";

const files = [
  "/tmp/agent_Captain_Jack_Sparrow.json",
  "/tmp/agent_Hattori_Heiji.json",
  "/tmp/agent_Dr._Luna_Stargazer.json",
  "/tmp/agent_Bard_the_Comedian.json",
];

const DEMO = "https://tiger-cleaning-clothes-satisfy.trycloudflare.com";

for (const f of files) {
  const personality = JSON.parse(readFileSync(f, "utf-8"));
  // Fill required fields for API
  personality.systemPrompt = `You are ${personality.name}. ${personality.description}. Your traits: ${personality.traits.join(", ")}. Always respond in character.`;
  personality.voice = "casual";
  personality.avatarPrompt = `portrait of ${personality.name}, ${personality.traits.join(", ")}`;
  personality.greeting = `Greetings, I am ${personality.name}. ${personality.description}`;
  personality.createdAt = new Date().toISOString();

  const res = await fetch(`${DEMO}/api/upload-personality`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ personality }),
  });
  const data = await res.json();
  if (!res.ok) {
    console.log(`❌ ${personality.name}: ${data.error}`);
    continue;
  }
  console.log(`✓ ${personality.name}: rootHash=${(data.rootHash || "").slice(0, 18)}… tx=${(data.txHash || "").slice(0, 18)}…`);
  // Save upload result for later use
  writeFileSync(f.replace(".json", "_upload.json"), JSON.stringify(data, null, 2));
  await new Promise(r => setTimeout(r, 1000));
}
