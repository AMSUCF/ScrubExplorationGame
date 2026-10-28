import { describe, expect, it } from 'vitest';
import { FIRE_OVERDUE_DAYS, FIRE_READY_DAYS, MAP_W } from '../src/config';
import { STATIONS } from '../src/data/map';
import { getActions, performAction } from '../src/systems/actions';
import { calendar, isSeasonStart } from '../src/systems/calendar';
import { nightTick } from '../src/systems/dayCycle';
import {
  burnClass, burnOut, douse, fireState, fireTick, fuelAt, ignite, isBurning, lightningStrike, overgrow, rake, sproutSeedbank, tileIndex, zoneFire,
} from '../src/systems/fire';
import { zoneHealth } from '../src/systems/habitat';
import { edgeIncursions, edgeTiles, incursionPressure } from '../src/systems/incursion';
import { mulberry32 } from '../src/systems/rng';
import { migrate } from '../src/systems/save';
import { GameState, HazardEntity, NativePlantEntity, addEntity, newGame } from '../src/systems/state';
import { rollWeather, windFrom } from '../src/systems/weather';
import { doVerb, emptyGame, find } from './helpers';

/** Set every tile's burn history to `age` days ago. */
function ageAll(s: GameState, age: number) {
  s.burned = s.burned.map(() => s.day - age);
}

const calm = (s: GameState) => (s.weather = { kind: 'clear', wind: { x: 1, y: 0 }, windSpeed: 0.1, strikes: 0 });

