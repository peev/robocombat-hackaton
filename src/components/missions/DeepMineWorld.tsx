"use client";

import { useMemo } from "react";
import type { MineralDeposit } from "@/lib/simulation/types";

function Rock({
  position,
  scale = 1,
}: {
  position: [number, number, number];
  scale?: number;
}) {
  return (
    <mesh position={position} castShadow receiveShadow scale={scale}>
      <dodecahedronGeometry args={[0.6, 0]} />
      <meshStandardMaterial color="#4a4038" roughness={0.95} metalness={0.05} />
    </mesh>
  );
}

export function DeepMineWorld({
  deposits,
  lighting,
  collectionPoint,
}: {
  deposits?: MineralDeposit[];
  lighting: number;
  collectionPoint?: { x: number; y: number; z: number };
}) {
  const tunnelLights = useMemo(
    () =>
      Array.from({ length: 10 }).map((_, i) => ({
        pos: [2 + i * 3.5, 2.4, 8] as [number, number, number],
      })),
    []
  );

  return (
    <group>
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[15, 0, 20]} receiveShadow>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color="#2a2218" roughness={1} metalness={0} />
      </mesh>

      {/* Main tunnel walls */}
      <mesh position={[15, 2.5, 5.5]}>
        <boxGeometry args={[50, 5, 1]} />
        <meshStandardMaterial color="#1a1510" roughness={1} />
      </mesh>
      <mesh position={[15, 2.5, 10.5]}>
        <boxGeometry args={[50, 5, 1]} />
        <meshStandardMaterial color="#1a1510" roughness={1} />
      </mesh>
      {/* Ceiling */}
      <mesh position={[15, 4.2, 8]}>
        <boxGeometry args={[50, 0.5, 6]} />
        <meshStandardMaterial color="#12100c" />
      </mesh>

      {/* Side tunnel */}
      <mesh position={[17.5, 2.5, 22]}>
        <boxGeometry args={[1, 5, 28]} />
        <meshStandardMaterial color="#1a1510" />
      </mesh>
      <mesh position={[22.5, 2.5, 22]}>
        <boxGeometry args={[1, 5, 28]} />
        <meshStandardMaterial color="#1a1510" />
      </mesh>

      {/* Chamber */}
      <mesh position={[22, 0.05, 36]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[8, 24]} />
        <meshStandardMaterial color="#33281e" />
      </mesh>

      {/* Support beams */}
      {Array.from({ length: 8 }).map((_, i) => (
        <group key={i} position={[i * 4, 0, 8]}>
          <mesh position={[-1.8, 2, 0]}>
            <boxGeometry args={[0.25, 4, 0.25]} />
            <meshStandardMaterial color="#5c4033" />
          </mesh>
          <mesh position={[1.8, 2, 0]}>
            <boxGeometry args={[0.25, 4, 0.25]} />
            <meshStandardMaterial color="#5c4033" />
          </mesh>
          <mesh position={[0, 3.9, 0]}>
            <boxGeometry args={[4, 0.25, 0.25]} />
            <meshStandardMaterial color="#5c4033" />
          </mesh>
        </group>
      ))}

      {/* Mining cart */}
      <mesh position={[10, 0.45, 7.2]} castShadow>
        <boxGeometry args={[1.4, 0.7, 0.9]} />
        <meshStandardMaterial color="#3a3a3a" metalness={0.7} roughness={0.35} />
      </mesh>

      {/* Excavator-ish machine */}
      <mesh position={[6, 1, 9.2]} castShadow>
        <boxGeometry args={[2.2, 1.6, 1.4]} />
        <meshStandardMaterial color="#c45c00" metalness={0.4} roughness={0.5} />
      </mesh>
      <mesh position={[7.4, 1.8, 9.2]} rotation={[0, 0, -0.4]}>
        <boxGeometry args={[2, 0.3, 0.3]} />
        <meshStandardMaterial color="#222" metalness={0.8} />
      </mesh>

      {/* Collection station */}
      {collectionPoint && (
        <group position={[collectionPoint.x, 0, collectionPoint.z]}>
          <mesh position={[0, 0.8, 0]} castShadow>
            <boxGeometry args={[2.5, 1.6, 1.5]} />
            <meshStandardMaterial
              color="#1a3a2a"
              emissive="#00ff88"
              emissiveIntensity={0.15}
            />
          </mesh>
          <pointLight position={[0, 2, 0]} color="#44ff99" intensity={2} distance={8} />
        </group>
      )}

      {/* Mineral deposits */}
      {deposits?.map((d) => (
        <group key={d.id} position={[d.position.x, d.position.y, d.position.z]}>
          <mesh castShadow>
            <icosahedronGeometry args={[0.55, 0]} />
            <meshStandardMaterial
              color={d.id === "ore-alpha" ? "#d4a017" : "#6b5b3a"}
              metalness={0.85}
              roughness={0.25}
              emissive={d.identified ? "#ffcc33" : "#000"}
              emissiveIntensity={d.identified ? 0.4 : 0}
            />
          </mesh>
        </group>
      ))}

      {/* Debris rocks */}
      <Rock position={[4, 0.3, 7.5]} scale={0.8} />
      <Rock position={[12, 0.25, 8.8]} scale={0.6} />
      <Rock position={[19, 0.35, 20]} scale={1.1} />
      <Rock position={[24, 0.3, 34]} scale={0.9} />
      <Rock position={[21, 0.2, 38]} scale={0.7} />

      {/* Dust motes */}
      {Array.from({ length: 20 }).map((_, i) => (
        <mesh
          key={i}
          position={[
            (i * 3.7) % 40,
            1 + (i % 5) * 0.4,
            6 + (i % 3),
          ]}
        >
          <sphereGeometry args={[0.04, 4, 4]} />
          <meshBasicMaterial color="#c4b89a" transparent opacity={0.35} />
        </mesh>
      ))}

      {tunnelLights.map((l, i) => (
        <group key={i}>
          <mesh position={l.pos}>
            <boxGeometry args={[0.4, 0.15, 0.2]} />
            <meshStandardMaterial
              color="#222"
              emissive="#ffd8a0"
              emissiveIntensity={lighting * 2}
            />
          </mesh>
          <pointLight
            position={[l.pos[0], l.pos[1] - 0.2, l.pos[2]]}
            color="#ffd8a0"
            intensity={lighting * 3}
            distance={7}
            decay={2}
          />
        </group>
      ))}

      <ambientLight intensity={0.04 + lighting * 0.08} />
      <hemisphereLight args={["#2a2218", "#050403", 0.2]} />
    </group>
  );
}
