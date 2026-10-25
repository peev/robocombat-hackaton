import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { RobotId } from "@/lib/robots/profiles";

/** Bones in the Xbot rig are in centimetres; attachments are authored in metres. */
const BONE_TO_METRES = 100;

type BoneLookup = (name: string) => THREE.Object3D | undefined;
type Vec3 = [number, number, number];

/* ------------------------------------------------------------- textures */

const texCache = new Map<string, THREE.CanvasTexture>();

function canvasTexture(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const hit = texCache.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  texCache.set(key, t);
  return t;
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** Rear face of the Dell GB10 on-robot evaluation kit. */
function kitPanelTexture() {
  return canvasTexture("kit", 512, 640, (g) => {
    const W = 512;
    const H = 640;
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#34383c");
    bg.addColorStop(1, "#202326");
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 7; i++) {
      g.fillStyle = "#15171a";
      roundRect(g, 70, 34 + i * 16, W - 140, 7, 3);
      g.fill();
    }
    g.fillStyle = "#2a2d31";
    roundRect(g, 40, 160, W - 80, H - 200, 18);
    g.fill();
    g.strokeStyle = "rgba(255,255,255,0.08)";
    g.lineWidth = 3;
    g.stroke();
    g.fillStyle = "#f2f2f2";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = "bold 112px Arial, Helvetica, sans-serif";
    ["D", "E", "L", "L"].forEach((ch, i) => g.fillText(ch, W / 2 - 128 + [0, 88, 176, 258][i], 250));
    const lx = W / 2 - 75;
    const ly = 340;
    g.fillStyle = "#76b900";
    roundRect(g, lx, ly, 150, 110, 10);
    g.fill();
    g.strokeStyle = "#ffffff";
    g.lineWidth = 10;
    g.beginPath();
    g.ellipse(lx + 80, ly + 55, 52, 32, 0, Math.PI * 0.15, Math.PI * 1.85);
    g.stroke();
    g.lineWidth = 8;
    g.beginPath();
    g.ellipse(lx + 84, ly + 55, 26, 18, 0, Math.PI * 0.3, Math.PI * 1.9);
    g.stroke();
    g.fillStyle = "#ffffff";
    g.beginPath();
    g.arc(lx + 88, ly + 55, 7, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#f2f2f2";
    g.font = "bold 70px Arial, Helvetica, sans-serif";
    g.fillText("NVIDIA", W / 2, 510);
    g.fillStyle = "#9aa0a6";
    g.font = "600 34px Arial, Helvetica, sans-serif";
    g.fillText("GB10 · EVAL KIT", W / 2, 572);
  });
}

function wordmarkTexture(key: string, text: string, color: string, bg: string, font: string) {
  return canvasTexture(key, 512, 128, (g) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, 512, 128);
    g.fillStyle = color;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = font;
    g.fillText(text, 256, 66);
  });
}

/** AgiBot A2 facial screen: two soft eye glyphs on black glass. */
function a2FaceTexture() {
  return canvasTexture("a2face", 256, 256, (g) => {
    g.fillStyle = "#020304";
    g.fillRect(0, 0, 256, 256);
    for (const x of [86, 170]) {
      const grd = g.createRadialGradient(x, 120, 2, x, 120, 34);
      grd.addColorStop(0, "rgba(160,225,255,1)");
      grd.addColorStop(0.45, "rgba(60,170,255,0.9)");
      grd.addColorStop(1, "rgba(0,60,140,0)");
      g.fillStyle = grd;
      g.beginPath();
      g.ellipse(x, 120, 30, 22, 0, 0, Math.PI * 2);
      g.fill();
    }
  });
}

/* ---------------------------------------------------------- build helpers */

class Builder {
  geos: THREE.BufferGeometry[] = [];
  mats: THREE.Material[] = [];
  private sphereGeo = this.g(new THREE.SphereGeometry(1, 32, 22));
  private cylGeo = this.g(new THREE.CylinderGeometry(1, 1, 1, 28));
  private boxCache = new Map<string, THREE.BufferGeometry>();

  constructor(private bone: BoneLookup, private unit = BONE_TO_METRES) {}

