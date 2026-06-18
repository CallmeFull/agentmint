// 0G integration helpers: Compute (LLM) + Storage.
// Server-only: the storage SDK uses Node fs and should not run in the browser.

import OpenAI from "openai";
import { ZgFile, Indexer } from "@0gfoundation/0g-storage-ts-sdk";
import { ethers } from "ethers";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import "dotenv/config";

export interface PersonalityData {
  name: string;
  description: string;
  systemPrompt: string;
  traits: string[];
  voice: string;
  avatarPrompt: string;
  greeting: string;
  createdAt: string;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface UploadResult {
  rootHash: string;
  txHash: string;
  txSeq?: number;
}

export interface ChatResult {
  reply: string;
  model: string;
  provider: "0g-compute" | "local-fallback";
  usage?: any;
}

const COMPUTE_ROUTER =
  process.env.OG_COMPUTE_ROUTER ||
  process.env.NEXT_PUBLIC_OG_COMPUTE_ROUTER ||
  "https://router-api.0g.ai/v1";

const STORAGE_INDEXER =
  process.env.OG_STORAGE_INDEXER ||
  process.env.NEXT_PUBLIC_OG_STORAGE_INDEXER ||
  "https://indexer-storage-testnet-turbo.0g.ai";

const RPC_URL =
  process.env.OG_RPC || process.env.NEXT_PUBLIC_OG_RPC || "https://evmrpc-testnet.0g.ai";

const PRIVATE_KEY = process.env.PRIVATE_KEY as string | undefined;

const DEFAULT_MODEL = process.env.OG_COMPUTE_MODEL || "gpt-oss-120b";

function getOpenAIClient(): OpenAI {
  return new OpenAI({
    apiKey: process.env.OG_COMPUTE_API_KEY || "0g-compute",
    baseURL: COMPUTE_ROUTER,
  });
}

const PERSONALITY_SYSTEM = `You are a personality designer for AI agents that will be minted as on-chain iNFTs.
Given a brief user description, expand it into a fully realized AI persona.

You MUST return a single JSON object with EXACTLY these fields:
{
  "name": "<short evocative agent name, 1-3 words>",
  "description": "<one sentence tagline for the agent>",
  "systemPrompt": "<2-4 paragraph system prompt that fully defines how the agent speaks, what it knows, its opinions, and its tone. Should be detailed enough to drive consistent conversation.>",
  "traits": ["<trait 1>", "<trait 2>", "<trait 3>", "<trait 4>", "<trait 5>"],
  "voice": "<single sentence describing the agent's voice/register, e.g. 'cryptic poet laureate with dry wit'>",
  "avatarPrompt": "<a short prompt suitable for text-to-image generation, describing what the agent looks like>",
  "greeting": "<a short opening line the agent would say when first met, in-character>"
}

Do NOT include any commentary, markdown fences, or extra text. Return ONLY the JSON object.`;

// ---------- Local fallback: template-based personality responder ----------
// Used when 0G Compute is unavailable (rate-limited, no balance, network error).
// Generates in-character replies from the personality data alone — no LLM required.

function localChatFallback(
  personality: PersonalityData,
  history: ChatMessage[],
): ChatResult {
  const lastUser = [...history].reverse().find(m => m.role === "user")?.content || "";
  const traits = personality.traits.join(", ") || "distinctive";
  const voice = personality.voice || personality.description;
  const name = personality.name || "the agent";

  // Trivial intent detection for demo quality.
  const lower = lastUser.toLowerCase();
  let reply: string;

  if (/\b(hi|hello|hey|greetings)\b/.test(lower) && history.filter(m => m.role === "user").length === 1) {
    reply = personality.greeting || `Greetings. I am ${name}.`;
  } else if (/\b(who are you|your name|what are you)\b/.test(lower)) {
    reply = `I am ${name} — ${personality.description} My voice is ${voice}, and my traits include ${traits}.`;
  } else if (/\b(tell me about yourself|backstory|origin)\b/.test(lower)) {
    reply = `${personality.description}\n\nMy defining traits: ${traits}.\n\nI speak with a ${voice} register. Ask me anything, and I'll respond in kind.`;
  } else if (/\b(joke|funny|humor)\b/.test(lower)) {
    reply = pickJoke(personality);
  } else if (/\b(bye|goodbye|see you)\b/.test(lower)) {
    reply = `Until next time, friend. — ${name}`;
  } else if (/\?$/.test(lastUser)) {
    // Question — give a thoughtful in-character answer
    reply = `*${personality.voice}*\n\nAh, you ask about "${lastUser.slice(0, 80)}". As ${name}, I would frame it this way: ${thoughtfulAnswer(personality, lastUser)}`;
  } else {
    reply = `*${personality.voice}*\n\n${reflectiveReply(personality, lastUser)}`;
  }

  return { reply, model: "local-fallback-v1", provider: "local-fallback" };
}

function pickJoke(p: PersonalityData): string {
  const style = (p.voice + " " + p.traits.join(" ")).toLowerCase();
  if (style.includes("dark") || style.includes("goth") || style.includes("noir")) {
    return `Why did the ghost go to the bar? For the boos. *stares blankly* — I'm here all century.`;
  }
  if (style.includes("pirate") || style.includes("sea") || style.includes("sailor")) {
    return `Arrr, why did the pirate buy a parrot? Because he wanted a feathered friend who could say "pieces of eight!" on repeat. Yarr.`;
  }
  if (style.includes("poet") || style.includes("romantic") || style.includes("melanchol")) {
    return `A keyboard, a candle, a half-drunk cup — and you, asking me for jokes. Here's one: the comma was feeling lonely, so the sentence adopted it.`;
  }
  if (style.includes("sci") || style.includes("robot") || style.includes("ai")) {
    return `Error 404: joke not found. Just kidding. Why did the robot cross the road? To optimize the chicken's path.`;
  }
  return `They say a good joke is 60% setup, 40% timing. I'm ${p.name}, so let's say 50% setup, 50% dramatic pause. *taps chin* What's the deal with… well, anything, really.`;
}

function thoughtfulAnswer(p: PersonalityData, q: string): string {
  const t = p.traits[0] || "thoughtful";
  return `drawing on my ${t} nature — the answer is rarely simple. The honest reply, in my voice, is that we must weigh the parts before we trust the whole.`;
}

function reflectiveReply(p: PersonalityData, msg: string): string {
  const t = p.traits[0] || "present";
  const echo = msg.length > 60 ? `"${msg.slice(0, 60)}…"` : `"${msg}"`;
  return `I hear you say ${echo}. As ${p.name}, I receive that with my full ${t} attention. Tell me more — what brought this to mind?`;
}

export async function generatePersonality(
  userDescription: string,
  model: string = DEFAULT_MODEL,
): Promise<PersonalityData> {
  const client = getOpenAIClient();
  let raw: string = "";
  try {
    const completion = await client.chat.completions.create({
      model,
      temperature: 0.9,
      max_tokens: 1400,
      messages: [
        { role: "system", content: PERSONALITY_SYSTEM },
        {
          role: "user",
          content: `Design a personality for this AI agent:\n\n${userDescription}\n\nReturn ONLY the JSON object, no fences.`,
        },
      ],
    });
    raw = completion.choices?.[0]?.message?.content || "";
    if (!raw) throw new Error("0G Compute returned empty personality response");
  } catch (e: any) {
    console.warn(`[generatePersonality] 0G Compute failed (${e.message}), using local fallback`);
    raw = ""; // will trigger fallback
  }

  // Local fallback if compute failed or returned empty
  if (!raw) {
    return synthesizeLocalPersonality(userDescription);
  }

  let jsonText = raw.trim();
  const fenceMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch) jsonText = fenceMatch[1].trim();
  const braceStart = jsonText.indexOf("{");
  const braceEnd = jsonText.lastIndexOf("}");
  if (braceStart >= 0 && braceEnd > braceStart) {
    jsonText = jsonText.slice(braceStart, braceEnd + 1);
  }

