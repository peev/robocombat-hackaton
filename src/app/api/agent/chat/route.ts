import { NextRequest, NextResponse } from "next/server";
import { appendLog, chatWithAgent } from "@/lib/agent/ops";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Relay a chat message from the dashboard to the OpenClaw agent. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const message = String(body.message ?? "").trim().slice(0, 2000);
  if (!message) return NextResponse.json({ ok: false, error: "message required" }, { status: 400 });
  appendLog({ source: "ui", kind: "chat", title: "Operator", body: message });
  const started = Date.now();
  try {
    const reply = await chatWithAgent(message);
    appendLog({ source: "openclaw-chat", kind: "chat", title: "BlackBox (OpenClaw)", body: reply.slice(0, 4000) });
    return NextResponse.json({ ok: true, reply, latencyMs: Date.now() - started });
  } catch (e) {
    const error = e instanceof Error ? e.message : "agent call failed";
    return NextResponse.json({ ok: false, error }, { status: 502 });
  }
}
