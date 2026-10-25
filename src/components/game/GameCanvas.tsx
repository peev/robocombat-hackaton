"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { HumanoidRobot } from "@/components/robots/HumanoidRobot";
import { FireRescueWorld } from "@/components/missions/FireRescueWorld";
import { DeepMineWorld } from "@/components/missions/DeepMineWorld";
import { GameCamera, type CameraMode } from "./GameCamera";
import type { ExperimentResult, MissionId, RobotTelemetry } from "@/lib/simulation/types";
import type { RobotId } from "@/lib/robots/profiles";
import { getRobot } from "@/lib/robots/profiles";

export interface LiveRobot {
  robotId: RobotId;
  position: [number, number, number];
  heading: number;
  velocity: number;
  state: RobotTelemetry["state"];
  carrying: boolean;
}

interface GameCanvasProps {
  mission: MissionId;
  mode: "free-play" | "replay" | "cinematic";
  selectedRobot: RobotId;
  cameraMode: CameraMode;
  result?: ExperimentResult | null;
  replayTime?: number;
  smokeDensity?: number;
  lighting?: number;
  onRobotChange?: (id: RobotId) => void;
  freeRobots?: LiveRobot[];
  cinematicPhase?: number;
  quality?: "high" | "low";
}

function ReplayScene({
  mission,
  result,
  replayTime,
  selectedRobot,
  cameraMode,
  smokeDensity = 0.35,
  lighting = 0.7,
  cinematicPhase = 0,
}: {
  mission: MissionId;
  result: ExperimentResult;
  replayTime: number;
  selectedRobot: RobotId;
  cameraMode: CameraMode;
  smokeDensity?: number;
  lighting?: number;
  cinematicPhase?: number;
}) {
  const snap = useMemo(() => {
    const snaps = result.snapshots;
    if (!snaps.length) return result.final;
    let best = snaps[0];
    for (const s of snaps) {
      if (s.time <= replayTime) best = s;
      else break;
    }
    return best;
  }, [result, replayTime]);

  const selected = snap.robots.find((r) => r.robotId === selectedRobot) ?? snap.robots[0];
  const target: [number, number, number] = selected
    ? [selected.position.x, selected.position.y, selected.position.z]
    : [0, 0, 0];

  return (
    <>
      {mission === "fire-rescue" ? (
        <FireRescueWorld fire={snap.world.fire} smokeDensity={smokeDensity} />
      ) : (
        <DeepMineWorld
          deposits={snap.world.deposits}
          lighting={lighting}
          collectionPoint={snap.world.collectionPoint}
        />
      )}
      {snap.robots.map((r) => (
        <HumanoidRobot
          key={r.robotId}
          robotId={r.robotId}
          position={[r.position.x, r.position.y, r.position.z]}
          heading={r.heading}
          velocity={r.velocity}
          state={r.state}
          selected={r.robotId === selectedRobot}
          carrying={r.carrying}
        />
      ))}
      <GameCamera
        target={target}
        heading={selected?.heading ?? 0}
        mode={cameraMode}
        cinematicPhase={cinematicPhase}
        mission={mission}
      />
    </>
  );
}

function FreePlayScene({
  mission,
  selectedRobot,
  cameraMode,
  robots,
  smokeDensity,
  lighting,
}: {
  mission: MissionId;
  selectedRobot: RobotId;
  cameraMode: CameraMode;
  robots: LiveRobot[];
  smokeDensity: number;
  lighting: number;
}) {
  const selected = robots.find((r) => r.robotId === selectedRobot) ?? robots[0];
  return (
    <>
      {mission === "fire-rescue" ? (
        <FireRescueWorld
          fire={{
            position: { x: 28, y: 0.5, z: 12 },
            intensity: 0.9,
            spreadRate: 0.08,
            smoke: smokeDensity,
            suppressed: false,
          }}
          smokeDensity={smokeDensity}
        />
      ) : (
        <DeepMineWorld
          lighting={lighting}
          deposits={[
            {
              id: "ore-alpha",
              position: { x: 22, y: 0.3, z: 36 },
              quantityKg: 2,
              identified: false,
              extractedKg: 0,
            },
          ]}
          collectionPoint={{ x: 32, y: 0, z: 8 }}
        />
      )}
      {robots.map((r) => (
        <HumanoidRobot
          key={r.robotId}
          robotId={r.robotId}
          position={r.position}
          heading={r.heading}
          velocity={r.velocity}
          state={r.state}
          selected={r.robotId === selectedRobot}
          carrying={r.carrying}
        />
      ))}
      <GameCamera
        target={selected?.position ?? [0, 0, 0]}
        heading={selected?.heading ?? 0}
        mode={cameraMode}
        mission={mission}
      />
    </>
  );
}

