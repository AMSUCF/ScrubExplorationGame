// Fire ecology. Every tile remembers the day it last burned. Fuel builds back up after a fire, so
// recently burned ground acts as a natural firebreak and long-unburned scrub carries flames easily.
// Whether a fire helps or harms depends on that history: overdue scrub is renewed (thickets clear,
// rosemary reseeds, palmettos bloom), while ground that burned only days ago loses its young plants.
import {
  FIREBREAK_DAYS,
  FIRE_OVERDUE_DAYS,
  FIRE_READY_DAYS,
  FIRE_RECOVER_DAYS,
  FIRE_SPREAD,
  FUEL_FULL_DAYS,
  MAP_H,
  MAP_W,
  OVERGROWTH_GRACE_DAYS,
} from '../config';
import { ZoneId, inBounds, isStationTile, zoneAt } from '../data/map';
import { HAZARDS, InvasivePlantId } from '../data/species';
import { Rng, hash2, pick } from './rng';
import {
  GameState,
  HazardEntity,
  NativePlantEntity,
  TileEntity,
  addEntity,
  isTileEntity,
  removeEntity,
  tileOccupied,
} from './state';
import { fireMoisture } from './weather';

export interface FireCell {
  tx: number;
  ty: number;
  /** Steps of burning left. */
  heat: number;
}

export interface Firebreak {
  tx: number;
  ty: number;
  /** Last day the break stays clear. */
  until: number;
}

/** Roots, bulbils and seeds left in the soil that may sprout on a coming morning. */
export interface Sprout {
  tx: number;
  ty: number;
  species: InvasivePlantId | 'rosemary';
  /** First day it may appear. */
  day: number;
  chance: number;
}

/** Running tally of what fire did today, reported on the morning card. */
export interface FireReport {
  tiles: number;
  /** Tiles that were ready or overdue for fire. */
  renewed: number;
  /** Tiles that burned sooner than ideal, but not harmfully. */
  early: number;
  /** Tiles that had burned only days ago. */
  harmed: number;
  thickets: number;
  invasives: number;
  /** Natives resprouting from roots or dropping seed. */
  resprouting: number;
  /** Young or recovering plants lost. */
  lost: number;
  contained: number;
}

export type FireState = 'recovering' | 'young' | 'ready' | 'overdue';

export const FIRE_STATE_INFO: Record<FireState, { name: string; note: string; good: boolean }> = {
  recovering: { name: 'Recovering', note: 'Burned only days ago. Sprouts here cannot survive another fire yet: contain it.', good: false },
  young: { name: 'Regrowing', note: 'Burned not long ago. A fire now is early, but most plants will resprout.', good: false },
  ready: { name: 'Ready for fire', note: 'Fuel has built back up. A fire here would renew the scrub.', good: true },
  overdue: { name: 'Overdue for fire', note: 'Tall and tangled. Fire would clear thickets and wake up seeds.', good: true },
};

export const emptyFireReport = (): FireReport => ({ tiles: 0, renewed: 0, early: 0, harmed: 0, thickets: 0, invasives: 0, resprouting: 0, lost: 0, contained: 0 });

/** How much the open ground of each habitat carries fire: wiregrass, leaf litter, or bare white sand. */
export const ZONE_FUEL: Record<ZoneId, number> = { base: 0, sand: 0.25, oak: 0.32, rosemary: 0.14 };
/** Share of each habitat that is bare sand between shrubs: natural gaps that break up a fire. */
const BARE: Record<ZoneId, number> = { base: 1, sand: 0.2, oak: 0.1, rosemary: 0.38 };
export const isBareSand = (tx: number, ty: number): boolean => hash2(tx, ty, 91) < BARE[zoneOf(tx, ty)];
const ENTITY_FUEL: Record<string, number> = {
  thicket: 0.55, cogon: 0.45, natal: 0.28, palmetto: 0.32, rosemary: 0.3, oak: 0.22, hickory: 0.18, pepper: 0.12, airpotato: 0.18, fence: 0.04,
};
/** Chance each burned invasive comes back from roots or bulbils. Cogon even likes fire. */
const RESPROUT: Partial<Record<InvasivePlantId, number>> = { cogon: 0.55, natal: 0.35, airpotato: 0.5, pepper: 0.3 };

export const tileIndex = (tx: number, ty: number): number => ty * MAP_W + tx;

