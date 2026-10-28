// Daily weather, rolled from the save's seed so a day always has the same sky (and tests can rely on it).
// Weather is gameplay: rain soaks fuel and young plants, wind pushes fire, storms bring lightning and litter.
import { ICON } from '../data/icons';
import { Season, calendar } from './calendar';
import { mulberry32 } from './rng';

export type WeatherKind = 'clear' | 'breezy' | 'heat' | 'rain' | 'storm' | 'hurricane' | 'fog' | 'cold';

export interface Weather {
  kind: WeatherKind;
  /** Unit vector the wind blows toward. */
  wind: { x: number; y: number };
  /** 0 (still) to 1 (gale). */
  windSpeed: number;
  /** Lightning strikes still to come today. */
  strikes: number;
}

export interface WeatherInfo {
  name: string;
  icon: string;
  note: string;
  /** Multiplies fire spread: wet weather damps it, hot dry wind feeds it. */
  moisture: number;
  /** 0..1 rain intensity for visuals, sound and soaking. */
  rain: number;
  /** A prescribed burn is safe in this weather ("in prescription"). */
  burnOk: boolean;
  /** Driving battery drain multiplier. */
  drain: number;
}

export const WEATHER: Record<WeatherKind, WeatherInfo> = {
  clear: { name: 'Clear', icon: ICON.day, note: 'Sunny and calm.', moisture: 1, rain: 0, burnOk: true, drain: 1 },
  breezy: { name: 'Breezy', icon: ICON.breezy, note: 'Wind carries seeds, and fire runs downwind.', moisture: 1.12, rain: 0, burnOk: false, drain: 1 },
  heat: { name: 'Hot and dry', icon: ICON.heat, note: 'Driving drains more energy. Dry fuel burns hot.', moisture: 1.3, rain: 0, burnOk: false, drain: 1.3 },
  rain: { name: 'Rainy', icon: ICON.rain, note: 'Soaks young plantings so they grow faster, and damps any fire.', moisture: 0.3, rain: 0.6, burnOk: false, drain: 1 },
  storm: { name: 'Thunderstorm', icon: ICON.storm, note: 'Lightning may spark a fire. Litter blows in overnight.', moisture: 0.85, rain: 0.85, burnOk: false, drain: 1 },
  hurricane: { name: 'Hurricane', icon: ICON.hurricane, note: 'Howling wind and rain. Expect lots of litter and seeds tomorrow.', moisture: 0.25, rain: 1, burnOk: false, drain: 1.15 },
  fog: { name: 'Foggy', icon: ICON.fog, note: 'Soft, damp air. Animals are easier to sneak up on.', moisture: 0.65, rain: 0, burnOk: true, drain: 1 },
  cold: { name: 'Cold snap', icon: ICON.cold, note: 'Chilly iguanas go stiff and are easy to catch.', moisture: 0.85, rain: 0, burnOk: true, drain: 1.1 },
};

const WEIGHTS: Record<Season, Partial<Record<WeatherKind, number>>> = {
  spring: { clear: 34, breezy: 24, heat: 12, rain: 14, storm: 12, fog: 4 },
  summer: { clear: 14, breezy: 6, heat: 22, rain: 24, storm: 34 },
  fall: { clear: 30, breezy: 24, rain: 18, storm: 10, hurricane: 6, fog: 12 },
  winter: { clear: 34, breezy: 18, fog: 22, cold: 20, rain: 6 },
};

/** Spring is the dry season, so the same flame travels a little further. */
export const SEASON_DRYNESS: Record<Season, number> = { spring: 1.15, summer: 0.9, fall: 1, winter: 1.05 };

function rawKind(seed: number, day: number): { kind: WeatherKind; rng: () => number } {
  const rng = mulberry32((seed ^ Math.imul(day + 7, 0x9e3779b1) ^ 0x5eed) >>> 0);
  const weights = Object.entries(WEIGHTS[calendar(day).season]) as [WeatherKind, number][];
  let roll = rng() * weights.reduce((sum, [, w]) => sum + w, 0);
  for (const [kind, w] of weights) {
    roll -= w;
    if (roll < 0) return { kind, rng };
  }
  return { kind: weights[0][0], rng };
}

export function rollWeather(seed: number, day: number): Weather {
  let { kind, rng } = rawKind(seed, day);
  // The very first morning is gentle, and hurricanes never arrive two days running.
  if (day <= 1) kind = 'clear';
  if (kind === 'hurricane' && rawKind(seed, day - 1).kind === 'hurricane') kind = 'storm';
  const angle = rng() * Math.PI * 2;
  const base: Partial<Record<WeatherKind, number>> = { clear: 0.15, breezy: 0.6, heat: 0.2, rain: 0.3, storm: 0.7, hurricane: 1, fog: 0.05, cold: 0.25 };
  const strikes = kind === 'storm' ? 2 + (rng() < 0.5 ? 1 : 0) : kind === 'hurricane' ? 1 : 0;
  return { kind, wind: { x: Math.cos(angle), y: Math.sin(angle) }, windSpeed: Math.min(1, (base[kind] ?? 0.2) + rng() * 0.15), strikes };
}

export function weatherInfo(w: Weather): WeatherInfo {
  return WEATHER[w.kind];
}

/** How freely fire spreads today: weather, wind and the season's dryness. */
export function fireMoisture(w: Weather, day: number): number {
  return WEATHER[w.kind].moisture * SEASON_DRYNESS[calendar(day).season];
}

export function isRainy(w: Weather): boolean {
  return WEATHER[w.kind].rain > 0;
}

/** Eight-way compass name for the direction the wind blows from (as a forecast reads it). */
export function windFrom(w: Weather): string {
  const names = ['east', 'northeast', 'north', 'northwest', 'west', 'southwest', 'south', 'southeast'];
  // The wind comes from the opposite of where it blows; screen y points south.
  const from = { x: -w.wind.x, y: -w.wind.y };
  const i = Math.round(Math.atan2(-from.y, from.x) / (Math.PI / 4));
  return names[((i % 8) + 8) % 8];
}
