// The whole game is one plain, JSON-serialisable state object. Systems mutate it; scenes render it.
import { BATTERY_START, CHOKE_RADIUS, MAP_H, MAP_W, TILE, TRAY_COUNT } from '../config';
import { BASE_CENTER, ROBOT_SPAWN, ZoneId, inBounds, isStationTile, tileCenter, zoneAt } from '../data/map';
import {
  HAZARDS,
  HazardId,
  INVASIVE_PLANTS,
  InvasiveAnimalId,
  InvasivePlantId,
  NativeAnimalId,
  NativePlantId,
  SpeciesId,
} from '../data/species';
import { Rng, mulberry32, pick, randInt } from './rng';

export const STATE_VERSION = 2;

export interface InvasivePlantEntity {
  id: number;
  kind: 'invasivePlant';
  species: InvasivePlantId;
  tx: number;
  ty: number;
  hp: number;
}

export interface NativePlantEntity {
  id: number;
  kind: 'nativePlant';
  species: NativePlantId;
  tx: number;
  ty: number;
  planted: boolean;
  plantedDay: number;
  lastSeedDay: number;
  lastSprigDay?: number;
  /** Set the first time the plant is free of nearby invasives. */
  rescued: boolean;
}

export interface HazardEntity {
  id: number;
  kind: 'hazard';
  species: HazardId;
  tx: number;
  ty: number;
  hp: number;
}

export interface BurrowEntity {
  id: number;
  kind: 'burrow';
  tx: number;
  ty: number;
}

export interface InvasiveAnimalEntity {
  id: number;
  kind: 'invasiveAnimal';
  species: InvasiveAnimalId;
  x: number;
  y: number;
  home: ZoneId;
}

export interface NativeAnimalEntity {
  id: number;
  kind: 'nativeAnimal';
  species: NativeAnimalId;
  x: number;
  y: number;
  home: ZoneId;
}

export type TileEntity = InvasivePlantEntity | NativePlantEntity | HazardEntity | BurrowEntity;
export type AnimalEntity = InvasiveAnimalEntity | NativeAnimalEntity;
export type Entity = TileEntity | AnimalEntity;

export interface TrayState {
  seed: NativePlantId | null;
  growth: number;
  watered: boolean;
}

export interface CrateContents {
  species: InvasiveAnimalId;
  name?: string;
}

/** Wordless postcards: rendered as pictures from these fields. */
export interface Postcard {
  day: number;
  kind: 'adopted' | 'relocated' | 'anoles';
  species: InvasiveAnimalId;
  name?: string;
  count?: number;
}

/** A first-sighting "photo" pinned to the corkboard. */
export interface Photo {
  species: NativeAnimalId;
  day: number;
}

export interface PopulationRecord {
  day: number;
  pop: Partial<Record<NativeAnimalId, number>>;
}

export interface GameState {
  version: number;
  seed: number;
  day: number;
  nextId: number;
  battery: number;
  batteryMax: number;
  /** Battery upgrades bought. */
  upgrades: number;
  hydroUpgrades: number;
  vaseUpgrades: number;
  homeLevel: number;
  parts: number;
  /** Trash + bulbils being carried. */
  bag: number;
  /** Anoles in the jar. */
  jar: number;
  crate: CrateContents | null;
  seeds: Record<NativePlantId, number>;
  seedlings: Record<NativePlantId, number>;
  /** Cut sprigs waiting to be arranged in a vase. */
  sprigs: Record<NativePlantId, number>;
  /** Sprigs arranged in each vase at home (max 3 each). */
  vases: NativePlantId[][];
  entities: Entity[];
  trays: TrayState[];
  scanned: SpeciesId[];
  returned: NativeAnimalId[];
  /** Animals waiting on the relocation pad for overnight pickup. */
  pad: CrateContents[];
  /** Number of anoles waiting on the pad. */
  padAnoles: number;
  postcards: Postcard[];
  photos: Photo[];
  populations: Partial<Record<NativeAnimalId, number>>;
  history: PopulationRecord[];
  sightings: Partial<Record<NativeAnimalId, number>>;
  /** Species already counted as sighted today (one sighting per species per day). */
  sightedToday: NativeAnimalId[];
  robot: { x: number; y: number };
  location: 'outside' | 'home';
  introSeen: boolean;
  catNameIndex: number;
  stats: {
    invasivesRemoved: number;
    trashCollected: number;
    planted: number;
    relocated: number;
  };
  won: boolean;
}

export const NATIVE_PLANTS: NativePlantId[] = ['palmetto', 'rosemary', 'oak', 'hickory'];

export function emptyPlantRecord(): Record<NativePlantId, number> {
  return { palmetto: 0, rosemary: 0, oak: 0, hickory: 0 };
}

export function isTileEntity(e: Entity): e is TileEntity {
  return e.kind !== 'invasiveAnimal' && e.kind !== 'nativeAnimal';
}

export function isAnimal(e: Entity): e is AnimalEntity {
  return e.kind === 'invasiveAnimal' || e.kind === 'nativeAnimal';
}

export function entityPos(e: Entity): { x: number; y: number } {
  return isTileEntity(e) ? tileCenter(e.tx, e.ty) : { x: e.x, y: e.y };
}

