"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { RobotId } from "@/lib/robots/profiles";
import { getRobot } from "@/lib/robots/profiles";
import type { RobotPose } from "@/lib/simulation/replay";
import { buildArmor } from "./armor";

/** Armour tone and brand trim stripe per manufacturer. */
const LIVERY: Record<RobotId, { armor: string; trim: string }> = {
  "unitree-g1": { armor: "#c9ccd0", trim: "#2f7bff" },
  "bd-atlas": { armor: "#ecebe7", trim: "#e10600" },
  "agibot-a2": { armor: "#e6e1d6", trim: "#f0a500" },
};

const MODEL_URL = "/models/Xbot.glb";
/** Xbot rest height in metres. */
const MODEL_HEIGHT = 1.8;
/** Ground speed (m/s) at which the source clips play without foot sliding, at full model scale. */
const WALK_NATIVE_SPEED = 1.45;
const RUN_NATIVE_SPEED = 3.6;

const STATE_LABEL: Record<RobotPose["state"], string> = {
  IDLE: "Standby",
  NAVIGATING: "Navigating",
  SEARCHING: "Scanning",
  INTERACTING: "Operating equipment",
  CARRYING: "Hauling ore",
  SUPPRESSING: "Suppressing fire",
  RECOVERING: "Recovering balance",
  COMPLETED: "Mission complete",
  FAILED: "Failed",
};

export interface HumanoidProps {
  robotId: RobotId;
  pose: RobotPose;
  selected?: boolean;
  headlamp?: boolean;
  label?: boolean;
}

const _pq = new THREE.Quaternion();
const _q = new THREE.Quaternion();
const _axis = new THREE.Vector3();
const _rootQ = new THREE.Quaternion();

/** Rotates a bone about a world-space axis, preserving the animated pose underneath. */
function rotateBoneWorld(bone: THREE.Object3D | undefined, axis: THREE.Vector3, angle: number) {
  if (!bone || !bone.parent || Math.abs(angle) < 1e-4) return;
  bone.parent.getWorldQuaternion(_pq);
  _q.setFromAxisAngle(axis, angle);
  const local = _pq.clone().invert().multiply(_q).multiply(_pq);
  bone.quaternion.premultiply(local);
  bone.updateMatrixWorld(true);
}

function findBone(root: THREE.Object3D, name: string) {
  return (
    root.getObjectByName(`mixamorig${name}`) ??
    root.getObjectByName(`mixamorig:${name}`) ??
    undefined
  );
}

