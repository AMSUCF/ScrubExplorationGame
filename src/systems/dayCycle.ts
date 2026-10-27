// The night tick: everything that happens while the robot sleeps on its charging dock.
import { GROW_NIGHTS } from '../config';
import { NativeAnimalId, speciesName } from '../data/species';
import { recharge } from './battery';
import { RETURN_CONDITIONS, burrowCount, digBurrow, spawnNativeAnimal, spreadCogon, zoneHealth } from './habitat';
import { growNight } from './nursery';
import { mulberry32 } from './rng';
import { GameState, Postcard, refreshRescues } from './state';

export interface NightSummary {
  day: number;
  lines: string[];
  postcards: Postcard[];
  returned: NativeAnimalId[];
  spread: number;
  wonTonight: boolean;
}

const RETURN_LINE: Record<NativeAnimalId, string> = {
  tortoise: 'A gopher tortoise wandered in and dug a burrow in the Sand Scrub!',
  mouse: 'A Florida mouse moved into the tortoise burrow.',
  jay: 'A family of Florida scrub-jays is hopping through the Oak Scrub!',
  indigo: 'A shiny eastern indigo snake is sunning near the burrows.',
};

export function nightTick(state: GameState): NightSummary {
  const rng = mulberry32(state.seed ^ Math.imul(state.day, 2654435761));
  const lines: string[] = [];
  const postcards: Postcard[] = [];
  const nextDay = state.day + 1;

  // 1. Pickups from the relocation pad.
  for (const animal of state.pad) {
    state.stats.relocated++;
    if (animal.species === 'cat') {
      postcards.push({
        day: nextDay,
        title: `${animal.name} was adopted!`,
        body: `${animal.name} now naps on a sunny windowsill with a new family — and the scrub birds can nest in peace.`,
      });
    } else {
      postcards.push({
        day: nextDay,
        title: `Thank you from the wildlife team`,
        body: `The ${speciesName(animal.species).toLowerCase()} you crated has been taken out of the scrub by wildlife officers.`,
      });
    }
  }
  if (state.padAnoles > 0) {
    state.stats.relocated += state.padAnoles;
    postcards.push({
      day: nextDay,
      title: 'Anoles picked up',
      body: `${state.padAnoles} brown anole${state.padAnoles > 1 ? 's' : ''} went to a university lizard lab. Native green anoles can come back down from the treetops!`,
    });
  }
  state.pad = [];
  state.padAnoles = 0;

  // 2. Nursery growth.
  const unwatered = state.trays.filter((t) => t.seed && !t.watered && t.growth < GROW_NIGHTS).length;
  const { grew, ready } = growNight(state);
  if (ready > 0) lines.push(`${ready} seedling${ready > 1 ? 's are' : ' is'} ready to pot up at the nursery.`);
  else if (grew > 0) lines.push(`Your watered seeds sprouted overnight.`);
  if (unwatered > 0) lines.push(`${unwatered} tray${unwatered > 1 ? 's' : ''} didn't grow — remember to water each day.`);

  // 3. Invasives creep.
  const spread = spreadCogon(state, rng);
  if (spread > 0) lines.push(`Cogon grass crept into ${spread} new spot${spread > 1 ? 's' : ''} overnight.`);
  refreshRescues(state);

  // 4. Wildlife: tortoises dig more burrows, and new visitors may arrive.
  if (state.returned.includes('tortoise') && burrowCount(state) < 3 && zoneHealth(state, 'sand') >= 60) {
    if (digBurrow(state, rng)) lines.push('The gopher tortoise dug another burrow.');
  }
  const returned: NativeAnimalId[] = [];
  for (const cond of RETURN_CONDITIONS) {
    if (state.returned.includes(cond.species) || !cond.met(state)) continue;
    state.returned.push(cond.species);
    returned.push(cond.species);
    if (cond.species === 'tortoise') digBurrow(state, rng);
    spawnNativeAnimal(state, rng, cond.species);
    lines.push(RETURN_LINE[cond.species]);
  }

  let wonTonight = false;
  if (!state.won && state.returned.length === RETURN_CONDITIONS.length) {
    state.won = true;
    wonTonight = true;
  }

  state.day = nextDay;
  recharge(state);
  state.postcards.push(...postcards);
  if (lines.length === 0 && postcards.length === 0) lines.push('A quiet night in the scrub. Crickets sang.');
  return { day: nextDay, lines, postcards, returned, spread, wonTonight };
}
