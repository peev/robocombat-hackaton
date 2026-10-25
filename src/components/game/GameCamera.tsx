"use client";

import { useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

export type CameraMode = "third" | "spectator" | "cinematic" | "robot";

interface GameCameraProps {
  target: [number, number, number];
  heading: number;
  mode: CameraMode;
  cinematicPhase?: number;
  mission: "fire-rescue" | "deep-mine";
}

export function GameCamera({
  target,
  heading,
  mode,
  cinematicPhase = 0,
  mission,
}: GameCameraProps) {
  const { camera, gl } = useThree();
  const yaw = useRef(0);
  const pitch = useRef(0.35);
  const dist = useRef(8);
  const smooth = useRef(new THREE.Vector3(target[0], target[1] + 1.5, target[2] + 8));
  const look = useRef(new THREE.Vector3(...target));

  useEffect(() => {
    const el = gl.domElement;
    const onMove = (e: MouseEvent) => {
      if (mode !== "third" && mode !== "spectator") return;
      if (document.pointerLockElement !== el && !(e.buttons & 1)) return;
      yaw.current -= e.movementX * 0.005;
      pitch.current = Math.max(
        0.05,
        Math.min(1.2, pitch.current + e.movementY * 0.004)
      );
    };
    const onWheel = (e: WheelEvent) => {
      dist.current = Math.max(3, Math.min(24, dist.current + e.deltaY * 0.01));
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
  }, [gl, mode]);

  useFrame((_, dt) => {
    const t = target;
    look.current.lerp(new THREE.Vector3(t[0], t[1] + 1.2, t[2]), 1 - Math.pow(0.001, dt));

    if (mode === "cinematic") {
      if (mission === "fire-rescue") {
        const p = cinematicPhase;
        const cx = -30 + p * 40;
        const cy = 18 - p * 8;
        const cz = -25 + p * 20;
        smooth.current.lerp(new THREE.Vector3(cx, cy, cz), 0.04);
        camera.position.copy(smooth.current);
        camera.lookAt(12, 2, 8);
      } else {
        const p = cinematicPhase;
        const cx = -8 + p * 12;
        const cy = 3 + Math.sin(p * 3) * 0.5;
        const cz = 8 - p * 2;
        smooth.current.lerp(new THREE.Vector3(cx, cy, cz), 0.05);
        camera.position.copy(smooth.current);
        camera.lookAt(t[0], t[1] + 1, t[2]);
      }
      return;
    }

    if (mode === "robot") {
      const eye = new THREE.Vector3(
        t[0] + Math.sin(heading) * 0.2,
        t[1] + 1.4,
        t[2] + Math.cos(heading) * 0.2
      );
      camera.position.lerp(eye, 0.2);
      camera.lookAt(
        t[0] + Math.sin(heading) * 8,
        t[1] + 1.1,
        t[2] + Math.cos(heading) * 8
      );
      return;
    }

    if (mode === "spectator") {
      const desired = new THREE.Vector3(
        t[0] + Math.sin(yaw.current) * dist.current * 1.4,
        t[1] + 6 + pitch.current * 4,
        t[2] + Math.cos(yaw.current) * dist.current * 1.4
      );
      smooth.current.lerp(desired, 0.08);
      camera.position.copy(smooth.current);
      camera.lookAt(look.current);
      return;
    }

    // third person
    const desired = new THREE.Vector3(
      t[0] - Math.sin(heading + yaw.current) * dist.current,
      t[1] + 2.2 + pitch.current * 2,
      t[2] - Math.cos(heading + yaw.current) * dist.current
    );
    smooth.current.lerp(desired, 1 - Math.pow(0.0002, dt));
    camera.position.copy(smooth.current);
    camera.lookAt(look.current);
  });

  return null;
}
