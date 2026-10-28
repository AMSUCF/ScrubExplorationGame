// Wildlife populations: what each species needs, how many the habitat can hold, and nightly change.
// The same needs drive first arrival, growth, gentle decline, and the animals' thought bubbles.
import { ZoneId } from '../data/map';
import { NativeAnimalId } from '../data/species';
import { ANIMAL_HOME, JAY_OAKS, burrowCount, digBurrow, healthyOaks, spawnNativeAnimal, zoneHealth } from './habitat';
import { zoneFire } from './fire';
import { Rng } from './rng';
import { GameState, countWhere, entityZone, removeEntity } from './state';

export const NATIVE_ANIMALS: NativeAnimalId[] = ['tortoise', 'mouse', 'indigo', 'jay'];
/** Burrow-dwellers are checked before the tortoise so they arrive a night after the first burrow. */
const UPDATE_ORDER: NativeAnimalId[] = ['mouse', 'indigo', 'tortoise', 'jay'];

/** At most this many of each species wander the map, whatever the population. */
export const DISPLAY_CAP = 5;
export const MAX_BURROWS = 8;

export interface Need {
  /** Texture key drawn in the thought bubble (the thing the animal is worried about or wants). */
  icon: string;
  met: boolean;
  /** Needed for the species to arrive at all (others only gate growth). */
  forArrival: boolean;
  label: string;
}

function count(s: GameState, pred: Parameters<typeof countWhere>[1]) {
  return countWhere(s, pred);
}

/** The most common problem in a zone, so a bubble can show exactly what to clear. */
function worstIn(s: GameState, zone: ZoneId): string {
  const tally = new Map<string, number>();
  for (const e of s.entities) {
    if (entityZone(e) !== zone) continue;
    if (e.kind === 'invasivePlant' || e.kind === 'hazard' || e.kind === 'invasiveAnimal') {
      tally.set(e.species, (tally.get(e.species) ?? 0) + 1);
    }
  }
  let best = 'cogon';
  let n = 0;
  for (const [k, v] of tally) {
    if (v > n) {
      best = k;
      n = v;
    }
  }
  return best;
}

const has = (s: GameState, species: string, zone?: ZoneId) =>
  count(s, (e) => e.kind !== 'burrow' && e.species === species && (!zone || entityZone(e) === zone)) > 0;

export function speciesNeeds(s: GameState, species: NativeAnimalId): Need[] {
  const tortoiseHere = s.returned.includes('tortoise');
  switch (species) {
    case 'tortoise':
      return [
        { icon: 'fence', met: !has(s, 'fence', 'sand'), forArrival: true, label: 'Clear the old fences in Sand Scrub' },
        { icon: worstIn(s, 'sand'), met: zoneHealth(s, 'sand') >= 65, forArrival: true, label: `Sand Scrub: ${zoneHealth(s, 'sand')} / 65% restored` },
        { icon: 'tegu', met: !has(s, 'tegu'), forArrival: false, label: 'Safely relocate the tegus' },
      ];
    case 'mouse':
      return [
        { icon: 'burrow', met: tortoiseHere && burrowCount(s) >= 1, forArrival: true, label: 'Welcome a tortoise and its first burrow' },
        { icon: 'cat', met: !has(s, 'cat'), forArrival: false, label: 'Help the cats find safe indoor homes' },
      ];
    case 'indigo':
      return [
        { icon: 'burrow', met: tortoiseHere && burrowCount(s) >= 2, forArrival: true, label: `Tortoise burrows: ${burrowCount(s)} / 2` },
        { icon: 'tegu', met: !has(s, 'tegu'), forArrival: true, label: 'Safely relocate the tegus' },
      ];
    case 'jay':
      return [
        { icon: worstIn(s, 'oak'), met: zoneHealth(s, 'oak') >= 60, forArrival: true, label: `Oak Scrub: ${zoneHealth(s, 'oak')} / 60% restored` },
        { icon: 'oak', met: healthyOaks(s, 'oak') >= JAY_OAKS, forArrival: true, label: `Healthy scrub oaks: ${healthyOaks(s, 'oak')} / ${JAY_OAKS}` },
        { icon: 'thicket', met: !has(s, 'thicket', 'oak'), forArrival: true, label: 'Open up the overgrown oak thickets' },
        { icon: 'cat', met: !has(s, 'cat'), forArrival: true, label: 'Help the cats find safe indoor homes' },
      ];
  }
}

