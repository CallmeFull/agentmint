import { NextRequest, NextResponse } from "next/server";
import { chatWithAgent, fetchPersonality, type ChatMessage } from "@/lib/0g";
import { parseTokenURI } from "@/lib/contract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rootHash: string | undefined = body?.rootHash;
    const tokenURI: string | undefined = body?.tokenURI;
    const personality = body?.personality; // optional override
    const history = Array.isArray(body?.history) ? body.history : [];
    const model: string | undefined = body?.model;

    let p = personality;
    if (!p) {
      // Resolve rootHash from tokenURI or direct rootHash
      let rh: string | null = null;
      if (rootHash && typeof rootHash === "string") rh = rootHash;
      else if (tokenURI && typeof tokenURI === "string") rh = parseTokenURI(tokenURI);
      if (!rh) {
        return NextResponse.json(
          { error: "Either rootHash, tokenURI, or personality must be provided" },
          { status: 400 },
        );
      }
      p = await fetchPersonality(rh);
    }

    // Sanitize history — only allow user/assistant roles, no embedded system
    const safeHistory: ChatMessage[] = history
      .filter(
        (m: any) =>
          m &&
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string" &&
          m.content.length < 4000,
      )
      .slice(-20); // last 20 turns max

    const result = await chatWithAgent(p, safeHistory, model);
    return NextResponse.json(result);
  } catch (e: any) {
    console.error("chat error:", e);
    return NextResponse.json(
      { error: e?.message || "Internal error during chat" },
      { status: 500 },
    );
  }
}
