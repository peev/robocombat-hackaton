import { NextRequest, NextResponse } from "next/server";
import {
  getNemoStatus,
  handleDiscordStyleCommand,
  REQUIRED_ENV,
} from "@/lib/nemo/integration";

export const dynamic = "force-dynamic";

export async function GET() {
  const status = await getNemoStatus();
  return NextResponse.json({
    integration: "prepared",
    complete: false,
    reason:
      "Discord round-trip not tested without credentials. Never hardcode secrets.",
    requiredEnv: REQUIRED_ENV,
    status,
  });
}

/** Simulate inbound Discord message handling (same path OpenClaw would call). */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const text = String(body.content ?? body.message ?? "");
  if (!text) {
    return NextResponse.json({ ok: false, error: "Missing message content" }, { status: 400 });
  }

  const status = await getNemoStatus();
  const result = await handleDiscordStyleCommand(text);

  return NextResponse.json({
    ...result,
    discordConfigured: status.discordConfigured,
    testedDiscordRoundTrip: false,
    note: status.discordConfigured
      ? "Credentials present but live Discord gateway not connected in this process — command executed locally."
      : "Credentials missing — command executed via local API only. Set DISCORD_BOT_TOKEN and DISCORD_CHANNEL_ID.",
  });
}
