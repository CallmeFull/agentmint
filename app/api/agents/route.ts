import { NextRequest, NextResponse } from "next/server";
import { listAllAgents } from "@/lib/0g";
import { getTotalMinted } from "@/lib/contract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10) || 50, 200);
    const sort = url.searchParams.get("sort") || "newest";

    const [total, all] = await Promise.all([getTotalMinted(), listAllAgents(limit)]);

    let sorted = all;
    if (sort === "summons") {
      sorted = [...all].sort((a, b) => b.summonCount - a.summonCount);
    } else if (sort === "summons_asc") {
      sorted = [...all].sort((a, b) => a.summonCount - b.summonCount);
    }

    return NextResponse.json({ total, agents: sorted });
  } catch (e: any) {
    console.error("agents error:", e);
    return NextResponse.json(
      { error: e?.message || "Failed to list agents" },
      { status: 500 },
    );
  }
}
