import { NextRequest, NextResponse } from "next/server";
import {
  createExperimentConfig,
  runExperiment,
} from "@/lib/simulation/engine";
import { listExperiments, saveExperiment, pushGpuEvent } from "@/lib/persistence/store";
import { bumpEvaluations } from "@/lib/hardware/nvidia";
import type { MissionId } from "@/lib/simulation/types";
import type { RobotId } from "@/lib/robots/profiles";
import { ROBOT_IDS } from "@/lib/robots/profiles";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ experiments: listExperiments(30) });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const mission = (body.mission ?? "fire-rescue") as MissionId;
  const robotIds = (body.robotIds ?? ROBOT_IDS) as RobotId[];
  const conditions = body.conditions ?? {};
  const mode = body.mode ?? "autonomous";
  const batchSize = Math.min(32, Math.max(1, Number(body.batchSize ?? 1)));

  pushGpuEvent("Simulation Started");

  if (batchSize > 1) {
    const concurrency = Math.min(4, batchSize);
    const results: {
      id: string;
      rankings: { robotId: string; score: number; rank: number }[];
      durationSec: number;
    }[] = [];
    let completed = 0;
    const start = Date.now();
    const queue = Array.from({ length: batchSize }, (_, i) => i);

    async function worker() {
      while (queue.length) {
        const i = queue.shift()!;
        const cfg = createExperimentConfig({
          mission,
          robotIds,
          conditions: { ...conditions, seed: (conditions.seed ?? 42) + i },
          mode: "ai-evaluation",
        });
        const result = runExperiment(cfg);
        saveExperiment(result);
        bumpEvaluations();
        completed += 1;
        results.push({
          id: result.config.id,
          rankings: result.rankings,
          durationSec: result.durationSec,
        });
      }
    }

    await Promise.all(Array.from({ length: concurrency }, () => worker()));
    const elapsed = (Date.now() - start) / 1000;
    pushGpuEvent("Parallel Evaluation Completed");
    return NextResponse.json({
      batch: true,
      total: batchSize,
      completed,
      experimentsPerSecond: completed / Math.max(0.001, elapsed),
      elapsedSec: elapsed,
      results,
    });
  }

  const cfg = createExperimentConfig({
    mission,
    robotIds,
    conditions,
    mode,
    hypothesis: body.hypothesis,
    parentExperimentId: body.parentExperimentId,
  });
  const result = runExperiment(cfg);
  saveExperiment(result);
  bumpEvaluations();
  pushGpuEvent(
    mission === "fire-rescue" ? "Fire Rescue Completed" : "Deep Mine Completed"
  );

  return NextResponse.json({ experiment: result });
}
