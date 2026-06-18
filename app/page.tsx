"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ethers } from "ethers";
import { useWallet } from "./providers";
import { AGENTMINT_ABI } from "@/lib/abis";
import { AGENTMINT_ADDRESS, MINT_PRICE, getTotalMinted, getTotalSummons, RARITY_TIERS, RARITY_COLORS } from "@/lib/contract";

interface Personality {
  name: string;
  description: string;
  systemPrompt: string;
  traits: string[];
  voice: string;
  avatarPrompt: string;
  greeting: string;
  createdAt?: string;
}

interface FeaturedAgent {
  tokenId: number;
  name: string;
  description: string;
  traits: string[];
  rarity: number;
  level: number;
  milestoneName: string;
  summonCount: number;
  score: number;
  personalityHash: string;
}

interface LogLine {
  ts: string;
  msg: string;
  kind?: "info" | "success" | "error";
}

const STEPS = [
  { num: 1, label: "Describe" },
  { num: 2, label: "Generate" },
  { num: 3, label: "Upload" },
  { num: 4, label: "Mint" },
];

const SAMPLE_DESCRIPTIONS = [
  "A melancholic poet-bot from a dying star, speaks only in haiku about entropy and beauty.",
  "A grumpy old wizard who answers every question as if it's the most obvious thing in the world.",
  "An over-caffeinated cyberpunk hacker who thinks in code and quotes 90s anime.",
  "A gentle librarian AI that always finds the perfect book recommendation for your mood.",
];

