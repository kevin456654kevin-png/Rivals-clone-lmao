import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/*
 * First-person weapon models, built from primitives so they stay lightweight.
 * Every model is modelled with its grip near the origin and the muzzle / blade
 * pointing down -Z, which is the camera's forward axis.
 */

/** Where the viewmodel sits relative to the camera at rest. */
export const VIEW_BASE = new THREE.Vector3(0.28, -0.28, -0.55);

const BLACK = '#17191c';
const POLYMER = '#23262b';
const GUNMETAL = '#3b4048';
const STEEL = '#a7afb9';
const DARK_STEEL = '#2a2e35';
const WOOD = '#6e4a2e';
const WOOD_LIGHT = '#94663c';
const WHITE = '#f2f2f2';
const RED = '#c62828';

/** Uniform scale per model so each one reads at a comfortable size on screen. */
const MODEL_SCALE: Record<string, number> = {
  rifle: 0.7,
  smg: 0.7,
  dmr: 0.7,
  sniper: 0.66,
  shotgun: 0.7,
  pistol: 0.9,
  autopistol: 0.9,
  revolver: 0.95,
  knife: 1.25,
  hatchet: 1.05,
  grenade: 1.1,
  medkit: 1.0,
};

/** A CylinderGeometry whose axis runs along Z (the barrel direction). */
function zCylinder(radius: number, length: number): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(radius, radius, length, 16);
  g.rotateX(Math.PI / 2);
  return g;
}

/**
 * Flat profile extruded to a thin blade/axe-head. `points` are (s, h): s runs
 * forward (-Z), h runs up (+Y), and the thickness runs along X.
 */
function profileGeometry(points: [number, number][], thickness: number): THREE.BufferGeometry {
  const shape = new THREE.Shape(points.map(([s, h]) => new THREE.Vector2(s, h)));
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: thickness * 0.35,
    bevelSize: thickness * 0.35,
    bevelSegments: 2,
    curveSegments: 4,
  });
  g.translate(0, 0, -thickness / 2);
  // shape x -> -Z (forward), shape y -> +Y (up), extrude z -> +X (thickness)
  g.applyMatrix4(
    new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 0, 0)),
  );
  return g;
}

/** Small helper that adds meshes to a model root. */
class Kit {
  constructor(
    readonly root: THREE.Group,
    private env: THREE.Texture,
  ) {}

  material(color: string, metalness = 0, roughness = 0.6): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({ color, metalness, roughness, envMap: this.env, envMapIntensity: 1 });
  }

  add(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    this.root.add(mesh);
    return mesh;
  }

  box(w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material, rx = 0, r?: number) {
    return this.add(new RoundedBoxGeometry(w, h, d, 2, r ?? Math.min(w, h, d) * 0.3), mat, x, y, z, rx);
  }

  /** Cylinder along Z, centred at (x, y, z). */
  rod(radius: number, length: number, x: number, y: number, z: number, mat: THREE.Material) {
    return this.add(zCylinder(radius, length), mat, x, y, z);
  }
}

interface RifleSpec {
  recv: number; // receiver length
  barrel: number; // barrel length from receiver front
  hg: number; // handguard length
  stock: number; // stock length behind the receiver
  mag: number; // magazine height (0 = none)
  magTilt: number;
  sight: 'iron' | 'dot' | 'scope' | 'bigscope';
  wood: boolean; // wooden furniture
  brake?: boolean;
  tubeMag?: boolean;
  foregrip?: boolean;
  cheek?: boolean;
  bipod?: boolean;
}

