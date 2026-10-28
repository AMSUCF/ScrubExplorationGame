// What the robot can do with a tapped thing: a list of icon actions for the radial menu.
// Pure logic — no Phaser — so every interaction is unit-testable.
import { BAG_CAPACITY, JAR_CAPACITY } from '../config';
import { HomeItem } from '../data/home';
import { ICON } from '../data/icons';
import { Station, inBounds, tileCenter, zoneAt } from '../data/map';
import {
  CAT_NAMES,
  HAZARDS,
  HazardId,
  INVASIVE_ANIMALS,
  INVASIVE_PLANTS,
  InvasivePlantId,
  NativePlantId,
  SEED_YIELD,
  SpeciesId,
  speciesName,
} from '../data/species';
import { canAfford, spend } from './battery';
import { calendar } from './calendar';
import { FIRE_STATE_INFO, burnPrescription, fireState, fuelAge, fuelAt, ignite, isBurning } from './fire';
import { CareEvent, Credit, LevelUp, TOOL_LEVEL, ToolId, credit, hasPerk, hasTool } from './progress';
import { DailyTask } from './tasks';
import { WEATHER } from './weather';
import { UPGRADE_COST, UpgradeId, buyUpgrade, clearVase, placeSprig, upgradeStatus } from './home';
import { pot, sow, trayStage, water } from './nursery';
import { Tile } from './pathfind';
import { chokingVines } from '../data/visuals';
import { careStage } from './vineCare';
import {
  BagItem,
  Entity,
  GameState,
  NATIVE_PLANTS,
  NativePlantEntity,
  addEntity,
  isChoked,
  isRegrowing,
  refreshRescues,
  removeEntity,
  tileOccupied,
} from './state';

export type Target =
  | { type: 'entity'; entity: Entity }
  | { type: 'station'; station: Station }
  | { type: 'home'; item: HomeItem }
  | { type: 'self'; spot: Tile | null }
  | { type: 'fire'; tx: number; ty: number };

export type Verb =
  | 'scan'
  | 'remove'
  | 'collect'
  | 'snip'
  | 'capture'
  | 'greet'
  | 'info'
  | 'enter'
  | 'recycle'
  | 'dropoff'
  | 'sleep'
  | 'sow'
  | 'water'
  | 'pot'
  | 'arrange'
  | 'clearVase'
  | 'board'
  | 'monitor'
  | 'upgrade'
  | 'exit'
  | 'plant'
  | 'goHome'
  | 'rescue'
  | 'contain'
  | 'watchFire'
  | 'ignite'
  | 'photo'
  | 'dig'
  | 'scope'
  | 'sort';

/** Activities that open a mini-game; the scene plays it, then applies the outcome. */
export type Minigame = 'fireLine' | 'photo' | 'dig' | 'scope' | 'sort';

export interface Action {
  verb: Verb;
  /** Emoji shown on the button. */
  icon: string;
  /** Texture key drawn on the button instead of / beside the emoji (species pictures). */
  tex?: string;
  /** Short visible tool label, also used as the accessible button name. */
  label: string;
  cost: number;
  parts?: number;
  enabled: boolean;
  /** Emoji explaining why it's disabled (🔋, 🎒, 🥀 …). */
  block?: string;
  blockTex?: string;
  /** Stewardship level that unlocks this tool. */
  needLevel?: number;
  target: Target;
  param?: string;
}

export type Fx = 'hit' | 'pop' | 'sparkle' | 'scan' | 'capture' | 'none';
export type Mood = 'happy' | 'love' | 'sad' | 'surprise' | 'proud';

export interface Gain {
  icon: string;
  tex?: string;
  n: number;
}

