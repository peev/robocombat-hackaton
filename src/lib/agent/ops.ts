/**
 * Always-on agent operations: the OpenClaw "BlackBox" agent drives the lab
 * through /api/agent/*. Every action it takes is appended to an activity log
 * that the UI streams, and every experiment it launches can be replayed in 3D.
 */

import fs from "fs";
import os from "os";
import path from "path";
import { execFile } from "child_process";
import { createExperimentConfig, runExperiment } from "@/lib/simulation/engine";
import {
  CONDITION_LIMITS,
  type ExperimentConditions,
  type ExperimentResult,
  type MissionId,
} from "@/lib/simulation/types";
import { ROBOT_IDS, getRobot, type RobotId } from "@/lib/robots/profiles";
import { getExperiment, saveExperiment, pushGpuEvent } from "@/lib/persistence/store";
import { bumpEvaluations } from "@/lib/hardware/nvidia";

const DATA_DIR = path.join(process.cwd(), "data");
const LOG_FILE = path.join(DATA_DIR, "agent_log.json");

export type AgentSource = "openclaw-chat" | "openclaw-cron" | "openclaw-heartbeat" | "ui";

export interface AgentLogEntry {
  id: string;
  t: number;
  source: AgentSource;
  kind: "run" | "report" | "note" | "chat";
  title: string;
  body: string;
  experimentId?: string;
  mission?: MissionId;
  severity?: "info" | "warn" | "critical";
}

function readLog(): AgentLogEntry[] {
  try {
    return JSON.parse(fs.readFileSync(LOG_FILE, "utf8")) as AgentLogEntry[];
  } catch {
    return [];
  }
}

export function appendLog(entry: Omit<AgentLogEntry, "id" | "t">): AgentLogEntry {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const full: AgentLogEntry = {
    id: `log_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e4).toString(36)}`,
    t: Date.now(),
    ...entry,
  };
  const all = [full, ...readLog()].slice(0, 300);
  fs.writeFileSync(LOG_FILE, JSON.stringify(all, null, 2));
  return full;
}

export function listLog(limit = 40): AgentLogEntry[] {
  return readLog().slice(0, limit);
}

export function normalizeSource(s: unknown): AgentSource {
  return s === "openclaw-cron" || s === "openclaw-heartbeat" || s === "ui" ? s : "openclaw-chat";
}

const ROBOT_ALIASES: Record<string, RobotId> = {
  g1: "unitree-g1",
  unitree: "unitree-g1",
  "unitree-g1": "unitree-g1",
  atlas: "bd-atlas",
  "bd-atlas": "bd-atlas",
  boston: "bd-atlas",
  a2: "agibot-a2",
  agibot: "agibot-a2",
  "agibot-a2": "agibot-a2",
};

export function parseRobots(input: unknown): RobotId[] {
  const raw = Array.isArray(input) ? input : typeof input === "string" ? input.split(/[,\s]+/) : [];
  const ids = raw
    .map((r) => ROBOT_ALIASES[String(r).toLowerCase().trim()])
    .filter((r): r is RobotId => Boolean(r));
  return ids.length ? [...new Set(ids)] : [...ROBOT_IDS];
}

export function parseMission(input: unknown): MissionId {
  return /mine|tunnel/i.test(String(input ?? "")) ? "deep-mine" : "fire-rescue";
}

export function clampConditions(input: unknown): Partial<ExperimentConditions> {
  const out: Partial<ExperimentConditions> = {};
  if (!input || typeof input !== "object") return out;
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (!(k in CONDITION_LIMITS)) continue;
    const n = Number(v);
    if (!Number.isFinite(n)) continue;
    const lim = CONDITION_LIMITS[k as keyof ExperimentConditions];
    out[k as keyof ExperimentConditions] = Math.max(lim.min, Math.min(lim.max, n));
  }
  return out;
}

