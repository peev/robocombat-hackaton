import { NextRequest, NextResponse } from "next/server";
import { runAutonomousEvaluation } from "@/lib/ai/evaluator";
import { probeLocalInference } from "@/lib/ai/localInference";
import { getNemoStatus } from "@/lib/nemo/integration";
import type { MissionId } from "@/lib/simulation/types";
import type { RobotId } from "@/lib/robots/profiles";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET() {
  const [inference, nemo] = await Promise.all([
    probeLocalInference(),
    getNemoStatus(),
  ]);
  return NextResponse.json({ inference, nemo });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const report = await runAutonomousEvaluation({
    mission: (body.mission ?? "fire-rescue") as MissionId,
    robotIds: body.robotIds as RobotId[] | undefined,
    conditions: body.conditions,
    maxFollowUps: body.maxFollowUps ?? 2,
  });
  return NextResponse.json({ report });
}
