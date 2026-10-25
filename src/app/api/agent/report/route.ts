import { NextRequest, NextResponse } from "next/server";
import { appendLog, normalizeSource } from "@/lib/agent/ops";

export const dynamic = "force-dynamic";

/** Agent tool: file a shift report / incident note to the lab feed. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const title = String(body.title ?? "").trim().slice(0, 140);
  const text = String(body.body ?? body.text ?? "").trim().slice(0, 4000);
  if (!title || !text) {
    return NextResponse.json({ ok: false, error: "title and body are required" }, { status: 400 });
  }
  const severity = body.severity === "critical" || body.severity === "warn" ? body.severity : "info";
  const entry = appendLog({ source: normalizeSource(body.source), kind: "report", title, body: text, severity });
  return NextResponse.json({ ok: true, id: entry.id });
}
