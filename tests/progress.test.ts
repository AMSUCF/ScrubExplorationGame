import { describe, expect, it } from 'vitest';
import { STATIONS } from '../src/data/map';
import { getActions, performAction } from '../src/systems/actions';
import { fireTick, ignite, tileIndex } from '../src/systems/fire';
import { fireLineTap, fireWindow, flamesInView, nativesInView, scoreFireLine, windowCells } from '../src/systems/minigames/fireLine';
import { animalPose, lensFocus, recordPortrait, shotStars } from '../src/systems/minigames/portrait';
import { digComplete, digOut, digStars, generateRhizome, newDig, traceStroke } from '../src/systems/minigames/rhizome';
import { logGuests, planBurrow } from '../src/systems/minigames/burrowScope';
import { BIN_OF, bagContents, finishSort } from '../src/systems/minigames/sorting';
import { TOOL_LEVEL, addXp, credit, levelFor, levelProgress, xpForLevel } from '../src/systems/progress';
import { mulberry32 } from '../src/systems/rng';
import { BurrowEntity, InvasivePlantEntity, NativePlantEntity, addEntity, newGame } from '../src/systems/state';
import { planTasks } from '../src/systems/tasks';
import { doVerb, emptyGame, find } from './helpers';

const recycler = STATIONS.find((s) => s.kind === 'recycler')!;

describe('stewardship levels', () => {
  it('climbs through levels forever, unlocking tools along the way', () => {
    expect(levelFor(0)).toBe(1);
    expect(levelFor(xpForLevel(4))).toBe(4);
    expect(levelFor(xpForLevel(14) + 1)).toBe(14);
    const s = emptyGame();
    const ups = addXp(s, xpForLevel(5));
    expect(s.level).toBe(5);
    expect(ups.map((u) => u.level)).toEqual([2, 3, 4, 5]);
    expect(ups.flatMap((u) => u.unlocks.map((x) => x.name))).toEqual(['Wildlife camera', 'Rhizome probe', 'Drip torch', 'Burrow scope']);
    expect(Object.values(TOOL_LEVEL).sort()).toEqual([2, 3, 4, 5]);
    expect(levelProgress(s)).toMatchObject({ level: 5, into: 0 });
  });

  it('applies lasting perks at higher levels', () => {
    const s = emptyGame();
    const tank = s.waterMax, battery = s.batteryMax;
    addXp(s, xpForLevel(8));
    expect(s.waterMax).toBe(tank + 3);
    expect(s.batteryMax).toBe(battery + 15);
    const parts = s.parts;
    addXp(s, xpForLevel(12) - s.xp);
    expect(s.parts).toBeGreaterThan(parts);
  });

  it('earns care points and goal progress from everyday actions', () => {
    const s = emptyGame();
    s.scanned.push('cogon');
    s.tasks = [{ kind: 'clear', label: 'Clear 2 invasive plants', icon: '✊', goal: 2, progress: 0, done: false, reward: 2 }];
    const a = addEntity(s, { kind: 'invasivePlant', species: 'cogon', tx: 5, ty: 20, hp: 1 });
    const b = addEntity(s, { kind: 'invasivePlant', species: 'cogon', tx: 9, ty: 20, hp: 1 });
    const first = performAction(s, find(s, { type: 'entity', entity: a }, 'remove')!);
    expect(first.xp).toBeGreaterThan(0);
    expect(s.tasks[0].progress).toBe(1);
    const parts = s.parts;
    const second = performAction(s, find(s, { type: 'entity', entity: b }, 'remove')!);
    expect(second.tasks?.map((t) => t.kind)).toEqual(['clear']);
    expect(second.allDone).toBe(true);
    expect(s.parts).toBe(parts + 2 + 2);
  });
});

describe('workshop', () => {
  it('sells a bigger water tank for fire season, three times', () => {
    const s = emptyGame();
    s.parts = 20;
    const bench = { type: 'home' as const, item: { kind: 'bench' as const, x: 2, y: 7, bw: 2, bh: 1, interactive: true } };
    const tank = () => find(s, bench, 'upgrade', 'tank')!;
    const before = s.waterMax;
    for (let i = 0; i < 3; i++) expect(performAction(s, tank()).ok).toBe(true);
    expect(s.waterMax).toBe(before + 6);
    expect(tank().enabled).toBe(false);
  });
});

describe('daily goals', () => {
  it('picks three goals that make sense for today', () => {
    const s = newGame(5);
    const tasks = planTasks(s, mulberry32(1));
    expect(tasks).toHaveLength(3);
    expect(new Set(tasks.map((t) => t.kind)).size).toBe(3);
    // Locked tools never show up as goals.
    expect(tasks.some((t) => t.kind === 'photo' || t.kind === 'dig' || t.kind === 'scope' || t.kind === 'prescribe')).toBe(false);
    const empty = emptyGame();
    empty.seeds.oak = 0;
    expect(planTasks(empty, mulberry32(1)).every((t) => t.kind !== 'clear')).toBe(true);
  });

  it('pays its reward once', () => {
    const s = emptyGame();
    s.tasks = [{ kind: 'greet', label: 'Say hi', icon: '💛', goal: 1, progress: 0, done: false, reward: 1 }];
    const before = s.parts;
    credit(s, 'greet');
    credit(s, 'greet');
    expect(s.parts).toBe(before + 1 + 2);
  });
});

