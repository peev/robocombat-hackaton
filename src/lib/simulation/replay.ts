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
  /** Lateral sweep of the hose stream across the seat of the fire (m), driven by the renderer. */
  sweep: number;
}

export function createPose(robotId: RobotId, x = 0, z = 0): RobotPose {
  return { robotId, x, y: 0, z, heading: 0, state: "IDLE", carrying: false, nozzle: null, sweep: 0 };
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

/** Engine spreads robots for display by a fixed +x step per robot (see runExperiment). */
const ENGINE_DISPLAY_OFFSET_X = 1.6;
/** Side-by-side spacing applied across each robot's direction of travel instead. */
const LANE_SPACING = 0.8;

/** Walkable mine volumes from the nav grid, shrunk away from the rock faces. */
const MINE_WALKABLE = [
  { x0: -7.5, x1: 41.5, z0: 5.8, z1: 10.2 },
  { x0: 17.8, x1: 22.2, z0: 5.8, z1: 45.5 },
  { x0: 15.4, x1: 29.6, z0: 28.4, z1: 43.6 },
];

function clampToMine(p: { x: number; z: number }) {
  if (MINE_WALKABLE.some((v) => p.x >= v.x0 && p.x <= v.x1 && p.z >= v.z0 && p.z <= v.z1)) return;
  let best = { x: p.x, z: p.z };
  let bestD = Infinity;
  for (const v of MINE_WALKABLE) {
    const x = Math.min(v.x1, Math.max(v.x0, p.x));
    const z = Math.min(v.z1, Math.max(v.z0, p.z));
    const d = (x - p.x) ** 2 + (z - p.z) ** 2;
    if (d < bestD) {
      bestD = d;
      best = { x, z };
    }
  }
  p.x = best.x;
  p.z = best.z;
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
    const ids = result.config.robotIds;
    const idx = Math.max(0, ids.indexOf(ra.robotId));
    pose.heading = lerpAngle(ra.heading, rb.heading, k);
    // Swap the engine's fixed +x display spread for a lane offset across the direction of
    // travel, so robots walk side by side in any corridor instead of inside the walls.
    const lane = (idx - (ids.length - 1) / 2) * LANE_SPACING;
    const p = {
      x:
        ra.position.x + (rb.position.x - ra.position.x) * k - idx * ENGINE_DISPLAY_OFFSET_X +
        Math.cos(pose.heading) * lane,
      z: ra.position.z + (rb.position.z - ra.position.z) * k - Math.sin(pose.heading) * lane,
    };
    if (result.config.mission === "deep-mine") clampToMine(p);
    pose.x = p.x;
    pose.y = ra.position.y + (rb.position.y - ra.position.y) * k;
    pose.z = p.z;
    pose.state = k < 0.5 ? ra.state : rb.state;
    pose.carrying = k < 0.5 ? ra.carrying : rb.carrying;
  }
}
