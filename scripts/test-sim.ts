import {
  createExperimentConfig,
  runExperiment,
} from "../src/lib/simulation/engine";
import { runAutonomousEvaluation } from "../src/lib/ai/evaluator";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

async function main() {
  console.log("Running Fire Rescue comparison…");
  const fireCfg = createExperimentConfig({
    mission: "fire-rescue",
    robotIds: ["unitree-g1", "bd-atlas", "agibot-a2"],
    conditions: { seed: 42 },
    mode: "compare",
  });
  const fire = runExperiment(fireCfg);
  assert(fire.final.robots.length === 3, "expected 3 robots");
  assert(fire.durationSec > 1, "expected meaningful duration");
  assert(
    fire.final.robots.some((r) => r.missionComplete || r.distanceTraveled > 5),
    "expected progress"
  );
  assert(fire.rankings[0].score >= fire.rankings[2].score, "ranking order");

  const fire2 = runExperiment(fireCfg);
  assert(
    fire.final.robots[0].score === fire2.final.robots[0].score &&
      fire.final.robots[0].collisions === fire2.final.robots[0].collisions,
    "same seed should be reproducible"
  );

  console.log("Running Deep Mine…");
  const mineCfg = createExperimentConfig({
    mission: "deep-mine",
    robotIds: ["unitree-g1"],
    conditions: { seed: 7, incline: 0.2 },
    mode: "autonomous",
  });
  const mine = runExperiment(mineCfg);
  assert(mine.final.robots[0].distanceTraveled > 1, "mine navigation");

  console.log("Running autonomous evaluation (heuristic if no LLM)…");
  const evalReport = await runAutonomousEvaluation({
    mission: "fire-rescue",
    robotIds: ["unitree-g1", "bd-atlas"],
    maxFollowUps: 1,
    conditions: { seed: 3 },
  });
  assert(evalReport.followUps.length >= 1, "expected follow-up experiment");
  assert(
    evalReport.followUps[0].request.hypothesis.length > 8,
    "hypothesis required"
  );
  assert(
    evalReport.mode === "local-llm" || evalReport.mode === "heuristic-fallback",
    "valid mode"
  );

  console.log("OK", {
    fireScores: fire.rankings,
    mineScore: mine.final.robots[0].score,
    evalMode: evalReport.mode,
    followUps: evalReport.followUps.length,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
