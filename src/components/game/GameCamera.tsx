"use client";

import { useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

export type CameraMode = "third" | "spectator" | "cinematic" | "robot";

interface GameCameraProps {
  /** Followed subject; read every frame so it can be a mutable pose object. */
  follow: { x: number; y: number; z: number; heading: number };
  mode: CameraMode;
  cinematicPhase?: number;
  mission: "fire-rescue" | "deep-mine";
  interactive?: boolean;
}

export function GameCamera({
  follow,
  mode,
  cinematicPhase = 0,
  mission,
  interactive = true,
}: GameCameraProps) {
  const { camera, gl } = useThree();
  const yaw = useRef(0);
  const pitch = useRef(0.35);
  const dist = useRef(mission === "deep-mine" ? 4.5 : 6.5);
  const smooth = useRef(new THREE.Vector3(follow.x, follow.y + 2, follow.z - 6));
  const look = useRef(new THREE.Vector3(follow.x, follow.y, follow.z));
  const heading = useRef(follow.heading);

  useEffect(() => {
    if (!interactive) return;
    const el = gl.domElement;
    const onMove = (e: MouseEvent) => {
      if (mode !== "third" && mode !== "spectator") return;
      if (document.pointerLockElement !== el && !(e.buttons & 1)) return;
      yaw.current -= e.movementX * 0.005;
      pitch.current = Math.max(0.05, Math.min(1.2, pitch.current + e.movementY * 0.004));
    };
    const onWheel = (e: WheelEvent) => {
      dist.current = Math.max(2.5, Math.min(24, dist.current + e.deltaY * 0.01));
    };
    const onClick = () => {
      if (mode === "third") el.requestPointerLock?.();
    };
    el.addEventListener("mousemove", onMove);
    el.addEventListener("wheel", onWheel, { passive: true });
    el.addEventListener("click", onClick);
    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("click", onClick);
    };
  }, [gl, mode, interactive]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const t = new THREE.Vector3(follow.x, follow.y, follow.z);
    let dh = follow.heading - heading.current;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    heading.current += dh * (1 - Math.exp(-dt * 2.5));
    const h = heading.current;
    look.current.lerp(new THREE.Vector3(t.x, t.y + 1.2, t.z), 1 - Math.exp(-dt * 6));

    if (mode === "cinematic") {
      const p = cinematicPhase;
      if (mission === "fire-rescue") {
        smooth.current.lerp(new THREE.Vector3(-30 + p * 40, 18 - p * 8, -25 + p * 20), 0.04);
        camera.position.copy(smooth.current);
        camera.lookAt(12, 2, 8);
      } else {
        smooth.current.lerp(new THREE.Vector3(-6 + p * 10, 2.6 + Math.sin(p * 3) * 0.3, 8), 0.05);
        camera.position.copy(smooth.current);
        camera.lookAt(t.x, t.y + 1, t.z);
      }
      return;
    }

    if (mode === "robot") {
      camera.position.set(t.x + Math.sin(h) * 0.25, t.y + 1.55, t.z + Math.cos(h) * 0.25);
      camera.lookAt(t.x + Math.sin(h) * 8, t.y + 1.2, t.z + Math.cos(h) * 8);
      return;
    }

    if (mode === "spectator") {
      const desired = new THREE.Vector3(
        t.x + Math.sin(yaw.current) * dist.current * 1.4,
        t.y + (mission === "deep-mine" ? 3 : 6 + pitch.current * 4),
        t.z + Math.cos(yaw.current) * dist.current * 1.4
      );
      smooth.current.lerp(desired, 1 - Math.exp(-dt * 4));
      camera.position.copy(smooth.current);
      camera.lookAt(look.current);
      return;
    }

    const desired = new THREE.Vector3(
      t.x - Math.sin(h + yaw.current) * dist.current,
      t.y + 1.6 + pitch.current * (mission === "deep-mine" ? 1.2 : 2.2),
      t.z - Math.cos(h + yaw.current) * dist.current
    );
    smooth.current.lerp(desired, 1 - Math.exp(-dt * 5));
    camera.position.copy(smooth.current);
    camera.lookAt(look.current);
  });

  return null;
}
