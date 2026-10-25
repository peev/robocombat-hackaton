"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Environment, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { Water } from "three/examples/jsm/objects/Water.js";
import type { FireState, Vec3 } from "@/lib/simulation/types";
import type { RobotId } from "@/lib/robots/profiles";
import { getRobot } from "@/lib/robots/profiles";
import type { RobotPose } from "@/lib/simulation/replay";
import { preloadPbr, usePbr } from "@/components/world/pbr";
import { Fire, Spray } from "@/components/world/effects";

preloadPbr("deck", "container", "rust");

/** Matches the sun in /hdri/sunset_2k.hdr (raised a few degrees for readable shadows). */
export const SUN_DIR = new THREE.Vector3(0.774, 0.208, 0.599).normalize();
const WATER_LEVEL = -7;

/** Default container slots used by the simulation when obstacleShift = 0. */
const DEFAULT_OBSTACLES: { position: Vec3; radius: number }[] = Array.from(
  { length: 12 },
  (_, i) => ({
    position: { x: -6 + (i % 4) * 6, y: 1.3, z: 14 + Math.floor(i / 4) * 4 },
    radius: 1.2,
  })
);

function hullShape() {
  // Shape space (x, y) maps to world (x, -z) after rotating -90° about X.
  const s = new THREE.Shape();
  const p = (x: number, z: number) => [x, -z] as const;
  s.moveTo(...p(-26, -11));
  s.lineTo(...p(46, -11));
  s.quadraticCurveTo(...p(63, -10), ...p(70, 8));
  s.quadraticCurveTo(...p(63, 26), ...p(46, 27));
  s.lineTo(...p(-26, 27));
  s.lineTo(...p(-26, -11));
  return s;
}

/* ------------------------------------------------------------------ ocean */

function Ocean() {
  const normals = useTexture("/textures/waternormals.jpg");
  const water = useMemo(() => {
    normals.wrapS = normals.wrapT = THREE.RepeatWrapping;
    const w = new Water(new THREE.PlaneGeometry(6000, 6000), {
      textureWidth: 512,
      textureHeight: 512,
      waterNormals: normals,
      sunDirection: SUN_DIR.clone(),
      sunColor: 0xffc08a,
      waterColor: 0x0a2230,
      distortionScale: 2.6,
      fog: true,
    });
    w.rotation.x = -Math.PI / 2;
    w.position.y = WATER_LEVEL;
    return w;
  }, [normals]);
  useFrame((_, dt) => {
    (water.material as THREE.ShaderMaterial).uniforms.time.value += dt * 0.55;
  });
  return <primitive object={water} />;
}

/* ------------------------------------------------------------------- hull */