/** Short plain-text digest of a run — sized for a local 20B model's context. */
export function digest(result: ExperimentResult): string {
  const c = result.config.conditions;
  const lines = result.rankings.map((rk) => {
    const r = result.final.robots.find((x) => x.robotId === rk.robotId)!;
    const fails = r.timeline.filter((e) => /fall|collision|fail|stuck/i.test(e.type)).length;
    return `#${rk.rank} ${getRobot(r.robotId).displayName}: score ${r.score}, complete=${r.missionComplete ? "yes" : "NO"}, collisions=${r.collisions}, falls=${r.falls}, path_eff=${Math.round(r.pathEfficiency * 100)}%, energy_left=${Math.round(r.energy * 100)}%, objectives=[${r.objectivesCompleted.join(", ")}], incident_events=${fails}`;
  });
  return [
    `experiment ${result.config.id} | mission=${result.config.mission} | seed=${c.seed} | duration=${result.durationSec.toFixed(1)}s`,
    `conditions: smoke=${c.smokeDensity} visibility=${c.visibility} lighting=${c.lighting} terrain=${c.terrainDifficulty} incline=${c.incline} obstacleShift=${c.obstacleShift} fireSpread=${c.fireSpreadRate}`,
    ...lines,
  ].join("\n");
}

export function runAgentExperiment(input: {
  mission: MissionId;
  robotIds: RobotId[];
  conditions: Partial<ExperimentConditions>;
  hypothesis?: string;
  source: AgentSource;
}): { result: ExperimentResult; entry: AgentLogEntry } {
  pushGpuEvent("Agent Experiment Started");
  const cfg = createExperimentConfig({
    mission: input.mission,
    robotIds: input.robotIds,
    conditions: input.conditions,
    mode: "ai-evaluation",
    hypothesis: input.hypothesis,
  });
  const result = runExperiment(cfg);
  saveExperiment(result);
  bumpEvaluations();
  pushGpuEvent(input.mission === "fire-rescue" ? "Fire Rescue Completed" : "Deep Mine Completed");

  const top = result.rankings[0];
  const failed = result.final.robots.filter((r) => !r.missionComplete);
  const entry = appendLog({
    source: input.source,
    kind: "run",
    title: `${input.mission === "fire-rescue" ? "Fire Rescue" : "Deep Mine"} · ${input.robotIds.length} robot(s) · top ${getRobot(top.robotId).shortName} ${top.score}`,
    body: input.hypothesis ? `Hypothesis: ${input.hypothesis}` : digest(result).split("\n")[1],
    experimentId: cfg.id,
    mission: input.mission,
    severity: failed.length ? "warn" : "info",
  });
  return { result, entry };
}

/** Deterministic re-simulation of a stored experiment at full snapshot resolution. */
export function replayExperiment(id: string): ExperimentResult | null {
  const stored = getExperiment(id);
  if (!stored) return null;
  return runExperiment(stored.config);
}

/* ------------------------------------------------------------ OpenClaw */

const HOME = os.homedir();
const OPENCLAW_BIN = process.env.OPENCLAW_BIN ?? path.join(HOME, ".local/opt/node24/bin/openclaw");
const OPENCLAW_PORT = Number(process.env.OPENCLAW_GATEWAY_PORT ?? 18789);
const OPENCLAW_AGENT = process.env.OPENCLAW_AGENT_ID ?? "blackbox";

export interface OpenClawStatus {
  installed: boolean;
  gatewayUp: boolean;
  port: number;
  agentId: string;
  model: string | null;
  cronJobs: { name: string; schedule: string; enabled: boolean }[];
  heartbeatMinutes: number | null;
  nemoclaw: boolean;
}

function readOpenClawConfig(): Record<string, unknown> | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(HOME, ".openclaw/openclaw.json"), "utf8"));
  } catch {
    return null;
  }
}

const openclawEnv = () => ({
  ...process.env,
  PATH: `${path.dirname(OPENCLAW_BIN)}:${process.env.PATH ?? ""}`,
  NO_COLOR: "1",
});

let cronCache: { at: number; jobs: OpenClawStatus["cronJobs"] } = { at: 0, jobs: [] };

function readCronJobs(): Promise<OpenClawStatus["cronJobs"]> {
  if (Date.now() - cronCache.at < 30_000) return Promise.resolve(cronCache.jobs);
  return new Promise((resolve) => {
    execFile(
      OPENCLAW_BIN,
      ["automations", "list", "--json"],
      { timeout: 10_000, env: openclawEnv() },
      (err, stdout) => {
        if (err) return resolve(cronCache.jobs);
        try {
          const raw = JSON.parse(stdout) as { jobs?: Record<string, unknown>[] };
          const jobs = (raw.jobs ?? []).map((j) => {
            const s = (j.schedule ?? {}) as Record<string, unknown>;
            const schedule =
              s.kind === "every" && typeof s.everyMs === "number"
                ? `every ${Math.round(s.everyMs / 60000)} min`
                : String(s.expr ?? s.at ?? s.kind ?? "");
            return { name: String(j.name ?? j.id ?? "job"), schedule, enabled: j.enabled !== false };
          });
          cronCache = { at: Date.now(), jobs };
          resolve(jobs);
        } catch {
          resolve(cronCache.jobs);
        }
      }
    );
  });
}

