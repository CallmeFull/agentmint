import { NextRequest, NextResponse } from "next/server";
import { fetchPersonality } from "@/lib/0g";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const rootHash = url.searchParams.get("rootHash");
    if (!rootHash) {
      return NextResponse.json({ error: "rootHash query param is required" }, { status: 400 });
    }
    const personality = await fetchPersonality(rootHash);
    return NextResponse.json({ personality });
  } catch (e: any) {
    console.error("personality fetch error:", e);
    return NextResponse.json(
      { error: e?.message || "Failed to fetch personality" },
      { status: 500 },
    );
  }
}
