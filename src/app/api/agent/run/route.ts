import { NextRequest } from "next/server";
import {
  clampConditions,
  digest,
  normalizeSource,
  parseMission,
  parseRobots,
  runAgentExperiment,
} from "@/lib/agent/ops";

export const dynamic = "force-dynamic";

/** Agent tool: run one experiment, get a plain-text digest back. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { result } = runAgentExperiment({
    mission: parseMission(body.mission),
    robotIds: parseRobots(body.robots ?? body.robotIds),
    conditions: clampConditions(body.conditions),
    hypothesis: typeof body.hypothesis === "string" ? body.hypothesis.slice(0, 400) : undefined,
    source: normalizeSource(body.source),
  });
  return new Response(digest(result) + "\n(replaying live in the RoboCombat 3D view)\n", {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
