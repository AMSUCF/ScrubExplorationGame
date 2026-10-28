// The burrow scope: lower a tiny camera down a gopher tortoise burrow and meet who lives there.
// A burrow can be home to hundreds of kinds of animals; the guests change from day to day.
import { GUESTS, GuestId, NativeAnimalId } from '../../data/species';
import { seasonOf } from '../calendar';
import { Rng, mulberry32 } from '../rng';
import { BurrowEntity, GameState } from '../state';

export interface ScopeGuest {
  id: GuestId | NativeAnimalId;
  /** How far down the tunnel, 0 (entrance) .. 1 (the deep chamber). */
  depth: number;
  /** Shy guests slip away if the light lingers on them too long. */
  shy: boolean;
}

export function planBurrow(s: GameState, burrow: BurrowEntity): ScopeGuest[] {
  const rng: Rng = mulberry32((s.seed ^ Math.imul(burrow.id + 1, 0x45d9f3b) ^ Math.imul(s.day, 0x119de1f3)) >>> 0);
  const season = seasonOf(s.day);
  const want: { id: ScopeGuest['id']; chance: number; shy: boolean }[] = [
    { id: 'cricket', chance: 0.85, shy: true },
    { id: 'beetle', chance: 0.65, shy: false },
    { id: 'frog', chance: season === 'summer' || s.weather.kind === 'rain' ? 0.8 : 0.5, shy: true },
    { id: 'mouse', chance: (s.populations.mouse ?? 0) > 0 ? 0.7 : 0, shy: true },
    { id: 'indigo', chance: (s.populations.indigo ?? 0) > 0 ? (season === 'winter' ? 0.75 : 0.3) : 0, shy: false },
  ];
  const guests = want.filter((w) => rng() < w.chance).map((w) => ({ id: w.id, shy: w.shy, depth: 0 }));
  // Spread guests down the tunnel; the tortoise itself rests in the deep chamber.
  guests.sort(() => rng() - 0.5);
  guests.forEach((g, i) => (g.depth = 0.16 + ((i + 0.5) / Math.max(1, guests.length)) * 0.66 + (rng() - 0.5) * 0.05));
  if ((s.populations.tortoise ?? 0) > 0) guests.push({ id: 'tortoise', depth: 0.94, shy: false });
  return guests;
}

/** Log the neighbours spotted. New burrow guests join the field guide and earn a part each. */
export function logGuests(s: GameState, seen: ScopeGuest['id'][]): { fresh: GuestId[]; parts: number } {
  const fresh: GuestId[] = [];
  for (const id of seen) {
    if (!(GUESTS as string[]).includes(id)) continue;
    const g = id as GuestId;
    if (s.guests.includes(g)) continue;
    s.guests.push(g);
    if (!s.scanned.includes(g)) s.scanned.push(g);
    fresh.push(g);
  }
  s.parts += fresh.length;
  return { fresh, parts: fresh.length };
}
