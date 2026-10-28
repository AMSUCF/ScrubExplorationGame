import { GameState } from './state';

export function canAfford(state: GameState, cost: number): boolean {
  return state.battery >= cost;
}

/** Spends battery if there's enough. Returns false (and spends nothing) otherwise. */
export function spend(state: GameState, cost: number): boolean {
  if (!canAfford(state, cost)) return false;
  state.battery = Math.max(0, state.battery - cost);
  return true;
}

export function drain(state: GameState, amount: number): void {
  state.battery = Math.max(0, state.battery - amount);
}

export function recharge(state: GameState): void {
  state.battery = state.batteryMax;
}

export function batteryFraction(state: GameState): number {
  return state.batteryMax > 0 ? state.battery / state.batteryMax : 0;
}
