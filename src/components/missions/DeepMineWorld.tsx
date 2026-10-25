"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import * as THREE from "three";
import type { MineralDeposit, Vec3 } from "@/lib/simulation/types";
import { fbm3, preloadPbr, usePbr } from "@/components/world/pbr";
import { Dust } from "@/components/world/effects";

preloadPbr("rockwall", "minefloor", "timber", "rust");

const CORRIDOR_H = 4.2;
const CHAMBER_H = 6.6;
const TILE = 3;

interface WallDef {
  a: [number, number];
  b: [number, number];
  n: [number, number];
  h: number;
}

/** Wall faces traced around the walkable regions used by the simulation's nav grid. */
const WALLS: WallDef[] = [
  { a: [-8, 5.4], b: [42, 5.4], n: [0, 1], h: CORRIDOR_H },
  { a: [-8, 10.6], b: [17.4, 10.6], n: [0, -1], h: CORRIDOR_H },
  { a: [22.6, 10.6], b: [42, 10.6], n: [0, -1], h: CORRIDOR_H },
  { a: [-8, 5.4], b: [-8, 10.6], n: [1, 0], h: CORRIDOR_H },
  { a: [42, 5.4], b: [42, 10.6], n: [-1, 0], h: CORRIDOR_H },
  { a: [17.4, 10.6], b: [17.4, 28], n: [1, 0], h: CORRIDOR_H },
  { a: [22.6, 10.6], b: [22.6, 28], n: [-1, 0], h: CORRIDOR_H },
  { a: [15, 28], b: [17.4, 28], n: [0, 1], h: CHAMBER_H },
  { a: [22.6, 28], b: [30, 28], n: [0, 1], h: CHAMBER_H },
  { a: [15, 44], b: [30, 44], n: [0, -1], h: CHAMBER_H },
  { a: [15, 28], b: [15, 44], n: [1, 0], h: CHAMBER_H },
  { a: [30, 28], b: [30, 44], n: [-1, 0], h: CHAMBER_H },
];

const CEILINGS: { x0: number; x1: number; z0: number; z1: number; y: number }[] = [
  { x0: -8, x1: 42, z0: 5.4, z1: 10.6, y: CORRIDOR_H },
  { x0: 17.4, x1: 22.6, z0: 10.6, z1: 28, y: CORRIDOR_H },
  { x0: 15, x1: 30, z0: 28, z1: 44, y: CHAMBER_H },
];

/** Displaced rock sheet in local XY (normal +Z faces the tunnel interior). */
function rockSheet(width: number, height: number, seed: number, ox: number, oy: number) {
  const segX = Math.max(8, Math.round(width * 3));
  const segY = Math.max(6, Math.round(height * 3));
  const g = new THREE.PlaneGeometry(width, height, segX, segY);
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  const uv = g.getAttribute("uv") as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const wx = x + ox;
    const wy = y + oy;
    const big = fbm3(wx * 0.32 + seed, wy * 0.32, seed * 1.7, 4) * 0.5 + 0.5;
    const small = fbm3(wx * 1.4, wy * 1.4 + seed, seed, 3);
    const edge = Math.min(1, Math.abs(Math.abs(y) - height / 2) * 0.8 + 0.4);
    pos.setZ(i, -(0.08 + big * 0.75 * edge + small * 0.12));
    uv.setXY(i, (x + width / 2 + ox) / TILE, (y + height / 2 + oy) / TILE);
  }
  g.computeVertexNormals();
  return g;
}

