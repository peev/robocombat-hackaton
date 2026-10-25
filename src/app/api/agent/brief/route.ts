import { getRankings, listExperiments } from "@/lib/persistence/store";
import { listLog } from "@/lib/agent/ops";
import { getRobot } from "@/lib/robots/profiles";

export const dynamic = "force-dynamic";

/** Agent tool: compact plain-text status of the lab. */
export async function GET() {
  const rankings = getRankings()
    .sort((a, b) => a.mission.localeCompare(b.mission) || b.score - a.score)
    .map((r) => `${r.mission} | ${getRobot(r.robotId).displayName} | avg ${r.score} over ${r.tests} tests`);
  const recent = listExperiments(5).map(
    (e) =>
      `${e.config.id} ${e.config.mission} top=${getRobot(e.rankings[0].robotId).shortName}(${e.rankings[0].score})${e.config.hypothesis ? ` "${e.config.hypothesis}"` : ""}`
  );
  const reports = listLog(40)
    .filter((l) => l.kind === "report")
    .slice(0, 3)
    .map((l) => `${new Date(l.t).toISOString()} [${l.severity}] ${l.title}`);
  const text = [
    "LEADERBOARD (running averages)",
    ...rankings,
    "",
    "RECENT EXPERIMENTS",
    ...recent,
    "",
    "LAST REPORTS",
    ...(reports.length ? reports : ["(none)"]),
  ].join("\n");
  return new Response(text + "\n", { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
