import type { BoxDef, MapDef, RampDef, SolidDef } from '../types';

// ---------- layout helpers ----------

function box(x: number, z: number, w: number, d: number, h: number, color?: string, y = 0): BoxDef {
  return { kind: 'box', x, z, w, d, h, y, color };
}

function ramp(
  x: number,
  z: number,
  w: number,
  d: number,
  dir: RampDef['dir'],
  y1: number,
  color?: string,
  y0 = 0,
): RampDef {
  return { kind: 'ramp', x, z, w, d, dir, y0, y1, color };
}

/** Wall running along x at a fixed z, spanning x1..x2. */
function wallZ(z: number, x1: number, x2: number, h: number, color?: string): BoxDef {
  const lo = Math.min(x1, x2);
  const hi = Math.max(x1, x2);
  return box((lo + hi) / 2, z, hi - lo, 1, h, color);
}

/** Wall running along z at a fixed x, spanning z1..z2. */
function wallX(x: number, z1: number, z2: number, h: number, color?: string): BoxDef {
  const lo = Math.min(z1, z2);
  const hi = Math.max(z1, z2);
  return box(x, (lo + hi) / 2, 1, hi - lo, h, color);
}

const SIGNS: [number, number][] = [
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
];

// ---------- Warehouse (60 x 60) ----------
// Central raised platform reached by four ramps. Four walled corner rooms with
// doorways open onto a cross of corridors. Crate stacks provide cover.
const WH_WALL = '#4a5059';
const WH_PLATFORM = '#5b6470';
const WH_RAMP = '#7d8591';
const WH_CRATE = '#8a6a3c';
const WH_CRATE_DARK = '#6b5130';

function warehouseSolids(): SolidDef[] {
  const out: SolidDef[] = [];

  // Central platform + ramps on all four sides
  out.push(box(0, 0, 10, 10, 3, WH_PLATFORM));
  out.push(ramp(0, -8, 4, 6, '+z', 3, WH_RAMP));
  out.push(ramp(0, 8, 4, 6, '-z', 3, WH_RAMP));
  out.push(ramp(8, 0, 6, 4, '-x', 3, WH_RAMP));
  out.push(ramp(-8, 0, 6, 4, '+x', 3, WH_RAMP));

  // Corner rooms (14..30 on each axis) with two doorways each
  for (const [sx, sz] of SIGNS) {
    out.push(wallZ(sz * 14, sx * 14, sx * 18, 3.4, WH_WALL));
    out.push(wallZ(sz * 14, sx * 22, sx * 30, 3.4, WH_WALL));
    out.push(wallX(sx * 14, sz * 14, sz * 20, 3.4, WH_WALL));
    out.push(wallX(sx * 14, sz * 24, sz * 30, 3.4, WH_WALL));
    out.push(box(sx * 24, sz * 24, 4, 4, 1.2, WH_CRATE_DARK));
    out.push(box(sx * 20, sz * 26, 2, 2, 1.6, WH_CRATE));
  }

  // Crate stacks in the arms of the cross
  const stack = (x: number, z: number, s: number, h: number, levels = 1) => {
    for (let i = 0; i < levels; i++) out.push(box(x, z, s, s, h, WH_CRATE, i * h));
  };
  stack(-22, 6, 2.6, 1.6, 2);
  stack(22, -6, 2.6, 1.6, 2);
  stack(-18, -20, 2.4, 1.6);
  stack(18, 20, 2.4, 1.6);
  stack(-6, -22, 2.2, 1.8);
  stack(6, 22, 2.2, 1.8);
  stack(-22, -22, 2, 1.2);
  stack(22, 22, 2, 1.2);

  // Low waist-high cover in the central square
  out.push(wallZ(-6, -6, -2, 1.2, WH_CRATE_DARK));
  out.push(wallZ(6, 2, 6, 1.2, WH_CRATE_DARK));
  out.push(wallX(-6, 2, 6, 1.2, WH_CRATE_DARK));
  out.push(wallX(6, -6, -2, 1.2, WH_CRATE_DARK));

  return out;
}

// ---------- Dust Canyon (90 x 90) ----------
// A large mesa with four ramps, rock formations in each quadrant and long low
// walls that funnel fights.
const DC_ROCK = '#8d7752';
const DC_ROCK_DARK = '#6e5b3c';
const DC_MESA = '#a68b5b';
const DC_RAMP = '#b89868';

