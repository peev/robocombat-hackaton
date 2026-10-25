/**
 * NemoClaw / OpenClaw / OpenShell integration layer.
 *
 * Official docs: https://docs.nvidia.com/nemoclaw/latest/user-guide/openclaw/get-started/quickstart
 *
 * This module does NOT invent NemoClaw CLI commands. It probes for installed
 * tooling and Discord credentials, and exposes a status API for the UI.
 * Discord message handling is prepared but not marked complete until a real
 * message round-trip is tested with credentials.
 */

import { execFile } from "child_process";
import { promisify } from "util";
import { runAutonomousEvaluation } from "@/lib/ai/evaluator";
import type { MissionId } from "@/lib/simulation/types";
import type { RobotId } from "@/lib/robots/profiles";

const execFileAsync = promisify(execFile);

export interface NemoStatus {
  nemoclawDetected: boolean;
  openclawDetected: boolean;
  openshellDetected: boolean;
  discordConfigured: boolean;
  localInferenceEnv: {
    LOCAL_LLM_URL: boolean;
    LOCAL_LLM_MODEL: boolean;
    LOCAL_OPENAI_COMPAT_URL: boolean;
    DISCORD_BOT_TOKEN: boolean;
    DISCORD_CHANNEL_ID: boolean;
  };
  notes: string[];
  testedDiscordRoundTrip: false;
}

async function commandExists(cmd: string): Promise<boolean> {
  try {
    await execFileAsync("which", [cmd], { timeout: 2000 });
    return true;
  } catch {
    return false;
  }
}

export async function getNemoStatus(): Promise<NemoStatus> {
  const [nemoclawDetected, openclawDetected, openshellDetected] =
    await Promise.all([
      commandExists("nemoclaw"),
      commandExists("openclaw"),
      commandExists("openshell"),
    ]);

  const discordConfigured = Boolean(
    process.env.DISCORD_BOT_TOKEN && process.env.DISCORD_CHANNEL_ID
  );

  const notes: string[] = [];
  if (!nemoclawDetected)
    notes.push(
      "NemoClaw CLI not found on PATH. Install per NVIDIA docs when available on this host; do not invent commands."
    );
  if (!openclawDetected)
    notes.push("OpenClaw CLI not found on PATH.");
  if (!openshellDetected)
    notes.push(
      "OpenShell not found. Agent sandboxing should use OpenShell when installed."
    );
  if (!discordConfigured)
    notes.push(
      "Discord credentials missing. Set DISCORD_BOT_TOKEN and DISCORD_CHANNEL_ID. Integration prepared but NOT complete until a real message is tested."
    );

  return {
    nemoclawDetected,
    openclawDetected,
    openshellDetected,
    discordConfigured,
    localInferenceEnv: {
      LOCAL_LLM_URL: Boolean(process.env.LOCAL_LLM_URL),
      LOCAL_LLM_MODEL: Boolean(process.env.LOCAL_LLM_MODEL),
      LOCAL_OPENAI_COMPAT_URL: Boolean(process.env.LOCAL_OPENAI_COMPAT_URL),
      DISCORD_BOT_TOKEN: Boolean(process.env.DISCORD_BOT_TOKEN),
      DISCORD_CHANNEL_ID: Boolean(process.env.DISCORD_CHANNEL_ID),
    },
    notes,
    testedDiscordRoundTrip: false,
  };
}

/** Parse natural-language evaluation intents from Discord / UI. */
export function parseEvalIntent(text: string): {
  mission: MissionId;
  robotIds?: RobotId[];
  compare: boolean;
} | null {
  const lower = text.toLowerCase();
  if (!/(evaluat|compare|run|test|which|why|harder)/.test(lower)) return null;

  const mission: MissionId = /mine|mineral|tunnel/.test(lower)
    ? "deep-mine"
    : "fire-rescue";

  const robotIds: RobotId[] = [];
  if (/g1|unitree/.test(lower)) robotIds.push("unitree-g1");
  if (/atlas|boston/.test(lower)) robotIds.push("bd-atlas");
  if (/agibot|a2/.test(lower)) robotIds.push("agibot-a2");

  const compare = /compare|three|all|best/.test(lower);
  return {
    mission,
    robotIds: robotIds.length ? robotIds : undefined,
    compare,
  };
}

export async function handleDiscordStyleCommand(text: string) {
  const intent = parseEvalIntent(text);
  if (!intent) {
    return {
      ok: false as const,
      reply:
        "Unrecognized command. Try: Evaluate Unitree G1 in Fire Rescue. / Compare the three robots in Deep Mine.",
    };
  }

  const report = await runAutonomousEvaluation({
    mission: intent.mission,
    robotIds: intent.compare ? undefined : intent.robotIds,
    maxFollowUps: /harder|follow|again/.test(text.toLowerCase()) ? 2 : 1,
  });

  const reply = [
    `Mission: ${intent.mission}`,
    `Mode: ${report.mode}`,
    report.finalSummary,
    ...report.leaderboardDelta.map(
      (d) => `${d.robotId}: ${d.score}`
    ),
    report.disclaimer,
  ].join("\n");

  return { ok: true as const, reply, report };
}

export const REQUIRED_ENV = [
  "DISCORD_BOT_TOKEN",
  "DISCORD_CHANNEL_ID",
  "LOCAL_LLM_URL",
  "LOCAL_LLM_MODEL",
] as const;
