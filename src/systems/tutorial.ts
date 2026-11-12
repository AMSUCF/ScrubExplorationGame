// The guided first days. A new player can choose this when starting a game: a friendly coach card
// walks through the scrub's rhythm (clear, rescue, gather, grow, plant, rest) over the first three
// days, pointing at the next thing to do. Pure logic, with no Phaser or DOM, so the route is tested.
//
// Each step finishes on what the player has actually done, judged from the game state or from moments
// the scenes report with noteTutorial(). Steps never block free play, a step that is already done is
// passed straight away (so things can happen in any order), and the advice adapts to the situation.
import { BAG_CAPACITY, CHOKE_RADIUS, TILE } from '../config';
import type { HomeItemKind } from '../data/home';
import { BASE_CENTER, FIRST_BOTTLE, FIRST_RESCUE, StationKind, VINE_OAK, VINE_ROOT, inBounds, tileCenter, zoneAt } from '../data/map';
import { INVASIVE_PLANTS, InvasiveAnimalId, SpeciesId, speciesName } from '../data/species';
import type { Verb } from './actions';
import { trayStage } from './nursery';
import {
  Entity,
  GameState,
  HazardEntity,
  InvasiveAnimalEntity,
  InvasivePlantEntity,
  NATIVE_PLANTS,
  NativePlantEntity,
  entityPos,
  isChoked,
  isRegrowing,
  tileOccupied,
} from './state';

export interface TutorialState {
  /** Index of the current step. */
  step: number;
  /** How many times each moment has happened since the tutorial began (verbs, 'move', 'night'…). */
  did: Record<string, number>;
  /** Tips are paused (the player skipped them); the pause menu can bring them back. */
  off?: boolean;
  /** Every step is finished. */
  done?: boolean;
}

/** Something in the world (or the pod) for the coach's hand to point at. */
export type Pointer =
  | { kind: 'entity'; id: number }
  | { kind: 'station'; station: StationKind }
  | { kind: 'home'; item: HomeItemKind; index?: number }
  | { kind: 'fire'; tx: number; ty: number }
  | { kind: 'self' }
  | { kind: 'point'; x: number; y: number };

export interface CoachContext {
  /** The robot's position outdoors, in world pixels. */
  robot?: { x: number; y: number };
  /** Mouse-and-keyboard players get click and key wording. */
  desktop?: boolean;
}

/** What the coach shows right now. */
export interface Guidance {
  id: string;
  chapter: number;
  chapterName: string;
  /** Zero-based step index, out of `total`. */
  index: number;
  total: number;
  title: string;
  text: string;
  pointer: Pointer | null;
  /** CSS selectors for buttons to highlight: HUD, home navigation, nursery and action-tray buttons. */
  glow: string[];
  /** Explanation-only steps finish with this button. */
  ack?: string;
  /** The tip is a detour (a fire, or the wrong place for this step) rather than the step itself. */
  detour?: boolean;
}

type Did = (moment: string) => number;

interface Step {
  id: string;
  chapter: number;
  /** Where the step happens; the coach first sends the robot there. */
  where: 'outside' | 'home' | 'any';
  title: string;
  text(s: GameState, ctx: CoachContext): string;
  pointer?(s: GameState, ctx: CoachContext): Pointer | null;
  glow?(s: GameState): string[];
  ack?: string;
  done(s: GameState, did: Did): boolean;
}

export const CHAPTERS = ['First steps', 'Rescue and gather', 'Home sweet pod', 'A new morning', 'Grow it back'];

/** Recycled parts given as a thank-you for finishing the tutorial. */
export const GRADUATION_PARTS = 3;

// --- selectors for the buttons the coach highlights ------------------------------------------

const verbs = (...v: Verb[]) => v.map((x) => `.action-dock .rbtn[data-verb="${x}"]`);
const nav = (k: 'nursery' | 'wildlife' | 'workshop' | 'rest') => `.home-nav [data-home="${k}"]`;
/** A button on one jar's card in the nursery (the jar the hand points at in the room). */
const jar = (v: Verb, index: number) => `.overlay.nursery .jar-card:nth-child(${index + 1}) [data-verb="${v}"]`;
const GUIDE_BUTTON = '.hud .buttons [data-hud="guide"]';
const TODAY_CHIP = '.hud [data-tasks]';

