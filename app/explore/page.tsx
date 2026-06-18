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

export default function ExplorePage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [total, setTotal] = useState(0);
  const [personalities, setPersonalities] = useState<Record<number, Personality>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/agents?limit=100&sort=newest");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load agents");
        if (cancelled) return;
        setAgents(data.agents || []);
        setTotal(data.total || 0);

        // Lazy-load personalities for the first 12 (don't block UI)
        const toLoad = (data.agents || []).slice(0, 12);
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
          Explore <span className="accent">iNFTs</span>
        </h1>
        <p className="lede">
          {total > 0
            ? `${total} intelligent agent${total === 1 ? "" : "s"} minted on 0G Galileo testnet.`
            : "No iNFTs minted yet. Be the first on the mint page."}
        </p>
      </header>

      {loading && (
        <div className="card">
          <span className="spinner" /> loading agents from 0G…
        </div>
      )}
      {error && (
        <div className="card glow">
          <div className="card-title">Error</div>
          <div>{error}</div>
        </div>
      )}

      {!loading && !error && agents.length === 0 && (
        <div className="card glow">
          <div className="card-title">No iNFTs yet</div>
          <p className="muted">
            Mint your first agent on the{" "}
            <Link href="/" className="linkish">
              mint page
            </Link>
            .
          </p>
        </div>
      )}

      {agents.length > 0 && (
        <div className="grid">
          {agents.map((a) => {
            const p = personalities[a.tokenId];
            return (
              <Link
                key={a.tokenId}
                href={`/agent/${a.tokenId}`}
                className="agent-card"
                style={{ textDecoration: "none" }}
              >
                <div className="agent-id">iNFT #{a.tokenId}</div>
                <div className="agent-name">{p?.name || `Agent #${a.tokenId}`}</div>
                <div className="agent-desc">
                  {p?.description || "Personality metadata loading…"}
                </div>
                <div className="agent-meta">
                  <span className="pill accent">⏚ {a.summonCount}</span>
                  {p?.traits?.slice(0, 2).map((t, i) => (
                    <span key={i} className="pill">
                      {t}
                    </span>
                  ))}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
