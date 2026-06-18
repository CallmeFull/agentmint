import { NextRequest, NextResponse } from "next/server";
import { uploadPersonality } from "@/lib/0g";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Allow a bit longer for storage upload + on-chain log entry
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const personality = body?.personality;

    if (!personality || typeof personality !== "object") {
      return NextResponse.json({ error: "personality object is required" }, { status: 400 });
    }
    const required = ["name", "systemPrompt"];
    for (const k of required) {
      if (!personality[k]) {
        return NextResponse.json({ error: `personality.${k} is required` }, { status: 400 });
      }
    }

    const result = await uploadPersonality(personality);
    return NextResponse.json(result);
  } catch (e: any) {
    console.error("upload-personality error:", e);
    return NextResponse.json(
      { error: e?.message || "Internal error uploading personality" },
      { status: 500 },
    );
  }
}
