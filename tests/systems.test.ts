import { describe, expect, it } from 'vitest';
import { BAG_CAPACITY, GROW_NIGHTS } from '../src/config';
import { STATIONS, zoneAt } from '../src/data/map';
import { getAction, performAction } from '../src/systems/actions';
import { spend, upgrade } from '../src/systems/battery';
import { nightTick } from '../src/systems/dayCycle';
import { JAY_OAKS, RETURN_CONDITIONS, spreadCogon, zoneHealth } from '../src/systems/habitat';
import { growNight, pot, sow, trayStage, water } from '../src/systems/nursery';
import { mulberry32 } from '../src/systems/rng';
import { loadGame, migrate, saveGame } from '../src/systems/save';
import { GameState, NativePlantEntity, addEntity, isChoked, newGame } from '../src/systems/state';

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

function emptyGame(): GameState {
  const s = newGame(42);
  s.entities = [];
  return s;
}

const tray0 = STATIONS.find((s) => s.kind === 'tray' && s.index === 0)!;

describe('new game layout', () => {
  it('is deterministic for a seed', () => {
    expect(JSON.stringify(newGame(7).entities)).toBe(JSON.stringify(newGame(7).entities));
  });

  it('keeps the base clear apart from stations and starts natives choked', () => {
    const s = newGame(123);
    const inBase = s.entities.filter((e) => 'tx' in e && zoneAt(e.tx, e.ty) === 'base');
    expect(inBase).toHaveLength(0);
    const natives = s.entities.filter((e): e is NativePlantEntity => e.kind === 'nativePlant');
    expect(natives.length).toBeGreaterThan(10);
    expect(natives.some((n) => isChoked(s, n))).toBe(true);
  });
});

describe('battery', () => {
  it('refuses to spend more than it has', () => {
    const s = emptyGame();
    s.battery = 3;
    expect(spend(s, 5)).toBe(false);
    expect(s.battery).toBe(3);
    expect(spend(s, 3)).toBe(true);
    expect(s.battery).toBe(0);
  });

  it('upgrades with parts', () => {
    const s = emptyGame();
    s.parts = 4;
    expect(upgrade(s)).toBe(true);
    expect(s.batteryMax).toBe(125);
    expect(upgrade(s)).toBe(false);
  });
});

describe('nursery', () => {
  it('only grows watered trays and is ready after enough nights', () => {
    const s = emptyGame();
    s.seeds.oak = 1;
    expect(sow(s, 0)).toBe('oak');
    expect(trayStage(s.trays[0])).toBe('sown');
    growNight(s); // not watered
    expect(s.trays[0].growth).toBe(0);
    for (let i = 0; i < GROW_NIGHTS; i++) {
      expect(water(s, 0)).toBe(true);
      growNight(s);
    }
    expect(trayStage(s.trays[0])).toBe('ready');
    expect(pot(s, 0)).toBe('oak');
    expect(s.seedlings.oak).toBe(1);
    expect(trayStage(s.trays[0])).toBe('empty');
  });
});