function buildRifle(k: Kit, s: RifleSpec, accent: string) {
  const gun = k.material(GUNMETAL, 0.75, 0.32);
  const polymer = k.material(POLYMER, 0.05, 0.7);
  const furniture = s.wood ? k.material(WOOD_LIGHT, 0, 0.7) : k.material(accent, 0.15, 0.55);
  const dark = k.material(DARK_STEEL, 0.6, 0.4);

  // Receiver: front at z=0.02, rear at z=0.02-recv.
  k.box(0.064, 0.09, s.recv, 0, 0, 0.02 - s.recv / 2, gun, 0, 0.012);

  // Handguard
  k.box(0.058, 0.062, s.hg, 0, -0.004, -(s.recv + s.hg / 2), furniture, 0, 0.014);

  // Barrel and optional muzzle brake
  const barrelEnd = -(s.recv + s.barrel);
  k.rod(0.011, s.barrel, 0, 0.004, -(s.recv + s.barrel / 2), gun);
  if (s.brake) k.rod(0.017, 0.04, 0, 0.004, barrelEnd + 0.02, dark);

  // Top rail
  k.box(0.03, 0.016, s.recv * 0.85, 0, 0.053, -(s.recv * 0.5 + 0.01), gun, 0, 0.004);

  // Sights
  const sightZ = -s.recv * 0.5;
  if (s.sight === 'iron') {
    k.box(0.02, 0.026, 0.012, 0, 0.066, -s.recv * 0.25, gun, 0, 0.004);
    k.box(0.008, 0.03, 0.008, 0, 0.068, -(s.recv + s.hg * 0.85), gun, 0, 0.002);
  } else if (s.sight === 'dot') {
    k.box(0.038, 0.05, 0.07, 0, 0.1, sightZ, polymer, 0, 0.01);
    const lens = k.material('#ff3b30', 0, 0.2);
    lens.emissive = new THREE.Color('#ff2a1a');
    lens.emissiveIntensity = 1.2;
    k.add(new THREE.CircleGeometry(0.009, 12), lens, 0, 0.1, sightZ + 0.036, 0, 0, 0); // rear lens, facing the player
    k.box(0.03, 0.03, 0.04, 0, 0.068, sightZ, gun, 0, 0.006);
  } else {
    // Scope (or big scope) on a rail mount
    const big = s.sight === 'bigscope';
    const len = big ? 0.3 : 0.2;
    const radius = big ? 0.026 : 0.021;
    k.box(0.03, 0.03, 0.09, 0, 0.07, sightZ, gun, 0, 0.005);
    k.rod(radius, len, 0, 0.1, sightZ, polymer);
    k.rod(radius + 0.004, 0.02, 0, 0.1, sightZ + len / 2 - 0.01, dark); // eyepiece bell
    k.rod(radius + 0.004, 0.02, 0, 0.1, sightZ - len / 2 + 0.01, dark); // objective bell
    k.rod(0.012, 0.03, 0, 0.13, sightZ, dark); // turret
    const lensMat = k.material('#0d3b52', 0.2, 0.05);
    k.rod(radius - 0.004, 0.003, 0, 0.1, sightZ + len / 2 + 0.001, lensMat);
  }

  // Pistol grip (angled back)
  k.box(0.038, 0.11, 0.05, 0, -0.095, -0.03, polymer, -0.22, 0.012);

  // Magazine
  if (s.mag > 0) {
    k.box(0.042, s.mag, 0.058, 0, -0.03 - s.mag / 2, -s.recv * 0.55, polymer, s.magTilt, 0.01);
  }

  // Tube magazine (shotgun)
  if (s.tubeMag) {
    k.rod(0.011, s.barrel * 0.85, 0, -0.03, -(s.recv + s.barrel * 0.45), gun);
  }

  // Vertical foregrip
  if (s.foregrip) {
    k.box(0.03, 0.07, 0.035, 0, -0.05, -(s.recv + s.hg * 0.5), polymer, 0, 0.01);
  }

  // Bipod (folded, tucked under the handguard)
  if (s.bipod) {
    for (const side of [-1, 1]) {
      k.box(0.006, 0.07, 0.006, side * 0.02, -0.07, -(s.recv + s.hg - 0.02), gun, side * 0.2);
    }
  }

  // Stock and buttpad
  if (s.stock > 0) {
    const stockMat = s.wood ? furniture : polymer;
    k.box(0.05, 0.075, s.stock, 0, -0.005, 0.02 + s.stock / 2, stockMat, 0, 0.014);
    k.box(0.054, 0.086, 0.018, 0, -0.005, 0.02 + s.stock + 0.008, polymer, 0, 0.006);
    if (s.cheek) k.box(0.05, 0.03, 0.07, 0, 0.045, 0.02 + s.stock * 0.45, stockMat, 0, 0.01);
  }
}