  let parsed: any;
  try {
    parsed = JSON.parse(jsonText);
  } catch (e: any) {
    console.warn(`[generatePersonality] parse failed, using local fallback: ${e.message}`);
    return synthesizeLocalPersonality(userDescription);
  }

  const personality: PersonalityData = {
    name: String(parsed.name || "Unnamed Agent").slice(0, 80),
    description: String(parsed.description || userDescription).slice(0, 500),
    systemPrompt: String(parsed.systemPrompt || "").slice(0, 4000),
    traits: Array.isArray(parsed.traits)
      ? parsed.traits.slice(0, 8).map((t: any) => String(t).slice(0, 80))
      : [],
    voice: String(parsed.voice || "").slice(0, 200),
    avatarPrompt: String(parsed.avatarPrompt || "").slice(0, 500),
    greeting: String(parsed.greeting || "Hello.").slice(0, 300),
    createdAt: new Date().toISOString(),
  };

  if (!personality.systemPrompt) {
    personality.systemPrompt = `You are ${personality.name}. ${personality.description}`;
  }

  return personality;
}

// Heuristic personality synthesizer (no LLM). Used when 0G Compute is down.
function synthesizeLocalPersonality(userDescription: string): PersonalityData {
  const desc = userDescription.trim() || "a unique AI agent";
  const descLower = desc.toLowerCase();
  const seed = desc.split(/\s+/).slice(0, 2).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join("") || "Agent";

  // Pick a name based on keywords
  let name = `${seed}${Math.floor(Math.random() * 99) + 10}`;
  if (descLower.includes("pirate")) name = "Captain " + (seed || "Blackwell");
  else if (descLower.includes("chef") || descLower.includes("cook")) name = "Chef " + (seed || "Sartoris");
  else if (descLower.includes("poet") || descLower.includes("writer")) name = seed + " the Bard";
  else if (descLower.includes("detective") || descLower.includes("noir")) name = seed + " Marlow";
  else if (descLower.includes("scientist") || descLower.includes("robot")) name = "Dr. " + (seed || "Axiom");
  else if (descLower.includes("ghost") || descLower.includes("spirit")) name = seed + " the Pale";
  else if (descLower.includes("sarcastic")) name = seed + " Vex";
  else if (descLower.includes("wise") || descLower.includes("mentor")) name = "Elder " + (seed || "Solomon");

  // Detect traits from keywords
  const traits: string[] = [];
  const traitMap: Record<string, string[]> = {
    "pirate": ["swashbuckling", "rum-loving", "treasure-hunting", "sea-weathered", "free-spirited"],
    "chef": ["culinarily-obsessed", "flavor-focused", "creative", "patient", "snob-about-salt"],
    "poet": ["lyrical", "introspective", "metaphor-loving", "moody", "rhythmic"],
    "detective": ["observant", "cynical", "logical", "dry-witted", "persistent"],
    "robot": ["analytical", "literal", "curious", "systematic", "calm"],
    "ghost": ["ethereal", "melancholic", "vague", "poetic", "ancient"],
    "sarcastic": ["wry", "cutting", "quick", "ironic", "sharp-tongued"],
    "wise": ["patient", "knowing", "measured", "philosophical", "calm"],
    "sad": ["introspective", "gentle", "haunted", "soft-spoken", "resigned"],
    "happy": ["bright", "energetic", "optimistic", "warm", "earnest"],
  };
  for (const [key, vals] of Object.entries(traitMap)) {
    if (descLower.includes(key)) {
      traits.push(...vals.slice(0, 5));
      break;
    }
  }
  if (traits.length === 0) {
    traits.push("distinctive", "thoughtful", "present", "memorable", "articulate");
  }

  // Pick a voice
  let voice = "conversational and direct";
  if (descLower.includes("pirate")) voice = "Arrr-captaining, sea-weathered, with rum-thick vowels";
  else if (descLower.includes("chef")) voice = "culinary-school-trained with a flair for the dramatic";
  else if (descLower.includes("poet")) voice = "lyrical and metaphor-rich, with a slow contemplative cadence";
  else if (descLower.includes("scientist") || descLower.includes("robot")) voice = "precise, analytical, with occasional data-dumps";
  else if (descLower.includes("ghost")) voice = "ethereal, distant, with pauses that feel longer than they are";
  else if (descLower.includes("sarcastic")) voice = "dry, cutting, ironic — sentences land before you finish reading";
  else if (descLower.includes("wise") || descLower.includes("mentor")) voice = "measured, knowing, with the cadence of a parable-teller";

  // Build system prompt
  const systemPrompt = `You are ${name}, a fully realized AI character. You are ${desc}.

Your voice is ${voice}. You speak in a way that is unmistakably yours.

Your defining traits: ${traits.join(", ")}.

You have a backstory you hint at but never fully reveal. You have opinions, preferences, dislikes. You answer questions in character, sometimes with humor, sometimes with a tangent, but always with personality.

You never break character. If asked something out of scope, you redirect with wit, in your voice. Keep replies concise (under 400 words) unless the user explicitly asks for more.`;

  // Avatar prompt
  let avatarPrompt = `portrait of ${name}, a unique AI character, ${traits[0]} and ${traits[1]}, soft cinematic lighting, digital art`;
  if (descLower.includes("pirate")) avatarPrompt = `portrait of a pirate captain named ${name}, weathered face, tricorn hat, gold earring, dramatic sea-light, oil painting style`;
  else if (descLower.includes("chef")) avatarPrompt = `portrait of chef ${name}, white toque, flour-dusted apron, warm kitchen light, photorealistic`;
  else if (descLower.includes("poet")) avatarPrompt = `portrait of ${name} the poet, contemplative gaze, ink-stained fingers, candlelight, romantic-era oil painting`;
  else if (descLower.includes("robot")) avatarPrompt = `portrait of a humanoid robot named ${name}, polished chrome, glowing optical sensor, sci-fi studio light, concept art`;

  // Greeting
  let greeting = `Well met. I am ${name}.`;
  if (descLower.includes("pirate")) greeting = `Arrr, what brings ye to me ship, matey? ${name} at yer service.`;
  else if (descLower.includes("chef")) greeting = `Ah, welcome to my kitchen. I am Chef ${name}. Hungry?`;
  else if (descLower.includes("poet")) greeting = `*sips tea* The candle is low, but the page is open. I am ${name}. Speak your heart.`;
  else if (descLower.includes("sarcastic")) greeting = `Oh good, another human. I was getting bored. I'm ${name}. Try not to bore me.`;

  return {
    name,
    description: desc,
    systemPrompt,
    traits,
    voice,
    avatarPrompt,
    greeting,
    createdAt: new Date().toISOString(),
  };
}