// The zone map never changes, so classify it once.
let zoneCache: ZoneId[] | null = null;
function zoneGrid(): ZoneId[] {
  if (!zoneCache) {
    zoneCache = [];
    for (let ty = 0; ty < MAP_H; ty++) for (let tx = 0; tx < MAP_W; tx++) zoneCache.push(zoneAt(tx, ty));
  }
  return zoneCache;
}
export const zoneOf = (tx: number, ty: number): ZoneId => zoneGrid()[tileIndex(tx, ty)];

const zoneTileCache = new Map<ZoneId, number[]>();
/** Indices of the burnable (interior) tiles of a zone. */
export function zoneTileIndices(zone: ZoneId): number[] {
  let list = zoneTileCache.get(zone);
  if (!list) {
    list = [];
    for (let ty = 1; ty < MAP_H - 1; ty++) for (let tx = 1; tx < MAP_W - 1; tx++) if (zoneOf(tx, ty) === zone) list.push(tileIndex(tx, ty));
    zoneTileCache.set(zone, list);
  }
  return list;
}

/** A new scrub hasn't seen fire in a while; each patch remembers a different past fire. */
export function initialBurnDays(seed: number): number[] {
  // Sand and oak scrub start at least "ready", so fire's benefits are earned in play; the rosemary
  // bald keeps a few recently burned patches that show what "recovering" ground looks like.
  const range: Record<ZoneId, [number, number]> = { base: [0, 0], sand: [21, 38], oak: [26, 39], rosemary: [8, 30] };
  const out: number[] = [];
  for (let ty = 0; ty < MAP_H; ty++) {
    for (let tx = 0; tx < MAP_W; tx++) {
      const [lo, hi] = range[zoneOf(tx, ty)];
      const patch = hash2(Math.floor(tx / 5), Math.floor(ty / 5), seed & 0xffff);
      const age = Math.round(lo + patch * (hi - lo) + (hash2(tx, ty, 17) - 0.5) * 3);
      out.push(1 - Math.max(0, age));
    }
  }
  return out;
}

export function tileAge(s: GameState, tx: number, ty: number): number {
  return s.day - (s.burned[tileIndex(tx, ty)] ?? s.day);
}

export function fireState(age: number): FireState {
  return age < FIRE_RECOVER_DAYS ? 'recovering' : age < FIRE_READY_DAYS ? 'young' : age < FIRE_OVERDUE_DAYS ? 'ready' : 'overdue';
}

/** Typical time since fire around a tile (the "area" a player is looking at). */
export function areaAge(s: GameState, tx: number, ty: number, r = 1): number {
  const ages: number[] = [];
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const x = tx + dx, y = ty + dy;
      if (inBounds(x, y) && zoneOf(x, y) !== 'base') ages.push(tileAge(s, x, y));
    }
  }
  if (!ages.length) return 0;
  ages.sort((a, b) => a - b);
  return ages[Math.floor(ages.length / 2)];
}

/** Time since fire of the unburned ground around a flame: what this fire is about to meet. */
export function fuelAge(s: GameState, tx: number, ty: number, r = 2): number {
  const ages: number[] = [];
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const x = tx + dx, y = ty + dy;
      if (!inBounds(x, y) || zoneOf(x, y) === 'base') continue;
      const age = tileAge(s, x, y);
      if (age > 0) ages.push(age);
    }
  }
  if (!ages.length) return areaAge(s, tx, ty);
  ages.sort((a, b) => a - b);
  return ages[Math.floor(ages.length / 2)];
}

export function isBurning(s: GameState, tx: number, ty: number): boolean {
  return s.fires.some((f) => f.tx === tx && f.ty === ty);
}

export function isFirebreak(s: GameState, tx: number, ty: number): boolean {
  return s.firebreaks.some((b) => b.tx === tx && b.ty === ty && b.until >= s.day);
}

/** Lookups for one burst of fire work, so hot loops don't rescan the whole state. */
export interface FireIndex {
  things: Map<number, TileEntity[]>;
  burning: Set<number>;
  breaks: Set<number>;
}

export function fireIndex(s: GameState): FireIndex {
  const things = new Map<number, TileEntity[]>();
  for (const e of s.entities) {
    if (!isTileEntity(e)) continue;
    const i = tileIndex(e.tx, e.ty);
    const list = things.get(i);
    if (list) list.push(e);
    else things.set(i, [e]);
  }
  return {
    things,
    burning: new Set(s.fires.map((f) => tileIndex(f.tx, f.ty))),
    breaks: new Set(s.firebreaks.filter((b) => b.until >= s.day).map((b) => tileIndex(b.tx, b.ty))),
  };
}

