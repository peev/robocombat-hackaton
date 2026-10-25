import { z } from "zod";
import {
  createExperimentConfig,
  runExperiment,
} from "@/lib/simulation/engine";
import {
  CONDITION_LIMITS,
  DEFAULT_CONDITIONS,
  type ExperimentConditions,
  type ExperimentResult,
  type MissionId,
} from "@/lib/simulation/types";
import type { RobotId } from "@/lib/robots/profiles";
import { ROBOT_IDS, getRobot } from "@/lib/robots/profiles";
import { saveExperiment, pushGpuEvent } from "@/lib/persistence/store";
import { bumpEvaluations } from "@/lib/hardware/nvidia";
import { localInfer } from "./localInference";

export const FollowUpSchema = z.object({
  hypothesis: z.string().min(8).max(500),
  mission: z.enum(["fire-rescue", "deep-mine"]),
  robotIds: z.array(z.enum(["unitree-g1", "bd-atlas", "agibot-a2"])).min(1).max(3),
  conditionChanges: z
    .record(z.string(), z.number())
    .refine(
      (obj) =>
        Object.keys(obj).every((k) => k in CONDITION_LIMITS || k === "seed"),
      "Unknown condition key"
    ),
  rationale: z.string().min(8).max(800),
});

export type FollowUpRequest = z.infer<typeof FollowUpSchema>;

export interface EvaluationReport {
  requestId: string;
  mode: "local-llm" | "heuristic-fallback";
  disclaimer: string;
  initialResult: ExperimentResult;
  analyses: string[];
  followUps: {
    request: FollowUpRequest;
    result: ExperimentResult;
    comparison: string;
  }[];
  finalSummary: string;
  leaderboardDelta: { robotId: RobotId; score: number }[];
  inference: {
    realInference: boolean;
    provider: string | null;
    model: string | null;
    latencyMs: number | null;
  };
}

function clampConditions(
  base: ExperimentConditions,
  changes: Record<string, number>
): ExperimentConditions {
  const next = { ...base };
  for (const [key, value] of Object.entries(changes)) {
    if (!(key in CONDITION_LIMITS)) continue;
    const lim = CONDITION_LIMITS[key as keyof ExperimentConditions];
    (next as Record<string, number>)[key] = Math.max(
      lim.min,
      Math.min(lim.max, value)
    );
  }
  return next;
}

function summarizeResult(result: ExperimentResult): string {
  const lines = result.final.robots.map((r) => {
    const robot = getRobot(r.robotId);
    return `${robot.displayName}: score=${r.score} complete=${r.missionComplete} collisions=${r.collisions} falls=${r.falls} distance=${r.distanceTraveled.toFixed(1)} energy=${(r.energy * 100).toFixed(0)}% state=${r.state} objectives=${r.objectivesCompleted.join(",")}`;
  });
  return [
    `Mission: ${result.config.mission}`,
    `Seed: ${result.config.conditions.seed}`,
    `Conditions: smoke=${result.config.conditions.smokeDensity} visibility=${result.config.conditions.visibility} incline=${result.config.conditions.incline} terrain=${result.config.conditions.terrainDifficulty}`,
    ...lines,
    `Rankings: ${result.rankings.map((r) => `${r.robotId}#${r.rank}(${r.score})`).join(", ")}`,
  ].join("\n");
}