export function entityZone(e: Entity): ZoneId {
  return isTileEntity(e) ? zoneAt(e.tx, e.ty) : e.home;
}

export function tileOccupied(state: GameState, tx: number, ty: number, radius = 0): boolean {
  if (isStationTile(tx, ty)) return true;
  return state.entities.some(
    (e) => isTileEntity(e) && Math.abs(e.tx - tx) <= radius && Math.abs(e.ty - ty) <= radius,
  );
}

/** Omit that distributes over a union, so object literals can match any entity shape. */
export type NewEntity<T> = T extends unknown ? Omit<T, 'id'> : never;

export function addEntity<T extends Entity = Entity>(state: GameState, e: NewEntity<T>): T {
  const full = { ...e, id: state.nextId++ } as unknown as T;
  state.entities.push(full);
  return full;
}

export function removeEntity(state: GameState, id: number): void {
  state.entities = state.entities.filter((e) => e.id !== id);
}

export function findEntity(state: GameState, id: number): Entity | undefined {
  return state.entities.find((e) => e.id === id);
}

// --- New game layout -----------------------------------------------------------

interface ZoneRecipe {
  natives: Partial<Record<NativePlantId, number>>;
  invasives: Partial<Record<InvasivePlantId, number>>;
  hazards: Partial<Record<HazardId, number>>;
  animals: Partial<Record<InvasiveAnimalId, number>>;
}

const RECIPES: Record<Exclude<ZoneId, 'base'>, ZoneRecipe> = {
  sand: {
    natives: { palmetto: 4, hickory: 2, oak: 1 },
    invasives: { cogon: 12, natal: 5 },
    hazards: { tire: 3, bottle: 3 },
    animals: { tegu: 1, cat: 1, anole: 2 },
  },
  oak: {
    natives: { oak: 4, palmetto: 2 },
    invasives: { pepper: 5, airpotato: 4, cogon: 3 },
    hazards: { thicket: 4, bottle: 2, tire: 1 },
    animals: { cat: 1, iguana: 1, anole: 2 },
  },
  rosemary: {
    natives: { rosemary: 4, hickory: 1 },
    invasives: { natal: 6, cogon: 4 },
    hazards: { thicket: 2, bottle: 3, tire: 1 },
    animals: { tegu: 1, anole: 2 },
  },
};

function zoneTiles(zone: ZoneId): { tx: number; ty: number }[] {
  const out: { tx: number; ty: number }[] = [];
  for (let ty = 1; ty < MAP_H - 1; ty++) {
    for (let tx = 1; tx < MAP_W - 1; tx++) {
      if (zoneAt(tx, ty) === zone) out.push({ tx, ty });
    }
  }
  return out;
}

function freeTile(state: GameState, rng: Rng, tiles: { tx: number; ty: number }[], radius = 1) {
  for (let i = 0; i < 200; i++) {
    const t = pick(rng, tiles);
    if (!tileOccupied(state, t.tx, t.ty, radius)) return t;
  }
  return null;
}

function placeInvasive(state: GameState, species: InvasivePlantId, tx: number, ty: number) {
  addEntity<InvasivePlantEntity>(state, { kind: 'invasivePlant', species, tx, ty, hp: INVASIVE_PLANTS[species].hp });
}

/** Place an invasive somewhere touching (tx, ty) so the native there starts out choked. */
function chokeAround(state: GameState, rng: Rng, tx: number, ty: number, species: InvasivePlantId) {
  for (let i = 0; i < 12; i++) {
    const nx = tx + randInt(rng, -1, 1);
    const ny = ty + randInt(rng, -1, 1);
    if (inBounds(nx, ny) && zoneAt(nx, ny) !== 'base' && !tileOccupied(state, nx, ny)) {
      placeInvasive(state, species, nx, ny);
      return;
    }
  }
}

