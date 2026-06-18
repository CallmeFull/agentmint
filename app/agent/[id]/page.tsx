"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ethers } from "ethers";
import { useWallet } from "@/app/providers";
import { AGENTMINT_ABI } from "@/lib/abis";
import { AGENTMINT_ADDRESS, RARITY_TIERS, RARITY_COLORS, MOOD_LABELS } from "@/lib/contract";

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

interface AgentData {
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

interface ChatTurn {
  role: "user" | "assistant" | "system";
  content: string;
}

interface Milestone {
  chatsRequired: number;
  name: string;
  ability: string;
}

const MS_DEFS = [
  { chatsRequired: 0,   name: "Initiate", ability: "speaks plainly" },
  { chatsRequired: 5,   name: "Curious",  ability: "asks deeper questions" },
  { chatsRequired: 15,  name: "Wise",     ability: "offers unexpected insights" },
  { chatsRequired: 40,  name: "Ancient",  ability: "references shared memory" },
  { chatsRequired: 100, name: "Mythic",   ability: "speaks in riddles and prophecy" },
];

function nextMilestone(chats: number): Milestone | null {
  for (const m of MS_DEFS) {
    if (m.chatsRequired > chats) return m;
  }
  return null;
}

export default function AgentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id ? String(params.id) : "";
  const wallet = useWallet();

