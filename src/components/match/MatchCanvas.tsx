"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Loader } from "@react-three/drei";
import { EffectComposer, Bloom, N8AO, SMAA, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import * as THREE from "three";
import { HumanoidRobot } from "@/components/robots/HumanoidRobot";
import { MatchArena } from "./MatchArena";
import { BroadcastHUD } from "./BroadcastHUD";
import { WinnerScreen } from "./WinnerScreen";
import type { MatchConfig, MatchState, PlayerState, PlayerId } from "@/lib/match/types";
import type { RobotId } from "@/lib/robots/profiles";
import { createPose, type RobotPose } from "@/lib/simulation/replay";
import {
  createInitialMatchState,
  createAIBehaviors,
  tickMatch,
  getMatchResult,
  type AIBehavior,
} from "@/lib/match/engine";

type CameraMode = "third" | "spectator" | "broadcast";

interface MatchCameraProps {
  follow: PlayerState;
  mode: CameraMode;
  arena: { width: number; depth: number };
}

function MatchCamera({ follow, mode, arena }: MatchCameraProps) {
  const smooth = useRef(new THREE.Vector3(0, 10, -15));
  const look = useRef(new THREE.Vector3(0, 0, 0));
  const heading = useRef(follow.heading);

  useFrame(({ camera }, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const t = new THREE.Vector3(follow.position.x, follow.position.y, follow.position.z);

    let dh = follow.heading - heading.current;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    heading.current += dh * (1 - Math.exp(-dt * 2.5));

    look.current.lerp(new THREE.Vector3(t.x, t.y + 1.2, t.z), 1 - Math.exp(-dt * 6));

    if (mode === "broadcast") {
      const angle = Date.now() * 0.0001;
      const radius = Math.max(arena.width, arena.depth) * 0.8;
      const desired = new THREE.Vector3(
        Math.sin(angle) * radius,
        18,
        Math.cos(angle) * radius
      );
      smooth.current.lerp(desired, 1 - Math.exp(-dt * 0.5));
      camera.position.copy(smooth.current);
      camera.lookAt(0, 0, 0);
      return;
    }

    if (mode === "spectator") {
      const desired = new THREE.Vector3(
        t.x + Math.sin(heading.current + Math.PI / 4) * 12,
        8,
        t.z + Math.cos(heading.current + Math.PI / 4) * 12
      );
      smooth.current.lerp(desired, 1 - Math.exp(-dt * 3));
      camera.position.copy(smooth.current);
      camera.lookAt(look.current);
      return;
    }

    const h = heading.current;
    const dist = 6;
    const desired = new THREE.Vector3(
      t.x - Math.sin(h) * dist,
      t.y + 2.5,
      t.z - Math.cos(h) * dist
    );
    smooth.current.lerp(desired, 1 - Math.exp(-dt * 5));
    camera.position.copy(smooth.current);
    camera.lookAt(look.current);
  });

  return null;
}

function Effects() {
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <N8AO halfRes aoRadius={1.2} intensity={2} distanceFalloff={1} quality="medium" />
      <Bloom
        mipmapBlur
        luminanceThreshold={1.1}
        luminanceSmoothing={0.25}
        intensity={0.6}
        radius={0.6}
      />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <SMAA />
      <Vignette offset={0.2} darkness={0.5} />
    </EffectComposer>
  );
}

interface MatchPlayerProps {
  player: PlayerState;
  pose: RobotPose;
  isSelected: boolean;
  teamColor: string;
}

function MatchPlayer({ player, pose }: MatchPlayerProps) {
  useFrame(() => {
    pose.x = player.position.x;
    pose.y = player.position.y;
    pose.z = player.position.z;
    pose.heading = player.heading;
    pose.state = player.velocity > 0.1 ? "NAVIGATING" : "IDLE";
  });

  return (
    <HumanoidRobot
      robotId={player.robotId as RobotId}
      pose={pose}
      selected={false}
      headlamp={false}
      label={false}
    />
  );
}

interface SceneProps {
  config: MatchConfig;
  state: MatchState;
  controlledPlayerId: PlayerId;
  cameraMode: CameraMode;
}

function Scene({ config, state, controlledPlayerId, cameraMode }: SceneProps) {
  const poses = useMemo(() => {
    const map = new Map<PlayerId, RobotPose>();
    for (const player of config.players) {
      map.set(player.id, createPose(player.robotId as RobotId));
    }
    return map;
  }, [config.players]);

  const controlledPlayer = state.players.get(controlledPlayerId);

  return (
    <>
      <MatchArena arena={config.arena} zones={state.zones} />

      {Array.from(state.players.values()).map((player) => {
        const playerConfig = config.players.find((p) => p.id === player.playerId);
        const team = config.teams.find((t) => t.id === player.teamId);
        const pose = poses.get(player.playerId);
        if (!pose || !playerConfig || !team) return null;
        return (
          <MatchPlayer
            key={player.playerId}
            player={player}
            pose={pose}
            isSelected={player.playerId === controlledPlayerId}
            teamColor={team.primaryColor}
          />
        );
      })}

      {controlledPlayer && (
        <MatchCamera follow={controlledPlayer} mode={cameraMode} arena={config.arena} />
      )}

      <Effects />
    </>
  );
}