// --- finding things --------------------------------------------------------------------------

const entity = (e?: Entity | null): Pointer | null => (e ? { kind: 'entity', id: e.id } : null);

function at<T extends Entity>(s: GameState, spot: { tx: number; ty: number }, pred: (e: Entity) => e is T): T | undefined {
  return s.entities.find((e): e is T => 'tx' in e && e.tx === spot.tx && e.ty === spot.ty && pred(e));
}

function nearest<T extends Entity>(s: GameState, from: { x: number; y: number }, pred: (e: Entity) => e is T): T | undefined {
  let best: T | undefined;
  let bestD = Infinity;
  for (const e of s.entities) {
    if (!pred(e)) continue;
    const p = entityPos(e);
    const d = Math.hypot(p.x - from.x, p.y - from.y);
    if (d < bestD) {
      best = e;
      bestD = d;
    }
  }
  return best;
}

const isRosemary = (e: Entity): e is NativePlantEntity => e.kind === 'nativePlant' && e.species === 'rosemary';
const isOak = (e: Entity): e is NativePlantEntity => e.kind === 'nativePlant' && e.species === 'oak';
const isVine = (e: Entity): e is InvasivePlantEntity => e.kind === 'invasivePlant' && e.species === 'airpotato';
const isCogon = (e: Entity): e is InvasivePlantEntity => e.kind === 'invasivePlant' && e.species === 'cogon';
const isLitter = (e: Entity): e is HazardEntity => e.kind === 'hazard' && e.species !== 'thicket' && e.species !== 'fence';
const isInvasiveAnimal = (e: Entity): e is InvasiveAnimalEntity => e.kind === 'invasiveAnimal';

const firstRosemary = (s: GameState) => at(s, FIRST_RESCUE, isRosemary);
const robotAt = (s: GameState, ctx: CoachContext) => ctx.robot ?? s.robot;

/** Invasive plants crowding the first rosemary, nearest first. */
function chokers(s: GameState): InvasivePlantEntity[] {
  const r = firstRosemary(s);
  if (!r) return [];
  const near = s.entities.filter(
    (e): e is InvasivePlantEntity => e.kind === 'invasivePlant' && Math.abs(e.tx - r.tx) <= CHOKE_RADIUS && Math.abs(e.ty - r.ty) <= CHOKE_RADIUS,
  );
  return near.sort((a, b) => Math.hypot(a.tx - r.tx, a.ty - r.ty) - Math.hypot(b.tx - r.tx, b.ty - r.ty));
}

const seedReady = (s: GameState, e: NativePlantEntity) => !isChoked(s, e) && !isRegrowing(s, e) && e.lastSeedDay !== s.day;

/** Air potato's bulbils need room in the bag. */
const bagTooFull = (s: GameState) => s.bag + INVASIVE_PLANTS.airpotato.bulbils > BAG_CAPACITY;

/** The vine-covered oak (or, failing that, the vine itself). */
function vineTarget(s: GameState): Entity | undefined {
  const root = at(s, VINE_ROOT, isVine);
  if (!root) return undefined;
  const oak = at(s, VINE_OAK, isOak);
  return oak && isChoked(s, oak) ? oak : root;
}

const ANIMAL_NAME: Record<InvasiveAnimalId, string> = { cat: 'feral cat', tegu: 'Argentine tegu', iguana: 'green iguana', anole: 'brown anole' };

const animalTarget = (s: GameState, ctx: CoachContext) => nearest(s, robotAt(s, ctx), isInvasiveAnimal);

function litterTarget(s: GameState, ctx: CoachContext): HazardEntity | undefined {
  return at(s, FIRST_BOTTLE, isLitter) ?? nearest(s, robotAt(s, ctx), isLitter);
}

const lower = (name: string) => name.charAt(0).toLowerCase() + name.slice(1);
/** ", Scan it" for something the robot hasn't met yet. */
const scanFirst = (s: GameState, species: SpeciesId) => (s.scanned.includes(species) ? '' : ', Scan it');

const hasSeeds = (s: GameState) => NATIVE_PLANTS.some((p) => s.seeds[p] > 0);
const potted = (s: GameState) => NATIVE_PLANTS.some((p) => s.seedlings[p] > 0) || s.stats.planted > 0;
const readyJar = (s: GameState) => s.trays.findIndex((t) => trayStage(t) === 'ready');