export function canArrive(s: GameState, species: NativeAnimalId): boolean {
  return speciesNeeds(s, species).every((n) => !n.forArrival || n.met);
}

/** Unmet needs, one per icon (two needs can point at the same culprit). */
export function unmetNeeds(s: GameState, species: NativeAnimalId): Need[] {
  const seen = new Set<string>();
  return speciesNeeds(s, species).filter((n) => !n.met && !seen.has(n.icon) && seen.add(n.icon));
}

/** How many of a species the restored habitat can support right now. */
export function capacity(s: GameState, species: NativeAnimalId): number {
  switch (species) {
    case 'tortoise':
      // Freshly burned, open sand is tortoise heaven: new shoots and room to dig.
      return Math.min(7, 1 + Math.floor(Math.max(0, zoneHealth(s, 'sand') - 65) / 7) + (zoneFire(s, 'sand').fresh >= 0.2 ? 1 : 0));
    case 'mouse':
      return Math.min(8, burrowCount(s) * 2);
    case 'indigo':
      return Math.min(3, Math.max(1, Math.floor(burrowCount(s) / 2)));
    case 'jay':
      // Scrub-jays favour oaks kept low by recent fire.
      return Math.min(6, Math.max(1, Math.floor(healthyOaks(s, 'oak') / 3)) + (zoneFire(s, 'oak').fresh >= 0.2 ? 1 : 0));
  }
}

export type PopChange = { species: NativeAnimalId; from: number; to: number; arrived: boolean };

/**
 * Nightly wildlife update. Arrival order matters: mouse/indigo are checked before the tortoise so
 * they can only show up a night after the first burrow exists.
 */
export function updatePopulations(s: GameState, rng: Rng): PopChange[] {
  const changes: PopChange[] = [];

  // Tortoises dig burrows for their growing family.
  const tortoises = s.populations.tortoise ?? 0;
  if (tortoises > 0 && burrowCount(s) < Math.min(MAX_BURROWS, tortoises + 1)) digBurrow(s, rng);

  for (const species of UPDATE_ORDER) {
    const from = s.populations[species] ?? 0;
    let to = from;
    let arrived = false;
    if (from === 0) {
      if (canArrive(s, species)) {
        to = 1;
        arrived = true;
        s.returned.push(species);
        if (species === 'tortoise') digBurrow(s, rng);
      }
    } else if (unmetNeeds(s, species).length > 0) {
      to = Math.max(1, from - 1);
    } else if (from < capacity(s, species)) {
      to = from + 1;
    }
    if (to !== from) {
      s.populations[species] = to;
      changes.push({ species, from, to, arrived });
    }
  }

  syncAnimalSprites(s, rng);
  s.history.push({ day: s.day, pop: { ...s.populations } });
  if (s.history.length > 60) s.history.shift();
  return changes;
}

/** Make the wandering animals on the map match the population counts. */
export function syncAnimalSprites(s: GameState, rng: Rng): void {
  for (const species of NATIVE_ANIMALS) {
    const want = Math.min(DISPLAY_CAP, s.populations[species] ?? 0);
    const have = s.entities.filter((e) => e.kind === 'nativeAnimal' && e.species === species);
    for (let i = have.length; i < want; i++) spawnNativeAnimal(s, rng, species);
    for (let i = want; i < have.length; i++) removeEntity(s, have[i].id);
  }
}

/** Log one sighting per species per day. Returns true the very first time (a new photo). */
export function recordSighting(s: GameState, species: NativeAnimalId): { counted: boolean; firstEver: boolean } {
  if (s.sightedToday.includes(species)) return { counted: false, firstEver: false };
  s.sightedToday.push(species);
  s.sightings[species] = (s.sightings[species] ?? 0) + 1;
  const firstEver = !s.photos.some((p) => p.species === species);
  if (firstEver) s.photos.push({ species, day: s.day });
  return { counted: true, firstEver };
}

export function trend(s: GameState, species: NativeAnimalId): -1 | 0 | 1 {
  const h = s.history;
  if (h.length < 2) return 0;
  const a = h[h.length - 2].pop[species] ?? 0;
  const b = h[h.length - 1].pop[species] ?? 0;
  return b > a ? 1 : b < a ? -1 : 0;
}

export { ANIMAL_HOME };