function canyonSolids(): SolidDef[] {
  const out: SolidDef[] = [];

  out.push(box(0, 0, 24, 18, 4, DC_MESA));
  out.push(ramp(0, -13, 6, 8, '+z', 4, DC_RAMP));
  out.push(ramp(0, 13, 6, 8, '-z', 4, DC_RAMP));
  out.push(ramp(18, 0, 12, 6, '-x', 4, DC_RAMP));
  out.push(ramp(-18, 0, 12, 6, '+x', 4, DC_RAMP));

  // Cover on top of the mesa
  out.push(box(-6, 0, 3, 3, 1.2, DC_ROCK_DARK, 4));
  out.push(box(6, 3, 2, 2, 1.4, DC_ROCK_DARK, 4));
  out.push(box(4, -5, 2.5, 2.5, 1, DC_ROCK_DARK, 4));

  // Rock formations in the four quadrants
  const rocks: [number, number, number, number, number][] = [
    // NE
    [28, -26, 6, 4, 3.5],
    [34, -18, 3, 3, 2.2],
    [22, -36, 4, 4, 2.6],
    [36, -34, 5, 3, 1.6],
    // NW
    [-28, -28, 8, 3, 4],
    [-34, -18, 4, 6, 2.5],
    [-20, -38, 4, 4, 1.6],
    // SE
    [28, 28, 8, 3, 4],
    [34, 18, 4, 6, 2.5],
    [20, 36, 4, 4, 1.6],
    // SW
    [-28, 26, 6, 4, 3.5],
    [-34, 34, 3, 3, 2.2],
    [-22, 36, 5, 3, 1.8],
  ];
  for (const [x, z, w, d, h] of rocks) out.push(box(x, z, w, d, h, DC_ROCK));

  // Low waist walls that funnel the approach to the mesa
  out.push(wallZ(-26, -10, 10, 1.4, DC_ROCK_DARK));
  out.push(wallZ(26, -10, 10, 1.4, DC_ROCK_DARK));
  out.push(wallX(-30, -12, 12, 1.4, DC_ROCK_DARK));
  out.push(wallX(30, -12, 12, 1.4, DC_ROCK_DARK));

  // Tall split walls breaking up the long open lanes
  out.push(wallX(-12, -44, -30, 3.2, DC_ROCK));
  out.push(wallX(12, 30, 44, 3.2, DC_ROCK));
  out.push(wallZ(-12, -44, -30, 3.2, DC_ROCK));
  out.push(wallZ(12, 30, 44, 3.2, DC_ROCK));

  return out;
}

// ---------- Night Facility (70 x 70) ----------
// A raised roof deck on pillars with four ramps. Four labs in the corners with
// doorways, and partitions/crates in the open bands between them.
const NF_WALL = '#3c4652';
const NF_DECK = '#4a5563';
const NF_RAMP = '#56606e';
const NF_PILLAR = '#2a313a';
const NF_CRATE = '#5a4a3a';

function facilitySolids(): SolidDef[] {
  const out: SolidDef[] = [];

  // Roof deck on pillars: you can walk under it, or climb a ramp onto it
  out.push(box(0, 0, 14, 14, 0.5, NF_DECK, 4));
  for (const [sx, sz] of SIGNS) out.push(box(sx * 5, sz * 5, 1.6, 1.6, 4, NF_PILLAR));
  out.push(ramp(0, -11, 6, 8, '+z', 4.5, NF_RAMP));
  out.push(ramp(0, 11, 6, 8, '-z', 4.5, NF_RAMP));
  out.push(ramp(11, 0, 8, 6, '-x', 4.5, NF_RAMP));
  out.push(ramp(-11, 0, 8, 6, '+x', 4.5, NF_RAMP));

  // Corner labs (20..35 on each axis) with two doorways each
  for (const [sx, sz] of SIGNS) {
    out.push(wallZ(sz * 20, sx * 20, sx * 25, 3.4, NF_WALL));
    out.push(wallZ(sz * 20, sx * 29, sx * 35, 3.4, NF_WALL));
    out.push(wallX(sx * 20, sz * 20, sz * 25, 3.4, NF_WALL));
    out.push(wallX(sx * 20, sz * 29, sz * 35, 3.4, NF_WALL));
    out.push(box(sx * 28, sz * 28, 3, 3, 1.4, NF_CRATE));
    out.push(box(sx * 31, sz * 31, 2, 5, 1, NF_WALL));
  }

  // Partitions in the open bands
  out.push(wallX(-12, -17, -10, 2.6, NF_WALL));
  out.push(wallX(12, 10, 17, 2.6, NF_WALL));
  out.push(wallZ(-12, 10, 17, 2.6, NF_WALL));
  out.push(wallZ(12, -17, -10, 2.6, NF_WALL));

  // Crates along the east/west bands and the north/south bands
  const crate = (x: number, z: number, s: number, h: number, levels = 1) => {
    for (let i = 0; i < levels; i++) out.push(box(x, z, s, s, h, NF_CRATE, i * h));
  };
  crate(-24, -8, 2.4, 1.6, 2);
  crate(-24, 8, 2.4, 1.6);
  crate(24, 8, 2.4, 1.6, 2);
  crate(24, -8, 2.4, 1.6);
  crate(-8, -26, 2.2, 1.8);
  crate(8, 26, 2.2, 1.8);
  crate(-6, 26, 2, 1.2);
  crate(6, -26, 2, 1.2);

  return out;
}

