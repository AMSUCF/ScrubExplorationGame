// Stewardship levels: everything the robot does for the scrub earns care points. New levels bring
// new tools (and with them new mini-games), then small lasting perks. There is always a next level.
import { ICON } from '../data/icons';
import { GameState } from './state';
import { DailyTask, TaskKind, advanceTasks, allTasksDone } from './tasks';

export type ToolId = 'camera' | 'probe' | 'torch' | 'scope';

export const TOOL_LEVEL: Record<ToolId, number> = { camera: 2, probe: 3, torch: 4, scope: 5 };

export const TOOL_INFO: Record<ToolId, { name: string; icon: string; note: string }> = {
  camera: { name: 'Wildlife camera', icon: ICON.camera, note: 'Take portraits of your wild neighbors. Steady framing and sharp focus earn stars.' },
  probe: { name: 'Rhizome probe', icon: ICON.dig, note: 'Trace cogon’s underground runners and dig out whole clumps for good.' },
  torch: { name: 'Drip torch', icon: ICON.torch, note: 'Light careful prescribed burns in ready scrub on calm days.' },
  scope: { name: 'Burrow scope', icon: ICON.scope, note: 'Lower a little camera into tortoise burrows to meet who lives inside.' },
};

const TITLES = ['Sprout', 'Seedling', 'Sapling', 'Scrub Tender', 'Fire Friend', 'Burrow Buddy', 'Habitat Keeper', 'Scrub Guardian', 'Ridge Ranger', 'Wild Steward'];
const LEVEL_XP = [0, 40, 120, 250, 420, 640, 900, 1200, 1550, 1950];
const XP_AFTER = 450;

/** Lasting perks after the tools are all unlocked. */
const PERKS: Record<number, { label: string; apply: (s: GameState) => void }> = {
  6: { label: 'Bigger water tank (+3)', apply: (s) => { s.waterMax += 3; s.water = s.waterMax; } },
  7: { label: 'Seed pouch: one extra seed from every native', apply: () => undefined },
  8: { label: 'Battery cells: +15 energy', apply: (s) => { s.batteryMax += 15; s.battery += 15; } },
  9: { label: 'Sharp eyes: spot wildlife from farther away', apply: () => undefined },
  10: { label: 'Rain barrel: water tank +3', apply: (s) => { s.waterMax += 3; s.water = s.waterMax; } },
};

export function xpForLevel(level: number): number {
  if (level <= LEVEL_XP.length) return LEVEL_XP[level - 1];
  return LEVEL_XP[LEVEL_XP.length - 1] + (level - LEVEL_XP.length) * XP_AFTER;
}

export function levelFor(xp: number): number {
  let level = 1;
  while (xp >= xpForLevel(level + 1)) level++;
  return level;
}

export function levelTitle(level: number): string {
  return level <= TITLES.length ? TITLES[level - 1] : `${TITLES[TITLES.length - 1]} ${'★'.repeat(Math.min(5, level - TITLES.length))}`;
}

export function levelProgress(s: GameState): { level: number; title: string; into: number; need: number } {
  const lo = xpForLevel(s.level), hi = xpForLevel(s.level + 1);
  return { level: s.level, title: levelTitle(s.level), into: s.xp - lo, need: hi - lo };
}

export function hasTool(s: GameState, tool: ToolId): boolean {
  return s.level >= TOOL_LEVEL[tool];
}

export function hasPerk(s: GameState, level: 7 | 9): boolean {
  return s.level >= level;
}

export interface LevelUp {
  level: number;
  title: string;
  unlocks: { icon: string; name: string; note: string }[];
}

/** Add care points; applies perks and returns what each new level brought. */
export function addXp(s: GameState, n: number): LevelUp[] {
  s.xp += Math.max(0, Math.round(n));
  const ups: LevelUp[] = [];
  while (s.xp >= xpForLevel(s.level + 1)) {
    s.level++;
    const unlocks = (Object.keys(TOOL_LEVEL) as ToolId[])
      .filter((t) => TOOL_LEVEL[t] === s.level)
      .map((t) => ({ icon: TOOL_INFO[t].icon, name: TOOL_INFO[t].name, note: TOOL_INFO[t].note }));
    const perk = PERKS[s.level];
    if (perk) {
      perk.apply(s);
      unlocks.push({ icon: ICON.level, name: perk.label, note: 'A lasting upgrade for a dedicated steward.' });
    }
    if (s.level > 10) {
      s.parts += 3;
      unlocks.push({ icon: ICON.parts, name: '+3 recycled parts', note: 'A thank-you from the scrub.' });
    }
    ups.push({ level: s.level, title: levelTitle(s.level), unlocks });
  }
  return ups;
}

export type CareEvent = TaskKind | 'rescue' | 'sprig' | 'scan' | 'pot' | 'recycle' | 'contain' | 'renew' | 'arrival' | 'growth';

const XP: Record<CareEvent, number> = {
  clear: 2, trash: 2, capture: 4, seeds: 1, water: 1, sow: 1, plant: 5, greet: 2, photo: 3, dig: 6, scope: 4, sort: 1,
  thicket: 3, prescribe: 5, rescue: 5, sprig: 1, scan: 2, pot: 2, recycle: 1, contain: 8, renew: 1, arrival: 25, growth: 5,
};

export interface Credit {
  xp: number;
  levelUps: LevelUp[];
  tasks: DailyTask[];
  /** True when this finished the last of today's goals. */
  allDone: boolean;
}

/** Record a bit of care: progress today's goals and award care points. */
export function credit(s: GameState, ev: CareEvent, n = 1, xp?: number): Credit {
  xp ??= XP[ev] * n;
  const wasDone = allTasksDone(s);
  // Events that aren't task kinds simply match no goal.
  const tasks = advanceTasks(s, ev as TaskKind, n);
  const allDone = !wasDone && allTasksDone(s);
  let total = xp + tasks.length * 10;
  if (allDone) {
    s.parts += 2;
    total += 15;
  }
  return { xp: total, levelUps: addXp(s, total), tasks, allDone };
}
