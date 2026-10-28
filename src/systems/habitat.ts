// Habitat health, invasive spread, and the conditions that bring native wildlife home.
import { COGON_MAX_SPREAD_PER_NIGHT, COGON_SPREAD_CHANCE, MAP_H, MAP_W } from '../config';
import { ZoneId, inBounds, tileCenter, zoneAt } from '../data/map';
import { INVASIVE_PLANTS, NativeAnimalId } from '../data/species';
import { Rng, pick } from './rng';
import {
  BurrowEntity,
  GameState,
  InvasivePlantEntity,
  NativeAnimalEntity,
  addEntity,
  countWhere,
  entityZone,
  isChoked,
  tileOccupied,
} from './state';

/** Scrub-jays need more oaks than the map starts with, so the player has to grow and plant some. */
export const JAY_OAKS = 6;

export function zoneHealth(state: GameState, zone: ZoneId): number {
  let good = 1;
  let bad = 0;
  for (const e of state.entities) {
    if (entityZone(e) !== zone) continue;
    switch (e.kind) {
      case 'nativePlant':
        good += isChoked(state, e) ? 0.3 : e.planted ? 1.5 : 1;
        break;
      case 'invasivePlant':
        bad += 1;
        break;
      case 'hazard':
        bad += e.species === 'thicket' ? 0.8 : 0.6;
        break;
      case 'invasiveAnimal':
        bad += 1.5;
        break;
      case 'nativeAnimal':
      case 'burrow':
        good += 1;
        break;
    }
  }
  return Math.max(0, Math.min(100, Math.round((100 * good) / (good + bad))));
}

export function burrowCount(state: GameState): number {
  return countWhere(state, (e) => e.kind === 'burrow');
}

export function healthyOaks(state: GameState, zone: ZoneId): number {
  return countWhere(
    state,
    (e) => e.kind === 'nativePlant' && e.species === 'oak' && entityZone(e) === zone && !isChoked(state, e),
  );
}

export const ANIMAL_HOME: Record<NativeAnimalId, ZoneId> = {
  tortoise: 'sand',
  mouse: 'sand',
  jay: 'oak',
  indigo: 'sand',
};

function randomFreeTileIn(state: GameState, rng: Rng, zone: ZoneId, radius: number) {
  for (let i = 0; i < 400; i++) {
    const tx = 1 + Math.floor(rng() * (MAP_W - 2));
    const ty = 1 + Math.floor(rng() * (MAP_H - 2));
    if (zoneAt(tx, ty) === zone && !tileOccupied(state, tx, ty, radius)) return { tx, ty };
  }
  return null;
}

export function digBurrow(state: GameState, rng: Rng): BurrowEntity | null {
  const t = randomFreeTileIn(state, rng, 'sand', 1);
  if (!t) return null;
  return addEntity<BurrowEntity>(state, { kind: 'burrow', tx: t.tx, ty: t.ty });
}

export function spawnNativeAnimal(state: GameState, rng: Rng, species: NativeAnimalId): NativeAnimalEntity {
  const home = ANIMAL_HOME[species];
  const burrows = state.entities.filter((e): e is BurrowEntity => e.kind === 'burrow');
  let pos: { x: number; y: number };
  if ((species === 'mouse' || species === 'tortoise') && burrows.length > 0) {
    const b = pick(rng, burrows);
    pos = tileCenter(b.tx, b.ty + 1);
  } else {
    const t = randomFreeTileIn(state, rng, home, 0) ?? { tx: 10, ty: 24 };
    pos = tileCenter(t.tx, t.ty);
  }
  return addEntity<NativeAnimalEntity>(state, { kind: 'nativeAnimal', species, x: pos.x, y: pos.y, home });
}

const NEIGHBOURS = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0], [1, 0],
  [-1, 1], [0, 1], [1, 1],
];

/** Cogon creeps into neighbouring ground overnight. Returns how many new patches appeared. */
export function spreadCogon(state: GameState, rng: Rng): number {
  const cogon = state.entities.filter(
    (e): e is InvasivePlantEntity => e.kind === 'invasivePlant' && e.species === 'cogon',
  );
  let spawned = 0;
  for (const c of cogon) {
    if (spawned >= COGON_MAX_SPREAD_PER_NIGHT) break;
    if (rng() >= COGON_SPREAD_CHANCE) continue;
    const [dx, dy] = pick(rng, NEIGHBOURS);
    const tx = c.tx + dx;
    const ty = c.ty + dy;
    if (!inBounds(tx, ty) || zoneAt(tx, ty) === 'base' || tileOccupied(state, tx, ty)) continue;
    addEntity<InvasivePlantEntity>(state, { kind: 'invasivePlant', species: 'cogon', tx, ty, hp: INVASIVE_PLANTS.cogon.hp });
    spawned++;
  }
  return spawned;
}