/** Deterministic heuristic that designs follow-ups from measured weaknesses — not LLM text. */
function heuristicFollowUp(
  result: ExperimentResult,
  round: number
): FollowUpRequest | null {
  if (round >= 3) return null;
  const robots = result.final.robots;
  const worstCollisions = [...robots].sort(
    (a, b) => b.collisions - a.collisions
  )[0];
  const worstFalls = [...robots].sort((a, b) => b.falls - a.falls)[0];
  const c = result.config.conditions;

  if (result.config.mission === "fire-rescue") {
    if (worstCollisions.collisions >= 2 || c.smokeDensity < 0.7) {
      return {
        hypothesis: `${getRobot(worstCollisions.robotId).displayName} showed navigation degradation (${worstCollisions.collisions} collisions). Increasing smoke density should further stress obstacle avoidance.`,
        mission: "fire-rescue",
        robotIds: result.config.robotIds,
        conditionChanges: {
          smokeDensity: Math.min(1, c.smokeDensity + 0.25),
          visibility: Math.max(0.2, c.visibility - 0.2),
          seed: c.seed + 1 + round,
        },
        rationale:
          "Measured collision count under smoke motivates a visibility-stress follow-up.",
      };
    }
  } else {
    if (worstFalls.falls >= 1 || c.incline < 0.4) {
      return {
        hypothesis: `${getRobot(worstFalls.robotId).displayName} stability risk on terrain (falls=${worstFalls.falls}). Increasing incline will test balance tolerance.`,
        mission: "deep-mine",
        robotIds: result.config.robotIds,
        conditionChanges: {
          incline: Math.min(0.55, c.incline + 0.15),
          terrainDifficulty: Math.min(1, c.terrainDifficulty + 0.2),
          seed: c.seed + 7 + round,
        },
        rationale:
          "Measured falls / low incline headroom motivates a steeper-terrain follow-up.",
      };
    }
  }

  // Default stress test: harder obstacles
  return {
    hypothesis:
      "Obstacle shift and reduced lighting should reveal differences in path efficiency.",
    mission: result.config.mission,
    robotIds: result.config.robotIds,
    conditionChanges: {
      obstacleShift: Math.min(1, c.obstacleShift + 0.35),
      lighting: Math.max(0.1, c.lighting - 0.2),
      seed: c.seed + 11 + round,
    },
    rationale: "General robustness follow-up based on measured path efficiency variance.",
  };
}

function heuristicAnalysis(result: ExperimentResult): string {
  const ranked = result.rankings;
  const top = ranked[0];
  const bottom = ranked[ranked.length - 1];
  const topT = result.final.robots.find((r) => r.robotId === top.robotId)!;
  const botT = result.final.robots.find((r) => r.robotId === bottom.robotId)!;
  return [
    "[HEURISTIC EVALUATOR — local LLM unavailable; this is rule-based analysis of measured telemetry, not generative AI.]",
    `${getRobot(top.robotId).displayName} ranked #1 (score ${top.score}).`,
    `Completion: ${topT.missionComplete ? "yes" : "no"}; collisions=${topT.collisions}; falls=${topT.falls}; pathEfficiency=${(topT.pathEfficiency * 100).toFixed(0)}%.`,
    bottom.robotId !== top.robotId
      ? `Weakest under these conditions: ${getRobot(bottom.robotId).displayName} (score ${bottom.score}, collisions=${botT.collisions}, falls=${botT.falls}).`
      : "Single-robot evaluation.",
    "ILLUSTRATIVE SIMULATION, NOT VERIFIED HARDWARE PERFORMANCE.",
  ].join(" ");
}

function parseFollowUpJson(text: string): FollowUpRequest | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const raw = JSON.parse(match[0]);
    const parsed = FollowUpSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

async function llmFollowUp(
  result: ExperimentResult
): Promise<{ analysis: string; followUp: FollowUpRequest | null; inference: EvaluationReport["inference"] }> {
  const system = `You are an independent humanoid robotics evaluation engineer for RoboCombat BlackBox.
You analyze MEASURED simulation telemetry only. Never invent numbers.
All results are ILLUSTRATIVE SIMULATION, NOT VERIFIED HARDWARE PERFORMANCE.
Respond with a short analysis paragraph, then a JSON object for the next experiment with keys:
hypothesis, mission ("fire-rescue"|"deep-mine"), robotIds, conditionChanges (numeric deltas/absolute within approved ranges), rationale.
Max one follow-up proposal. Approved condition keys: ${Object.keys(CONDITION_LIMITS).join(", ")}.`;

  const prompt = `Analyze this experiment and propose ONE harder follow-up grounded in measured weaknesses:\n${summarizeResult(result)}`;

  const inf = await localInfer(prompt, system);
  if (!inf.realInference) {
    return {
      analysis: heuristicAnalysis(result),
      followUp: null,
      inference: {
        realInference: false,
        provider: null,
        model: null,
        latencyMs: null,
      },
    };
  }

  return {
    analysis: inf.text,
    followUp: parseFollowUpJson(inf.text),
    inference: {
      realInference: true,
      provider: inf.provider,
      model: inf.model,
      latencyMs: inf.latencyMs,
    },
  };
}

function compareResults(a: ExperimentResult, b: ExperimentResult, hypothesis: string): string {
  const lines = a.final.robots.map((ra) => {
    const rb = b.final.robots.find((r) => r.robotId === ra.robotId);
    if (!rb) return "";
    return `${getRobot(ra.robotId).shortName}: score ${ra.score}→${rb.score}, collisions ${ra.collisions}→${rb.collisions}, falls ${ra.falls}→${rb.falls}`;
  });
  return `Hypothesis: ${hypothesis}. Comparison — ${lines.filter(Boolean).join("; ")}`;
}