  g<T extends THREE.BufferGeometry>(geo: T) {
    this.geos.push(geo);
    return geo;
  }
  m<T extends THREE.Material>(mat: T) {
    this.mats.push(mat);
    return mat;
  }
  mount(name: string) {
    const grp = new THREE.Group();
    grp.scale.setScalar(this.unit);
    this.bone(name)?.add(grp);
    return grp;
  }
  box(w: number, h: number, d: number, r = 0.02) {
    const key = `${w}|${h}|${d}|${r}`;
    let geo = this.boxCache.get(key);
    if (!geo) {
      geo = this.g(new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4)));
      this.boxCache.set(key, geo);
    }
    return geo;
  }
  get sphere() {
    return this.sphereGeo;
  }
  get cyl() {
    return this.cylGeo;
  }
  add(parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, pos: Vec3, rot: Vec3 = [0, 0, 0], scale: Vec3 = [1, 1, 1]) {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(...pos);
    mesh.rotation.set(...rot);
    mesh.scale.set(...scale);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  /** Cylinder along an axis ("x" | "y" | "z"). */
  rod(parent: THREE.Object3D, mat: THREE.Material, pos: Vec3, axis: "x" | "y" | "z", radius: number, length: number) {
    const rot: Vec3 = axis === "x" ? [0, 0, Math.PI / 2] : axis === "z" ? [Math.PI / 2, 0, 0] : [0, 0, 0];
    return this.add(parent, this.cylGeo, mat, pos, rot, [radius, length, radius]);
  }
}

/* -------------------------------------------------- shared kit + nozzle */

function buildKit(b: Builder, parentBone: string, offset: Vec3, scale: number) {
  const gunmetal = b.m(new THREE.MeshStandardMaterial({ color: "#2a2d31", roughness: 0.42, metalness: 0.75 }));
  const rubber = b.m(new THREE.MeshStandardMaterial({ color: "#121314", roughness: 0.85, metalness: 0.1 }));
  const panel = b.m(new THREE.MeshStandardMaterial({ map: kitPanelTexture(), roughness: 0.55, metalness: 0.35 }));
  const green = b.m(new THREE.MeshBasicMaterial({ color: new THREE.Color("#76ff2a").multiplyScalar(3), toneMapped: false }));

  const chest = b.mount(parentBone);
  const kit = new THREE.Group();
  kit.position.set(...offset);
  kit.scale.setScalar(scale);
  chest.add(kit);
  b.add(kit, b.box(0.3, 0.38, 0.13, 0.025), gunmetal, [0, 0, 0]);
  b.add(kit, b.g(new THREE.PlaneGeometry(0.27, 0.34)), panel, [0, 0, -0.0665], [0, Math.PI, 0]).castShadow = false;
  b.add(kit, b.box(0.32, 0.03, 0.15, 0.012), rubber, [0, 0.19, 0]);
  b.add(kit, b.box(0.32, 0.03, 0.15, 0.012), rubber, [0, -0.19, 0]);
  b.add(kit, b.box(0.014, 0.24, 0.014, 0.005), green, [-0.152, 0, -0.05]).castShadow = false;
  b.add(kit, b.box(0.07, 0.15, 0.09, 0.012), gunmetal, [0.19, -0.05, 0]);
  b.rod(kit, rubber, [0.1, 0.36, 0.01], "y", 0.007, 0.36);
  b.rod(kit, rubber, [0.065, 0.28, 0.03], "y", 0.006, 0.2);
  b.rod(kit, gunmetal, [0.1, 0.2, 0.01], "y", 0.016, 0.03);
  // Harness straps over the shoulders
  for (const x of [-0.09, 0.09]) b.add(kit, b.box(0.045, 0.02, 0.2, 0.008), rubber, [x, 0.19, 0.12]);
}