function Hull() {
  const shape = useMemo(hullShape, []);
  const rust = usePbr("rust", [1 / 7, 1 / 7]);
  const deck = usePbr("deck", [1 / 4, 1 / 4]);

  const upper = useMemo(
    () => new THREE.ExtrudeGeometry(shape, { depth: 6.3, bevelEnabled: false, curveSegments: 32 }),
    [shape]
  );
  const boot = useMemo(
    () => new THREE.ExtrudeGeometry(shape, { depth: 3, bevelEnabled: false, curveSegments: 32 }),
    [shape]
  );
  const deckGeo = useMemo(() => new THREE.ShapeGeometry(shape, 32), [shape]);

  const rails = useMemo(() => {
    const pts = shape.getSpacedPoints(220).map((v) => new THREE.Vector3(v.x, 0, -v.y));
    return pts.filter((p) => p.x > -15);
  }, [shape]);

  const postsRef = useRef<THREE.InstancedMesh>(null);
  const railRef = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    if (postsRef.current) {
      rails.forEach((p, i) => {
        m.compose(new THREE.Vector3(p.x, 0.55, p.z), q.identity(), new THREE.Vector3(1, 1, 1));
        postsRef.current!.setMatrixAt(i, m);
      });
      postsRef.current.instanceMatrix.needsUpdate = true;
    }
    if (railRef.current) {
      let n = 0;
      for (const h of [0.6, 1.1]) {
        for (let i = 0; i < rails.length - 1; i++) {
          const a = rails[i];
          const b = rails[i + 1];
          const mid = a.clone().add(b).multiplyScalar(0.5);
          mid.y = h;
          const dir = b.clone().sub(a);
          const len = dir.length();
          q.setFromUnitVectors(up, dir.normalize());
          m.compose(mid, q, new THREE.Vector3(1, len, 1));
          railRef.current.setMatrixAt(n++, m);
        }
      }
      railRef.current.count = n;
      railRef.current.instanceMatrix.needsUpdate = true;
    }
  }, [rails]);

  return (
    <group>
      <mesh geometry={upper} rotation={[-Math.PI / 2, 0, 0]} position={[0, -6.3, 0]} castShadow receiveShadow>
        <meshStandardMaterial
          color="#3a4049"
          {...rust}
          metalness={0.6}
          roughness={0.75}
        />
      </mesh>
      <mesh geometry={boot} rotation={[-Math.PI / 2, 0, 0]} position={[0, -9.3, 0]}>
        <meshStandardMaterial color="#8a2016" roughness={0.7} metalness={0.3} />
      </mesh>
      {/* Thin white boot-top stripe */}
      <mesh geometry={boot} rotation={[-Math.PI / 2, 0, 0]} position={[0, -6.35, 0]} scale={[1.001, 1.001, 0.02]}>
        <meshStandardMaterial color="#d8d6d0" roughness={0.6} />
      </mesh>
      <mesh geometry={deckGeo} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]} receiveShadow>
        <meshStandardMaterial {...deck} color="#9a958e" metalness={0.75} roughness={0.85} />
      </mesh>
      <instancedMesh ref={postsRef} args={[undefined, undefined, rails.length]} castShadow>
        <cylinderGeometry args={[0.035, 0.035, 1.1, 6]} />
        <meshStandardMaterial color="#c9c3b5" metalness={0.6} roughness={0.5} />
      </instancedMesh>
      <instancedMesh ref={railRef} args={[undefined, undefined, rails.length * 2]} castShadow>
        <cylinderGeometry args={[0.03, 0.03, 1, 6]} />
        <meshStandardMaterial color="#c9c3b5" metalness={0.6} roughness={0.45} />
      </instancedMesh>
    </group>
  );
}

/* ------------------------------------------------------- superstructure */

function Superstructure() {
  const panels = usePbr("deck", [3, 3], { withColor: false });
  const windows = useMemo(() => {
    const list: { pos: [number, number, number]; lit: boolean }[] = [];
    for (let deck = 0; deck < 5; deck++) {
      for (let i = 0; i < 12; i++) {
        const z = -5 + i * 2.4;
        const lit = Math.sin(deck * 12.9 + i * 78.2) > -0.1;
        list.push({ pos: [-14.94, 1.6 + deck * 2.9, z], lit });
      }
    }
    return list;
  }, []);
  return (
    <group>
      <mesh position={[-20.5, 7.25, 8]} castShadow receiveShadow>
        <boxGeometry args={[11, 14.5, 30]} />
        <meshStandardMaterial
          color="#e4e1da"
          normalMap={panels.normalMap}
          normalScale={new THREE.Vector2(0.35, 0.35)}
          roughness={0.62}
          metalness={0.15}
        />
      </mesh>
      {/* Bridge deck with wings */}
      <mesh position={[-19.8, 16, 8]} castShadow>
        <boxGeometry args={[8.5, 3, 37]} />
        <meshStandardMaterial color="#e9e6df" roughness={0.6} metalness={0.15} />
      </mesh>
      <mesh position={[-15.52, 16.2, 8]}>
        <boxGeometry args={[0.1, 1.5, 36]} />
        <meshPhysicalMaterial color="#0d1418" metalness={0.9} roughness={0.06} clearcoat={1} />
      </mesh>
      {/* Funnel */}
      <mesh position={[-24.5, 20, 8]} castShadow>
        <boxGeometry args={[4.5, 8, 6.5]} />
        <meshStandardMaterial color="#1c2a3a" roughness={0.5} metalness={0.3} />
      </mesh>
      <mesh position={[-24.5, 22.2, 8]}>
        <boxGeometry args={[4.56, 1.2, 6.56]} />
        <meshStandardMaterial color="#c9302c" roughness={0.5} />
      </mesh>
      {/* Mast + radar */}
      <mesh position={[-19.5, 21, 8]}>
        <cylinderGeometry args={[0.12, 0.18, 7, 8]} />
        <meshStandardMaterial color="#d8d6d0" metalness={0.5} roughness={0.4} />
      </mesh>
      <RadarArm />
      {/* Lifeboat on davits */}
      <mesh position={[-17.5, 9.2, -8.6]} rotation={[0, 0, Math.PI / 2]} scale={[1, 1, 0.75]} castShadow>
        <capsuleGeometry args={[1.1, 5, 8, 16]} />
        <meshStandardMaterial color="#ff6a00" roughness={0.45} />
      </mesh>
      {windows.map((w, i) => (
        <mesh key={i} position={w.pos} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[1.3, 0.9]} />
          <meshStandardMaterial
            color={w.lit ? "#ffd59a" : "#1a2228"}
            emissive={w.lit ? "#ffb35c" : "#000000"}
            emissiveIntensity={w.lit ? 2.2 : 0}
            roughness={0.1}
            metalness={0.5}
          />
        </mesh>
      ))}
      {[-2, 10, 20].map((z) => (
        <FloodLight key={z} position={[-14.6, 13, z]} target={[6, 0, z]} />
      ))}
    </group>
  );
}