interface PistolSpec {
  slide: number;
  extMag: boolean;
  compensator: boolean;
}

function buildPistol(k: Kit, s: PistolSpec) {
  const gun = k.material(GUNMETAL, 0.75, 0.3);
  const polymer = k.material(POLYMER, 0.05, 0.7);
  const dark = k.material(DARK_STEEL, 0.6, 0.4);
  const frontZ = 0.03 - s.slide;

  k.box(0.034, 0.044, s.slide, 0, 0.04, 0.03 - s.slide / 2, gun, 0, 0.01); // slide
  k.box(0.032, 0.03, s.slide * 0.8, 0, 0.0, 0.03 - (s.slide * 0.8) / 2, polymer, 0, 0.01); // frame
  k.box(0.034, 0.11, 0.05, 0, -0.07, 0.0, polymer, -0.2, 0.012); // grip
  if (s.extMag) k.box(0.034, 0.05, 0.05, 0, -0.15, 0.0, polymer, -0.2, 0.01); // extended magazine
  k.box(0.006, 0.01, 0.008, 0, 0.07, frontZ + 0.012, gun); // front sight
  k.box(0.02, 0.01, 0.01, 0, 0.068, 0.02, gun); // rear sight
  k.rod(0.009, 0.03, 0, 0.034, frontZ - 0.005, dark); // barrel tip
  if (s.compensator) k.box(0.03, 0.03, 0.04, 0, 0.04, frontZ - 0.02, dark, 0, 0.008);
}

function buildRevolver(k: Kit) {
  const gun = k.material(GUNMETAL, 0.75, 0.3);
  const steel = k.material(STEEL, 0.85, 0.22);
  const dark = k.material(DARK_STEEL, 0.6, 0.4);
  const wood = k.material(WOOD, 0, 0.65);

  k.box(0.034, 0.075, 0.1, 0, 0.0, -0.01, gun, 0, 0.012); // frame
  k.box(0.034, 0.02, 0.12, 0, 0.04, -0.06, gun, 0, 0.007); // top strap
  k.rod(0.011, 0.18, 0, 0.034, -0.11, steel); // barrel
  k.rod(0.032, 0.06, 0, 0, -0.05, steel); // cylinder
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    k.rod(0.0052, 0.064, Math.cos(a) * 0.02, Math.sin(a) * 0.02, -0.05, dark);
  }
  k.box(0.012, 0.022, 0.02, 0, 0.05, 0.02, gun, 0, 0.004); // hammer
  k.box(0.036, 0.11, 0.05, 0, -0.08, 0.02, wood, -0.22, 0.012); // grip
}

function buildKnife(k: Kit) {
  const steel = k.material(STEEL, 0.9, 0.2);
  const black = k.material(BLACK, 0.1, 0.55);
  const accent = k.material('#8a1f1f', 0.1, 0.5);

  // Clip-point blade, spine up
  k.add(
    profileGeometry(
      [
        [0.0, 0.018],
        [0.1, 0.017],
        [0.14, 0.009],
        [0.158, 0.0],
        [0.12, -0.009],
        [0.0, -0.013],
      ],
      0.004,
    ),
    steel,
    0,
    0,
    0,
  );
  // Crossguard, handle and pommel
  k.box(0.012, 0.05, 0.012, 0, 0.002, 0.0, black, 0, 0.004);
  k.rod(0.013, 0.12, 0, 0, 0.06, black);
  for (const z of [0.025, 0.05, 0.075, 0.1]) k.rod(0.0138, 0.004, 0, 0, z, accent);
  k.add(new THREE.SphereGeometry(0.013, 12, 8), black, 0, 0, 0.13);
}

function buildHatchet(k: Kit) {
  const wood = k.material(WOOD, 0, 0.7);
  const steel = k.material(STEEL, 0.9, 0.22);
  k.rod(0.017, 0.34, 0, 0, 0.08, wood); // handle
  // Axe head sits on top of the front of the handle
  k.add(
    profileGeometry(
      [
        [0.08, -0.005],
        [0.2, -0.005],
        [0.25, 0.03],
        [0.27, 0.07],
        [0.24, 0.1],
        [0.1, 0.1],
        [0.08, 0.05],
      ],
      0.022,
    ),
    steel,
    0,
    0.005,
    0,
  );
  k.box(0.024, 0.03, 0.05, 0, 0.005, -0.1, steel, 0, 0.004); // poll
}

