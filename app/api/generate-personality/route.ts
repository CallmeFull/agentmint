import { NextRequest, NextResponse } from "next/server";
import { generatePersonality } from "@/lib/0g";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const description = String(body?.description || "").trim();
    const model = body?.model ? String(body.model) : undefined;

    if (!description) {
      return NextResponse.json({ error: "description is required" }, { status: 400 });
    }
    if (description.length > 2000) {
      return NextResponse.json({ error: "description too long (max 2000 chars)" }, { status: 400 });
    }

    const personality = await generatePersonality(description, model);
    return NextResponse.json({ personality });
  } catch (e: any) {
    console.error("generate-personality error:", e);
    return NextResponse.json(
      { error: e?.message || "Internal error generating personality" },
      { status: 500 },
    );
  }
}
