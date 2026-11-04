"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Environment, Grid } from "@react-three/drei";
import * as THREE from "three";
import type { ArenaConfig, ZoneState, TeamId } from "@/lib/match/types";
import { ILLUSTRATIVE_TEAMS } from "@/lib/match/config";

interface ZoneMarkerProps {
  position: { x: number; z: number };
  radius: number;
  name: string;
  controlledBy: TeamId | null;
  captureProgress: Record<TeamId, number>;
  contested: boolean;
}

function ZoneMarker({ position, radius, controlledBy, captureProgress, contested }: ZoneMarkerProps) {
  const ringRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  const team = controlledBy ? ILLUSTRATIVE_TEAMS.find((t) => t.id === controlledBy) : null;
  const color = team ? team.primaryColor : "#444444";

  const maxProgress = Math.max(...Object.values(captureProgress));
  const capturingTeam =
    Object.entries(captureProgress).find(([, p]) => p === maxProgress && p > 0)?.[0] ?? null;
  const capTeam = capturingTeam ? ILLUSTRATIVE_TEAMS.find((t) => t.id === capturingTeam) : null;
  const progressColor = capTeam ? capTeam.primaryColor : "#666666";

  useFrame((_, dt) => {
    if (ringRef.current) {
      ringRef.current.rotation.z += dt * 0.3;
    }
    if (glowRef.current) {
      const scale = 1 + Math.sin(Date.now() * 0.003) * 0.05;
      glowRef.current.scale.setScalar(scale);
    }
  });

  return (
    <group position={[position.x, 0.01, position.z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <ringGeometry args={[radius - 0.15, radius, 64]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={contested ? 0.8 : 0.4}
          transparent
          opacity={0.85}
        />
      </mesh>

      {maxProgress > 0 && maxProgress < 1 && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
          <ringGeometry
            args={[radius - 0.3, radius - 0.15, 64, 1, 0, Math.PI * 2 * maxProgress]}
          />
          <meshStandardMaterial
            color={progressColor}
            emissive={progressColor}
            emissiveIntensity={1}
            transparent
            opacity={0.9}
          />
        </mesh>
      )}

      <mesh ref={glowRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
        <circleGeometry args={[radius * 0.95, 64]} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={controlledBy ? 0.15 : 0.05}
        />
      </mesh>

      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, 0]}>
        <ringGeometry args={[radius * 0.3, radius * 0.35, 6]} />
        <meshStandardMaterial
          color={contested ? "#ff9500" : color}
          emissive={contested ? "#ff9500" : color}
          emissiveIntensity={0.6}
          transparent
          opacity={0.7}
        />
      </mesh>
    </group>
  );
}

function TeamBase({
  position,
  teamId,
  heading,
}: {
  position: { x: number; z: number };
  teamId: TeamId;
  heading: number;
}) {
  const team = ILLUSTRATIVE_TEAMS.find((t) => t.id === teamId);
  const color = team?.primaryColor ?? "#666666";

  return (
    <group position={[position.x, 0, position.z]} rotation={[0, heading, 0]}>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3, 1.5]} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={0.3}
          polygonOffset
          polygonOffsetFactor={-1}
        />
      </mesh>
      <mesh position={[0, 0.5, -0.7]} castShadow>
        <boxGeometry args={[2.5, 1, 0.1]} />
        <meshStandardMaterial color={color} metalness={0.6} roughness={0.4} />
      </mesh>
    </group>
  );
}

function ArenaBoundary({ width, depth }: { width: number; depth: number }) {
  const halfW = width / 2;
  const halfD = depth / 2;
  const wallHeight = 1.2;
  const wallThickness = 0.15;

  return (
    <group>
      <mesh position={[0, wallHeight / 2, -halfD - wallThickness / 2]} castShadow receiveShadow>
        <boxGeometry args={[width + wallThickness * 2, wallHeight, wallThickness]} />
        <meshStandardMaterial color="#2a2a2a" metalness={0.7} roughness={0.5} />
      </mesh>
      <mesh position={[0, wallHeight / 2, halfD + wallThickness / 2]} castShadow receiveShadow>
        <boxGeometry args={[width + wallThickness * 2, wallHeight, wallThickness]} />
        <meshStandardMaterial color="#2a2a2a" metalness={0.7} roughness={0.5} />
      </mesh>
      <mesh position={[-halfW - wallThickness / 2, wallHeight / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[wallThickness, wallHeight, depth]} />
        <meshStandardMaterial color="#2a2a2a" metalness={0.7} roughness={0.5} />
      </mesh>
      <mesh position={[halfW + wallThickness / 2, wallHeight / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[wallThickness, wallHeight, depth]} />
        <meshStandardMaterial color="#2a2a2a" metalness={0.7} roughness={0.5} />
      </mesh>
    </group>
  );
}

function ArenaFloor({ width, depth }: { width: number; depth: number }) {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.9} metalness={0.1} />
      </mesh>
      <Grid
        position={[0, 0.001, 0]}
        args={[width, depth]}
        cellSize={2}
        cellThickness={0.5}
        cellColor="#333333"
        sectionSize={10}
        sectionThickness={1}
        sectionColor="#444444"
        fadeDistance={60}
        fadeStrength={1}
        infiniteGrid={false}
      />
      <mesh position={[0, 0.003, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.3, depth]} />
        <meshStandardMaterial color="#333333" />
      </mesh>
    </group>
  );
}

function ArenaLighting() {
  const sunTarget = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.set(0, 0, 0);
    return o;
  }, []);

  return (
    <>
      <primitive object={sunTarget} />
      <directionalLight
        position={[15, 25, 10]}
        target={sunTarget}
        color="#ffffff"
        intensity={1.8}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-25}
        shadow-camera-right={25}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        shadow-camera-near={1}
        shadow-camera-far={80}
        shadow-bias={-0.0003}
      />
      <hemisphereLight args={["#6699cc", "#222222", 0.5]} />
      <ambientLight intensity={0.3} />
    </>
  );
}

export interface MatchArenaProps {
  arena: ArenaConfig;
  zones: Map<string, ZoneState>;
}

export function MatchArena({ arena, zones }: MatchArenaProps) {
  return (
    <group>
      <Environment
        files="/hdri/sunset_2k.hdr"
        background
        backgroundIntensity={0.3}
        environmentIntensity={0.6}
      />
      <fog attach="fog" args={["#0d0d0d", 40, 120]} />

      <ArenaFloor width={arena.width} depth={arena.depth} />
      <ArenaBoundary width={arena.width} depth={arena.depth} />
      <ArenaLighting />

      {arena.zones.map((zone) => {
        const zoneState = zones.get(zone.id);
        return (
          <ZoneMarker
            key={zone.id}
            position={zone.position}
            radius={zone.radius}
            name={zone.name}
            controlledBy={zoneState?.controlledBy ?? null}
            captureProgress={zoneState?.captureProgress ?? {}}
            contested={zoneState?.contested ?? false}
          />
        );
      })}

      {Object.entries(arena.teamSpawns).flatMap(([teamId, spawns]) =>
        spawns.map((spawn, i) => (
          <TeamBase
            key={`${teamId}-${i}`}
            position={{ x: spawn.x, z: spawn.z }}
            teamId={teamId}
            heading={spawn.heading}
          />
        ))
      )}
    </group>
  );
}