// ---------- Practice Range (120 x 120) ----------
// Wide open lanes for target practice: a raised firing deck behind the spawn,
// lane dividers, cover blocks in the far field and movement blocks on the flanks.
// The band |x| <= 22, z = -20..40 is deliberately empty — that's where the
// target plates and bots live.
const RG_WALL = '#4a5568';
const RG_PLATFORM = '#5b6472';
const RG_CRATE = '#6b5a3e';

function rangeSolids(): SolidDef[] {
  const out: SolidDef[] = [];

  // Raised firing deck behind the spawn, with a ramp up onto it
  out.push(box(0, -48, 30, 10, 3, RG_PLATFORM));
  out.push(ramp(0, -39, 8, 8, '-z', 3, RG_PLATFORM));

  // Lane dividers (outside the target band) so the lanes read clearly
  out.push(wallX(-26, -34, 40, 1.6, RG_WALL));
  out.push(wallX(26, -34, 40, 1.6, RG_WALL));

  // Cover blocks in the far field for bot fights and peek practice
  out.push(box(-36, 2, 4, 4, 2, RG_CRATE));
  out.push(box(36, 2, 4, 4, 2, RG_CRATE));
  out.push(box(-36, 26, 3, 7, 1.4, RG_WALL));
  out.push(box(36, 26, 3, 7, 1.4, RG_WALL));
  out.push(box(0, 52, 14, 2, 3.4, RG_WALL)); // far backstop

  // Movement blocks on the flanks: hop on, bhop around, jump off
  out.push(box(-48, 22, 10, 10, 2.2, RG_PLATFORM));
  out.push(ramp(-48, 14, 6, 6, '+z', 2.2, RG_PLATFORM));
  out.push(box(48, 22, 10, 10, 2.2, RG_PLATFORM));
  out.push(ramp(48, 14, 6, 6, '+z', 2.2, RG_PLATFORM));

  return out;
}

export const MAPS: MapDef[] = [
  {
    id: 'warehouse',
    name: 'Warehouse',
    description: 'Walled corner rooms, a raised central platform with four ramps and crate stacks.',
    size: 60,
    spawnA: [-22, 0, -6],
    spawnB: [22, 0, 6],
    skyColor: '#1b2230',
    floorColor: '#4b4740',
    solids: warehouseSolids(),
  },
  {
    id: 'canyon',
    name: 'Dust Canyon',
    description: 'Open desert with a big mesa reached by ramps, rock formations and long lanes.',
    size: 90,
    spawnA: [-36, 0, -36],
    spawnB: [36, 0, 36],
    skyColor: '#79a7cf',
    floorColor: '#c2a06b',
    solids: canyonSolids(),
  },
  {
    id: 'facility',
    name: 'Night Facility',
    description: 'Symmetric labs around a raised roof deck on pillars. Climb the ramps or fight below.',
    size: 70,
    spawnA: [-28, 0, 0],
    spawnB: [28, 0, 0],
    skyColor: '#0b0f1a',
    floorColor: '#394049',
    solids: facilitySolids(),
  },
  {
    id: 'range',
    name: 'Practice Range',
    description: 'Open lanes, a raised firing deck and cover blocks. Built for targets and bots.',
    size: 120,
    spawnA: [0, 0, -42],
    spawnB: [0, 0, 42],
    skyColor: '#2b3652',
    floorColor: '#5c616b',
    solids: rangeSolids(),
  },
  {
    id: 'empty',
    name: 'Empty Range',
    description: 'Nothing but flat ground and perimeter walls. Test movement, sprays and quickscopes.',
    size: 100,
    spawnA: [0, 0, -40],
    spawnB: [0, 0, 40],
    skyColor: '#131a28',
    floorColor: '#3f4652',
    solids: [],
  },
];

export function getMap(id: string): MapDef {
  return MAPS.find((m) => m.id === id) ?? MAPS[0];
}
