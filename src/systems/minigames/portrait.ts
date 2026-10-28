// Wildlife portraits: each species moves in its own way. Frame it, wait for sharp focus and a
// characteristic pose, then press the shutter. Motion is a pure function of time, so it's testable.
import { NativeAnimalId } from '../../data/species';
import { GameState } from '../state';
import { hash2 } from '../rng';

/** Position in the scene (0..1 each way), whether it's in a signature pose, and hidden in cover. */
export interface Pose {
  x: number;
  y: number;
  pose: boolean;
  hidden: boolean;
  facing: 1 | -1;
}

export const POSE_NAME: Record<NativeAnimalId, string> = {
  tortoise: 'munching a wildflower',
  mouse: 'sitting up to sniff',
  jay: 'on sentinel watch',
  indigo: 'raising its head',
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => t * t * (3 - 2 * t);

/** Where the animal is `t` seconds into the session. */
export function animalPose(species: NativeAnimalId, t: number, seed = 1): Pose {
  switch (species) {
    case 'tortoise': {
      const x = 0.5 + 0.28 * Math.sin(t * 0.16 + seed);
      return { x, y: 0.58 + 0.08 * Math.sin(t * 0.11 + seed * 2), pose: Math.sin(t * 0.55 + seed) > 0.55, hidden: false, facing: Math.cos(t * 0.16 + seed) >= 0 ? 1 : -1 };
    }
    case 'mouse': {
      // Darts between hiding spots: a quick dash, a pause (sometimes sitting up), sometimes out of sight.
      const hop = 1.7, i = Math.floor(t / hop), f = (t % hop) / hop;
      const at = (k: number) => ({ x: 0.15 + hash2(k, seed, 3) * 0.7, y: 0.4 + hash2(k, seed, 4) * 0.4 });
      const a = at(i), b = at(i + 1);
      const m = f < 0.25 ? ease(f / 0.25) : 1;
      const hidden = hash2(i + 1, seed, 5) < 0.3 && f > 0.25;
      return { x: lerp(a.x, b.x, m), y: lerp(a.y, b.y, m), pose: f > 0.45 && f < 0.85 && !hidden, hidden, facing: b.x >= a.x ? 1 : -1 };
    }
    case 'jay': {
      // Hops between perches on shrub tops; while perched it keeps sentinel watch.
      const stay = 2.1, i = Math.floor(t / stay), f = (t % stay) / stay;
      const perch = (k: number) => ({ x: 0.18 + hash2(k, seed, 6) * 0.64, y: 0.3 + hash2(k, seed, 7) * 0.25 });
      const a = perch(i), b = perch(i + 1);
      const flying = f > 0.8;
      const m = flying ? ease((f - 0.8) / 0.2) : 0;
      return { x: lerp(a.x, b.x, m), y: lerp(a.y, b.y, m) - (flying ? Math.sin(m * Math.PI) * 0.12 : 0), pose: f > 0.2 && f < 0.7, hidden: false, facing: b.x >= a.x ? 1 : -1 };
    }
    case 'indigo': {
      const x = 0.5 + 0.36 * Math.sin(t * 0.22 + seed);
      return { x, y: 0.62 + 0.06 * Math.sin(t * 0.9), pose: Math.sin(t * 0.7 + seed * 3) > 0.6, hidden: false, facing: Math.cos(t * 0.22 + seed) >= 0 ? 1 : -1 };
    }
  }
}

/** The lens breathes in and out of focus; a steady hand catches it sharp. 0 (blurred) .. 1 (crisp). */
export function lensFocus(t: number): number {
  return 0.5 + 0.5 * Math.sin(t * 2.1);
}

export interface Shot {
  /** Animal's offset from the frame centre, in frame-widths (0 = centred, 0.5 = at the edge). */
  dx: number;
  dy: number;
  hidden: boolean;
  focus: number;
  pose: boolean;
}

export function shotScore(s: Shot): number {
  const dist = Math.hypot(s.dx, s.dy);
  if (s.hidden || dist > 0.5) return 0;
  const centre = Math.max(0, 1 - dist / 0.4);
  return centre * 0.5 + s.focus * 0.4 + (s.pose ? 0.2 : 0);
}

export function shotStars(s: Shot): 0 | 1 | 2 | 3 {
  const v = shotScore(s);
  return v >= 0.85 ? 3 : v >= 0.62 ? 2 : v >= 0.35 ? 1 : 0;
}

/** Keep the best portrait per species. The first 3-star portrait of each species earns parts. */
export function recordPortrait(state: GameState, species: NativeAnimalId, stars: number): { best: number; improved: boolean; reward: number } {
  state.portraits ??= {};
  const before = state.portraits[species] ?? 0;
  const improved = stars > before;
  if (improved) state.portraits[species] = stars;
  if (stars > 0) state.stats.portraits = (state.stats.portraits ?? 0) + 1;
  const reward = improved && stars === 3 ? 2 : 0;
  state.parts += reward;
  return { best: Math.max(before, stars), improved, reward };
}
