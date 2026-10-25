import { NextRequest, NextResponse } from "next/server";
import { appendLog, chatWithAgent, clampConditions, digest, parseMission } from "@/lib/agent/ops";
import { getExperiment } from "@/lib/persistence/store";
import { getRobot } from "@/lib/robots/profiles";
import type { ExperimentConditions, ExperimentResult, MissionId } from "@/lib/simulation/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export interface AgentVerdict {
  verdict: string;
  nextTest: { label: string; mission: MissionId; conditions: Partial<ExperimentConditions>; why: string };
  by: "openclaw" | "heuristic";
  latencyMs: number;
}

const AGENT_TIMEOUT_MS = 75_000;
const inflight = new Map<string, Promise<AgentVerdict>>();

function heuristic(result: ExperimentResult): Omit<AgentVerdict, "latencyMs"> {
  const mission = result.config.mission;
  const robots = result.final.robots;
  const top = result.rankings[0];
  const winner = robots.find((r) => r.robotId === top.robotId)!;
  const drained = [...robots].sort((a, b) => a.energy - b.energy)[0];
  const verdict = `${getRobot(winner.robotId).shortName} wins at ${winner.score}; ${getRobot(drained.robotId).shortName} ends lowest on energy (${Math.round(drained.energy * 100)}%).`;
  const c = result.config.conditions;
  const nextTest =
    mission === "fire-rescue"
      ? {
          label: "Dense smoke, low visibility",
          mission,
          conditions: { smokeDensity: Math.min(1, c.smokeDensity + 0.35), visibility: Math.max(0.2, c.visibility - 0.4) },
          why: "Margins are thin; stress perception.",
        }
      : {
          label: "Steep incline, rough terrain",
          mission,
          conditions: { incline: Math.min(0.6, c.incline + 0.25), terrainDifficulty: Math.min(1, c.terrainDifficulty + 0.5) },
          why: "Probe balance and energy under load.",
        };
  return { verdict, nextTest, by: "heuristic" };
}

function parseAgentReply(reply: string, result: ExperimentResult): Omit<AgentVerdict, "latencyMs"> | null {
  const match = reply.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const raw = JSON.parse(match[0]) as {
      verdict?: string;
      nextTest?: { label?: string; mission?: string; conditions?: unknown; why?: string };
    };
    if (!raw.verdict || !raw.nextTest) return null;
    const conditions = clampConditions(raw.nextTest.conditions);
    if (!Object.keys(conditions).length) return null;
    return {
      verdict: raw.verdict.trim().slice(0, 160),
      nextTest: {
        label: String(raw.nextTest.label ?? "Agent stress test").slice(0, 48),
        mission: raw.nextTest.mission ? parseMission(raw.nextTest.mission) : result.config.mission,
        conditions,
        why: String(raw.nextTest.why ?? "").slice(0, 120),
      },
      by: "openclaw",
    };
  } catch {
    return null;
  }
}

async function judge(result: ExperimentResult): Promise<AgentVerdict> {
  const started = Date.now();
  const prompt = [
    "Judge this finished RoboCombat benchmark. Do NOT use any tools; everything you need is below.",
    "Use only these measured numbers (illustrative simulation):",
    digest(result),
    "Reply with ONLY one JSON object, no prose:",
    '{"verdict":"<max 16 words: winner and the key differentiator, cite one number>",',
    ' "nextTest":{"label":"<max 5 words>","mission":"fire-rescue|deep-mine",',
    ' "conditions":{<1-3 of: smokeDensity, visibility, lighting, terrainDifficulty, incline (max 0.6), obstacleShift, fireSpreadRate, tunnelAccessibility>},',
    ' "why":"<max 10 words: which weakness this probes>"}}',
  ].join("\n");

  let out: Omit<AgentVerdict, "latencyMs"> | null = null;
  try {
    const reply = await Promise.race([
      chatWithAgent(prompt, `verdict-${result.config.id}`),
      new Promise<string>((_, reject) => setTimeout(() => reject(new Error("timeout")), AGENT_TIMEOUT_MS)),
    ]);
    out = parseAgentReply(reply, result);
  } catch {
    out = null;
  }
  const final = { ...(out ?? heuristic(result)), latencyMs: Date.now() - started };
  appendLog({
    source: final.by === "openclaw" ? "openclaw-chat" : "ui",
    kind: "report",
    title: `Verdict · ${result.config.mission === "fire-rescue" ? "Fire Rescue" : "Deep Mine"}`,
    body: `${final.verdict}\nNext test: ${final.nextTest.label} — ${final.nextTest.why}`,
    experimentId: result.config.id,
    mission: result.config.mission,
    severity: "info",
  });
  return final;
}

/** Agent judges a finished experiment and proposes the next stress test (used by the demo benchmark). */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const id = String(body.experimentId ?? "");
  const result = getExperiment(id);
  if (!result) return NextResponse.json({ error: "unknown experiment" }, { status: 404 });
  let p = inflight.get(id);
  if (!p) {
    p = judge(result);
    inflight.set(id, p);
    p.finally(() => setTimeout(() => inflight.delete(id), 10 * 60_000));
  }
  return NextResponse.json(await p);
}
