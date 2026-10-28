// The night tick: everything that happens while the robot sleeps in its charging cradle.
// Returns a wordless summary that the morning card draws as pictures.
import { GROW_NIGHTS } from '../config';
import { NativeAnimalId } from '../data/species';
import { recharge } from './battery';
import { spreadCogon } from './habitat';
import { growNight } from './nursery';
import { PopChange, updatePopulations } from './population';
import { mulberry32 } from './rng';
import { GameState, Postcard, refreshRescues } from './state';

export interface NightSummary {
  day: number;
  /** Trays that became ready to pot up. */
  ready: number;
  /** Trays that grew a stage. */
  grew: number;
  /** Sown trays that didn't grow because nobody watered them. */
  unwatered: number;
  /** New cogon patches. */
  spread: number;
  postcards: Postcard[];
  pops: PopChange[];
  arrived: NativeAnimalId[];
  wonTonight: boolean;
}

export function nightTick(state: GameState): NightSummary {
  const rng = mulberry32(state.seed ^ Math.imul(state.day, 2654435761));
  const nextDay = state.day + 1;
  const postcards: Postcard[] = [];

  // 1. Pickups from the relocation pad.
  for (const animal of state.pad) {
    state.stats.relocated++;
    postcards.push({
      day: nextDay,
      kind: animal.species === 'cat' ? 'adopted' : 'relocated',
      species: animal.species,
      name: animal.name,
    });
  }
  if (state.padAnoles > 0) {
    state.stats.relocated += state.padAnoles;
    postcards.push({ day: nextDay, kind: 'anoles', species: 'anole', count: state.padAnoles });
  }
  state.pad = [];
  state.padAnoles = 0;

  // 2. Hydroponics.
  const unwatered = state.trays.filter((t) => t.seed && !t.watered && t.growth < GROW_NIGHTS).length;
  const { grew, ready } = growNight(state);

  // 3. Invasives creep.
  const spread = spreadCogon(state, rng);
  refreshRescues(state);

  // 4. Wildlife.
  const pops = updatePopulations(state, rng);
  const arrived = pops.filter((p) => p.arrived).map((p) => p.species);

  let wonTonight = false;
  if (!state.won && state.returned.length === 4) {
    state.won = true;
    wonTonight = true;
  }

  state.day = nextDay;
  state.sightedToday = [];
  recharge(state);
  state.postcards.push(...postcards);
  return { day: nextDay, ready, grew, unwatered, spread, postcards, pops, arrived, wonTonight };
}
