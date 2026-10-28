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
import { UPGRADE_COST, UpgradeId, buyUpgrade, clearVase, placeSprig, upgradeStatus } from './home';
import { pot, sow, trayStage, water } from './nursery';
import { Tile } from './pathfind';
import {
  Entity,
  GameState,
  NATIVE_PLANTS,
  NativePlantEntity,
  addEntity,
  isChoked,
  refreshRescues,
  removeEntity,
  tileOccupied,
} from './state';

export type Target =
  | { type: 'entity'; entity: Entity }
  | { type: 'station'; station: Station }
  | { type: 'home'; item: HomeItem }
  | { type: 'self'; spot: Tile | null };

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
  | 'goHome';

export interface Action {
  verb: Verb;
  /** Emoji shown on the button. */
  icon: string;
  /** Texture key drawn on the button instead of / beside the emoji (species pictures). */
  tex?: string;
  /** Accessible name for screen readers and tooltips — never shown as in-game dialogue. */
  label: string;
  cost: number;
  parts?: number;
  enabled: boolean;
  /** Emoji explaining why it's disabled (🔋, 🎒, 🥀 …). */
  block?: string;
  blockTex?: string;
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
};

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
      const full = stats.bulbils > 0 && state.bag >= BAG_CAPACITY;
      const a = full
        ? off(target, 'remove', VERB_ICON[e.species], stats.verb, ICON.bag)
        : act(state, target, 'remove', VERB_ICON[e.species], stats.verb, stats.cost);
      return [a, ...info];
    }
    case 'hazard': {
      const stats = HAZARDS[e.species];
      const full = stats.trash > 0 && state.bag >= BAG_CAPACITY;
      const a = full
        ? off(target, 'remove', VERB_ICON[e.species], stats.verb, ICON.bag)
        : act(state, target, 'remove', VERB_ICON[e.species], stats.verb, stats.cost);
      return [a, ...info];
    }
    case 'nativePlant': {
      const tex = e.species;
      if (isChoked(state, e)) {
        return [off(target, 'collect', ICON.seeds, 'Collect seeds', ICON.sad, { tex }), ...info];
      }
      if (e.planted && state.day - e.plantedDay < 2) {
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
      return [seeds, sprig, ...info];
    }
    case 'invasiveAnimal': {
      const meta = INVASIVE_ANIMALS[e.species];
      const icon = meta.container === 'crate' ? ICON.crate : ICON.jar;
      const blocked =
        meta.container === 'crate' ? state.crate !== null : state.jar >= JAR_CAPACITY;
      const a = blocked
        ? off(target, 'capture', icon, 'Capture', meta.container === 'crate' ? ICON.crate : ICON.jar)
        : act(state, target, 'capture', icon, 'Capture', meta.cost);
      return [a, ...info];
    }
    case 'nativeAnimal':
      return [act(state, target, 'greet', ICON.greet, 'Say hi', 0), ...info];
    case 'burrow':
      return [];
  }
}

function stationActions(state: GameState, st: Station, target: Target): Action[] {
  switch (st.kind) {
    case 'pod':
      return [act(state, target, 'enter', ICON.enter, 'Go inside', 0)];
    case 'recycler':
      return state.bag > 0
        ? [act(state, target, 'recycle', ICON.recycle, 'Recycle', 0)]
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
      return (['battery', 'slots', 'vase', 'room'] as UpgradeId[]).map((id) => {
        const st = upgradeStatus(state, id);
        const block = st.block === 'parts' ? ICON.parts : st.block === 'max' ? ICON.done : st.block === 'milestone' ? ICON.lock : undefined;
        return {
          verb: 'upgrade' as const,
          icon: UPGRADE_ICON[id],
          label: `Upgrade ${id}`,
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
  }
}

// --- doing it ------------------------------------------------------------------------

function result(partial: Partial<ActionResult>): ActionResult {
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
    case 'home':
      return undefined;
  }
}

export function performAction(state: GameState, a: Action): ActionResult {
  if (!a.enabled) return result({ ok: false, mood: 'sad' });
  if (!spend(state, a.cost)) return result({ ok: false, mood: 'sad' });

  const t = a.target;
  const entity = t.type === 'entity' ? t.entity : null;
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
      const species = entity ? speciesOf(entity) : null;
      return result({ open: 'guide', guideId: species ?? undefined });
    }

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
          gains.push({ icon: ICON.bag, n: bulbils });
        }
      } else {
        const trash = HAZARDS[entity.species].trash;
        if (trash > 0) {
          state.bag = Math.min(BAG_CAPACITY, state.bag + trash);
          state.stats.trashCollected += trash;
          gains.push({ icon: ICON.bag, n: trash });
        }
      }
      const rescued = refreshRescues(state);
      return result({ fx: 'pop', at, gains, rescued, mood: rescued.length ? 'love' : 'happy' });
    }

    case 'collect': {
      if (entity?.kind !== 'nativePlant') return result({ ok: false });
      const n = SEED_YIELD[entity.species];
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
      return result({ fx: 'sparkle', at, mood: 'love' });
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
      return result({ fx: 'sparkle', at, gains: [{ icon: ICON.parts, n }], mood: 'proud' });
    }

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