export interface ActionResult {
  ok: boolean;
  fx: Fx;
  at?: { x: number; y: number };
  mood?: Mood;
  gains: Gain[];
  scanned?: SpeciesId;
  sleep?: boolean;
  enter?: boolean;
  exit?: boolean;
  open?: 'monitor' | 'board' | 'guide';
  guideId?: SpeciesId;
  rescued: NativePlantEntity[];
  note?: string;
  friend?: number;
  /** A mini-game to open next. */
  play?: Minigame;
  /** A flame was lit here (prescribed burn). */
  fireAt?: { tx: number; ty: number };
  xp?: number;
  levelUps?: LevelUp[];
  tasks?: DailyTask[];
  allDone?: boolean;
}

const VERB_ICON: Record<InvasivePlantId | HazardId, string> = {
  cogon: ICON.pull,
  natal: ICON.pull,
  airpotato: ICON.pull,
  pepper: ICON.cut,
  tire: ICON.pickup,
  bottle: ICON.pickup,
  fence: ICON.pickup,
  thicket: ICON.trim,
  balloon: ICON.pickup,
  plastic: ICON.pickup,
  can: ICON.pickup,
};

/** A tool button: usable once its level is reached, otherwise shown locked as a little teaser. */
function tool(state: GameState, target: Target, tool: ToolId, verb: Verb, icon: string, label: string, cost: number, extra: Partial<Action> = {}): Action {
  if (!hasTool(state, tool)) return off(target, verb, icon, label, ICON.lock, { needLevel: TOOL_LEVEL[tool], ...extra });
  return act(state, target, verb, icon, label, cost, extra);
}

/** Calm, damp-enough days are "in prescription" for a controlled burn. */
function burnAction(state: GameState, target: Target, tx: number, ty: number): Action[] {
  if (!hasTool(state, 'torch')) return [];
  if (isBurning(state, tx, ty)) return [];
  // Raked, soaked or freshly burned ground has nothing to carry a flame.
  if (fuelAt(state, tx, ty) < 0.06) return [off(target, 'ignite', ICON.torch, 'Prescribed burn', ICON.bang)];
  const ok = burnPrescription(state, tx, ty, WEATHER[state.weather.kind].burnOk);
  if (ok === 'young') return [off(target, 'ignite', ICON.torch, 'Prescribed burn', ICON.wait)];
  if (ok === 'weather') return [off(target, 'ignite', ICON.torch, 'Prescribed burn', WEATHER[state.weather.kind].icon)];
  return [act(state, target, 'ignite', ICON.torch, 'Prescribed burn', 3)];
}

export function seedYield(state: GameState, e: NativePlantEntity): number {
  let n = SEED_YIELD[e.species];
  if (e.species === 'palmetto' && (e.bloomUntil ?? 0) >= state.day) n *= 2;
  if (e.species === 'oak' && calendar(state.day).season === 'fall') n += 2; // the fall acorn crop
  if (hasPerk(state, 7)) n += 1;
  return n;
}

export function captureCost(state: GameState, species: keyof typeof INVASIVE_ANIMALS): number {
  // Cold-stunned iguanas are easy to scoop up.
  return species === 'iguana' && state.weather.kind === 'cold' ? 2 : INVASIVE_ANIMALS[species].cost;
}

function pushBag(state: GameState, items: BagItem[]): void {
  state.bagItems = [...(state.bagItems ?? []), ...items].slice(-BAG_CAPACITY);
}

function speciesOf(e: Entity): SpeciesId | null {
  return e.kind === 'burrow' ? null : e.species;
}

function act(
  state: GameState,
  target: Target,
  verb: Verb,
  icon: string,
  label: string,
  cost: number,
  extra: Partial<Action> = {},
): Action {
  const affordable = canAfford(state, cost);
  return {
    verb,
    icon,
    label,
    cost,
    target,
    enabled: affordable,
    block: affordable ? undefined : ICON.battery,
    ...extra,
    ...(extra.enabled === false ? {} : affordable ? {} : { enabled: false }),
  };
}