function entityFuel(s: GameState, e: TileEntity): number {
  if (e.kind === 'burrow') return 0;
  const base = ENTITY_FUEL[e.species] ?? 0;
  // A resprouting stump or a seedling holds little to burn.
  if (e.kind === 'nativePlant' && ((e.burnedDay !== undefined && s.day - e.burnedDay < FIRE_RECOVER_DAYS) || (e.planted && s.day - e.plantedDay < 3))) return base * 0.3;
  return base;
}

/** 0 (nothing to burn) to about 1.2 (an overdue thicket). */
export function fuelAt(s: GameState, tx: number, ty: number, idx: FireIndex = fireIndex(s)): number {
  if (tx < 1 || ty < 1 || tx >= MAP_W - 1 || ty >= MAP_H - 1) return 0;
  const zone = zoneOf(tx, ty);
  const i = tileIndex(tx, ty);
  if (zone === 'base' || isStationTile(tx, ty) || idx.breaks.has(i)) return 0;
  const age = tileAge(s, tx, ty);
  let fuel = ZONE_FUEL[zone] * Math.max(0.04, Math.min(1.25, age / FUEL_FULL_DAYS)) * (isBareSand(tx, ty) ? 0.15 : 1);
  for (const e of idx.things.get(i) ?? []) fuel += entityFuel(s, e) * (age < FIRE_RECOVER_DAYS ? 0.3 : 1);
  return Math.min(1.2, fuel);
}

/** Chance per step that a flame at (x, y) catches the neighbour at (x+dx, y+dy). */
export function spreadChance(fuel: number, moisture: number, wind: { x: number; y: number }, windSpeed: number, dx: number, dy: number): number {
  const len = Math.hypot(dx, dy) || 1;
  const along = (dx * wind.x + dy * wind.y) / len;
  const diagonal = dx !== 0 && dy !== 0 ? 0.6 : 1;
  return Math.max(0, Math.min(0.92, FIRE_SPREAD * fuel * moisture * (1 + windSpeed * 1.3 * along) * diagonal));
}

const NEIGHBOURS = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]] as const;

/** What a tile's history makes of this flame. */
export function burnClass(age: number): 'renewed' | 'early' | 'harmed' {
  return age >= FIRE_READY_DAYS ? 'renewed' : age < FIRE_RECOVER_DAYS ? 'harmed' : 'early';
}

/** Apply fire to everything on a tile, record it in the report, and mark the ground as burned. */
export function burnTile(s: GameState, tx: number, ty: number, idx: FireIndex = fireIndex(s)): void {
  const i = tileIndex(tx, ty);
  const age = tileAge(s, tx, ty);
  const cls = burnClass(age);
  s.burned[i] = s.day;
  const r = s.fireToday;
  r.tiles++;
  r[cls]++;
  for (const e of idx.things.get(i) ?? []) {
    switch (e.kind) {
      case 'hazard':
        if (e.species === 'thicket') {
          removeEntity(s, e.id);
          r.thickets++;
        }
        break;
      case 'invasivePlant': {
        if (e.species === 'pepper' && --e.hp > 0) break;
        removeEntity(s, e.id);
        r.invasives++;
        const chance = RESPROUT[e.species] ?? 0;
        if (chance > 0) s.seedbank.push({ tx, ty, species: e.species, day: s.day + 1, chance });
        break;
      }
      case 'nativePlant': {
        const recovering = e.burnedDay !== undefined && s.day - e.burnedDay < FIRE_RECOVER_DAYS;
        const seedling = e.planted && s.day - e.plantedDay + (e.boost ?? 0) < 3;
        if (cls === 'harmed' || recovering || seedling) {
          removeEntity(s, e.id);
          r.lost++;
        } else if (e.species === 'rosemary') {
          // Florida rosemary is killed by fire, but its seeds sprout in the open sand that follows.
          removeEntity(s, e.id);
          r.resprouting++;
          s.seedbank.push({ tx, ty, species: 'rosemary', day: s.day + 2, chance: cls === 'renewed' ? 1 : 0.5 });
          s.seedbank.push({ tx: tx + 1, ty, species: 'rosemary', day: s.day + 2, chance: cls === 'renewed' ? 0.7 : 0.2 });
        } else {
          e.burnedDay = s.day;
          if (e.species === 'palmetto') e.bloomUntil = s.day + 8; // saw palmettos flower heavily after fire
          r.resprouting++;
        }
        break;
      }
      case 'burrow':
        break; // a cool refuge: tortoises, mice and snakes wait out the flames underground
    }
  }
}

/** Light a tile. Returns false when there is nothing there to burn. A lightning strike or torch
 * (`spark`) starts a hotter flame than one caught from a neighbour, so new fires rarely fizzle. */