export function GameCanvas(props: GameCanvasProps) {
  const {
    mission,
    mode,
    selectedRobot,
    cameraMode,
    result,
    replayTime = 0,
    smokeDensity = 0.35,
    lighting = 0.7,
    freeRobots,
    cinematicPhase = 0,
    quality = "high",
  } = props;

  return (
    <div className="relative h-full w-full bg-black">
      <Canvas
        shadows={quality === "high"}
        dpr={quality === "high" ? [1, 1.75] : [0.75, 1]}
        camera={{ fov: 55, near: 0.1, far: 200, position: [0, 8, 16] }}
        gl={{ antialias: quality === "high", powerPreference: "high-performance" }}
      >
        <Suspense fallback={null}>
          {mode === "free-play" && freeRobots ? (
            <FreePlayScene
              mission={mission}
              selectedRobot={selectedRobot}
              cameraMode={cameraMode}
              robots={freeRobots}
              smokeDensity={smokeDensity}
              lighting={lighting}
            />
          ) : result ? (
            <ReplayScene
              mission={mission}
              result={result}
              replayTime={replayTime}
              selectedRobot={selectedRobot}
              cameraMode={mode === "cinematic" ? "cinematic" : cameraMode}
              smokeDensity={smokeDensity}
              lighting={lighting}
              cinematicPhase={cinematicPhase}
            />
          ) : (
            <FireRescueWorld smokeDensity={0.3} />
          )}
        </Suspense>
      </Canvas>
      <div className="pointer-events-none absolute left-4 top-4 rounded bg-black/60 px-3 py-1 text-xs tracking-widest text-white/80">
        {mission === "fire-rescue" ? "FIRE RESCUE" : "DEEP MINE"} ·{" "}
        {getRobot(selectedRobot).displayName}
      </div>
    </div>
  );
}

/** Simple free-play WASD controller for the selected robot. */
export function useFreePlayRobots(
  mission: MissionId,
  selected: RobotId,
  enabled: boolean
) {
  const keys = useRef<Record<string, boolean>>({});
  const [robots, setRobots] = useState<LiveRobot[]>(() =>
    (["unitree-g1", "bd-atlas", "agibot-a2"] as RobotId[]).map((id, i) => ({
      robotId: id,
      position: [ -5 + i * 2, 0, mission === "deep-mine" ? 8 : -2 ] as [number, number, number],
      heading: 0,
      velocity: 0,
      state: "IDLE" as const,
      carrying: false,
    }))
  );

  useEffect(() => {
    if (!enabled) return;
    const down = (e: KeyboardEvent) => {
      keys.current[e.key.toLowerCase()] = true;
    };
    const up = (e: KeyboardEvent) => {
      keys.current[e.key.toLowerCase()] = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    const id = window.setInterval(() => {
      setRobots((prev) =>
        prev.map((r) => {
          if (r.robotId !== selected) return { ...r, velocity: 0, state: "IDLE" };
          const profile = getRobot(r.robotId).simulation;
          let heading = r.heading;
          let vx = 0;
          let vz = 0;
          const run = keys.current["shift"];
          const speed = run ? profile.runSpeed : profile.walkSpeed;
          if (keys.current["a"]) heading += 0.06 * profile.turnSpeed;
          if (keys.current["d"]) heading -= 0.06 * profile.turnSpeed;
          if (keys.current["w"]) {
            vx += Math.sin(heading) * speed * 0.05;
            vz += Math.cos(heading) * speed * 0.05;
          }
          if (keys.current["s"]) {
            vx -= Math.sin(heading) * speed * 0.05;
            vz -= Math.cos(heading) * speed * 0.05;
          }
          const moving = Math.hypot(vx, vz) > 0.001;
          return {
            ...r,
            heading,
            position: [r.position[0] + vx, 0, r.position[2] + vz] as [number, number, number],
            velocity: moving ? speed : 0,
            state: moving ? "NAVIGATING" : "IDLE",
          };
        })
      );
    }, 50);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      clearInterval(id);
    };
  }, [enabled, selected, mission]);

  return robots;
}