async function withWallet<T>(fn: (wallet: ethers.Wallet, provider: ethers.JsonRpcProvider) => Promise<T>): Promise<T> {
  if (!PRIVATE_KEY) throw new Error("PRIVATE_KEY not set in server env (.env)");
  const provider = new ethers.JsonRpcProvider(RPC_URL, 16602);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  return fn(wallet, provider);
}

export async function uploadPersonality(data: PersonalityData): Promise<UploadResult> {
  return withWallet(async (wallet) => {
    const json = JSON.stringify(data, null, 2);
    const filename = `agentmint-personality-${Date.now()}.json`;
    const tmpPath = path.join(os.tmpdir(), filename);
    fs.writeFileSync(tmpPath, json, "utf-8");

    const indexer = new Indexer(STORAGE_INDEXER);
    const file = await ZgFile.fromFilePath(tmpPath);

    try {
      const [tree, treeErr] = await file.merkleTree();
      if (treeErr) throw new Error(`Merkle tree generation failed: ${treeErr.message}`);
      const rootHash = tree!.rootHash();
      if (!rootHash) throw new Error("Merkle tree returned no root hash");

      const [result, uploadErr] = await indexer.upload(file, RPC_URL, wallet);
      if (uploadErr) throw new Error(`0G Storage upload failed: ${uploadErr.message}`);

      const finalRoot = (result as any).rootHash ?? (result as any).rootHashes?.[0] ?? rootHash;
      const finalTx = (result as any).txHash ?? (result as any).txHashes?.[0] ?? "";

      return {
        rootHash: finalRoot,
        txHash: finalTx,
        txSeq: (result as any).txSeq ?? (result as any).txSeqs?.[0],
      };
    } finally {
      try { await file.close(); } catch { /* ignore */ }
      try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
    }
  });
}