/** The jar to work on: one that needs water, else a growing one, else an empty one. */
function workJar(s: GameState): number {
  const thirsty = s.trays.findIndex((t) => t.seed && !t.watered && trayStage(t) !== 'ready');
  if (thirsty >= 0) return thirsty;
  const growing = s.trays.findIndex((t) => t.seed);
  if (growing >= 0) return growing;
  return Math.max(0, s.trays.findIndex((t) => !t.seed));
}
const jarPointer = (index: number): Pointer => ({ kind: 'home', item: 'slot', index });

function inClearing(s: GameState, ctx: CoachContext): boolean {
  const r = robotAt(s, ctx);
  return zoneAt(Math.floor(r.x / TILE), Math.floor(r.y / TILE)) === 'base';
}

/** A free patch of sand just beyond the home clearing, near the first rescue, for planting. */
function openSand(s: GameState): Pointer | null {
  let best: { tx: number; ty: number } | null = null;
  let bestD = Infinity;
  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      const tx = FIRST_RESCUE.tx + dx, ty = FIRST_RESCUE.ty + dy;
      if (!inBounds(tx, ty) || zoneAt(tx, ty) === 'base' || tileOccupied(s, tx, ty, 1)) continue;
      const d = Math.hypot(tx - BASE_CENTER.tx, ty - BASE_CENTER.ty);
      if (d < bestD) {
        best = { tx, ty };
        bestD = d;
      }
    }
  }
  return best ? { kind: 'point', ...tileCenter(best.tx, best.ty) } : null;
}

// --- the route -------------------------------------------------------------------------------

