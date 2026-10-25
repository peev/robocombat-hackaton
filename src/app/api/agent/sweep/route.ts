import { NextRequest } from "next/server";
import { digest, normalizeSource, parseMission, runAgentExperiment } from "@/lib/agent/ops";
import { getRankings } from "@/lib/persistence/store";
import { ROBOT_IDS, getRobot } from "@/lib/robots/profiles";
import type { ExperimentConditions, MissionId } from "@/lib/simulation/types";

export const dynamic = "force-dynamic";

/** Stress profiles a regression sweep cycles through. */
const STRESS: Record<MissionId, { name: string; conditions: Partial<ExperimentConditions> }[]> = {
  "fire-rescue": [
    { name: "baseline", conditions: {} },
    { name: "dense smoke", conditions: { smokeDensity: 0.85, visibility: 0.35 } },
    { name: "fast fire + debris", conditions: { fireSpreadRate: 0.25, obstacleShift: 0.6 } },
  ],
  "deep-mine": [
    { name: "baseline", conditions: {} },
    { name: "max incline + rough terrain", conditions: { incline: 0.6, terrainDifficulty: 1 } },
    { name: "dark + collapsed tunnel", conditions: { lighting: 0.15, tunnelAccessibility: 0.5 } },
  ],
};

/**
 * Agent tool: regression sweep. Runs every robot through each stress profile
 * and flags robots that fail or fall well below their running average.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const source = normalizeSource(body.source);
  const missions: MissionId[] =
    body.mission && body.mission !== "all" ? [parseMission(body.mission)] : ["fire-rescue", "deep-mine"];
  const baseline = new Map(getRankings().map((r) => [`${r.robotId}:${r.mission}`, r.score]));
  const seed = Math.floor(Date.now() / 1000) % 100000;

  const out: string[] = [`REGRESSION SWEEP seed_base=${seed}`];
  const flags: string[] = [];
  for (const mission of missions) {
    for (const [i, profile] of STRESS[mission].entries()) {
      const { result } = runAgentExperiment({
        mission,
        robotIds: [...ROBOT_IDS],
        conditions: { ...profile.conditions, seed: seed + i },
        hypothesis: `Regression sweep · ${profile.name}`,
        source,
      });
      out.push(`--- ${mission} / ${profile.name}`, digest(result));
      for (const r of result.final.robots) {
        const avg = baseline.get(`${r.robotId}:${mission}`);
        const name = getRobot(r.robotId).displayName;
        if (!r.missionComplete) flags.push(`${name} FAILED ${mission} under "${profile.name}"`);
        else if (avg && r.score < avg * 0.85)
          flags.push(`${name} scored ${r.score} vs running avg ${avg} on ${mission} "${profile.name}" (-${Math.round((1 - r.score / avg) * 100)}%)`);
      }
    }
  }
  out.push("", flags.length ? `FLAGS (${flags.length}):\n- ${flags.join("\n- ")}` : "FLAGS: none — all robots within tolerance.");
  return new Response(out.join("\n") + "\n", { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
