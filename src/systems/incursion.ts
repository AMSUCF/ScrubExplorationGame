// The scrub is an island among yards, roads and farms. Every night something new drifts, hops or
// wanders in across the edge, a little more as time goes on and a lot more after a storm.
// Restoration is never "done": healthy natives planted near the edge help hold the line.
import { EDGE_BAND, INCURSION_BASE, INCURSION_GROWTH, INCURSION_MAX, INVASIVE_SOFT_CAP, LITTER_SOFT_CAP, MAP_H, MAP_W } from '../config';
import { ZoneId, tileCenter } from '../data/map';
import { HAZARDS, InvasiveAnimalId, InvasivePlantId, INVASIVE_PLANTS, TrashId } from '../data/species';
import { seasonOf } from './calendar';
import { zoneOf } from './fire';
import { Rng, pick } from './rng';
import { GameState, InvasiveAnimalEntity, addEntity, isChoked, tileOccupied } from './state';

export type ArrivalSpecies = InvasivePlantId | InvasiveAnimalId | TrashId;

export interface Arrival {
  species: ArrivalSpecies;
  zone: ZoneId;
}

const PLANT_WEIGHTS: Record<Exclude<ZoneId, 'base'>, Partial<Record<InvasivePlantId, number>>> = {
  sand: { cogon: 4, natal: 3, pepper: 1 },
  oak: { pepper: 2, airpotato: 2, cogon: 2 },
  rosemary: { natal: 4, cogon: 2, pepper: 1 },
};

/** Edge tiles (inside the wild border hedge) where newcomers can settle. */
let edgeCache: { tx: number; ty: number }[] | null = null;
export function edgeTiles(): { tx: number; ty: number }[] {
  if (!edgeCache) {
    edgeCache = [];
    for (let ty = 1; ty < MAP_H - 1; ty++) {
      for (let tx = 1; tx < MAP_W - 1; tx++) {
        const d = Math.min(tx, ty, MAP_W - 1 - tx, MAP_H - 1 - ty);
        if (d <= EDGE_BAND && zoneOf(tx, ty) !== 'base') edgeCache.push({ tx, ty });
      }
    }
  }
  return edgeCache;
}

/** How hard the outside world is pushing in tonight. */
export function incursionPressure(s: GameState): number {
  const base = Math.min(INCURSION_MAX, INCURSION_BASE + s.day * INCURSION_GROWTH);
  const storm = { storm: 1.5, hurricane: 4, breezy: 0.6 }[s.weather.kind as 'storm' | 'hurricane' | 'breezy'] ?? 0;
  return base + storm;
}

function weighted<T extends string>(rng: Rng, weights: Partial<Record<T, number>>): T {
  const entries = Object.entries(weights) as [T, number][];
  let roll = rng() * entries.reduce((sum, [, w]) => sum + w, 0);
  for (const [k, w] of entries) if ((roll -= w) < 0) return k;
  return entries[0][0];
}

/** Healthy natives within two tiles shade out most newcomers before they take root. */
function guarded(s: GameState, tx: number, ty: number): boolean {
  return s.entities.some((e) => e.kind === 'nativePlant' && Math.abs(e.tx - tx) <= 2 && Math.abs(e.ty - ty) <= 2 && !isChoked(s, e));
}

function freeEdgeTile(s: GameState, rng: Rng): { tx: number; ty: number } | null {
  const tiles = edgeTiles();
  for (let i = 0; i < 30; i++) {
    const t = pick(rng, tiles);
    if (!tileOccupied(s, t.tx, t.ty)) return t;
  }
  return null;
}

const ANIMAL_CAP: Record<InvasiveAnimalId, number> = { anole: 5, cat: 2, tegu: 2, iguana: 2 };

/** Nightly arrivals from beyond the edge. Returns what came in (for the morning card). */
export function edgeIncursions(s: GameState, rng: Rng): Arrival[] {
  const arrivals: Arrival[] = [];
  const pressure = incursionPressure(s);

  // Seeds and runners: wind-blown grass, bird-dropped pepper, bulbils washed in by rain.
  const invasives = s.entities.filter((e) => e.kind === 'invasivePlant').length;
  const tries = invasives >= INVASIVE_SOFT_CAP ? 0 : Math.floor(pressure) + (rng() < pressure % 1 ? 1 : 0);
  for (let i = 0; i < tries; i++) {
    const t = freeEdgeTile(s, rng);
    if (!t) continue;
    if (guarded(s, t.tx, t.ty) && rng() < 0.65) continue;
    const zone = zoneOf(t.tx, t.ty) as Exclude<ZoneId, 'base'>;
    const weights = { ...PLANT_WEIGHTS[zone] };
    if (seasonOf(s.day) === 'summer') weights.cogon = (weights.cogon ?? 0) * 1.5;
    const species = weighted(rng, weights);
    addEntity(s, { kind: 'invasivePlant', species, tx: t.tx, ty: t.ty, hp: INVASIVE_PLANTS[species].hp });
    arrivals.push({ species, zone });
  }

  // Animals wander in now and then: anoles hitchhike, cats roam from nearby homes.
  const season = seasonOf(s.day);
  const chances: Record<InvasiveAnimalId, number> = {
    anole: 0.35,
    cat: s.day > 4 ? 0.12 : 0,
    tegu: s.day > 10 && season !== 'winter' ? 0.07 : 0,
    iguana: s.day > 8 && season !== 'winter' ? 0.06 : 0,
  };
  for (const species of Object.keys(chances) as InvasiveAnimalId[]) {
    if (rng() >= chances[species]) continue;
    const have = s.entities.filter((e) => e.kind === 'invasiveAnimal' && e.species === species).length;
    if (have >= ANIMAL_CAP[species]) continue;
    const t = freeEdgeTile(s, rng);
    if (!t) continue;
    const p = tileCenter(t.tx, t.ty);
    const zone = zoneOf(t.tx, t.ty);
    addEntity<InvasiveAnimalEntity>(s, { kind: 'invasiveAnimal', species, x: p.x, y: p.y, home: zone });
    arrivals.push({ species, zone });
  }

  // Storms blow litter in from roads and yards.
  const lying = s.entities.filter((e) => e.kind === 'hazard' && e.species !== 'thicket' && e.species !== 'fence').length;
  const litter = lying >= LITTER_SOFT_CAP ? 0 : s.weather.kind === 'hurricane' ? 3 + Math.floor(rng() * 4) : s.weather.kind === 'storm' ? 1 + Math.floor(rng() * 2) : rng() < 0.15 ? 1 : 0;
  for (let i = 0; i < litter; i++) {
    const t = rng() < 0.6 ? freeEdgeTile(s, rng) : { tx: 2 + Math.floor(rng() * (MAP_W - 4)), ty: 2 + Math.floor(rng() * (MAP_H - 4)) };
    if (!t || zoneOf(t.tx, t.ty) === 'base' || tileOccupied(s, t.tx, t.ty)) continue;
    const species = weighted<TrashId>(rng, { balloon: 3, plastic: 4, can: 3, bottle: 2, tire: 1 });
    addEntity(s, { kind: 'hazard', species, tx: t.tx, ty: t.ty, hp: HAZARDS[species].hp });
    arrivals.push({ species, zone: zoneOf(t.tx, t.ty) });
  }

  s.stats.arrivals = (s.stats.arrivals ?? 0) + arrivals.length;
  return arrivals;
}
