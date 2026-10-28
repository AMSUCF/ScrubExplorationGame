// World layout: zones, base stations, and the starting arrangement of plants, trash and critters.
import { MAP_H, MAP_W, TILE } from '../config';
import { hash2 } from '../systems/rng';

export type ZoneId = 'base' | 'sand' | 'oak' | 'rosemary';

export const ZONE_NAME: Record<ZoneId, string> = {
  base: 'Home Base',
  sand: 'Sand Scrub',
  oak: 'Oak Scrub',
  rosemary: 'Rosemary Bald',
};

export const BASE_CENTER = { tx: 28, ty: 35 };
export const BASE_RADIUS = 6;

const ZONE_CENTERS: { id: Exclude<ZoneId, 'base'>; tx: number; ty: number }[] = [
  { id: 'sand', tx: 10, ty: 24 },
  { id: 'oak', tx: 32, ty: 7 },
  { id: 'rosemary', tx: 47, ty: 29 },
];

export function inBounds(tx: number, ty: number): boolean {
  return tx >= 0 && ty >= 0 && tx < MAP_W && ty < MAP_H;
}

/** Zone for a tile: a clearing around base, otherwise the nearest zone centre with a wobbly border. */
export function zoneAt(tx: number, ty: number): ZoneId {
  const bdx = tx - BASE_CENTER.tx;
  const bdy = ty - BASE_CENTER.ty;
  const wobble = (hash2(tx, ty, 7) - 0.5) * 1.6;
  if (Math.hypot(bdx, bdy) + wobble < BASE_RADIUS) return 'base';
  let best: ZoneId = 'sand';
  let bestD = Infinity;
  for (const c of ZONE_CENTERS) {
    const d = Math.hypot(tx - c.tx, ty - c.ty) + (hash2(tx, ty, c.tx) - 0.5) * 4;
    if (d < bestD) {
      bestD = d;
      best = c.id;
    }
  }
  return best;
}

export function zoneAtPx(x: number, y: number): ZoneId {
  return zoneAt(Math.floor(x / TILE), Math.floor(y / TILE));
}

export function tileCenter(tx: number, ty: number): { x: number; y: number } {
  return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
}

export type StationKind = 'pod' | 'recycler' | 'pad';

export interface Station {
  kind: StationKind;
  /** Tile the station is anchored on (its front-centre). */
  tx: number;
  ty: number;
  /** Footprint in tiles, centred on tx and extending upward from ty. */
  w: number;
  h: number;
}

/** The landed pod is the robot's home; recycler and pad sit outside it. */
export const STATIONS: Station[] = [
  { kind: 'pod', tx: BASE_CENTER.tx, ty: BASE_CENTER.ty - 2, w: 3, h: 2 },
  { kind: 'recycler', tx: BASE_CENTER.tx - 4, ty: BASE_CENTER.ty + 1, w: 1, h: 1 },
  { kind: 'pad', tx: BASE_CENTER.tx + 4, ty: BASE_CENTER.ty + 1, w: 1, h: 1 },
];

export const POD = STATIONS[0];

export const ROBOT_SPAWN = tileCenter(BASE_CENTER.tx, BASE_CENTER.ty);

export function stationTiles(s: Station): { tx: number; ty: number }[] {
  const out: { tx: number; ty: number }[] = [];
  const x0 = s.tx - Math.floor(s.w / 2);
  for (let dy = 0; dy < s.h; dy++) for (let dx = 0; dx < s.w; dx++) out.push({ tx: x0 + dx, ty: s.ty - dy });
  return out;
}

export function isStationTile(tx: number, ty: number): boolean {
  return STATIONS.some((s) => stationTiles(s).some((t) => t.tx === tx && t.ty === ty));
}