function FloodLight({
  position,
  target,
}: {
  position: [number, number, number];
  target: [number, number, number];
}) {
  const obj = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.set(...target);
    return o;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target[0], target[1], target[2]]);
  return (
    <>
      <primitive object={obj} />
      <spotLight
        position={position}
        target={obj}
        angle={0.6}
        penumbra={0.8}
        intensity={500}
        distance={70}
        decay={2}
        color="#ffe9c7"
      />
      <mesh position={position}>
        <boxGeometry args={[0.5, 0.35, 0.5]} />
        <meshStandardMaterial color="#fff4dc" emissive="#fff0d0" emissiveIntensity={6} />
      </mesh>
    </>
  );
}

function RadarArm() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 1.6;
  });
  return (
    <mesh ref={ref} position={[-19.5, 24.6, 8]}>
      <boxGeometry args={[4, 0.18, 0.3]} />
      <meshStandardMaterial color="#e8e8e8" metalness={0.4} roughness={0.4} />
    </mesh>
  );
}

/* ------------------------------------------------------------- containers */

const CONTAINER_COLORS = ["#8f2a1e", "#1f4f7d", "#c06a1d", "#2f6a3a", "#6c7075", "#a59f92", "#7d1f3c", "#1d6f7a"];

function Containers({ obstacles }: { obstacles: { position: Vec3; radius: number }[] }) {
  const maps = usePbr("container", [3, 1], { withColor: false });
  const slots = useMemo(() => {
    const list: { pos: [number, number, number]; color: string }[] = [];
    const pick = (n: number) => CONTAINER_COLORS[Math.abs(Math.floor(Math.sin(n * 91.7) * 1000)) % CONTAINER_COLORS.length];
    obstacles.forEach((o, i) => {
      list.push({ pos: [o.position.x, 1.295, o.position.z], color: pick(i) });
      if (i % 3 !== 1) list.push({ pos: [o.position.x, 1.295 + 2.6, o.position.z], color: pick(i + 40) });
      if (i % 4 === 0) list.push({ pos: [o.position.x, 1.295 + 5.2, o.position.z], color: pick(i + 80) });
    });
    // Forward bay — set dressing outside the simulated arena.
    for (let bx = 0; bx < 3; bx++) {
      for (let bz = 0; bz < 8; bz++) {
        const tiers = 2 + ((bx * 3 + bz) % 3);
        for (let t = 0; t < tiers; t++) {
          list.push({
            pos: [39 + bx * 6.3, 1.9 + 1.295 + t * 2.6, -7 + bz * 2.6],
            color: pick(bx * 31 + bz * 7 + t * 3),
          });
        }
      }
    }
    return list;
  }, [obstacles]);

  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    slots.forEach((s, i) => {
      m.makeTranslation(s.pos[0], s.pos[1], s.pos[2]);
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, c.set(s.color));
    });
    mesh.count = slots.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [slots]);

  return (
    <group>
      <instancedMesh ref={ref} args={[undefined, undefined, 200]} castShadow receiveShadow>
        <boxGeometry args={[6.06, 2.59, 2.44]} />
        <meshStandardMaterial
          {...maps}
          normalScale={new THREE.Vector2(1.6, 1.6)}
          metalness={0.55}
          roughness={0.7}
        />
      </instancedMesh>
      {/* Hatch covers under the forward bay */}
      <mesh position={[45.3, 0.95, 2.1]} castShadow receiveShadow>
        <boxGeometry args={[19.5, 1.9, 21]} />
        <meshStandardMaterial color="#5b3a2a" metalness={0.6} roughness={0.7} />
      </mesh>
    </group>
  );
}

