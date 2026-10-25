"use client";

import { use, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { RobotId } from "@/lib/robots/profiles";
import { getRobot } from "@/lib/robots/profiles";
import type { RobotPose } from "@/lib/simulation/replay";
import { buildRobotBody, loadG1Model, type G1Model } from "./armor";

const MODEL_URL = "/models/Xbot.glb";
/** Xbot rest height and hip height in metres. */
const MODEL_HEIGHT = 1.8;
const MODEL_HIP_HEIGHT = 1.04;
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
  /** World point the robot turns to face while suppressing (seat of the fire). */
  aimTarget?: THREE.Vector3 | null;
}

const _pq = new THREE.Quaternion();
const _q = new THREE.Quaternion();
const _axis = new THREE.Vector3();
const _rootQ = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0);

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
  return root.getObjectByName(`mixamorig${name}`) ?? root.getObjectByName(`mixamorig:${name}`) ?? undefined;
}

/** Re-proportions the cloned skeleton to the G1's real joint layout and retimes the clips to match. */
function retargetToG1(model: THREE.Object3D, g1: G1Model, clips: THREE.AnimationClip[]) {
  const set = (bone: string, v: [number, number, number]) => {
    const b = findBone(model, bone);
    if (b) b.position.set(v[0] * 100, v[1] * 100, v[2] * 100);
  };
  const o = g1.offsets;
  set("Spine", o.Spine2);
  set("Spine1", [0, 0, 0]);
  set("Spine2", [0, 0, 0]);
  for (const S of ["Left", "Right"]) {
    set(`${S}Shoulder`, o[`${S}Arm`]);
    set(`${S}Arm`, [0, 0, 0]);
    set(`${S}ForeArm`, o[`${S}ForeArm`]);
    set(`${S}Hand`, o[`${S}Hand`]);
    set(`${S}UpLeg`, o[`${S}UpLeg`]);
    set(`${S}Leg`, o[`${S}Leg`]);
    set(`${S}Foot`, o[`${S}Foot`]);
  }
  const hipScale = g1.pelvisHeight / MODEL_HIP_HEIGHT;
  return clips.map((clip) => {
    const c = clip.clone();
    c.tracks = c.tracks.filter((t) => {
      if (t.name.endsWith(".scale")) return false;
      if (!t.name.endsWith(".position")) return true;
      return /Hips\.position$/.test(t.name);
    });
    for (const t of c.tracks) {
      if (/Hips\.position$/.test(t.name)) {
        const v = t.values;
        for (let i = 0; i < v.length; i++) v[i] *= hipScale;
      }
    }
    return c;
  });
}

