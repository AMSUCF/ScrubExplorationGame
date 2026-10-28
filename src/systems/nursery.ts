// Seed trays at home base: sow → (water each day) → sprout → seedling → pot up.
import { GROW_NIGHTS } from '../config';
import { NativePlantId } from '../data/species';
import { GameState, TrayState } from './state';

export type TrayStage = 'empty' | 'sown' | 'sprout' | 'ready';

export function trayStage(tray: TrayState): TrayStage {
  if (!tray.seed) return 'empty';
  if (tray.growth >= GROW_NIGHTS) return 'ready';
  return tray.growth === 0 ? 'sown' : 'sprout';
}

export function sow(state: GameState, index: number, seed: NativePlantId): NativePlantId | null {
  const tray = state.trays[index];
  if (!tray || tray.seed || state.seeds[seed] <= 0) return null;
  state.seeds[seed]--;
  tray.seed = seed;
  tray.growth = 0;
  tray.watered = false;
  return seed;
}

export function water(state: GameState, index: number): boolean {
  const tray = state.trays[index];
  if (!tray || !tray.seed || tray.watered || trayStage(tray) === 'ready') return false;
  tray.watered = true;
  return true;
}

export function pot(state: GameState, index: number): NativePlantId | null {
  const tray = state.trays[index];
  if (!tray || trayStage(tray) !== 'ready' || !tray.seed) return null;
  const species = tray.seed;
  state.seedlings[species]++;
  tray.seed = null;
  tray.growth = 0;
  tray.watered = false;
  return species;
}

/** Overnight growth. Only watered trays grow. Returns how many trays became ready. */
export function growNight(state: GameState): { grew: number; ready: number } {
  let grew = 0;
  let ready = 0;
  for (const tray of state.trays) {
    if (tray.seed && tray.watered && tray.growth < GROW_NIGHTS) {
      tray.growth++;
      grew++;
      if (tray.growth >= GROW_NIGHTS) ready++;
    }
    tray.watered = false;
  }
  return { grew, ready };
}
