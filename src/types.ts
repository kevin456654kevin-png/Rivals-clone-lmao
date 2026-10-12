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
  spread?: number; // radians
  projectileSpeed?: number; // for misc throwables, 0 = hitscan
  description: string;
}

export interface MapDef {
  id: string;
  name: string;
  description: string;
  size: number;
  spawnA: [number, number, number];
  spawnB: [number, number, number];
  skyColor: string;
  floorColor: string;
}

export interface Loadout {
  primary: string | null;
  secondary: string | null;
  melee: string | null;
  misc: string | null;
}

export type Role = 'host' | 'client';

export interface RoomConfig {
  mapId: string;
  bannedWeapons: string[];
}

// Networking messages exchanged over PeerJS data connection
export type NetMessage =
  | { type: 'config'; config: RoomConfig; hostName: string }
  | { type: 'hello'; name: string }
  | { type: 'start-countdown'; startAt: number }
  | { type: 'loadout'; loadout: Loadout }
  | { type: 'player-state'; pos: [number, number, number]; rotY: number; pitch: number; hp: number; moving: boolean; crouching: boolean }
  | { type: 'shoot'; weaponId: string; origin: [number, number, number]; dir: [number, number, number]; id: string }
  | { type: 'hit'; damage: number; byShotId: string }
  | { type: 'death' }
  | { type: 'melee-swing' }
  | { type: 'explosion'; pos: [number, number, number] }
  | { type: 'chat'; text: string };