function buildNozzle(b: Builder, handOffset: Vec3) {
  const gunmetal = b.m(new THREE.MeshStandardMaterial({ color: "#2a2d31", roughness: 0.42, metalness: 0.75 }));
  const brass = b.m(new THREE.MeshStandardMaterial({ color: "#b8862f", roughness: 0.3, metalness: 1 }));
  const red = b.m(new THREE.MeshStandardMaterial({ color: "#b3140c", roughness: 0.4, metalness: 0.5 }));
  const hand = b.mount("RightHand");
  const nozzle = new THREE.Group();
  nozzle.visible = false;
  nozzle.position.set(...handOffset);
  hand.add(nozzle);
  b.rod(nozzle, gunmetal, [-0.08, 0, 0], "x", 0.03, 0.2);
  b.rod(nozzle, red, [-0.17, 0, 0], "x", 0.036, 0.04);
  b.add(nozzle, b.g(new THREE.CylinderGeometry(0.018, 0.04, 0.09, 20)), brass, [-0.235, 0, 0], [0, 0, Math.PI / 2]);
  b.rod(nozzle, gunmetal, [-0.05, -0.06, 0], "y", 0.015, 0.1);
  b.add(nozzle, b.box(0.03, 0.03, 0.09, 0.008), red, [-0.12, 0.04, 0]);
  const tip = new THREE.Object3D();
  tip.position.set(-0.29, 0, 0);
  nozzle.add(tip);
  return { nozzle, tip };
}

/* -------------------------------------------------------- Boston Dynamics */