function off(target: Target, verb: Verb, icon: string, label: string, block: string, extra: Partial<Action> = {}): Action {
  return { verb, icon, label, cost: 0, enabled: false, block, target, ...extra };
}

// --- per-target action lists ---------------------------------------------------------

function entityActions(state: GameState, e: Entity, target: Target): Action[] {
  const species = speciesOf(e);
  if (species && !state.scanned.includes(species)) return [act(state, target, 'scan', ICON.scan, 'Scan', 1)];
  const info = species ? [act(state, target, 'info', ICON.info, 'Field guide', 0)] : [];

  switch (e.kind) {
    case 'invasivePlant': {
      const stats = INVASIVE_PLANTS[e.species];
      const full = stats.bulbils > 0 && state.bag + stats.bulbils > BAG_CAPACITY;
      const a = full
        ? off(target, 'remove', VERB_ICON[e.species], stats.verb, ICON.bag)
        : act(state, target, 'remove', VERB_ICON[e.species], stats.verb, stats.cost);
      if (e.species === 'airpotato') { a.label = 'Untangle vines'; a.icon = ICON.cut; }
      const dig = e.species === 'cogon' ? [tool(state, target, 'probe', 'dig', ICON.dig, 'Dig out roots', 5)] : [];
      return [a, ...dig, ...info, ...burnAction(state, target, e.tx, e.ty)];
    }
    case 'hazard': {
      const stats = HAZARDS[e.species];
      const full = stats.trash > 0 && state.bag >= BAG_CAPACITY;
      const a = full
        ? off(target, 'remove', VERB_ICON[e.species], stats.verb, ICON.bag)
        : act(state, target, 'remove', VERB_ICON[e.species], stats.verb, stats.cost);
      if (e.species !== 'thicket') return [a, ...info];
      const burn = hasTool(state, 'torch') ? burnAction(state, target, e.tx, e.ty) : [off(target, 'ignite', ICON.torch, 'Prescribed burn', ICON.lock, { needLevel: TOOL_LEVEL.torch })];
      return [a, ...burn, ...info];
    }
    case 'nativePlant': {
      const tex = e.species;
      if (isChoked(state, e)) {
        const vine = chokingVines(state, e)[0];
        const bagFull = state.bag + INVASIVE_PLANTS.airpotato.bulbils > BAG_CAPACITY;
        const rescue = vine ? [act(state, target, 'rescue', ICON.cut, 'Free the vines', INVASIVE_PLANTS.airpotato.cost, {
          param: String(vine.id), enabled: !bagFull && canAfford(state, INVASIVE_PLANTS.airpotato.cost), block: bagFull ? ICON.bag : ICON.battery,
        })] : [];
        return [...rescue, off(target, 'collect', ICON.seeds, 'Collect seeds', ICON.sad, { tex }), ...info];
      }
      if (isRegrowing(state, e)) {
        return [off(target, 'collect', ICON.seeds, 'Collect seeds', ICON.wait, { tex }), ...info];
      }
      const seeds =
        e.lastSeedDay === state.day
          ? off(target, 'collect', ICON.seeds, 'Collect seeds', ICON.done)
          : act(state, target, 'collect', ICON.seeds, 'Collect seeds', 2);
      const sprig =
        (e.lastSprigDay ?? 0) === state.day
          ? off(target, 'snip', ICON.sprig, 'Snip a sprig', ICON.done)
          : act(state, target, 'snip', ICON.sprig, 'Snip a sprig', 1);
      return [seeds, sprig, ...info, ...burnAction(state, target, e.tx, e.ty)];
    }
    case 'invasiveAnimal': {
      const meta = INVASIVE_ANIMALS[e.species];
      const icon = meta.container === 'crate' ? ICON.crate : ICON.jar;
      const blocked =
        meta.container === 'crate' ? state.crate !== null : state.jar >= JAR_CAPACITY;
      const a = blocked
        ? off(target, 'capture', icon, 'Capture', meta.container === 'crate' ? ICON.crate : ICON.jar)
        : act(state, target, 'capture', icon, 'Capture', captureCost(state, e.species));
      return [a, ...info];
    }
    case 'nativeAnimal':
      return [act(state, target, 'greet', ICON.greet, 'Say hi', 0), tool(state, target, 'camera', 'photo', ICON.camera, 'Take a portrait', 1, { tex: e.species }), ...info];
    case 'burrow': {
      const peeked = e.scopedDay === state.day;
      const scope = hasTool(state, 'scope') && peeked
        ? off(target, 'scope', ICON.scope, 'Burrow scope', ICON.done)
        : tool(state, target, 'scope', 'scope', ICON.scope, 'Burrow scope', 2);
      return [scope, act(state, target, 'info', ICON.info, 'Field guide', 0, { param: 'tortoise' })];
    }
  }
}

