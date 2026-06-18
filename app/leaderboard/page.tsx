"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Agent {
  tokenId: number;
  creator: string;
  owner: string;
  tokenURI: string;
  personalityHash: string;
  summonCount: number;
}

interface Personality {
  name: string;
  description: string;
  traits?: string[];
}

export default function LeaderboardPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [personalities, setPersonalities] = useState<Record<number, Personality>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/agents?limit=100&sort=summons");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load agents");
        if (cancelled) return;
        setAgents(data.agents || []);
        const toLoad = (data.agents || []).slice(0, 25);
        for (const a of toLoad) {
          try {
            const r = await fetch(
              `/api/personality?rootHash=${encodeURIComponent(a.personalityHash)}`,
            );
            if (r.ok) {
              const pd = await r.json();
              if (!cancelled) {
                setPersonalities((p) => ({ ...p, [a.tokenId]: pd.personality }));
              }
            }
          } catch {
            /* ignore */
          }
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="stack-lg">
      <header className="hero">
        <h1 className="h1">
          <span className="accent">Leaderboard</span>
        </h1>
        <p className="lede">Most-summoned iNFTs on 0G Galileo testnet.</p>
      </header>

      {loading && (
        <div className="card">
          <span className="spinner" /> loading…
        </div>
      )}
      {error && (
        <div className="card glow">
          <div className="card-title">Error</div>
          <div>{error}</div>
        </div>
      )}

      {!loading && agents.length === 0 && (
        <div className="card glow">
          <div className="card-title">No agents yet</div>
          <p className="muted">Mint and summon some iNFTs to populate the leaderboard.</p>
        </div>
      )}

      {agents.length > 0 && (
        <div className="stack-sm">
          {agents.map((a, i) => {
            const p = personalities[a.tokenId];
            const rank = i + 1;
            return (
              <Link
                key={a.tokenId}
                href={`/agent/${a.tokenId}`}
                className="agent-card"
                style={{
                  textDecoration: "none",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 16,
                }}
              >
                <div
                  style={{
                    minWidth: 44,
                    height: 44,
                    borderRadius: 8,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: 18,
                    color: rank <= 3 ? "var(--accent)" : "var(--fg-dim)",
                    border: "1px solid var(--border-bright)",
                  }}
                >
                  #{rank}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="agent-name">
                    {p?.name || `Agent #${a.tokenId}`}{" "}
                    <span className="dim" style={{ fontWeight: 400, fontSize: 12 }}>
                      #{a.tokenId}
                    </span>
                  </div>
                  <div className="agent-desc">
                    {p?.description || "Personality metadata loading…"}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: "var(--accent)" }}>
                    {a.summonCount}
                  </div>
                  <div className="dim" style={{ fontSize: 11, textTransform: "uppercase" }}>
                    summons
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