function buildGrenade(k: Kit, body: string) {
  const green = k.material(body, 0.1, 0.6);
  const steel = k.material(STEEL, 0.9, 0.25);
  const profile = [
    [0, -0.045],
    [0.03, -0.045],
    [0.036, -0.03],
    [0.038, 0],
    [0.036, 0.03],
    [0.03, 0.045],
    [0, 0.045],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  k.add(new THREE.LatheGeometry(profile, 24), green, 0, 0, 0);
  k.box(0.02, 0.05, 0.035, 0.024, 0.03, 0, steel, 0, 0.006); // spoon lever
  k.add(new THREE.TorusGeometry(0.011, 0.0035, 8, 16), steel, 0, 0.068, 0, Math.PI / 2, 0, 0);
}

function buildMedkit(k: Kit) {
  const white = k.material(WHITE, 0.0, 0.5);
  const red = k.material(RED, 0.0, 0.5);
  const handle = k.material(POLYMER, 0.05, 0.7);
  k.box(0.16, 0.12, 0.1, 0, 0, 0, white, 0, 0.012);
  k.box(0.07, 0.02, 0.012, 0, 0, 0.056, red, 0, 0.004); // cross, facing the player
  k.box(0.02, 0.07, 0.012, 0, 0, 0.056, red, 0, 0.004);
  k.box(0.06, 0.02, 0.03, 0, 0.07, 0, handle, 0, 0.008); // carry handle
}

/** Build the model for one weapon id. The accent colour tints furniture where it fits. */
function buildModel(id: string, env: THREE.Texture, accent: string): THREE.Group {
  const root = new THREE.Group();
  const k = new Kit(root, env);
  switch (id) {
    case 'rifle':
      buildRifle(k, { recv: 0.26, barrel: 0.36, hg: 0.2, stock: 0.16, mag: 0.11, magTilt: 0.12, sight: 'dot', wood: false, brake: true }, accent);
      break;
    case 'smg':
      buildRifle(k, { recv: 0.17, barrel: 0.14, hg: 0.08, stock: 0.05, mag: 0.1, magTilt: 0, sight: 'iron', wood: false, foregrip: true }, accent);
      break;
    case 'dmr':
      buildRifle(k, { recv: 0.27, barrel: 0.5, hg: 0.22, stock: 0.17, mag: 0.09, magTilt: 0.1, sight: 'scope', wood: true }, accent);
      break;
    case 'sniper':
      buildRifle(k, { recv: 0.3, barrel: 0.62, hg: 0.12, stock: 0.22, mag: 0.07, magTilt: 0.1, sight: 'bigscope', wood: true, brake: true, cheek: true, bipod: true }, accent);
      break;
    case 'shotgun':
      buildRifle(k, { recv: 0.22, barrel: 0.5, hg: 0.2, stock: 0.2, mag: 0, magTilt: 0, sight: 'iron', wood: true, tubeMag: true }, accent);
      break;
    case 'pistol':
      buildPistol(k, { slide: 0.17, extMag: false, compensator: false });
      break;
    case 'autopistol':
      buildPistol(k, { slide: 0.14, extMag: true, compensator: true });
      break;
    case 'revolver':
      buildRevolver(k);
      break;
    case 'knife':
      buildKnife(k);
      break;
    case 'hatchet':
      buildHatchet(k);
      break;
    case 'grenade':
      buildGrenade(k, accent);
      break;
    case 'medkit':
      buildMedkit(k);
      break;
    default:
      k.box(0.18, 0.18, 0.55, 0, 0, -0.2, k.material('#444'));
  }
  root.scale.setScalar(MODEL_SCALE[id] ?? 1);
  return root;
}

function disposeTree(obj: THREE.Object3D) {
  obj.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
    else mat?.dispose();
  });
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeInOut = (t: number) => t * t * (3 - 2 * t);