function fireActions(state: GameState, target: Target): Action[] {
  const water = state.water > 0
    ? act(state, target, 'contain', ICON.douse, 'Contain the fire', 0)
    : off(target, 'contain', ICON.douse, 'Contain the fire', ICON.tank);
  return [water, act(state, target, 'watchFire', ICON.eye, 'Let it burn', 0), act(state, target, 'info', ICON.info, 'Field guide', 0, { param: 'fire' })];
}

function stationActions(state: GameState, st: Station, target: Target): Action[] {
  switch (st.kind) {
    case 'pod':
      return [act(state, target, 'enter', ICON.enter, 'Go inside', 0)];
    case 'recycler':
      return state.bag > 0
        ? [act(state, target, 'recycle', ICON.recycle, 'Recycle', 0), state.bag >= 2 ? act(state, target, 'sort', ICON.sort, 'Sort for a bonus', 0) : off(target, 'sort', ICON.sort, 'Sort for a bonus', ICON.bag)]
        : [off(target, 'recycle', ICON.recycle, 'Recycle', ICON.bag)];
    case 'pad':
      return state.crate || state.jar > 0
        ? [act(state, target, 'dropoff', ICON.dropoff, 'Drop off', 0)]
        : [off(target, 'dropoff', ICON.dropoff, 'Drop off', ICON.crate)];
  }
}

const UPGRADE_ICON: Record<UpgradeId, string> = {
  battery: ICON.battery,
  slots: ICON.slots,
  vase: ICON.vase,
  room: ICON.room,
  tank: ICON.tank,
};

function homeActions(state: GameState, item: HomeItem, target: Target): Action[] {
  switch (item.kind) {
    case 'cradle':
      return [act(state, target, 'sleep', ICON.sleep, 'Sleep', 0)];
    case 'door':
      return [act(state, target, 'exit', ICON.exit, 'Go outside', 0)];
    case 'board':
      return [act(state, target, 'board', ICON.board, 'Corkboard', 0)];
    case 'monitor':
      return [act(state, target, 'monitor', ICON.monitor, 'Wildlife monitor', 0)];
    case 'window':
      return [];
    case 'bench':
      return (['battery', 'slots', 'vase', 'room', 'tank'] as UpgradeId[]).map((id) => {
        const st = upgradeStatus(state, id);
        const block = st.block === 'parts' ? ICON.parts : st.block === 'max' ? ICON.done : st.block === 'milestone' ? ICON.lock : undefined;
        return {
          verb: 'upgrade' as const,
          icon: UPGRADE_ICON[id],
          label: id === 'tank' ? 'Bigger water tank' : `Upgrade ${id}`,
          cost: 0,
          parts: UPGRADE_COST[id],
          enabled: st.ok,
          block,
          blockTex: st.needs,
          target,
          param: id,
        };
      });
    case 'slot': {
      const i = item.index ?? 0;
      const tray = state.trays[i];
      const stage = trayStage(tray);
      if (stage === 'empty') {
        const have = NATIVE_PLANTS.filter((p) => state.seeds[p] > 0);
        if (have.length === 0) return [off(target, 'sow', ICON.seeds, 'Sow', ICON.question)];
        return have.map((p) => act(state, target, 'sow', ICON.seeds, `Sow ${speciesName(p)}`, 1, { tex: p, param: p }));
      }
      const tex = tray.seed ?? undefined;
      if (stage === 'ready') return [act(state, target, 'pot', ICON.pot, 'Pot up', 0, { tex })];
      if (!tray.watered) return [act(state, target, 'water', ICON.water, 'Water', 1, { tex })];
      return [off(target, 'water', ICON.water, 'Water', ICON.wait, { tex })];
    }
    case 'vase': {
      const i = item.index ?? 0;
      const have = NATIVE_PLANTS.filter((p) => state.sprigs[p] > 0);
      const out = have.map((p) => act(state, target, 'arrange', ICON.sprig, `Arrange ${speciesName(p)}`, 0, { tex: p, param: p }));
      if ((state.vases[i]?.length ?? 0) > 0) out.push(act(state, target, 'clearVase', ICON.clear, 'Empty vase', 0));
      if (out.length === 0) out.push(off(target, 'arrange', ICON.sprig, 'Arrange', ICON.question));
      return out;
    }
  }
}