export async function getOpenClawStatus(): Promise<OpenClawStatus> {
  const installed = fs.existsSync(OPENCLAW_BIN);
  let gatewayUp = false;
  try {
    const res = await fetch(`http://127.0.0.1:${OPENCLAW_PORT}/`, { signal: AbortSignal.timeout(1500) });
    gatewayUp = res.status < 500;
  } catch {
    gatewayUp = false;
  }
  const cfg = readOpenClawConfig() as {
    agents?: { defaults?: { model?: { primary?: string }; heartbeat?: { every?: string } } };
  } | null;
  const every = cfg?.agents?.defaults?.heartbeat?.every;
  return {
    installed,
    gatewayUp,
    port: OPENCLAW_PORT,
    agentId: OPENCLAW_AGENT,
    model: cfg?.agents?.defaults?.model?.primary ?? null,
    cronJobs: installed ? await readCronJobs() : [],
    heartbeatMinutes: every ? parseInt(every, 10) || null : 30,
    nemoclaw: nemoclawInstalled(),
  };
}

export type AgentRuntime = "openclaw" | "nemoclaw";

const NEMOCLAW_BIN = process.env.NEMOCLAW_BIN ?? path.join(HOME, ".local/bin/nemoclaw");
const NEMOCLAW_SANDBOX = process.env.NEMOCLAW_SANDBOX ?? "blackbox";

export function nemoclawInstalled(): boolean {
  return fs.existsSync(NEMOCLAW_BIN);
}

/** NemoClaw prints preflight lines before the agent reply; keep only the reply. */
function stripNemoclawPreamble(out: string): string {
  return out
    .split("\n")
    .filter((l) => !/^\s*(Checking whether the Ollama model|Ollama model '.*' is already loaded)/.test(l))
    .join("\n")
    .trim();
}

/**
 * Send a chat turn to the agent: either the host OpenClaw gateway, or the same
 * agent inside the NemoClaw/OpenShell sandbox (network-policy restricted).
 */
let sandboxSession = `sandbox-${Date.now().toString(36)}`;

export async function chatWithAgent(
  message: string,
  sessionId = "robocombat-lab",
  runtime: AgentRuntime = "openclaw"
): Promise<string> {
  if (runtime !== "nemoclaw") return runAgentTurn(message, sessionId, runtime);
  try {
    return await runAgentTurn(message, sandboxSession, runtime);
  } catch {
    // A failed turn can leave a sandbox session unusable; retry once on a fresh one.
    sandboxSession = `sandbox-${Date.now().toString(36)}`;
    return runAgentTurn(message, sandboxSession, runtime);
  }
}

function runAgentTurn(message: string, sessionId: string, runtime: AgentRuntime): Promise<string> {
  const [cmd, args] =
    runtime === "nemoclaw"
      ? [
          "sg",
          [
            "docker",
            "-c",
            [NEMOCLAW_BIN, NEMOCLAW_SANDBOX, "agent", "--session-id", sessionId, "-m", message]
              .map((a) => `'${a.replace(/'/g, `'\\''`)}'`)
              .join(" "),
          ],
        ]
      : [OPENCLAW_BIN, ["agent", "--agent", OPENCLAW_AGENT, "--session-id", sessionId, "--thinking", "low", "-m", message]];
  return new Promise((resolve, reject) => {
    execFile(
      cmd,
      args,
      {
        timeout: 300_000,
        maxBuffer: 4 * 1024 * 1024,
        env: {
          ...openclawEnv(),
          PATH: `${path.dirname(NEMOCLAW_BIN)}:${openclawEnv().PATH}`,
          NEMOCLAW_DISABLE_TELEMETRY: "1",
        },
      },
      (err, stdout, stderr) => {
        if (err) return reject(new Error([stderr?.trim(), stdout?.trim(), err.message].filter(Boolean).join("\n")));
        const reply = runtime === "nemoclaw" ? stripNemoclawPreamble(stdout) : stdout.trim();
        if (runtime === "nemoclaw" && /^⚠️ .*(run failed|request failed)/m.test(reply)) return reject(new Error(reply));
        resolve(reply);
      }
    );
  });
}