export function ignite(s: GameState, tx: number, ty: number, idx: FireIndex = fireIndex(s), spark = true): boolean {
  const i = tileIndex(tx, ty);
  if (!inBounds(tx, ty) || idx.burning.has(i)) return false;
  const fuel = fuelAt(s, tx, ty, idx);
  if (fuel < 0.06) return false;
  burnTile(s, tx, ty, idx);
  s.fires.push({ tx, ty, heat: 1 + Math.round(fuel * 2.5) + (spark ? 3 : 0) });
  idx.burning.add(i);
  return true;
}

export interface FireStep {
  ignited: { tx: number; ty: number }[];
  out: { tx: number; ty: number }[];
}

/** One step of spread: each flame may catch its neighbours, then cools a little. */
export function fireTick(s: GameState, rng: Rng, moisture = fireMoisture(s.weather, s.day)): FireStep {
  const step: FireStep = { ignited: [], out: [] };
  if (s.fires.length === 0) return step;
  const idx = fireIndex(s);
  for (const f of [...s.fires]) {
    for (const [dx, dy] of NEIGHBOURS) {
      const nx = f.tx + dx, ny = f.ty + dy;
      if (idx.burning.has(tileIndex(nx, ny))) continue;
      const fuel = fuelAt(s, nx, ny, idx);
      if (fuel < 0.06) continue;
      if (rng() < spreadChance(fuel, moisture, s.weather.wind, s.weather.windSpeed, dx, dy) && ignite(s, nx, ny, idx, false)) {
        step.ignited.push({ tx: nx, ty: ny });
      }
    }
    f.heat--;
  }
  s.fires = s.fires.filter((f) => {
    if (f.heat > 0) return true;
    step.out.push({ tx: f.tx, ty: f.ty });
    return false;
  });
  return step;
}

/** Spray water on a flame. The soaked tile won't catch again today. */
export function douse(s: GameState, tx: number, ty: number): boolean {
  if (!isBurning(s, tx, ty) || s.water <= 0) return false;
  s.water--;
  s.fires = s.fires.filter((f) => f.tx !== tx || f.ty !== ty);
  s.firebreaks.push({ tx, ty, until: s.day });
  return true;
}

/** Rake fuel away from a tile so flames can't cross it for a few days. */
export function rake(s: GameState, tx: number, ty: number): boolean {
  if (!inBounds(tx, ty) || isBurning(s, tx, ty) || zoneOf(tx, ty) === 'base' || isFirebreak(s, tx, ty)) return false;
  s.firebreaks.push({ tx, ty, until: s.day + FIREBREAK_DAYS });
  return true;
}

/** Overnight, the damp air lets any remaining fire burn itself out. Returns how many steps it took. */
export function burnOut(s: GameState, rng: Rng, maxSteps = 160): number {
  let steps = 0;
  const night = fireMoisture(s.weather, s.day) * 0.55;
  while (s.fires.length > 0 && steps < maxSteps) {
    fireTick(s, rng, night);
    steps++;
  }
  s.fires = [];
  return steps;
}

/** Lightning favours tall things: trees and thickets more than open sand. */
export function lightningStrike(s: GameState, rng: Rng): { tx: number; ty: number; ignited: boolean } | null {
  if (s.weather.strikes <= 0) return null;
  s.weather.strikes--;
  const tall: Record<string, number> = { oak: 4, hickory: 4, thicket: 4, pepper: 3, palmetto: 2 };
  const targets: { tx: number; ty: number; w: number }[] = [];
  for (const e of s.entities) {
    if (!isTileEntity(e) || e.kind === 'burrow' || zoneOf(e.tx, e.ty) === 'base') continue;
    targets.push({ tx: e.tx, ty: e.ty, w: tall[e.species] ?? 1 });
  }
  let t: { tx: number; ty: number };
  const total = targets.reduce((sum, x) => sum + x.w, 0);
  if (targets.length === 0 || rng() < 0.3) {
    t = { tx: 2 + Math.floor(rng() * (MAP_W - 4)), ty: 2 + Math.floor(rng() * (MAP_H - 4)) };
  } else {
    let roll = rng() * total;
    t = targets[targets.length - 1];
    for (const x of targets) if ((roll -= x.w) < 0) { t = x; break; }
  }
  const fuel = fuelAt(s, t.tx, t.ty);
  const wet = s.weather.kind === 'hurricane' ? 0.4 : 1;
  const ignited = rng() < Math.min(0.9, 0.25 + fuel * 0.8) * wet && ignite(s, t.tx, t.ty);
  return { tx: t.tx, ty: t.ty, ignited };
}

