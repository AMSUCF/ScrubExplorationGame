import { SAVE_KEY } from '../config';
import { GameState, STATE_VERSION } from './state';

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
  return raw as unknown as GameState;
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