/* --------------------------------------------------------- engine room */

function EngineRoom({ fx, fz }: { fx: number; fz: number }) {
  const rust = usePbr("rust", [2, 2]);
  const x0 = fx - 5;
  const x1 = fx + 7;
  const z0 = fz - 3.5;
  const z1 = fz + 5;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const mat = (
    <meshStandardMaterial {...rust} color="#8a8f96" metalness={0.7} roughness={0.8} />
  );
  return (
    <group>
      <mesh position={[cx, 4.75, cz]} castShadow receiveShadow>
        <boxGeometry args={[x1 - x0 + 0.4, 0.35, z1 - z0 + 0.4]} />
        {mat}
      </mesh>
      <mesh position={[cx, 2.3, z1]} castShadow receiveShadow>
        <boxGeometry args={[x1 - x0, 4.6, 0.3]} />
        {mat}
      </mesh>
      <mesh position={[x1, 2.3, cz]} castShadow receiveShadow>
        <boxGeometry args={[0.3, 4.6, z1 - z0]} />
        {mat}
      </mesh>
      <mesh position={[x0, 2.3, fz + 3]} castShadow receiveShadow>
        <boxGeometry args={[0.3, 4.6, 4]} />
        {mat}
      </mesh>
      {[x0, x1].map((x) => (
        <mesh key={x} position={[x, 2.3, z0]} castShadow>
          <boxGeometry args={[0.35, 4.6, 0.35]} />
          <meshStandardMaterial color="#d6b11f" metalness={0.4} roughness={0.6} />
        </mesh>
      ))}
      {/* Generator set */}
      <mesh position={[fx + 4, 1.1, fz + 3]} castShadow receiveShadow>
        <boxGeometry args={[3.4, 2.2, 2.4]} />
        <meshStandardMaterial color="#2f4a3a" metalness={0.6} roughness={0.5} />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[fx + 2.6 + i * 1.1, 2.6, fz + 3]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.16, 0.16, 2.4, 10]} />
          <meshStandardMaterial color="#7a7f86" metalness={0.9} roughness={0.3} />
        </mesh>
      ))}
      {/* Burning pallet stack and drums at the seat of the fire */}
      <mesh position={[fx, 0.35, fz + 0.2]} castShadow>
        <boxGeometry args={[1.6, 0.7, 1.2]} />
        <meshStandardMaterial color="#1b1410" roughness={1} />
      </mesh>
      {[
        [1.3, 0.45, 1.0],
        [1.9, 0.45, 0.2],
        [0.9, 0.45, 1.7],
      ].map(([dx, y, dz], i) => (
        <mesh key={i} position={[fx + dx, y, fz + dz]} castShadow>
          <cylinderGeometry args={[0.3, 0.3, 0.9, 16]} />
          <meshStandardMaterial color={i === 1 ? "#1d3f6b" : "#7a1d14"} metalness={0.6} roughness={0.55} />
        </mesh>
      ))}
      <mesh position={[fx - 0.6, 0.31, fz - 0.9]} rotation={[0, 0.6, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.3, 0.3, 0.9, 16]} />
        <meshStandardMaterial color="#202020" metalness={0.5} roughness={0.7} />
      </mesh>
      {/* Oil slick */}
      <mesh position={[fx - 0.3, 0.012, fz - 0.3]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[2.4, 40]} />
        <meshStandardMaterial
          color="#0b0908"
          roughness={0.35}
          metalness={0.1}
          envMapIntensity={0.25}
          transparent
          opacity={0.8}
          polygonOffset
          polygonOffsetFactor={-2}
        />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------ equipment */