function RockWalls({ material }: { material: THREE.Material }) {
  const meshes = useMemo(
    () =>
      WALLS.map((w, i) => {
        const dx = w.b[0] - w.a[0];
        const dz = w.b[1] - w.a[1];
        const len = Math.hypot(dx, dz) + 1.6;
        const h = w.h + 0.8;
        const geo = rockSheet(len, h, i * 3.71, w.a[0] + w.a[1], 0);
        return {
          geo,
          pos: [(w.a[0] + w.b[0]) / 2, h / 2 - 0.4, (w.a[1] + w.b[1]) / 2] as [number, number, number],
          rotY: Math.atan2(w.n[0], w.n[1]),
        };
      }),
    []
  );
  const ceilings = useMemo(
    () =>
      CEILINGS.map((c, i) => ({
        geo: rockSheet(c.x1 - c.x0 + 1.6, c.z1 - c.z0 + 1.6, 20 + i * 5.3, c.x0, c.z0),
        pos: [(c.x0 + c.x1) / 2, c.y, (c.z0 + c.z1) / 2] as [number, number, number],
      })),
    []
  );
  return (
    <group>
      {meshes.map((m, i) => (
        <mesh key={i} geometry={m.geo} material={material} position={m.pos} rotation={[0, m.rotY, 0]} receiveShadow castShadow />
      ))}
      {ceilings.map((c, i) => (
        <mesh key={`c${i}`} geometry={c.geo} material={material} position={c.pos} rotation={[Math.PI / 2, 0, 0]} receiveShadow />
      ))}
    </group>
  );
}

/* --------------------------------------------------------------- timber */

function TimberSets() {
  const wood = usePbr("timber", [1, 2]);
  const sets = useMemo(() => {
    const list: { pos: [number, number, number]; along: "x" | "z"; span: number }[] = [];
    for (let x = -6; x <= 40; x += 4) {
      if (x > 16 && x < 24) continue;
      list.push({ pos: [x, 0, 8], along: "x", span: 5.2 });
    }
    for (let z = 13; z <= 26; z += 4) list.push({ pos: [20, 0, z], along: "z", span: 5.2 });
    return list;
  }, []);
  const mat = <meshStandardMaterial {...wood} color="#a48a6c" roughness={0.95} />;
  return (
    <group>
      {sets.map((s, i) => {
        const half = s.span / 2 - 0.2;
        const posts: [number, number, number][] =
          s.along === "x"
            ? [
                [s.pos[0], 1.95, s.pos[2] - half],
                [s.pos[0], 1.95, s.pos[2] + half],
              ]
            : [
                [s.pos[0] - half, 1.95, s.pos[2]],
                [s.pos[0] + half, 1.95, s.pos[2]],
              ];
        return (
          <group key={i}>
            {posts.map((p, j) => (
              <mesh key={j} position={p} rotation={[0, 0, (j ? 1 : -1) * 0.04]} castShadow receiveShadow>
                <boxGeometry args={[0.28, 3.9, 0.28]} />
                {mat}
              </mesh>
            ))}
            <mesh
              position={[s.pos[0], 3.95, s.pos[2]]}
              rotation={[0, s.along === "x" ? Math.PI / 2 : 0, 0]}
              castShadow
              receiveShadow
            >
              <boxGeometry args={[s.span, 0.3, 0.32]} />
              {mat}
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/* ---------------------------------------------------------------- rails */

function RailTrack() {
  const sleepers = useRef<THREE.InstancedMesh>(null);
  const count = 70;
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    for (let i = 0; i < count; i++) {
      m.makeTranslation(-7.5 + i * 0.7, 0.04, 6.65);
      sleepers.current?.setMatrixAt(i, m);
    }
    if (sleepers.current) sleepers.current.instanceMatrix.needsUpdate = true;
  }, []);
  return (
    <group>
      <instancedMesh ref={sleepers} args={[undefined, undefined, count]} receiveShadow>
        <boxGeometry args={[0.22, 0.08, 1.3]} />
        <meshStandardMaterial color="#3b2d22" roughness={1} />
      </instancedMesh>
      {[6.3, 7.0].map((z) => (
        <mesh key={z} position={[16.5, 0.12, z]} castShadow receiveShadow>
          <boxGeometry args={[48.5, 0.09, 0.07]} />
          <meshStandardMaterial color="#8d8a86" metalness={0.95} roughness={0.35} />
        </mesh>
      ))}
      {/* Ore cart */}
      <group position={[-5, 0, 6.65]}>
        <mesh position={[0, 0.75, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.8, 0.9, 1.1]} />
          <meshStandardMaterial color="#4a3b2f" metalness={0.75} roughness={0.6} />
        </mesh>
        <mesh position={[0, 1.18, 0]}>
          <dodecahedronGeometry args={[0.55, 1]} />
          <meshStandardMaterial color="#2f2822" roughness={1} />
        </mesh>
        {[-0.6, 0.6].flatMap((dx) =>
          [-0.35, 0.35].map((dz) => (
            <mesh key={`${dx}${dz}`} position={[dx, 0.22, dz]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.2, 0.2, 0.08, 16]} />
              <meshStandardMaterial color="#222" metalness={0.9} roughness={0.4} />
            </mesh>
          ))
        )}
      </group>
    </group>
  );
}

/* ---------------------------------------------------------------- lamps */

function MineLamp({ position, lighting, flicker }: { position: [number, number, number]; lighting: number; flicker?: boolean }) {
  const light = useRef<THREE.PointLight>(null);
  const bulb = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    let f = 1;
    if (flicker) f = Math.sin(t * 23) > 0.93 || Math.sin(t * 3.1) > 0.97 ? 0.15 : 0.95 + Math.sin(t * 40) * 0.05;
    if (light.current) light.current.intensity = lighting * 75 * f;
    if (bulb.current) bulb.current.emissiveIntensity = lighting * 9 * f;
  });
  return (
    <group position={position}>
      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.01, 0.01, 0.5, 4]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.09, 16, 12]} />
        <meshStandardMaterial ref={bulb} color="#fff1d0" emissive="#ffcf86" emissiveIntensity={6} />
      </mesh>
      <mesh>
        <cylinderGeometry args={[0.13, 0.13, 0.22, 8, 1, true]} />
        <meshStandardMaterial color="#222" metalness={0.8} roughness={0.5} wireframe />
      </mesh>
      <pointLight ref={light} color="#ffc677" intensity={30} distance={14} decay={2} />
    </group>
  );
}

