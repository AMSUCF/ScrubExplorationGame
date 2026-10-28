import { SAVE_KEY, WATER_TANK } from '../config';
import { ROBOT_SPAWN } from '../data/map';
import { emptyFireReport, initialBurnDays } from './fire';
import { addXp } from './progress';
import { GameState, STATE_VERSION, emptyPlantRecord } from './state';
import { planTasks } from './tasks';
import { rollWeather } from './weather';

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>;

function defaultStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Upgrade older saves in place. Add a case here whenever STATE_VERSION is bumped. */
export function migrate(raw: Record<string, unknown>): GameState | null {
  const version = typeof raw.version === 'number' ? raw.version : 0;
  if (version < 1 || version > STATE_VERSION) return null;
  if (version < 2) migrateV1(raw);
  if (version < 3) migrateV2(raw);
  return raw as unknown as GameState;
}

/** v1 → v2: the pod home, populations, collections and wordless postcards. */
function migrateV1(raw: Record<string, unknown>): void {
  const s = raw as unknown as GameState & { selectedSeed?: unknown };
  delete s.selectedSeed;
  s.hydroUpgrades = 0;
  s.vaseUpgrades = 0;
  s.homeLevel = 0;
  s.sprigs = emptyPlantRecord();
  s.vases = [[]];
  s.photos = [];
  s.sightings = {};
  s.sightedToday = [];
  s.location = 'outside';
  s.introSeen = true;
  s.robot = { ...ROBOT_SPAWN };
  s.populations = Object.fromEntries(s.returned.map((sp) => [sp, 1]));
  s.history = [{ day: s.day, pop: { ...s.populations } }];
  // Old postcards were text; there's no picture to draw for them.
  s.postcards = [];
  s.version = 2;
}

/** v2 → v3: seasons and weather, fire history, edge arrivals, levels, tasks and mini-game records. */
function migrateV2(raw: Record<string, unknown>): void {
  const s = raw as unknown as GameState;
  s.seed ??= 1;
  s.day ??= 1;
  s.entities ??= [];
  s.trays ??= [];
  s.seeds ??= emptyPlantRecord();
  s.seedlings ??= emptyPlantRecord();
  s.returned ??= [];
  s.parts ??= 0;
  s.stats ??= { invasivesRemoved: 0, trashCollected: 0, planted: 0, relocated: 0 };
  s.weather = rollWeather(s.seed, s.day);
  // The past fires are laid out as of today, so an older scrub still has ready and overdue areas.
  s.burned = initialBurnDays(s.seed).map((d) => d + s.day - 1);
  s.fires = [];
  s.firebreaks = [];
  s.seedbank = [];
  s.fireToday = emptyFireReport();
  s.water = WATER_TANK;
  s.waterMax = WATER_TANK;
  s.portraits = {};
  s.guests = [];
  s.bagItems = Array.from({ length: s.bag ?? 0 }, () => 'bottle' as const);
  // Credit the care already given, so returning players start at a fitting level.
  s.xp = 0;
  s.level = 1;
  const st = s.stats;
  addXp(s, st.invasivesRemoved * 2 + st.trashCollected * 2 + st.planted * 5 + st.relocated * 4 + (s.returned?.length ?? 0) * 25);
  s.tasks = planTasks(s);
  s.version = 3;
}

export function saveGame(state: GameState, storage: Storage | null = defaultStorage()): boolean {
  if (!storage) return false;
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function loadGame(storage: Storage | null = defaultStorage()): GameState | null {
  if (!storage) return null;
  try {
    const text = storage.getItem(SAVE_KEY);
    if (!text) return null;
    return migrate(JSON.parse(text));
  } catch {
    return null;
  }
}

export function clearSave(storage: Storage | null = defaultStorage()): void {
  try {
    storage?.removeItem(SAVE_KEY);
  } catch {
    // Storage unavailable — nothing to clear.
  }
}