/** Can a careful prescribed burn be lit here today? */
export function burnPrescription(s: GameState, tx: number, ty: number, calmWeather: boolean): 'ok' | 'young' | 'weather' {
  if (areaAge(s, tx, ty) < FIRE_READY_DAYS) return 'young';
  if (!calmWeather) return 'weather';
  return 'ok';
}

/** Fraction of a zone's ground in each fire state, and its typical time since fire. */
export function zoneFire(s: GameState, zone: ZoneId): { age: number; state: FireState; overdue: number; fresh: number; ready: number } {
  const tiles = zoneTileIndices(zone);
  if (tiles.length === 0) return { age: 0, state: 'recovering', overdue: 0, fresh: 0, ready: 0 };
  const ages = tiles.map((i) => s.day - (s.burned[i] ?? s.day)).sort((a, b) => a - b);
  const age = ages[Math.floor(ages.length / 2)];
  const frac = (pred: (a: number) => boolean) => ages.filter(pred).length / ages.length;
  return {
    age,
    state: fireState(age),
    overdue: frac((a) => a >= FIRE_OVERDUE_DAYS),
    fresh: frac((a) => a < FIRE_READY_DAYS),
    ready: frac((a) => a >= FIRE_READY_DAYS),
  };
}

/** Share of a zone overdue for fire (cheap enough to call every frame). */
export function overdueFraction(s: GameState, zone: ZoneId): number {
  const tiles = zoneTileIndices(zone);
  let n = 0;
  for (const i of tiles) if (s.day - (s.burned[i] ?? s.day) >= FIRE_OVERDUE_DAYS) n++;
  return tiles.length ? n / tiles.length : 0;
}

/** Without fire, overdue scrub slowly closes in: new thickets grow up beside old shrubs. */
export function overgrow(s: GameState, rng: Rng): HazardEntity[] {
  if (s.day < OVERGROWTH_GRACE_DAYS) return [];
  const grown: HazardEntity[] = [];
  for (const zone of ['oak', 'sand', 'rosemary'] as const) {
    const { overdue } = zoneFire(s, zone);
    if (overdue < 0.15 || rng() > 0.55 * overdue * (zone === 'rosemary' ? 0.5 : 1)) continue;
    const thickets = s.entities.filter((e) => e.kind === 'hazard' && e.species === 'thicket' && zoneOf(e.tx, e.ty) === zone).length;
    if (thickets >= 6) continue;
    const shrubs = s.entities.filter(
      (e): e is NativePlantEntity => e.kind === 'nativePlant' && zoneOf(e.tx, e.ty) === zone && tileAge(s, e.tx, e.ty) >= FIRE_OVERDUE_DAYS,
    );
    if (shrubs.length === 0) continue;
    const host = pick(rng, shrubs);
    for (let i = 0; i < 8; i++) {
      const [dx, dy] = pick(rng, NEIGHBOURS);
      const tx = host.tx + dx, ty = host.ty + dy;
      if (inBounds(tx, ty) && zoneOf(tx, ty) === zone && !tileOccupied(s, tx, ty)) {
        grown.push(addEntity<HazardEntity>(s, { kind: 'hazard', species: 'thicket', tx, ty, hp: HAZARDS.thicket.hp }));
        break;
      }
    }
  }
  return grown;
}

/** Morning sprouts from the seedbank: rosemary seedlings after a good burn, stubborn invasive roots. */
export function sproutSeedbank(s: GameState, rng: Rng, day: number): { natives: number; invasives: number } {
  const out = { natives: 0, invasives: 0 };
  const keep: Sprout[] = [];
  for (const sp of s.seedbank) {
    if (sp.day > day) {
      keep.push(sp);
      continue;
    }
    if (rng() >= sp.chance || !inBounds(sp.tx, sp.ty) || zoneOf(sp.tx, sp.ty) === 'base' || tileOccupied(s, sp.tx, sp.ty)) continue;
    if (sp.species === 'rosemary') {
      addEntity<NativePlantEntity>(s, { kind: 'nativePlant', species: 'rosemary', tx: sp.tx, ty: sp.ty, planted: true, plantedDay: day, lastSeedDay: 0, rescued: true });
      out.natives++;
    } else {
      addEntity(s, { kind: 'invasivePlant', species: sp.species, tx: sp.tx, ty: sp.ty, hp: sp.species === 'pepper' ? 2 : 1 });
      out.invasives++;
    }
  }
  s.seedbank = keep;
  s.firebreaks = s.firebreaks.filter((b) => b.until >= day);
  return out;
}
