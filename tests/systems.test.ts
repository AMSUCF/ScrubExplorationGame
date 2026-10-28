import { describe, expect, it } from 'vitest';
import { BAG_CAPACITY, GROW_NIGHTS } from '../src/config';
import { homeLayout } from '../src/data/home';
import { STATIONS, zoneAt } from '../src/data/map';
import { getActions, performAction } from '../src/systems/actions';
import { spend } from '../src/systems/battery';
import { nightTick } from '../src/systems/dayCycle';
import { JAY_OAKS, spreadCogon, zoneHealth } from '../src/systems/habitat';
import { buyUpgrade, upgradeStatus } from '../src/systems/home';
import { growNight, pot, sow, trayStage, water } from '../src/systems/nursery';
import { findPath } from '../src/systems/pathfind';
import { canArrive, recordSighting, unmetNeeds } from '../src/systems/population';
import { mulberry32 } from '../src/systems/rng';
import { loadGame, migrate, saveGame } from '../src/systems/save';
import { NativePlantEntity, addEntity, isChoked, newGame } from '../src/systems/state';
import { doVerb, emptyGame, find, memoryStorage } from './helpers';

const pad = STATIONS.find((s) => s.kind === 'pad')!;
const slot = (s: ReturnType<typeof emptyGame>, i: number) =>
  homeLayout(s.homeLevel, s.trays.length, s.vases.length).find((it) => it.kind === 'slot' && it.index === i)!;

