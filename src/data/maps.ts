import type { MapDef } from '../types';

export const MAPS: MapDef[] = [
  {
    id: 'warehouse',
    name: 'Warehouse',
    description: 'Tight industrial map with crates and corridors. Close-range brawls.',
    size: 46,
    spawnA: [-18, 1.7, -18],
    spawnB: [18, 1.7, 18],
    skyColor: '#1b2230',
    floorColor: '#4b4740',
  },
  {
    id: 'canyon',
    name: 'Dust Canyon',
    description: 'Open desert canyon with ramps and rock cover. Great for snipers.',
    size: 70,
    spawnA: [-30, 1.7, -30],
    spawnB: [30, 1.7, 30],
    skyColor: '#79a7cf',
    floorColor: '#c2a06b',
  },
  {
    id: 'facility',
    name: 'Night Facility',
    description: 'Symmetric facility with a central tower and side rooms.',
    size: 54,
    spawnA: [-22, 1.7, 0],
    spawnB: [22, 1.7, 0],
    skyColor: '#0b0f1a',
    floorColor: '#394049',
  },
];

export function getMap(id: string): MapDef {
  return MAPS.find((m) => m.id === id) ?? MAPS[0];
}