export async function runAutonomousEvaluation(input: {
  mission: MissionId;
  robotIds?: RobotId[];
  conditions?: Partial<ExperimentConditions>;
  maxFollowUps?: number;
}): Promise<EvaluationReport> {
  const robotIds = input.robotIds?.length ? input.robotIds : [...ROBOT_IDS];
  const maxFollowUps = Math.min(3, input.maxFollowUps ?? 2);
  const requestId = `eval_${Date.now().toString(36)}`;

  pushGpuEvent("AI Evaluation Started");
  pushGpuEvent("Simulation Started");

  const initialConfig = createExperimentConfig({
    mission: input.mission,
    robotIds,
    conditions: input.conditions,
    mode: "ai-evaluation",
  });
  const initialResult = runExperiment(initialConfig);
  saveExperiment(initialResult);
  bumpEvaluations();
  pushGpuEvent(
    input.mission === "fire-rescue"
      ? "Fire Rescue Completed"
      : "Deep Mine Completed"
  );

  const analyses: string[] = [];
  const followUps: EvaluationReport["followUps"] = [];
  let inferenceMeta: EvaluationReport["inference"] = {
    realInference: false,
    provider: null,
    model: null,
    latencyMs: null,
  };

  pushGpuEvent("AI Analysis Started");
  const first = await llmFollowUp(initialResult);
  analyses.push(first.analysis);
  inferenceMeta = first.inference;
  pushGpuEvent("AI Analysis Finished");

  let current = initialResult;
  let mode: EvaluationReport["mode"] = first.inference.realInference
    ? "local-llm"
    : "heuristic-fallback";

  for (let i = 0; i < maxFollowUps; i++) {
    let follow = first.inference.realInference && i === 0 ? first.followUp : null;
    if (!follow) {
      // For subsequent rounds with LLM, ask again; else heuristic
      if (first.inference.realInference && i > 0) {
        const next = await llmFollowUp(current);
        analyses.push(next.analysis);
        follow = next.followUp;
        inferenceMeta = next.inference;
      }
      if (!follow) {
        follow = heuristicFollowUp(current, i);
        if (!first.inference.realInference) mode = "heuristic-fallback";
      }
    }
    if (!follow) break;

    const validated = FollowUpSchema.safeParse(follow);
    if (!validated.success) {
      follow = heuristicFollowUp(current, i);
      if (!follow) break;
    }
    const req = validated.success ? validated.data : follow!;

    pushGpuEvent("New Test Selected");
    const nextConditions = clampConditions(
      { ...DEFAULT_CONDITIONS, ...current.config.conditions },
      req.conditionChanges
    );
    const cfg = createExperimentConfig({
      mission: req.mission,
      robotIds: req.robotIds as RobotId[],
      conditions: nextConditions,
      mode: "ai-evaluation",
      parentExperimentId: current.config.id,
      hypothesis: req.hypothesis,
    });
    pushGpuEvent("Experiment Relaunched");
    const nextResult = runExperiment(cfg);
    saveExperiment(nextResult);
    bumpEvaluations();

    const comparison = compareResults(current, nextResult, req.hypothesis);
    followUps.push({ request: req, result: nextResult, comparison });
    analyses.push(comparison);
    current = nextResult;
  }

  const finalSummary = [
    mode === "local-llm"
      ? "Local LLM evaluation completed."
      : "Heuristic evaluation completed (local LLM unavailable — no fabricated AI text).",
    `Initial mission ${initialResult.config.mission}; ${followUps.length} follow-up experiment(s).`,
    `Final top: ${current.rankings[0]?.robotId} (${current.rankings[0]?.score}).`,
    "ILLUSTRATIVE SIMULATION, NOT VERIFIED HARDWARE PERFORMANCE.",
  ].join(" ");

  pushGpuEvent("AI Evaluation Finished");

  return {
    requestId,
    mode,
    disclaimer: "ILLUSTRATIVE SIMULATION, NOT VERIFIED HARDWARE PERFORMANCE.",
    initialResult,
    analyses,
    followUps,
    finalSummary,
    leaderboardDelta: current.rankings.map((r) => ({
      robotId: r.robotId,
      score: r.score,
    })),
    inference: inferenceMeta,
  };
}
