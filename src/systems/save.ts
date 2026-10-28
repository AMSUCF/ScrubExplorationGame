import { SAVE_KEY } from '../config';
import { ROBOT_SPAWN } from '../data/map';
import { GameState, STATE_VERSION, emptyPlantRecord } from './state';

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