describe('context actions', () => {
  it('scans unknown species first, then removes them', () => {
    const s = emptyGame();
    const cogon = addEntity(s, { kind: 'invasivePlant', species: 'cogon', tx: 5, ty: 20, hp: 1 });
    const target = { type: 'entity' as const, entity: cogon };
    const scan = getAction(s, target, null)!;
    expect(scan.verb).toBe('scan');
    expect(performAction(s, scan).scanned).toBe('cogon');
    const pull = getAction(s, target, null)!;
    expect(pull.verb).toBe('remove');
    performAction(s, pull);
    expect(s.entities).toHaveLength(0);
    expect(s.stats.invasivesRemoved).toBe(1);
  });

  it('rescues a choked native when its invasive neighbour is removed', () => {
    const s = emptyGame();
    s.scanned.push('cogon', 'palmetto');
    const palm = addEntity<NativePlantEntity>(s, {
      kind: 'nativePlant', species: 'palmetto', tx: 5, ty: 20, planted: false, plantedDay: 0, lastSeedDay: 0, rescued: false,
    });
    const cogon = addEntity(s, { kind: 'invasivePlant', species: 'cogon', tx: 6, ty: 20, hp: 1 });
    expect(getAction(s, { type: 'entity', entity: palm }, null)!.enabled).toBe(false);
    const res = performAction(s, getAction(s, { type: 'entity', entity: cogon }, null)!);
    expect(res.rescued.map((r) => r.id)).toEqual([palm.id]);
    const collect = getAction(s, { type: 'entity', entity: palm }, null)!;
    expect(collect.verb).toBe('collect');
    performAction(s, collect);
    expect(s.seeds.palmetto).toBe(1);
    expect(getAction(s, { type: 'entity', entity: palm }, null)!.enabled).toBe(false);
  });

  it('blocks trash pickup when the bag is full', () => {
    const s = emptyGame();
    s.scanned.push('tire');
    s.bag = BAG_CAPACITY;
    const tire = addEntity(s, { kind: 'hazard', species: 'tire', tx: 5, ty: 20, hp: 1 });
    expect(getAction(s, { type: 'entity', entity: tire }, null)!.enabled).toBe(false);
  });

  it('crates one big animal at a time and drops it at the pad', () => {
    const s = emptyGame();
    s.scanned.push('cat', 'tegu');
    const cat = addEntity(s, { kind: 'invasiveAnimal', species: 'cat', x: 100, y: 600, home: 'sand' });
    const tegu = addEntity(s, { kind: 'invasiveAnimal', species: 'tegu', x: 140, y: 600, home: 'sand' });
    performAction(s, getAction(s, { type: 'entity', entity: cat }, null)!);
    expect(s.crate?.species).toBe('cat');
    expect(getAction(s, { type: 'entity', entity: tegu }, null)!.enabled).toBe(false);
    const pad = STATIONS.find((st) => st.kind === 'pad')!;
    performAction(s, getAction(s, { type: 'station', station: pad }, null)!);
    expect(s.crate).toBeNull();
    const summary = nightTick(s);
    expect(summary.postcards[0].title).toMatch(/adopted/);
  });

  it('offers planting on a free tile when holding a seedling', () => {
    const s = emptyGame();
    s.seedlings.rosemary = 1;
    const a = getAction(s, null, { tx: 47, ty: 29 })!;
    expect(a.verb).toBe('plant');
    performAction(s, a);
    expect(s.entities.some((e) => e.kind === 'nativePlant' && e.planted)).toBe(true);
    expect(getAction(s, null, { tx: 28, ty: 35 })).toBeNull(); // base tiles can't be planted
  });

  it('runs the sow → water → pot loop through tray stations', () => {
    const s = emptyGame();
    s.seeds.rosemary = 2;
    const t = { type: 'station' as const, station: tray0 };
    expect(getAction(s, t, null)!.verb).toBe('sow');
    performAction(s, getAction(s, t, null)!);
    expect(getAction(s, t, null)!.verb).toBe('water');
    performAction(s, getAction(s, t, null)!);
    expect(getAction(s, t, null)!.enabled).toBe(false);
  });
});

describe('habitat', () => {
  it('scores zones lower with invasives', () => {
    const s = emptyGame();
    const clean = zoneHealth(s, 'sand');
    addEntity(s, { kind: 'invasivePlant', species: 'cogon', tx: 5, ty: 20, hp: 1 });
    expect(zoneHealth(s, 'sand')).toBeLessThan(clean);
  });

  it('spreads cogon deterministically and never into base', () => {
    const s = emptyGame();
    for (let i = 0; i < 10; i++) addEntity(s, { kind: 'invasivePlant', species: 'cogon', tx: 3 + i * 2, ty: 20, hp: 1 });
    const n = spreadCogon(s, mulberry32(1));
    expect(n).toBeGreaterThan(0);
    expect(s.entities.every((e) => !('tx' in e) || zoneAt(e.tx, e.ty) !== 'base')).toBe(true);
  });

  it('brings the tortoise, then the mouse, back to a clean sand scrub', () => {
    const s = emptyGame();
    const first = nightTick(s);
    expect(first.returned).toContain('tortoise');
    expect(first.returned).not.toContain('mouse');
    const second = nightTick(s);
    expect(second.returned).toContain('mouse');
  });

  it('keeps the jay away while a feral cat prowls', () => {
    const s = emptyGame();
    for (let i = 0; i < JAY_OAKS; i++) {
      addEntity<NativePlantEntity>(s, {
        kind: 'nativePlant', species: 'oak', tx: 28 + i * 2, ty: 6, planted: false, plantedDay: 0, lastSeedDay: 0, rescued: true,
      });
    }
    const jay = RETURN_CONDITIONS.find((c) => c.species === 'jay')!;
    expect(jay.met(s)).toBe(true);
    addEntity(s, { kind: 'invasiveAnimal', species: 'cat', x: 900, y: 200, home: 'oak' });
    expect(jay.met(s)).toBe(false);
  });
});

describe('save', () => {
  it('round-trips through storage', () => {
    const storage = memoryStorage();
    const s = newGame(9);
    s.day = 4;
    expect(saveGame(s, storage)).toBe(true);
    expect(loadGame(storage)).toEqual(s);
  });

  it('rejects unknown versions and junk', () => {
    expect(migrate({ version: 999 })).toBeNull();
    expect(migrate({})).toBeNull();
    const storage = memoryStorage();
    storage.setItem('scrubbot.save', '{not json');
    expect(loadGame(storage)).toBeNull();
  });
});
