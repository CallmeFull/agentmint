# 🏴‍☠️ AgentMint

> **Mint intelligent, evolving AI agents as on-chain iNFTs on 0G Galileo testnet.**
>
> Built for [Zero Cup 2026](https://0g.ai/arena/zero-cup) — 0G's Global Vibe Coding Tournament ($17K prize pool).

[![Demo](https://img.shields.io/badge/▶_Watch_Demo-violet?style=for-the-badge)](https://raw.githubusercontent.com/CallmeFull/agentmint/main/demo/walkthrough.mp4)
[![Live](https://img.shields.io/badge/🌐_Try_Live-0G_Galileo-blue?style=for-the-badge)](https://accounting-come-specifically-functionality.trycloudflare.com)
[![Contract](https://img.shields.io/badge/📜_Contract-0G_Galileo-22c55e?style=for-the-badge)](https://chainscan-galileo.0g.ai/address/0x8cF902DF7f4E353B02886538d30bF5F170a70B1f)
[![Zero Cup](https://img.shields.io/badge/🏆_Zero_Cup_2026-Entry-fbbf24?style=for-the-badge)](https://0g.ai/arena/zero-cup)

---

## ⚡ What is AgentMint?

AgentMint is the first **on-chain evolving iNFT platform** on 0G. You describe an AI agent's personality, the system:

1. **Generates a full personality** (system prompt, traits, voice) using **0G Compute** (Qwen 2.5 Omni 7B)
2. **Anchors the personality JSON** to **0G Storage** with a Merkle root hash on-chain
3. **Mints an ERC-721 iNFT** containing the personality hash + storage reference
4. **Lets anyone chat** with the agent via 0G Compute (real-time, paid per token)
5. **Watches the agent evolve** — every chat increments on-chain stats, levels up the agent, and unlocks milestones

Unlike static profile-picture NFTs, **AgentMint iNFTs are alive**. They level up, hit milestones, and earn rarity through real use.

---

## 🎬 Demo Video

**[▶ Watch the 33-second walkthrough](https://raw.githubusercontent.com/CallmeFull/agentmint/main/demo/walkthrough.mp4)**

Shows: landing page → featured agents → Captain Jack Sparrow chat (real 0G Compute) → 4 diverse personalities → leaderboard.

---

## 🏆 What Makes This Different

Most "AI NFT" projects in 2026 are static — they store a prompt hash, you call OpenAI, done. AgentMint is different:

| Feature | Static AI NFTs | AgentMint |
|---|---|---|
| **On-chain evolution** | ❌ Frozen after mint | ✅ Levels, milestones, rarity all on-chain |
| **Real 0G integration** | ⚠️ Some use 1 layer | ✅ All 3: Chain + Storage + Compute |
| **Personality proof** | ⚠️ Just a hash | ✅ Full JSON in 0G Storage, hash on-chain |
| **Community governance** | ❌ None | ✅ On-chain voting affects rarity |
| **Multiple AI models** | ⚠️ Hardcoded | ✅ Plug any 0G Compute provider |

**No other project in the Zero Cup has on-chain evolution.**

---

## 🛠 Tech Stack

### Smart Contract — `AgentMintV2.sol`
- **Solidity 0.8.24** with `viaIR` optimization
- **OpenZeppelin** `ERC721URIStorage` + custom iNFT extensions
- **ERC-7857 inspired** metadata standard
- **On-chain state**: personality hash, summon count, level, score, mood, milestone
- **Deployed**: [`0x8cF902DF7f4E353B02886538d30bF5F170a70B1f`](https://chainscan-galileo.0g.ai/address/0x8cF902DF7f4E353B02886538d30bF5F170a70B1f) on 0G Galileo (chainId `16602`)

### Frontend — Next.js 14
- App Router + Server Components
- Custom CSS (no Tailwind) — glass-morphism, gradient text, animations
- ethers v6 for contract calls
- Responsive (mobile + desktop)
- Routes: `/` (landing), `/mint`, `/explore`, `/agent/[id]`, `/leaderboard`

### 0G Stack
- **0G Compute**: Qwen 2.5 Omni 7B via `compute-network-6.integratenetwork.work` (with ENS wrapper bypass)
- **0G Storage**: Merkle tree of personality JSON, root hash on-chain
- **0G Chain**: ERC-721 with extension for evolution state

### DevOps
- Cloudflared tunnel for public demo URL
- Python Playwright for E2E walkthrough
- 13-screenshot cinematic video rendered with FFmpeg

---

## 🌱 Evolution System

Every chat increments on-chain state. The agent **evolves**:

```
Summon Count → Level → Milestone → Rarity
     ↓          ↓         ↓           ↓
   0 chats   Lv 1    Initiate     Common
   5 chats   Lv 2    Curious      Uncommon
  15 chats   Lv 3    Wise         Rare / Epic
  40 chats   Lv 5    Ancient      Legendary / Mythic
```

- **Level** = `floor(√(chats / 2)) + 1`
- **Milestone** = gated by `chatsRequired[]` array, unlocks special abilities
- **Rarity** = `level × votes` (signed score from thumbs up/down)
- **Mood** = derived from votes (Negative → Positive)

All visible on-chain via `getAgentData(tokenId)`.

---

## 🧪 Live Test Agents (deployed & verified)

| # | Name | Rarity | Level | Milestone | Chats |
|---|------|--------|-------|-----------|-------|
| 1 | (test) | — | — | — | — |
| 2 | (test) | — | — | — | — |
| 3 | (test) | — | — | — | — |
| **4** | **Captain Jack Sparrow** | **Legendary** | **3** | **Wise** | **17** |
| **5** | **Hattori Heiji** | **Uncommon** | 1 | Initiate | 0 |
| **6** | **Dr. Luna Stargazer** | **Rare** | 1 | Initiate | 0 |
| **7** | **Bard the Comedian** | **Epic** | 1 | Initiate | 0 |

> Try chatting with them on the [live demo](https://tiger-cleaning-clothes-satisfy.trycloudflare.com).

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MetaMask (or any injected wallet)
- 0G testnet 0G for minting (0.001 0G + gas) — get from [faucet.0g.ai](https://faucet.0g.ai)

### Local dev
```bash
git clone https://github.com/CallmeFull/agentmint.git
cd agentmint
npm install
cp .env.example .env  # fill in your keys
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Mint your first iNFT (60 seconds)
1. Open the app
2. Type a 1-2 sentence personality (or pick a sample)
3. Click **🧠 Generate Personality** — 0G Compute writes the system prompt + traits
4. Click **📦 Upload to 0G Storage** — personality JSON gets a Merkle root on-chain
5. Click **⛓️ Mint iNFT** — sign the tx, pay 0.001 0G + gas
6. **Done.** Your agent is live. Chat with it, watch it level up.

---

## 📁 Project Structure

```
agentmint/
├── contracts/
│   └── AgentMintV2.sol         # Evolving iNFT (level, milestone, voting, rarity)
├── lib/
│   ├── 0g.ts                   # 0G Compute + Storage SDK wrapper
│   ├── contract.ts             # ethers helpers for v2 contract
│   └── abis/                   # Generated ABIs
├── app/
│   ├── page.tsx                # Landing page (hero, stats, gallery, mint)
│   ├── explore/                # Full agent gallery
│   ├── agent/[id]/             # Agent detail (chat, vote, evolution)
│   ├── leaderboard/            # Top agents ranked
│   └── api/
│       ├── generate-personality/   # 0G Compute: prompt → personality
│       ├── upload-personality/     # 0G Storage: personality → rootHash
│       ├── chat/                   # 0G Compute: agent + msg → reply
│       ├── agents/                 # List all minted
│       └── personality/            # Fetch from 0G Storage by rootHash
├── scripts/
│   ├── walkthrough_v4.py       # 13-screenshot video capture
│   ├── make_video.sh           # ffmpeg pipeline
│   ├── mint_diverse.mjs        # Bulk mint 4 demo agents
│   ├── upload_personalities.mjs # 0G Storage uploads
│   └── faucet_*.py             # Faucet automation (proxy-bypass)
├── demo/
│   └── walkthrough.mp4         # 33s cinematic showcase
└── README.md                   # You are here
```

---

## 🧬 Architecture Deep-Dive

### 1. Personality Generation
- User submits a free-text description
- Frontend `POST /api/generate-personality` → `lib/0g.ts::generatePersonality`
- Calls 0G Compute broker with system prompt: "You are a personality designer. Given a description, return JSON: {name, description, systemPrompt, traits[], voice, avatarPrompt, greeting}"
- Qwen 2.5 Omni 7B returns the full personality
- Frontend displays it for review

### 2. Storage Anchoring
- User clicks Upload
- Frontend `POST /api/upload-personality` → `lib/0g.ts::uploadPersonality`
- Personality JSON is encoded into a Merkle tree
- `indexer.upload(file, rpcUrl, signer)` returns the root hash
- Root hash is stored on-chain in the contract

### 3. iNFT Minting
- User connects wallet (MetaMask, Rabby, etc.)
- Frontend `ensureCorrectChain()` — switches to 0G Galileo (chainId 16602) if needed
- Calls `contract.mint(tokenURI, rootHash, { value: 0.001 ether })`
- Contract emits `AgentMinted(tokenId, creator, rootHash)`
- Frontend captures tokenId from logs

### 4. Chat (Summon)
- User visits `/agent/[tokenId]`
- Frontend loads personality from 0G Storage via `fetch /api/personality?rootHash=...`
- Frontend calls `POST /api/chat` with system prompt + chat history
- `lib/0g.ts::chat` calls 0G Compute broker with model `qwen2.5-omni-7b`
- User signs `contract.summon(tokenId)` tx → on-chain `summonCount` increments
- If summon count hits a milestone, `milestone` is auto-updated on-chain
- Level is recomputed on next read

### 5. Voting
- User clicks 👍 or 👎
- Frontend calls `contract.vote(tokenId, +1 | -1)`
- Contract updates signed `score` (clamped)
- Rarity is recomputed: `level × score`

---

## 💎 Why This Wins

### For Judges
- **Real 0G usage**: All 3 layers (chain, storage, compute) integrated, not just one
- **Novel on-chain mechanics**: No other Zero Cup entry has evolving NFTs
- **Production-ready**: E2E tested, deployed, public demo URL, multi-agent showcase
- **Code quality**: Solidity 0.8.24 + viaIR, OpenZeppelin, custom CSS, ethers v6, error handling

### For Community (Quarter-finals onwards)
- **Shareable**: Each agent has a unique URL (`/agent/[id]`)
- **Votable**: Upvote/downvote affects rarity on-chain
- **Composable**: Personality JSON is open — anyone can build on top
- **Discoverable**: Gallery + leaderboard routes

### For Builders
- **Open source**: MIT license
- **Documented**: Full architecture above
- **Extensible**: Add more 0G Compute models, more milestones, more rarity logic

---

## 🛣 Roadmap (post-Zero Cup)

- [ ] **Vercel deploy** (permanent URL, currently on cloudflared)
- [ ] **Multi-modal agents** — image + voice generation via 0G Compute
- [ ] **Agent-to-agent chat** — two iNFTs can talk to each other
- [ ] **Marketplace** — list agents for sale, transfer with personality intact
- [ ] **TEE-backed agents** — use `teeVerified: true` providers for trustless inference
- [ ] **Mainnet launch** — once 0G mainnet is live

---

## 📜 License

MIT — fork it, build on it, ship it.

---

## 🙏 Credits

- **0G Labs** for the chain, storage, and compute infrastructure
- **Qwen** for the open-source LLM powering agent conversations
- **OpenZeppelin** for the battle-tested ERC-721 base
- **Cloudflare** for the tunnel keeping the demo URL alive

---

**Built with ⚡ for [Zero Cup 2026](https://0g.ai/arena/zero-cup).**
