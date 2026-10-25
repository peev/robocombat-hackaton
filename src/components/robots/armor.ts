import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

/** Bones in the Xbot rig are in centimetres; attachments are authored in metres. */
const BONE_TO_METRES = 100;

let grimeTex: THREE.CanvasTexture | null = null;
let kitPanelTex: THREE.CanvasTexture | null = null;

/** Scuffed, dirt-streaked base map shared by all armour plates. */
function grimeTexture(): THREE.CanvasTexture {
  if (grimeTex) return grimeTex;
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const g = c.getContext("2d")!;
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, 512, 512);
  let seed = 7;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < 260; i++) {
    const r = 2 + rnd() * 22;
    const grd = g.createRadialGradient(0, 0, 0, 0, 0, r);
    const tone = rnd() > 0.5 ? "60,52,44" : "35,33,31";
    grd.addColorStop(0, `rgba(${tone},${0.08 + rnd() * 0.22})`);
    grd.addColorStop(1, `rgba(${tone},0)`);
    g.save();
    g.translate(rnd() * 512, rnd() * 512);
    g.scale(1, 0.4 + rnd() * 1.6);
    g.fillStyle = grd;
    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  g.lineCap = "round";
  for (let i = 0; i < 140; i++) {
    const x = rnd() * 512;
    const y = rnd() * 512;
    const a = rnd() * Math.PI * 2;
    const l = 6 + rnd() * 40;
    g.strokeStyle = `rgba(40,38,36,${0.15 + rnd() * 0.35})`;
    g.lineWidth = 0.6 + rnd() * 1.4;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
  }
  // Vertical run-off streaks
  for (let i = 0; i < 40; i++) {
    const x = rnd() * 512;
    const y = rnd() * 512;
    const grd = g.createLinearGradient(x, y, x, y + 120);
    grd.addColorStop(0, "rgba(50,45,40,0.18)");
    grd.addColorStop(1, "rgba(50,45,40,0)");
    g.fillStyle = grd;
    g.fillRect(x, y, 3 + rnd() * 6, 120);
  }
  grimeTex = new THREE.CanvasTexture(c);
  grimeTex.colorSpace = THREE.SRGBColorSpace;
  grimeTex.wrapS = grimeTex.wrapT = THREE.RepeatWrapping;
  grimeTex.anisotropy = 8;
  return grimeTex;
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
function kitPanelTexture(): THREE.CanvasTexture {
  if (kitPanelTex) return kitPanelTex;
  const W = 512;
  const H = 640;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#34383c");
  bg.addColorStop(1, "#202326");
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  // Vent slats
  for (let i = 0; i < 7; i++) {
    g.fillStyle = "#15171a";
    roundRect(g, 70, 34 + i * 16, W - 140, 7, 3);
    g.fill();
  }
  // Recessed face plate
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
  g.save();
  g.translate(W / 2, 250);
  g.fillText("D", -128, 0);
  g.fillText("E", -40, 0);
  g.fillText("L", 48, 0);
  g.fillText("L", 130, 0);
  g.restore();

  // NVIDIA mark: green tile with stylised eye
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

  kitPanelTex = new THREE.CanvasTexture(c);
  kitPanelTex.colorSpace = THREE.SRGBColorSpace;
  kitPanelTex.anisotropy = 8;
  return kitPanelTex;
}

function mount(bone: THREE.Object3D | undefined) {
  const g = new THREE.Group();
  g.scale.setScalar(BONE_TO_METRES);
  bone?.add(g);
  return g;
}

function add(
  parent: THREE.Object3D,
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  pos: [number, number, number],
  rot: [number, number, number] = [0, 0, 0],
  scale: [number, number, number] = [1, 1, 1]
) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...pos);
  m.rotation.set(...rot);
  m.scale.set(...scale);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

export interface ArmorRig {
  nozzle: THREE.Object3D;
  nozzleTip: THREE.Object3D;
  dispose: () => void;
}

/**
 * Bolts armour plates, helmet, the GB10 evaluation backpack and a hose nozzle onto the
 * Xbot skeleton. In the rest pose every bone frame is axis-aligned (X = robot's left,
 * Y = up, Z = forward), so offsets below are simple metric positions per bone.
 */
