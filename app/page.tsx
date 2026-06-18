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

const FEATURED_AGENTS_FALLBACK: FeaturedAgent[] = [
  { tokenId: 4, name: "Captain Jack Sparrow", description: "A witty 18th century pirate captain from the Caribbean", traits: ["cunning", "charming", "lucky"], rarity: 4, level: 3, milestoneName: "Wise", summonCount: 17, score: 0, personalityHash: "" },
  { tokenId: 5, name: "Hattori Heiji",        description: "A stoic samurai from feudal Japan with honor above all",     traits: ["disciplined", "honorable", "wise"],   rarity: 1, level: 1, milestoneName: "Initiate", summonCount: 0,  score: 0, personalityHash: "" },
  { tokenId: 6, name: "Dr. Luna Stargazer",   description: "An eccentric astrophysicist obsessed with black holes",       traits: ["curious", "eccentric", "intelligent"], rarity: 2, level: 1, milestoneName: "Initiate", summonCount: 0,  score: 0, personalityHash: "" },
  { tokenId: 7, name: "Bard the Comedian",    description: "A medieval jester who turns everything into a pun",           traits: ["witty", "chaotic", "warm"],           rarity: 3, level: 1, milestoneName: "Initiate", summonCount: 0,  score: 0, personalityHash: "" },
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
  const [featured, setFeatured] = useState<FeaturedAgent[]>(FEATURED_AGENTS_FALLBACK);

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

  // Load agents from /api/agents to merge with fallback
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/agents?limit=8&sort=newest");
        const data = await res.json();
        if (!res.ok) return;
        if (cancelled) return;
        const agents = (data.agents || []).slice(0, 4);
        if (agents.length === 0) return;
        // Build enriched list using on-chain data + our metadata
        const enriched: FeaturedAgent[] = agents.map((a: any, i: number) => {
          const fallback = FEATURED_AGENTS_FALLBACK[i] || FEATURED_AGENTS_FALLBACK[0];
          return {
            ...fallback,
            tokenId: a.tokenId,
            summonCount: a.summonCount || 0,
            level: Math.max(1, Math.floor(Math.sqrt((a.summonCount || 0) / 2)) + 1),
            rarity: a.rarity ?? fallback.rarity,
            score: a.score || 0,
            personalityHash: a.personalityHash,
            milestoneName: (a.summonCount || 0) >= 40 ? "Ancient" : (a.summonCount || 0) >= 15 ? "Wise" : (a.summonCount || 0) >= 5 ? "Curious" : "Initiate",
          };
        });
        setFeatured(enriched);
      } catch (e) {}
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
    <div className="landing">
      {/* HERO */}
      <section className="hero-wrap">
        <div className="container" style={{ padding: "80px 24px" }}>
          <span className="badge anim-pulse">🏆 Zero Cup 2026 · 0G Galileo</span>
          <h1 className="anim-fade-up" style={{ marginTop: 20 }}>
            <span className="grad-text">AgentMint</span>
            <br />
            <span className="grad-text-soft" style={{ fontSize: "0.5em", fontWeight: 600 }}>Evolving AI Agents</span>
            <br />
            <span className="grad-text-soft" style={{ fontSize: "0.36em", fontWeight: 400 }}>as on-chain iNFTs</span>
          </h1>
          <p className="lead anim-fade-up" style={{ marginTop: 24, animationDelay: "0.1s" }}>
            Describe a personality. <strong style={{ color: "#c4b5fd" }}>0G Compute</strong> generates its soul.
            <strong style={{ color: "#67e8f9" }}> 0G Storage</strong> anchors it forever.
            Every chat makes the agent <strong style={{ color: "#f0abfc" }}>level up, hit milestones, and earn rarity</strong> on-chain.
          </p>
          <div className="row anim-fade-up" style={{ marginTop: 32, animationDelay: "0.2s" }}>
            <a href="#mint" className="btn-grad">✦ Mint Your Agent</a>
            <Link href="/explore" className="btn-ghost">Explore Gallery →</Link>
            <Link href="/leaderboard" className="btn-ghost">🏆 Leaderboard</Link>
          </div>

          {/* Live stats */}
          <div className="grid-4" style={{ marginTop: 48 }}>
            <div className="stat-card violet anim-fade-up" style={{ animationDelay: "0.3s" }}>
              <div style={{ fontSize: 28 }}>🧬</div>
              <div className="lbl">iNFTs Minted</div>
              <div className="num">{totalMinted !== null ? totalMinted : "—"}</div>
            </div>
            <div className="stat-card cyan anim-fade-up" style={{ animationDelay: "0.4s" }}>
              <div style={{ fontSize: 28 }}>💬</div>
              <div className="lbl">Total Summons</div>
              <div className="num">{totalSummons !== null ? totalSummons : "—"}</div>
            </div>
            <div className="stat-card fuchsia anim-fade-up" style={{ animationDelay: "0.5s" }}>
              <div style={{ fontSize: 28 }}>⚡</div>
              <div className="lbl">Compute Calls</div>
              <div className="num">{totalSummons !== null ? totalSummons * 2 : "—"}</div>
              <div className="dim" style={{ fontSize: 10, marginTop: 4, opacity: 0.6 }}>(2 per chat)</div>
            </div>
            <div className="stat-card amber anim-fade-up" style={{ animationDelay: "0.6s" }}>
              <div style={{ fontSize: 28 }}>📦</div>
              <div className="lbl">Storage Roots</div>
              <div className="num">{totalMinted !== null ? totalMinted : "—"}</div>
              <div className="dim" style={{ fontSize: 10, marginTop: 4, opacity: 0.6 }}>(1 per agent)</div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section style={{ background: "rgba(0,0,0,0.3)" }}>
        <div className="section-pad">
          <h2>How it works</h2>
          <p className="dim" style={{ marginBottom: 40 }}>Four steps. From idea to on-chain evolving agent in under 60 seconds.</p>
          <div className="grid-4">
            {[
              { n: 1, icon: "✍️", title: "Describe", text: "Type 1-2 sentences about the agent you want. Pirate, samurai, scientist — anything." },
              { n: 2, icon: "🧠", title: "Generate", text: "0G Compute (qwen2.5-omni-7b) writes a full personality: system prompt, traits, voice." },
              { n: 3, icon: "📦", title: "Store", text: "Personality JSON is uploaded to 0G Storage. Merkle root hash goes on-chain." },
              { n: 4, icon: "⛓️", title: "Mint iNFT", text: "ERC-721 NFT with personality hash. Now you can chat, vote, and watch it evolve." },
            ].map((s) => (
              <div key={s.n} className="step-card">
                <div style={{ fontSize: 32, marginBottom: 8 }}>{s.icon}</div>
                <div className="row" style={{ alignItems: "baseline", gap: 8 }}>
                  <span style={{ fontSize: 24, fontWeight: 900, color: "#c4b5fd" }}>{s.n}</span>
                  <span style={{ fontSize: 18, fontWeight: 700 }}>{s.title}</span>
                </div>
                <p className="dim" style={{ marginTop: 8, fontSize: 13 }}>{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURED AGENTS */}
      {featured.length > 0 && (
        <section>
          <div className="section-pad">
            <div className="row" style={{ alignItems: "flex-end", justifyContent: "space-between", marginBottom: 32, flexWrap: "wrap", gap: 16 }}>
              <div>
                <h2>Live on-chain</h2>
                <p className="dim" style={{ marginTop: 4 }}>Try chatting with these — they respond in-character via 0G Compute.</p>
              </div>
              <Link href="/explore" style={{ color: "#c4b5fd", textDecoration: "none", fontSize: 14, fontWeight: 600 }}>
                View all →
              </Link>
            </div>
            <div className="grid-4">
              {featured.map((a) => (
                <Link key={a.tokenId} href={`/agent/${a.tokenId}`} className="agent-card">
                  <div
                    className="avatar-circle"
                    style={{
                      background: `linear-gradient(135deg, ${RARITY_COLORS[a.rarity] || "#888"}33, transparent)`,
                      border: `2px solid ${RARITY_COLORS[a.rarity] || "#888"}`,
                      boxShadow: `0 0 20px ${RARITY_COLORS[a.rarity] || "#888"}44`,
                      color: RARITY_COLORS[a.rarity] || "#888",
                    }}
                  >
                    {a.name[0]}
                  </div>
                  <div style={{ fontSize: 11, fontFamily: "var(--mono)", color: "#c4b5fd", marginBottom: 4 }}>#{a.tokenId}</div>
                  <h3 style={{ fontSize: 18, marginBottom: 4 }}>{a.name}</h3>
                  <div className="dim" style={{ fontSize: 12, marginBottom: 12, lineHeight: 1.4 }}>{a.description}</div>
                  <div className="row" style={{ gap: 4, marginBottom: 12 }}>
                    {a.traits.slice(0, 3).map((t) => (
                      <span key={t} className="pill">{t}</span>
                    ))}
                  </div>
                  <div className="row" style={{ justifyContent: "space-between", fontSize: 12 }}>
                    <span style={{ fontFamily: "var(--mono)", fontWeight: 700, color: RARITY_COLORS[a.rarity] || "#888" }}>
                      {RARITY_TIERS[a.rarity]}
                    </span>
                    <span className="dim">Lv {a.level} · {a.summonCount} chats</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* EVOLUTION EXPLAINER */}
      <section style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.12), rgba(34,211,238,0.12))" }}>
        <div className="section-pad">
          <h2>Every chat makes them stronger</h2>
          <p className="dim" style={{ marginBottom: 32, maxWidth: 640 }}>
            Unlike static NFTs, AgentMint iNFTs <strong style={{ color: "#c4b5fd" }}>evolve on-chain</strong>.
            Every summon increments a counter, levels up the agent, and unlocks milestones.
          </p>
          <div className="grid-4">
            {[
              { emoji: "🌱", name: "Initiate", at: "0 chats", desc: "Freshly minted. Pure potential." },
              { emoji: "🔍", name: "Curious", at: "5 chats", desc: "Starting to understand the world." },
              { emoji: "🦉", name: "Wise", at: "15 chats", desc: "Solid grasp of conversation. Deepens." },
              { emoji: "🌌", name: "Ancient", at: "40 chats", desc: "Legendary status. Rarity maxes out." },
            ].map((m) => (
              <div key={m.name} className="tier-card">
                <div style={{ fontSize: 40, marginBottom: 8 }}>{m.emoji}</div>
                <h3>{m.name}</h3>
                <div style={{ fontSize: 11, color: "#c4b5fd", fontFamily: "var(--mono)", marginTop: 4, marginBottom: 8 }}>{m.at}</div>
                <div className="dim" style={{ fontSize: 13 }}>{m.desc}</div>
              </div>
            ))}
          </div>
          <div className="row" style={{ marginTop: 24, gap: 8 }}>
            <span className="pill" style={{ border: "1px solid rgba(139,92,246,0.4)", background: "rgba(139,92,246,0.1)", color: "#c4b5fd" }}>
              ✦ Level = floor(√(chats/2)) + 1
            </span>
            <span className="pill" style={{ border: "1px solid rgba(34,211,238,0.4)", background: "rgba(34,211,238,0.1)", color: "#67e8f9" }}>
              ✦ Rarity = level × votes
            </span>
            <span className="pill" style={{ border: "1px solid rgba(217,70,239,0.4)", background: "rgba(217,70,239,0.1)", color: "#f0abfc" }}>
              ✦ Votes signed on-chain
            </span>
            <span className="pill" style={{ border: "1px solid rgba(251,191,36,0.4)", background: "rgba(251,191,36,0.1)", color: "#fde68a" }}>
              ✦ Personality hash anchored forever
            </span>
          </div>
        </div>
      </section>

      {/* MINT FLOW */}
      <section id="mint" style={{ background: "rgba(0,0,0,0.4)" }}>
        <div className="container-sm section-pad">
          <h2>Mint your own</h2>
          <p className="dim" style={{ marginBottom: 32 }}>Cost: 0.001 0G + gas. Lives forever on 0G Galileo testnet.</p>

          <div className="mint-card">
            {/* Stepper */}
            <div className="row" style={{ marginBottom: 24, gap: 8 }}>
              {STEPS.map((s, i) => (
                <div key={s.num} className="row" style={{ flex: 1, alignItems: "center", gap: 8, minWidth: 0 }}>
                  <div className={`step-dot ${i < stepIdx ? "done" : i === stepIdx ? "active" : "pending"}`}>
                    {i < stepIdx ? "✓" : s.num}
                  </div>
                  <div style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: i <= stepIdx ? "white" : "rgba(255,255,255,0.4)",
                    whiteSpace: "nowrap",
                  }}>
                    {s.label}
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`step-line ${i < stepIdx ? "active" : ""}`} />
                  )}
                </div>
              ))}
            </div>

            {/* Description input */}
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 8, color: "rgba(255,255,255,0.8)" }}>
                1. Describe your AI agent
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A melancholic poet-bot from a dying star, speaks only in haiku…"
                className="form-input"
                rows={3}
                disabled={busy !== null}
              />
              <div className="row" style={{ marginTop: 8, gap: 6 }}>
                <span className="dim" style={{ fontSize: 11 }}>Try:</span>
                {SAMPLE_DESCRIPTIONS.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => setDescription(s)}
                    className="pill"
                    style={{ cursor: "pointer", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.7)" }}
                    disabled={busy !== null}
                  >
                    {s.slice(0, 30)}…
                  </button>
                ))}
              </div>
              <button
                onClick={handleGenerate}
                disabled={!description.trim() || busy !== null}
                className="btn-grad"
                style={{ marginTop: 12, opacity: (!description.trim() || busy !== null) ? 0.4 : 1 }}
              >
                {busy === "generating" ? "Generating…" : "🧠 Generate Personality"}
              </button>
            </div>

            {/* Personality preview */}
            {personality && (
              <div className="preview-card" style={{ marginTop: 24 }}>
                <div className="dim" style={{ fontSize: 11, fontFamily: "var(--mono)", textTransform: "uppercase", marginBottom: 8, color: "#c4b5fd" }}>
                  Generated personality
                </div>
                <h3 style={{ fontSize: 22 }}>{personality.name}</h3>
                <p className="dim" style={{ fontSize: 14, marginTop: 4 }}>{personality.description}</p>
                <div className="row" style={{ gap: 6, marginTop: 12 }}>
                  {personality.traits.map((t) => (
                    <span key={t} className="pill" style={{ background: "rgba(139,92,246,0.2)", color: "#c4b5fd" }}>{t}</span>
                  ))}
                </div>
                <button
                  onClick={handleUpload}
                  disabled={busy !== null}
                  className="btn-grad"
                  style={{ marginTop: 16, background: "linear-gradient(135deg, #06b6d4, #3b82f6)" }}
                >
                  {busy === "uploading" ? "Uploading…" : "📦 Upload to 0G Storage"}
                </button>
              </div>
            )}

            {/* Storage proof */}
            {rootHash && (
              <div className="preview-card storage" style={{ marginTop: 24 }}>
                <div className="dim" style={{ fontSize: 11, fontFamily: "var(--mono)", textTransform: "uppercase", marginBottom: 8, color: "#67e8f9" }}>
                  Anchored to 0G Storage
                </div>
                <div style={{ fontFamily: "var(--mono)", fontSize: 13, wordBreak: "break-all", color: "rgba(255,255,255,0.8)" }}>
                  rootHash: {rootHash}
                </div>
                {storageTxHash && (
                  <a
                    href={`https://chainscan-galileo.0g.ai/tx/${storageTxHash}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: "#67e8f9", fontSize: 12, marginTop: 8, display: "inline-block" }}
                  >
                    View storage tx →
                  </a>
                )}
                <button
                  onClick={handleMint}
                  disabled={busy !== null || !wallet.address}
                  className="btn-grad"
                  style={{
                    marginTop: 12,
                    marginLeft: 8,
                    background: "linear-gradient(135deg, #d946ef, #ec4899)",
                    opacity: (busy !== null || !wallet.address) ? 0.4 : 1,
                  }}
                >
                  {busy === "minting" ? "Minting…" : !wallet.address ? "🔌 Connect wallet to mint" : "⛓️ Mint iNFT (0.001 0G)"}
                </button>
              </div>
            )}

            {/* Mint success */}
            {mintedTokenId && (
              <div className="preview-card success" style={{ marginTop: 24 }}>
                <div style={{ color: "#6ee7b7", fontWeight: 700 }}>🎉 iNFT #{mintedTokenId} minted!</div>
                <div className="dim" style={{ fontSize: 14, marginTop: 6 }}>
                  View it:{" "}
                  <Link href={`/agent/${mintedTokenId}`} style={{ color: "#c4b5fd" }}>
                    /agent/{mintedTokenId}
                  </Link>
                </div>
              </div>
            )}

            {/* Logs */}
            {logs.length > 0 && (
              <div className="log-box" style={{ marginTop: 24 }}>
                {logs.map((l, i) => (
                  <div key={i} className={
                    l.kind === "success" ? "log-success" :
                    l.kind === "error" ? "log-error" :
                    "log-info"
                  }>
                    <span style={{ color: "rgba(255,255,255,0.3)" }}>[{l.ts}]</span> {l.msg}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="footer-wrap">
        <div style={{ marginBottom: 8 }}>
          Built on{" "}
          <a href="https://0g.ai" target="_blank" rel="noreferrer">0G</a>
          {" "}· Galileo Testnet · Contract{" "}
          <a
            href={`https://chainscan-galileo.0g.ai/address/${AGENTMINT_ADDRESS}`}
            target="_blank"
            rel="noreferrer"
            style={{ fontFamily: "var(--mono)" }}
          >
            {AGENTMINT_ADDRESS.slice(0, 8)}…{AGENTMINT_ADDRESS.slice(-6)}
          </a>
        </div>
        <div>AgentMint · Zero Cup 2026 · 0G Vibe Coding Tournament</div>
      </footer>
    </div>
  );
}