export function canPlantAt(state: GameState, tx: number, ty: number): boolean {
  return inBounds(tx, ty) && zoneAt(tx, ty) !== 'base' && !tileOccupied(state, tx, ty);
}

function selfActions(state: GameState, spot: Tile | null, target: Target): Action[] {
  const out: Action[] = [];
  const have = NATIVE_PLANTS.filter((p) => state.seedlings[p] > 0);
  for (const p of have) {
    const ok = !!spot && canPlantAt(state, spot.tx, spot.ty);
    out.push(
      ok
        ? act(state, target, 'plant', ICON.plant, `Plant ${speciesName(p)}`, 3, { tex: p, param: p })
        : off(target, 'plant', ICON.plant, `Plant ${speciesName(p)}`, ICON.bang, { tex: p, param: p }),
    );
  }
  if (state.location === 'outside') out.push(act(state, target, 'goHome', ICON.home, 'Go home', 0));
  return out;
}

export function getActions(state: GameState, target: Target): Action[] {
  switch (target.type) {
    case 'entity':
      return entityActions(state, target.entity, target);
    case 'station':
      return stationActions(state, target.station, target);
    case 'home':
      return homeActions(state, target.item, target);
    case 'self':
      return selfActions(state, target.spot, target);
    case 'fire':
      return fireActions(state, target);
  }
}

export { isRegrowing };

// --- doing it ------------------------------------------------------------------------

export function result(partial: Partial<ActionResult>): ActionResult {
  return { ok: true, fx: 'none', gains: [], rescued: [], ...partial };
}

function targetPos(t: Target): { x: number; y: number } | undefined {
  switch (t.type) {
    case 'entity':
      return 'tx' in t.entity ? tileCenter(t.entity.tx, t.entity.ty) : { x: t.entity.x, y: t.entity.y };
    case 'station':
      return tileCenter(t.station.tx, t.station.ty);
    case 'self':
      return t.spot ? tileCenter(t.spot.tx, t.spot.ty) : undefined;
    case 'fire':
      return tileCenter(t.tx, t.ty);
    case 'home':
      return undefined;
  }
}

/** Fold care credit (care points, goals, levels) into an action's result. */
export function withCredit(res: ActionResult, state: GameState, events: [CareEvent, number?, number?][]): ActionResult {
  for (const [ev, n, xp] of events) {
    const c: Credit = credit(state, ev, n ?? 1, xp);
    res.xp = (res.xp ?? 0) + c.xp;
    res.levelUps = [...(res.levelUps ?? []), ...c.levelUps];
    res.tasks = [...(res.tasks ?? []), ...c.tasks];
    res.allDone ||= c.allDone;
  }
  return res;
}