function Equipment({ extinguisher, hose }: { extinguisher: Vec3; hose: Vec3 }) {
  return (
    <group>
      {/* Extinguisher rack */}
      <group position={[extinguisher.x, 0, extinguisher.z + 0.9]}>
        <mesh position={[0, 0.8, 0.12]} castShadow>
          <boxGeometry args={[0.7, 1.6, 0.08]} />
          <meshStandardMaterial color="#b3b0a8" metalness={0.6} roughness={0.5} />
        </mesh>
        {[-0.18, 0.18].map((dx) => (
          <group key={dx} position={[dx, 0, 0]}>
            <mesh position={[0, 0.48, 0]} castShadow>
              <cylinderGeometry args={[0.12, 0.12, 0.8, 20]} />
              <meshPhysicalMaterial color="#c00d0d" metalness={0.2} roughness={0.25} clearcoat={1} />
            </mesh>
            <mesh position={[0, 0.94, 0]}>
              <cylinderGeometry args={[0.035, 0.05, 0.14, 10]} />
              <meshStandardMaterial color="#222" metalness={0.8} roughness={0.3} />
            </mesh>
          </group>
        ))}
      </group>
      {/* Fire hose cabinet + hydrant */}
      <group position={[hose.x, 0, hose.z + 1.3]}>
        <mesh position={[0, 0.95, 0]} castShadow>
          <boxGeometry args={[1.1, 1.5, 0.45]} />
          <meshStandardMaterial color="#b0120e" metalness={0.3} roughness={0.45} />
        </mesh>
        <mesh position={[0, 0.95, -0.24]} rotation={[0, 0, 0]}>
          <torusGeometry args={[0.38, 0.09, 12, 32]} />
          <meshStandardMaterial color="#e9e3d1" roughness={0.7} />
        </mesh>
        <mesh position={[0.8, 0.45, 0]} castShadow>
          <cylinderGeometry args={[0.14, 0.18, 0.9, 16]} />
          <meshStandardMaterial color="#c4160f" metalness={0.5} roughness={0.4} />
        </mesh>
      </group>
    </group>
  );
}