export function HumanoidRobot({ robotId, pose, selected, headlamp, label, aimTarget }: HumanoidProps) {
  const { scene, animations } = useGLTF(MODEL_URL);
  const g1 = robotId === "unitree-g1" ? use(loadG1Model()) : undefined;
  const profile = getRobot(robotId);
  const isG1 = robotId === "unitree-g1";
  // G1 is rebuilt at true scale; the others scale the Xbot skeleton to their height.
  const scale = isG1 ? 1 : profile.simulation.heightM / MODEL_HEIGHT;
  const strideScale = isG1 ? 0.72 : scale;
  const chestY = isG1 ? 0.98 : 1.08;
  const headY = isG1 ? 1.2 : 1.62;

  const root = useRef<THREE.Group>(null);
  const crate = useRef<THREE.Group>(null);
  const lamp = useRef<THREE.SpotLight>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const lampTarget = useMemo(() => new THREE.Object3D(), []);

  const rig = useMemo(() => {
    const model = cloneSkinned(scene) as THREE.Group;
    model.traverse((o) => {
      // Manufacturer bodies are rigid parts on the skeleton; the mannequin skin is not drawn.
      if ((o as THREE.Mesh).isMesh) o.visible = false;
    });
    const clips = g1 ? retargetToG1(model, g1, animations) : animations;
    const mixer = new THREE.AnimationMixer(model);
    const clip = (n: string) => clips.find((a) => a.name === n)!;
    const idle = mixer.clipAction(clip("idle"));
    const walk = mixer.clipAction(clip("walk"));
    const run = mixer.clipAction(clip("run"));
    for (const a of [idle, walk, run]) {
      a.play();
      a.setEffectiveWeight(0);
    }
    idle.setEffectiveWeight(1);

    const bones = {
      hips: findBone(model, "Hips"),
      spine: findBone(model, "Spine1"),
      head: findBone(model, "Head"),
      lArm: findBone(model, "LeftArm"),
      rArm: findBone(model, "RightArm"),
      lFore: findBone(model, "LeftForeArm"),
      rFore: findBone(model, "RightForeArm"),
      lUp: findBone(model, "LeftUpLeg"),
      rUp: findBone(model, "RightUpLeg"),
      lLeg: findBone(model, "LeftLeg"),
      rLeg: findBone(model, "RightLeg"),
    };
    const body = buildRobotBody(robotId, (n) => findBone(model, n), g1);
    return { model, mixer, idle, walk, run, bones, body };
  }, [scene, animations, robotId, g1]);

  useEffect(
    () => () => {
      rig.mixer.stopAllAction();
      rig.body.dispose();
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
    brace: 0,
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

    const st = pose.state;
    const suppressing = st === "SUPPRESSING";
    const moving = m.speed > 0.12;
    let desiredYaw = moving ? Math.atan2(dx, dz) : pose.heading;
    if (suppressing && aimTarget) desiredYaw = Math.atan2(aimTarget.x - m.pos.x, aimTarget.z - m.pos.z);
    let dyaw = desiredYaw - m.yaw;
    while (dyaw > Math.PI) dyaw -= Math.PI * 2;
    while (dyaw < -Math.PI) dyaw += Math.PI * 2;
    m.yaw += dyaw * (1 - Math.exp(-dt * (moving || suppressing ? 6 : 3)));

    g.position.copy(m.pos);
    g.rotation.set(0, m.yaw, 0);

    // Locomotion blend driven by actual ground speed so feet stay planted.
    const walkNative = WALK_NATIVE_SPEED * strideScale;
    const runNative = RUN_NATIVE_SPEED * strideScale;
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
    const failed = st === "FAILED";
    rig.idle.setEffectiveTimeScale(failed ? 0.05 : 1);
    rig.mixer.update(dt);

    // Task poses layered on top of the locomotion clips.
    const reachTarget = st === "INTERACTING" ? 0.75 : 0;
    const carryTarget = st === "CARRYING" || pose.carrying ? 1 : 0;
    const kp = 1 - Math.exp(-dt * 5);
    m.reach += (reachTarget - m.reach) * kp;
    m.carry += (carryTarget - m.carry) * kp;
    m.slump += ((failed ? 1 : 0) - m.slump) * kp;
    m.brace += ((suppressing ? 1 : 0) - m.brace) * (1 - Math.exp(-dt * 3));

    rig.model.updateMatrixWorld(true);
    g.getWorldQuaternion(_rootQ);
    const lateral = new THREE.Vector3(1, 0, 0).applyQuaternion(_rootQ);
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(_rootQ);
    const b = rig.bones;

    // Firefighting stance: sink the hips, stagger the feet, lean into the hose reaction
    // and sweep the stream across the base of the fire.
    const brace = m.brace;
    const sweepAngle = Math.sin(m.t * 1.7) * 0.22 * brace;
    pose.sweep = suppressing ? Math.sin(m.t * 1.7) * 0.9 : 0;
    if (brace > 0.01) {
      if (b.hips) b.hips.position.y -= 4 * brace * (isG1 ? 0.8 : 1);
      rotateBoneWorld(b.lUp, lateral, -0.35 * brace);
      rotateBoneWorld(b.lLeg, lateral, 0.45 * brace);
      rotateBoneWorld(b.rUp, lateral, 0.12 * brace);
      rotateBoneWorld(b.rLeg, lateral, 0.3 * brace);
      rotateBoneWorld(b.spine, UP, sweepAngle);
    }
    const lean = m.reach * 0.18 + m.carry * 0.06 + m.slump * 0.55 + brace * 0.22;
    rotateBoneWorld(b.spine, lateral, lean);
    if (st === "RECOVERING") rotateBoneWorld(b.spine, forward, Math.sin(m.t * 9) * 0.22);
    if (st === "SEARCHING") rotateBoneWorld(b.head, UP, Math.sin(m.t * 1.6) * 0.55);

    // Arms: right hand on the nozzle at hip-chest height, left hand forward supporting the line.
    rotateBoneWorld(b.rArm, lateral, -(m.reach * 1.25 + m.carry * 0.95 + brace * 1.05));
    rotateBoneWorld(b.lArm, lateral, -(m.reach * 1.05 + m.carry * 0.95 + brace * 1.25));
    rotateBoneWorld(b.lArm, UP, -0.35 * brace);
    rotateBoneWorld(b.rFore, lateral, -(m.reach * 0.25 + m.carry * 0.55 + brace * 0.45));
    rotateBoneWorld(b.lFore, lateral, -(m.reach * 0.35 + m.carry * 0.55 + brace * 0.65));
    rotateBoneWorld(b.lFore, UP, -0.5 * brace);

    const nozzleOut = brace > 0.4;
    rig.body.nozzle.visible = nozzleOut;
    if (nozzleOut) {
      rig.model.updateMatrixWorld(true);
      const tip = rig.body.nozzleTip.getWorldPosition(new THREE.Vector3());
      pose.nozzle = [tip.x, tip.y, tip.z];
    } else {
      pose.nozzle = null;
    }
    if (crate.current) crate.current.visible = pose.carrying;
    if (lamp.current) lamp.current.intensity = failed ? 0 : 40;
    if (labelRef.current) labelRef.current.textContent = `${profile.shortName} · ${STATE_LABEL[st]}`;
  });

  return (
    <group ref={root}>
      <group scale={scale}>
        <primitive object={rig.model} />
        <group ref={crate} visible={false}>
          <mesh position={[0, chestY, 0.38]} castShadow>
            <boxGeometry args={[0.42, 0.3, 0.32]} />
            <meshStandardMaterial color="#3b3f44" metalness={0.8} roughness={0.4} />
          </mesh>
          <mesh position={[0, chestY + 0.17, 0.38]}>
            <dodecahedronGeometry args={[0.13, 0]} />
            <meshStandardMaterial color="#d9a522" metalness={1} roughness={0.25} emissive="#7a4a00" emissiveIntensity={0.6} />
          </mesh>
        </group>
        {headlamp && (
          <>
            <spotLight
              ref={lamp}
              position={[0, headY, 0.14]}
              target={lampTarget}
              angle={0.55}
              penumbra={0.65}
              intensity={40}
              distance={22}
              decay={1.6}
              color="#fff1d6"
            />
            <primitive object={lampTarget} position={[0, 0.6, 5]} />
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
        <Html position={[0, profile.simulation.heightM + 0.35, 0]} center zIndexRange={[5, 0]} style={{ pointerEvents: "none" }}>
          <div
            ref={labelRef}
            className="whitespace-nowrap rounded-sm border-l-2 border-[#e10600] bg-black/60 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wider text-white/90"
          />
        </Html>
      )}
    </group>
  );
}

if (typeof window !== "undefined") {
  useGLTF.preload(MODEL_URL);
  void loadG1Model();
}
