import { NextRequest, NextResponse } from "next/server";
import { getAgent, getReadOnlyContract } from "@/lib/contract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const tokenId = parseInt(params.id, 10);
    if (!Number.isFinite(tokenId) || tokenId < 1) {
      return NextResponse.json({ error: "Invalid token id" }, { status: 400 });
    }
    const agent = await getAgent(tokenId);

    // Also fetch the iNFT contract name + symbol for display
    let contractName = "AgentMint iNFT";
    let contractSymbol = "AGENTMINT";
    try {
      const c = getReadOnlyContract();
      contractName = await c.name();
      contractSymbol = await c.symbol();
    } catch {
      /* ignore */
    }

    return NextResponse.json({ agent, contractName, contractSymbol });
  } catch (e: any) {
    console.error("agent error:", e);
    // Try to map nonexistent token error to 404
    const msg = e?.shortMessage || e?.message || "Failed to fetch agent";
    const isNotFound = /nonexistent|ERC721NonexistentToken|not exist/i.test(msg);
    return NextResponse.json({ error: msg }, { status: isNotFound ? 404 : 500 });
  }
}