function DeckDressing() {
  const pipes: { z: number; y: number; r: number; color: string }[] = [
    { z: -9.2, y: 0.45, r: 0.2, color: "#b81d16" },
    { z: -8.7, y: 0.42, r: 0.15, color: "#c9a227" },
    { z: -8.3, y: 0.4, r: 0.12, color: "#7d8288" },
  ];
  return (
    <group>
      {pipes.map((p) => (
        <mesh key={p.z} position={[17, p.y, p.z]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[p.r, p.r, 64, 14]} />
          <meshStandardMaterial color={p.color} metalness={0.7} roughness={0.4} />
        </mesh>
      ))}
      {Array.from({ length: 21 }).map((_, i) => (
        <mesh key={i} position={[-14 + i * 3.1, 0.2, -8.75]} castShadow>
          <boxGeometry args={[0.15, 0.4, 1.4]} />
          <meshStandardMaterial color="#4b4f55" metalness={0.7} roughness={0.6} />
        </mesh>
      ))}
      {/* Bollards */}
      {[-10, 2, 30].flatMap((x) =>
        [-10.1, 26.1].flatMap((z) =>
          [0, 0.8].map((dx) => (
            <mesh key={`${x}-${z}-${dx}`} position={[x + dx, 0.35, z]} castShadow>
              <cylinderGeometry args={[0.22, 0.26, 0.7, 16]} />
              <meshStandardMaterial color="#1b1d20" metalness={0.8} roughness={0.5} />
            </mesh>
          ))
        )
      )}
      {/* Safety walkway lines */}
      {[-4.4, 1.6].map((z) => (
        <mesh key={z} position={[11, 0.006, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[46, 0.12]} />
          <meshStandardMaterial color="#e2b419" roughness={0.8} polygonOffset polygonOffsetFactor={-2} />
        </mesh>
      ))}
      {/* Deck crane */}
      <group position={[36, 0, 24]}>
        <mesh position={[0, 3.5, 0]} castShadow>
          <cylinderGeometry args={[1.1, 1.3, 7, 20]} />
          <meshStandardMaterial color="#d9a21b" metalness={0.5} roughness={0.5} />
        </mesh>
        <mesh position={[0, 8, 0]} castShadow>
          <boxGeometry args={[3, 2.2, 3]} />
          <meshStandardMaterial color="#d9a21b" metalness={0.5} roughness={0.5} />
        </mesh>
        <mesh position={[-6, 13, -3]} rotation={[0.25, -0.45, 0.62]} castShadow>
          <boxGeometry args={[18, 0.7, 0.7]} />
          <meshStandardMaterial color="#d9a21b" metalness={0.5} roughness={0.5} />
        </mesh>
      </group>
    </group>
  );
}

/* ------------------------------------------------------------- sprays */

const HOSE_SEGMENTS = 48;

/** Yellow attack line from the hydrant, laid along the deck, up into the robot's hands. */
function HoseLine({ hydrant, pose }: { hydrant: THREE.Vector3; pose: RobotPose }) {
  const mesh = useRef<THREE.Mesh>(null);
  const curve = useMemo(() => new THREE.CatmullRomCurve3(Array.from({ length: 6 }, () => new THREE.Vector3()), false, "centripetal"), []);
  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    m.visible = !!pose.nozzle;
    if (!pose.nozzle) return;
    const tip = new THREE.Vector3(...pose.nozzle);
    const body = new THREE.Vector3(pose.x, 0, pose.z);
    const back = body.clone().sub(hydrant).setY(0).normalize();
    const side = new THREE.Vector3(back.z, 0, -back.x);
    const pts = curve.points;
    pts[0].copy(hydrant).setY(0.55);
    pts[1].copy(hydrant).addScaledVector(back, 1.2).setY(0.05);
    pts[2].copy(hydrant).lerp(body, 0.55).addScaledVector(side, 0.8).setY(0.05);
    pts[3].copy(body).addScaledVector(back, -1.1).addScaledVector(side, -0.4).setY(0.05);
    pts[4].copy(body).addScaledVector(side, -0.25).setY(tip.y * 0.55);
    pts[5].copy(tip).addScaledVector(back, -0.2);
    const geo = new THREE.TubeGeometry(curve, HOSE_SEGMENTS, 0.032, 8, false);
    m.geometry.dispose();
    m.geometry = geo;
  });
  return (
    <mesh ref={mesh} castShadow visible={false}>
      <bufferGeometry />
      <meshStandardMaterial color="#d6a514" roughness={0.6} metalness={0.05} />
    </mesh>
  );
}

function RobotSprays({
  poses,
  fireTarget,
  hydrant,
  suppression,
  wetness,
}: {
  poses: Map<RobotId, RobotPose>;
  fireTarget: THREE.Vector3;
  hydrant: THREE.Vector3;
  suppression: { current: number };
  wetness: { current: number };
}) {
  const ids = Array.from(poses.keys());
  const streams = useMemo(
    () => new Map(ids.map((id) => [id, { from: new THREE.Vector3(), to: new THREE.Vector3(), active: 0 }])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ids.join(",")]
  );
  useFrame((_, dt) => {
    let total = 0;
    for (const [id, s] of streams) {
      const p = poses.get(id);
      if (!p) continue;
      const h = getRobot(id).simulation.heightM;
      const toFire = new THREE.Vector3(fireTarget.x - p.x, 0, fireTarget.z - p.z).normalize();
      if (p.nozzle) s.from.set(...p.nozzle);
      else s.from.set(p.x + toFire.x * 0.55, h * 0.55, p.z + toFire.z * 0.55);
      // Aim at the seat of the fire and sweep across it.
      const across = new THREE.Vector3(toFire.z, 0, -toFire.x);
      s.to.copy(fireTarget).addScaledVector(across, p.sweep).setY(0.35);
      const on = p.state === "SUPPRESSING" && p.nozzle ? 1 : 0;
      s.active += (on - s.active) * (1 - Math.exp(-dt * 5));
      total += s.active;
    }
    suppression.current = total;
    wetness.current = Math.min(1, wetness.current + total * dt * 0.08);
  });
  return (
    <>
      {Array.from(streams.entries()).map(([id, s]) => (
        <Spray key={id} stream={s} />
      ))}
      {ids.map((id) => (
        <HoseLine key={id} hydrant={hydrant} pose={poses.get(id)!} />
      ))}
    </>
  );
}

