"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { RobotId } from "@/lib/robots/profiles";
import { getRobot } from "@/lib/robots/profiles";
import type { RobotState } from "@/lib/simulation/types";

export interface HumanoidProps {
  robotId: RobotId;
  position: [number, number, number];
  heading: number;
  velocity: number;
  state: RobotState;
  selected?: boolean;
  carrying?: boolean;
  nameplate?: boolean;
}

function Limb({
  args,
  position,
  rotation,
  color,
}: {
  args: [number, number, number];
  position: [number, number, number];
  rotation?: [number, number, number];
  color: string;
}) {
  return (
    <mesh position={position} rotation={rotation} castShadow>
      <boxGeometry args={args} />
      <meshStandardMaterial color={color} metalness={0.55} roughness={0.35} />
    </mesh>
  );
}

export function HumanoidRobot({
  robotId,
  position,
  heading,
  velocity,
  state,
  selected,
  carrying,
}: HumanoidProps) {
  const group = useRef<THREE.Group>(null);
  const leftLeg = useRef<THREE.Group>(null);
  const rightLeg = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);
  const phase = useRef(Math.random() * Math.PI * 2);

  const profile = getRobot(robotId);
  const h = profile.simulation.heightM;
  const scale = h / 1.5;
  const primary = profile.simulation.colorPrimary;
  const accent = profile.simulation.colorAccent;

  const dims = useMemo(
    () => ({
      torso: [0.32 * scale, 0.45 * scale, 0.2 * scale] as [number, number, number],
      head: [0.18 * scale, 0.2 * scale, 0.18 * scale] as [number, number, number],
      upperLeg: [0.12 * scale, 0.32 * scale, 0.12 * scale] as [number, number, number],
      lowerLeg: [0.1 * scale, 0.3 * scale, 0.1 * scale] as [number, number, number],
      upperArm: [0.09 * scale, 0.28 * scale, 0.09 * scale] as [number, number, number],
      lowerArm: [0.08 * scale, 0.26 * scale, 0.08 * scale] as [number, number, number],
    }),
    [scale]
  );

  useFrame((_, dt) => {
    if (!group.current) return;
    group.current.position.set(position[0], position[1], position[2]);
    group.current.rotation.y = heading;

    const moving = velocity > 0.15 && state !== "RECOVERING" && state !== "FAILED";
    const run = velocity > 1.8;
    const cadence = run ? 12 : 8;
    if (moving) phase.current += dt * cadence;
    else phase.current *= 0.9;

    const swing = moving ? Math.sin(phase.current) * (run ? 0.7 : 0.45) : 0;
    const armSwing = moving ? Math.sin(phase.current) * (run ? 0.9 : 0.55) : 0;

    if (leftLeg.current) leftLeg.current.rotation.x = swing;
    if (rightLeg.current) rightLeg.current.rotation.x = -swing;

    const reach =
      state === "INTERACTING" || state === "SUPPRESSING"
        ? 1.1
        : state === "CARRYING" || carrying
          ? 0.6
          : 0;

    if (leftArm.current)
      leftArm.current.rotation.x = -armSwing * 0.8 - reach * 0.5;
    if (rightArm.current)
      rightArm.current.rotation.x = armSwing * 0.8 - reach;

    if (state === "RECOVERING" && group.current) {
      group.current.rotation.z = Math.sin(phase.current * 2) * 0.25;
    } else if (group.current) {
      group.current.rotation.z *= 0.8;
    }
  });

  return (
    <group ref={group}>
      {/* Torso */}
      <mesh position={[0, 0.95 * scale, 0]} castShadow>
        <boxGeometry args={dims.torso} />
        <meshStandardMaterial color={primary} metalness={0.6} roughness={0.3} />
      </mesh>
      {/* Chest accent */}
      <mesh position={[0, 1.0 * scale, 0.11 * scale]}>
        <boxGeometry args={[0.2 * scale, 0.15 * scale, 0.02 * scale]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.25} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 1.35 * scale, 0]} castShadow>
        <boxGeometry args={dims.head} />
        <meshStandardMaterial color={accent} metalness={0.4} roughness={0.4} />
      </mesh>
      {/* Visor */}
      <mesh position={[0, 1.37 * scale, 0.08 * scale]}>
        <boxGeometry args={[0.14 * scale, 0.06 * scale, 0.03 * scale]} />
        <meshStandardMaterial
          color="#66ff99"
          emissive="#33ff66"
          emissiveIntensity={selected ? 1.2 : 0.5}
        />
      </mesh>

      {/* Legs */}
      <group ref={leftLeg} position={[-0.1 * scale, 0.72 * scale, 0]}>
        <Limb args={dims.upperLeg} position={[0, -0.14 * scale, 0]} color={primary} />
        <Limb args={dims.lowerLeg} position={[0, -0.42 * scale, 0]} color={accent} />
      </group>
      <group ref={rightLeg} position={[0.1 * scale, 0.72 * scale, 0]}>
        <Limb args={dims.upperLeg} position={[0, -0.14 * scale, 0]} color={primary} />
        <Limb args={dims.lowerLeg} position={[0, -0.42 * scale, 0]} color={accent} />
      </group>

      {/* Arms */}
      <group ref={leftArm} position={[-0.22 * scale, 1.1 * scale, 0]}>
        <Limb args={dims.upperArm} position={[0, -0.12 * scale, 0]} color={primary} />
        <Limb args={dims.lowerArm} position={[0, -0.36 * scale, 0]} color={accent} />
      </group>
      <group ref={rightArm} position={[0.22 * scale, 1.1 * scale, 0]}>
        <Limb args={dims.upperArm} position={[0, -0.12 * scale, 0]} color={primary} />
        <Limb args={dims.lowerArm} position={[0, -0.36 * scale, 0]} color={accent} />
        {carrying && (
          <mesh position={[0, -0.55 * scale, 0.15 * scale]}>
            <boxGeometry args={[0.2, 0.15, 0.2]} />
            <meshStandardMaterial color="#d4a017" metalness={0.7} roughness={0.3} />
          </mesh>
        )}
      </group>

      {/* Headlamp for mine */}
      <spotLight
        position={[0, 1.4 * scale, 0.2 * scale]}
        angle={0.45}
        penumbra={0.4}
        intensity={state === "FAILED" ? 0 : 2.5}
        distance={18}
        color="#fff2d0"
        castShadow={false}
      />

      {selected && (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.45, 0.55, 32]} />
          <meshBasicMaterial color="#e10600" transparent opacity={0.85} />
        </mesh>
      )}
    </group>
  );
}