export interface MatchCanvasProps {
  config: MatchConfig;
  onMatchEnd?: (winner: string | null, scores: Record<string, number>) => void;
}

export function MatchCanvas({ config, onMatchEnd }: MatchCanvasProps) {
  const [state, setState] = useState<MatchState>(() => createInitialMatchState(config));
  const [behaviors] = useState<Map<PlayerId, AIBehavior>>(() => createAIBehaviors(config));
  const [cameraMode, setCameraMode] = useState<CameraMode>("third");
  const [showWinner, setShowWinner] = useState(false);
  const [countdown, setCountdown] = useState(3);

  const humanPlayer = config.players.find((p) => p.isHumanControlled);
  const controlledPlayerId = humanPlayer?.id ?? config.players[0].id;

  const keys = useRef<Record<string, boolean>>({});
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (state.phase === "countdown") {
      setState((s) => ({
        ...s,
        phase: "active",
        events: [...s.events, { time: 0, type: "match_start", detail: "Match started" }],
      }));
    }
  }, [countdown, state.phase]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keys.current[e.key.toLowerCase()] = true;
      if (e.key.toLowerCase() === "c") {
        setCameraMode((m) => {
          const modes: CameraMode[] = ["third", "spectator", "broadcast"];
          return modes[(modes.indexOf(m) + 1) % modes.length];
        });
      }
    };
    const up = (e: KeyboardEvent) => {
      keys.current[e.key.toLowerCase()] = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const matchEndedRef = useRef(false);

  useEffect(() => {
    if (state.phase !== "active") return;

    let raf = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const rawDt = (now - last) / 1000;
      const dt = Math.min(rawDt, 0.1);
      last = now;

      const k = keys.current;
      const forward =
        (k["w"] || k["arrowup"] ? 1 : 0) - (k["s"] || k["arrowdown"] ? 1 : 0);
      const turn =
        (k["a"] || k["arrowleft"] ? 1 : 0) - (k["d"] || k["arrowright"] ? 1 : 0);
      const sprint = k["shift"] ?? false;

      const humanInput = humanPlayer
        ? { playerId: controlledPlayerId, forward, turn, sprint }
        : null;

      setState((prev) => {
        const next = structuredClone(prev) as MatchState;
        next.players = new Map(
          Array.from(prev.players.entries()).map(([k, v]) => [k, { ...v }])
        );
        next.zones = new Map(
          Array.from(prev.zones.entries()).map(([k, v]) => [
            k,
            { ...v, captureProgress: { ...v.captureProgress } },
          ])
        );
        next.scores = new Map(
          Array.from(prev.scores.entries()).map(([k, v]) => [k, { ...v }])
        );

        tickMatch(config, next, behaviors, humanInput, dt);

        if (next.phase === "finished" && !matchEndedRef.current) {
          matchEndedRef.current = true;
          const { winner, finalScores } = getMatchResult(config, next);
          setShowWinner(true);
          onMatchEnd?.(winner, finalScores);
        }

        return next;
      });

      if (stateRef.current.phase === "active") {
        raf = requestAnimationFrame(tick);
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [state.phase, config, behaviors, humanPlayer, controlledPlayerId, onMatchEnd]);

  const handleRestart = useCallback(() => {
    matchEndedRef.current = false;
    setShowWinner(false);
    setCountdown(3);
    setState(createInitialMatchState(config));
  }, [config]);

  const { finalScores, winner, isTie } = useMemo(() => {
    if (state.phase !== "finished") return { finalScores: {}, winner: null, isTie: false };
    return getMatchResult(config, state);
  }, [config, state]);

  return (
    <div className="relative h-full w-full bg-black">
      <Canvas
        shadows="soft"
        flat
        dpr={[1, 2]}
        camera={{ fov: 50, near: 0.1, far: 200, position: [0, 10, -15] }}
        gl={{ antialias: false, powerPreference: "high-performance", stencil: false }}
      >
        <Suspense fallback={null}>
          <Scene
            config={config}
            state={state}
            controlledPlayerId={controlledPlayerId}
            cameraMode={cameraMode}
          />
        </Suspense>
      </Canvas>

      <Loader
        containerStyles={{ background: "#050505" }}
        barStyles={{ background: "#e10600" }}
        dataInterpolation={(p) => `LOADING ARENA ${p.toFixed(0)}%`}
      />

      {countdown > 0 && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-black/70">
          <div className="text-center">
            <p className="text-sm uppercase tracking-[0.5em] text-white/50">MATCH STARTING IN</p>
            <p className="font-display text-[120px] font-bold leading-none text-white">{countdown}</p>
          </div>
        </div>
      )}

      {!showWinner && countdown === 0 && (
        <BroadcastHUD
          config={config}
          state={state}
          controlledPlayerId={controlledPlayerId}
          showControls={cameraMode !== "broadcast"}
        />
      )}

      {showWinner && (
        <WinnerScreen
          config={config}
          state={state}
          winner={winner}
          finalScores={finalScores}
          isTie={isTie}
          onRestart={handleRestart}
        />
      )}
    </div>
  );
}