function buildAtlas(b: Builder) {
  const alu = b.m(
    new THREE.MeshPhysicalMaterial({ color: "#b9bdc2", metalness: 0.92, roughness: 0.34, clearcoat: 0.2, clearcoatRoughness: 0.5 })
  );
  const graphite = b.m(new THREE.MeshStandardMaterial({ color: "#3a3d42", metalness: 0.55, roughness: 0.5 }));
  const black = b.m(new THREE.MeshStandardMaterial({ color: "#141517", metalness: 0.3, roughness: 0.65 }));
  const lens = b.m(new THREE.MeshPhysicalMaterial({ color: "#071a10", metalness: 0.4, roughness: 0.05, clearcoat: 1 }));
  const ring = b.m(new THREE.MeshBasicMaterial({ color: new THREE.Color("#c8ff9a").multiplyScalar(2.6), toneMapped: false }));
  const logo = b.m(
    new THREE.MeshStandardMaterial({
      map: wordmarkTexture("bd", "Boston Dynamics", "#e8e8e8", "#3a3d42", "600 54px Arial, Helvetica, sans-serif"),
      metalness: 0.5,
      roughness: 0.5,
    })
  );

  /* Ring-light disc head on a short stem */
  const head = b.mount("Head");
  b.rod(head, alu, [0, 0.0, 0], "y", 0.035, 0.08);
  const disc = new THREE.Group();
  disc.position.set(0, 0.12, 0.0);
  head.add(disc);
  b.rod(disc, alu, [0, 0, 0], "z", 0.125, 0.085);
  b.add(disc, b.g(new THREE.TorusGeometry(0.1, 0.012, 12, 48)), ring, [0, 0, 0.044]).castShadow = false;
  b.add(disc, b.g(new THREE.TorusGeometry(0.1, 0.012, 12, 48)), ring, [0, 0, -0.044]).castShadow = false;
  b.add(disc, b.g(new THREE.CircleGeometry(0.088, 40)), lens, [0, 0, 0.0435]);
  b.add(disc, b.g(new THREE.CircleGeometry(0.088, 40)), lens, [0, 0, -0.0435], [0, Math.PI, 0]);
  b.rod(disc, black, [0.02, 0.135, 0], "y", 0.006, 0.05);

  /* Torso: aluminium shell, dark chest plate, black shoulder caps */
  const chest = b.mount("Spine2");
  b.add(chest, b.box(0.4, 0.34, 0.24, 0.06), alu, [0, 0.07, 0.0]);
  b.add(chest, b.box(0.27, 0.26, 0.03, 0.03), graphite, [0, 0.04, 0.115]);
  b.add(chest, b.g(new THREE.PlaneGeometry(0.2, 0.05)), logo, [0, 0.15, 0.131]).castShadow = false;
  for (const s of [1, -1]) b.add(chest, b.box(0.1, 0.12, 0.14, 0.04), black, [0.2 * s, 0.13, 0.0]);
  const waist = b.mount("Spine");
  b.rod(waist, alu, [0, 0.03, 0], "y", 0.085, 0.12);
  b.rod(waist, graphite, [0, 0.1, 0], "y", 0.095, 0.03);

  /* Wide pelvis with round hip actuator covers */
  const hips = b.mount("Hips");
  b.add(hips, b.box(0.36, 0.17, 0.22, 0.06), alu, [0, -0.04, 0]);
  for (const s of [1, -1]) {
    b.rod(hips, black, [0.18 * s, -0.06, 0.01], "x", 0.055, 0.02);
    b.rod(hips, alu, [0.165 * s, -0.06, 0.01], "x", 0.075, 0.04);
  }

  for (const s of [1, -1] as const) {
    const L = s === 1 ? "Left" : "Right";
    /* Legs: offset thigh link, big knee actuator, banded shin, flat black foot */
    const thigh = b.mount(`${L}UpLeg`);
    b.add(thigh, b.box(0.15, 0.36, 0.17, 0.05), alu, [0.01 * s, -0.2, 0.01]);
    b.rod(thigh, graphite, [0.0, -0.05, 0.0], "x", 0.075, 0.16);
    const shin = b.mount(`${L}Leg`);
    b.rod(shin, alu, [0, 0, 0], "x", 0.07, 0.17);
    b.rod(shin, black, [0, 0, 0], "x", 0.045, 0.18);
    b.rod(shin, alu, [0, -0.2, 0.01], "y", 0.065, 0.32);
    b.rod(shin, black, [0, -0.06, 0.01], "y", 0.068, 0.04);
    b.rod(shin, graphite, [0, -0.36, 0.01], "y", 0.06, 0.05);
    const foot = b.mount(`${L}Foot`);
    b.add(foot, b.box(0.12, 0.06, 0.26, 0.02), black, [0, -0.05, 0.05]);
    b.rod(foot, alu, [0, 0.0, 0], "x", 0.04, 0.1);

    /* Arms: aluminium links, black elbow actuators, three-finger gripper */
    const upper = b.mount(`${L}Arm`);
    b.rod(upper, alu, [0.03 * s, 0, 0], "x", 0.075, 0.1);
    b.rod(upper, alu, [0.16 * s, 0, 0], "x", 0.055, 0.2);
    const fore = b.mount(`${L}ForeArm`);
    b.rod(fore, black, [0, 0, 0], "z", 0.06, 0.12);
    b.rod(fore, alu, [0.13 * s, 0, 0], "x", 0.048, 0.22);
    b.rod(fore, graphite, [0.24 * s, 0, 0], "x", 0.05, 0.03);
    const hand = b.mount(`${L}Hand`);
    b.add(hand, b.box(0.08, 0.05, 0.08, 0.015), black, [0.04 * s, 0, 0]);
    for (const z of [-0.025, 0.025]) b.add(hand, b.box(0.07, 0.02, 0.02, 0.006), black, [0.11 * s, -0.01, z]);
    b.add(hand, b.box(0.05, 0.02, 0.02, 0.006), black, [0.08 * s, -0.01, 0.05]);
  }
}

/* ----------------------------------------------------------------- AgiBot */

