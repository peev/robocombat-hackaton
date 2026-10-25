import type { RobotTelemetry, MissionId } from "./types";

/** Deterministic score formulas from measured telemetry. */
export function computeMissionScore(
  mission: MissionId,
  t: RobotTelemetry,
  durationSec: number
): { score: number; categoryScores: Record<string, number> } {
  const completion = t.missionComplete ? 100 : t.missionFailed ? 0 : 25;
  const timeNorm = t.missionComplete
    ? Math.max(0, 100 - (durationSec / 120) * 100)
    : Math.max(0, 40 - (durationSec / 180) * 40);

  const collisionPenalty = Math.min(40, t.collisions * 5);
  const fallPenalty = Math.min(30, t.falls * 10);
  const pathScore = Math.round(t.pathEfficiency * 100);
  const energyScore = Math.round(t.energy * 100);

  let taskAccuracy = 50;
  let manipulation = 40;
  let perception = 40;
  const stability = Math.round(
    Math.max(0, 100 - fallPenalty * 2 - collisionPenalty)
  );

  if (mission === "fire-rescue") {
    const locate = t.timeToLocateFire != null ? 20 : 0;
    const reach = t.timeToReachFire != null ? 20 : 0;
    const suppress =
      t.suppressionTime != null
        ? Math.max(0, 40 - t.suppressionTime * 2)
        : 0;
    const equip = Math.min(20, t.equipmentInteractions * 10);
    taskAccuracy = locate + reach + suppress + equip;
    manipulation = Math.min(100, t.equipmentInteractions * 35 + (t.waterUsed > 0 ? 30 : 0));
    perception = t.timeToLocateFire != null ? 85 : 30;
  } else {
    const identify = t.timeToIdentifyDeposit != null ? 30 : 0;
    const recovered = Math.min(50, (t.materialRecoveredKg ?? 0) * 25);
    const carry = t.carrying || (t.materialRecoveredKg ?? 0) > 0 ? 20 : 0;
    taskAccuracy = identify + recovered + carry;
    manipulation = Math.min(
      100,
      t.equipmentInteractions * 25 + (t.materialRecoveredKg ?? 0) * 30
    );
    perception = t.timeToIdentifyDeposit != null ? 80 : 25;
  }

  const navigation = Math.round(
    Math.max(0, pathScore * 0.6 + (100 - collisionPenalty) * 0.4)
  );
  const efficiency = Math.round(
    Math.max(0, energyScore * 0.5 + (100 - Math.min(50, t.waterUsed * 5)) * 0.5)
  );

  const score = Math.round(
    completion * 0.35 +
      timeNorm * 0.15 +
      taskAccuracy * 0.2 +
      Math.max(0, 100 - collisionPenalty - fallPenalty) * 0.15 +
      efficiency * 0.15
  );

  return {
    score: Math.max(0, Math.min(100, score)),
    categoryScores: {
      completion,
      time: Math.round(timeNorm),
      navigation,
      stability,
      manipulation,
      perception,
      energy: efficiency,
      taskAccuracy: Math.round(taskAccuracy),
    },
  };
}
