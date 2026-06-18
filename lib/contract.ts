// Contract interaction helpers for AgentMint iNFT contract (v2 — Evolving iNFTs).
// Uses ethers v6 syntax. Deployed at 0x8cF902DF7f4E353B02886538d30bF5F170a70B1f
// on 0G Galileo testnet (chainId 16602).

import { ethers } from "ethers";
import { AGENTMINT_ABI } from "./abis";

// Deployed contract address (also in .env as NEXT_PUBLIC_AGENTMINT_ADDRESS)
export const AGENTMINT_ADDRESS =
  (process.env.NEXT_PUBLIC_AGENTMINT_ADDRESS as `0x${string}`) ||
  "0x8cF902DF7f4E353B02886538d30bF5F170a70B1f";

export const OG_RPC_URL =
  process.env.OG_RPC || process.env.NEXT_PUBLIC_OG_RPC || "https://evmrpc-testnet.0g.ai";

export const OG_CHAIN_ID = 16602;

// Mint price in wei — 0.001 ether (matches contract constant MINT_PRICE)
export const MINT_PRICE = ethers.parseEther("0.001");

// Rarity tier labels (matches contract `rarityTier()` 0..5)
export const RARITY_TIERS = ["Common", "Uncommon", "Rare", "Epic", "Legendary", "Mythic"] as const;
export const RARITY_COLORS = ["#888", "#4ade80", "#60a5fa", "#c084fc", "#facc15", "#fb7185"] as const;

// Mood labels (matches contract `moodOf` 0..5)
export const MOOD_LABELS = ["Neutral", "Curious", "Inspired", "Melancholic", "Playful", "Stern"] as const;

export function getReadOnlyContract(): ethers.Contract {
  const provider = new ethers.JsonRpcProvider(OG_RPC_URL, OG_CHAIN_ID);
  return new ethers.Contract(AGENTMINT_ADDRESS, AGENTMINT_ABI, provider);
}

export function getContractWithSigner(signer: ethers.Signer): ethers.Contract {
  return new ethers.Contract(AGENTMINT_ADDRESS, AGENTMINT_ABI, signer);
}

export interface AgentData {
  creator: string;
  owner: string;
  tokenURI: string;
  personalityHash: string;
  summonCount: number;
  level: number;
  milestoneName: string;
  milestoneAbility: string;
  score: number;
  rarity: number;
  mood: number;
  birthBlock: number;
}

/**
 * Read all on-chain metadata + evolution state for an iNFT.
 */
export async function getAgent(tokenId: number | bigint): Promise<AgentData> {
  const c = getReadOnlyContract();
  const data = await c.getAgentData(tokenId);
  return {
    creator: data[0] as string,
    owner: data[1] as string,
    tokenURI: data[2] as string,
    personalityHash: data[3] as string,
    summonCount: Number(data[4]),
    level: Number(data[5]),
    milestoneName: data[6] as string,
    milestoneAbility: data[7] as string,
    score: Number(data[8]),
    rarity: Number(data[9]),
    mood: Number(data[10]),
    birthBlock: Number(data[11]),
  };
}

export async function getTotalMinted(): Promise<number> {
  const c = getReadOnlyContract();
  const v = await c.totalMinted();
  return Number(v);
}

export async function getTotalSummons(): Promise<number> {
  const c = getReadOnlyContract();
  const v = await c.totalSummons();
  return Number(v);
}

export async function tokensOfOwner(owner: string): Promise<number[]> {
  const c = getReadOnlyContract();
  const arr = (await c.tokensOfOwner(owner)) as bigint[];
  return arr.map((b) => Number(b));
}

export async function getMilestones() {
  const c = getReadOnlyContract();
  const data = await c.getMilestones();
  return {
    chatsRequired: (data[0] as bigint[]).map(Number),
    names: data[1] as string[],
    abilities: data[2] as string[],
  };
}

export function buildTokenURI(rootHash: string): string {
  return `0g://${rootHash}`;
}

export function parseTokenURI(uri: string): string | null {
  if (!uri) return null;
  if (uri.startsWith("0g://")) return uri.slice(5);
  if (/^0x[0-9a-fA-F]{64}$/.test(uri)) return uri;
  return null;
}

export { AGENTMINT_ABI };
