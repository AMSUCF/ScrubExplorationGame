// Grid A* (8-way, no corner cutting) used for tap-to-move both outdoors and inside the pod.

export interface Grid {
  w: number;
  h: number;
  blocked(tx: number, ty: number): boolean;
}

export interface Tile {
  tx: number;
  ty: number;
}

const DIRS = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, Math.SQRT2],
  [1, -1, Math.SQRT2],
  [-1, 1, Math.SQRT2],
  [-1, -1, Math.SQRT2],
] as const;

/**
 * Find a path from `start` to any tile where `isGoal` holds (nearest by path cost).
 * `heuristicTo` steers the search; returns tiles excluding the start, or null if unreachable.
 */
export function findPath(
  grid: Grid,
  start: Tile,
  isGoal: (t: Tile) => boolean,
  heuristicTo: Tile,
  maxNodes = 6000,
): Tile[] | null {
  const key = (x: number, y: number) => y * grid.w + x;
  const h = (x: number, y: number) => {
    const dx = Math.abs(x - heuristicTo.tx);
    const dy = Math.abs(y - heuristicTo.ty);
    return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
  };
  const g = new Map<number, number>();
  const came = new Map<number, number>();
  const open: { k: number; f: number }[] = [];
  const sk = key(start.tx, start.ty);
  g.set(sk, 0);
  open.push({ k: sk, f: h(start.tx, start.ty) });
  const closed = new Set<number>();
  let explored = 0;

  while (open.length > 0 && explored++ < maxNodes) {
    // Small grids: a linear scan for the lowest f is plenty fast.
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
    const { k } = open.splice(bi, 1)[0];
    if (closed.has(k)) continue;
    closed.add(k);
    const cx = k % grid.w;
    const cy = Math.floor(k / grid.w);
    if (isGoal({ tx: cx, ty: cy })) {
      const path: Tile[] = [];
      let cur = k;
      while (cur !== sk) {
        path.push({ tx: cur % grid.w, ty: Math.floor(cur / grid.w) });
        cur = came.get(cur)!;
      }
      return path.reverse();
    }
    for (const [dx, dy, cost] of DIRS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= grid.w || ny >= grid.h || grid.blocked(nx, ny)) continue;
      if (dx && dy && (grid.blocked(cx + dx, cy) || grid.blocked(cx, cy + dy))) continue;
      const nk = key(nx, ny);
      const ng = g.get(k)! + cost;
      if (ng < (g.get(nk) ?? Infinity)) {
        g.set(nk, ng);
        came.set(nk, k);
        open.push({ k: nk, f: ng + h(nx, ny) });
      }
    }
  }
  return null;
}