export function buildArmor(
  bone: (name: string) => THREE.Object3D | undefined,
  opts: { armor: string; trim: string }
): ArmorRig {
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const G = <T extends THREE.BufferGeometry>(g: T) => (geos.push(g), g);
  const M = <T extends THREE.Material>(m: T) => (mats.push(m), m);

  const armor = M(
    new THREE.MeshPhysicalMaterial({
      color: opts.armor,
      map: grimeTexture(),
      roughness: 0.52,
      metalness: 0.08,
      clearcoat: 0.35,
      clearcoatRoughness: 0.45,
    })
  );
  const trim = M(new THREE.MeshStandardMaterial({ color: opts.trim, roughness: 0.4, metalness: 0.3 }));
  const gunmetal = M(new THREE.MeshStandardMaterial({ color: "#2a2d31", roughness: 0.42, metalness: 0.75 }));
  const rubber = M(new THREE.MeshStandardMaterial({ color: "#121314", roughness: 0.85, metalness: 0.1 }));
  const visor = M(
    new THREE.MeshPhysicalMaterial({ color: "#05070a", roughness: 0.05, metalness: 0.6, clearcoat: 1, clearcoatRoughness: 0.03 })
  );
  const blueGlow = M(new THREE.MeshBasicMaterial({ color: new THREE.Color("#2fd0ff").multiplyScalar(3), toneMapped: false }));
  const greenGlow = M(new THREE.MeshBasicMaterial({ color: new THREE.Color("#76ff2a").multiplyScalar(3), toneMapped: false }));
  const panel = M(new THREE.MeshStandardMaterial({ map: kitPanelTexture(), roughness: 0.55, metalness: 0.35 }));
  const red = M(new THREE.MeshStandardMaterial({ color: "#b3140c", roughness: 0.4, metalness: 0.5 }));

  const box = (w: number, h: number, d: number, r = 0.02) => G(new RoundedBoxGeometry(w, h, d, 3, r));
  const sphere = G(new THREE.SphereGeometry(1, 28, 20));
  const cyl = G(new THREE.CylinderGeometry(1, 1, 1, 16));

  /* Helmet */
  const head = mount(bone("Head"));
  add(head, sphere, armor, [0, 0.1, 0.0], [0, 0, 0], [0.112, 0.125, 0.122]);
  add(head, sphere, visor, [0, 0.082, 0.03], [0, 0, 0], [0.104, 0.075, 0.108]);
  const strip = new THREE.Group();
  strip.position.set(0, 0.082, 0.03);
  strip.rotation.y = 1.1 - Math.PI / 2;
  head.add(strip);
  const arc = add(strip, G(new THREE.TorusGeometry(1, 0.055, 6, 32, 2.2)), blueGlow, [0, 0, 0], [Math.PI / 2, 0, 0], [0.106, 0.106, 0.106]);
  arc.castShadow = false;
  add(head, box(0.03, 0.05, 0.14, 0.01), trim, [0.112, 0.11, -0.01]);
  add(head, box(0.03, 0.05, 0.14, 0.01), trim, [-0.112, 0.11, -0.01]);
  add(mount(bone("Neck")), cyl, rubber, [0, 0.04, 0], [0, 0, 0], [0.06, 0.09, 0.06]);

  /* Torso */
  const chest = mount(bone("Spine2"));
  add(chest, box(0.34, 0.25, 0.21, 0.05), armor, [0, 0.08, 0.035]);
  add(chest, box(0.2, 0.035, 0.02, 0.008), trim, [0, 0.13, 0.142]);
  add(mount(bone("Spine1")), box(0.25, 0.11, 0.17, 0.035), gunmetal, [0, 0.03, 0.02]);
  add(mount(bone("Spine")), box(0.24, 0.09, 0.17, 0.03), armor, [0, 0.03, 0.02]);
  add(mount(bone("Hips")), box(0.31, 0.15, 0.2, 0.04), armor, [0, -0.03, 0.01]);

  /* GB10 evaluation kit backpack */
  const kit = new THREE.Group();
  kit.position.set(0, 0.07, -0.19);
  chest.add(kit);
  add(kit, box(0.3, 0.38, 0.13, 0.025), gunmetal, [0, 0, 0]);
  const face = add(kit, G(new THREE.PlaneGeometry(0.27, 0.34)), panel, [0, 0, -0.0665], [0, Math.PI, 0]);
  face.castShadow = false;
  add(kit, box(0.32, 0.03, 0.15, 0.012), rubber, [0, 0.19, 0]);
  add(kit, box(0.32, 0.03, 0.15, 0.012), rubber, [0, -0.19, 0]);
  const led = add(kit, box(0.014, 0.24, 0.014, 0.005), greenGlow, [-0.152, 0.0, -0.05]);
  led.castShadow = false;
  add(kit, box(0.07, 0.15, 0.09, 0.012), gunmetal, [0.19, -0.05, 0.0]);
  add(kit, cyl, rubber, [0.1, 0.36, 0.01], [0, 0, 0], [0.007, 0.36, 0.007]);
  add(kit, cyl, rubber, [0.065, 0.28, 0.03], [0, 0, 0], [0.006, 0.2, 0.006]);
  add(kit, cyl, gunmetal, [0.1, 0.2, 0.01], [0, 0, 0], [0.016, 0.03, 0.016]);
  // Harness straps over the shoulders and across the chest
  for (const x of [-0.09, 0.09]) {
    add(chest, box(0.045, 0.02, 0.36, 0.008), rubber, [x, 0.215, -0.02]);
    add(chest, box(0.045, 0.24, 0.02, 0.008), rubber, [x, 0.08, 0.15]);
  }
  add(chest, box(0.36, 0.035, 0.02, 0.008), rubber, [0, 0.0, 0.15]);
  add(chest, box(0.05, 0.05, 0.03, 0.01), gunmetal, [0, 0.0, 0.165]);

  /* Arms */
  for (const side of [1, -1] as const) {
    const L = side === 1 ? "Left" : "Right";
    const upper = mount(bone(`${L}Arm`));
    add(upper, sphere, armor, [0.03 * side, 0.035, 0], [0, 0, 0], [0.1, 0.085, 0.1]);
    add(upper, box(0.06, 0.02, 0.1, 0.008), trim, [0.04 * side, 0.112, 0]);
    add(upper, box(0.22, 0.1, 0.105, 0.035), armor, [0.15 * side, -0.005, 0]);
    const fore = mount(bone(`${L}ForeArm`));
    add(fore, box(0.21, 0.092, 0.1, 0.035), armor, [0.12 * side, 0, 0]);
    add(fore, box(0.05, 0.098, 0.106, 0.02), gunmetal, [0.235 * side, 0, 0]);
  }

  /* Legs */
  for (const side of [1, -1] as const) {
    const L = side === 1 ? "Left" : "Right";
    const thigh = mount(bone(`${L}UpLeg`));
    add(thigh, box(0.16, 0.33, 0.17, 0.05), armor, [0, -0.2, 0.012]);
    add(thigh, box(0.02, 0.18, 0.06, 0.008), trim, [0.082 * side, -0.2, 0.02]);
    const shin = mount(bone(`${L}Leg`));
    add(shin, sphere, gunmetal, [0, 0.0, 0.055], [0, 0, 0], [0.06, 0.065, 0.045]);
    add(shin, box(0.125, 0.33, 0.14, 0.04), armor, [0, -0.2, 0.02]);
    add(mount(bone(`${L}Foot`)), box(0.12, 0.085, 0.24, 0.03), gunmetal, [0, -0.035, 0.06]);
  }

  /* Hose nozzle held in the right hand while suppressing */
  const hand = mount(bone("RightHand"));
  const nozzle = new THREE.Group();
  nozzle.visible = false;
  nozzle.position.set(-0.07, -0.02, 0.03);
  hand.add(nozzle);
  add(nozzle, cyl, gunmetal, [-0.08, 0, 0], [0, 0, Math.PI / 2], [0.03, 0.2, 0.03]);
  add(nozzle, cyl, red, [-0.2, 0, 0], [0, 0, Math.PI / 2], [0.038, 0.05, 0.038]);
  add(nozzle, cyl, gunmetal, [-0.04, -0.06, 0], [0, 0, 0], [0.015, 0.1, 0.015]);
  const nozzleTip = new THREE.Object3D();
  nozzleTip.position.set(-0.24, 0, 0);
  nozzle.add(nozzleTip);

  return {
    nozzle,
    nozzleTip,
    dispose: () => {
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
    },
  };
}
