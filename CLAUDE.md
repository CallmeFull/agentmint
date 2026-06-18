# 0G Agent Skills

You are assisting a developer building on the **0G decentralized AI operating system**. This
repository contains 14 agent skills across 4 categories: Storage, Compute, Chain, and Cross-Layer.

## How to Use

1. Read `AGENTS.md` for orchestration rules, activation triggers, and workflow sequences
2. Load the relevant `SKILL.md` file based on what the developer is building
3. Reference `patterns/*.md` for deep architectural context
4. Follow ALL ALWAYS/NEVER rules — they prevent common bugs

## Critical Rules (Memorize These)

- **processResponse()**: Call after EVERY compute inference. Param order:
  `(providerAddress, chatID, usageData)`
- **ChatID**: Extract from `ZG-Res-Key` header FIRST, `data.id` as fallback (chatbot only)
- **evmVersion**: ALWAYS use `"cancun"` for 0G Chain contracts
- **ethers**: ALWAYS v6 (`ethers.JsonRpcProvider`, `ethers.parseEther`). NEVER v5
- **File handles**: ALWAYS close `ZgFile` with `file.close()` in a `finally` block
- **Private keys**: ALWAYS from `.env`, NEVER hardcoded
- **Upload signature**: `indexer.upload(file, rpcUrl, signer)` — returns `[result, error]` tuple
- **Download behavior**: `indexer.download()` can THROW in addition to returning errors — always
  wrap in try/catch
- **Service tuples**: `listService()` returns tuple arrays, not objects — use `s[0]` for
  providerAddress, `s[1]` for serviceType, `s[6]` for model, `s[10]` for teeVerified
- **Ledger tuples**: `getLedger()` returns tuple — use `account[1]` for totalBalance, `account[2]`
  for availableBalance

## Skill Map

### Storage

- `skills/storage/upload-file/SKILL.md` — Upload files to 0G Storage
- `skills/storage/download-file/SKILL.md` — Download & verify files
- `skills/storage/merkle-verification/SKILL.md` — Data integrity verification

### Compute

- `skills/compute/provider-discovery/SKILL.md` — Find & verify providers
- `skills/compute/account-management/SKILL.md` — Deposits, transfers, refunds
- `skills/compute/streaming-chat/SKILL.md` — LLM inference (DeepSeek, Qwen, Gemma)
- `skills/compute/text-to-image/SKILL.md` — Image generation (Flux Turbo)
- `skills/compute/speech-to-text/SKILL.md` — Audio transcription (Whisper)
- `skills/compute/fine-tuning/SKILL.md` — Model training (testnet only)

### Chain

- `skills/chain/scaffold-project/SKILL.md` — Initialize new 0G projects
- `skills/chain/deploy-contract/SKILL.md` — Deploy Solidity contracts
- `skills/chain/interact-contract/SKILL.md` — Read/write deployed contracts

### Cross-Layer

- `skills/cross-layer/storage-plus-chain/SKILL.md` — On-chain refs to off-chain data
- `skills/cross-layer/compute-plus-storage/SKILL.md` — AI inference + storage I/O

## Pattern Documents

- `patterns/NETWORK_CONFIG.md` — Endpoints, chain IDs, SDK versions, .env template
- `patterns/STORAGE.md` — Storage architecture & SDK reference
- `patterns/COMPUTE.md` — Compute architecture & processResponse() deep-dive
- `patterns/CHAIN.md` — EVM patterns, Hardhat/Foundry configs, ethers v6
- `patterns/SECURITY.md` — Key management, TEE, data integrity
- `patterns/TESTING.md` — Testing strategies & mock patterns

## Quick Start

When a developer asks to build something on 0G:

1. Check `AGENTS.md` workflow sequences to determine which skills to activate
2. Load the primary skill's `SKILL.md`
3. Load `patterns/NETWORK_CONFIG.md` for environment setup
4. Follow the skill's Quick Workflow section
5. Apply all ALWAYS/NEVER rules from `AGENTS.md`

---

# PROJECT: AgentMint — iNFT Generator

## Goal
Build an iNFT (intelligent NFT) generator for 0G Zero Cup hackathon. Users describe an AI agent
personality, the system mints a unique on-chain iNFT where the personality metadata is stored on
0G Storage and the agent is owned as an ERC-721 NFT.

## Stack
- Smart contract: Solidity 0.8.24, ERC-721 with personality hash + storage ref (ERC-7857 inspired)
- Frontend: Next.js 14 (App Router) + wagmi v2 + RainbowKit + viem
- Backend: Minimal — mostly client-side calls to 0G Compute + 0G Storage SDK
- 0G Compute: deepseek-v3 or qwen3-vl-30b for personality generation + chat
- 0G Storage: personality metadata, conversation history

## Environment
- Testnet RPC: `https://evmrpc-testnet.0g.ai` (chainId 16602)
- Storage Indexer: `https://indexer-storage-testnet-turbo.0g.ai`
- Compute Router: `https://router-api.0g.ai/v1` (OpenAI-compatible, API key needed)
- Faucet: https://faucet.0g.ai (testnet 0G)
- Compute dashboard: https://pc.0g.ai (deposit 0G, get API key)

## Files
- `.env` (NEVER commit) — PRIVATE_KEY, COMPUTE_API_KEY, NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
- `contracts/AgentMint.sol` — main contract
- `app/` — Next.js frontend
- `lib/0g.ts` — 0G Compute + Storage helpers
- `scripts/deploy.ts` — Hardhat deploy script
- `README.md` — project overview

## Acceptance Criteria
- User connects wallet
- User enters agent description + traits
- Frontend calls 0G Compute to expand personality
- Frontend uploads personality JSON to 0G Storage (gets root hash)
- User mints NFT with personality hash
- User can "chat" with the agent (load personality from storage, call 0G Compute with system prompt)
- All steps visible in UI with tx hashes
