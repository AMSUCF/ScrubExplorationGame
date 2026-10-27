import { describe, expect, it } from 'vitest';
import { STATIONS, zoneAt } from '../src/data/map';
import { Target, getAction, performAction } from '../src/systems/actions';
import { nightTick } from '../src/systems/dayCycle';
import { GameState, newGame } from '../src/systems/state';

const pad = STATIONS.find((s) => s.kind === 'pad')!;
const trays = STATIONS.filter((s) => s.kind === 'tray');

function act(s: GameState, target: Target | null, spot: { tx: number; ty: number } | null = null): boolean {
  const a = getAction(s, target, spot);
  if (!a?.enabled) return false;
  return performAction(s, a).ok;
}

/** A tireless robot that does every chore each day — proves the scrub can be fully restored. */
describe('full playthrough', () => {
  it.each([1, 2, 3, 99])('all native wildlife returns (seed %i)', (seed) => {
    const s = newGame(seed);
    for (let day = 0; day < 15 && !s.won; day++) {
      s.battery = 1e6;
      // Clear invasives, trash and invasive animals.
      for (let pass = 0; pass < 4; pass++) {
        for (const e of [...s.entities]) {
          if (e.kind !== 'invasivePlant' && e.kind !== 'hazard' && e.kind !== 'invasiveAnimal') continue;
          for (let i = 0; i < 4 && s.entities.includes(e) && act(s, { type: 'entity', entity: e }); i++);
          s.bag = 0;
          act(s, { type: 'station', station: pad });
        }
      }
      // Gather acorns, tend the nursery, and plant seedlings out in the oak scrub.
      for (const e of s.entities) {
        if (e.kind === 'nativePlant' && e.species === 'oak') act(s, { type: 'entity', entity: e });
      }
      s.selectedSeed = 'oak';
      for (const t of trays) {
        act(s, { type: 'station', station: t }); // pot up / sow / water, whichever applies
        act(s, { type: 'station', station: t });
        act(s, { type: 'station', station: t });
      }
      for (let ty = 2; ty < 16 && s.seedlings.oak > 0; ty += 2) {
        for (let tx = 22; tx < 44 && s.seedlings.oak > 0; tx += 2) {
          if (zoneAt(tx, ty) === 'oak') act(s, null, { tx, ty });
        }
      }
      nightTick(s);
    }
    expect(s.stats.planted).toBeGreaterThan(0);
    expect(s.returned.sort()).toEqual(['indigo', 'jay', 'mouse', 'tortoise']);
    expect(s.won).toBe(true);
  });
});