function buildA2(b: Builder) {
  const shell = b.m(new THREE.MeshPhysicalMaterial({ color: "#eef0f2", metalness: 0.05, roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.2 }));
  const dark = b.m(new THREE.MeshStandardMaterial({ color: "#1c1e22", metalness: 0.45, roughness: 0.45 }));
  const glossBlack = b.m(new THREE.MeshPhysicalMaterial({ color: "#07080a", metalness: 0.3, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.04 }));
  const face = b.m(new THREE.MeshBasicMaterial({ map: a2FaceTexture(), toneMapped: false, color: new THREE.Color(1.6, 1.6, 1.6) }));
  const blue = b.m(new THREE.MeshBasicMaterial({ color: new THREE.Color("#3aa8ff").multiplyScalar(2.4), toneMapped: false }));
  const logo = b.m(
    new THREE.MeshStandardMaterial({
      map: wordmarkTexture("agibot", "A G I B O T", "#9aa3ad", "#eef0f2", "500 56px Arial, Helvetica, sans-serif"),
      roughness: 0.35,
    })
  );

  /* Glossy black egg head with expression screen */
  const head = b.mount("Head");
  b.rod(head, dark, [0, 0.0, 0], "y", 0.04, 0.08);
  b.add(head, b.sphere, glossBlack, [0, 0.105, 0.0], [0, 0, 0], [0.098, 0.128, 0.112]);
  b.add(head, b.g(new THREE.CircleGeometry(1, 40)), face, [0, 0.105, 0.105], [-0.06, 0, 0], [0.055, 0.045, 1]).castShadow = false;
  for (const s of [1, -1]) b.add(head, b.box(0.012, 0.06, 0.04, 0.005), blue, [0.093 * s, 0.11, -0.01]).castShadow = false;

  /* White chest shell with wordmark and curved light, black abdomen */
  const chest = b.mount("Spine2");
  b.add(chest, b.box(0.38, 0.3, 0.22, 0.08), shell, [0, 0.07, 0.01]);
  b.add(chest, b.g(new THREE.PlaneGeometry(0.16, 0.04)), logo, [0, 0.16, 0.121]).castShadow = false;
  const arc = new THREE.Group();
  arc.position.set(0, 0.02, 0.0);
  chest.add(arc);
  const lightArc = b.add(arc, b.g(new THREE.TorusGeometry(0.2, 0.006, 8, 40, 1.1)), blue, [0, 0, 0], [0, 0, Math.PI / 2 - 0.55], [1, 0.45, 1]);
  lightArc.position.set(0, -0.06, 0.122);
  lightArc.castShadow = false;
  for (const s of [1, -1]) b.add(chest, b.box(0.1, 0.11, 0.14, 0.045), shell, [0.205 * s, 0.14, 0]);
  b.add(b.mount("Spine1"), b.box(0.29, 0.13, 0.19, 0.05), dark, [0, 0.0, 0.01]);
  b.add(b.mount("Spine"), b.box(0.27, 0.1, 0.18, 0.04), dark, [0, 0.02, 0.01]);
  b.add(b.mount("Hips"), b.box(0.32, 0.15, 0.2, 0.05), dark, [0, -0.03, 0]);

  for (const s of [1, -1] as const) {
    const L = s === 1 ? "Left" : "Right";
    const thigh = b.mount(`${L}UpLeg`);
    b.rod(thigh, dark, [0, -0.02, 0], "x", 0.07, 0.15);
    b.add(thigh, b.box(0.14, 0.36, 0.16, 0.06), shell, [0, -0.22, 0.01]);
    b.add(thigh, b.box(0.03, 0.26, 0.11, 0.012), dark, [0.07 * s, -0.22, 0.0]);
    const shin = b.mount(`${L}Leg`);
    b.rod(shin, dark, [0, 0, 0], "x", 0.06, 0.13);
    b.add(shin, b.box(0.12, 0.34, 0.14, 0.05), shell, [0, -0.2, 0.012]);
    b.add(shin, b.box(0.025, 0.22, 0.1, 0.01), dark, [0.06 * s, -0.2, 0.0]);
    // Ankle linkage rods behind the shin
    for (const x of [-0.035, 0.035]) b.rod(shin, dark, [x, -0.25, -0.075], "y", 0.006, 0.36);
    const foot = b.mount(`${L}Foot`);
    b.add(foot, b.box(0.11, 0.07, 0.25, 0.03), dark, [0, -0.045, 0.05]);

    const upper = b.mount(`${L}Arm`);
    b.add(upper, b.box(0.22, 0.1, 0.1, 0.045), shell, [0.15 * s, 0, 0]);
    b.rod(upper, dark, [0.02 * s, 0, 0], "x", 0.06, 0.06);
    const fore = b.mount(`${L}ForeArm`);
    b.rod(fore, dark, [0, 0, 0], "z", 0.05, 0.1);
    b.add(fore, b.box(0.2, 0.085, 0.085, 0.04), shell, [0.13 * s, 0, 0]);
    const hand = b.mount(`${L}Hand`);
    b.add(hand, b.box(0.09, 0.03, 0.075, 0.012), dark, [0.05 * s, 0, 0]);
    for (let f = 0; f < 4; f++) b.add(hand, b.box(0.06, 0.016, 0.014, 0.005), dark, [0.12 * s, -0.004, -0.027 + f * 0.018]);
    b.add(hand, b.box(0.045, 0.016, 0.016, 0.005), dark, [0.06 * s, -0.01, 0.048]);
  }
}

