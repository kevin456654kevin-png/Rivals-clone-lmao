import * as THREE from 'three';
import type { MapDef } from '../types';

export interface BuiltMap {
  group: THREE.Group;
  colliders: THREE.Box3[];
}

function box(
  group: THREE.Group,
  colliders: THREE.Box3[],
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  color: string,
  castShadow = true,
) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.05 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y + h / 2, z);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  group.add(mesh);
  const box3 = new THREE.Box3().setFromObject(mesh);
  colliders.push(box3);
  return mesh;
}

export function buildMap(map: MapDef): BuiltMap {
  const group = new THREE.Group();
  const colliders: THREE.Box3[] = [];
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
  const wallH = 6;
  const wallColor = '#2d3138';
  box(group, colliders, 0, 0, -s / 2, s, wallH, 1, wallColor);
  box(group, colliders, 0, 0, s / 2, s, wallH, 1, wallColor);
  box(group, colliders, -s / 2, 0, 0, 1, wallH, s, wallColor);
  box(group, colliders, s / 2, 0, 0, 1, wallH, s, wallColor);

  const rand = mulberry32(hashStr(map.id));

  if (map.id === 'warehouse') {
    const crateColor = '#8a6a3c';
    for (let i = 0; i < 10; i++) {
      const x = (rand() - 0.5) * (s - 8);
      const z = (rand() - 0.5) * (s - 8);
      if (Math.hypot(x, z) < 4) continue;
      const size = 1.6 + rand() * 1.6;
      box(group, colliders, x, 0, z, size, size, size, crateColor);
    }
    // central divider corridor walls
    box(group, colliders, 0, 0, 0, 1.2, 3.2, 14, '#4a5059');
    box(group, colliders, -10, 0, -6, 6, 3.6, 1, '#4a5059');
    box(group, colliders, 10, 0, 6, 6, 3.6, 1, '#4a5059');
  } else if (map.id === 'canyon') {
    const rockColor = '#8d7752';
    for (let i = 0; i < 14; i++) {
      const x = (rand() - 0.5) * (s - 10);
      const z = (rand() - 0.5) * (s - 10);
      if (Math.hypot(x, z) < 6) continue;
      const w = 2 + rand() * 3;
      const h = 1.5 + rand() * 3;
      const d = 2 + rand() * 3;
      box(group, colliders, x, 0, z, w, h, d, rockColor);
    }
    box(group, colliders, 0, 0, 0, 5, 1.2, 5, '#a68b5b');
  } else if (map.id === 'facility') {
    const wallColor2 = '#3c4652';
    box(group, colliders, 0, 0, 0, 7, 8, 7, '#2a313a'); // central tower
    box(group, colliders, -14, 0, -14, 6, 3.6, 1, wallColor2);
    box(group, colliders, -14, 0, 14, 6, 3.6, 1, wallColor2);
    box(group, colliders, 14, 0, -14, 6, 3.6, 1, wallColor2);
    box(group, colliders, 14, 0, 14, 6, 3.6, 1, wallColor2);
    box(group, colliders, -7, 0, 0, 1, 3, 10, wallColor2);
    box(group, colliders, 7, 0, 0, 1, 3, 10, wallColor2);
  }

  // Ambient props / lighting accents (not colliders) - small pillars for cover variety
  return { group, colliders };
}

function hashStr(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