const STEPS: Step[] = [
  // Day 1, outside: a first rescue right by the pod.
  {
    id: 'move', chapter: 0, where: 'outside', title: 'Roll around',
    text: (_s, c) => c.desktop
      ? 'Hello, little helper! Click the sand to drive there, or use the arrow keys or WASD.'
      : 'Hello, little helper! Tap the sand to drive there, or hold and drag to steer.',
    pointer: () => ({ kind: 'point', ...tileCenter(BASE_CENTER.tx - 3, BASE_CENTER.ty - 4) }),
    done: (_s, did) => did('move') > 0,
  },
  {
    id: 'scan', chapter: 0, where: 'outside', title: 'Scan something new',
    text: () => 'That tall, white-plumed grass doesn’t belong here. Tap it, then choose Scan to learn what it is.',
    pointer: (s) => entity(nearest(s, tileCenter(FIRST_RESCUE.tx, FIRST_RESCUE.ty), isCogon)),
    glow: () => verbs('scan'),
    done: (s) => s.scanned.includes('cogon'),
  },
  {
    id: 'pull', chapter: 0, where: 'outside', title: 'Pull the invaders',
    text: (s) => {
      const n = chokers(s).length;
      return `Cogon is invasive: it crowds out native plants. Pull ${n === 1 ? 'the last invader' : `the ${n} invaders`} around the little rosemary.`;
    },
    pointer: (s) => entity(chokers(s)[0]),
    glow: () => verbs('scan', 'remove'),
    done: (s) => {
      const r = firstRosemary(s);
      return !r || !isChoked(s, r);
    },
  },
  {
    id: 'seeds', chapter: 1, where: 'outside', title: 'Gather seeds',
    text: (s) => `The rosemary can breathe again! Tap it${scanFirst(s, 'rosemary')}, then Collect seeds to grow more at home.`,
    pointer: (s, c) => {
      const r = firstRosemary(s);
      if (r && seedReady(s, r)) return entity(r);
      return entity(nearest(s, robotAt(s, c), (e): e is NativePlantEntity => e.kind === 'nativePlant' && seedReady(s, e)));
    },
    glow: () => verbs('scan', 'collect'),
    done: (_s, did) => did('collect') > 0,
  },
  {
    id: 'litter', chapter: 1, where: 'outside', title: 'Tidy up litter',
    text: (s, c) => {
      const e = litterTarget(s, c);
      const name = e ? lower(speciesName(e.species)) : 'litter';
      return `Litter isn’t safe for wildlife. Tap the ${name}${e ? scanFirst(s, e.species) : ''}, then Pick it up. It goes in your bag.`;
    },
    pointer: (s, c) => entity(litterTarget(s, c)),
    glow: () => verbs('scan', 'remove'),
    done: (s) => s.stats.trashCollected > 0,
  },
  {
    id: 'vine', chapter: 1, where: 'outside', title: 'Free the oak',
    text: (s) => bagTooFull(s)
      ? 'Your bag is too full for the vine’s bulbils. Empty it at the recycling station by your pod first.'
      : `Air potato vines are smothering the big oak. Tap it${scanFirst(s, 'oak')}, then choose Free the vines.`,
    pointer: (s) => (bagTooFull(s) ? { kind: 'station', station: 'recycler' } : entity(vineTarget(s))),
    glow: (s) => (bagTooFull(s) ? verbs('recycle') : verbs('scan', 'rescue', 'remove')),
    done: (s, did) => did('vine') > 0 || !at(s, VINE_ROOT, isVine),
  },
  {
    id: 'recycle', chapter: 1, where: 'outside', title: 'Recycle',
    text: () => 'Bring your bag to the recycling station by your pod and choose Recycle. Litter becomes useful parts.',
    pointer: () => ({ kind: 'station', station: 'recycler' }),
    glow: () => verbs('recycle'),
    done: (s, did) => did('recycle') > 0 || did('sort') > 0 || s.bag === 0,
  },
  // Day 1, inside the pod.
  {
    id: 'home', chapter: 2, where: 'any', title: 'Head home',
    text: () => 'Actions use energy (the green meter, top left). Your pod is home: tap it, then choose Go inside.',
    pointer: () => ({ kind: 'station', station: 'pod' }),
    glow: () => verbs('enter', 'goHome'),
    done: (s) => s.location === 'home',
  },
  {
    id: 'sow', chapter: 2, where: 'home', title: 'Sow a seed',
    text: (s) => {
      if (s.trays.some((t) => t.seed)) return 'Now choose Water. Seeds only grow on nights after they’ve been watered.';
      if (!hasSeeds(s)) return 'You’ll need a seed first. Collect some from a healthy native plant outside.';
      return `Welcome home! Open the Nursery and sow ${s.seeds.rosemary > 0 ? 'a rosemary seed' : 'one of your seeds'} in a jar.`;
    },
    pointer: (s) => jarPointer(workJar(s)),
    glow: (s) => (s.trays.some((t) => t.seed) ? [nav('nursery'), jar('water', workJar(s)), ...verbs('water')] : [nav('nursery'), jar('sow', workJar(s)), ...verbs('sow')]),
    done: (s) => s.trays.some((t) => t.seed && (t.watered || t.growth > 0)) || potted(s),
  },
  {
    id: 'monitor', chapter: 2, where: 'home', title: 'Meet the neighbors',
    text: () => 'Open the Wildlife monitor to see which animals could come home, and what each one still needs.',
    pointer: () => ({ kind: 'home', item: 'monitor' }),
    glow: () => [nav('wildlife'), ...verbs('monitor')],
    done: (_s, did) => did('monitor') > 0,
  },
  {
    id: 'sleep', chapter: 2, where: 'home', title: 'Rest and recharge',
    text: () => 'Good work today! Tap Rest, then Sleep. Your energy refills and watered seeds grow overnight.',
    pointer: () => ({ kind: 'home', item: 'cradle' }),
    glow: () => [nav('rest'), ...verbs('sleep')],
    done: (_s, did) => did('night') > 0,
  },
  // Day 2.
  {
    id: 'goals', chapter: 3, where: 'any', title: 'Today’s little list',
    text: () => 'Good morning! Each day brings three small goals for bonus parts. Tap Today to see yours.',
    glow: () => [TODAY_CHIP],
    done: (s, did) => did('tasks') > 0 || !s.tasks?.length,
  },
  {
    id: 'water', chapter: 3, where: 'home', title: 'Water every day',
    text: (s) => {
      if (!s.trays.some((t) => t.seed)) return 'Open the Nursery, sow a seed and water it. Seeds grow on watered nights.';
      return s.trays.some((t) => t.seed && t.growth > 0)
        ? 'Your seed sprouted! Seeds need water every day: open the Nursery and water it again.'
        : 'Your seed didn’t grow without water. Open the Nursery and water it each day.';
    },
    pointer: (s) => jarPointer(workJar(s)),
    glow: (s) => (s.trays.some((t) => t.seed) ? [nav('nursery'), jar('water', workJar(s)), ...verbs('water')] : [nav('nursery'), jar('sow', workJar(s)), ...verbs('sow')]),
    done: (s) => s.trays.some((t) => t.seed && t.growth > 0 && (t.watered || trayStage(t) === 'ready')) || potted(s),
  },
  {
    id: 'capture', chapter: 3, where: 'outside', title: 'Relocate an invader',
    text: (s, c) => {
      const a = animalTarget(s, c);
      if (!a) return 'Some animals don’t belong here either. When you meet one, Scan it, then Capture it.';
      return `Some animals don’t belong here either. Find the ${ANIMAL_NAME[a.species]}${scanFirst(s, a.species)}, then Capture it. It’s never harmed.`;
    },
    pointer: (s, c) => entity(animalTarget(s, c)),
    glow: () => verbs('scan', 'capture'),
    done: (s, did) => did('capture') > 0 || !!s.crate || s.jar > 0 || !s.entities.some(isInvasiveAnimal),
  },
  {
    id: 'dropoff', chapter: 3, where: 'outside', title: 'Drop it at the pad',
    text: () => 'Carry it to the wildlife pickup by your pod and choose Drop off. It’s collected safely overnight.',
    pointer: () => ({ kind: 'station', station: 'pad' }),
    glow: () => verbs('dropoff'),
    done: (s, did) => did('dropoff') > 0 || (!s.crate && s.jar === 0),
  },
  {
    id: 'guide', chapter: 3, where: 'any', title: 'Your field guide',
    text: () => 'Everything you scan is saved in your field guide, with facts to explore. Tap Guide to take a look.',
    glow: () => [GUIDE_BUTTON],
    // Opening an entry from the action tray counts too.
    done: (_s, did) => did('guide') + did('info') > 0,
  },
  {
    id: 'sleep2', chapter: 3, where: 'any', title: 'Another night of growing',
    text: (s) => s.location === 'home'
      ? 'Explore as long as you like, then Rest in your cradle. Two watered nights grow a seedling.'
      : 'Explore as long as you like, then head home to rest. Two watered nights grow a seedling.',
    pointer: (s) => (s.location === 'home' ? { kind: 'home', item: 'cradle' } : null),
    glow: (s) => (s.location === 'home' ? [nav('rest'), ...verbs('sleep')] : verbs('enter', 'goHome')),
    done: (_s, did) => did('night') > 1,
  },
  // Day 3.
  {
    id: 'pot', chapter: 4, where: 'home', title: 'Pot up your seedling',
    text: (s) => {
      if (readyJar(s) >= 0) return 'Good morning! Your seedling is ready. Open the Nursery and choose Pot up.';
      if (!s.trays.some((t) => t.seed)) return 'Sow a seed in the Nursery and water it each day. Two watered nights grow a seedling.';
      return s.trays.some((t) => t.seed && t.watered)
        ? 'Your seedling needs one more night. Rest in your cradle, and it will be ready by morning.'
        : 'Your seedling needs another watered night. Water it, then rest in your cradle.';
    },
    pointer: (s) => jarPointer(readyJar(s) >= 0 ? readyJar(s) : workJar(s)),
    glow: (s) => {
      if (readyJar(s) >= 0) return [nav('nursery'), jar('pot', readyJar(s)), ...verbs('pot')];
      if (s.trays.some((t) => t.seed && t.watered)) return [nav('rest'), ...verbs('sleep')];
      return [nav('nursery'), jar('water', workJar(s)), ...verbs('water')];
    },
    done: (s, did) => did('pot') > 0 || potted(s),
  },
  {
    id: 'plant', chapter: 4, where: 'outside', title: 'Plant it outside',
    text: (s, c) => inClearing(s, c)
      ? 'Drive out of the home clearing onto open sand, then tap your robot and choose Plant.'
      : 'Tap your robot and choose Plant. It plants on the open sand just in front of you.',
    pointer: (s, c) => (inClearing(s, c) ? openSand(s) : { kind: 'self' }),
    glow: () => verbs('plant'),
    done: (s) => s.stats.planted > 0,
  },
  {
    id: 'finale', chapter: 4, where: 'any', title: 'The scrub is yours', ack: 'Let’s grow!',
    text: () => `That’s the rhythm of the scrub: clear, rescue, grow, plant and rest. As it heals, tortoises, mice, scrub-jays and indigo snakes come home. Here are ${GRADUATION_PARTS} parts for your Workshop!`,
    done: (_s, did) => did('ack:finale') > 0,
  },
];

