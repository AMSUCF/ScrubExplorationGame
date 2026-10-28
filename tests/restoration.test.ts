import { describe, expect, it } from 'vitest';
import { getActions, performAction } from '../src/systems/actions';
import { InvasivePlantEntity, NativePlantEntity, addEntity, isChoked, newGame } from '../src/systems/state';
import { BAG, BULBILS, PULL, SNIPS, bagBulbil, careStage, cutStroke, newVineCare, pullVine } from '../src/systems/vineCare';
import { loadGame, saveGame } from '../src/systems/save';
import { chokingVines, vineHost, worldSize } from '../src/data/visuals';
import { emptyGame, memoryStorage } from './helpers';

function finish(work: ReturnType<typeof newVineCare>) {
  SNIPS.forEach(p => expect(cutStroke(work, [{ x: p.x - 24, y: p.y }, { x: p.x + 24, y: p.y }])).toBe('cut'));
  BULBILS.forEach((_, i) => expect(bagBulbil(work, i, BAG)).toBe(true));
  expect(pullVine(work, PULL, { x: PULL.x, y: PULL.y + 65 })).toBe(true);
}

describe('careful vine work', () => {
  it('requires safe cuts, then every bulbil, then a deliberate downward pull', () => {
    const work = newVineCare();
    expect(bagBulbil(work, 0)).toBe(false);
    expect(pullVine(work, PULL, { x: PULL.x, y: PULL.y + 70 })).toBe(false);
    expect(cutStroke(work, [SNIPS[0], { x: SNIPS[0].x + 4, y: SNIPS[0].y }])).toBe('miss');
    finish(work);
    expect(careStage(work)).toBe('done');
    expect(bagBulbil(work, 0)).toBe(false);
  });

  it('catches strokes crossing native branches, even when they also cross a snip mark', () => {
    const work = newVineCare();
    expect(cutStroke(work, [{ x: 110, y: 346 }, { x: 430, y: 346 }])).toBe('branch');
    expect(work.cuts).toEqual([]);
    expect(work.brushes).toBe(1);
    finish(work);
    expect(careStage(work)).toBe('done');
  });

  it('rejects duplicate cuts, missed bags, and sideways or upward pulling', () => {
    const work = newVineCare();
    for (const p of SNIPS) cutStroke(work, [{ x: p.x - 24, y: p.y }, { x: p.x + 24, y: p.y }]);
    expect(cutStroke(work, [{ x: 114, y: 346 }, { x: 162, y: 346 }])).toBe('miss');
    expect(bagBulbil(work, 0, { x: 100, y: 100 })).toBe(false);
    expect(bagBulbil(work, -1)).toBe(false);
    expect(bagBulbil(work, 1.5)).toBe(false);
    for (let i = 0; i < 3; i++) expect(bagBulbil(work, i)).toBe(true);
    expect(pullVine(work, PULL, { x: 500, y: 510 })).toBe(false);
    expect(pullVine(work, PULL, { x: PULL.x, y: 370 })).toBe(false);
    expect(careStage(work)).toBe('pull');
  });

  it('saves partial work without removing the vine or spending energy', () => {
    const s = emptyGame(), storage = memoryStorage();
    const vine = addEntity<InvasivePlantEntity>(s, { kind: 'invasivePlant', species: 'airpotato', tx: 6, ty: 20, hp: 1, care: newVineCare() });
    cutStroke(vine.care!, [{ x: 114, y: 346 }, { x: 162, y: 346 }]);
    s.scanned.push('airpotato');
    const before = s.battery;
    expect(performAction(s, getActions(s, { type: 'entity', entity: vine })[0]).ok).toBe(false);
    expect(s.battery).toBe(before);
    expect(s.stats.invasivesRemoved).toBe(0);
    saveGame(s, storage);
    const restored = loadGame(storage)!;
    expect(restored.entities[0]).toMatchObject({ species: 'airpotato', care: { cuts: [0], bagged: [], pulled: false } });
  });

  it('releases the actual host once, charges once, and rewards only completed care', () => {
    const s = emptyGame(); s.scanned.push('oak', 'airpotato');
    const oak = addEntity<NativePlantEntity>(s, { kind: 'nativePlant', species: 'oak', tx: 5, ty: 20, planted: false, plantedDay: 0, lastSeedDay: 0, rescued: false });
    const vine = addEntity<InvasivePlantEntity>(s, { kind: 'invasivePlant', species: 'airpotato', tx: 6, ty: 20, hp: 1, care: newVineCare() });
    expect(vineHost(s, vine)).toBe(oak);
    expect(chokingVines(s, oak)).toEqual([vine]);
    expect(isChoked(s, oak)).toBe(true);
    finish(vine.care!);
    const action = getActions(s, { type: 'entity', entity: oak }).find(a => a.verb === 'rescue')!;
    const before = s.battery;
    expect(performAction(s, action).rescued).toContain(oak);
    expect(s.battery).toBe(before - 4);
    expect(s.bag).toBe(3);
    expect(s.parts).toBe(1);
    expect(isChoked(s, oak)).toBe(false);
    expect(performAction(s, action).ok).toBe(false);
    expect(s.battery).toBe(before - 4);
    expect(s.stats.invasivesRemoved).toBe(1);
  });

  it('requires enough bag space and does not punish a protected-branch brush', () => {
    const s = emptyGame(); s.scanned.push('airpotato');
    const vine = addEntity<InvasivePlantEntity>(s, { kind: 'invasivePlant', species: 'airpotato', tx: 6, ty: 20, hp: 1, care: newVineCare() });
    vine.care!.brushes = 1; finish(vine.care!);
    const action = getActions(s, { type: 'entity', entity: vine })[0];
    s.bag = 4;
    const before = s.battery;
    expect(performAction(s, action).ok).toBe(false);
    expect(s.battery).toBe(before);
    s.bag = 0;
    expect(performAction(s, action).ok).toBe(true);
    expect(s.parts).toBe(0);
    expect(s.bag).toBe(3);
  });
});

describe('a living scrub', () => {
  it('seeds an approachable host-and-vine rescue and preserves tree growth proportions', () => {
    const s = newGame(42);
    const vine = s.entities.find(e => e.kind === 'invasivePlant' && e.tx === 31 && e.ty === 28)!;
    expect(vine.kind === 'invasivePlant' && vineHost(s, vine)?.species).toBe('oak');
    const oak = addEntity<NativePlantEntity>(s, { kind: 'nativePlant', species: 'oak', tx: 5, ty: 20, planted: true, plantedDay: 1, lastSeedDay: 0, rescued: true });
    expect(worldSize(oak, 1)[1]).toBeLessThan(worldSize(oak, 5)[1]);
    expect(worldSize(oak, 5)[1]).toBeGreaterThan(110);
  });

  it('lets friendly encounters give one small thank-you per species per day', () => {
    const s = emptyGame(); s.scanned.push('jay');
    const jay = addEntity(s, { kind: 'nativeAnimal', species: 'jay', x: 100, y: 100, home: 'oak' });
    const action = getActions(s, { type: 'entity', entity: jay })[0];
    expect(performAction(s, action).note).toContain('acorn');
    performAction(s, action); expect(s.parts).toBe(1);
    s.day++; performAction(s, action); expect(s.parts).toBe(2);
  });
});
