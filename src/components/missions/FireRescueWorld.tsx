"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { FireState } from "@/lib/simulation/types";

function Container({
  position,
  color,
}: {
  position: [number, number, number];
  color: string;
}) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={[2.4, 2.6, 6]} />
      <meshStandardMaterial color={color} metalness={0.45} roughness={0.55} />
    </mesh>
  );
}

function Flame({ intensity, position }: { intensity: number; position: [number, number, number] }) {
  const group = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!group.current) return;
    const t = clock.elapsedTime;
    group.current.scale.y = 0.6 + intensity * 1.4 + Math.sin(t * 9) * 0.15;
    group.current.scale.x = 0.7 + intensity * 0.8 + Math.sin(t * 7) * 0.1;
    group.current.position.y = position[1] + intensity * 0.8;
  });

  if (intensity <= 0.05) return null;

  return (
    <group ref={group} position={position}>
      <mesh>
        <coneGeometry args={[0.6, 2.2, 8]} />
        <meshStandardMaterial
          color="#ff4d00"
          emissive="#ff2200"
          emissiveIntensity={2 + intensity * 3}
          transparent
          opacity={0.85}
        />
      </mesh>
      <mesh position={[0.3, 0.4, 0.1]}>
        <coneGeometry args={[0.35, 1.4, 6]} />
        <meshStandardMaterial
          color="#ffcc00"
          emissive="#ffaa00"
          emissiveIntensity={3}
          transparent
          opacity={0.7}
        />
      </mesh>
      <pointLight color="#ff6600" intensity={intensity * 8} distance={18} decay={2} />
      {/* Smoke billboards */}
      {Array.from({ length: 6 }).map((_, i) => (
        <mesh
          key={i}
          position={[
            Math.sin(i) * 0.5,
            1.5 + i * 0.6,
            Math.cos(i * 1.3) * 0.4,
          ]}
        >
          <sphereGeometry args={[0.5 + i * 0.15, 8, 8]} />
          <meshStandardMaterial
            color="#333"
            transparent
            opacity={0.15 + intensity * 0.2}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

export function FireRescueWorld({
  fire,
  smokeDensity,
}: {
  fire?: FireState;
  smokeDensity: number;
}) {
  const containers = useMemo(() => {
    const colors = ["#8B1E1E", "#1E3A5F", "#2F4F2F", "#5C4033", "#3d3d3d"];
    const list: { pos: [number, number, number]; color: string }[] = [];
    for (let i = 0; i < 12; i++) {
      list.push({
        pos: [-8 + (i % 4) * 6, 1.3, 2 + Math.floor(i / 4) * 5],
        color: colors[i % colors.length],
      });
    }
    return list;
  }, []);

  return (
    <group>
      {/* Ocean */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[20, -2.2, 10]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#0a2744" metalness={0.6} roughness={0.25} />
      </mesh>

      {/* Ship hull deck */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[15, 0, 8]} receiveShadow>
        <planeGeometry args={[70, 36]} />
        <meshStandardMaterial color="#2a2d32" metalness={0.7} roughness={0.4} />
      </mesh>

      {/* Deck edge rails */}
      <mesh position={[15, 0.6, -9.5]}>
        <boxGeometry args={[70, 1.2, 0.3]} />
        <meshStandardMaterial color="#444" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position={[15, 0.6, 25.5]}>
        <boxGeometry args={[70, 1.2, 0.3]} />
        <meshStandardMaterial color="#444" metalness={0.8} roughness={0.3} />
      </mesh>

      {/* Superstructure / bridge */}
      <mesh position={[-12, 4, 8]} castShadow>
        <boxGeometry args={[8, 8, 10]} />
        <meshStandardMaterial color="#1c1f24" metalness={0.5} roughness={0.45} />
      </mesh>
      <mesh position={[-12, 8.5, 8]}>
        <boxGeometry args={[6, 1.5, 7]} />
        <meshStandardMaterial color="#111" metalness={0.6} roughness={0.3} />
      </mesh>

      {/* Engine room entrance */}
      <mesh position={[26, 2, 12]} castShadow>
        <boxGeometry args={[10, 4, 8]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.55} roughness={0.5} />
      </mesh>
      <mesh position={[21.2, 1.2, 12]}>
        <boxGeometry args={[0.3, 2.4, 1.6]} />
        <meshStandardMaterial color="#222" emissive="#441111" emissiveIntensity={0.4} />
      </mesh>

      {/* Pipes */}
      {[-2, 4, 10].map((z, i) => (
        <mesh key={i} position={[10 + i * 4, 3.2, z]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.15, 0.15, 12, 8]} />
          <meshStandardMaterial color="#6a6a6a" metalness={0.85} roughness={0.25} />
        </mesh>
      ))}

      {/* Stairs */}
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[20, 0.15 + i * 0.35, 6 + i * 0.4]} castShadow>
          <boxGeometry args={[1.5, 0.3, 0.5]} />
          <meshStandardMaterial color="#555" metalness={0.7} roughness={0.4} />
        </mesh>
      ))}

      {/* Extinguisher */}
      <mesh position={[8, 0.5, 4]} castShadow>
        <cylinderGeometry args={[0.15, 0.18, 0.9, 12]} />
        <meshStandardMaterial color="#cc0000" metalness={0.4} roughness={0.4} />
      </mesh>
      <mesh position={[8, 1.05, 4]}>
        <boxGeometry args={[0.2, 0.15, 0.2]} />
        <meshStandardMaterial color="#222" />
      </mesh>

      {/* Hose station */}
      <mesh position={[18, 0.6, 10]} castShadow>
        <torusGeometry args={[0.45, 0.12, 8, 16]} />
        <meshStandardMaterial color="#e8e8e8" metalness={0.3} roughness={0.5} />
      </mesh>

      {/* Emergency lights */}
      <pointLight position={[8, 4, 4]} color="#ff2222" intensity={2} distance={12} />
      <pointLight position={[22, 3, 12]} color="#ffaa00" intensity={1.5} distance={10} />

      {containers.map((c, i) => (
        <Container key={i} position={c.pos} color={c.color} />
      ))}

      {/* Machinery */}
      <mesh position={[14, 1, 16]} castShadow>
        <boxGeometry args={[3, 2, 2]} />
        <meshStandardMaterial color="#3a3a3a" metalness={0.7} roughness={0.35} />
      </mesh>

      {fire && (
        <Flame
          intensity={fire.intensity}
          position={[fire.position.x, fire.position.y, fire.position.z]}
        />
      )}

      {/* Ambient smoke haze */}
      {smokeDensity > 0.2 && (
        <mesh position={[20, 4, 10]}>
          <sphereGeometry args={[14, 16, 16]} />
          <meshStandardMaterial
            color="#222"
            transparent
            opacity={smokeDensity * 0.12}
            depthWrite={false}
          />
        </mesh>
      )}

      <ambientLight intensity={0.25} />
      <directionalLight
        position={[30, 40, -10]}
        intensity={1.1}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <hemisphereLight args={["#87a0b8", "#1a1a1a", 0.35]} />
    </group>
  );
}