/** Step ids in order (for tests and tools). */
export const TUTORIAL_STEPS: readonly string[] = STEPS.map((s) => s.id);

// --- running it ------------------------------------------------------------------------------

/** The tutorial is running and showing tips. */
export function tutorialActive(s: GameState): boolean {
  return !!s.tutorial && !s.tutorial.done && !s.tutorial.off;
}

/** The tutorial is unfinished (tips may be paused). */
export function tutorialUnfinished(s: GameState): boolean {
  return !!s.tutorial && !s.tutorial.done;
}

export function currentStepId(s: GameState): string | null {
  const t = s.tutorial;
  return t && !t.done ? (STEPS[t.step]?.id ?? null) : null;
}

/** Record a moment the scenes saw: a verb performed, 'move', 'night', 'tasks', 'guide', 'ack:<step>'… */
export function noteTutorial(s: GameState, moment: string): void {
  const t = s.tutorial;
  if (!t || t.done) return;
  t.did[moment] = (t.did[moment] ?? 0) + 1;
}

export interface Advance {
  from: number;
  to: number;
  finished: boolean;
}

/** Move past every step that is already done. Finishing gives a small thank-you of parts. */
export function advanceTutorial(s: GameState): Advance | null {
  const t = s.tutorial;
  if (!t || t.done) return null;
  const from = t.step;
  const did: Did = (m) => t.did[m] ?? 0;
  while (t.step < STEPS.length && STEPS[t.step].done(s, did)) t.step++;
  if (t.step >= STEPS.length) {
    t.done = true;
    s.parts += GRADUATION_PARTS;
  }
  return t.step === from && !t.done ? null : { from, to: t.step, finished: !!t.done };
}

