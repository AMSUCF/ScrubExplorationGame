import { BATTERY_MAX_UPGRADES, BATTERY_UPGRADE_AMOUNT, BATTERY_UPGRADE_COST } from '../config';
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

export function canUpgrade(state: GameState): boolean {
  return state.upgrades < BATTERY_MAX_UPGRADES && state.parts >= BATTERY_UPGRADE_COST;
}

export function upgrade(state: GameState): boolean {
  if (!canUpgrade(state)) return false;
  state.parts -= BATTERY_UPGRADE_COST;
  state.upgrades++;
  state.batteryMax += BATTERY_UPGRADE_AMOUNT;
  state.battery += BATTERY_UPGRADE_AMOUNT;
  return true;
}

export function batteryFraction(state: GameState): number {
  return state.batteryMax > 0 ? state.battery / state.batteryMax : 0;
}