/** Water pooling on the deck plates around the fire. */
function WetDeck({ center, wetness }: { center: THREE.Vector3; wetness: { current: number } }) {
  const mesh = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => {
    const w = wetness.current;
    if (mesh.current) {
      mesh.current.visible = w > 0.01;
      mesh.current.scale.setScalar(0.6 + w * 3.4);
    }
    if (mat.current) mat.current.opacity = Math.min(0.75, w * 1.5);
  });
  return (
    <mesh ref={mesh} position={[center.x - 1.2, 0.009, center.z - 0.8]} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
      <circleGeometry args={[1, 48]} />
      <meshStandardMaterial
        ref={mat}
        color="#1a1d20"
        roughness={0.06}
        metalness={0.3}
        transparent
        opacity={0}
        polygonOffset
        polygonOffsetFactor={-3}
      />
    </mesh>
  );
}

/* --------------------------------------------------------------- world */

export interface FireRescueWorldProps {
  fire?: FireState;
  obstacles?: { position: Vec3; radius: number }[];
  extinguisherPos?: Vec3;
  hosePos?: Vec3;
  poses?: Map<RobotId, RobotPose>;
  quality?: "high" | "low";
}

export function FireRescueWorld({
  fire,
  obstacles,
  extinguisherPos = { x: 8, y: 0.5, z: 4 },
  hosePos = { x: 18, y: 0.5, z: 10 },
  poses,
  quality = "high",
}: FireRescueWorldProps) {
  const fx = fire?.position.x ?? 28;
  const fz = fire?.position.z ?? 12;
  const intensity = fire ? (fire.suppressed ? 0 : fire.intensity) : 0.9;
  const fireTarget = useMemo(() => new THREE.Vector3(fx, 0.6, fz), [fx, fz]);
  const hydrant = useMemo(() => new THREE.Vector3(hosePos.x + 0.8, 0.5, hosePos.z + 1.3), [hosePos.x, hosePos.z]);
  const suppression = useRef(0);
  const wetness = useRef(0);
  const sunPos = useMemo(() => SUN_DIR.clone().multiplyScalar(120).add(new THREE.Vector3(10, 0, 8)), []);
  const sunTarget = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.set(10, 0, 8);
    return o;
  }, []);

  return (
    <group>
      <Environment files="/hdri/sunset_2k.hdr" background environmentIntensity={0.9} />
      <fog attach="fog" args={["#a88470", 250, 2600]} />
      <Ocean />
      <Hull />
      <Superstructure />
      <Containers obstacles={obstacles?.length ? obstacles : DEFAULT_OBSTACLES} />
      <EngineRoom fx={fx} fz={fz} />
      <Equipment extinguisher={extinguisherPos} hose={hosePos} />
      <DeckDressing />
      <Fire position={[fx, 0.05, fz]} intensity={intensity} quality={quality} suppression={suppression} />
      <WetDeck center={fireTarget} wetness={wetness} />
      {poses && (
        <RobotSprays poses={poses} fireTarget={fireTarget} hydrant={hydrant} suppression={suppression} wetness={wetness} />
      )}

      <primitive object={sunTarget} />
      <directionalLight
        position={sunPos}
        target={sunTarget}
        color="#ffb985"
        intensity={2.4}
        castShadow
        shadow-mapSize-width={quality === "high" ? 4096 : 2048}
        shadow-mapSize-height={quality === "high" ? 4096 : 2048}
        shadow-camera-left={-45}
        shadow-camera-right={45}
        shadow-camera-top={35}
        shadow-camera-bottom={-35}
        shadow-camera-near={1}
        shadow-camera-far={300}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
      />
      <hemisphereLight args={["#8fa6c4", "#3a2a22", 0.35]} />
    </group>
  );
}
