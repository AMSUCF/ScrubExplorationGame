// Cogon spreads by rhizomes: pale runners under the sand. Digging a clump out for good means tracing
// every runner from the clump to its growing tip. Traced segments must connect back to the clump.
import { INVASIVE_PLANTS } from '../../data/species';
import { Point, pointSegmentDistance } from '../vineCare';
import { Rng, mulberry32 } from '../rng';
import { GameState, InvasivePlantEntity, NativePlantEntity, refreshRescues, removeEntity } from '../state';

export const RHIZOME_SIZE = 540;
export const TRACE_RADIUS = 24;

export interface Rhizome {
  nodes: Point[];
  /** Parent of each node (-1 for the clump at node 0). */
  parent: number[];
  tips: number[];
}

/** Three or four runners from the clump, some branching, all inside the dig box. */
export function generateRhizome(seed: number): Rhizome {
  const rng: Rng = mulberry32(seed);
  const c = RHIZOME_SIZE / 2;
  const nodes: Point[] = [{ x: c, y: c }];
  const parent = [-1];
  const clamp = (v: number) => Math.max(48, Math.min(RHIZOME_SIZE - 48, v));
  const grow = (from: number, angle: number, steps: number, branch: boolean) => {
    let at = from, a = angle;
    for (let i = 0; i < steps; i++) {
      a += (rng() - 0.5) * 0.7;
      const p = nodes[at];
      nodes.push({ x: clamp(p.x + Math.cos(a) * 34), y: clamp(p.y + Math.sin(a) * 34) });
      parent.push(at);
      at = nodes.length - 1;
      if (branch && i === 2 && rng() < 0.6) grow(at, a + (rng() < 0.5 ? -1 : 1) * (0.8 + rng() * 0.5), 2 + Math.floor(rng() * 2), false);
    }
  };
  const runners = 3 + (rng() < 0.5 ? 1 : 0);
  const start = rng() * Math.PI * 2;
  for (let r = 0; r < runners; r++) grow(0, start + (r / runners) * Math.PI * 2 + (rng() - 0.5) * 0.5, 4 + Math.floor(rng() * 3), true);
  const tips = nodes.map((_, i) => i).filter((i) => i > 0 && !parent.includes(i));
  return { nodes, parent, tips };
}

export interface DigProgress {
  covered: boolean[];
}

export const newDig = (r: Rhizome): DigProgress => ({ covered: r.nodes.map((_, i) => i === 0) });

/** Mark runner nodes the stroke passes over, only where they connect to already-traced runner. */
export function traceStroke(r: Rhizome, p: DigProgress, stroke: readonly Point[]): number {
  if (stroke.length === 0) return 0;
  const near = (pt: Point) => {
    if (stroke.length === 1) return Math.hypot(stroke[0].x - pt.x, stroke[0].y - pt.y) <= TRACE_RADIUS;
    for (let i = 1; i < stroke.length; i++) if (pointSegmentDistance(pt, stroke[i - 1], stroke[i]) <= TRACE_RADIUS) return true;
    return false;
  };
  let added = 0, changed = true;
  while (changed) {
    changed = false;
    r.nodes.forEach((pt, i) => {
      if (p.covered[i] || !p.covered[r.parent[i]] || !near(pt)) return;
      p.covered[i] = true;
      added++;
      changed = true;
    });
  }
  return added;
}

export function tipsFound(r: Rhizome, p: DigProgress): number {
  return r.tips.filter((i) => p.covered[i]).length;
}

export function digComplete(r: Rhizome, p: DigProgress): boolean {
  return tipsFound(r, p) === r.tips.length;
}

export function digStars(r: Rhizome, p: DigProgress, seconds: number): number {
  if (!digComplete(r, p)) return tipsFound(r, p) >= r.tips.length / 2 ? 1 : 0;
  return seconds <= 22 ? 3 : seconds <= 40 ? 2 : 1;
}

/**
 * Lift the clump. A complete dig also takes neighbouring cogon joined by the same runners and
 * leaves nothing to resprout; a partial dig leaves a few runners behind.
 */
export function digOut(s: GameState, clump: InvasivePlantEntity, complete: boolean): { removed: number; rescued: NativePlantEntity[] } {
  const remove = new Set<number>([clump.id]);
  if (complete) {
    const frontier = [clump];
    while (frontier.length && remove.size < 7) {
      const at = frontier.pop()!;
      for (const e of s.entities) {
        if (e.kind !== 'invasivePlant' || e.species !== 'cogon' || remove.has(e.id)) continue;
        if (Math.abs(e.tx - at.tx) <= 1 && Math.abs(e.ty - at.ty) <= 1 && Math.abs(e.tx - clump.tx) <= 3 && Math.abs(e.ty - clump.ty) <= 3) {
          remove.add(e.id);
          frontier.push(e);
        }
      }
    }
  }
  const spots = s.entities.filter((e) => remove.has(e.id)) as InvasivePlantEntity[];
  for (const e of spots) removeEntity(s, e.id);
  s.stats.invasivesRemoved += spots.length;
  // Clean digs clear the old runners from the soil, too.
  if (complete) s.seedbank = s.seedbank.filter((sp) => !(sp.species === 'cogon' && spots.some((e) => Math.abs(e.tx - sp.tx) <= 1 && Math.abs(e.ty - sp.ty) <= 1)));
  else s.seedbank.push({ tx: clump.tx, ty: clump.ty, species: 'cogon', day: s.day + 1, chance: 0.35 });
  return { removed: spots.length, rescued: refreshRescues(s) };
}

export const DIG_COST = INVASIVE_PLANTS.cogon.cost + 1;
