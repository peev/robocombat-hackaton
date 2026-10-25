"use client";

import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { RobotId } from "@/lib/robots/profiles";
import type { MissionId } from "@/lib/simulation/types";
import type { RobotPose } from "@/lib/simulation/replay";

type Shot = "establish" | "chase" | "front" | "side" | "low" | "orbit" | "objective";

const SEQUENCES: Record<MissionId, Shot[]> = {
  "fire-rescue": ["establish", "chase", "front", "side", "objective", "low", "orbit", "chase", "front"],
  "deep-mine": ["establish", "chase", "front", "side", "low", "chase", "objective", "front"],
};
const SHOT_SECONDS: Record<Shot, number> = {
  establish: 7,
  chase: 6,
  front: 5,
  side: 5.5,
  low: 4.5,
  orbit: 7,
  objective: 5.5,
};
const SHOT_FOV: Record<Shot, number> = {
  establish: 48,
  chase: 55,
  front: 38,
  side: 42,
  low: 36,
  orbit: 45,
  objective: 40,
};

const ACTIVE_STATES = new Set(["SUPPRESSING", "INTERACTING", "CARRYING", "RECOVERING", "SEARCHING"]);

/** Walkable mine volumes (shrunk from the rock faces) — the camera must stay inside rock. */
const MINE_VOLUMES = [
  { x0: -7.2, x1: 41.2, z0: 6.0, z1: 10.0, ceil: 3.5 },
  { x0: 18.0, x1: 22.0, z0: 6.0, z1: 28.5, ceil: 3.5 },
  { x0: 15.7, x1: 29.3, z0: 28.6, z1: 43.4, ceil: 5.6 },
];

function clampToMine(p: THREE.Vector3) {
  let best: (typeof MINE_VOLUMES)[number] | null = null;
  let bestD = Infinity;
  const q = new THREE.Vector3();
  for (const v of MINE_VOLUMES) {
    const x = THREE.MathUtils.clamp(p.x, v.x0, v.x1);
    const z = THREE.MathUtils.clamp(p.z, v.z0, v.z1);
    const d = (x - p.x) ** 2 + (z - p.z) ** 2;
    if (d < bestD) {
      bestD = d;
      best = v;
      q.set(x, p.y, z);
    }
  }
  if (best) {
    p.x = q.x;
    p.z = q.z;
    p.y = THREE.MathUtils.clamp(p.y, 0.35, best.ceil);
  }
}

function clampToShip(p: THREE.Vector3, fire: THREE.Vector3) {
  p.x = Math.max(p.x, -13.5);
  p.y = Math.max(p.y, 0.4);
  const inContainers = p.x > -9.6 && p.x < 15.6 && p.z > 12.4 && p.z < 23.6;
  if (inContainers && p.y < 8.4) p.y = 8.4;
  // Engine-room deckhouse around the fire is open only on its -z side.
  const inEngineRoom =
    p.x > fire.x - 5.4 && p.x < fire.x + 7.4 && p.z > fire.z - 3.6 && p.z < fire.z + 5.4 && p.y < 5;
  if (inEngineRoom) p.z = fire.z - 4.2;
}

export interface DirectorFocus {
  robotId: RobotId;
  shot: Shot;
}

