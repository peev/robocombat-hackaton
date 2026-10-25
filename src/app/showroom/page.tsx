"use client";

import { Suspense, useMemo, useState, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import { HumanoidRobot } from "@/components/robots/HumanoidRobot";
import { ROBOT_IDS, getRobot } from "@/lib/robots/profiles";
import { createPose } from "@/lib/simulation/replay";
import type { RobotState } from "@/lib/simulation/types";

const ANGLES: Record<string, [number, number, number]> = {
  front: [0, 1.3, 5.2],
  back: [0, 1.4, -5.2],
  side: [5.2, 1.3, 0.4],
  three: [3.4, 1.6, 4.2],
};

function Rig({ view }: { view: string }) {
  const { camera } = useThree();
  useFrame(() => {
    const p = ANGLES[view] ?? ANGLES.front;
    camera.position.set(...p);
    camera.lookAt(0, 0.85, 0);
  });
  return null;
}

/** Lineup of the three robots for visual checks: /showroom?state=SUPPRESSING&view=side */
export default function Showroom() {
  const [params, setParams] = useState<{ state: RobotState; view: string; walk: boolean }>({
    state: "IDLE",
    view: "front",
    walk: false,
  });
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setParams({
      state: (q.get("state") as RobotState) ?? "IDLE",
      view: q.get("view") ?? "front",
      walk: q.has("walk"),
    });
  }, []);
  const poses = useMemo(
    () =>
      ROBOT_IDS.map((id, i) => {
        const p = createPose(id, (i - 1) * 1.5, 0);
        p.state = params.state;
        p.carrying = params.state === "CARRYING";
        return p;
      }),
    [params.state]
  );
  const aim = useMemo(() => new THREE.Vector3(0, 0, 8), []);

  return (
    <div className="h-screen w-screen bg-[#202428]">
      <Canvas shadows camera={{ fov: 35 }}>
        <Suspense fallback={null}>
          <Environment files="/hdri/sunset_2k.hdr" environmentIntensity={0.8} />
          <directionalLight position={[3, 6, 5]} intensity={2.5} castShadow />
          <ambientLight intensity={0.25} />
          <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[30, 30]} />
            <meshStandardMaterial color="#3a3f45" roughness={0.8} />
          </mesh>
          <ContactShadows opacity={0.6} scale={10} blur={2} far={3} />
          {poses.map((p) => (
            <Walker key={p.robotId} pose={p} walk={params.walk} aim={aim} />
          ))}
          <Rig view={params.view} />
        </Suspense>
      </Canvas>
      <div className="pointer-events-none absolute bottom-4 left-0 right-0 flex justify-center gap-24 text-xs uppercase tracking-widest text-white/70">
        {ROBOT_IDS.map((id) => (
          <span key={id}>{getRobot(id).displayName}</span>
        ))}
      </div>
    </div>
  );
}

function Walker({ pose, walk, aim }: { pose: ReturnType<typeof createPose>; walk: boolean; aim: THREE.Vector3 }) {
  const baseZ = pose.z;
  useFrame(({ clock }) => {
    if (walk) pose.z = baseZ + ((clock.elapsedTime * 1.1) % 3) - 1.5;
  });
  return <HumanoidRobot robotId={pose.robotId} pose={pose} aimTarget={aim} />;
}
