import * as THREE from 'three';

/**
 * Collision world for the player and projectiles.
 *
 * Every solid is an axis-aligned footprint with either a flat top (box) or a
 * sloped top (ramp). Surfaces are "walkable" when they are at most STEP_UP above
 * the player's feet, so small ledges and ramps can be walked onto without
 * jumping. Anything taller is a wall while it overlaps the player's body.
 */

export const STEP_UP = 0.6;
const EPS = 1e-4;

export interface BoxSolid {
  kind: 'box';
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  bottom: number;
  top: number;
}

export interface RampSolid {
  kind: 'ramp';
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  dir: '+x' | '-x' | '+z' | '-z';
  y0: number;
  y1: number;
}

export type Solid = BoxSolid | RampSolid;

function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Height of a ramp's sloped top at (x,z). Coordinates are clamped to the footprint. */
export function rampHeight(s: RampSolid, x: number, z: number): number {
  let t: number;
  switch (s.dir) {
    case '+x':
      t = (x - s.minX) / (s.maxX - s.minX);
      break;
    case '-x':
      t = (s.maxX - x) / (s.maxX - s.minX);
      break;
    case '+z':
      t = (z - s.minZ) / (s.maxZ - s.minZ);
      break;
    default:
      t = (s.maxZ - z) / (s.maxZ - s.minZ);
      break;
  }
  t = clamp(t, 0, 1);
  return s.y0 + (s.y1 - s.y0) * t;
}

/** Top surface of a solid at (x,z), or null if (x,z) is outside its footprint. */
export function surfaceAt(s: Solid, x: number, z: number): number | null {
  if (x < s.minX - EPS || x > s.maxX + EPS || z < s.minZ - EPS || z > s.maxZ + EPS) return null;
  return s.kind === 'box' ? s.top : rampHeight(s, x, z);
}

/**
 * Highest walkable surface under (x,z) that the player at `feet` can reach
 * (floor is y = 0).
 */
export function groundHeight(solids: Solid[], x: number, z: number, feet: number): number {
  let g = 0;
  for (const s of solids) {
    const h = surfaceAt(s, x, z);
    if (h === null) continue;
    if (h <= feet + STEP_UP + EPS && h > g) g = h;
  }
  return g;
}

/** True if the point lies inside solid geometry (used for projectiles). */
export function solidAt(solids: Solid[], x: number, y: number, z: number): boolean {
  for (const s of solids) {
    const h = surfaceAt(s, x, z);
    if (h === null) continue;
    const bottom = s.kind === 'box' ? s.bottom : 0;
    if (y > bottom + EPS && y < h - EPS) return true;
  }
  return false;
}

/**
 * Horizontal collision of a vertical cylinder (radius r, height `height`) at
 * `pos` against all solids. Pushes the player out and cancels inward velocity.
 */
export function resolveHorizontal(
  pos: THREE.Vector3,
  vel: THREE.Vector3,
  height: number,
  solids: Solid[],
  r: number,
) {
  const feet = pos.y;
  const head = feet + height;
  for (const s of solids) {
    const inside = pos.x >= s.minX && pos.x <= s.maxX && pos.z >= s.minZ && pos.z <= s.maxZ;
    const cx = clamp(pos.x, s.minX, s.maxX);
    const cz = clamp(pos.z, s.minZ, s.maxZ);
    const dx = pos.x - cx;
    const dz = pos.z - cz;
    const distSq = dx * dx + dz * dz;
    if (!inside && distSq >= r * r) continue;

    // Height of the surface at the nearest point. If that is walkable the
    // ground logic handles it instead of a wall.
    const hc = surfaceAt(s, cx, cz);
    if (hc === null || hc <= feet + STEP_UP + EPS) continue;
    const bottom = s.kind === 'box' ? s.bottom : 0;
    if (bottom >= head - EPS) continue; // passes underneath us

    if (inside) {
      // Centre is buried inside the solid: eject through the nearest side.
      const left = pos.x - s.minX;
      const right = s.maxX - pos.x;
      const back = pos.z - s.minZ;
      const front = s.maxZ - pos.z;
      const m = Math.min(left, right, back, front);
      if (m === left) {
        pos.x = s.minX - r;
        if (vel.x > 0) vel.x = 0;
      } else if (m === right) {
        pos.x = s.maxX + r;
        if (vel.x < 0) vel.x = 0;
      } else if (m === back) {
        pos.z = s.minZ - r;
        if (vel.z > 0) vel.z = 0;
      } else {
        pos.z = s.maxZ + r;
        if (vel.z < 0) vel.z = 0;
      }
      continue;
    }

    const dist = Math.sqrt(distSq);
    const overlap = r - dist;
    const nx = dx / dist;
    const nz = dz / dist;
    pos.x += nx * overlap;
    pos.z += nz * overlap;
    const vn = vel.x * nx + vel.z * nz;
    if (vn < 0) {
      vel.x -= vn * nx;
      vel.z -= vn * nz;
    }
  }
}

/** Raised slabs stop upward movement of the head (you bonk on the underside). */
export function resolveCeilings(
  pos: THREE.Vector3,
  vel: THREE.Vector3,
  height: number,
  solids: Solid[],
  r: number,
) {
  const head = pos.y + height;
  for (const s of solids) {
    if (s.kind !== 'box' || s.bottom <= 0) continue;
    if (vel.y <= 0) continue;
    if (pos.y >= s.bottom - EPS || head <= s.bottom + EPS) continue;
    const cx = clamp(pos.x, s.minX, s.maxX);
    const cz = clamp(pos.z, s.minZ, s.maxZ);
    const dx = pos.x - cx;
    const dz = pos.z - cz;
    if (dx * dx + dz * dz >= r * r) continue;
    vel.y = 0;
    pos.y = Math.min(pos.y, s.bottom - height);
  }
}

/**
 * Ground snapping. Returns whether the player is standing on something.
 * Snapping lets the player walk up/down ramps and small ledges without
 * losing contact, while falling off a real ledge still makes you drop.
 */
export function resolveVertical(pos: THREE.Vector3, vel: THREE.Vector3, solids: Solid[]): boolean {
  const g = groundHeight(solids, pos.x, pos.z, pos.y);
  if (vel.y <= 0 && pos.y <= g + STEP_UP + EPS) {
    pos.y = g;
    vel.y = 0;
    return true;
  }
  return false;
}