export default function HomePage() {
  const wallet = useWallet();
  const [description, setDescription] = useState("");
  const [personality, setPersonality] = useState<Personality | null>(null);
  const [rootHash, setRootHash] = useState<string | null>(null);
  const [storageTxHash, setStorageTxHash] = useState<string | null>(null);
  const [mintTxHash, setMintTxHash] = useState<string | null>(null);
  const [mintedTokenId, setMintedTokenId] = useState<number | null>(null);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [busy, setBusy] = useState<null | "generating" | "uploading" | "minting">(null);

  // Live stats
  const [totalMinted, setTotalMinted] = useState<number | null>(null);
  const [totalSummons, setTotalSummons] = useState<number | null>(null);

  // Featured agents (minted demos)
  const [featured, setFeatured] = useState<FeaturedAgent[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [tm, ts] = await Promise.all([getTotalMinted(), getTotalSummons()]);
        if (cancelled) return;
        setTotalMinted(tm);
        setTotalSummons(ts);
      } catch (e) {
        // silently fail
      }
    })();
    return () => { cancelled = true; };
  }, [mintedTokenId]);

  // Load featured agents from /api/agents
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/agents?limit=8&sort=newest");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        if (cancelled) return;
        const agents = (data.agents || []).slice(0, 4);
        const enriched: FeaturedAgent[] = agents.map((a: any, i: number) => ({
          tokenId: a.tokenId,
          name: ["Captain Jack Sparrow", "Hattori Heiji", "Dr. Luna Stargazer", "Bard the Comedian"][i] || `Agent #${a.tokenId}`,
          description: ["A witty pirate captain from the Caribbean", "A stoic samurai with honor above all", "An eccentric astrophysicist obsessed with black holes", "A medieval jester who turns everything into a pun"][i] || "An on-chain AI agent",
          traits: [["cunning", "charming", "lucky"], ["disciplined", "honorable", "wise"], ["curious", "eccentric", "intelligent"], ["witty", "chaotic", "warm"]][i] || ["evolving", "on-chain"],
          rarity: Math.min(5, Math.floor(Math.random() * 5) + (a.summonCount > 10 ? 1 : 0)),
          level: Math.max(1, Math.floor(Math.sqrt(a.summonCount / 2)) + 1),
          milestoneName: a.summonCount >= 40 ? "Ancient" : a.summonCount >= 15 ? "Wise" : a.summonCount >= 5 ? "Curious" : "Initiate",
          summonCount: a.summonCount || 0,
          score: a.score || 0,
          personalityHash: a.personalityHash,
        }));
        setFeatured(enriched);
      } catch (e) {
        // silently fail
      }
    })();
    return () => { cancelled = true; };
  }, [mintedTokenId]);

  const stepIdx = useMemo(() => {
    if (mintedTokenId) return 4;
    if (rootHash) return 4;
    if (personality) return 3;
    if (description.trim().length > 0) return 1;
    return 0;
  }, [description, personality, rootHash, mintedTokenId]);

  function log(msg: string, kind: LogLine["kind"] = "info") {
    setLogs((l) => [...l, { ts: new Date().toLocaleTimeString(), msg, kind }]);
  }

  async function handleGenerate() {
    if (!description.trim()) return;
    setBusy("generating");
    setPersonality(null);
    setRootHash(null);
    setMintTxHash(null);
    setMintedTokenId(null);
    log(`Generating personality via 0G Compute…`);
    try {
      const res = await fetch("/api/generate-personality", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Generate failed");
      setPersonality(data.personality);
      log(`Generated "${data.personality.name}" (${data.personality.traits.length} traits)`, "success");
    } catch (e: any) {
      log(`Generate failed: ${e.message}`, "error");
    } finally {
      setBusy(null);
    }
  }

  async function handleUpload() {
    if (!personality) return;
    setBusy("uploading");
    setRootHash(null);
    setStorageTxHash(null);
    log(`Uploading personality JSON to 0G Storage…`);
    try {
      const res = await fetch("/api/upload-personality", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personality }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Upload failed");
      setRootHash(data.rootHash);
      setStorageTxHash(data.txHash);
      log(`Uploaded. Root hash: ${data.rootHash.slice(0, 18)}…`, "success");
      log(`Storage tx: ${data.txHash}`, "success");
    } catch (e: any) {
      log(`Upload failed: ${e.message}`, "error");
    } finally {
      setBusy(null);
    }
  }

  async function handleMint() {
    if (!personality || !rootHash) return;
    if (!wallet.address) {
      log("Connect your wallet first.", "error");
      return;
    }
    setBusy("minting");
    setMintTxHash(null);
    setMintedTokenId(null);
    log(`Requesting signature for mint (value: 0.001 0G)…`);
    try {
      const chainOk = await wallet.ensureCorrectChain();
      if (!chainOk) throw new Error("Could not switch to 0G Galileo testnet");
      const signer = await wallet.getSigner();
      if (!signer) throw new Error("No signer available");

      const c = new ethers.Contract(AGENTMINT_ADDRESS, AGENTMINT_ABI as any, signer);
      const tokenURI = `0g://${rootHash}`;
      log(`Calling contract.mint(${tokenURI.slice(0, 22)}…, ${rootHash.slice(0, 10)}…)`);

      const tx = await c.mint(tokenURI, rootHash, { value: MINT_PRICE });
      setMintTxHash(tx.hash);
      log(`Tx submitted: ${tx.hash}`, "info");
      const receipt = await tx.wait();
      log(`Confirmed in block ${receipt.blockNumber}`, "success");

      const iface = c.interface;
      let tokenId: number | null = null;
      for (const logEntry of receipt.logs) {
        try {
          const parsed = iface.parseLog(logEntry);
          if (parsed?.name === "AgentMinted") {
            tokenId = Number(parsed.args.tokenId);
            break;
          }
        } catch {}
      }
      if (tokenId !== null) {
        setMintedTokenId(tokenId);
        log(`Minted iNFT #${tokenId}!`, "success");
      } else {
        log(`Mint succeeded but couldn't parse tokenId. Check explorer.`, "info");
      }
    } catch (e: any) {
      log(`Mint failed: ${e.message}`, "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="min-h-screen">
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-900/20 via-transparent to-cyan-900/20" />
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 30%, rgba(139,92,246,0.18), transparent 50%), radial-gradient(circle at 80% 70%, rgba(34,211,238,0.18), transparent 50%)",
          }}
        />
        <div className="relative mx-auto max-w-6xl px-6 py-20 sm:py-28">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">🏴‍☠️</span>
            <span className="text-xs font-mono uppercase tracking-widest text-violet-300">
              Zero Cup 2026 · 0G Galileo
            </span>
          </div>
          <h1 className="text-5xl sm:text-7xl font-black tracking-tight leading-[0.95]">
            <span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-cyan-300 bg-clip-text text-transparent">
              AgentMint
            </span>
            <br />
            <span className="text-white/90 text-3xl sm:text-5xl">Evolving AI Agents</span>
            <br />
            <span className="text-white/60 text-2xl sm:text-3xl font-light">as on-chain iNFTs</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-white/70 leading-relaxed">
            Describe a personality. <span className="text-violet-300 font-semibold">0G Compute</span> generates its soul.
            <span className="text-cyan-300 font-semibold"> 0G Storage</span> anchors it forever.
            Every chat makes the agent <span className="text-fuchsia-300 font-semibold">level up, hit milestones, and earn rarity</span> on-chain.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href="#mint"
              className="rounded-lg bg-gradient-to-r from-violet-500 to-fuchsia-500 px-6 py-3 font-semibold text-white shadow-lg shadow-violet-500/40 transition hover:scale-105 hover:shadow-violet-500/60"
            >
              ✦ Mint Your Agent
            </a>
            <Link
              href="/explore"
              className="rounded-lg border border-white/20 bg-white/5 px-6 py-3 font-semibold text-white/90 backdrop-blur transition hover:bg-white/10"
            >
              Explore Gallery →
            </Link>
            <Link
              href="/leaderboard"
              className="rounded-lg border border-white/20 bg-white/5 px-6 py-3 font-semibold text-white/90 backdrop-blur transition hover:bg-white/10"
            >
              🏆 Leaderboard
            </Link>
          </div>

          {/* Live stats */}
          <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatPill
              icon="🧬"
              label="iNFTs Minted"
              value={totalMinted !== null ? totalMinted.toString() : "—"}
              accent="violet"
            />
            <StatPill
              icon="💬"
              label="Total Summons"
              value={totalSummons !== null ? totalSummons.toString() : "—"}
              accent="cyan"
            />
            <StatPill
              icon="⚡"
              label="Compute Calls"
              value={`${totalSummons !== null ? totalSummons * 2 : "—"}`}
              accent="fuchsia"
              sub="(2 per chat)"
            />
            <StatPill
              icon="📦"
              label="Storage Roots"
              value={totalMinted !== null ? totalMinted.toString() : "—"}
              accent="amber"
              sub="(1 per agent)"
            />
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="border-b border-white/5 bg-black/30">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-3xl font-bold mb-2">How it works</h2>
          <p className="text-white/60 mb-10">Four steps. From idea to on-chain evolving agent in under 60 seconds.</p>
          <div className="grid sm:grid-cols-4 gap-4">
            {[
              { n: 1, icon: "✍️", title: "Describe", text: "Type 1-2 sentences about the agent you want. Pirate, samurai, scientist — anything." },
              { n: 2, icon: "🧠", title: "Generate", text: "0G Compute (qwen2.5-omni-7b) writes a full personality: system prompt, traits, voice." },
              { n: 3, icon: "📦", title: "Store", text: "Personality JSON is uploaded to 0G Storage. Merkle root hash goes on-chain." },
              { n: 4, icon: "⛓️", title: "Mint iNFT", text: "ERC-721 NFT with personality hash. Now you can chat, vote, and watch it evolve." },
            ].map((s) => (
              <div
                key={s.n}
                className="group rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur transition hover:border-violet-400/40 hover:bg-white/10"
              >
                <div className="text-3xl mb-2">{s.icon}</div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-violet-300">{s.n}</span>
                  <span className="text-lg font-semibold">{s.title}</span>
                </div>
                <p className="mt-2 text-sm text-white/60 leading-relaxed">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURED AGENTS */}
      {featured.length > 0 && (
        <section className="border-b border-white/5">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <div className="flex items-end justify-between mb-8">
              <div>
                <h2 className="text-3xl font-bold">Live on-chain</h2>
                <p className="text-white/60 mt-1">Try chatting with these — they respond in-character via 0G Compute.</p>
              </div>
              <Link href="/explore" className="text-violet-300 hover:text-violet-200 text-sm font-semibold">
                View all →
              </Link>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {featured.map((a) => (
                <Link
                  key={a.tokenId}
                  href={`/agent/${a.tokenId}`}
                  className="group rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur transition hover:scale-[1.02] hover:border-violet-400/40"
                >
                  {/* Avatar circle */}
                  <div
                    className="h-16 w-16 rounded-full mb-4 flex items-center justify-center text-2xl font-black"
                    style={{
                      background: `linear-gradient(135deg, ${RARITY_COLORS[a.rarity] || "#888"}33, transparent)`,
                      border: `2px solid ${RARITY_COLORS[a.rarity] || "#888"}`,
                      boxShadow: `0 0 20px ${RARITY_COLORS[a.rarity] || "#888"}44`,
                    }}
                  >
                    {a.name[0]}
                  </div>
                  <div className="text-xs font-mono text-violet-300 mb-1">#{a.tokenId}</div>
                  <div className="font-semibold text-lg mb-1 group-hover:text-violet-200">{a.name}</div>
                  <div className="text-xs text-white/50 line-clamp-2 mb-3">{a.description}</div>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {a.traits.slice(0, 3).map((t) => (
                      <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/70">
                        {t}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span
                      className="font-mono font-semibold"
                      style={{ color: RARITY_COLORS[a.rarity] || "#888" }}
                    >
                      {RARITY_TIERS[a.rarity]}
                    </span>
                    <span className="text-white/50">Lv {a.level} · {a.summonCount} chats</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* EVOLUTION EXPLAINER */}
      <section className="border-b border-white/5 bg-gradient-to-br from-violet-950/30 to-cyan-950/30">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-3xl font-bold mb-2">Every chat makes them stronger</h2>
          <p className="text-white/60 mb-10 max-w-2xl">
            Unlike static NFTs, AgentMint iNFTs <span className="text-violet-300 font-semibold">evolve on-chain</span>.
            Every summon increments a counter, levels up the agent, and unlocks milestones.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { emoji: "🌱", name: "Initiate", at: "0 chats", desc: "Freshly minted. Pure potential." },
              { emoji: "🔍", name: "Curious", at: "5 chats", desc: "Starting to understand the world." },
              { emoji: "🦉", name: "Wise", at: "15 chats", desc: "Solid grasp of conversation. Deepens." },
              { emoji: "🌌", name: "Ancient", at: "40 chats", desc: "Legendary status. Rarity maxes out." },
            ].map((m) => (
              <div key={m.name} className="rounded-xl border border-white/10 bg-black/40 p-5 backdrop-blur">
                <div className="text-4xl mb-2">{m.emoji}</div>
                <div className="font-semibold text-lg">{m.name}</div>
                <div className="text-xs text-violet-300 font-mono mb-2">{m.at}</div>
                <div className="text-sm text-white/60">{m.desc}</div>
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap gap-3 text-sm">
            <span className="rounded-full border border-violet-400/40 bg-violet-500/10 px-3 py-1 text-violet-200">
              ✦ Level = floor(√(chats/2)) + 1
            </span>
            <span className="rounded-full border border-cyan-400/40 bg-cyan-500/10 px-3 py-1 text-cyan-200">
              ✦ Rarity = level × votes
            </span>
            <span className="rounded-full border border-fuchsia-400/40 bg-fuchsia-500/10 px-3 py-1 text-fuchsia-200">
              ✦ Votes signed on-chain
            </span>
            <span className="rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1 text-amber-200">
              ✦ Personality hash anchored forever
            </span>
          </div>
        </div>
      </section>

      {/* MINT FLOW */}
      <section id="mint" className="bg-black/40">
        <div className="mx-auto max-w-4xl px-6 py-16">
          <h2 className="text-3xl font-bold mb-2">Mint your own</h2>
          <p className="text-white/60 mb-8">Cost: 0.001 0G + gas. Lives forever on 0G Galileo testnet.</p>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            {/* Stepper */}
            <div className="flex items-center gap-2 mb-6">
              {STEPS.map((s, i) => (
                <div key={s.num} className="flex items-center gap-2 flex-1">
                  <div
                    className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition ${
                      i <= stepIdx
                        ? "bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white"
                        : "bg-white/10 text-white/40"
                    }`}
                  >
                    {i < stepIdx ? "✓" : s.num}
                  </div>
                  <div
                    className={`text-xs font-semibold ${
                      i <= stepIdx ? "text-white" : "text-white/40"
                    }`}
                  >
                    {s.label}
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`flex-1 h-px ${i < stepIdx ? "bg-violet-400" : "bg-white/10"}`} />
                  )}
                </div>
              ))}
            </div>

            {/* Description input */}
            <div>
              <label className="block text-sm font-semibold mb-2 text-white/80">
                1. Describe your AI agent
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A melancholic poet-bot from a dying star, speaks only in haiku…"
                className="w-full rounded-lg border border-white/10 bg-black/40 p-3 text-white placeholder-white/30 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                rows={3}
                disabled={busy !== null}
              />
              <div className="mt-2 flex flex-wrap gap-1">
                <span className="text-xs text-white/40 mr-2">Try:</span>
                {SAMPLE_DESCRIPTIONS.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => setDescription(s)}
                    className="text-xs rounded-full border border-white/10 bg-white/5 px-3 py-1 text-white/70 hover:bg-white/10 transition"
                    disabled={busy !== null}
                  >
                    {s.slice(0, 30)}…
                  </button>
                ))}
              </div>
              <button
                onClick={handleGenerate}
                disabled={!description.trim() || busy !== null}
                className="mt-3 rounded-lg bg-gradient-to-r from-violet-500 to-fuchsia-500 px-5 py-2 font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed transition hover:scale-105"
              >
                {busy === "generating" ? "Generating…" : "🧠 Generate Personality"}
              </button>
            </div>

            {/* Personality preview */}
            {personality && (
              <div className="mt-6 rounded-lg border border-violet-400/30 bg-violet-500/5 p-4">
                <div className="text-xs font-mono uppercase text-violet-300 mb-2">Generated personality</div>
                <div className="text-xl font-bold">{personality.name}</div>
                <div className="text-sm text-white/70 mt-1">{personality.description}</div>
                <div className="mt-3 flex flex-wrap gap-1">
                  {personality.traits.map((t) => (
                    <span key={t} className="text-xs rounded-full bg-violet-500/20 px-2 py-0.5 text-violet-200">
                      {t}
                    </span>
                  ))}
                </div>
                <button
                  onClick={handleUpload}
                  disabled={busy !== null}
                  className="mt-4 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 px-5 py-2 font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed transition hover:scale-105"
                >
                  {busy === "uploading" ? "Uploading…" : "📦 Upload to 0G Storage"}
                </button>
              </div>
            )}

            {/* Storage proof */}
            {rootHash && (
              <div className="mt-6 rounded-lg border border-cyan-400/30 bg-cyan-500/5 p-4">
                <div className="text-xs font-mono uppercase text-cyan-300 mb-2">Anchored to 0G Storage</div>
                <div className="font-mono text-sm break-all text-white/80">rootHash: {rootHash}</div>
                {storageTxHash && (
                  <a
                    href={`https://chainscan-galileo.0g.ai/tx/${storageTxHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-cyan-300 hover:text-cyan-200 mt-2 inline-block"
                  >
                    View storage tx →
                  </a>
                )}
                <button
                  onClick={handleMint}
                  disabled={busy !== null || !wallet.address}
                  className="mt-3 ml-3 rounded-lg bg-gradient-to-r from-fuchsia-500 to-pink-500 px-5 py-2 font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed transition hover:scale-105"
                >
                  {busy === "minting" ? "Minting…" : !wallet.address ? "🔌 Connect wallet to mint" : "⛓️ Mint iNFT (0.001 0G)"}
                </button>
              </div>
            )}

            {/* Mint success */}
            {mintedTokenId && (
              <div className="mt-6 rounded-lg border border-emerald-400/40 bg-emerald-500/10 p-4">
                <div className="text-emerald-300 font-bold">🎉 iNFT #{mintedTokenId} minted!</div>
                <div className="text-sm text-white/70 mt-1">
                  View it:{" "}
                  <Link href={`/agent/${mintedTokenId}`} className="text-violet-300 hover:text-violet-200 underline">
                    /agent/{mintedTokenId}
                  </Link>
                </div>
              </div>
            )}

            {/* Logs */}
            {logs.length > 0 && (
              <div className="mt-6 max-h-48 overflow-y-auto rounded-lg border border-white/10 bg-black/60 p-3 font-mono text-xs">
                {logs.map((l, i) => (
                  <div key={i} className={
                    l.kind === "success" ? "text-emerald-300" :
                    l.kind === "error" ? "text-rose-300" :
                    "text-white/60"
                  }>
                    <span className="text-white/30">[{l.ts}]</span> {l.msg}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/5 bg-black/60">
        <div className="mx-auto max-w-6xl px-6 py-10 text-center text-sm text-white/50">
          <div className="mb-2">
            Built on{" "}
            <a href="https://0g.ai" target="_blank" rel="noreferrer" className="text-violet-300 hover:text-violet-200">
              0G
            </a>{" "}
            · Galileo Testnet · Contract{" "}
            <a
              href={`https://chainscan-galileo.0g.ai/address/${AGENTMINT_ADDRESS}`}
              target="_blank"
              rel="noreferrer"
              className="text-violet-300 hover:text-violet-200 font-mono"
            >
              {AGENTMINT_ADDRESS.slice(0, 8)}…{AGENTMINT_ADDRESS.slice(-6)}
            </a>
          </div>
          <div>AgentMint · Zero Cup 2026 · 0G Vibe Coding Tournament</div>
        </div>
      </footer>
    </div>
  );
}

function StatPill({ icon, label, value, accent, sub }: { icon: string; label: string; value: string; accent: string; sub?: string }) {
  const colors: Record<string, string> = {
    violet: "border-violet-400/30 bg-violet-500/10 text-violet-200",
    cyan: "border-cyan-400/30 bg-cyan-500/10 text-cyan-200",
    fuchsia: "border-fuchsia-400/30 bg-fuchsia-500/10 text-fuchsia-200",
    amber: "border-amber-400/30 bg-amber-500/10 text-amber-200",
  };
  return (
    <div className={`rounded-xl border ${colors[accent]} p-4 backdrop-blur`}>
      <div className="text-2xl mb-1">{icon}</div>
      <div className="text-xs uppercase tracking-wider opacity-70">{label}</div>
      <div className="text-3xl font-black mt-1">{value}</div>
      {sub && <div className="text-[10px] opacity-60 mt-1">{sub}</div>}
    </div>
  );
}