function Lamps({ lighting }: { lighting: number }) {
  const spots: { p: [number, number, number]; flicker?: boolean }[] = [
    { p: [-5, 3.5, 8] },
    { p: [2, 3.5, 8] },
    { p: [9, 3.5, 8], flicker: true },
    { p: [15, 3.5, 8] },
    { p: [20, 3.5, 8] },
    { p: [27, 3.5, 8] },
    { p: [34, 3.5, 8] },
    { p: [40, 3.5, 8] },
    { p: [20, 3.5, 15] },
    { p: [20, 3.5, 22], flicker: true },
    { p: [19, 5.4, 33] },
    { p: [26, 5.4, 39] },
  ];
  return (
    <group>
      {spots.map((s, i) => (
        <MineLamp key={i} position={s.p} lighting={lighting} flicker={s.flicker} />
      ))}
      {/* Power cable */}
      <mesh position={[17, 3.75, 8]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.02, 0.02, 50, 4]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      <mesh position={[20, 3.75, 19]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 22, 4]} />
        <meshStandardMaterial color="#111" />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------- deposits */

function OreDeposit({ deposit, rockMat }: { deposit: MineralDeposit; rockMat: THREE.Material }) {
  const real = deposit.id === "ore-alpha";
  const remaining = deposit.quantityKg > 0 ? 1 - deposit.extractedKg / deposit.quantityKg : 1;
  const crystals = useMemo(() => {
    const list: { p: [number, number, number]; r: [number, number, number]; s: number }[] = [];
    const n = real ? 14 : 5;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + i * 0.7;
      const rad = 0.35 + (i % 3) * 0.18;
      list.push({
        p: [Math.cos(a) * rad, 0.35 + (i % 4) * 0.12, Math.sin(a) * rad],
        r: [i * 0.7, i * 1.3, i * 0.4],
        s: 0.12 + ((i * 37) % 10) / 60,
      });
    }
    return list;
  }, [real]);
  const mound = useMemo(() => {
    const g = new THREE.IcosahedronGeometry(1, 3);
    const p = g.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(p, i);
      const d = 1 + fbm3(v.x * 1.8, v.y * 1.8, v.z * 1.8 + (real ? 0 : 9)) * 0.45;
      v.multiplyScalar(d);
      p.setXYZ(i, v.x, Math.max(v.y, -0.2), v.z);
    }
    g.computeVertexNormals();
    return g;
  }, [real]);
  const glow = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    if (glow.current) {
      glow.current.intensity = deposit.identified ? 6 + Math.sin(clock.elapsedTime * 3) * 2.5 : 0;
    }
  });
  return (
    <group position={[deposit.position.x, 0, deposit.position.z]}>
      <mesh geometry={mound} material={rockMat} scale={[1.3, 0.75, 1.1]} castShadow receiveShadow />
      <group scale={Math.max(0.25, remaining)}>
        {crystals.map((c, i) => (
          <mesh key={i} position={c.p} rotation={c.r} castShadow>
            <octahedronGeometry args={[c.s, 0]} />
            <meshPhysicalMaterial
              color={real ? "#e0a72a" : "#7d7466"}
              metalness={real ? 1 : 0.4}
              roughness={real ? 0.18 : 0.6}
              emissive={real ? "#a86400" : "#000"}
              emissiveIntensity={real ? (deposit.identified ? 1.6 : 0.35) : 0}
              clearcoat={real ? 1 : 0}
            />
          </mesh>
        ))}
      </group>
      <pointLight ref={glow} position={[0, 1.2, 0]} color="#ffb640" distance={6} decay={2} intensity={0} />
    </group>
  );
}