/** Pause or resume the tips. */
export function setTutorialTips(s: GameState, on: boolean): void {
  if (s.tutorial && !s.tutorial.done) s.tutorial.off = !on;
}

const AWAY_OUT = 'This next part is outdoors. Tap the door mat at the bottom of the room to head out.';
const AWAY_IN = 'This next part is inside your pod. Tap the pod, then choose Go inside.';

/** What the coach should say and point at for the current step. */
export function guidance(s: GameState, ctx: CoachContext = {}): Guidance | null {
  const t = s.tutorial;
  if (!t || t.done || t.step >= STEPS.length) return null;
  const step = STEPS[t.step];
  const base = { id: step.id, chapter: step.chapter, chapterName: CHAPTERS[step.chapter], index: t.step, total: STEPS.length, title: step.title };

  // A fire comes first: the tutorial waits while the player decides what to do about it.
  if (s.location === 'outside' && s.fires.length > 0) {
    const r = robotAt(s, ctx);
    const fire = [...s.fires].sort((a, b) => Math.hypot(a.tx * TILE - r.x, a.ty * TILE - r.y) - Math.hypot(b.tx * TILE - r.x, b.ty * TILE - r.y))[0];
    return {
      ...base, title: 'A fire is burning', detour: true,
      text: 'Tap the flames and choose: contain the fire, or let it renew old, overgrown scrub. The tutorial will wait.',
      pointer: { kind: 'fire', tx: fire.tx, ty: fire.ty }, glow: verbs('contain', 'watchFire'),
    };
  }
  if (step.where === 'outside' && s.location === 'home') {
    return { ...base, text: AWAY_OUT, pointer: { kind: 'home', item: 'door' }, glow: verbs('exit'), detour: true };
  }
  if (step.where === 'home' && s.location === 'outside') {
    return { ...base, text: AWAY_IN, pointer: { kind: 'station', station: 'pod' }, glow: verbs('enter', 'goHome'), detour: true };
  }
  let text = step.text(s, ctx);
  if (s.location === 'outside' && s.battery <= 10 && step.id !== 'home') text += ' Low on energy? Head home and sleep to recharge.';
  return { ...base, text, pointer: step.pointer?.(s, ctx) ?? null, glow: step.glow?.(s) ?? [], ack: step.ack };
}
