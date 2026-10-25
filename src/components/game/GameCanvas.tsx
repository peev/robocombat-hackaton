"use client";

import { Suspense, useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Loader } from "@react-three/drei";
import { EffectComposer, Bloom, N8AO, SMAA, ToneMapping, Vignette, Noise } from "@react-three/postprocessing";
import { ToneMappingMode, BlendFunction } from "postprocessing";
import * as THREE from "three";
import { HumanoidRobot } from "@/components/robots/HumanoidRobot";
import { FireRescueWorld } from "@/components/missions/FireRescueWorld";
import { DeepMineWorld } from "@/components/missions/DeepMineWorld";
import { GameCamera, type CameraMode } from "./GameCamera";
import { DirectorCamera, type DirectorFocus } from "./DirectorCamera";
import type { ExperimentResult, MissionId, RobotTelemetry } from "@/lib/simulation/types";
import type { RobotId } from "@/lib/robots/profiles";
import { ROBOT_IDS, getRobot } from "@/lib/robots/profiles";
import { createPose, samplePoses, snapshotAt, type RobotPose } from "@/lib/simulation/replay";

export interface LiveRobot {
  robotId: RobotId;
  position: [number, number, number];
  heading: number;
  velocity: number;
  state: RobotTelemetry["state"];
  carrying: boolean;
}

export type CanvasMode = "free-play" | "replay" | "cinematic" | "director";

interface GameCanvasProps {
  mission: MissionId;
  mode: CanvasMode;
  selectedRobot: RobotId;
  cameraMode: CameraMode;
  result?: ExperimentResult | null;
  /** Coarse replay time for world state (fire, deposits). */
  replayTime?: number;
  /** Precise replay time read every frame for robot motion. */
  replayClock?: { current: number };
  freeRobots?: LiveRobot[];
  cinematicPhase?: number;
  quality?: "high" | "low";
  onDirectorFocus?: (f: DirectorFocus) => void;
  /** Robot the director camera is featuring; only it gets a floating label. */
  focusRobot?: RobotId | null;
}

function MissionWorld({
  mission,
  result,
  replayTime,
  poses,
  quality,
}: {
  mission: MissionId;
  result?: ExperimentResult | null;
  replayTime: number;
  poses: Map<RobotId, RobotPose>;
  quality: "high" | "low";
}) {
  const snap = result ? snapshotAt(result, replayTime) : null;
  const conditions = result?.config.conditions;
  if (mission === "fire-rescue") {
    return (
      <FireRescueWorld
        fire={snap?.world.fire}
        obstacles={snap?.world.obstacles}
        extinguisherPos={snap?.world.extinguisherPos}
        hosePos={snap?.world.hosePos}
        poses={poses}
        quality={quality}
      />
    );
  }
  return (
    <DeepMineWorld
      deposits={
        snap?.world.deposits ?? [
          { id: "ore-alpha", position: { x: 22, y: 0.3, z: 36 }, quantityKg: 2, identified: false, extractedKg: 0 },
          { id: "ore-decoy", position: { x: 18, y: 0.3, z: 34 }, quantityKg: 0.5, identified: false, extractedKg: 0 },
        ]
      }
      lighting={conditions?.lighting ?? 0.7}
      collectionPoint={snap?.world.collectionPoint}
      obstacles={snap?.world.obstacles}
      tunnelAccessibility={conditions?.tunnelAccessibility ?? 1}
      quality={quality}
    />
  );
}

function PoseSampler({
  result,
  clock,
  poses,
}: {
  result: ExperimentResult;
  clock: { current: number };
  poses: Map<RobotId, RobotPose>;
}) {
  useFrame(() => samplePoses(result, clock.current, poses), -1);
  return null;
}

function Effects({ quality }: { quality: "high" | "low" }) {
  const passes: ReactElement[] = [];
  if (quality === "high") {
    passes.push(<N8AO key="ao" halfRes aoRadius={1.6} intensity={2.4} distanceFalloff={1.2} quality="medium" />);
  }
  passes.push(
    <Bloom key="bloom" mipmapBlur luminanceThreshold={1.1} luminanceSmoothing={0.25} intensity={0.85} radius={0.75} />,
    <ToneMapping key="tm" mode={ToneMappingMode.ACES_FILMIC} />,
    <SMAA key="smaa" />,
    <Vignette key="vig" offset={0.22} darkness={0.62} />,
    <Noise key="noise" opacity={0.035} blendFunction={BlendFunction.OVERLAY} />
  );
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      {passes}
    </EffectComposer>
  );
}

