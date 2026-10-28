import { describe, expect, it } from 'vitest';
import { homeLayout } from '../src/data/home';
import { STATIONS, zoneAt } from '../src/data/map';
import { nightTick } from '../src/systems/dayCycle';
import { newGame } from '../src/systems/state';
import { doVerb } from './helpers';

const pad = STATIONS.find((s) => s.kind === 'pad')!;

/** A tireless robot that does every chore each day — proves the scrub can be fully restored. */
describe('full playthrough', () => {
  it.each([1, 2, 3, 99])('all native wildlife returns and grows (seed %i)', (seed) => {
    const s = newGame(seed);
    for (let day = 0; day < 20 && !s.won; day++) {
      s.battery = 1e6;
      for (let pass = 0; pass < 4; pass++) {
        for (const e of [...s.entities]) {
          if (e.kind !== 'invasivePlant' && e.kind !== 'hazard' && e.kind !== 'invasiveAnimal') continue;
          const t = { type: 'entity' as const, entity: e };
          doVerb(s, t, 'scan');
          for (let i = 0; i < 4 && s.entities.includes(e); i++) if (!doVerb(s, t, e.kind === 'invasiveAnimal' ? 'capture' : 'remove')) break;
          s.bag = 0;
          doVerb(s, { type: 'station', station: pad }, 'dropoff');
        }
      }
      for (const e of s.entities) {
        if (e.kind === 'nativePlant' && e.species === 'oak') {
          doVerb(s, { type: 'entity', entity: e }, 'scan');
          doVerb(s, { type: 'entity', entity: e }, 'collect');
        }
      }
      for (const item of homeLayout(s.homeLevel, s.trays.length, s.vases.length)) {
        if (item.kind !== 'slot') continue;
        const t = { type: 'home' as const, item };
        doVerb(s, t, 'pot');
        doVerb(s, t, 'sow', 'oak');
        doVerb(s, t, 'water');
      }
      for (let ty = 2; ty < 16 && s.seedlings.oak > 0; ty += 2) {
        for (let tx = 22; tx < 44 && s.seedlings.oak > 0; tx += 2) {
          if (zoneAt(tx, ty) === 'oak') doVerb(s, { type: 'self', spot: { tx, ty } }, 'plant', 'oak');
        }
      }
      nightTick(s);
    }
    expect(s.stats.planted).toBeGreaterThan(0);
    expect([...s.returned].sort()).toEqual(['indigo', 'jay', 'mouse', 'tortoise']);
    expect(s.won).toBe(true);
    expect(s.populations.tortoise).toBeGreaterThan(1);
  });
});