describe('fire line mini-game', () => {
  it('sprays flames, rakes breaks, and scores what it protected', () => {
    const s = emptyGame();
    s.burned = s.burned.map(() => s.day - 30);
    s.weather = { kind: 'clear', wind: { x: 1, y: 0 }, windSpeed: 0.1, strikes: 0 };
    for (let x = 18; x <= 22; x++) addEntity(s, { kind: 'invasivePlant', species: 'cogon', tx: x, ty: 20, hp: 1 });
    const oak = addEntity<NativePlantEntity>(s, { kind: 'nativePlant', species: 'oak', tx: 23, ty: 20, planted: false, plantedDay: 0, lastSeedDay: 0, rescued: true });
    ignite(s, 20, 20);
    const view = fireWindow(20, 20);
    const before = nativesInView(s, view);
    expect(before).toContain(oak.id);
    expect(windowCells(s, view)).toHaveLength(81);
    expect(windowCells(s, view).find((c) => c.tx === 20 && c.ty === 20)!.burning).toBe(true);
    expect(fireLineTap(s, 22, 20)).toBe('rake');
    expect(fireLineTap(s, 20, 20)).toBe('douse');
    // Put out anything that caught meanwhile.
    for (let i = 0; i < 8 && flamesInView(s, view); i++) {
      for (const f of [...s.fires]) fireLineTap(s, f.tx, f.ty);
      fireTick(s, mulberry32(i));
    }
    const score = scoreFireLine(s, view, before, 0);
    expect(score.contained).toBe(true);
    expect(score.lost).toBe(0);
    expect(score.stars).toBe(3);
    s.battery = 0;
    expect(fireLineTap(s, 21, 22)).toBe('noEnergy');
  });
});

describe('portrait mini-game', () => {
  it('rewards framing, focus and a signature pose', () => {
    expect(shotStars({ dx: 0, dy: 0, hidden: false, focus: 1, pose: true })).toBe(3);
    expect(shotStars({ dx: 0.05, dy: 0, hidden: false, focus: 0.7, pose: false })).toBe(2);
    expect(shotStars({ dx: 0.3, dy: 0.1, hidden: false, focus: 0.3, pose: false })).toBe(0);
    expect(shotStars({ dx: 0, dy: 0, hidden: true, focus: 1, pose: true })).toBe(0);
    expect(lensFocus(Math.PI / 2 / 2.1)).toBeCloseTo(1);
  });

  it('moves each species in its own way, inside the scene', () => {
    for (const sp of ['tortoise', 'mouse', 'jay', 'indigo'] as const) {
      let poses = 0;
      for (let t = 0; t < 30; t += 0.25) {
        const p = animalPose(sp, t, 3);
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(1);
        if (p.pose) poses++;
      }
      expect(poses).toBeGreaterThan(0);
    }
    expect(Array.from({ length: 60 }, (_, i) => animalPose('mouse', i * 0.5, 2).hidden).some(Boolean)).toBe(true);
  });

  it('keeps the best portrait and rewards the first 3-star shot', () => {
    const s = emptyGame();
    expect(recordPortrait(s, 'jay', 2)).toMatchObject({ improved: true, reward: 0 });
    expect(recordPortrait(s, 'jay', 1)).toMatchObject({ improved: false, best: 2 });
    const parts = s.parts;
    expect(recordPortrait(s, 'jay', 3).reward).toBe(2);
    expect(s.parts).toBe(parts + 2);
    expect(recordPortrait(s, 'jay', 3).reward).toBe(0);
  });
});

