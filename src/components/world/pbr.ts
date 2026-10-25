"use client";

import { useMemo } from "react";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";

export type PbrSet = "deck" | "container" | "rust" | "rockwall" | "minefloor" | "timber";

export interface PbrMaps {
  map?: THREE.Texture;
  normalMap: THREE.Texture;
  roughnessMap: THREE.Texture;
  metalnessMap: THREE.Texture;
  aoMap: THREE.Texture;
}

/**
 * Loads a Poly Haven texture set (diffuse / OpenGL normal / AO-rough-metal) and returns
 * independently tiled clones so several materials can share the same images.
 */
export function usePbr(
  set: PbrSet,
  repeat: [number, number] = [1, 1],
  opts: { withColor?: boolean } = {}
): PbrMaps {
  const withColor = opts.withColor ?? true;
  const [diff, nor, arm] = useTexture([
    `/textures/${set}/diff.jpg`,
    `/textures/${set}/nor.jpg`,
    `/textures/${set}/arm.jpg`,
  ]);

  const [rx, ry] = repeat;
  return useMemo(() => {
    const prep = (t: THREE.Texture, srgb = false) => {
      const c = t.clone();
      c.wrapS = c.wrapT = THREE.RepeatWrapping;
      c.repeat.set(rx, ry);
      c.anisotropy = 16;
      c.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      c.needsUpdate = true;
      return c;
    };
    const armTex = prep(arm);
    return {
      map: withColor ? prep(diff, true) : undefined,
      normalMap: prep(nor),
      roughnessMap: armTex,
      metalnessMap: armTex,
      aoMap: armTex,
    };
  }, [diff, nor, arm, rx, ry, withColor]);
}

export function preloadPbr(...sets: PbrSet[]) {
  if (typeof window === "undefined") return;
  for (const set of sets) {
    useTexture.preload([`/textures/${set}/diff.jpg`, `/textures/${set}/nor.jpg`, `/textures/${set}/arm.jpg`]);
  }
}

/** Tiny deterministic value-noise for procedural displacement. */
export function hashNoise3(x: number, y: number, z: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

function smoothNoise3(x: number, y: number, z: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const xf = x - xi;
  const yf = y - yi;
  const zf = z - zi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const w = zf * zf * (3 - 2 * zf);
  const n = (dx: number, dy: number, dz: number) => hashNoise3(xi + dx, yi + dy, zi + dz);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  return lerp(
    lerp(lerp(n(0, 0, 0), n(1, 0, 0), u), lerp(n(0, 1, 0), n(1, 1, 0), u), v),
    lerp(lerp(n(0, 0, 1), n(1, 0, 1), u), lerp(n(0, 1, 1), n(1, 1, 1), u), v),
    w
  );
}

export function fbm3(x: number, y: number, z: number, octaves = 4): number {
  let amp = 0.5;
  let freq = 1;
  let sum = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * (smoothNoise3(x * freq, y * freq, z * freq) * 2 - 1);
    freq *= 2.03;
    amp *= 0.5;
  }
  return sum;
}
