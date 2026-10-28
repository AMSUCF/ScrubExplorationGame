// "Hold the line": a close-up of the ground around a fire. The mini-game plays directly on the real
// world state (the same spread rules, water tank and battery), so what you see is what happens.
// Tap a flame to spray it; tap dry ground ahead of the fire to rake a firebreak.
import { MAP_H, MAP_W } from '../../config';
import { ZoneId } from '../../data/map';
import { canAfford, spend } from '../battery';
import { douse, fireIndex, fuelAt, isBurning, isFirebreak, rake, tileAge, tileIndex, zoneOf } from '../fire';
import { GameState, NativePlantEntity } from '../state';

export const FIRE_LINE_SIZE = 9;
export const RAKE_COST = 1;

export interface FireView {
  ox: number;
  oy: number;
  w: number;
  h: number;
}

export interface FireCellView {
  tx: number;
  ty: number;
  zone: ZoneId;
  fuel: number;
  age: number;
  burning: boolean;
  heat: number;
  firebreak: boolean;
  /** Texture key of the most notable thing on the tile. */
  thing?: string;
  native?: boolean;
  /** A native that fire would kill: a seedling, or a plant still recovering. */
  fragile?: boolean;
}

/** A square window on the world, centred on the fire and kept inside the map. */
export function fireWindow(tx: number, ty: number, size = FIRE_LINE_SIZE): FireView {
  const ox = Math.max(1, Math.min(MAP_W - 1 - size, tx - Math.floor(size / 2)));
  const oy = Math.max(1, Math.min(MAP_H - 1 - size, ty - Math.floor(size / 2)));
  return { ox, oy, w: size, h: size };
}

const PRIORITY = { nativePlant: 3, invasivePlant: 2, hazard: 2, burrow: 1 } as const;

export function windowCells(s: GameState, v: FireView): FireCellView[] {
  const idx = fireIndex(s);
  const heat = new Map(s.fires.map((f) => [tileIndex(f.tx, f.ty), f.heat]));
  const cells: FireCellView[] = [];
  for (let y = 0; y < v.h; y++) {
    for (let x = 0; x < v.w; x++) {
      const tx = v.ox + x, ty = v.oy + y, i = tileIndex(tx, ty);
      const cell: FireCellView = { tx, ty, zone: zoneOf(tx, ty), fuel: fuelAt(s, tx, ty, idx), age: tileAge(s, tx, ty), burning: heat.has(i), heat: heat.get(i) ?? 0, firebreak: idx.breaks.has(i) };
      let best = 0;
      for (const e of idx.things.get(i) ?? []) {
        if (PRIORITY[e.kind] <= best) continue;
        best = PRIORITY[e.kind];
        cell.thing = e.kind === 'burrow' ? 'burrow' : e.species;
        cell.native = e.kind === 'nativePlant';
        cell.fragile = e.kind === 'nativePlant' && isFragile(s, e);
      }
      cells.push(cell);
    }
  }
  return cells;
}

/** Natives that a flame would kill rather than burn back to their roots. */
export function isFragile(s: GameState, e: NativePlantEntity): boolean {
  if (e.planted && s.day - e.plantedDay + (e.boost ?? 0) < 3) return true;
  if (e.burnedDay !== undefined && s.day - e.burnedDay < 8) return true;
  return tileAge(s, e.tx, e.ty) < 8;
}

export const inView = (v: FireView, tx: number, ty: number): boolean => tx >= v.ox && ty >= v.oy && tx < v.ox + v.w && ty < v.oy + v.h;

export function flamesInView(s: GameState, v: FireView): number {
  return s.fires.filter((f) => inView(v, f.tx, f.ty)).length;
}

export type FireLineMove = 'douse' | 'rake' | 'noWater' | 'noEnergy' | 'none';

/** One tap: spray a flame, or rake dry ground. */
export function fireLineTap(s: GameState, tx: number, ty: number): FireLineMove {
  if (isBurning(s, tx, ty)) {
    if (s.water <= 0) return 'noWater';
    return douse(s, tx, ty) ? 'douse' : 'none';
  }
  if (fuelAt(s, tx, ty) < 0.06 || isFirebreak(s, tx, ty)) return 'none';
  if (!canAfford(s, RAKE_COST)) return 'noEnergy';
  if (!rake(s, tx, ty)) return 'none';
  spend(s, RAKE_COST);
  return 'rake';
}

export interface FireLineScore {
  contained: boolean;
  saved: number;
  lost: number;
  burned: number;
  stars: number;
}

/** Natives in view when the work began (ids), compared with what is still standing. */
export function scoreFireLine(s: GameState, v: FireView, nativesBefore: number[], burnedBefore: number): FireLineScore {
  const standing = new Set(s.entities.filter((e) => e.kind === 'nativePlant').map((e) => e.id));
  const lost = nativesBefore.filter((id) => !standing.has(id)).length;
  const contained = flamesInView(s, v) === 0;
  const stars = !contained ? 0 : lost === 0 ? 3 : lost <= 1 ? 2 : 1;
  return { contained, saved: nativesBefore.length - lost, lost, burned: s.fireToday.tiles - burnedBefore, stars };
}

export function nativesInView(s: GameState, v: FireView): number[] {
  return s.entities.filter((e) => e.kind === 'nativePlant' && inView(v, e.tx, e.ty)).map((e) => e.id);
}
