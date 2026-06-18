"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ethers } from "ethers";
import { useWallet } from "@/app/providers";
import { AGENTMINT_ABI } from "@/lib/abis";
import { AGENTMINT_ADDRESS, MINT_PRICE } from "@/lib/contract";

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
}

interface ChatTurn {
  role: "user" | "assistant" | "system";
  content: string;
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

  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Load agent + personality
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
        // 1. Get agent data from chain
        const aRes = await fetch(`/api/agent/${id}`);
        const aData = await aRes.json();
        if (!aRes.ok) throw new Error(aData.error || "Failed to load agent");
        if (cancelled) return;
        setAgent(aData.agent);
        if (aData.contractName) setContractName(aData.contractName);

        // 2. Fetch personality from 0G Storage via API
        const pRes = await fetch(`/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rootHash: aData.agent.personalityHash,
            history: [],
          }),
        });
        // That call also fetches personality for the chat — but we want to display it first.
        // Let's fetch the personality via a dedicated approach: chat endpoint returns a reply;
        // for display-only, we hit a small endpoint that returns personality only.
        const ppRes = await fetch(
          `/api/personality?rootHash=${encodeURIComponent(aData.agent.personalityHash)}`,
        );
        if (ppRes.ok) {
          const ppData = await ppRes.json();
          if (!cancelled) setPersonality(ppData.personality);
        }

        // 3. Initial greeting
        setChat([
          {
            role: "assistant",
            content:
              ppRes.ok && personality
                ? (personality as Personality).greeting
                : aData.agent.personalityHash
                  ? "Hello. (Personality metadata still loading…)"
                  : "Hello.",
          },
        ]);
      } catch (e: any) {
        if (!cancelled) setLoadError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chat, chatBusy]);

  async function sendChat() {
    if (!chatInput.trim() || !personality) return;
    const userMsg: ChatTurn = { role: "user", content: chatInput.trim() };
    const newHistory = chat.filter((c) => c.role !== "system").concat(userMsg);
    setChat((c) => [...c, userMsg]);
    setChatInput("");
    setChatBusy(true);
    setChatError(null);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rootHash: agent?.personalityHash,
          history: newHistory,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Chat failed");
      setChat((c) => [...c, { role: "assistant", content: data.reply }]);
    } catch (e: any) {
      setChatError(e.message);
      setChat((c) => [...c, { role: "system", content: `Error: ${e.message}` }]);
    } finally {
      setChatBusy(false);
    }
  }

  async function recordSummon() {
    if (!wallet.address) {
      setChatError("Connect wallet to record summon on-chain");
      return;
    }
    setSummonBusy(true);
    setChatError(null);
    try {
      const chainOk = await wallet.ensureCorrectChain();
      if (!chainOk) throw new Error("Could not switch to 0G Galileo testnet");
      const signer = await wallet.getSigner();
      if (!signer) throw new Error("No signer");
      const c = new ethers.Contract(AGENTMINT_ADDRESS, AGENTMINT_ABI as any, signer);
      const tx = await c.recordSummon(id);
      setSummonTx(tx.hash);
      await tx.wait();
      // Refresh summon count
      const aRes = await fetch(`/api/agent/${id}`);
      if (aRes.ok) {
        const aData = await aRes.json();
        setAgent(aData.agent);
      }
    } catch (e: any) {
      setChatError(e.shortMessage || e.message);
    } finally {
      setSummonBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="card">
        <div className="row">
          <span className="spinner" />
          <span className="muted">Loading iNFT #{id} from 0G…</span>
        </div>
      </div>
    );
  }

  if (loadError || !agent) {
    return (
      <div className="card glow">
        <div className="card-title">Error</div>
        <p>{loadError || "Agent not found"}</p>
        <div className="row mt-16">
          <button onClick={() => router.push("/explore")}>← back to explore</button>
        </div>
      </div>
    );
  }

  const ownerIsMe =
    wallet.address && agent.owner.toLowerCase() === wallet.address.toLowerCase();

  return (
    <div className="stack-lg">
      <div className="row-between">
        <div>
          <Link href="/explore" className="dim">
            ← explore
          </Link>
          <h1 className="h2" style={{ marginTop: 8 }}>
            {personality?.name || `iNFT #${id}`}
            <span className="muted" style={{ fontWeight: 400, marginLeft: 8, fontSize: 16 }}>
              #{id}
            </span>
          </h1>
          {personality?.description && (
            <p className="muted" style={{ maxWidth: 720 }}>
              {personality.description}
            </p>
          )}
        </div>
        <div className="row" style={{ flexShrink: 0 }}>
          <span className="pill accent">iNFT</span>
          {personality?.traits?.slice(0, 3).map((t, i) => (
            <span key={i} className="pill">
              {t}
            </span>
          ))}
        </div>
      </div>

      <div className="two-col">
        <div className="stack">
          <div className="card">
            <div className="card-title">On-chain metadata</div>
            <div className="stack-sm">
              <KV k="Contract" v={
                <a
                  href={`https://chainscan-galileo.0g.ai/address/${AGENTMINT_ADDRESS}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mono-addr"
                >
                  {AGENTMINT_ADDRESS}
                </a>
              } />
              <KV k="Collection" v={`${contractName}`} />
              <KV k="Token ID" v={`#${id}`} />
              <KV k="Creator" v={
                <a
                  href={`https://chainscan-galileo.0g.ai/address/${agent.creator}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mono-addr"
                >
                  {agent.creator}
                </a>
              } />
              <KV k="Owner" v={
                <span>
                  <a
                    href={`https://chainscan-galileo.0g.ai/address/${agent.owner}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mono-addr"
                  >
                    {agent.owner}
                  </a>
                  {ownerIsMe && <span className="pill accent" style={{ marginLeft: 8 }}>you</span>}
                </span>
              } />
              <KV k="Personality Hash" v={
                <span className="mono-addr" title={agent.personalityHash}>
                  {agent.personalityHash.slice(0, 22)}…{agent.personalityHash.slice(-8)}
                </span>
              } />
              <KV k="tokenURI" v={
                <span className="mono-addr" title={agent.tokenURI}>
                  {agent.tokenURI}
                </span>
              } />
              <KV k="Summon Count" v={`${agent.summonCount}×`} />
            </div>
            <div className="row mt-16">
              <button
                className="primary"
                onClick={recordSummon}
                disabled={summonBusy || !wallet.address}
              >
                {summonBusy ? (
                  <>
                    <span className="spinner" /> recording…
                  </>
                ) : (
                  "Record Summon (on-chain)"
                )}
              </button>
              {summonTx && (
                <a
                  className="mono-addr"
                  href={`https://chainscan-galileo.0g.ai/tx/${summonTx}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  tx: {summonTx.slice(0, 12)}…
                </a>
              )}
            </div>
          </div>

          {personality && (
            <div className="card">
              <div className="card-title">Personality (from 0G Storage)</div>
              <div className="personality-preview">
                {personality.voice && (
                  <div className="field">
                    <div className="field-label">Voice</div>
                    <div className="field-value">{personality.voice}</div>
                  </div>
                )}
                <div className="field">
                  <div className="field-label">System prompt</div>
                  <div
                    className="field-value"
                    style={{ fontSize: 13, maxHeight: 180, overflow: "auto" }}
                  >
                    {personality.systemPrompt}
                  </div>
                </div>
                {personality.avatarPrompt && (
                  <div className="field">
                    <div className="field-label">Avatar prompt</div>
                    <div className="field-value dim">{personality.avatarPrompt}</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="stack">
          <div className="card glow">
            <div className="card-title">
              Chat with iNFT #{id}
              <span className="dim" style={{ marginLeft: 8, textTransform: "none", letterSpacing: 0 }}>
                · powered by 0G Compute
              </span>
            </div>

            <div className="chat-window" ref={chatScrollRef}>
              {chat.length === 0 && (
                <div className="chat-msg system">
                  Start a conversation. The agent uses its personality as the system prompt.
                </div>
              )}
              {chat.map((m, i) => (
                <div key={i} className={`chat-msg ${m.role}`}>
                  {m.content}
                </div>
              ))}
              {chatBusy && (
                <div className="chat-msg assistant">
                  <span className="spinner" /> thinking on 0G Compute…
                </div>
              )}
            </div>

            <div className="chat-input-row">
              <input
                type="text"
                placeholder="Type a message…"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendChat();
                  }
                }}
                disabled={chatBusy || !personality}
              />
              <button
                className="primary"
                onClick={sendChat}
                disabled={chatBusy || !personality || !chatInput.trim()}
              >
                Send
              </button>
            </div>

            {chatError && (
              <div className="mt-8" style={{ color: "var(--danger)", fontSize: 13 }}>
                {chatError}
              </div>
            )}
            {!wallet.address && (
              <div className="mt-8 dim" style={{ fontSize: 13 }}>
                Note: anyone can chat. Recording a summon on-chain requires a connected wallet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "130px 1fr", gap: 12 }}>
      <div className="dim" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em" }}>
        {k}
      </div>
      <div style={{ minWidth: 0 }}>{v}</div>
    </div>
  );
}
