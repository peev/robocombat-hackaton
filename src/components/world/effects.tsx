"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard } from "@react-three/drei";
import * as THREE from "three";

const NOISE_GLSL = /* glsl */ `
float hash3(vec3 p){ p = fract(p*0.3183099 + 0.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float vnoise(vec3 x){
  vec3 i = floor(x); vec3 f = fract(x); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(hash3(i+vec3(0,0,0)),hash3(i+vec3(1,0,0)),f.x),
                 mix(hash3(i+vec3(0,1,0)),hash3(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(hash3(i+vec3(0,0,1)),hash3(i+vec3(1,0,1)),f.x),
                 mix(hash3(i+vec3(0,1,1)),hash3(i+vec3(1,1,1)),f.x),f.y),f.z);
}
float fbm(vec3 p){ float a = 0.5; float s = 0.0; for(int i=0;i<5;i++){ s += a*vnoise(p); p *= 2.02; a *= 0.5; } return s; }
`;

/* ------------------------------------------------------------------ flames */

const flameVert = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
`;

const flameFrag = /* glsl */ `
uniform float uTime; uniform float uIntensity; uniform float uSeed;
varying vec2 vUv;
${NOISE_GLSL}
void main(){
  float y = vUv.y;
  float x = (vUv.x - 0.5) * 2.0;
  float t = uTime + uSeed * 13.0;
  float n  = fbm(vec3(x*1.7, y*2.6 - t*2.3, uSeed));
  float n2 = fbm(vec3(x*3.8, y*4.5 - t*3.6, uSeed*3.1 + 4.0));
  float width = mix(0.9, 0.06, pow(y, 0.85));
  float bend = (n - 0.5) * 0.75 * y;
  float shape = 1.0 - smoothstep(width*0.45, width, abs(x + bend));
  float top = 1.0 - smoothstep(0.45, 1.0, y + (n2 - 0.5) * 0.55);
  float body = shape * smoothstep(0.0, 0.06, y) * top;
  float heat = clamp(body * (0.55 + n*0.9) * (1.2 - y*0.8), 0.0, 1.0);
  vec3 col = mix(vec3(0.55,0.04,0.0), vec3(1.0,0.32,0.02), smoothstep(0.08,0.42,heat));
  col = mix(col, vec3(1.0,0.82,0.42), smoothstep(0.5,0.92,heat));
  float a = smoothstep(0.04, 0.32, heat) * uIntensity;
  gl_FragColor = vec4(col * (2.2 + 4.0*heat), a);
}
`;

function FlameSheet({
  seed,
  width,
  height,
  offset,
  intensity,
}: {
  seed: number;
  width: number;
  height: number;
  offset: [number, number, number];
  intensity: { current: number };
}) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: flameVert,
        fragmentShader: flameFrag,
        uniforms: { uTime: { value: 0 }, uIntensity: { value: 1 }, uSeed: { value: seed } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    [seed]
  );
  useFrame(({ clock }) => {
    mat.uniforms.uTime.value = clock.elapsedTime;
    mat.uniforms.uIntensity.value = Math.min(1, intensity.current * 1.1);
  });
  return (
    <Billboard lockX lockZ position={[offset[0], offset[1] + height / 2, offset[2]]}>
      <mesh material={mat}>
        <planeGeometry args={[width, height]} />
      </mesh>
    </Billboard>
  );
}

/* ------------------------------------------------------------------- smoke */

const smokeVert = /* glsl */ `
attribute float aSeed;
uniform float uTime; uniform float uRate; uniform float uHeight; uniform float uSpread;
uniform float uSizeMin; uniform float uSizeMax; uniform vec3 uWind;
varying vec2 vUv; varying float vAlpha; varying float vAge; varying float vSeed;
void main(){
  float age = fract(uTime * uRate + aSeed);
  vec3 base = vec3((fract(aSeed*91.7)-0.5)*uSpread, 0.0, (fract(aSeed*53.3)-0.5)*uSpread);
  vec3 p = base + vec3(0.0, age * uHeight, 0.0) + uWind * pow(age, 1.5) * uHeight;
  p.x += sin(age*6.0 + aSeed*20.0) * 0.5 * age * uSpread;
  p.z += cos(age*5.0 + aSeed*13.0) * 0.5 * age * uSpread;
  float size = mix(uSizeMin, uSizeMax, pow(age, 0.65));
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float rot = aSeed * 6.2831 + age * 1.3;
  vec2 c = mat2(cos(rot), -sin(rot), sin(rot), cos(rot)) * position.xy;
  mv.xy += c * size;
  gl_Position = projectionMatrix * mv;
  vUv = uv; vAge = age; vSeed = aSeed;
  vAlpha = smoothstep(0.0, 0.1, age) * (1.0 - smoothstep(0.5, 1.0, age));
}
`;

const smokeFrag = /* glsl */ `
uniform float uTime; uniform float uOpacity; uniform vec3 uColorLow; uniform vec3 uColorHigh;
uniform vec3 uGlow; uniform float uGlowAmount; uniform sampler2D uNoise;
varying vec2 vUv; varying float vAlpha; varying float vAge; varying float vSeed;
void main(){
  float d = length(vUv - 0.5) * 2.0;
  vec2 o = vec2(fract(vSeed * 7.13), fract(vSeed * 3.71));
  float n = texture2D(uNoise, vUv * 0.5 + o + vec2(0.0, uTime * 0.01)).r;
  float puff = 1.0 - smoothstep(0.2, 1.0, d + (n - 0.5) * 0.8);
  float a = puff * vAlpha * uOpacity * (0.6 + n * 0.6);
  vec3 col = mix(uColorLow, uColorHigh, smoothstep(0.0, 0.8, vAge));
  col *= 0.75 + n * 0.5;
  col += uGlow * uGlowAmount * (1.0 - smoothstep(0.0, 0.3, vAge));
  gl_FragColor = vec4(col, a);
}
`;

let sharedNoise: THREE.DataTexture | null = null;

/** Tileable fbm noise baked once so smoke fragments do a texture fetch instead of 5-octave noise. */
function smokeNoiseTexture(): THREE.DataTexture {
  if (sharedNoise) return sharedNoise;
  const size = 256;
  const data = new Uint8Array(size * size * 4);
  const lattice = (x: number, y: number, period: number) => {
    const xi = ((x % period) + period) % period;
    const yi = ((y % period) + period) % period;
    const s = Math.sin(xi * 127.1 + yi * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const noise = (x: number, y: number, period: number) => {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const u = fx * fx * (3 - 2 * fx);
    const v = fy * fy * (3 - 2 * fy);
    const a = lattice(x0, y0, period);
    const b = lattice(x0 + 1, y0, period);
    const c = lattice(x0, y0 + 1, period);
    const d = lattice(x0 + 1, y0 + 1, period);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let sum = 0;
      let amp = 0.5;
      let period = 8;
      for (let o = 0; o < 5; o++) {
        sum += amp * noise((x / size) * period, (y / size) * period, period);
        period *= 2;
        amp *= 0.5;
      }
      const i = (y * size + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = Math.round(Math.min(1, sum) * 255);
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  sharedNoise = tex;
  return tex;
}

export interface SmokeProps {
  count?: number;
  height?: number;
  spread?: number;
  rate?: number;
  sizeMin?: number;
  sizeMax?: number;
  wind?: [number, number, number];
  colorLow?: string;
  colorHigh?: string;
  glow?: string;
  /** Mutable [0..1] strength; read every frame. */
  strength: { current: number };
  glowStrength?: { current: number };
  maxOpacity?: number;
}

export function SmokeColumn({
  count = 90,
  height = 26,
  spread = 2.2,
  rate = 0.06,
  sizeMin = 1.2,
  sizeMax = 9,
  wind = [-0.55, 0, -0.35],
  colorLow = "#2a2522",
  colorHigh = "#4a4746",
  glow = "#ff6a1a",
  strength,
  glowStrength,
  maxOpacity = 0.75,
}: SmokeProps) {
  const mesh = useMemo(() => {
    const plane = new THREE.PlaneGeometry(1, 1);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = plane.index;
    geo.setAttribute("position", plane.getAttribute("position"));
    geo.setAttribute("uv", plane.getAttribute("uv"));
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) seeds[i] = (i + Math.random() * 0.5) / count;
    geo.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seeds, 1));
    geo.instanceCount = count;
    const mat = new THREE.ShaderMaterial({
      vertexShader: smokeVert,
      fragmentShader: smokeFrag,
      uniforms: {
        uTime: { value: 0 },
        uRate: { value: rate },
        uHeight: { value: height },
        uSpread: { value: spread },
        uSizeMin: { value: sizeMin },
        uSizeMax: { value: sizeMax },
        uWind: { value: new THREE.Vector3(...wind) },
        uOpacity: { value: maxOpacity },
        uColorLow: { value: new THREE.Color(colorLow) },
        uColorHigh: { value: new THREE.Color(colorHigh) },
        uGlow: { value: new THREE.Color(glow) },
        uGlowAmount: { value: 0 },
        uNoise: { value: smokeNoiseTexture() },
      },
      transparent: true,
      depthWrite: false,
    });
    const m = new THREE.Mesh(geo, mat);
    m.frustumCulled = false;
    m.renderOrder = 2;
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  useFrame(({ clock }) => {
    const mat = mesh.material as THREE.ShaderMaterial;
    const s = strength.current;
    mat.uniforms.uTime.value = clock.elapsedTime;
    mat.uniforms.uOpacity.value = maxOpacity * Math.min(1, s);
    mat.uniforms.uHeight.value = height * (0.5 + 0.5 * Math.min(1, s));
    mat.uniforms.uSizeMax.value = sizeMax * (0.55 + 0.45 * Math.min(1, s));
    mat.uniforms.uGlowAmount.value = glowStrength ? glowStrength.current * 1.6 : 0;
    mesh.visible = s > 0.01;
  });

  return <primitive object={mesh} />;
}

/* ------------------------------------------------------------------ embers */

const emberVert = /* glsl */ `
attribute float aSeed;
uniform float uTime; uniform float uHeight; uniform float uScale;
varying float vAlpha;
void main(){
  float age = fract(uTime * (0.25 + fract(aSeed*7.3)*0.35) + aSeed);
  vec3 p = vec3((fract(aSeed*91.7)-0.5)*2.0, age*uHeight, (fract(aSeed*53.3)-0.5)*2.0);
  p.x += sin(uTime*3.0 + aSeed*40.0) * 0.6 * age - age*age*2.0;
  p.z += cos(uTime*2.3 + aSeed*17.0) * 0.6 * age - age*age*1.2;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uScale * (0.6 + fract(aSeed*13.1)) * (220.0 / -mv.z);
  vAlpha = (1.0 - age) * step(0.02, age) * (0.6 + 0.4*sin(uTime*20.0 + aSeed*50.0));
}
`;

const emberFrag = /* glsl */ `
uniform float uIntensity;
varying float vAlpha;
void main(){
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d) * vAlpha * uIntensity;
  gl_FragColor = vec4(vec3(4.0, 1.5, 0.35), a);
}
`;

function Embers({ intensity, count = 160 }: { intensity: { current: number }; count?: number }) {
  const points = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) seeds[i] = Math.random();
    geo.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
    const mat = new THREE.ShaderMaterial({
      vertexShader: emberVert,
      fragmentShader: emberFrag,
      uniforms: { uTime: { value: 0 }, uHeight: { value: 9 }, uScale: { value: 0.12 }, uIntensity: { value: 1 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const p = new THREE.Points(geo, mat);
    p.frustumCulled = false;
    return p;
  }, [count]);
  useFrame(({ clock }) => {
    const mat = points.material as THREE.ShaderMaterial;
    mat.uniforms.uTime.value = clock.elapsedTime;
    mat.uniforms.uIntensity.value = Math.min(1, intensity.current);
    points.visible = intensity.current > 0.02;
  });
  return <primitive object={points} />;
}

/* -------------------------------------------------------------------- fire */

export function Fire({
  position,
  intensity,
  quality,
}: {
  position: [number, number, number];
  intensity: number;
  quality: "high" | "low";
}) {
  // Smooth toward the simulated intensity so suppression reads as a gradual knock-down.
  const level = useRef(intensity);
  const steam = useRef(0);
  const light = useRef<THREE.PointLight>(null);
  const smokeStrength = useRef(intensity);
  const glow = useRef(intensity);
  const target = useRef(intensity);
  target.current = intensity;

  useFrame(({ clock }, dt) => {
    const k = 1 - Math.exp(-dt * 1.5);
    const prev = level.current;
    level.current += (target.current - level.current) * k;
    const knockdownRate = (prev - level.current) / Math.max(dt, 1e-4);
    steam.current += (knockdownRate > 0.02 ? 1 : -0.25) * dt * 0.6;
    steam.current = THREE.MathUtils.clamp(steam.current, 0, 1);
    const l = Math.min(1.3, level.current);
    smokeStrength.current = Math.min(1, l * 1.1);
    glow.current = l;
    if (light.current) {
      const t = clock.elapsedTime;
      const flicker = 0.82 + Math.sin(t * 17) * 0.08 + Math.sin(t * 31 + 1.3) * 0.06 + Math.sin(t * 7.3) * 0.05;
      light.current.intensity = l * 260 * flicker;
    }
  });

  const flames = useMemo(
    () => [
      { seed: 0.11, w: 2.6, h: 4.4, o: [0, 0, 0] as [number, number, number] },
      { seed: 0.37, w: 2.0, h: 3.4, o: [0.7, 0, 0.4] as [number, number, number] },
      { seed: 0.58, w: 2.1, h: 3.0, o: [-0.8, 0, -0.3] as [number, number, number] },
      { seed: 0.83, w: 1.6, h: 2.5, o: [0.2, 0, -0.9] as [number, number, number] },
      { seed: 0.95, w: 1.5, h: 2.2, o: [-0.4, 0, 0.9] as [number, number, number] },
    ],
    []
  );

  return (
    <group position={position}>
      {flames.map((f) => (
        <FlameSheet
          key={f.seed}
          seed={f.seed}
          width={f.w}
          height={f.h}
          offset={f.o}
          intensity={level}
        />
      ))}
      <Embers intensity={level} count={quality === "high" ? 220 : 90} />
      <group position={[0, 2.2, 0]}>
        <SmokeColumn
          count={quality === "high" ? 110 : 50}
          strength={smokeStrength}
          glowStrength={glow}
        />
      </group>
      <group position={[0, 0.6, 0]}>
        <SmokeColumn
          count={quality === "high" ? 50 : 24}
          height={10}
          spread={2.4}
          rate={0.12}
          sizeMin={0.8}
          sizeMax={5}
          colorLow="#d8d8d8"
          colorHigh="#f2f2f2"
          wind={[-0.4, 0, -0.2]}
          strength={steam}
          maxOpacity={0.45}
        />
      </group>
      <pointLight
        ref={light}
        position={[0, 1.6, 0]}
        color="#ff7a24"
        intensity={200}
        distance={32}
        decay={1.7}
      />
    </group>
  );
}

/* ------------------------------------------------------------------- spray */

const sprayVert = /* glsl */ `
attribute float aSeed;
uniform float uTime; uniform vec3 uFrom; uniform vec3 uTo; uniform float uActive;
varying float vAlpha;
void main(){
  float t = fract(uTime * 1.6 + aSeed);
  vec3 jitter = vec3(fract(aSeed*91.7)-0.5, fract(aSeed*37.1)-0.5, fract(aSeed*53.3)-0.5);
  vec3 p = mix(uFrom, uTo, t) + vec3(0.0, sin(t*3.14159) * 0.9, 0.0) + jitter * (0.1 + t*1.4);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = (0.08 + t*0.45) * (300.0 / -mv.z);
  vAlpha = uActive * (1.0 - t) * smoothstep(0.0, 0.05, t);
}
`;

const sprayFrag = /* glsl */ `
varying float vAlpha;
void main(){
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.1, d) * vAlpha * 0.55;
  gl_FragColor = vec4(vec3(0.92, 0.96, 1.0) * 1.6, a);
}
`;

/** Extinguishing agent stream; `from`/`to`/`active` are refreshed by the caller each frame. */
export function Spray({
  stream,
}: {
  stream: { from: THREE.Vector3; to: THREE.Vector3; active: number };
}) {
  const points = useMemo(() => {
    const count = 260;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) seeds[i] = Math.random();
    geo.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
    const mat = new THREE.ShaderMaterial({
      vertexShader: sprayVert,
      fragmentShader: sprayFrag,
      uniforms: {
        uTime: { value: 0 },
        uFrom: { value: new THREE.Vector3() },
        uTo: { value: new THREE.Vector3() },
        uActive: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
    });
    const p = new THREE.Points(geo, mat);
    p.frustumCulled = false;
    return p;
  }, []);
  useFrame(({ clock }) => {
    const u = (points.material as THREE.ShaderMaterial).uniforms;
    u.uTime.value = clock.elapsedTime;
    u.uFrom.value.copy(stream.from);
    u.uTo.value.copy(stream.to);
    u.uActive.value = stream.active;
    points.visible = stream.active > 0.01;
  });
  return <primitive object={points} />;
}

/* -------------------------------------------------------------------- dust */

const dustVert = /* glsl */ `
attribute float aSeed;
uniform float uTime; uniform vec3 uSize;
varying float vAlpha;
void main(){
  vec3 p = position;
  p.x += sin(uTime*0.13 + aSeed*30.0) * 0.6;
  p.y = mod(p.y + uTime*0.04*(0.3 + aSeed), uSize.y);
  p.z += cos(uTime*0.11 + aSeed*20.0) * 0.6;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = (0.025 + aSeed*0.03) * (300.0 / -mv.z);
  vAlpha = 0.35 + 0.35*sin(uTime*0.7 + aSeed*12.0);
}
`;

const dustFrag = /* glsl */ `
uniform vec3 uColor;
varying float vAlpha;
void main(){
  float d = length(gl_PointCoord - 0.5);
  gl_FragColor = vec4(uColor, smoothstep(0.5, 0.0, d) * vAlpha);
}
`;

export function Dust({
  origin,
  size,
  count = 700,
  color = "#d8c7a4",
}: {
  origin: [number, number, number];
  size: [number, number, number];
  count?: number;
  color?: string;
}) {
  const points = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = Math.random() * size[0];
      pos[i * 3 + 1] = Math.random() * size[1];
      pos[i * 3 + 2] = Math.random() * size[2];
      seeds[i] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
    const mat = new THREE.ShaderMaterial({
      vertexShader: dustVert,
      fragmentShader: dustFrag,
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: new THREE.Vector3(...size) },
        uColor: { value: new THREE.Color(color) },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const p = new THREE.Points(geo, mat);
    p.frustumCulled = false;
    return p;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);
  useFrame(({ clock }) => {
    (points.material as THREE.ShaderMaterial).uniforms.uTime.value = clock.elapsedTime;
  });
  return <primitive object={points} position={origin} />;
}
