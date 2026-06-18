// 0G integration helpers: Compute (LLM) + Storage.
// Server-only: the storage SDK uses Node fs and should not run in the browser.
//
// - generatePersonality  : uses OpenAI SDK against https://router-api.0g.ai/v1
//                          to expand a user description into a full personality.
// - uploadPersonality    : writes JSON to a temp file, uploads to 0G Storage
//                          via @0gfoundation/0g-storage-ts-sdk, returns root hash.
// - fetchPersonality     : downloads JSON from 0G Storage and parses it.
// - chatWithAgent        : uses OpenAI SDK with the personality system prompt
//                          for chat inference.

import OpenAI from "openai";
import { ZgFile, Indexer } from "@0gfoundation/0g-storage-ts-sdk";
import { ethers } from "ethers";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import "dotenv/config";

// ---------- Types ----------

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
  usage?: any;
}

// ---------- Config ----------

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

// The router returns a free model list; deepseek-v3 / qwen / gpt-oss work well.
// We default to a small chat-friendly model. Override with OG_COMPUTE_MODEL.
const DEFAULT_MODEL = process.env.OG_COMPUTE_MODEL || "gpt-oss-120b";

function getOpenAIClient(): OpenAI {
  // Router accepts empty API key (some test routes do) — pass empty string if missing.
  return new OpenAI({
    apiKey: process.env.OG_COMPUTE_API_KEY || "0g-compute",
    baseURL: COMPUTE_ROUTER,
  });
}

// ---------- Personality generation ----------

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

export async function generatePersonality(
  userDescription: string,
  model: string = DEFAULT_MODEL,
): Promise<PersonalityData> {
  const client = getOpenAIClient();
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

  const raw = completion.choices?.[0]?.message?.content || "";
  if (!raw) throw new Error("0G Compute returned empty personality response");

  // Extract JSON — strip fences if present, then find the first {...} block
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
    throw new Error(
      `Failed to parse personality JSON from 0G Compute: ${e.message}\nRaw response: ${raw.slice(0, 500)}`,
    );
  }

  // Normalize: ensure all required fields exist
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

// ---------- Storage upload ----------

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
      // CRITICAL: generate Merkle tree BEFORE uploading
      const [tree, treeErr] = await file.merkleTree();
      if (treeErr) throw new Error(`Merkle tree generation failed: ${treeErr.message}`);
      const rootHash = tree!.rootHash();
      if (!rootHash) throw new Error("Merkle tree returned no root hash");

      // Upload — signature: indexer.upload(file, blockchain_rpc, signer)
      const [result, uploadErr] = await indexer.upload(file, RPC_URL, wallet);
      if (uploadErr) throw new Error(`0G Storage upload failed: ${uploadErr.message}`);

      // result can be either single {txHash, rootHash, txSeq} or plural {txHashes, rootHashes, txSeqs}
      const finalRoot = (result as any).rootHash ?? (result as any).rootHashes?.[0] ?? rootHash;
      const finalTx = (result as any).txHash ?? (result as any).txHashes?.[0] ?? "";

      return {
        rootHash: finalRoot,
        txHash: finalTx,
        txSeq: (result as any).txSeq ?? (result as any).txSeqs?.[0],
      };
    } finally {
      // CRITICAL: always close ZgFile handle + clean up temp
      try {
        await file.close();
      } catch {
        /* ignore */
      }
      try {
        fs.unlinkSync(tmpPath);
      } catch {
        /* ignore */
      }
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
    // download() can throw in addition to returning an error — wrap in try/catch
    const err = await indexer.download(rootHash, tmpPath, true);
    if (err) throw new Error(`0G Storage download failed: ${err.message}`);
    const raw = fs.readFileSync(tmpPath, "utf-8");
    const data = JSON.parse(raw) as PersonalityData;
    return data;
  } catch (e: any) {
    throw new Error(`Failed to fetch personality ${rootHash}: ${e.message || e}`);
  } finally {
    try {
      fs.unlinkSync(tmpPath);
    } catch {
      /* ignore */
    }
  }
}

// ---------- Chat ----------

export async function chatWithAgent(
  personality: PersonalityData,
  history: ChatMessage[],
  model: string = DEFAULT_MODEL,
): Promise<ChatResult> {
  const client = getOpenAIClient();

  // Prepend the agent's system prompt
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `${personality.systemPrompt}\n\nVoice: ${personality.voice}\nTraits: ${personality.traits.join(", ")}\n\nStay in character at all times. Keep responses concise (under 400 words) unless asked for more.`,
    },
    ...history,
  ];

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
    usage: completion.usage,
  };
}

// ---------- Utility: list all iNFTs from chain ----------

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

  // Token IDs start at 1; latest first (descending for visual freshness)
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