/* ----------------------------------------------------------- equipment */

function OreHopper({ point }: { point: Vec3 }) {
  const rust = usePbr("rust", [1, 1]);
  const beacon = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (beacon.current) beacon.current.rotation.y += dt * 4;
  });
  const beaconTarget = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.set(3, -1.5, 0);
    return o;
  }, []);
  return (
    <group position={[point.x + 4.5, 0, point.z]}>
      <mesh position={[0, 1.1, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.2, 2.2, 2.6]} />
        <meshStandardMaterial {...rust} color="#c9c2b6" metalness={0.8} roughness={0.7} />
      </mesh>
      <mesh position={[0, 2.25, 0]}>
        <boxGeometry args={[2.0, 0.1, 2.4]} />
        <meshStandardMaterial color="#1e1a16" roughness={1} />
      </mesh>
      <group position={[0, 2.55, 0]}>
        <mesh>
          <cylinderGeometry args={[0.12, 0.14, 0.24, 16]} />
          <meshStandardMaterial color="#ffb000" emissive="#ff9000" emissiveIntensity={4} transparent opacity={0.9} />
        </mesh>
        <group ref={beacon}>
          <primitive object={beaconTarget} />
          <spotLight target={beaconTarget} color="#ffa000" intensity={60} angle={0.5} penumbra={0.4} distance={14} decay={2} />
        </group>
      </group>
    </group>
  );
}

function DrillRig() {
  return (
    <group position={[39.5, 0, 8]} rotation={[0, -Math.PI / 2, 0]}>
      <mesh position={[0, 0.9, 0]} castShadow>
        <boxGeometry args={[2.2, 1.2, 4]} />
        <meshStandardMaterial color="#d6a21a" metalness={0.5} roughness={0.55} />
      </mesh>
      <mesh position={[0, 1.9, -0.8]} castShadow>
        <boxGeometry args={[1.8, 1.0, 1.4]} />
        <meshPhysicalMaterial color="#1a1f24" metalness={0.6} roughness={0.15} clearcoat={1} />
      </mesh>
      <mesh position={[0, 1.6, 2.8]} rotation={[0.18, 0, 0]} castShadow>
        <boxGeometry args={[0.35, 0.35, 3.6]} />
        <meshStandardMaterial color="#d6a21a" metalness={0.5} roughness={0.55} />
      </mesh>
      {[-0.9, 0.9].flatMap((x) =>
        [-1.3, 1.3].map((z) => (
          <mesh key={`${x}${z}`} position={[x, 0.42, z]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.42, 0.42, 0.4, 20]} />
            <meshStandardMaterial color="#151515" roughness={0.9} />
          </mesh>
        ))
      )}
    </group>
  );
}

