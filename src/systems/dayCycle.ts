// The night tick: everything that happens while the robot sleeps in its charging cradle.
// Wildlife responds to the scrub as the robot left it; then, before dawn, the world moves on:
// fires burn out, seeds sprout, invaders creep in from the edges, and a new day's weather rolls in.
import { GROW_NIGHTS } from '../config';
import { NativeAnimalId, SpeciesId } from '../data/species';
import { recharge } from './battery';
import { Season, calendar, isSeasonStart } from './calendar';
import { FireReport, burnOut, emptyFireReport, overgrow, sproutSeedbank } from './fire';
import { spreadCogon } from './habitat';
import { Arrival, edgeIncursions } from './incursion';
import { growNight } from './nursery';
import { PopChange, updatePopulations } from './population';
import { LevelUp, credit } from './progress';
import { mulberry32 } from './rng';
import { GameState, Postcard, refreshRescues } from './state';
import { DailyTask, planTasks } from './tasks';
import { Weather, WeatherKind, isRainy, rollWeather } from './weather';

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
  /** Today's weather, and a peek at tomorrow's. */
  weather: Weather;
  forecast: WeatherKind;
  /** Set on the first morning of a season. */
  season: Season | null;
  /** Newcomers from beyond the edge. */
  arrivals: Arrival[];
  /** Yesterday's fires, if anything burned. */
  fire: FireReport | null;
  /** Seedlings and stubborn roots that sprouted from the seedbank. */
  sprouts: { natives: number; invasives: number };
  /** New thickets in scrub that is overdue for fire. */
  thickets: number;
  /** Planted natives that grew faster thanks to rain. */
  soaked: number;
  levelUps: LevelUp[];
  tasks: DailyTask[];
  /** Forces of the scrub met for the first time, added to the field guide. */
  discovered: SpeciesId[];
}

export function nightTick(state: GameState): NightSummary {
  const rng = mulberry32(state.seed ^ Math.imul(state.day, 2654435761));
  const nextDay = state.day + 1;
  const postcards: Postcard[] = [];
  const levelUps: LevelUp[] = [];

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

  // 3. Any fire still burning settles down in the damp night air.
  burnOut(state, rng);
  const fire = state.fireToday.tiles > 0 ? { ...state.fireToday } : null;
  if (fire) {
    state.stats.burned = (state.stats.burned ?? 0) + fire.renewed;
    const xp = Math.max(0, Math.min(25, Math.floor(fire.renewed / 3) - fire.lost * 2));
    if (xp > 0) levelUps.push(...credit(state, 'renew', 1, xp).levelUps);
  }
  refreshRescues(state);

  // 4. Wildlife responds to the scrub as the robot left it.
  const pops = updatePopulations(state, rng);
  const arrived = pops.filter((p) => p.arrived).map((p) => p.species);
  for (const p of pops) {
    if (p.arrived) levelUps.push(...credit(state, 'arrival').levelUps);
    else if (p.to > p.from) levelUps.push(...credit(state, 'growth').levelUps);
  }

  let wonTonight = false;
  if (!state.won && state.returned.length === 4) {
    state.won = true;
    wonTonight = true;
  }

  // 5. Rain soaks young plantings so they grow up a little faster.
  let soaked = 0;
  if (isRainy(state.weather)) {
    for (const e of state.entities) {
      if (e.kind === 'nativePlant' && e.planted && state.day - e.plantedDay + (e.boost ?? 0) < 5) {
        e.boost = (e.boost ?? 0) + 1;
        soaked++;
      }
    }
  }

  // 6. Before dawn: new sprouts, creeping cogon, arrivals from the edges, and overgrowth.
  state.day = nextDay;
  const sprouts = sproutSeedbank(state, rng, nextDay);
  const season = calendar(nextDay).season;
  const breeze = state.weather.kind === 'breezy' || state.weather.kind === 'hurricane' ? 1.5 : 1;
  const spread = spreadCogon(state, rng, breeze * (season === 'summer' ? 1.3 : season === 'winter' ? 0.5 : 1));
  const arrivals = edgeIncursions(state, rng);
  const thickets = overgrow(state, rng).length;
  refreshRescues(state);

  // 7. A new morning.
  state.weather = rollWeather(state.seed, nextDay);
  state.fireToday = emptyFireReport();
  state.water = state.waterMax;
  state.sightedToday = [];
  recharge(state);
  state.postcards.push(...postcards);
  state.tasks = planTasks(state);

  // The guide writes up storms and the edge the first time the robot meets them.
  const discovered: SpeciesId[] = [];
  const learn = (id: SpeciesId, when: boolean) => when && !state.scanned.includes(id) && (state.scanned.push(id), discovered.push(id));
  learn('edge', arrivals.length > 0);
  learn('storm', state.weather.kind === 'storm' || state.weather.kind === 'hurricane');
  learn('fire', !!fire);

  return {
    day: nextDay,
    ready,
    grew,
    unwatered,
    spread,
    postcards,
    pops,
    arrived,
    wonTonight,
    weather: state.weather,
    forecast: rollWeather(state.seed, nextDay + 1).kind,
    season: isSeasonStart(nextDay) ? season : null,
    arrivals,
    fire,
    sprouts,
    thickets,
    soaked,
    levelUps,
    tasks: state.tasks,
    discovered,
  };
}
