// Contract interaction helpers for AgentMint iNFT contract.
// Uses ethers v6 syntax. Deployed at 0x203d52c2DE87298A83368dD1565ac3F53c0f9475
// on 0G Galileo testnet (chainId 16602).

import { ethers } from "ethers";
import { AGENTMINT_ABI } from "./abis";

// Deployed contract address (also in .env as NEXT_PUBLIC_AGENTMINT_ADDRESS)
export const AGENTMINT_ADDRESS =
  (process.env.NEXT_PUBLIC_AGENTMINT_ADDRESS as `0x${string}`) ||
  "0x203d52c2DE87298A83368dD1565ac3F53c0f9475";

export const OG_RPC_URL =
  process.env.OG_RPC || process.env.NEXT_PUBLIC_OG_RPC || "https://evmrpc-testnet.0g.ai";

export const OG_CHAIN_ID = 16602;

// Mint price in wei — 0.001 ether (matches contract constant MINT_PRICE)
export const MINT_PRICE = ethers.parseEther("0.001");

/**
 * Get a read-only contract instance backed by a JSON-RPC provider.
 * Use for off-chain reads that don't require a signer.
 */
export function getReadOnlyContract(): ethers.Contract {
  const provider = new ethers.JsonRpcProvider(OG_RPC_URL, OG_CHAIN_ID);
  return new ethers.Contract(AGENTMINT_ADDRESS, AGENTMINT_ABI, provider);
}

/**
 * Get a contract instance backed by a given signer (e.g. server wallet or browser signer).
 */
export function getContractWithSigner(signer: ethers.Signer): ethers.Contract {
  return new ethers.Contract(AGENTMINT_ADDRESS, AGENTMINT_ABI, signer);
}

/**
 * Read all on-chain metadata for an iNFT.
 */
export async function getAgent(tokenId: number | bigint) {
  const c = getReadOnlyContract();
  const data = await c.getAgentData(tokenId);
  return {
    creator: data[0] as string,
    owner: data[1] as string,
    tokenURI: data[2] as string,
    personalityHash: data[3] as string,
    summonCount: Number(data[4]),
  };
}

/**
 * Read total number of iNFTs minted.
 */
export async function getTotalMinted(): Promise<number> {
  const c = getReadOnlyContract();
  const v = await c.totalMinted();
  return Number(v);
}

/**
 * List token IDs owned by an address (uses tokensOfOwner helper).
 */
export async function tokensOfOwner(owner: string): Promise<number[]> {
  const c = getReadOnlyContract();
  const arr = (await c.tokensOfOwner(owner)) as bigint[];
  return arr.map((b) => Number(b));
}

/**
 * Build tokenURI from a 0G Storage root hash.
 * The contract stores `0g://<rootHash>` so anyone can find the metadata on storage.
 */
export function buildTokenURI(rootHash: string): string {
  return `0g://${rootHash}`;
}

/**
 * Extract the root hash from a tokenURI string. Returns null if format unrecognized.
 */
export function parseTokenURI(uri: string): string | null {
  if (!uri) return null;
  if (uri.startsWith("0g://")) return uri.slice(5);
  // If it's a plain 0x-prefixed hash, return as-is
  if (/^0x[0-9a-fA-F]{64}$/.test(uri)) return uri;
  return null;
}

export { AGENTMINT_ABI };
