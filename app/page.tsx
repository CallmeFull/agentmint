"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ethers } from "ethers";
import { useWallet } from "./providers";
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

      // Extract tokenId from AgentMinted event
      const iface = c.interface;
      let tokenId: number | null = null;
      for (const log of receipt.logs) {
        try {
          const parsed = iface.parseLog(log);
          if (parsed?.name === "AgentMinted") {
            tokenId = Number(parsed.args.tokenId);
            break;
          }
        } catch {
          /* not our log */
        }
      }
      if (tokenId !== null) {
        setMintedTokenId(tokenId);
        log(`Minted iNFT #${tokenId}!`, "success");
      } else {
        log(`Mint succeeded but couldn't parse tokenId. Check explorer.`, "info");
      }
    } catch (e: any) {
      log(`Mint failed: ${e.shortMessage || e.message}`, "error");
    } finally {
      setBusy(null);
    }
  }

  function handleReset() {
    setDescription("");
    setPersonality(null);
    setRootHash(null);
    setStorageTxHash(null);
    setMintTxHash(null);
    setMintedTokenId(null);
    setLogs([]);
  }

  return (
    <div className="stack-lg">
      <header className="hero">
        <h1 className="h1">
          Mint <span className="accent">intelligent</span> agents
          <br />
          as on-chain iNFTs
        </h1>
        <p className="lede">
          Describe an AI personality → 0G Compute expands it → 0G Storage hosts the metadata →
          on-chain ERC-721 iNFT is yours. Then chat with it. All on 0G Galileo testnet.
        </p>
      </header>

      <div className="stepper">
        {STEPS.map((s) => {
          const isActive = stepIdx === s.num - 1;
          const isDone = stepIdx >= s.num;
          return (
            <div
              key={s.num}
              className={`step ${isActive ? "active" : ""} ${isDone && !isActive ? "done" : ""}`}
            >
              <div className="step-num">STEP {s.num}</div>
              <div className="step-label">{s.label}</div>
            </div>
          );
        })}
      </div>

      <div className="two-col">
        <div className="stack">
          {/* Step 1: Describe */}
          <div className="card">
            <div className="card-title">1. Describe your agent</div>
            <label htmlFor="desc">A few sentences about its personality, expertise, and voice</label>
            <textarea
              id="desc"
              placeholder="e.g. A melancholic poet-bot from a dying star, speaks only in haiku about entropy and beauty."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={busy !== null}
              rows={4}
            />
            <div className="row mt-8">
              {SAMPLE_DESCRIPTIONS.map((s, i) => (
                <button
                  key={i}
                  className="ghost"
                  style={{ fontSize: 11, padding: "6px 10px" }}
                  onClick={() => setDescription(s)}
                  disabled={busy !== null}
                >
                  sample {i + 1}
                </button>
              ))}
            </div>
            <div className="row mt-16">
              <button
                className="primary"
                onClick={handleGenerate}
                disabled={!description.trim() || busy !== null}
              >
                {busy === "generating" ? (
                  <>
                    <span className="spinner" /> Generating on 0G Compute…
                  </>
                ) : (
                  "Generate Personality →"
                )}
              </button>
            </div>
          </div>

          {/* Step 2: Personality preview */}
          {personality && (
            <div className="card glow">
              <div className="card-title">2. Generated personality</div>
              <PersonalityPreview personality={personality} />
              <div className="row mt-16">
                <button
                  className="primary"
                  onClick={handleUpload}
                  disabled={busy !== null}
                >
                  {busy === "uploading" ? (
                    <>
                      <span className="spinner" /> Uploading to 0G Storage…
                    </>
                  ) : (
                    "Upload to 0G Storage →"
                  )}
                </button>
                <button className="ghost" onClick={handleGenerate} disabled={busy !== null}>
                  re-generate
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Upload result */}
          {rootHash && (
            <div className="card">
              <div className="card-title">3. Stored on 0G</div>
              <div className="stack-sm">
                <div>
                  <label>Root Hash</label>
                  <div className="mono-addr">{rootHash}</div>
                </div>
                {storageTxHash && (
                  <div>
                    <label>Storage Tx</label>
                    <a
                      className="mono-addr"
                      href={`https://chainscan-galileo.0g.ai/tx/${storageTxHash}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {storageTxHash}
                    </a>
                  </div>
                )}
              </div>

              <div className="row mt-16">
                <button
                  className="primary"
                  onClick={handleMint}
                  disabled={busy !== null}
                >
                  {busy === "minting" ? (
                    <>
                      <span className="spinner" /> Minting iNFT…
                    </>
                  ) : !wallet.address ? (
                    "Connect wallet to mint"
                  ) : (
                    "Mint iNFT (0.001 0G) →"
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Mint success */}
          {mintedTokenId !== null && (
            <div className="card glow">
              <div className="card-title">4. ✓ iNFT minted</div>
              <div className="stack-sm">
                <div>
                  <label>Token ID</label>
                  <div className="mono-addr">#{mintedTokenId}</div>
                </div>
                <div>
                  <label>Contract</label>
                  <div className="mono-addr">{AGENTMINT_ADDRESS}</div>
                </div>
                {mintTxHash && (
                  <div>
                    <label>Mint Tx</label>
                    <a
                      className="mono-addr"
                      href={`https://chainscan-galileo.0g.ai/tx/${mintTxHash}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {mintTxHash}
                    </a>
                  </div>
                )}
              </div>
              <div className="row mt-16">
                <Link href={`/agent/${mintedTokenId}`} className="primary" style={{ textDecoration: "none" }}>
                  <button className="primary">Chat with your iNFT →</button>
                </Link>
                <button className="ghost" onClick={handleReset}>
                  mint another
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-title">Activity log</div>
            <div className="log">
              {logs.length === 0 ? (
                <div className="log-line">// no events yet</div>
              ) : (
                logs.map((l, i) => (
                  <div key={i} className={`log-line ${l.kind || ""}`}>
                    <span className="ts">{l.ts}</span>
                    {l.msg}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-title">What happens under the hood</div>
            <ol style={{ paddingLeft: 18, color: "var(--fg-dim)", fontSize: 13, lineHeight: 1.7 }}>
              <li>
                Your description is sent to{" "}
                <span className="pill info">0G Compute</span> (deepseek/qwen/gpt-oss via the
                router at <code>router-api.0g.ai/v1</code>) which expands it into a structured
                personality.
              </li>
              <li>
                The personality JSON is uploaded to{" "}
                <span className="pill info">0G Storage</span>, returning a Merkle root hash.
              </li>
              <li>
                The root hash is stored on-chain as a <code>bytes32</code> field via{" "}
                <code>AgentMint.mint(tokenURI, personalityHash)</code>, paying{" "}
                <code>0.001 0G</code>.
              </li>
              <li>
                Anyone can fetch the personality by root hash and chat with the agent using
                the system prompt as context.
              </li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}

function PersonalityPreview({ personality }: { personality: Personality }) {
  return (
    <div className="personality-preview">
      <div className="field">
        <div className="field-label">Name</div>
        <div className="field-value" style={{ fontSize: 20, fontWeight: 700 }}>
          {personality.name}
        </div>
      </div>
      <div className="field">
        <div className="field-label">Tagline</div>
        <div className="field-value">{personality.description}</div>
      </div>
      {personality.traits?.length > 0 && (
        <div className="field">
          <div className="field-label">Traits</div>
          <div className="traits">
            {personality.traits.map((t, i) => (
              <span key={i} className="pill accent">
                {t}
              </span>
            ))}
          </div>
        </div>
      )}
      <div className="field">
        <div className="field-label">Voice</div>
        <div className="field-value">{personality.voice}</div>
      </div>
      <div className="field">
        <div className="field-label">Greeting</div>
        <div className="field-value" style={{ color: "var(--accent)" }}>
          {personality.greeting}
        </div>
      </div>
      <div className="field">
        <div className="field-label">System prompt</div>
        <div className="field-value" style={{ fontSize: 13, maxHeight: 180, overflow: "auto" }}>
          {personality.systemPrompt}
        </div>
      </div>
    </div>
  );
}