describe('new game layout', () => {
  it('is deterministic for a seed', () => {
    expect(JSON.stringify(newGame(7).entities)).toBe(JSON.stringify(newGame(7).entities));
  });

  it('keeps the base clear and starts natives choked', () => {
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
});

describe('nursery', () => {
  it('only grows watered trays and is ready after enough nights', () => {
    const s = emptyGame();
    s.seeds.oak = 1;
    expect(sow(s, 0, 'oak')).toBe('oak');
    expect(trayStage(s.trays[0])).toBe('sown');
    growNight(s);
    expect(s.trays[0].growth).toBe(0);
    for (let i = 0; i < GROW_NIGHTS; i++) {
      expect(water(s, 0)).toBe(true);
      growNight(s);
    }
    expect(trayStage(s.trays[0])).toBe('ready');
    expect(pot(s, 0)).toBe('oak');
    expect(s.seedlings.oak).toBe(1);
  });
});

describe('actions', () => {
  it('scans unknown species first, then offers removal plus a guide link', () => {
    const s = emptyGame();
    const cogon = addEntity(s, { kind: 'invasivePlant', species: 'cogon', tx: 5, ty: 20, hp: 1 });
    const t = { type: 'entity' as const, entity: cogon };
    expect(getActions(s, t).map((a) => a.verb)).toEqual(['scan']);
    expect(performAction(s, getActions(s, t)[0]).scanned).toBe('cogon');
    expect(getActions(s, t).map((a) => a.verb)).toEqual(['remove', 'dig', 'info']);
    // Digging out roots is a later tool: shown, but locked until its level.
    expect(find(s, t, 'dig')).toMatchObject({ enabled: false, needLevel: 3 });
    expect(doVerb(s, t, 'remove')).toBe(true);
    expect(s.entities).toHaveLength(0);
  });

  it('rescues a choked native, then gives seeds and a sprig once a day', () => {
    const s = emptyGame();
    s.scanned.push('cogon', 'palmetto');
    const palm = addEntity<NativePlantEntity>(s, {
      kind: 'nativePlant', species: 'palmetto', tx: 5, ty: 20, planted: false, plantedDay: 0, lastSeedDay: 0, rescued: false,
    });
    const cogon = addEntity(s, { kind: 'invasivePlant', species: 'cogon', tx: 6, ty: 20, hp: 1 });
    const pt = { type: 'entity' as const, entity: palm };
    expect(find(s, pt, 'collect')!.enabled).toBe(false);
    const res = performAction(s, find(s, { type: 'entity', entity: cogon }, 'remove')!);
    expect(res.rescued.map((r) => r.id)).toEqual([palm.id]);
    expect(doVerb(s, pt, 'collect')).toBe(true);
    expect(doVerb(s, pt, 'snip')).toBe(true);
    expect(s.seeds.palmetto).toBe(1);
    expect(s.sprigs.palmetto).toBe(1);
    expect(find(s, pt, 'collect')!.enabled).toBe(false);
    expect(find(s, pt, 'snip')!.enabled).toBe(false);
  });

  it('blocks trash pickup when the bag is full, showing the bag icon', () => {
    const s = emptyGame();
    s.scanned.push('tire');
    s.bag = BAG_CAPACITY;
    const tire = addEntity(s, { kind: 'hazard', species: 'tire', tx: 5, ty: 20, hp: 1 });
    const a = find(s, { type: 'entity', entity: tire }, 'remove')!;
    expect(a.enabled).toBe(false);
    expect(a.block).toBe('🎒');
  });

  it('crates one big animal at a time and sends an adoption postcard', () => {
    const s = emptyGame();
    s.scanned.push('cat', 'tegu');
    const cat = addEntity(s, { kind: 'invasiveAnimal', species: 'cat', x: 100, y: 600, home: 'sand' });
    const tegu = addEntity(s, { kind: 'invasiveAnimal', species: 'tegu', x: 140, y: 600, home: 'sand' });
    expect(doVerb(s, { type: 'entity', entity: cat }, 'capture')).toBe(true);
    expect(find(s, { type: 'entity', entity: tegu }, 'capture')!.enabled).toBe(false);
    expect(doVerb(s, { type: 'station', station: pad }, 'dropoff')).toBe(true);
    const night = nightTick(s);
    expect(night.postcards[0]).toMatchObject({ kind: 'adopted', species: 'cat' });
  });

  it('plants a chosen seedling from the self menu, never at base', () => {
    const s = emptyGame();
    s.seedlings.rosemary = 1;
    expect(doVerb(s, { type: 'self', spot: { tx: 28, ty: 35 } }, 'plant', 'rosemary')).toBe(false);
    expect(doVerb(s, { type: 'self', spot: { tx: 47, ty: 29 } }, 'plant', 'rosemary')).toBe(true);
    expect(s.entities.some((e) => e.kind === 'nativePlant' && e.planted)).toBe(true);
  });

  it('runs sow → water → pot through hydroponic slots, choosing the species', () => {
    const s = emptyGame();
    s.seeds.rosemary = 2;
    s.seeds.oak = 1;
    const t = { type: 'home' as const, item: slot(s, 0) };
    expect(getActions(s, t).map((a) => a.param)).toEqual(['rosemary', 'oak']);
    expect(doVerb(s, t, 'sow', 'oak')).toBe(true);
    expect(doVerb(s, t, 'water')).toBe(true);
    expect(find(s, t, 'water')!.enabled).toBe(false);
  });

  it('arranges sprigs in a vase', () => {
    const s = emptyGame();
    s.sprigs.rosemary = 4;
    const vase = { type: 'home' as const, item: homeLayout(0, 4, 1).find((i) => i.kind === 'vase')! };
    for (let i = 0; i < 4; i++) doVerb(s, vase, 'arrange', 'rosemary');
    expect(s.vases[0]).toHaveLength(3);
    expect(doVerb(s, vase, 'clearVase')).toBe(true);
    expect(s.vases[0]).toHaveLength(0);
  });
});

describe('home upgrades', () => {
  it('spends parts and respects milestones', () => {
    const s = emptyGame();
    s.parts = 20;
    expect(buyUpgrade(s, 'slots')).toBe(true);
    expect(s.trays).toHaveLength(6);
    expect(upgradeStatus(s, 'slots')).toMatchObject({ ok: false, block: 'max' });
    expect(upgradeStatus(s, 'room')).toMatchObject({ ok: false, block: 'milestone', needs: 'tortoise' });
    s.returned.push('tortoise');
    expect(buyUpgrade(s, 'room')).toBe(true);
    expect(s.homeLevel).toBe(1);
    expect(upgradeStatus(s, 'slots').ok).toBe(true);
    s.parts = 0;
    expect(upgradeStatus(s, 'vase')).toMatchObject({ ok: false, block: 'parts' });
  });
});

describe('habitat & wildlife', () => {
  it('scores zones lower with invasives', () => {
    const s = emptyGame();
    const clean = zoneHealth(s, 'sand');
    addEntity(s, { kind: 'invasivePlant', species: 'cogon', tx: 5, ty: 20, hp: 1 });
    expect(zoneHealth(s, 'sand')).toBeLessThan(clean);
  });

  it('spreads cogon deterministically and never into base', () => {
    const s = emptyGame();
    for (let i = 0; i < 10; i++) addEntity(s, { kind: 'invasivePlant', species: 'cogon', tx: 3 + i * 2, ty: 20, hp: 1 });
    expect(spreadCogon(s, mulberry32(1))).toBeGreaterThan(0);
    expect(s.entities.every((e) => !('tx' in e) || zoneAt(e.tx, e.ty) !== 'base')).toBe(true);
  });

  it('brings the tortoise, then the mouse, and grows populations', () => {
    const s = emptyGame();
    expect(nightTick(s).arrived).toEqual(['tortoise']);
    expect(nightTick(s).arrived).toContain('mouse');
    for (let i = 0; i < 4; i++) nightTick(s);
    expect(s.populations.tortoise).toBeGreaterThan(1);
    expect(s.history.length).toBeGreaterThan(3);
  });

  it('shrinks gently (never below 1) and shows the worry when a need is unmet', () => {
    const s = emptyGame();
    s.returned.push('tortoise');
    s.populations.tortoise = 3;
    addEntity(s, { kind: 'invasiveAnimal', species: 'tegu', x: 200, y: 700, home: 'sand' });
    expect(unmetNeeds(s, 'tortoise').map((n) => n.icon)).toEqual(['tegu']);
    for (let i = 0; i < 5; i++) nightTick(s);
    expect(s.populations.tortoise).toBe(1);
  });

  it('keeps the jay away while a feral cat prowls', () => {
    const s = emptyGame();
    for (let i = 0; i < JAY_OAKS; i++) {
      addEntity<NativePlantEntity>(s, {
        kind: 'nativePlant', species: 'oak', tx: 26 + i * 2, ty: 6, planted: false, plantedDay: 0, lastSeedDay: 0, rescued: true,
      });
    }
    expect(canArrive(s, 'jay')).toBe(true);
    addEntity(s, { kind: 'invasiveAnimal', species: 'cat', x: 900, y: 200, home: 'oak' });
    expect(canArrive(s, 'jay')).toBe(false);
  });

  it('counts one sighting per species per day and takes a photo the first time', () => {
    const s = emptyGame();
    expect(recordSighting(s, 'jay')).toEqual({ counted: true, firstEver: true });
    expect(recordSighting(s, 'jay')).toEqual({ counted: false, firstEver: false });
    nightTick(s);
    expect(recordSighting(s, 'jay')).toEqual({ counted: true, firstEver: false });
    expect(s.sightings.jay).toBe(2);
    expect(s.photos).toHaveLength(1);
  });
});

describe('pathfinding', () => {
  it('routes around walls', () => {
    const wall = new Set(['2,0', '2,1', '2,2', '2,3']);
    const grid = { w: 6, h: 6, blocked: (x: number, y: number) => wall.has(`${x},${y}`) };
    const path = findPath(grid, { tx: 0, ty: 0 }, (t) => t.tx === 4 && t.ty === 0, { tx: 4, ty: 0 })!;
    expect(path.at(-1)).toEqual({ tx: 4, ty: 0 });
    expect(path.every((t) => !wall.has(`${t.tx},${t.ty}`))).toBe(true);
    expect(findPath({ ...grid, blocked: (x) => x === 2 }, { tx: 0, ty: 0 }, (t) => t.tx === 4, { tx: 4, ty: 0 })).toBeNull();
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

  it('migrates a v1 save', () => {
    const v1 = { version: 1, day: 3, returned: ['tortoise'], postcards: [{ title: 'x' }], selectedSeed: 'oak', trays: [] } as Record<string, unknown>;
    const s = migrate(v1)!;
    expect(s.version).toBe(3);
    expect(s.populations).toEqual({ tortoise: 1 });
    expect(s.vases).toEqual([[]]);
    expect(s.postcards).toEqual([]);
  });

  it('rejects unknown versions and junk', () => {
    expect(migrate({ version: 999 })).toBeNull();
    expect(migrate({})).toBeNull();
    const storage = memoryStorage();
    storage.setItem('scrubbot.save', '{not json');
    expect(loadGame(storage)).toBeNull();
  });
});
