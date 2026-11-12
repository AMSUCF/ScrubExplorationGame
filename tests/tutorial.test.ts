import { describe, expect, it } from 'vitest';
import { homeLayout } from '../src/data/home';
import { FIRST_RESCUE, STATIONS, VINE_ROOT, zoneAt } from '../src/data/map';
import { Target, Verb, canPlantAt } from '../src/systems/actions';
import { nightTick } from '../src/systems/dayCycle';
import { loadGame, saveGame } from '../src/systems/save';
import { GameState, newGame } from '../src/systems/state';
import {
  GRADUATION_PARTS,
  Pointer,
  TUTORIAL_STEPS,
  advanceTutorial,
  currentStepId,
  guidance,
  noteTutorial,
  setTutorialTips,
  tutorialActive,
} from '../src/systems/tutorial';
import { rollWeather } from '../src/systems/weather';
import { doVerb, memoryStorage } from './helpers';

/** Resolve the coach's pointer to something the robot can act on. */
function targetOf(s: GameState, p: Pointer | null): Target {
  if (!p) throw new Error('expected the coach to point at something');
  switch (p.kind) {
    case 'entity': {
      const entity = s.entities.find((e) => e.id === p.id);
      if (!entity) throw new Error(`pointer at missing entity ${p.id}`);
      return { type: 'entity', entity };
    }
    case 'station':
      return { type: 'station', station: STATIONS.find((st) => st.kind === p.station)! };
    case 'home':
      return { type: 'home', item: homeLayout(s.homeLevel, s.trays.length, s.vases.length).find((i) => i.kind === p.item && (p.index === undefined || i.index === p.index))! };
    default:
      throw new Error(`no target for pointer ${p.kind}`);
  }
}

/** Do something the way a scene does: perform it, report it to the tutorial, and let the coach advance. */
function act(s: GameState, target: Target, verb: Verb, param?: string): boolean {
  const vine = target.type === 'entity' && target.entity.kind === 'invasivePlant' && target.entity.species === 'airpotato';
  const ok = doVerb(s, target, verb, param);
  if (ok) {
    noteTutorial(s, verb);
    if (vine) noteTutorial(s, 'vine');
  }
  advanceTutorial(s);
  return ok;
}

function moment(s: GameState, m: string): void {
  noteTutorial(s, m);
  advanceTutorial(s);
}

/** Scan if it's new, then do the verb. */
function scanThen(s: GameState, target: Target, verb: Verb): void {
  if (target.type === 'entity' && target.entity.kind !== 'burrow' && !s.scanned.includes(target.entity.species)) act(s, target, 'scan');
  expect(act(s, target, verb)).toBe(true);
}

function sleep(s: GameState): void {
  s.location = 'home';
  nightTick(s);
  moment(s, 'night');
}

