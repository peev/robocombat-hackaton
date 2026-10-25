import { NextResponse } from "next/server";
import { runAutonomousEvaluation } from "@/lib/ai/evaluator";
import { createExperimentConfig, runExperiment } from "@/lib/simulation/engine";
import { saveExperiment, pushGpuEvent } from "@/lib/persistence/store";
import { bumpEvaluations } from "@/lib/hardware/nvidia";
import { ROBOT_IDS } from "@/lib/robots/profiles";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

/** Full demo orchestration — real simulations + AI/heuristic evaluation. */
export async function POST() {
  pushGpuEvent("Demo Started");

  const fireEval = await runAutonomousEvaluation({
    mission: "fire-rescue",
    robotIds: [...ROBOT_IDS],
    maxFollowUps: 1,
    conditions: { seed: 42, smokeDensity: 0.4 },
  });

  pushGpuEvent("Switching to Deep Mine");
  const mineConfig = createExperimentConfig({
    mission: "deep-mine",
    robotIds: [...ROBOT_IDS],
    conditions: { seed: 99, incline: 0.2 },
    mode: "demo",
  });
  const mineResult = runExperiment(mineConfig);
  saveExperiment(mineResult);
  bumpEvaluations();
  pushGpuEvent("Deep Mine Completed");

  const mineEval = await runAutonomousEvaluation({
    mission: "deep-mine",
    robotIds: [...ROBOT_IDS],
    maxFollowUps: 1,
    conditions: { seed: 100, incline: 0.25 },
  });

  pushGpuEvent("Demo Finished");

  return NextResponse.json({
    tagline: "THE ULTIMATE TEST OF PHYSICAL AI.",
    fire: fireEval,
    mineQuick: mineResult,
    mine: mineEval,
    disclaimer: "ILLUSTRATIVE SIMULATION, NOT VERIFIED HARDWARE PERFORMANCE.",
  });
}
