// Home upgrades bought at the workbench with recycled parts, some gated by wildlife milestones.
import { BATTERY_MAX_UPGRADES, BATTERY_UPGRADE_AMOUNT, BATTERY_UPGRADE_COST } from '../config';
import { HomeItem, MAX_SLOTS_BY_LEVEL, MAX_VASES_BY_LEVEL, ROOM_MILESTONES, ROOM_SIZES, homeLayout } from '../data/home';
import { NativeAnimalId, NativePlantId } from '../data/species';
import { GameState } from './state';

export type UpgradeId = 'battery' | 'slots' | 'vase' | 'room';

export const UPGRADE_COST: Record<UpgradeId, number> = {
  battery: BATTERY_UPGRADE_COST,
  slots: 3,
  vase: 2,
  room: 6,
};

export const SLOTS_PER_UPGRADE = 2;
export const VASE_CAPACITY = 3;

export type UpgradeBlock = 'parts' | 'max' | 'milestone';

export interface UpgradeStatus {
  ok: boolean;
  block?: UpgradeBlock;
  /** For milestone blocks: the species whose return unlocks it. */
  needs?: NativeAnimalId;
}

export function upgradeStatus(s: GameState, id: UpgradeId): UpgradeStatus {
  let atMax = false;
  let needs: NativeAnimalId | undefined;
  switch (id) {
    case 'battery':
      atMax = s.upgrades >= BATTERY_MAX_UPGRADES;
      break;
    case 'slots':
      atMax = s.trays.length + SLOTS_PER_UPGRADE > MAX_SLOTS_BY_LEVEL[s.homeLevel];
      break;
    case 'vase':
      atMax = s.vases.length >= MAX_VASES_BY_LEVEL[s.homeLevel];
      break;
    case 'room': {
      atMax = s.homeLevel >= ROOM_SIZES.length - 1;
      const m = ROOM_MILESTONES[s.homeLevel + 1];
      if (!atMax && m && !s.returned.includes(m)) needs = m;
      break;
    }
  }
  if (atMax) return { ok: false, block: 'max' };
  if (needs) return { ok: false, block: 'milestone', needs };
  if (s.parts < UPGRADE_COST[id]) return { ok: false, block: 'parts' };
  return { ok: true };
}

export function buyUpgrade(s: GameState, id: UpgradeId): boolean {
  if (!upgradeStatus(s, id).ok) return false;
  s.parts -= UPGRADE_COST[id];
  switch (id) {
    case 'battery':
      s.upgrades++;
      s.batteryMax += BATTERY_UPGRADE_AMOUNT;
      s.battery += BATTERY_UPGRADE_AMOUNT;
      break;
    case 'slots':
      s.hydroUpgrades++;
      for (let i = 0; i < SLOTS_PER_UPGRADE; i++) s.trays.push({ seed: null, growth: 0, watered: false });
      break;
    case 'vase':
      s.vaseUpgrades++;
      s.vases.push([]);
      break;
    case 'room':
      s.homeLevel++;
      break;
  }
  return true;
}

export function placeSprig(s: GameState, vase: number, species: NativePlantId): boolean {
  const v = s.vases[vase];
  if (!v || s.sprigs[species] <= 0) return false;
  s.sprigs[species]--;
  v.push(species);
  if (v.length > VASE_CAPACITY) v.shift();
  return true;
}

export function clearVase(s: GameState, vase: number): boolean {
  const v = s.vases[vase];
  if (!v || v.length === 0) return false;
  s.vases[vase] = [];
  return true;
}

export function currentLayout(s: GameState): HomeItem[] {
  return homeLayout(s.homeLevel, s.trays.length, s.vases.length);
}