/** A new player following every tip, exactly as the coach gives them. */
function followTutorial(seed: number): GameState {
  const s = newGame(seed, { tutorial: true });
  const seen: string[] = [];
  for (let guard = 0; guard < 80 && s.tutorial && !s.tutorial.done; guard++) {
    const id = currentStepId(s)!;
    if (seen[seen.length - 1] !== id) seen.push(id);
    const g = guidance(s, { robot: s.robot })!;
    expect(g.text.length).toBeGreaterThan(20);
    switch (id) {
      case 'move': moment(s, 'move'); break;
      case 'scan': act(s, targetOf(s, g.pointer), 'scan'); break;
      case 'pull': scanThen(s, targetOf(s, g.pointer), 'remove'); break;
      case 'seeds': scanThen(s, targetOf(s, g.pointer), 'collect'); break;
      case 'litter': scanThen(s, targetOf(s, g.pointer), 'remove'); break;
      case 'vine': {
        // The coach points at the smothered oak; the vine itself is right beside it.
        const vine = s.entities.find((e) => e.kind === 'invasivePlant' && e.tx === VINE_ROOT.tx && e.ty === VINE_ROOT.ty)!;
        scanThen(s, { type: 'entity', entity: vine }, 'remove');
        break;
      }
      case 'recycle': act(s, targetOf(s, g.pointer), 'recycle'); break;
      case 'home': act(s, targetOf(s, g.pointer), 'enter'); break;
      case 'sow': {
        const t = targetOf(s, g.pointer);
        if (!act(s, t, 'sow', 'rosemary')) act(s, t, 'water');
        break;
      }
      case 'monitor': moment(s, 'monitor'); break;
      case 'sleep': sleep(s); break;
      case 'goals': moment(s, 'tasks'); break;
      case 'water': act(s, targetOf(s, g.pointer), 'water'); break;
      case 'capture':
        if (g.detour) { s.location = 'outside'; advanceTutorial(s); break; }
        scanThen(s, targetOf(s, g.pointer), 'capture');
        break;
      case 'dropoff': act(s, targetOf(s, g.pointer), 'dropoff'); break;
      case 'guide': moment(s, 'guide'); break;
      case 'sleep2': sleep(s); break;
      case 'pot':
        if (g.detour) { s.location = 'home'; break; }
        act(s, targetOf(s, g.pointer), 'pot');
        break;
      case 'plant': {
        if (g.detour) { s.location = 'outside'; break; }
        let spot: { tx: number; ty: number } | null = null;
        for (let r = 1; r < 8 && !spot; r++) {
          for (let dx = -r; dx <= r && !spot; dx++) {
            const tx = FIRST_RESCUE.tx + dx, ty = FIRST_RESCUE.ty + r;
            if (canPlantAt(s, tx, ty)) spot = { tx, ty };
          }
        }
        expect(act(s, { type: 'self', spot }, 'plant', 'rosemary')).toBe(true);
        break;
      }
      case 'finale':
        expect(g.ack).toBeTruthy();
        moment(s, 'ack:finale');
        break;
      default:
        throw new Error(`unhandled step ${id}`);
    }
  }
  expect(seen).toEqual([...TUTORIAL_STEPS]);
  return s;
}