function Boulders({ obstacles, rockMat }: { obstacles: { position: Vec3; radius: number }[]; rockMat: THREE.Material }) {
  const extra = useMemo(() => {
    const list: { p: [number, number, number]; s: number }[] = [];
    for (let i = 0; i < 40; i++) {
      const alongMain = i < 28;
      const x = alongMain ? -7 + ((i * 1.83) % 48) : (i % 2 ? 17.8 : 22.2);
      const z = alongMain ? (i % 2 ? 5.75 : 10.25) : 12 + ((i * 2.3) % 15);
      list.push({ p: [x, 0.05, z], s: 0.15 + ((i * 17) % 10) / 30 });
    }
    return list;
  }, []);
  return (
    <group>
      {obstacles.map((o, i) => (
        <mesh key={`o${i}`} position={[o.position.x, 0.25, o.position.z]} scale={[o.radius * 1.2, o.radius, o.radius * 1.1]} material={rockMat} castShadow receiveShadow>
          <dodecahedronGeometry args={[1, 1]} />
        </mesh>
      ))}
      {extra.map((r, i) => (
        <mesh key={i} position={r.p} scale={[r.s * 1.3, r.s, r.s]} rotation={[i, i * 2, 0]} material={rockMat} castShadow receiveShadow>
          <dodecahedronGeometry args={[1, 0]} />
        </mesh>
      ))}
    </group>
  );
}

/* ---------------------------------------------------------------- world */

export interface DeepMineWorldProps {
  deposits?: MineralDeposit[];
  lighting: number;
  collectionPoint?: Vec3;
  obstacles?: { position: Vec3; radius: number }[];
  tunnelAccessibility?: number;
  quality?: "high" | "low";
}

export function DeepMineWorld({
  deposits,
  lighting,
  collectionPoint = { x: 32, y: 0, z: 8 },
  obstacles = [],
  tunnelAccessibility = 1,
  quality = "high",
}: DeepMineWorldProps) {
  const rock = usePbr("rockwall", [1, 1]);
  const floor = usePbr("minefloor", [18, 16]);
  const rockMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        ...rock,
        color: new THREE.Color("#9c8f80"),
        roughness: 1,
        metalness: 0.05,
        side: THREE.DoubleSide,
      }),
    [rock]
  );

  return (
    <group>
      <Environment files="/hdri/sunset_2k.hdr" environmentIntensity={0.06} />
      <color attach="background" args={["#030202"]} />
      <fogExp2 attach="fog" args={["#120e0a", 0.032]} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[17, 0, 24]} receiveShadow>
        <planeGeometry args={[60, 50]} />
        <meshStandardMaterial {...floor} color="#8a7a68" roughness={1} />
      </mesh>
      <RockWalls material={rockMat} />
      <TimberSets />
      <RailTrack />
      <Lamps lighting={lighting} />
      <Boulders obstacles={obstacles} rockMat={rockMat} />
      {tunnelAccessibility < 0.5 && (
        <mesh position={[20, 0.4, 24]} scale={[2.4, 1.2, 1.4]} material={rockMat} castShadow>
          <dodecahedronGeometry args={[1, 1]} />
        </mesh>
      )}
      {deposits?.map((d) => <OreDeposit key={d.id} deposit={d} rockMat={rockMat} />)}
      <OreHopper point={collectionPoint} />
      <DrillRig />
      <Dust origin={[-8, 0, 5.4]} size={[50, 4, 5.2]} count={quality === "high" ? 1400 : 500} />
      <Dust origin={[15, 0, 28]} size={[15, 6, 16]} count={quality === "high" ? 600 : 200} />
      <hemisphereLight args={["#5a4a38", "#14100c", 0.2 + lighting * 0.15]} />
    </group>
  );
}