function Scene(props: GameCanvasProps & { quality: "high" | "low" }) {
  const {
    mission,
    mode,
    selectedRobot,
    cameraMode,
    result,
    replayTime = 0,
    replayClock,
    freeRobots,
    cinematicPhase = 0,
    quality,
    onDirectorFocus,
    focusRobot,
  } = props;

  const ids: RobotId[] = result?.config.robotIds ?? freeRobots?.map((r) => r.robotId) ?? [...ROBOT_IDS];
  const poses = useMemo(
    () => new Map(ids.map((id) => [id, createPose(id)])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ids.join(","), result?.config.id]
  );

  // Free play drives poses from React state rather than a recorded replay.
  if (!result && freeRobots) {
    for (const r of freeRobots) {
      const p = poses.get(r.robotId);
      if (!p) continue;
      p.x = r.position[0];
      p.y = r.position[1];
      p.z = r.position[2];
      p.heading = r.heading;
      p.state = r.state;
      p.carrying = r.carrying;
    }
  }

  const fallbackClock = useRef(replayTime);
  fallbackClock.current = replayTime;
  const clock = replayClock ?? fallbackClock;

  const snap = result ? snapshotAt(result, replayTime) : null;
  const objective = useMemo(() => {
    if (mission === "fire-rescue") {
      const f = snap?.world.fire?.position ?? { x: 28, y: 0, z: 12 };
      return new THREE.Vector3(f.x, 0, f.z);
    }
    const d = snap?.world.deposits?.find((x) => x.id === "ore-alpha");
    const carrying = Array.from(poses.values()).some((p) => p.carrying);
    const c = snap?.world.collectionPoint ?? { x: 32, y: 0, z: 8 };
    return carrying || !d ? new THREE.Vector3(c.x, 0, c.z) : new THREE.Vector3(d.position.x, 0, d.position.z);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mission, snap]);

  const followPose = poses.get(selectedRobot) ?? poses.values().next().value!;
  const director = mode === "director";

  return (
    <>
      {result && <PoseSampler result={result} clock={clock} poses={poses} />}
      <MissionWorld mission={mission} result={result} replayTime={replayTime} poses={poses} quality={quality} />
      {ids.map((id) => (
        <HumanoidRobot
          key={id}
          robotId={id}
          pose={poses.get(id)!}
          selected={!director && id === selectedRobot}
          headlamp={mission === "deep-mine"}
          label={director && id === focusRobot}
          aimTarget={mission === "fire-rescue" ? objective : null}
        />
      ))}
      {director ? (
        <DirectorCamera mission={mission} poses={poses} objective={objective} onFocus={onDirectorFocus} />
      ) : (
        <GameCamera
          follow={followPose}
          mode={mode === "cinematic" ? "cinematic" : cameraMode}
          cinematicPhase={cinematicPhase}
          mission={mission}
        />
      )}
      <Effects quality={quality} />
    </>
  );
}

export function GameCanvas(props: GameCanvasProps) {
  const { mission, selectedRobot, quality = "high", mode } = props;
  return (
    <div className="relative h-full w-full bg-black">
      <Canvas
        shadows="soft"
        flat
        dpr={quality === "high" ? [1, 2] : [0.75, 1]}
        camera={{ fov: 50, near: 0.1, far: 4000, position: [-10, 8, -12] }}
        gl={{ antialias: false, powerPreference: "high-performance", stencil: false }}
      >
        <Suspense fallback={null}>
          <Scene key={mission} {...props} quality={quality} />
        </Suspense>
      </Canvas>
      <Loader
        containerStyles={{ background: "#050505" }}
        barStyles={{ background: "#e10600" }}
        dataInterpolation={(p) => `LOADING WORLD ${p.toFixed(0)}%`}
      />
      {mode !== "director" && (
        <div className="pointer-events-none absolute left-4 top-4 rounded bg-black/60 px-3 py-1 text-xs tracking-widest text-white/80">
          {mission === "fire-rescue" ? "FIRE RESCUE" : "DEEP MINE"} · {getRobot(selectedRobot).displayName}
        </div>
      )}
    </div>
  );
}

/** Simple free-play WASD controller for the selected robot. */
export function useFreePlayRobots(mission: MissionId, selected: RobotId, enabled: boolean) {
  const keys = useRef<Record<string, boolean>>({});
  const spawn = (i: number): [number, number, number] =>
    mission === "deep-mine" ? [0 + i * 1.6, 0, 8] : [-5 + i * 1.6, 0, -2];
  const [robots, setRobots] = useState<LiveRobot[]>(() =>
    ROBOT_IDS.map((id, i) => ({
      robotId: id,
      position: spawn(i),
      heading: Math.PI / 2,
      velocity: 0,
      state: "IDLE" as const,
      carrying: false,
    }))
  );

  useEffect(() => {
    setRobots((prev) => prev.map((r, i) => ({ ...r, position: spawn(i), heading: Math.PI / 2 })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mission]);

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