describe('seasons and weather', () => {
  it('cycles spring → summer → fall → winter, forever', () => {
    expect(calendar(1)).toEqual({ year: 1, season: 'spring', dayOfSeason: 1 });
    expect(calendar(8).season).toBe('summer');
    expect(calendar(22).season).toBe('winter');
    expect(calendar(29)).toEqual({ year: 2, season: 'spring', dayOfSeason: 1 });
    expect(isSeasonStart(8)).toBe(true);
    expect(isSeasonStart(1)).toBe(false);
  });

  it('rolls the same weather for the same day, starts gently, and storms most in summer', () => {
    expect(rollWeather(5, 12)).toEqual(rollWeather(5, 12));
    expect(rollWeather(5, 1).kind).toBe('clear');
    const count = (season: number, kind: string) => {
      let n = 0;
      for (let seed = 0; seed < 60; seed++) for (let d = 0; d < 7; d++) if (rollWeather(seed, season * 7 + 1 + d + 28).kind === kind) n++;
      return n;
    };
    expect(count(1, 'storm')).toBeGreaterThan(count(3, 'storm') + 40);
    expect(count(3, 'cold')).toBeGreaterThan(0);
    expect(count(1, 'cold')).toBe(0);
  });

  it('never brings hurricanes two days running, and storms carry lightning', () => {
    for (let seed = 0; seed < 40; seed++) {
      for (let day = 2; day < 120; day++) {
        if (rollWeather(seed, day).kind === 'hurricane') expect(rollWeather(seed, day + 1).kind).not.toBe('hurricane');
        const w = rollWeather(seed, day);
        if (w.kind === 'storm') expect(w.strikes).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('names where the wind comes from', () => {
    expect(windFrom({ kind: 'breezy', wind: { x: 1, y: 0 }, windSpeed: 1, strikes: 0 })).toBe('west');
    expect(windFrom({ kind: 'breezy', wind: { x: 0, y: 1 }, windSpeed: 1, strikes: 0 })).toBe('north');
  });
});

describe('fire history', () => {
  it('sorts ground by time since fire', () => {
    expect(fireState(3)).toBe('recovering');
    expect(fireState(12)).toBe('young');
    expect(fireState(FIRE_READY_DAYS)).toBe('ready');
    expect(fireState(FIRE_OVERDUE_DAYS)).toBe('overdue');
    expect(burnClass(30)).toBe('renewed');
    expect(burnClass(2)).toBe('harmed');
  });

  it('carries no fuel at base and little on freshly burned ground', () => {
    const s = emptyGame();
    expect(fuelAt(s, 28, 35)).toBe(0);
    ageAll(s, 30);
    const old = fuelAt(s, 30, 10);
    s.burned[tileIndex(30, 10)] = s.day;
    expect(fuelAt(s, 30, 10)).toBeLessThan(old * 0.3);
  });

  it('renews overdue scrub: thickets clear, oaks resprout, rosemary reseeds', () => {
    const s = emptyGame();
    ageAll(s, 45);
    calm(s);
    const thicket = addEntity<HazardEntity>(s, { kind: 'hazard', species: 'thicket', tx: 30, ty: 10, hp: 2 });
    const oak = addEntity<NativePlantEntity>(s, { kind: 'nativePlant', species: 'oak', tx: 31, ty: 10, planted: false, plantedDay: 0, lastSeedDay: 0, rescued: true });
    const rosemary = addEntity<NativePlantEntity>(s, { kind: 'nativePlant', species: 'rosemary', tx: 46, ty: 30, planted: false, plantedDay: 0, lastSeedDay: 0, rescued: true });
    expect(ignite(s, 30, 10)).toBe(true);
    expect(ignite(s, 31, 10)).toBe(true);
    expect(ignite(s, 46, 30)).toBe(true);
    expect(s.entities).not.toContain(thicket);
    expect(oak.burnedDay).toBe(s.day);
    expect(s.entities).toContain(oak);
    expect(s.entities).not.toContain(rosemary);
    expect(s.fireToday).toMatchObject({ thickets: 1, renewed: 3, lost: 0 });
    // Rosemary seeds sprout in the open sand a couple of mornings later.
    const sprouted = sproutSeedbank(s, mulberry32(1), s.day + 2);
    expect(sprouted.natives).toBeGreaterThanOrEqual(1);
    expect(s.entities.some((e) => e.kind === 'nativePlant' && e.species === 'rosemary' && e.tx === 46)).toBe(true);
  });

  it('harms plants on ground that burned only days ago', () => {
    const s = emptyGame();
    ageAll(s, 30);
    const palm = addEntity<NativePlantEntity>(s, { kind: 'nativePlant', species: 'palmetto', tx: 10, ty: 24, planted: false, plantedDay: 0, lastSeedDay: 0, rescued: true });
    addEntity(s, { kind: 'invasivePlant', species: 'cogon', tx: 10, ty: 24, hp: 1 }); // keeps the tile burnable
    s.burned[tileIndex(10, 24)] = s.day - 3;
    expect(ignite(s, 10, 24)).toBe(true);
    expect(s.entities).not.toContain(palm);
    expect(s.fireToday.harmed).toBe(1);
    expect(s.fireToday.lost).toBe(1);
  });

  it('spreads through fuel, stops at base, and burns out overnight', () => {
    const s = emptyGame();
    ageAll(s, 35);
    calm(s);
    for (const [x, y] of [[20, 20], [21, 20], [19, 20], [20, 21], [20, 19]]) addEntity(s, { kind: 'invasivePlant', species: 'cogon', tx: x, ty: y, hp: 1 });
    expect(ignite(s, 20, 20)).toBe(true);
    const rng = mulberry32(3);
    for (let i = 0; i < 6; i++) fireTick(s, rng);
    expect(s.fireToday.tiles).toBeGreaterThan(1);
    burnOut(s, rng);
    expect(s.fires).toHaveLength(0);
    for (let tx = 25; tx < 32; tx++) expect(s.burned[tileIndex(tx, 35)]).toBeLessThan(s.day);
  });

  it('can be doused with water and blocked by a raked firebreak', () => {
    const s = emptyGame();
    ageAll(s, 35);
    for (const [x, y] of [[20, 20], [21, 20], [22, 22]]) addEntity(s, { kind: 'invasivePlant', species: 'cogon', tx: x, ty: y, hp: 1 });
    ignite(s, 20, 20);
    expect(isBurning(s, 20, 20)).toBe(true);
    const water = s.water;
    expect(douse(s, 20, 20)).toBe(true);
    expect(s.water).toBe(water - 1);
    expect(isBurning(s, 20, 20)).toBe(false);
    expect(rake(s, 21, 20)).toBe(true);
    expect(fuelAt(s, 21, 20)).toBe(0);
    s.water = 0;
    ignite(s, 22, 22);
    expect(douse(s, 22, 22)).toBe(false);
  });

  it('lightning uses up the day’s strikes', () => {
    const s = newGame(4);
    s.weather = { kind: 'storm', wind: { x: 0, y: 1 }, windSpeed: 0.6, strikes: 2 };
    const rng = mulberry32(8);
    expect(lightningStrike(s, rng)).not.toBeNull();
    expect(lightningStrike(s, rng)).not.toBeNull();
    expect(lightningStrike(s, rng)).toBeNull();
  });

  it('lets overdue scrub close in with new thickets, after a short grace period', () => {
    const s = newGame(11);
    ageAll(s, 60);
    expect(overgrow(s, mulberry32(1))).toHaveLength(0);
    s.day = 12;
    ageAll(s, 60);
    let grown = 0;
    for (let i = 0; i < 10; i++) grown += overgrow(s, mulberry32(i)).length;
    expect(grown).toBeGreaterThan(0);
    // Overdue ground counts against the habitat.
    const before = zoneHealth(s, 'oak');
    ageAll(s, 25);
    expect(zoneHealth(s, 'oak')).toBeGreaterThan(before);
    expect(zoneFire(s, 'oak').state).toBe('ready');
  });
});

describe('the edges never rest', () => {
  it('keeps sending invasives even when every evening the scrub is spotless', () => {
    const s = newGame(21);
    let arrivals = 0;
    for (let day = 0; day < 40; day++) {
      s.entities = s.entities.filter((e) => e.kind === 'nativePlant' || e.kind === 'burrow' || e.kind === 'nativeAnimal');
      arrivals += nightTick(s).arrivals.length;
    }
    expect(arrivals).toBeGreaterThan(30);
    expect(s.entities.some((e) => e.kind === 'invasivePlant')).toBe(true);
  });

  it('pushes harder over time and after storms', () => {
    const s = emptyGame();
    calm(s);
    const early = incursionPressure(s);
    s.day = 60;
    expect(incursionPressure(s)).toBeGreaterThan(early);
    s.weather = { ...s.weather, kind: 'hurricane' };
    expect(incursionPressure(s)).toBeGreaterThan(early + 3);
    const arrivals = edgeIncursions(s, mulberry32(2));
    expect(arrivals.some((a) => ['balloon', 'plastic', 'can', 'bottle', 'tire'].includes(a.species))).toBe(true);
  });

  it('lands newcomers near the edge, and natives planted there hold the line', () => {
    expect(edgeTiles().every((t) => Math.min(t.tx, t.ty, MAP_W - 1 - t.tx) <= 4 || t.ty >= 39)).toBe(true);
    const run = (guard: boolean) => {
      let n = 0;
      for (let seed = 0; seed < 30; seed++) {
        const s = emptyGame();
        calm(s);
        s.day = 40;
        if (guard) for (const t of edgeTiles()) if ((t.tx + t.ty) % 3 === 0) addEntity<NativePlantEntity>(s, { kind: 'nativePlant', species: 'palmetto', tx: t.tx, ty: t.ty, planted: false, plantedDay: 0, lastSeedDay: 0, rescued: true });
        n += edgeIncursions(s, mulberry32(seed)).filter((a) => a.species === 'cogon' || a.species === 'natal' || a.species === 'pepper' || a.species === 'airpotato').length;
      }
      return n;
    };
    expect(run(true)).toBeLessThan(run(false) * 0.7);
  });
});

describe('prescribed burns and fire actions', () => {
  it('needs the drip torch, ready ground and calm weather', () => {
    const s = emptyGame();
    s.scanned.push('thicket');
    ageAll(s, 30);
    calm(s);
    const thicket = addEntity<HazardEntity>(s, { kind: 'hazard', species: 'thicket', tx: 30, ty: 10, hp: 2 });
    const t = { type: 'entity' as const, entity: thicket };
    expect(find(s, t, 'ignite')).toMatchObject({ enabled: false, needLevel: 4 });
    s.level = 4;
    expect(find(s, t, 'ignite')!.enabled).toBe(true);
    s.weather.kind = 'breezy';
    expect(find(s, t, 'ignite')!.enabled).toBe(false);
    calm(s);
    s.burned[tileIndex(30, 10)] = s.day - 2;
    ageAll(s, 5);
    expect(find(s, t, 'ignite')!.enabled).toBe(false);
    ageAll(s, 30);
    const res = performAction(s, find(s, t, 'ignite')!);
    expect(res.fireAt).toEqual({ tx: 30, ty: 10 });
    expect(s.entities).not.toContain(thicket);
    expect(s.fires.length).toBe(1);
  });

  it('offers to contain or watch a fire, and opens the fire-line mini-game', () => {
    const s = emptyGame();
    const target = { type: 'fire' as const, tx: 20, ty: 20 };
    expect(getActions(s, target).map((a) => a.verb)).toEqual(['contain', 'watchFire', 'info']);
    expect(performAction(s, find(s, target, 'contain')!).play).toBe('fireLine');
    s.water = 0;
    expect(find(s, target, 'contain')!.enabled).toBe(false);
  });
});

describe('fire review regressions', () => {
  it('never charges for a prescribed burn where nothing can burn', () => {
    const s = emptyGame();
    s.scanned.push('thicket');
    s.level = 4;
    ageAll(s, 30);
    calm(s);
    const thicket = addEntity<HazardEntity>(s, { kind: 'hazard', species: 'thicket', tx: 30, ty: 10, hp: 2 });
    rake(s, 30, 10);
    const a = find(s, { type: 'entity', entity: thicket }, 'ignite')!;
    expect(a.enabled).toBe(false);
    const before = s.battery;
    expect(performAction(s, { ...a, enabled: true }).ok).toBe(false);
    expect(s.battery).toBe(before);
  });

  it('starts sand and oak scrub ready for fire, so fire bonuses are earned', () => {
    for (const seed of [1, 2, 3]) {
      const s = newGame(seed);
      expect(zoneFire(s, 'sand').fresh).toBe(0);
      expect(zoneFire(s, 'oak').fresh).toBe(0);
      expect(zoneFire(s, 'rosemary').fresh).toBeGreaterThan(0);
    }
  });

  it('does not ask for seeds from plants still resprouting', async () => {
    const { planTasks } = await import('../src/systems/tasks');
    const s = emptyGame();
    addEntity<NativePlantEntity>(s, { kind: 'nativePlant', species: 'oak', tx: 30, ty: 10, planted: false, plantedDay: 0, lastSeedDay: 0, rescued: true, burnedDay: s.day - 1 });
    for (let seed = 0; seed < 20; seed++) expect(planTasks(s, mulberry32(seed)).some((t) => t.kind === 'seeds')).toBe(false);
  });
});

describe('weather in play', () => {
  it('lets cold-stunned iguanas be scooped up cheaply', () => {
    const s = emptyGame();
    s.scanned.push('iguana');
    const ig = addEntity(s, { kind: 'invasiveAnimal', species: 'iguana', x: 900, y: 300, home: 'oak' });
    calm(s);
    expect(find(s, { type: 'entity', entity: ig }, 'capture')!.cost).toBe(5);
    s.weather.kind = 'cold';
    expect(find(s, { type: 'entity', entity: ig }, 'capture')!.cost).toBe(2);
  });

  it('soaks young plantings on rainy nights so they grow faster', () => {
    const s = emptyGame();
    s.weather = { kind: 'rain', wind: { x: 0, y: 1 }, windSpeed: 0.2, strikes: 0 };
    s.seedlings.oak = 1;
    doVerb(s, { type: 'self', spot: { tx: 30, ty: 8 } }, 'plant', 'oak');
    expect(nightTick(s).soaked).toBe(1);
    const oak = s.entities.find((e) => e.kind === 'nativePlant' && e.planted) as NativePlantEntity;
    expect(oak.boost).toBe(1);
  });

  it('reports the new day’s weather, tomorrow’s forecast, and new seasons', () => {
    const s = emptyGame();
    s.day = 7;
    const night = nightTick(s);
    expect(night.weather).toEqual(rollWeather(s.seed, 8));
    expect(night.forecast).toBe(rollWeather(s.seed, 9).kind);
    expect(night.season).toBe('summer');
  });
});

describe('saves', () => {
  it('migrates a v2 save with fire history, weather, levels and tasks', () => {
    const v2 = JSON.parse(JSON.stringify(newGame(3))) as Record<string, unknown>;
    for (const k of ['weather', 'burned', 'fires', 'firebreaks', 'seedbank', 'fireToday', 'water', 'waterMax', 'xp', 'level', 'tasks', 'portraits', 'guests', 'bagItems']) delete v2[k];
    v2.version = 2;
    v2.day = 9;
    v2.bag = 2;
    (v2.stats as Record<string, number>).invasivesRemoved = 40;
    const s = migrate(v2)!;
    expect(s.version).toBe(3);
    expect(s.burned).toHaveLength(newGame(3).burned.length);
    expect(s.weather).toEqual(rollWeather(3, 9));
    expect(s.level).toBeGreaterThan(1);
    expect(s.bagItems).toHaveLength(2);
    expect(Array.isArray(s.tasks)).toBe(true);
    expect(zoneFire(s, 'oak').ready).toBeGreaterThan(0);
  });

  it('keeps stations out of the fire', () => {
    const s = emptyGame();
    ageAll(s, 40);
    for (const st of STATIONS) expect(fuelAt(s, st.tx, st.ty)).toBe(0);
  });
});