describe('tutorial', () => {
  it('is only part of games that ask for it', () => {
    expect(newGame(5).tutorial).toBeUndefined();
    const s = newGame(5, { tutorial: true });
    expect(s.tutorial).toEqual({ step: 0, did: {} });
    expect(tutorialActive(s)).toBe(true);
    expect(guidance(newGame(5))).toBeNull();
  });

  it('keeps the guided mornings free of storms and heat', () => {
    for (const seed of [1, 2, 3, 42, 99, 12345, -7]) {
      const s = newGame(seed, { tutorial: true });
      for (const day of [1, 2, 3]) expect(['clear', 'breezy', 'rain', 'fog']).toContain(rollWeather(s.seed, day).kind);
    }
  });

  it.each([1, 2, 3, 42, 99])('a new player can follow every step to the end (seed %i)', (seed) => {
    const s = followTutorial(seed);
    expect(s.tutorial?.done).toBe(true);
    expect(s.day).toBe(3);
    expect(s.stats.planted).toBe(1);
    expect(guidance(s)).toBeNull();
    expect(tutorialActive(s)).toBe(false);
  });

  it('finishes with a small thank-you of parts', () => {
    const s = newGame(8, { tutorial: true });
    s.tutorial!.step = TUTORIAL_STEPS.indexOf('finale');
    const parts = s.parts;
    expect(advanceTutorial(s)).toBeNull();
    moment(s, 'ack:finale');
    expect(s.tutorial!.done).toBe(true);
    expect(s.parts).toBe(parts + GRADUATION_PARTS);
    // Further moments change nothing.
    moment(s, 'ack:finale');
    expect(s.parts).toBe(parts + GRADUATION_PARTS);
  });

  it('passes straight over steps the player has already done', () => {
    const s = newGame(11, { tutorial: true });
    noteTutorial(s, 'move');
    s.scanned.push('cogon');
    noteTutorial(s, 'collect');
    const step = advanceTutorial(s);
    expect(step).toEqual({ from: 0, to: 2, finished: false });
    expect(currentStepId(s)).toBe('pull');
    // Clear everything around the rosemary: pull is done, and seeds were already collected.
    const r = s.entities.find((e) => e.kind === 'nativePlant' && e.tx === FIRST_RESCUE.tx && e.ty === FIRST_RESCUE.ty)!;
    s.entities = s.entities.filter((e) => !(e.kind === 'invasivePlant' && 'tx' in r && Math.abs(e.tx - r.tx) <= 2 && Math.abs(e.ty - r.ty) <= 2));
    advanceTutorial(s);
    expect(currentStepId(s)).toBe('litter');
  });

  it('counts down the invaders crowding the first rosemary', () => {
    const s = newGame(3, { tutorial: true });
    moment(s, 'move');
    s.scanned.push('cogon', 'natal');
    advanceTutorial(s);
    const before = guidance(s)!.text;
    const t = targetOf(s, guidance(s)!.pointer);
    act(s, t, 'remove');
    if (currentStepId(s) === 'pull') expect(guidance(s)!.text).not.toBe(before);
  });

  it('sends the robot to the right place first', () => {
    const s = newGame(4, { tutorial: true });
    s.location = 'home';
    const g = guidance(s)!;
    expect(g.detour).toBe(true);
    expect(g.pointer).toEqual({ kind: 'home', item: 'door' });
    s.location = 'outside';
    s.tutorial!.step = TUTORIAL_STEPS.indexOf('sow');
    expect(guidance(s)!.pointer).toEqual({ kind: 'station', station: 'pod' });
  });

  it('waits while a fire burns', () => {
    const s = newGame(6, { tutorial: true });
    s.fires.push({ tx: 20, ty: 20 } as GameState['fires'][number]);
    const g = guidance(s)!;
    expect(g.detour).toBe(true);
    expect(g.pointer).toEqual({ kind: 'fire', tx: 20, ty: 20 });
  });

  it('asks to empty a full bag before freeing the vine', () => {
    const s = newGame(9, { tutorial: true });
    s.tutorial!.step = TUTORIAL_STEPS.indexOf('vine');
    expect(targetOf(s, guidance(s)!.pointer).type).toBe('entity');
    s.bag = 5;
    expect(guidance(s)!.pointer).toEqual({ kind: 'station', station: 'recycler' });
    expect(guidance(s)!.text).toMatch(/bag is too full/);
  });

  it('points at open sand beyond the clearing when it is time to plant', () => {
    const s = newGame(10, { tutorial: true });
    s.tutorial!.step = TUTORIAL_STEPS.indexOf('plant');
    s.seedlings.rosemary = 1;
    const fromHome = guidance(s, { robot: { x: 28 * 32 + 16, y: 35 * 32 + 16 } })!;
    expect(fromHome.pointer?.kind).toBe('point');
    const p = fromHome.pointer as { x: number; y: number };
    expect(zoneAt(Math.floor(p.x / 32), Math.floor(p.y / 32))).not.toBe('base');
    const outThere = guidance(s, { robot: { x: FIRST_RESCUE.tx * 32 + 16, y: FIRST_RESCUE.ty * 32 - 16 } })!;
    expect(outThere.pointer).toEqual({ kind: 'self' });
  });

  it('can be paused and resumed, and keeps advancing quietly meanwhile', () => {
    const s = newGame(12, { tutorial: true });
    setTutorialTips(s, false);
    expect(tutorialActive(s)).toBe(false);
    moment(s, 'move');
    expect(currentStepId(s)).toBe('scan');
    setTutorialTips(s, true);
    expect(tutorialActive(s)).toBe(true);
  });

  it('survives a save and reload mid-way', () => {
    const s = newGame(13, { tutorial: true });
    moment(s, 'move');
    const storage = memoryStorage();
    saveGame(s, storage);
    const loaded = loadGame(storage)!;
    expect(loaded.tutorial).toEqual(s.tutorial);
    expect(currentStepId(loaded)).toBe('scan');
  });
});