export function performAction(state: GameState, a: Action): ActionResult {
  const res = performCore(state, a);
  if (!res.ok) return res;
  const t = a.target;
  const e = t.type === 'entity' ? t.entity : null;
  const events: [CareEvent, number?][] = [];
  switch (a.verb) {
    case 'scan': events.push(['scan']); break;
    case 'remove':
    case 'rescue':
      if (res.fx === 'pop' && e) {
        const species = a.verb === 'rescue' ? 'airpotato' : 'species' in e ? e.species : '';
        events.push([species === 'thicket' ? 'thicket' : e.kind === 'hazard' && a.verb === 'remove' ? 'trash' : 'clear']);
      }
      if (res.rescued.length) events.push(['rescue', res.rescued.length]);
      break;
    case 'collect': events.push(['seeds']); break;
    case 'snip': events.push(['sprig']); break;
    case 'capture': events.push(['capture']); break;
    case 'greet': if (res.gains.length) events.push(['greet']); break;
    case 'recycle': events.push(['recycle', Math.max(1, res.gains[0]?.n ?? 1)]); break;
    case 'plant': events.push(['plant']); break;
    case 'sow': events.push(['sow']); break;
    case 'water': events.push(['water']); break;
    case 'pot': events.push(['pot']); break;
    case 'ignite': events.push(['prescribe']); break;
    default: break;
  }
  return events.length ? withCredit(res, state, events) : res;
}

