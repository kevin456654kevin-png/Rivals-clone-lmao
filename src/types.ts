export type WeaponCategory = 'primary' | 'secondary' | 'melee' | 'misc';

export interface WeaponDef {
  id: string;
  name: string;
  category: WeaponCategory;
  damage: number;
  fireRateMs: number; // ms between shots
  range: number;
  color: string;
  automatic: boolean;
  magSize: number;
  reloadMs: number;
  pellets?: number; // for shotguns
  spread?: number; // radians, hip fire
  projectileSpeed?: number; // for misc throwables, 0 = hitscan
  channelMs?: number; // for items that must be held to use (medkit)
  /** Weapon can be scoped/ADS'd with the scope key. */
  scopeOverlay?: boolean; // draws the sniper scope vignette
  /** Spread in radians while scoped. Defaults to `spread`. */
  spreadScoped?: number;
  /** Damage multiplier for headshots. Defaults to 1. */
  headshotMultiplier?: number;
  /** Fire rate used when the shot lands inside the quickscope window. */
  quickScopeFireRateMs?: number;
  /** Movement speed multiplier while scoped. Defaults to 1. */
  scopedMoveScale?: number;
  description: string;
}

/**
 * Axis-aligned box sitting on `y` (its bottom) and reaching `y + h` (its top).
 * Boxes with y = 0 are plain cover; boxes with y > 0 are elevated slabs/platforms.
 */
export interface BoxDef {
  kind: 'box';
  x: number; // centre
  z: number; // centre
  w: number; // size along x
  d: number; // size along z
  h: number;
  y?: number; // bottom height, default 0
  color?: string;
}

/**
 * Sloped ramp covering the footprint (x,z,w,d). `dir` is the direction the ramp
 * rises towards, so '+x' means the high edge is at maxX and the low edge at minX.
 * Heights go from y0 (low edge) to y1 (high edge).
 */
export interface RampDef {
  kind: 'ramp';
  x: number;
  z: number;
  w: number;
  d: number;
  dir: '+x' | '-x' | '+z' | '-z';
  y0?: number; // default 0
  y1: number;
  color?: string;
}

export type SolidDef = BoxDef | RampDef;

export interface MapDef {
  id: string;
  name: string;
  description: string;
  size: number;
  spawnA: [number, number, number];
  spawnB: [number, number, number];
  skyColor: string;
  floorColor: string;
  solids: SolidDef[];
}

export interface Loadout {
  primary: string | null;
  secondary: string | null;
  melee: string | null;
  misc: string | null;
}

export type Role = 'host' | 'client';

/** PvP duel over the network, or the offline practice range. */
export type GameMode = 'pvp' | 'practice';

/** Options for the offline practice range. */
export interface PracticeConfig {
  mapId: string;
  bots: number; // 0 = no bots, just targets
  botSkill: number; // 0 (clueless) .. 1 (cracked)
  targets: boolean; // static + moving target plates
  movingTargets: boolean;
  infiniteAmmo: boolean;
}

export const DEFAULT_PRACTICE: PracticeConfig = {
  mapId: 'range',
  bots: 2,
  botSkill: 0.5,
  targets: true,
  movingTargets: true,
  infiniteAmmo: true,
};

export interface RoomConfig {
  mapId: string;
  bannedWeapons: string[];
}

export type GameResult = 'win' | 'lose' | 'disconnected';

export interface MatchStats {
  damageDealt: number;
  damageTaken: number;
  hits: number;
}

// Networking messages exchanged over PeerJS data connection
export type NetMessage =
  | { type: 'config'; config: RoomConfig; hostName: string }
  | { type: 'hello'; name: string }
  | { type: 'start-match' }
  | { type: 'loadout'; loadout: Loadout }
  | { type: 'player-state'; pos: [number, number, number]; rotY: number; pitch: number; moving: boolean; crouching: boolean }
  | { type: 'shoot'; weaponId: string; origin: [number, number, number]; dir: [number, number, number]; id: string }
  | { type: 'hit'; damage: number; byShotId: string }
  | { type: 'death' }
  | { type: 'melee-swing' }
  | { type: 'explosion'; pos: [number, number, number] }
  | { type: 'rematch-request' }
  | { type: 'rematch-loadout' }
  | { type: 'chat'; text: string };