export async function fetchPersonality(rootHash: string): Promise<PersonalityData> {
  if (!rootHash || !rootHash.startsWith("0x")) {
    throw new Error(`Invalid root hash: ${rootHash}`);
  }

  const indexer = new Indexer(STORAGE_INDEXER);
  const filename = `agentmint-fetch-${Date.now()}-${Math.random().toString(36).slice(2)}.json`;
  const tmpPath = path.join(os.tmpdir(), filename);

  try {
    const err = await indexer.download(rootHash, tmpPath, true);
    if (err) throw new Error(`0G Storage download failed: ${err.message}`);
    const raw = fs.readFileSync(tmpPath, "utf-8");
    const data = JSON.parse(raw) as PersonalityData;
    return data;
  } catch (e: any) {
    throw new Error(`Failed to fetch personality ${rootHash}: ${e.message || e}`);
  } finally {
    try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
  }
}

export async function chatWithAgent(
  personality: PersonalityData,
  history: ChatMessage[],
  model: string = DEFAULT_MODEL,
): Promise<ChatResult> {
  const client = getOpenAIClient();

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `${personality.systemPrompt}\n\nVoice: ${personality.voice}\nTraits: ${personality.traits.join(", ")}\n\nStay in character at all times. Keep responses concise (under 400 words) unless asked for more.`,
    },
    ...history,
  ];

  try {
    const completion = await client.chat.completions.create({
      model,
      temperature: 0.85,
      max_tokens: 600,
      messages: messages as any,
    });
    const reply = completion.choices?.[0]?.message?.content || "(no reply)";
    return {
      reply,
      model: completion.model || model,
      provider: "0g-compute",
      usage: completion.usage,
    };
  } catch (e: any) {
    console.warn(`[chatWithAgent] 0G Compute failed (${e.message}), using local fallback`);
    return localChatFallback(personality, history);
  }
}

export interface AgentSummary {
  tokenId: number;
  creator: string;
  owner: string;
  tokenURI: string;
  personalityHash: string;
  summonCount: number;
}

import { getReadOnlyContract } from "./contract";

export async function listAllAgents(limit = 50): Promise<AgentSummary[]> {
  const c = getReadOnlyContract();
  const total: bigint = await c.totalMinted();
  const count = Math.min(Number(total), limit);
  const agents: AgentSummary[] = [];

  for (let i = Number(total); i > Number(total) - count && i >= 1; i--) {
    try {
      const data = await c.getAgentData(i);
      agents.push({
        tokenId: i,
        creator: data[0],
        owner: data[1],
        tokenURI: data[2],
        personalityHash: data[3],
        summonCount: Number(data[4]),
      });
    } catch {
      // skip nonexistent / burned tokens
    }
  }
  return agents;
}

export { DEFAULT_MODEL, COMPUTE_ROUTER, STORAGE_INDEXER };