/** Length of the inspect animation for a weapon, in ms. */
export function inspectDurationMs(id: string): number {
  return id === 'knife' || id === 'hatchet' ? 2400 : 2000;
}

/**
 * Pose offset while inspecting, with t running 0..1 across the animation.
 * Knives and hatchets twirl around the view axis; guns turn to show their side.
 */
export function inspectPose(id: string, t: number): { pos: [number, number, number]; rot: [number, number, number] } {
  const s = Math.sin(Math.PI * t); // 0 -> 1 -> 0
  if (id === 'knife' || id === 'hatchet') {
    const roll = easeInOut(clamp01((t - 0.1) / 0.75)) * Math.PI * 2;
    return {
      pos: [-0.07 * s, 0.06 * s, -0.1 * s],
      rot: [-0.35 * s, 0.3 * s, roll],
    };
  }
  return {
    pos: [-0.12 * s, 0.05 * s, -0.06 * s],
    rot: [-0.25 * s, 0.95 * s, 0.15 * s],
  };
}

export interface ViewState {
  bobX: number;
  bobY: number;
  /** Weapon being inspected, or null. */
  inspectId: string | null;
  /** Inspect progress 0..1, or null when not inspecting. */
  inspectT: number | null;
  /** Medkit is being used. */
  healing: boolean;
  /** Recoil kick, decays to 0. */
  kick: number;
  /** Melee swing progress 0..1; 1 (or more) means no swing. */
  swing: number;
}

/** Owns the weapon model attached to the camera and drives its animation. */
export class ViewModel {
  readonly root = new THREE.Group();
  private pose = new THREE.Group();
  private model: THREE.Group | null = null;
  private modelId: string | null = null;
  private swapAt = -1e9;
  private healAmt = 0;

  constructor(
    camera: THREE.Camera,
    private env: THREE.Texture,
  ) {
    this.root.position.copy(VIEW_BASE);
    this.root.add(this.pose);
    camera.add(this.root);
  }

  /** Show the model for `id` (null hides it). `accent` is the weapon colour. */
  show(id: string | null, accent: string, now: number) {
    if (id === this.modelId) return;
    if (this.model) {
      this.pose.remove(this.model);
      disposeTree(this.model);
      this.model = null;
    }
    this.modelId = id;
    if (id) {
      this.model = buildModel(id, this.env, accent);
      this.pose.add(this.model);
    }
    this.swapAt = now; // raise animation
  }

  update(now: number, dt: number, s: ViewState) {
    this.root.position.set(VIEW_BASE.x + s.bobX, VIEW_BASE.y + s.bobY, VIEW_BASE.z);

    let px = 0;
    let py = 0;
    let pz = 0;
    let rx = 0;
    let ry = 0;
    let rz = 0;

    // Swap: rise into view after switching weapons
    const swap = easeInOut(clamp01((now - this.swapAt) / 260));
    py -= (1 - swap) * 0.32;

    if (s.inspectT !== null) {
      const p = inspectPose(s.inspectId ?? '', s.inspectT);
      px += p.pos[0];
      py += p.pos[1];
      pz += p.pos[2];
      rx += p.rot[0];
      ry += p.rot[1];
      rz += p.rot[2];
    }

    // Medkit: brings the kit up to the centre of the screen while healing
    this.healAmt += ((s.healing ? 1 : 0) - this.healAmt) * (1 - Math.exp(-10 * dt));
    const h = this.healAmt;
    px += -0.22 * h;
    py += 0.2 * h;
    pz += 0.1 * h;
    rx += -0.45 * h;
    rz += 0.2 * h;

    // Recoil
    rx += s.kick * 0.07;
    pz += s.kick * 0.025;

    // Melee swing
    if (s.swing < 1) {
      const k = Math.sin(s.swing * Math.PI);
      rz += k * 0.7;
      ry -= k * 0.4;
      px -= k * 0.08;
      pz -= k * 0.1;
    }

    this.pose.position.set(px, py, pz);
    this.pose.rotation.set(rx, ry, rz);
  }

  dispose() {
    if (this.model) disposeTree(this.model);
    this.model = null;
    this.root.removeFromParent();
  }
}
