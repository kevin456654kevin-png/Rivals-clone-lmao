import * as THREE from 'three';
import type { BoxDef, MapDef, RampDef } from '../types';
import type { BoxSolid, RampSolid, Solid } from './collision';
import { rampHeight } from './collision';

export interface BuiltMap {
  group: THREE.Group;
  solids: Solid[];
}

const WALL_COLOR = '#2d3138';
const DEFAULT_BOX = '#4a5059';
const DEFAULT_RAMP = '#7d8591';
const PERIMETER_HEIGHT = 6;

function material(color: string) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.05 });
}

function addBox(group: THREE.Group, solids: Solid[], def: BoxDef) {
  const bottom = def.y ?? 0;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(def.w, def.h, def.d), material(def.color ?? DEFAULT_BOX));
  mesh.position.set(def.x, bottom + def.h / 2, def.z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);

  const solid: BoxSolid = {
    kind: 'box',
    minX: def.x - def.w / 2,
    maxX: def.x + def.w / 2,
    minZ: def.z - def.d / 2,
    maxZ: def.z + def.d / 2,
    bottom,
    top: bottom + def.h,
  };
  solids.push(solid);
}

function addRamp(group: THREE.Group, solids: Solid[], def: RampDef) {
  const solid: RampSolid = {
    kind: 'ramp',
    minX: def.x - def.w / 2,
    maxX: def.x + def.w / 2,
    minZ: def.z - def.d / 2,
    maxZ: def.z + def.d / 2,
    dir: def.dir,
    y0: def.y0 ?? 0,
    y1: def.y1,
  };
  const mesh = new THREE.Mesh(rampGeometry(solid), material(def.color ?? DEFAULT_RAMP));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  solids.push(solid);
}

/**
 * Wedge geometry for a ramp: a flat-shaded solid whose top follows rampHeight().
 * Triangles are wound outwards so the faces are front-facing from every side.
 */
function rampGeometry(s: RampSolid): THREE.BufferGeometry {
  const corners: [number, number][] = [
    [s.minX, s.minZ],
    [s.maxX, s.minZ],
    [s.maxX, s.maxZ],
    [s.minX, s.maxZ],
  ];
  const bottom = corners.map(([x, z]) => new THREE.Vector3(x, 0, z));
  const top = corners.map(([x, z]) => new THREE.Vector3(x, rampHeight(s, x, z), z));

  const quads: THREE.Vector3[][] = [];
  quads.push([top[0], top[3], top[2], top[1]]); // sloped top
  quads.push([bottom[0], bottom[1], bottom[2], bottom[3]]); // base
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    quads.push([bottom[i], bottom[j], top[j], top[i]]); // sides
  }

  const centre = new THREE.Vector3(
    (s.minX + s.maxX) / 2,
    (s.y0 + s.y1) / 4,
    (s.minZ + s.maxZ) / 2,
  );
  const positions: number[] = [];
  const normals: number[] = [];
  const addTri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => {
    let n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
    if (n.lengthSq() < 1e-12) return; // degenerate (e.g. zero-height side)
    const mid = new THREE.Vector3().add(a).add(b).add(c).multiplyScalar(1 / 3);
    // The wedge is convex, so a triangle faces outwards when its normal points away
    // from the interior point. Flip the winding (not just the normal) when it doesn't,
    // otherwise the front face is culled and the slope renders see-through.
    if (n.dot(mid.clone().sub(centre)) < 0) {
      [b, c] = [c, b];
      n = n.negate();
    }
    n.normalize();
    for (const p of [a, b, c]) {
      positions.push(p.x, p.y, p.z);
      normals.push(n.x, n.y, n.z);
    }
  };
  for (const [a, b, c, d] of quads) {
    addTri(a, b, c);
    addTri(a, c, d);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  return geo;
}

export function buildMap(map: MapDef): BuiltMap {
  const group = new THREE.Group();
  const solids: Solid[] = [];
  const s = map.size;

  // Floor
  const floorGeo = new THREE.PlaneGeometry(s, s);
  const floorMat = new THREE.MeshStandardMaterial({ color: map.floorColor, roughness: 0.95 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);

  // Grid helper for visual reference
  const grid = new THREE.GridHelper(s, Math.round(s / 2), '#000000', '#000000');
  (grid.material as THREE.Material).opacity = 0.08;
  (grid.material as THREE.Material).transparent = true;
  grid.position.y = 0.01;
  group.add(grid);

  // Perimeter walls
  const perimeter: BoxDef[] = [
    { kind: 'box', x: 0, z: -s / 2, w: s, d: 1, h: PERIMETER_HEIGHT, color: WALL_COLOR },
    { kind: 'box', x: 0, z: s / 2, w: s, d: 1, h: PERIMETER_HEIGHT, color: WALL_COLOR },
    { kind: 'box', x: -s / 2, z: 0, w: 1, d: s, h: PERIMETER_HEIGHT, color: WALL_COLOR },
    { kind: 'box', x: s / 2, z: 0, w: 1, d: s, h: PERIMETER_HEIGHT, color: WALL_COLOR },
  ];
  for (const b of perimeter) addBox(group, solids, b);

  for (const def of map.solids) {
    if (def.kind === 'box') addBox(group, solids, def);
    else addRamp(group, solids, def);
  }

  return { group, solids };
}
