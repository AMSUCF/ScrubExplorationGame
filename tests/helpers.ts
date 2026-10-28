import { Action, Target, Verb, getActions, performAction } from '../src/systems/actions';
import { GameState, newGame } from '../src/systems/state';

export function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

export function emptyGame(): GameState {
  const s = newGame(42);
  s.entities = [];
  return s;
}

export function find(s: GameState, target: Target, verb: Verb, param?: string): Action | undefined {
  return getActions(s, target).find((a) => a.verb === verb && (param === undefined || a.param === param));
}

/** Perform a verb on a target if it's available and enabled. Returns whether it succeeded. */
export function doVerb(s: GameState, target: Target, verb: Verb, param?: string): boolean {
  const a = find(s, target, verb, param);
  if (!a?.enabled) return false;
  return performAction(s, a).ok;
}