export function DirectorCamera({
  mission,
  poses,
  objective,
  onFocus,
}: {
  mission: MissionId;
  poses: Map<RobotId, RobotPose>;
  objective: THREE.Vector3;
  onFocus?: (f: DirectorFocus) => void;
}) {
  const { camera } = useThree();
  const state = useRef({
    mission: "" as MissionId | "",
    shotIdx: -1,
    shot: "establish" as Shot,
    shotStart: 0,
    focus: null as RobotId | null,
    focusPos: new THREE.Vector3(),
    prevRaw: new THREE.Vector3(),
    motionDir: new THREE.Vector3(),
    camPos: new THREE.Vector3(),
    look: new THREE.Vector3(),
    elapsed: 0,
    cut: true,
  });

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const s = state.current;
    s.elapsed += dt;
    const ids = Array.from(poses.keys());
    if (!ids.length) return;
    const seq = SEQUENCES[mission];

    if (s.mission !== mission) {
      s.mission = mission;
      s.shotIdx = -1;
      s.shotStart = s.elapsed - 1e3;
    }
    const hauling = mission === "deep-mine" && ids.some((id) => poses.get(id)!.carrying);
    if (s.shotIdx < 0 || s.elapsed - s.shotStart > SHOT_SECONDS[s.shot]) {
      s.shotIdx += 1;
      s.shotStart = s.elapsed;
      s.cut = true;
      // During the ore haul keep the returning column in frame: haul cam alternating with front tracking.
      s.shot = hauling ? (s.shotIdx % 2 === 0 ? "objective" : "front") : seq[s.shotIdx % seq.length];
      const busy = ids.filter((id) => ACTIVE_STATES.has(poses.get(id)!.state) && id !== s.focus);
      s.focus = busy.length ? busy[0] : ids[s.shotIdx % ids.length];
      onFocus?.({ robotId: s.focus, shot: s.shot });
    }
    const shot = s.shot;
    const u = Math.min(1, (s.elapsed - s.shotStart) / SHOT_SECONDS[shot]);
    const pose = poses.get(s.focus ?? ids[0]) ?? poses.get(ids[0])!;

    const raw = new THREE.Vector3(pose.x, pose.y, pose.z);
    const headingDir = new THREE.Vector3(Math.sin(pose.heading), 0, Math.cos(pose.heading));
    if (s.cut) {
      s.focusPos.copy(raw);
      s.prevRaw.copy(raw);
      s.motionDir.copy(headingDir);
    } else {
      s.focusPos.lerp(raw, 1 - Math.exp(-dt * 3));
      const step = raw.clone().sub(s.prevRaw).setY(0);
      s.prevRaw.copy(raw);
      if (step.length() / Math.max(dt, 1e-4) > 0.25) {
        s.motionDir.lerp(step.normalize(), 1 - Math.exp(-dt * 2)).normalize();
      }
    }
    const p = s.focusPos;
    const centroid = new THREE.Vector3();
    for (const id of ids) {
      const q = poses.get(id)!;
      centroid.add(new THREE.Vector3(q.x, q.y, q.z));
    }
    centroid.divideScalar(ids.length);

    const fwd = s.motionDir.clone();
    const right = new THREE.Vector3(fwd.z, 0, -fwd.x);
    const up = new THREE.Vector3(0, 1, 0);
    const pos = new THREE.Vector3();
    const look = new THREE.Vector3();
    const mine = mission === "deep-mine";

    switch (shot) {
      case "establish":
        if (mine) {
          pos.copy(p).addScaledVector(fwd, -6 - u * 2).addScaledVector(up, 2.6 - u * 0.6).addScaledVector(right, 1.2);
          look.copy(p).addScaledVector(fwd, 4).addScaledVector(up, 1);
        } else {
          // Helicopter-style pass over the port side with the low sun behind the camera.
          pos.set(centroid.x - 6 + u * 14, 26 - u * 8, 46 - u * 8);
          look.copy(centroid).lerp(objective, 0.35).addScaledVector(up, 1.5);
        }
        break;
      case "chase":
        pos.copy(p).addScaledVector(fwd, -4.2).addScaledVector(up, 1.9).addScaledVector(right, 0.7);
        look.copy(p).addScaledVector(fwd, 3).addScaledVector(up, 1.1);
        break;
      case "front":
        pos.copy(p).addScaledVector(fwd, 3.8 - u * 1.0).addScaledVector(up, 1.15).addScaledVector(right, 0.5);
        look.copy(p).addScaledVector(up, 1.05);
        break;
      case "side":
        pos.copy(p).addScaledVector(right, mine ? 1.3 : 4.2).addScaledVector(fwd, mine ? 2.2 + u * 1.2 : -1.2 + u * 2.4).addScaledVector(up, 1.35);
        look.copy(p).addScaledVector(up, 1).addScaledVector(fwd, 0.8);
        break;
      case "low":
        pos.copy(p).addScaledVector(fwd, 2.4).addScaledVector(right, -1.3).addScaledVector(up, 0.32);
        look.copy(p).addScaledVector(up, 1.45);
        break;
      case "orbit": {
        const a = pose.heading + Math.PI / 2 + u * 1.3;
        pos.set(centroid.x + Math.cos(a) * 10, centroid.y + 5, centroid.z + Math.sin(a) * 10);
        look.copy(centroid).addScaledVector(up, 1);
        break;
      }
      case "objective": {
        const hauling = mine && ids.some((id) => poses.get(id)!.carrying);
        if (hauling) {
          // Ore haul: frame the column head-on, from the junction while they are still in the
          // side tunnel, then from ahead in the main corridor once they have turned toward the hopper.
          if (centroid.z > 11) pos.set(20.3, 2.3, 6.4);
          else pos.set(Math.min(centroid.x + 7, 40), 2.1, 8.4);
          look.copy(centroid).addScaledVector(up, 1.1);
          break;
        }
        const d = centroid.clone().sub(objective).setY(0).normalize();
        const side = new THREE.Vector3(d.z, 0, -d.x);
        pos.copy(objective).addScaledVector(d, mine ? -1.5 : -3.5).addScaledVector(side, mine ? 1.2 : 2.5).addScaledVector(up, mine ? 1.6 : 2.4);
        look.copy(objective).lerp(centroid, 0.6).addScaledVector(up, 1);
        break;
      }
    }

    if (mine) clampToMine(pos);
    else clampToShip(pos, objective);

    if (s.cut) {
      s.camPos.copy(pos);
      s.look.copy(look);
      s.cut = false;
    } else {
      s.camPos.lerp(pos, 1 - Math.exp(-dt * 2.5));
      s.look.lerp(look, 1 - Math.exp(-dt * 3.5));
    }
    camera.position.copy(s.camPos);
    camera.lookAt(s.look);
    const persp = camera as THREE.PerspectiveCamera;
    const fov = SHOT_FOV[shot];
    if (Math.abs(persp.fov - fov) > 0.05) {
      persp.fov += (fov - persp.fov) * (1 - Math.exp(-dt * 4));
      persp.updateProjectionMatrix();
    }
  });

  return null;
}