describe('rhizome dig mini-game', () => {
  it('only counts runners traced outward from the clump', () => {
    const r = generateRhizome(7);
    expect(r.tips.length).toBeGreaterThanOrEqual(3);
    const p = newDig(r);
    // Tapping a far tip on its own finds nothing: it isn't connected to traced runner yet.
    expect(traceStroke(r, p, [r.nodes[r.tips[0]]])).toBe(0);
    // Tracing every branch from the clump outward finds them all.
    for (const tip of r.tips) {
      const chain: number[] = [];
      for (let i = tip; i >= 0; i = r.parent[i]) chain.unshift(i);
      traceStroke(r, p, chain.map((i) => r.nodes[i]));
    }
    expect(digComplete(r, p)).toBe(true);
    expect(digStars(r, p, 15)).toBe(3);
    expect(digStars(r, newDig(r), 15)).toBe(0);
  });

  it('a clean dig lifts the whole connected patch for good', () => {
    const s = emptyGame();
    const clump = addEntity<InvasivePlantEntity>(s, { kind: 'invasivePlant', species: 'cogon', tx: 10, ty: 20, hp: 1 });
    addEntity(s, { kind: 'invasivePlant', species: 'cogon', tx: 11, ty: 20, hp: 1 });
    addEntity(s, { kind: 'invasivePlant', species: 'cogon', tx: 12, ty: 21, hp: 1 });
    addEntity(s, { kind: 'invasivePlant', species: 'cogon', tx: 20, ty: 20, hp: 1 });
    expect(digOut(s, clump, true).removed).toBe(3);
    expect(s.entities.filter((e) => e.kind === 'invasivePlant')).toHaveLength(1);
    expect(s.seedbank.some((sp) => sp.species === 'cogon')).toBe(false);
    const other = s.entities.find((e) => e.kind === 'invasivePlant') as InvasivePlantEntity;
    digOut(s, other, false);
    expect(s.seedbank.some((sp) => sp.species === 'cogon' && sp.tx === 20)).toBe(true);
  });

  it('is launched from the cogon tray once the probe is unlocked', () => {
    const s = emptyGame();
    s.scanned.push('cogon');
    s.level = 3;
    const c = addEntity(s, { kind: 'invasivePlant', species: 'cogon', tx: 10, ty: 20, hp: 1 });
    const res = performAction(s, find(s, { type: 'entity', entity: c }, 'dig')!);
    expect(res.play).toBe('dig');
  });
});

describe('burrow scope mini-game', () => {
  it('finds small burrow neighbors, plus the tortoise at the bottom', () => {
    const s = emptyGame();
    s.populations.tortoise = 1;
    const burrow = addEntity<BurrowEntity>(s, { kind: 'burrow', tx: 10, ty: 22 });
    const guests = planBurrow(s, burrow);
    expect(guests.at(-1)).toMatchObject({ id: 'tortoise' });
    expect(guests.every((g) => g.depth > 0 && g.depth < 1)).toBe(true);
    expect(planBurrow(s, burrow)).toEqual(guests);
    s.level = 5;
    expect(doVerb(s, { type: 'entity', entity: burrow }, 'scope')).toBe(true);
    expect(find(s, { type: 'entity', entity: burrow }, 'scope')!.enabled).toBe(false);
  });

  it('adds new guests to the field guide once', () => {
    const s = emptyGame();
    expect(logGuests(s, ['frog', 'tortoise', 'beetle'])).toEqual({ fresh: ['frog', 'beetle'], parts: 2 });
    expect(s.scanned).toContain('frog');
    expect(logGuests(s, ['frog']).fresh).toEqual([]);
  });
});

describe('recycle sorting mini-game', () => {
  it('tracks what is in the bag and pays a bonus for careful sorting', () => {
    const s = emptyGame();
    s.scanned.push('bottle', 'can', 'airpotato');
    for (const species of ['bottle', 'can'] as const) {
      const e = addEntity(s, { kind: 'hazard', species, tx: 5 + (species === 'can' ? 2 : 0), ty: 20, hp: 1 });
      doVerb(s, { type: 'entity', entity: e }, 'remove');
    }
    const vine = addEntity(s, { kind: 'invasivePlant', species: 'airpotato', tx: 12, ty: 20, hp: 1 });
    doVerb(s, { type: 'entity', entity: vine }, 'remove');
    expect(bagContents(s)).toEqual(['bottle', 'can', 'bulbil', 'bulbil', 'bulbil']);
    expect(getActions(s, { type: 'station', station: recycler }).map((a) => a.verb)).toEqual(['recycle', 'sort']);
    const parts = s.parts;
    const res = finishSort(s, bagContents(s).map((i) => BIN_OF[i]));
    expect(res).toMatchObject({ total: 5, correct: 5, bonus: 3 });
    expect(s.parts).toBe(parts + 8);
    expect(s.bag).toBe(0);
    expect(bagContents(s)).toEqual([]);
  });

  it('pads older bags (counts only) with bottles', () => {
    const s = emptyGame();
    s.bag = 2;
    s.bagItems = [];
    expect(bagContents(s)).toEqual(['bottle', 'bottle']);
    expect(finishSort(s, [null, 'glass'])).toMatchObject({ correct: 1, bonus: 0, parts: 2 });
  });
});

describe('fire and the night', () => {
  it('credits renewal from a good burn on the morning card', () => {
    const s = emptyGame();
    s.burned = s.burned.map(() => s.day - 35);
    for (let x = 18; x <= 24; x++) addEntity(s, { kind: 'invasivePlant', species: 'cogon', tx: x, ty: 20, hp: 1 });
    ignite(s, 20, 20);
    expect(s.burned[tileIndex(20, 20)]).toBe(s.day);
    const xp = s.xp;
    const night = (async () => (await import('../src/systems/dayCycle')).nightTick(s))();
    return night.then((n) => {
      expect(n.fire?.renewed).toBeGreaterThan(0);
      expect(s.fires).toHaveLength(0);
      expect(s.xp).toBeGreaterThanOrEqual(xp);
    });
  });
});
