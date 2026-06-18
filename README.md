# AgentMint — iNFT Generator on 0G

Mint your AI agent as an ownable Intelligent NFT. Describe its personality → 0G Compute generates a unique persona → uploaded to 0G Storage → minted on 0G Chain as an ERC-7857 iNFT you can own, trade, and chat with.

## Live Demo
https://tiger-cleaning-clothes-satisfy.trycloudflare.com

## Contract
- **0G Testnet:** `0x203d52c2DE87298A83368dD1565ac3F53c0f9475`
- **Explorer:** https://chainscan-galileo.0g.ai/address/0x203d52c2DE87298A83368dD1565ac3F53c0f9475

## How It Works

1. **Describe** your AI agent in natural language ("a sarcastic pirate chef who loves dad jokes")
2. **Generate** — 0G Compute (qwen2.5-omni-7b) creates a unique personality with traits, voice, and backstory
3. **Upload** — personality + metadata stored on 0G Storage (immutable, content-addressed)
4. **Mint** — ERC-7857 NFT on 0G Chain, owned by your wallet, with on-chain pointer to storage
5. **Chat** — interact with your iNFT in-character

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Next.js Frontend                      │
│  (Wallet Connect · Personality Builder · Mint · Chat)    │
└────────────────────┬────────────────────────────────────┘
                     │
       ┌─────────────┼──────────────┐
       │             │              │
       ▼             ▼              ▼
┌────────────┐ ┌──────────┐ ┌─────────────┐
│ 0G Compute │ │ 0G Chain │ │ 0G Storage  │
│            │ │  (ERC-   │ │             │
│ qwen2.5-   │ │  7857)   │ │  Personality│
│ omni-7b    │ │          │ │  + metadata │
│ (TEE)      │ │          │ │             │
└────────────┘ └──────────┘ └─────────────┘
```

## Tech Stack

- **Smart Contract:** Solidity ^0.8.24, OpenZeppelin ERC-721URIStorage + Ownable
- **Standard:** ERC-7857 (iNFT — Intelligent NFT)
- **Chain:** 0G Galileo Testnet (chainId 16602)
- **Storage:** 0G Storage SDK (`@0gfoundation/0g-storage-ts-sdk`)
- **Compute:** 0G Serving Broker (`@0glabs/0g-serving-broker`)
- **Frontend:** Next.js 14 App Router, ethers v6, RainbowKit, Tailwind

## Quick Start

```bash
# Install
npm install --legacy-peer-deps

# Compile contract
npx hardhat compile

# Deploy (testnet)
PRIVATE_KEY=0x... npx hardhat run scripts/deploy.js --network ogTestnet

# Run frontend
npm run dev
```

## License

MIT
