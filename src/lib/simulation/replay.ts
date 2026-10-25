import type { RobotId } from "@/lib/robots/profiles";
import type {
  ExperimentResult,
  RobotState,
  SimulationSnapshot,
} from "./types";

/** Mutable per-robot pose consumed by the renderer every frame. */
export interface RobotPose {
  robotId: RobotId;
  x: number;
  y: number;
  z: number;
  heading: number;
  state: RobotState;
  carrying: boolean;
  /** World position of the hose nozzle tip, written by the renderer while the nozzle is deployed. */
  nozzle: [number, number, number] | null;
}

export function createPose(robotId: RobotId, x = 0, z = 0): RobotPose {
  return { robotId, x, y: 0, z, heading: 0, state: "IDLE", carrying: false, nozzle: null };
}

function snapshotIndex(snaps: SimulationSnapshot[], t: number): number {
  let lo = 0;
  let hi = snaps.length - 1;
  if (t <= snaps[0].time) return 0;
  if (t >= snaps[hi].time) return hi;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (snaps[mid].time <= t) lo = mid;
    else hi = mid;
  }
  return lo;
}

export function snapshotAt(result: ExperimentResult, t: number): SimulationSnapshot {
  const snaps = result.snapshots;
  if (!snaps.length) return result.final;
  return snaps[snapshotIndex(snaps, t)];
}

function lerpAngle(a: number, b: number, k: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
}

/** Interpolates every robot between the two snapshots bracketing `t` and writes into `poses`. */
export function samplePoses(
  result: ExperimentResult,
  t: number,
  poses: Map<RobotId, RobotPose>
): void {
  const snaps = result.snapshots;
  if (!snaps.length) return;
  const i = snapshotIndex(snaps, t);
  const a = snaps[i];
  const b = snaps[Math.min(i + 1, snaps.length - 1)];
  const span = b.time - a.time;
  const k = span > 1e-6 ? Math.min(1, Math.max(0, (t - a.time) / span)) : 0;
  for (const ra of a.robots) {
    const rb = b.robots.find((r) => r.robotId === ra.robotId) ?? ra;
    let pose = poses.get(ra.robotId);
    if (!pose) {
      pose = createPose(ra.robotId);
      poses.set(ra.robotId, pose);
    }
    pose.x = ra.position.x + (rb.position.x - ra.position.x) * k;
    pose.y = ra.position.y + (rb.position.y - ra.position.y) * k;
    pose.z = ra.position.z + (rb.position.z - ra.position.z) * k;
    pose.heading = lerpAngle(ra.heading, rb.heading, k);
    pose.state = k < 0.5 ? ra.state : rb.state;
    pose.carrying = k < 0.5 ? ra.carrying : rb.carrying;
  }
}
