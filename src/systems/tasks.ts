// "Today's little list": three small, relevant goals each morning, each with a small reward.
import { ICON } from '../data/icons';
import { Rng, mulberry32 } from './rng';
import { GameState, NATIVE_PLANTS, isChoked, isRegrowing } from './state';
import { trayStage } from './nursery';
import { WEATHER } from './weather';
import { zoneFire } from './fire';

export type TaskKind =
  | 'clear' | 'trash' | 'capture' | 'seeds' | 'water' | 'sow' | 'plant' | 'greet'
  | 'photo' | 'dig' | 'scope' | 'sort' | 'thicket' | 'prescribe';

export interface DailyTask {
  kind: TaskKind;
  label: string;
  icon: string;
  goal: number;
  progress: number;
  done: boolean;
  /** Recycled parts given when finished. */
  reward: number;
}

/** Levels at which tools (and so their tasks) become available; mirrors progress.ts. */
const NEEDS_LEVEL: Partial<Record<TaskKind, number>> = { photo: 2, dig: 3, prescribe: 4, scope: 5 };

interface Candidate {
  kind: TaskKind;
  weight: number;
  goal: number;
  label: (n: number) => string;
  icon: string;
  reward: number;
}

function candidates(s: GameState): Candidate[] {
  const count = (pred: (e: GameState['entities'][number]) => boolean) => s.entities.filter(pred).length;
  const invasives = count((e) => e.kind === 'invasivePlant');
  const litter = count((e) => e.kind === 'hazard' && e.species !== 'thicket' && e.species !== 'fence');
  const animals = count((e) => e.kind === 'invasiveAnimal');
  const healthy = count((e) => e.kind === 'nativePlant' && !isChoked(s, e) && !isRegrowing(s, e));
  const thirsty = s.trays.filter((t) => t.seed && !t.watered && trayStage(t) !== 'ready').length;
  const emptyJars = s.trays.filter((t) => !t.seed).length;
  const haveSeeds = NATIVE_PLANTS.some((p) => s.seeds[p] > 0);
  const seedlings = NATIVE_PLANTS.some((p) => s.seedlings[p] > 0) || s.trays.some((t) => trayStage(t) === 'ready');
  const neighbors = new Set(s.entities.filter((e) => e.kind === 'nativeAnimal').map((e) => (e.kind === 'nativeAnimal' ? e.species : ''))).size;
  const thickets = count((e) => e.kind === 'hazard' && e.species === 'thicket');
  const cogon = count((e) => e.kind === 'invasivePlant' && e.species === 'cogon');
  const burrows = count((e) => e.kind === 'burrow');
  const burnable = (['sand', 'oak', 'rosemary'] as const).some((z) => zoneFire(s, z).ready > 0.4);

  const out: Candidate[] = [];
  const add = (c: Candidate, ok: boolean) => ok && (s.level ?? 1) >= (NEEDS_LEVEL[c.kind] ?? 1) && out.push(c);
  add({ kind: 'clear', weight: 4, goal: Math.min(5, invasives), label: (n) => `Clear ${n} invasive plants`, icon: ICON.pull, reward: 2 }, invasives >= 2);
  add({ kind: 'trash', weight: 3, goal: Math.min(3, litter), label: (n) => `Gather ${n} pieces of litter`, icon: ICON.pickup, reward: 1 }, litter >= 1);
  add({ kind: 'capture', weight: 3, goal: 1, label: () => 'Relocate an invasive animal', icon: ICON.crate, reward: 2 }, animals >= 1);
  add({ kind: 'seeds', weight: 3, goal: Math.min(2, healthy), label: (n) => `Collect seeds from ${n} native plant${n > 1 ? 's' : ''}`, icon: ICON.seeds, reward: 1 }, healthy >= 1);
  add({ kind: 'water', weight: 5, goal: thirsty, label: (n) => `Water ${n > 1 ? `all ${n} growing jars` : 'your growing jar'}`, icon: ICON.water, reward: 1 }, thirsty >= 1);
  add({ kind: 'sow', weight: 3, goal: 1, label: () => 'Sow a seed in the nursery', icon: ICON.seeds, reward: 1 }, haveSeeds && emptyJars > 0);
  add({ kind: 'plant', weight: 4, goal: 1, label: () => 'Plant a native seedling', icon: ICON.plant, reward: 2 }, seedlings);
  add({ kind: 'greet', weight: 2, goal: Math.min(2, neighbors), label: (n) => `Say hi to ${n > 1 ? `${n} different neighbors` : 'a wild neighbor'}`, icon: ICON.greet, reward: 1 }, neighbors >= 1);
  add({ kind: 'photo', weight: 3, goal: 1, label: () => 'Take a 2-star wildlife portrait', icon: ICON.camera, reward: 2 }, neighbors >= 1);
  add({ kind: 'dig', weight: 3, goal: 1, label: () => 'Dig out a cogon clump, roots and all', icon: ICON.dig, reward: 2 }, cogon >= 1);
  add({ kind: 'scope', weight: 3, goal: 1, label: () => 'Peek inside a tortoise burrow', icon: ICON.scope, reward: 2 }, burrows >= 1);
  add({ kind: 'sort', weight: 2, goal: 1, label: () => 'Sort a bag of litter at the recycler', icon: ICON.sort, reward: 1 }, litter >= 2 || s.bag >= 2);
  add({ kind: 'thicket', weight: 2, goal: 1, label: () => 'Open up an overgrown thicket', icon: ICON.trim, reward: 2 }, thickets >= 1);
  add({ kind: 'prescribe', weight: 4, goal: 1, label: () => 'Light a prescribed burn in ready scrub', icon: ICON.torch, reward: 3 }, burnable && WEATHER[s.weather.kind].burnOk);
  return out;
}

/** Choose today's three goals, favouring a mix of chores. */
export function planTasks(s: GameState, rng: Rng = mulberry32(s.seed ^ Math.imul(s.day, 0x2c1b3c6d))): DailyTask[] {
  const pool = candidates(s);
  const chosen: DailyTask[] = [];
  while (chosen.length < 3 && pool.length > 0) {
    let roll = rng() * pool.reduce((sum, c) => sum + c.weight, 0);
    let i = pool.findIndex((c) => (roll -= c.weight) < 0);
    if (i < 0) i = pool.length - 1;
    const [c] = pool.splice(i, 1);
    chosen.push({ kind: c.kind, label: c.label(c.goal), icon: c.icon, goal: c.goal, progress: 0, done: false, reward: c.reward });
  }
  return chosen;
}

/** Count progress toward today's goals. Returns tasks finished by this event. */
export function advanceTasks(s: GameState, kind: TaskKind, n = 1): DailyTask[] {
  const finished: DailyTask[] = [];
  for (const t of s.tasks ?? []) {
    if (t.kind !== kind || t.done) continue;
    t.progress = Math.min(t.goal, t.progress + n);
    if (t.progress >= t.goal) {
      t.done = true;
      s.parts += t.reward;
      finished.push(t);
    }
  }
  return finished;
}

export function allTasksDone(s: GameState): boolean {
  return (s.tasks ?? []).length > 0 && s.tasks.every((t) => t.done);
}