export function HumanoidRobot({ robotId, pose, selected, headlamp, label }: HumanoidProps) {
  const { scene, animations } = useGLTF(MODEL_URL);
  const profile = getRobot(robotId);
  const scale = profile.simulation.heightM / MODEL_HEIGHT;

  const root = useRef<THREE.Group>(null);
  const crate = useRef<THREE.Group>(null);
  const lamp = useRef<THREE.SpotLight>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const lampTarget = useMemo(() => new THREE.Object3D(), []);

  const rig = useMemo(() => {
    const model = cloneSkinned(scene) as THREE.Group;
    // The base mesh becomes the dark mechanical under-structure beneath the armour plates.
    const shell = new THREE.MeshStandardMaterial({
      color: "#2b2e32",
      metalness: 0.7,
      roughness: 0.45,
    });
    const joints = new THREE.MeshStandardMaterial({
      color: "#151618",
      metalness: 0.85,
      roughness: 0.35,
    });
    model.traverse((o) => {
      const mesh = o as THREE.SkinnedMesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      const name = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material).name;
      mesh.material = name.includes("Joints") ? joints : shell;
    });

    const mixer = new THREE.AnimationMixer(model);
    const clip = (n: string) => animations.find((a) => a.name === n)!;
    const idle = mixer.clipAction(clip("idle"));
    const walk = mixer.clipAction(clip("walk"));
    const run = mixer.clipAction(clip("run"));
    for (const a of [idle, walk, run]) {
      a.play();
      a.setEffectiveWeight(0);
    }
    idle.setEffectiveWeight(1);

    const bones = {
      spine: findBone(model, "Spine1"),
      chest: findBone(model, "Spine2"),
      head: findBone(model, "Head"),
      lArm: findBone(model, "LeftArm"),
      rArm: findBone(model, "RightArm"),
      lFore: findBone(model, "LeftForeArm"),
      rFore: findBone(model, "RightForeArm"),
    };
    const armor = buildArmor((n) => findBone(model, n), LIVERY[robotId]);
    return { model, mixer, idle, walk, run, bones, armor, materials: [shell, joints] };
  }, [scene, animations, robotId]);

  useEffect(
    () => () => {
      rig.mixer.stopAllAction();
      rig.materials.forEach((m) => m.dispose());
      rig.armor.dispose();
    },
    [rig]
  );

  const motion = useRef({
    pos: new THREE.Vector3(pose.x, pose.y, pose.z),
    yaw: pose.heading,
    speed: 0,
    wIdle: 1,
    wWalk: 0,
    wRun: 0,
    reach: 0,
    carry: 0,
    slump: 0,
    initialised: false,
    t: Math.random() * 10,
  });

  useFrame((_, rawDt) => {
    const g = root.current;
    if (!g) return;
    const dt = Math.min(rawDt, 0.1);
    const m = motion.current;
    m.t += dt;

    const target = _axis.set(pose.x, pose.y, pose.z);
    if (!m.initialised || m.pos.distanceTo(target) > 4) {
      m.pos.copy(target);
      m.yaw = pose.heading;
      m.initialised = true;
    }
    const prevX = m.pos.x;
    const prevZ = m.pos.z;
    m.pos.lerp(target, 1 - Math.exp(-dt * 8));
    const dx = m.pos.x - prevX;
    const dz = m.pos.z - prevZ;
    const instSpeed = Math.hypot(dx, dz) / Math.max(dt, 1e-4);
    m.speed += (instSpeed - m.speed) * (1 - Math.exp(-dt * 6));

    const moving = m.speed > 0.12;
    const desiredYaw = moving ? Math.atan2(dx, dz) : pose.heading;
    let dyaw = desiredYaw - m.yaw;
    while (dyaw > Math.PI) dyaw -= Math.PI * 2;
    while (dyaw < -Math.PI) dyaw += Math.PI * 2;
    m.yaw += dyaw * (1 - Math.exp(-dt * (moving ? 7 : 3)));

    g.position.copy(m.pos);
    g.rotation.set(0, m.yaw, 0);

    // Locomotion blend driven by actual ground speed so feet stay planted.
    const walkNative = WALK_NATIVE_SPEED * scale;
    const runNative = RUN_NATIVE_SPEED * scale;
    const s = m.speed;
    const runBlend = THREE.MathUtils.smoothstep(s, walkNative * 1.35, walkNative * 1.9);
    const moveBlend = THREE.MathUtils.smoothstep(s, 0.1, 0.45);
    const k = 1 - Math.exp(-dt * 8);
    m.wIdle += (1 - moveBlend - m.wIdle) * k;
    m.wWalk += (moveBlend * (1 - runBlend) - m.wWalk) * k;
    m.wRun += (moveBlend * runBlend - m.wRun) * k;
    rig.idle.setEffectiveWeight(m.wIdle);
    rig.walk.setEffectiveWeight(m.wWalk);
    rig.run.setEffectiveWeight(m.wRun);
    rig.walk.setEffectiveTimeScale(THREE.MathUtils.clamp(s / walkNative, 0.6, 2.4));
    rig.run.setEffectiveTimeScale(THREE.MathUtils.clamp(s / runNative, 0.6, 2.2));
    const failed = pose.state === "FAILED";
    rig.idle.setEffectiveTimeScale(failed ? 0.05 : 1);
    rig.mixer.update(dt);

    // Task poses layered on top of the locomotion clips.
    const st = pose.state;
    const reachTarget = st === "SUPPRESSING" ? 1 : st === "INTERACTING" ? 0.75 : 0;
    const carryTarget = st === "CARRYING" || pose.carrying ? 1 : 0;
    const slumpTarget = failed ? 1 : 0;
    const kp = 1 - Math.exp(-dt * 5);
    m.reach += (reachTarget - m.reach) * kp;
    m.carry += (carryTarget - m.carry) * kp;
    m.slump += (slumpTarget - m.slump) * kp;

    rig.model.updateMatrixWorld(true);
    g.getWorldQuaternion(_rootQ);
    const lateral = new THREE.Vector3(1, 0, 0).applyQuaternion(_rootQ);
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(_rootQ);
    const b = rig.bones;

    const lean = m.reach * 0.18 + m.carry * 0.06 + m.slump * 0.55;
    rotateBoneWorld(b.spine, lateral, lean);
    if (st === "RECOVERING") {
      rotateBoneWorld(b.spine, forward, Math.sin(m.t * 9) * 0.22);
    }
    if (st === "SEARCHING") {
      rotateBoneWorld(b.head, new THREE.Vector3(0, 1, 0), Math.sin(m.t * 1.6) * 0.55);
    }
    const armRaise = m.reach * 1.25 + m.carry * 0.95;
    rotateBoneWorld(b.rArm, lateral, -armRaise);
    rotateBoneWorld(b.lArm, lateral, -(m.reach * 1.05 + m.carry * 0.95));
    rotateBoneWorld(b.rFore, lateral, -(m.reach * 0.25 + m.carry * 0.55));
    rotateBoneWorld(b.lFore, lateral, -(m.reach * 0.35 + m.carry * 0.55));

    const nozzleOut = st === "SUPPRESSING" && m.reach > 0.5;
    rig.armor.nozzle.visible = nozzleOut;
    if (nozzleOut) {
      const tip = rig.armor.nozzleTip.getWorldPosition(new THREE.Vector3());
      pose.nozzle = [tip.x, tip.y, tip.z];
    } else {
      pose.nozzle = null;
    }
    if (crate.current) crate.current.visible = pose.carrying;
    if (lamp.current) lamp.current.intensity = failed ? 0 : 40;
    if (labelRef.current) {
      labelRef.current.textContent = `${profile.shortName} · ${STATE_LABEL[st]}`;
    }
  });

  return (
    <group ref={root}>
      <group scale={scale}>
        <primitive object={rig.model} />
        {/* Ore crate held at chest height while hauling */}
        <group ref={crate} visible={false}>
          <mesh position={[0, 1.08, 0.42]} castShadow>
            <boxGeometry args={[0.42, 0.3, 0.32]} />
            <meshStandardMaterial color="#3b3f44" metalness={0.8} roughness={0.4} />
          </mesh>
          <mesh position={[0, 1.25, 0.42]}>
            <dodecahedronGeometry args={[0.13, 0]} />
            <meshStandardMaterial
              color="#d9a522"
              metalness={1}
              roughness={0.25}
              emissive="#7a4a00"
              emissiveIntensity={0.6}
            />
          </mesh>
        </group>
        {/* Status light on the back pack */}
        <mesh position={[0, 1.38, -0.17]}>
          <sphereGeometry args={[0.025, 12, 12]} />
          <meshBasicMaterial color={selected ? "#ff2a1a" : "#46ff8a"} toneMapped={false} />
        </mesh>
        {headlamp && (
          <>
            <spotLight
              ref={lamp}
              position={[0, 1.62, 0.12]}
              target={lampTarget}
              angle={0.55}
              penumbra={0.65}
              intensity={40}
              distance={22}
              decay={1.6}
              color="#fff1d6"
            />
            <primitive object={lampTarget} position={[0, 0.6, 5]} />
            <mesh position={[0, 1.62, 0.115]}>
              <circleGeometry args={[0.03, 16]} />
              <meshBasicMaterial color="#fff6e0" toneMapped={false} />
            </mesh>
          </>
        )}
      </group>
      {selected && (
        <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.55, 0.62, 48]} />
          <meshBasicMaterial color="#e10600" transparent opacity={0.7} toneMapped={false} />
        </mesh>
      )}
      {label && (
        <Html
          position={[0, profile.simulation.heightM + 0.35, 0]}
          center
          zIndexRange={[5, 0]}
          style={{ pointerEvents: "none" }}
        >
          <div
            ref={labelRef}
            className="whitespace-nowrap rounded-sm border-l-2 border-[#e10600] bg-black/60 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wider text-white/90"
          />
        </Html>
      )}
    </group>
  );
}

if (typeof window !== "undefined") useGLTF.preload(MODEL_URL);