function performCore(state: GameState, a: Action): ActionResult {
  if (!a.enabled) return result({ ok: false, mood: 'sad' });
  const targetEntity = a.target.type === 'entity' ? a.target.entity : null;
  if (targetEntity && !state.entities.some(e => e.id === targetEntity.id)) return result({ ok: false });
  const workEntity = a.verb === 'rescue' ? state.entities.find(e => String(e.id) === a.param && e.kind === 'invasivePlant' && e.species === 'airpotato') : targetEntity;
  if ((a.verb === 'remove' || a.verb === 'rescue') && workEntity?.kind === 'invasivePlant' && workEntity.species === 'airpotato') {
    if (!workEntity.care || careStage(workEntity.care) !== 'done' || state.bag + INVASIVE_PLANTS.airpotato.bulbils > BAG_CAPACITY) return result({ ok: false });
  }
  if (a.verb === 'rescue' && !workEntity) return result({ ok: false });
  if (a.verb === 'ignite' && !(targetEntity && 'tx' in targetEntity && fuelAt(state, targetEntity.tx, targetEntity.ty) >= 0.06)) return result({ ok: false, mood: 'sad' });
  if (!spend(state, a.cost)) return result({ ok: false, mood: 'sad' });

  const t = a.target;
  const entity = workEntity;
  const item = t.type === 'home' ? t.item : null;
  const at = targetPos(t);

  switch (a.verb) {
    case 'scan': {
      const species = entity ? speciesOf(entity) : null;
      if (!species) return result({ ok: false });
      state.scanned.push(species);
      return result({ scanned: species, fx: 'scan', at, mood: 'surprise' });
    }

    case 'info': {
      const species = a.param ? (a.param as SpeciesId) : entity ? speciesOf(entity) : null;
      return result({ open: 'guide', guideId: species ?? undefined });
    }

    case 'rescue':
    case 'remove': {
      if (!entity || (entity.kind !== 'invasivePlant' && entity.kind !== 'hazard')) return result({ ok: false });
      entity.hp--;
      if (entity.hp > 0) return result({ fx: 'hit', at });
      removeEntity(state, entity.id);
      const gains: Gain[] = [];
      if (entity.kind === 'invasivePlant') {
        state.stats.invasivesRemoved++;
        const bulbils = INVASIVE_PLANTS[entity.species].bulbils;
        if (bulbils > 0) {
          state.bag = Math.min(BAG_CAPACITY, state.bag + bulbils);
          pushBag(state, Array.from({ length: bulbils }, () => 'bulbil' as const));
          gains.push({ icon: ICON.bag, n: bulbils });
        }
        // Hand-pulled cogon leaves runners in the sand that may sprout again.
        if (entity.species === 'cogon') state.seedbank.push({ tx: entity.tx, ty: entity.ty, species: 'cogon', day: state.day + 1, chance: 0.2 });
      } else {
        const trash = HAZARDS[entity.species].trash;
        if (trash > 0) {
          state.bag = Math.min(BAG_CAPACITY, state.bag + trash);
          state.stats.trashCollected += trash;
          if (entity.species !== 'thicket') pushBag(state, [entity.species]);
          gains.push({ icon: ICON.bag, n: trash });
        }
      }
      const rescued = refreshRescues(state);
      const careful = entity.kind === 'invasivePlant' && entity.species === 'airpotato';
      if (careful && entity.care?.brushes === 0) { state.parts++; gains.push({ icon: ICON.parts, n: 1 }); }
      return result({ fx: 'pop', at, gains, rescued, mood: rescued.length ? 'love' : 'happy', note: careful ? 'Vines and bulbils gathered. A little more room to breathe.' : rescued.length ? 'Sunlight reaches the native leaves again!' : undefined });
    }

    case 'collect': {
      if (entity?.kind !== 'nativePlant') return result({ ok: false });
      const n = seedYield(state, entity);
      state.seeds[entity.species] += n;
      entity.lastSeedDay = state.day;
      return result({ fx: 'sparkle', at, gains: [{ icon: ICON.seeds, tex: entity.species, n }], mood: 'happy' });
    }

    case 'snip': {
      if (entity?.kind !== 'nativePlant') return result({ ok: false });
      state.sprigs[entity.species]++;
      entity.lastSprigDay = state.day;
      return result({ fx: 'sparkle', at, gains: [{ icon: ICON.sprig, tex: entity.species, n: 1 }], mood: 'love' });
    }

    case 'capture': {
      if (entity?.kind !== 'invasiveAnimal') return result({ ok: false });
      removeEntity(state, entity.id);
      if (INVASIVE_ANIMALS[entity.species].container === 'jar') {
        state.jar++;
        return result({ fx: 'capture', at, gains: [{ icon: ICON.jar, tex: 'anole', n: 1 }], mood: 'happy' });
      }
      const name = entity.species === 'cat' ? CAT_NAMES[state.catNameIndex++ % CAT_NAMES.length] : undefined;
      state.crate = { species: entity.species, name };
      return result({ fx: 'capture', at, gains: [{ icon: ICON.crate, tex: entity.species, n: 1 }], mood: 'happy' });
    }

    case 'greet': {
      if (entity?.kind !== 'nativeAnimal') return result({ ok: false });
      state.encounters ??= [];
      const key = `${state.day}:${entity.species}`;
      const first = !state.encounters.includes(key);
      if (first) { state.encounters.push(key); state.parts++; }
      const moments = { tortoise: 'A slow, sunny stretch. Your tortoise friend found a shiny part!', mouse: 'Peekaboo! A little mouse leaves a tiny treasure.', jay: 'An acorn inspection… approved! A scrub-jay brings you a treasure.', indigo: 'A gentle ribbon of blue curls hello. Something shiny in the sand!' };
      return result({ fx: 'sparkle', at, mood: 'love', friend: entity.id, gains: first ? [{ icon: ICON.parts, n: 1 }] : [], note: first ? moments[entity.species] : 'Your little neighbor is happy to see you again.' });
    }

    case 'enter':
      state.location = 'home';
      return result({ enter: true });

    case 'exit':
      state.location = 'outside';
      return result({ exit: true });

    case 'recycle': {
      const n = state.bag;
      state.parts += n;
      state.bag = 0;
      state.bagItems = [];
      return result({ fx: 'sparkle', at, gains: [{ icon: ICON.parts, n }], mood: 'proud' });
    }

    case 'sort':
      return result({ play: 'sort' });

    case 'contain':
      return result({ play: 'fireLine' });

    case 'watchFire': {
      const fire = t.type === 'fire' ? fireState(fuelAge(state, t.tx, t.ty)) : 'ready';
      return result({ mood: FIRE_STATE_INFO[fire].good ? 'happy' : 'surprise', note: FIRE_STATE_INFO[fire].good ? 'The robot steps back. This old scrub has waited a long time for fire.' : 'Careful: this ground burned recently. Young sprouts may be lost.' });
    }

    case 'ignite': {
      const tile = entity && 'tx' in entity ? { tx: entity.tx, ty: entity.ty } : null;
      if (!tile || !ignite(state, tile.tx, tile.ty)) return result({ ok: false, mood: 'sad' });
      refreshRescues(state);
      return result({ fx: 'pop', at, mood: 'surprise', fireAt: tile, note: 'A small, careful flame. Watch it creep through the old fuel.' });
    }

    case 'photo':
      return result({ play: 'photo' });

    case 'dig':
      return result({ play: 'dig' });

    case 'scope':
      if (entity?.kind === 'burrow') entity.scopedDay = state.day;
      return result({ play: 'scope' });

    case 'dropoff': {
      const gains: Gain[] = [];
      if (state.crate) {
        state.pad.push(state.crate);
        gains.push({ icon: ICON.truck, tex: state.crate.species, n: 1 });
        state.crate = null;
      }
      if (state.jar > 0) {
        state.padAnoles += state.jar;
        gains.push({ icon: ICON.truck, tex: 'anole', n: state.jar });
        state.jar = 0;
      }
      return result({ fx: 'pop', at, gains, mood: 'proud' });
    }

    case 'sleep':
      return result({ sleep: true });

    case 'sow': {
      const ok = !!sow(state, item?.index ?? 0, a.param as NativePlantId);
      return result({ ok, fx: 'pop', mood: 'happy' });
    }

    case 'water':
      water(state, item?.index ?? 0);
      return result({ fx: 'sparkle', mood: 'happy' });

    case 'pot': {
      const species = pot(state, item?.index ?? 0);
      return result({
        ok: !!species,
        fx: 'pop',
        gains: species ? [{ icon: ICON.plant, tex: species, n: 1 }] : [],
        mood: 'love',
      });
    }

    case 'arrange':
      return result({ ok: placeSprig(state, item?.index ?? 0, a.param as NativePlantId), fx: 'sparkle', mood: 'love' });

    case 'clearVase':
      return result({ ok: clearVase(state, item?.index ?? 0), fx: 'pop' });

    case 'board':
      return result({ open: 'board' });

    case 'monitor':
      return result({ open: 'monitor' });

    case 'upgrade': {
      const ok = buyUpgrade(state, a.param as UpgradeId);
      return result({ ok, fx: 'sparkle', mood: ok ? 'proud' : 'sad' });
    }

    case 'plant': {
      const spot = t.type === 'self' ? t.spot : null;
      const species = a.param as NativePlantId;
      if (!spot || !canPlantAt(state, spot.tx, spot.ty) || state.seedlings[species] <= 0) return result({ ok: false, mood: 'sad' });
      state.seedlings[species]--;
      addEntity<NativePlantEntity>(state, {
        kind: 'nativePlant',
        species,
        tx: spot.tx,
        ty: spot.ty,
        planted: true,
        plantedDay: state.day,
        lastSeedDay: 0,
        rescued: true,
      });
      state.stats.planted++;
      return result({ fx: 'sparkle', at, mood: 'love' });
    }

    case 'goHome':
      return result({});
  }
}
