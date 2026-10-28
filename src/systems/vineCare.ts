// Touch geometry and work progress are independent of the renderer and survive save/reload.
export interface Point { x: number; y: number }
export interface VineCareProgress {
  cuts: number[];
  bagged: number[];
  pulled: boolean;
  brushes: number;
}

export const SNIPS: readonly Point[] = [{ x: 138, y: 346 }, { x: 318, y: 381 }, { x: 398, y: 338 }];
export const BULBILS: readonly Point[] = [{ x: 122, y: 235 }, { x: 339, y: 184 }, { x: 412, y: 267 }];
export const BAG = { x: 397, y: 481, radius: 57 };
export const PULL = { x: 263, y: 432 };
export const BRANCHES: readonly (readonly [Point, Point])[] = [
  [{ x: 264, y: 418 }, { x: 262, y: 265 }],
  [{ x: 262, y: 298 }, { x: 182, y: 257 }],
  [{ x: 263, y: 275 }, { x: 349, y: 240 }],
  [{ x: 262, y: 267 }, { x: 242, y: 190 }],
];

export const newVineCare = (): VineCareProgress => ({ cuts: [], bagged: [], pulled: false, brushes: 0 });
export const careStage = (p: VineCareProgress): 'snip' | 'bag' | 'pull' | 'done' =>
  p.cuts.length < SNIPS.length ? 'snip' : p.bagged.length < BULBILS.length ? 'bag' : p.pulled ? 'done' : 'pull';

export function pointSegmentDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p.x - a.x - dx * t, p.y - a.y - dy * t);
}

function segmentsDistance(a: Point, b: Point, c: Point, d: Point): number {
  const cross = (p: Point, q: Point, r: Point) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  if (cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0) return 0;
  return Math.min(pointSegmentDistance(a, c, d), pointSegmentDistance(b, c, d), pointSegmentDistance(c, a, b), pointSegmentDistance(d, a, b));
}

export function snipVine(p: VineCareProgress, index: number): boolean {
  if (careStage(p) !== 'snip' || !Number.isInteger(index) || !SNIPS[index] || p.cuts.includes(index)) return false;
  p.cuts.push(index);
  return true;
}

/** A stroke must cross a safe snip mark, with no part touching a protected native branch. */
export function cutStroke(p: VineCareProgress, stroke: readonly Point[]): 'cut' | 'branch' | 'miss' {
  if (careStage(p) !== 'snip' || stroke.length < 2) return 'miss';
  const length = stroke.slice(1).reduce((sum, b, i) => sum + Math.hypot(b.x - stroke[i].x, b.y - stroke[i].y), 0);
  if (length < 22) return 'miss';
  for (let i = 1; i < stroke.length; i++) {
    if (BRANCHES.some(([a, b]) => segmentsDistance(stroke[i - 1], stroke[i], a, b) < 11)) {
      p.brushes++;
      return 'branch';
    }
  }
  const index = SNIPS.findIndex((point, index) => !p.cuts.includes(index) && stroke.slice(1).some((b, i) => pointSegmentDistance(point, stroke[i], b) <= 18));
  return snipVine(p, index) ? 'cut' : 'miss';
}

export function bagBulbil(p: VineCareProgress, index: number, at: Point = BAG): boolean {
  if (careStage(p) !== 'bag' || !Number.isInteger(index) || !BULBILS[index] || p.bagged.includes(index) || Math.hypot(at.x - BAG.x, at.y - BAG.y) > BAG.radius) return false;
  p.bagged.push(index);
  return true;
}

export function pullVine(p: VineCareProgress, from: Point, to: Point): boolean {
  if (careStage(p) !== 'pull' || Math.hypot(from.x - PULL.x, from.y - PULL.y) > 40 || to.y - from.y < 56 || Math.abs(to.x - from.x) > 85) return false;
  p.pulled = true;
  return true;
}