/* ------------------------------------------------------------- Unitree G1 */

export interface G1Model {
  pelvisHeight: number;
  offsets: Record<string, Vec3>;
  parts: { bone: string; material: string; geometry: THREE.BufferGeometry }[];
}

let g1Promise: Promise<G1Model> | null = null;

/** Loads the official Unitree G1 link meshes baked by scripts/build-g1-model.py. */
export function loadG1Model(): Promise<G1Model> {
  if (!g1Promise) {
    g1Promise = (async () => {
      const [manifest, bin] = await Promise.all([
        fetch("/models/g1/g1.json").then((r) => r.json()),
        fetch("/models/g1/g1.bin").then((r) => r.arrayBuffer()),
      ]);
      const parts = (manifest.parts as { bone: string; material: string; positions: [number, number]; indices: [number, number] }[]).map(
        (p) => {
          const geo = new THREE.BufferGeometry();
          geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(bin, p.positions[0], p.positions[1]), 3));
          geo.setIndex(new THREE.BufferAttribute(new Uint32Array(bin, p.indices[0], p.indices[1]), 1));
          return { bone: p.bone, material: p.material, geometry: toCreasedNormals(geo, Math.PI / 5) };
        }
      );
      return { pelvisHeight: manifest.pelvisHeight, offsets: manifest.offsets, parts };
    })();
  }
  return g1Promise;
}

function buildG1(b: Builder, model: G1Model) {
  const light = b.m(new THREE.MeshPhysicalMaterial({ color: "#c3c6ca", metalness: 0.55, roughness: 0.38, clearcoat: 0.3 }));
  const dark = b.m(new THREE.MeshStandardMaterial({ color: "#1d1f23", metalness: 0.6, roughness: 0.42 }));
  const groups = new Map<string, THREE.Group>();
  for (const p of model.parts) {
    let grp = groups.get(p.bone);
    if (!grp) {
      grp = b.mount(p.bone);
      groups.set(p.bone, grp);
    }
    const mesh = new THREE.Mesh(p.geometry, p.material === "white" ? light : dark);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    grp.add(mesh);
  }
}

/* ---------------------------------------------------------------- public */

export interface ArmorRig {
  nozzle: THREE.Object3D;
  nozzleTip: THREE.Object3D;
  dispose: () => void;
}

/**
 * Builds the manufacturer-specific body for a robot on the Xbot skeleton. In the rest pose
 * every bone frame is axis-aligned (X = robot's left, Y = up, Z = forward), so all offsets
 * below are metric positions in the driving bone's frame. Every robot carries the GB10 kit.
 */
export function buildRobotBody(robotId: RobotId, bone: BoneLookup, g1?: G1Model): ArmorRig {
  const b = new Builder(bone);
  if (robotId === "unitree-g1" && g1) {
    buildG1(b, g1);
    buildKit(b, "Spine2", [0, 0.25, -0.16], 0.82);
  } else if (robotId === "bd-atlas") {
    buildAtlas(b);
    buildKit(b, "Spine2", [0, 0.08, -0.19], 1);
  } else {
    buildA2(b);
    buildKit(b, "Spine2", [0, 0.07, -0.19], 1);
  }
  const { nozzle, tip } = buildNozzle(b, robotId === "unitree-g1" ? [-0.05, -0.01, 0.03] : [-0.07, -0.02, 0.03]);
  return {
    nozzle,
    nozzleTip: tip,
    dispose: () => {
      b.geos.forEach((g) => g.dispose());
      b.mats.forEach((m) => m.dispose());
    },
  };
}