export function newGame(seed = Date.now() & 0xffffffff): GameState {
  const rng = mulberry32(seed);
  const state: GameState = {
    version: STATE_VERSION,
    seed,
    day: 1,
    nextId: 1,
    battery: BATTERY_START,
    batteryMax: BATTERY_START,
    upgrades: 0,
    hydroUpgrades: 0,
    vaseUpgrades: 0,
    homeLevel: 0,
    parts: 0,
    bag: 0,
    jar: 0,
    crate: null,
    seeds: emptyPlantRecord(),
    seedlings: emptyPlantRecord(),
    sprigs: emptyPlantRecord(),
    vases: [[]],
    entities: [],
    trays: Array.from({ length: TRAY_COUNT }, () => ({ seed: null, growth: 0, watered: false })),
    scanned: [],
    returned: [],
    pad: [],
    padAnoles: 0,
    postcards: [],
    photos: [],
    populations: {},
    history: [],
    sightings: {},
    sightedToday: [],
    robot: { ...ROBOT_SPAWN },
    location: 'outside',
    introSeen: false,
    catNameIndex: 0,
    stats: { invasivesRemoved: 0, trashCollected: 0, planted: 0, relocated: 0 },
    won: false,
  };

  // A tiny tutorial cluster just outside base: a choked rosemary, some cogon, a bottle.
  const tut = { tx: BASE_CENTER.tx - 2, ty: BASE_CENTER.ty - 7 };
  addEntity<NativePlantEntity>(state, {
    kind: 'nativePlant',
    species: 'rosemary',
    tx: tut.tx,
    ty: tut.ty,
    planted: false,
    plantedDay: 0,
    lastSeedDay: 0,
    rescued: false,
  });
  placeInvasive(state, 'cogon', tut.tx + 1, tut.ty);
  placeInvasive(state, 'cogon', tut.tx, tut.ty + 1);
  addEntity<HazardEntity>(state, { kind: 'hazard', species: 'bottle', tx: tut.tx + 3, ty: tut.ty - 1, hp: 1 });

  // An old fence line cutting through the sand scrub — tortoises won't come back until it's gone.
  for (let i = 0; i < 6; i++) {
    const tx = 15;
    const ty = 16 + i;
    if (zoneAt(tx, ty) === 'sand' && !tileOccupied(state, tx, ty)) {
      addEntity<HazardEntity>(state, { kind: 'hazard', species: 'fence', tx, ty, hp: HAZARDS.fence.hp });
    }
  }

  for (const [zone, recipe] of Object.entries(RECIPES) as [Exclude<ZoneId, 'base'>, ZoneRecipe][]) {
    const tiles = zoneTiles(zone);

    for (const [species, count] of Object.entries(recipe.natives) as [NativePlantId, number][]) {
      for (let i = 0; i < count; i++) {
        const t = freeTile(state, rng, tiles, 2);
        if (!t) continue;
        addEntity<NativePlantEntity>(state, {
          kind: 'nativePlant',
          species,
          tx: t.tx,
          ty: t.ty,
          planted: false,
          plantedDay: 0,
          lastSeedDay: 0,
          rescued: false,
        });
        // Most natives start smothered by an invasive neighbour.
        if (rng() < 0.8) {
          const pool = Object.keys(recipe.invasives) as InvasivePlantId[];
          chokeAround(state, rng, t.tx, t.ty, pick(rng, pool));
        }
      }
    }

    for (const [species, count] of Object.entries(recipe.invasives) as [InvasivePlantId, number][]) {
      let placed = 0;
      while (placed < count) {
        // Invasives grow in little clumps.
        const t = freeTile(state, rng, tiles, 1);
        if (!t) break;
        placeInvasive(state, species, t.tx, t.ty);
        placed++;
        const clump = species === 'pepper' ? 0 : randInt(rng, 0, 2);
        for (let c = 0; c < clump && placed < count; c++) {
          const nx = t.tx + randInt(rng, -1, 1);
          const ny = t.ty + randInt(rng, -1, 1);
          if (inBounds(nx, ny) && zoneAt(nx, ny) === zone && !tileOccupied(state, nx, ny)) {
            placeInvasive(state, species, nx, ny);
            placed++;
          }
        }
      }
    }

    for (const [species, count] of Object.entries(recipe.hazards) as [HazardId, number][]) {
      for (let i = 0; i < count; i++) {
        const t = freeTile(state, rng, tiles, 1);
        if (t) addEntity<HazardEntity>(state, { kind: 'hazard', species, tx: t.tx, ty: t.ty, hp: HAZARDS[species].hp });
      }
    }

    for (const [species, count] of Object.entries(recipe.animals) as [InvasiveAnimalId, number][]) {
      for (let i = 0; i < count; i++) {
        const t = freeTile(state, rng, tiles, 0);
        if (!t) continue;
        const p = tileCenter(t.tx, t.ty);
        addEntity<InvasiveAnimalEntity>(state, { kind: 'invasiveAnimal', species, x: p.x, y: p.y, home: zone });
      }
    }
  }

  refreshRescues(state);
  return state;
}

// --- Queries used by several systems -------------------------------------------

export function isChoked(state: GameState, plant: NativePlantEntity, radius = CHOKE_RADIUS): boolean {
  return state.entities.some(
    (e) =>
      e.kind === 'invasivePlant' && Math.abs(e.tx - plant.tx) <= radius && Math.abs(e.ty - plant.ty) <= radius,
  );
}

/** Marks natives that are now free of invasives as rescued; returns the newly rescued ones. */
export function refreshRescues(state: GameState, radius = CHOKE_RADIUS): NativePlantEntity[] {
  const fresh: NativePlantEntity[] = [];
  for (const e of state.entities) {
    if (e.kind === 'nativePlant' && !e.rescued && !isChoked(state, e, radius)) {
      e.rescued = true;
      // Plants that start the game healthy aren't "rescued" by the player, so don't announce them.
      if (state.day > 1 || state.stats.invasivesRemoved > 0) fresh.push(e);
    }
  }
  return fresh;
}

export function countWhere(state: GameState, pred: (e: Entity) => boolean): number {
  let n = 0;
  for (const e of state.entities) if (pred(e)) n++;
  return n;
}

export function pxToTile(x: number, y: number): { tx: number; ty: number } {
  return { tx: Math.floor(x / TILE), ty: Math.floor(y / TILE) };
}