  const [agent, setAgent] = useState<AgentData | null>(null);
  const [personality, setPersonality] = useState<Personality | null>(null);
  const [contractName, setContractName] = useState("AgentMint iNFT");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [chat, setChat] = useState<ChatTurn[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [summonBusy, setSummonBusy] = useState(false);
  const [summonTx, setSummonTx] = useState<string | null>(null);
  const [voteBusy, setVoteBusy] = useState<null | "up" | "down">(null);
  const [voteTx, setVoteTx] = useState<string | null>(null);
  const [levelUpToast, setLevelUpToast] = useState<string | null>(null);

  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chat]);

  // Initial load
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      setAgent(null);
      setPersonality(null);
      setChat([]);
      try {
        const aRes = await fetch(`/api/agent/${id}`);
        const aData = await aRes.json();
        if (!aRes.ok) throw new Error(aData.error || "Failed to load agent");
        if (cancelled) return;
        setAgent(aData.agent);
        if (aData.contractName) setContractName(aData.contractName);

        const ppRes = await fetch(
          `/api/personality?rootHash=${encodeURIComponent(aData.agent.personalityHash)}`,
        );
        let pp: Personality | null = null;
        if (ppRes.ok) {
          const ppData = await ppRes.json();
          pp = ppData.personality;
          if (!cancelled) setPersonality(pp);
        }

        // Initial greeting
        const greet = pp?.greeting || "Greetings, traveler.";
        setChat([{ role: "assistant", content: greet }]);
      } catch (e: any) {
        if (!cancelled) setLoadError(e.message || "Load failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function refreshAgentData() {
    try {
      const aRes = await fetch(`/api/agent/${id}`);
      const aData = await aRes.json();
      if (aRes.ok) setAgent(aData.agent);
    } catch {
      /* ignore */
    }
  }

  async function handleChat() {
    if (!chatInput.trim() || !agent) return;
    const userMsg = chatInput.trim();
    setChatInput("");
    setChat((c) => [...c, { role: "user", content: userMsg }]);
    setChatBusy(true);
    setChatError(null);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rootHash: agent.personalityHash,
          history: chat.concat({ role: "user", content: userMsg }),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Chat failed");
      setChat((c) => [...c, { role: "assistant", content: data.reply }]);
      // Refresh on-chain data — chat may have triggered a level up
      refreshAgentData();
    } catch (e: any) {
      setChatError(e.message || "Chat error");
    } finally {
      setChatBusy(false);
    }
  }

  async function handleSummon() {
    if (!wallet.address) {
      alert("Connect wallet first");
      return;
    }
    setSummonBusy(true);
    setSummonTx(null);
    try {
      const chainOk = await wallet.ensureCorrectChain();
      if (!chainOk) throw new Error("Could not switch to 0G Galileo testnet");
      const signer = await wallet.getSigner();
      if (!signer) throw new Error("No signer available");

      const c = new ethers.Contract(AGENTMINT_ADDRESS, AGENTMINT_ABI as any, signer);
      const tx = await c.recordSummon(id);
      setSummonTx(tx.hash);
      const receipt = await tx.wait();

      // Check for level up
      const iface = c.interface;
      for (const lg of receipt.logs) {
        try {
          const parsed = iface.parseLog(lg);
          if (parsed?.name === "AgentLeveledUp") {
            setLevelUpToast(
              `🎉 ${personality?.name || "Agent"} reached Level ${parsed.args.newLevel}! (${parsed.args.milestone})`,
            );
            setTimeout(() => setLevelUpToast(null), 6000);
            break;
          }
        } catch {
          /* not our log */
        }
      }
      refreshAgentData();
    } catch (e: any) {
      alert(`Summon failed: ${e.shortMessage || e.message}`);
    } finally {
      setSummonBusy(false);
    }
  }

  async function handleVote(positive: boolean) {
    if (!wallet.address) {
      alert("Connect wallet first");
      return;
    }
    setVoteBusy(positive ? "up" : "down");
    setVoteTx(null);
    try {
      const chainOk = await wallet.ensureCorrectChain();
      if (!chainOk) throw new Error("Could not switch to 0G Galileo testnet");
      const signer = await wallet.getSigner();
      if (!signer) throw new Error("No signer available");

      const c = new ethers.Contract(AGENTMINT_ADDRESS, AGENTMINT_ABI as any, signer);
      const tx = await c.vote(id, positive);
      setVoteTx(tx.hash);
      await tx.wait();
      refreshAgentData();
    } catch (e: any) {
      alert(`Vote failed: ${e.shortMessage || e.message}`);
    } finally {
      setVoteBusy(null);
    }
  }

  if (loading) {
    return (
      <div className="stack">
        <div className="card">Loading iNFT #{id}…</div>
      </div>
    );
  }
  if (loadError) {
    return (
      <div className="stack">
        <div className="card error">Error: {loadError}</div>
        <Link href="/">← back home</Link>
      </div>
    );
  }
  if (!agent) return null;

  const next = nextMilestone(agent.summonCount);
  const progressToNext = next
    ? Math.min(100, (agent.summonCount / next.chatsRequired) * 100)
    : 100;
  const rarityColor = RARITY_COLORS[agent.rarity] || "#888";
  const rarityName = RARITY_TIERS[agent.rarity] || "Common";
  const moodLabel = MOOD_LABELS[agent.mood] || "Neutral";

  return (
    <div className="stack-lg">
      <header className="hero">
        <div className="row" style={{ alignItems: "baseline" }}>
          <h1 className="h1" style={{ marginBottom: 0 }}>
            {personality?.name || `iNFT #${id}`}
          </h1>
          <span
            className="pill"
            style={{
              background: rarityColor,
              color: "#000",
              fontWeight: 700,
              fontSize: 12,
              letterSpacing: 0.5,
            }}
          >
            {rarityName}
          </span>
        </div>
        <p className="lede" style={{ marginTop: 8 }}>
          {personality?.description ||
            "A minted AI agent on 0G. Chat to evolve its level and milestone."}
        </p>
      </header>

      {levelUpToast && (
        <div
          className="card glow"
          style={{ borderColor: "var(--accent)", background: "rgba(250, 204, 21, 0.08)" }}
        >
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--accent)" }}>
            {levelUpToast}
          </div>
        </div>
      )}

      <div className="two-col">
        <div className="stack">
          {/* Evolution card */}
          <div className="card glow">
            <div className="card-title">Evolution</div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr 1fr",
                gap: 12,
                marginBottom: 12,
              }}
            >
              <Stat label="Level" value={agent.level.toString()} accent />
              <Stat label="Chats" value={agent.summonCount.toString()} />
              <Stat
                label="Milestone"
                value={agent.milestoneName}
                accent2
              />
              <Stat label="Score" value={agent.score > 0 ? `+${agent.score}` : `${agent.score}`} />
            </div>

            {/* XP bar */}
            <div style={{ marginTop: 4 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 11,
                  color: "var(--fg-dim)",
                  marginBottom: 4,
                }}
              >
                <span>
                  {next
                    ? `${agent.summonCount} / ${next.chatsRequired} chats to ${next.name}`
                    : "Mythic — max milestone reached"}
                </span>
                <span>{Math.floor(progressToNext)}%</span>
              </div>
              <div
                style={{
                  height: 8,
                  background: "var(--bg-elev)",
                  borderRadius: 4,
                  overflow: "hidden",
                  border: "1px solid var(--border)",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${progressToNext}%`,
                    background: "linear-gradient(90deg, var(--accent), #fb7185)",
                    transition: "width 0.4s ease",
                  }}
                />
              </div>
            </div>

            {/* Milestone ability */}
            <div
              style={{
                marginTop: 14,
                padding: 10,
                background: "var(--bg-elev)",
                borderRadius: 6,
                fontSize: 12,
                color: "var(--fg-dim)",
              }}
            >
              <span style={{ color: "var(--accent)" }}>✦ {agent.milestoneName}:</span>{" "}
              {agent.milestoneAbility}
            </div>

            {/* Actions */}
            <div className="row mt-16" style={{ flexWrap: "wrap" }}>
              <button
                className="primary"
                onClick={handleSummon}
                disabled={summonBusy || !wallet.address}
              >
                {summonBusy ? <><span className="spinner" /> Summoning…</> : "↑ Record Summon (+1 chat)"}
              </button>
              <button
                className="ghost"
                onClick={() => handleVote(true)}
                disabled={voteBusy !== null || !wallet.address}
                title="Upvote"
              >
                {voteBusy === "up" ? <span className="spinner" /> : "👍"}
              </button>
              <button
                className="ghost"
                onClick={() => handleVote(false)}
                disabled={voteBusy !== null || !wallet.address}
                title="Downvote"
              >
                {voteBusy === "down" ? <span className="spinner" /> : "👎"}
              </button>
            </div>
            {summonTx && (
              <div style={{ fontSize: 11, color: "var(--fg-dim)", marginTop: 8 }}>
                Summon tx:{" "}
                <a
                  href={`https://chainscan-galileo.0g.ai/tx/${summonTx}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mono-addr"
                >
                  {summonTx.slice(0, 18)}…
                </a>
              </div>
            )}
            {voteTx && (
              <div style={{ fontSize: 11, color: "var(--fg-dim)", marginTop: 4 }}>
                Vote tx:{" "}
                <a
                  href={`https://chainscan-galileo.0g.ai/tx/${voteTx}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mono-addr"
                >
                  {voteTx.slice(0, 18)}…
                </a>
              </div>
            )}
          </div>

          {/* Personality */}
          {personality && (
            <div className="card">
              <div className="card-title">Personality</div>
              <div className="field">
                <div className="field-label">Traits</div>
                <div className="traits">
                  {personality.traits?.map((t, i) => (
                    <span key={i} className="pill accent">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <div className="field">
                <div className="field-label">Voice</div>
                <div className="field-value">{personality.voice}</div>
              </div>
              <div className="field">
                <div className="field-label">System prompt</div>
                <div
                  className="field-value"
                  style={{ fontSize: 12, maxHeight: 140, overflow: "auto" }}
                >
                  {personality.systemPrompt}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="stack">
          {/* Chat */}
          <div className="card" style={{ minHeight: 480 }}>
            <div className="card-title">
              Chat{" "}
              <span
                style={{ fontSize: 11, color: "var(--fg-dim)", fontWeight: 400, marginLeft: 6 }}
              >
                (mood: {moodLabel})
              </span>
            </div>
            <div
              ref={chatScrollRef}
              style={{
                height: 360,
                overflowY: "auto",
                background: "var(--bg-elev)",
                borderRadius: 6,
                padding: 12,
                fontSize: 13,
                lineHeight: 1.6,
              }}
            >
              {chat.map((turn, i) => (
                <div
                  key={i}
                  style={{
                    marginBottom: 10,
                    color:
                      turn.role === "user" ? "var(--accent)" : "var(--fg)",
                    fontStyle: turn.role === "user" ? "normal" : "italic",
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      color: "var(--fg-dim)",
                      marginBottom: 2,
                      fontStyle: "normal",
                    }}
                  >
                    {turn.role === "user" ? "→ you" : "← agent"}
                  </div>
                  <div>{turn.content}</div>
                </div>
              ))}
            </div>
            <div className="row mt-8">
              <input
                style={{ flex: 1 }}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleChat();
                  }
                }}
                placeholder="Type a message…"
                disabled={chatBusy}
              />
              <button
                className="primary"
                onClick={handleChat}
                disabled={chatBusy || !chatInput.trim()}
              >
                {chatBusy ? <span className="spinner" /> : "Send"}
              </button>
            </div>
            {chatError && (
              <div style={{ fontSize: 12, color: "var(--error)", marginTop: 6 }}>
                {chatError}
              </div>
            )}
          </div>

          {/* On-chain details */}
          <div className="card">
            <div className="card-title">On-chain</div>
            <div className="field">
              <div className="field-label">Contract</div>
              <a
                href={`https://chainscan-galileo.0g.ai/address/${AGENTMINT_ADDRESS}`}
                target="_blank"
                rel="noreferrer"
                className="mono-addr"
              >
                {contractName} — {AGENTMINT_ADDRESS}
              </a>
            </div>
            <div className="field">
              <div className="field-label">Token ID</div>
              <div className="mono-addr">#{id}</div>
            </div>
            <div className="field">
              <div className="field-label">Personality Hash</div>
              <div className="mono-addr">{agent.personalityHash}</div>
            </div>
            <div className="field">
              <div className="field-label">Token URI</div>
              <div className="mono-addr">{agent.tokenURI}</div>
            </div>
            <div className="field">
              <div className="field-label">Owner</div>
              <div className="mono-addr">{agent.owner}</div>
            </div>
            <div className="field">
              <div className="field-label">Creator</div>
              <div className="mono-addr">{agent.creator}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  accent2,
}: {
  label: string;
  value: string;
  accent?: boolean;
  accent2?: boolean;
}) {
  return (
    <div
      style={{
        background: "var(--bg-elev)",
        borderRadius: 6,
        padding: 10,
        border: "1px solid var(--border)",
      }}
    >
      <div style={{ fontSize: 10, color: "var(--fg-dim)", marginBottom: 2, letterSpacing: 0.5 }}>
        {label.toUpperCase()}
      </div>
      <div
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: accent ? "var(--accent)" : accent2 ? "#fb7185" : "var(--fg)",
        }}
      >
        {value}
      </div>
    </div>
  );
}
