// The single context button: figure out what the robot can do right now, and do it.
import { BAG_CAPACITY, BATTERY_UPGRADE_COST, JAR_CAPACITY } from '../config';
import { Station, ZoneId, inBounds, tileCenter, zoneAt } from '../data/map';
import {
  CAT_NAMES,
  GUIDE_BY_ID,
  HAZARDS,
  INVASIVE_ANIMALS,
  INVASIVE_PLANTS,
  NativePlantId,
  SEED_NOUN,
  SEED_YIELD,
  SpeciesId,
  speciesName,
} from '../data/species';
import { canAfford, canUpgrade, spend, upgrade } from './battery';
import { nextSeed, pot, sow, trayStage, water } from './nursery';
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

export type Target = { type: 'station'; station: Station } | { type: 'entity'; entity: Entity };

export type Verb =
  | 'sleep'
  | 'recycle'
  | 'upgrade'
  | 'dropoff'
  | 'sow'
  | 'water'
  | 'pot'
  | 'scan'
  | 'remove'
  | 'collect'
  | 'capture'
  | 'greet'
  | 'plant'
  | 'none';

export interface Action {
  verb: Verb;
  /** Short button label, e.g. "Pull". */
  label: string;
  /** What it applies to, e.g. "Cogon grass". */
  detail: string;
  cost: number;
  enabled: boolean;
  /** Why it's disabled, shown as a hint. */
  reason?: string;
  target: Target | null;
  spot?: { tx: number; ty: number };
}

export type Fx = 'hit' | 'pop' | 'sparkle' | 'scan' | 'capture' | 'none';

export interface ActionResult {
  ok: boolean;
  messages: string[];
  /** Species whose field guide entry was just unlocked. */
  scanned?: SpeciesId;
  sleep?: boolean;
  fx: Fx;
  at?: { x: number; y: number };
  rescued: NativePlantEntity[];
}

function speciesOf(e: Entity): SpeciesId | null {
  return e.kind === 'burrow' ? null : e.species;
}

function make(
  verb: Verb,
  label: string,
  detail: string,
  cost: number,
  target: Target | null,
  state: GameState,
  extra: Partial<Action> = {},
): Action {
  const affordable = canAfford(state, cost);
  return {
    verb,
    label,
    detail,
    cost,
    target,
    enabled: affordable,
    reason: affordable ? undefined : 'Not enough battery — rest at the dock',
    ...extra,
  };
}

function disabled(label: string, detail: string, reason: string, target: Target | null): Action {
  return { verb: 'none', label, detail, cost: 0, enabled: false, reason, target };
}

function stationAction(state: GameState, station: Station): Action {
  const target: Target = { type: 'station', station };
  switch (station.kind) {
    case 'dock':
      return make('sleep', 'Sleep', 'Charging dock', 0, target, state);
    case 'recycler':
      if (state.bag > 0) return make('recycle', 'Recycle', `${state.bag} item${state.bag > 1 ? 's' : ''} → parts`, 0, target, state);
      if (canUpgrade(state)) return make('upgrade', 'Upgrade', `Bigger battery (${BATTERY_UPGRADE_COST} parts)`, 0, target, state);
      return disabled('Recycler', 'Recycler', 'Bring trash here to earn parts', target);
    case 'pad':
      if (state.crate || state.jar > 0) return make('dropoff', 'Drop off', 'Relocation pad', 0, target, state);
      return disabled('Pad', 'Relocation pad', 'Crate invasive animals and bring them here', target);
    case 'tray': {
      const tray = state.trays[station.index ?? 0];
      const stage = trayStage(tray);
      if (stage === 'empty') {
        const seed = nextSeed(state);
        if (!seed) return disabled('Sow', 'Empty seed tray', 'Collect seeds from rescued native plants', target);
        return make('sow', 'Sow', speciesName(seed), 1, target, state);
      }
      const name = speciesName(tray.seed as NativePlantId);
      if (stage === 'ready') return make('pot', 'Pot up', `${name} seedling`, 0, target, state);
      if (!tray.watered) return make('water', 'Water', `${name} tray`, 1, target, state);
      return disabled('Growing', `${name} tray`, 'Watered! It will grow overnight', target);
    }
  }
}

function entityAction(state: GameState, e: Entity): Action {
  const target: Target = { type: 'entity', entity: e };
  const species = speciesOf(e);
  if (species && !state.scanned.includes(species)) {
    return make('scan', 'Scan', '???', 1, target, state);
  }
  switch (e.kind) {
    case 'invasivePlant': {
      const stats = INVASIVE_PLANTS[e.species];
      if (stats.bulbils > 0 && state.bag >= BAG_CAPACITY) {
        return disabled(stats.verb, speciesName(e.species), 'Bag full — recycle at base', target);
      }
      return make('remove', stats.verb, speciesName(e.species), stats.cost, target, state);
    }
    case 'hazard': {
      const stats = HAZARDS[e.species];
      if (stats.trash > 0 && state.bag >= BAG_CAPACITY) {
        return disabled(stats.verb, speciesName(e.species), 'Bag full — recycle at base', target);
      }
      return make('remove', stats.verb, speciesName(e.species), stats.cost, target, state);
    }
    case 'nativePlant': {
      const name = speciesName(e.species);
      if (isChoked(state, e)) return disabled('Choked', name, 'Clear the invasives around it first', target);
      if (e.planted && state.day - e.plantedDay < 2) return disabled('Growing', name, 'Freshly planted — give it a couple of days', target);
      if (e.lastSeedDay === state.day) return disabled('Collected', name, 'Already gave seeds today', target);
      return make('collect', 'Collect', SEED_NOUN[e.species] + 's', 2, target, state);
    }
    case 'invasiveAnimal': {
      const info = INVASIVE_ANIMALS[e.species];
      const name = speciesName(e.species);
      if (info.container === 'crate' && state.crate) {
        return disabled('Crate full', name, 'Take your crate to the relocation pad', target);
      }
      if (info.container === 'jar' && state.jar >= JAR_CAPACITY) {
        return disabled('Jar full', name, 'Empty your jar at the relocation pad', target);
      }
      return make('capture', info.container === 'crate' ? 'Crate' : 'Catch', name, info.cost, target, state);
    }
    case 'nativeAnimal':
      return make('greet', 'Say hi', speciesName(e.species), 0, target, state);
    case 'burrow':
      return disabled('Burrow', 'Tortoise burrow', 'A cozy home for lots of scrub critters', target);
  }
}

/** Natives grow best in their favourite part of the scrub. */
const PREFERRED_ZONE: Record<NativePlantId, ZoneId> = {
  palmetto: 'sand',
  hickory: 'sand',
  oak: 'oak',
  rosemary: 'rosemary',
};

export function seedlingFor(state: GameState, zone: ZoneId): NativePlantId | null {
  const have = NATIVE_PLANTS.filter((p) => state.seedlings[p] > 0);
  if (have.length === 0) return null;
  return have.find((p) => PREFERRED_ZONE[p] === zone) ?? have[0];
}

export function canPlantAt(state: GameState, tx: number, ty: number): boolean {
  return inBounds(tx, ty) && zoneAt(tx, ty) !== 'base' && !tileOccupied(state, tx, ty);
}

/** Resolve the context action for the nearest target, or for planting on the tile in front. */
export function getAction(
  state: GameState,
  target: Target | null,
  spot: { tx: number; ty: number } | null,
): Action | null {
  let action: Action | null = null;
  if (target) action = target.type === 'station' ? stationAction(state, target.station) : entityAction(state, target.entity);

  // Planting wins over a disabled hint so the robot isn't stuck next to e.g. a choked plant.
  if ((!action || !action.enabled) && spot && canPlantAt(state, spot.tx, spot.ty)) {
    const seedling = seedlingFor(state, zoneAt(spot.tx, spot.ty));
    if (seedling) return make('plant', 'Plant', speciesName(seedling), 3, null, state, { spot });
  }
  return action;
}

function result(partial: Partial<ActionResult>): ActionResult {
  return { ok: true, messages: [], fx: 'none', rescued: [], ...partial };
}

export function performAction(state: GameState, action: Action): ActionResult {
  if (!action.enabled) return result({ ok: false, messages: action.reason ? [action.reason] : [] });
  if (!spend(state, action.cost)) return result({ ok: false, messages: ['Not enough battery — rest at the dock'] });

  const target = action.target;
  const entity = target?.type === 'entity' ? target.entity : null;
  const station = target?.type === 'station' ? target.station : null;
  const at = entity
    ? 'tx' in entity
      ? tileCenter(entity.tx, entity.ty)
      : { x: entity.x, y: entity.y }
    : station
      ? tileCenter(station.tx, station.ty)
      : action.spot
        ? tileCenter(action.spot.tx, action.spot.ty)
        : undefined;

  switch (action.verb) {
    case 'sleep':
      return result({ sleep: true, at });

    case 'recycle': {
      const n = state.bag;
      state.parts += n;
      state.bag = 0;
      const hint = canUpgrade(state) ? ' You can upgrade your battery now!' : '';
      return result({ messages: [`Recycled ${n} item${n > 1 ? 's' : ''} into ${n} part${n > 1 ? 's' : ''}.${hint}`], fx: 'sparkle', at });
    }

    case 'upgrade':
      upgrade(state);
      return result({ messages: [`Battery upgraded! Max charge is now ${state.batteryMax}.`], fx: 'sparkle', at });

    case 'dropoff': {
      const msgs: string[] = [];
      if (state.crate) {
        state.pad.push(state.crate);
        msgs.push(
          state.crate.species === 'cat'
            ? `${state.crate.name} the cat is snug on the pad. The shelter van comes tonight.`
            : `${speciesName(state.crate.species)} dropped off. Wildlife officers will pick it up tonight.`,
        );
        state.crate = null;
      }
      if (state.jar > 0) {
        state.padAnoles += state.jar;
        msgs.push(`${state.jar} anole${state.jar > 1 ? 's' : ''} dropped off for pickup.`);
        state.jar = 0;
      }
      return result({ messages: msgs, fx: 'pop', at });
    }

    case 'sow': {
      const seed = sow(state, station?.index ?? 0);
      return result({ ok: !!seed, messages: seed ? [`Sowed ${speciesName(seed).toLowerCase()} seeds. Don't forget to water!`] : [], fx: 'pop', at });
    }

    case 'water':
      water(state, station?.index ?? 0);
      return result({ messages: ['Watered! The seeds will grow overnight.'], fx: 'sparkle', at });

    case 'pot': {
      const species = pot(state, station?.index ?? 0);
      return result({
        messages: species ? [`Potted a ${speciesName(species).toLowerCase()} seedling. Plant it out in a cleared spot!`] : [],
        fx: 'pop',
        at,
      });
    }

    case 'scan': {
      const species = entity ? speciesOf(entity) : null;
      if (!species) return result({ ok: false });
      state.scanned.push(species);
      const entry = GUIDE_BY_ID[species];
      return result({ scanned: species, messages: [`New field guide entry: ${entry.name}!`], fx: 'scan', at });
    }

    case 'remove': {
      if (!entity || (entity.kind !== 'invasivePlant' && entity.kind !== 'hazard')) return result({ ok: false });
      entity.hp--;
      if (entity.hp > 0) return result({ fx: 'hit', at });
      removeEntity(state, entity.id);
      const msgs: string[] = [];
      if (entity.kind === 'invasivePlant') {
        state.stats.invasivesRemoved++;
        const bulbils = INVASIVE_PLANTS[entity.species].bulbils;
        if (bulbils > 0) {
          state.bag = Math.min(BAG_CAPACITY, state.bag + bulbils);
          msgs.push('Bagged the bulbils so they can’t sprout.');
        }
      } else {
        const trash = HAZARDS[entity.species].trash;
        if (trash > 0) {
          state.bag = Math.min(BAG_CAPACITY, state.bag + trash);
          state.stats.trashCollected += trash;
          if (state.bag >= BAG_CAPACITY) msgs.push('Bag full! Take it to the recycler.');
        }
      }
      const rescued = refreshRescues(state);
      for (const r of rescued) msgs.push(`Rescued a ${speciesName(r.species).toLowerCase()}! It can make seeds now.`);
      return result({ messages: msgs, fx: 'pop', at, rescued });
    }

    case 'collect': {
      if (entity?.kind !== 'nativePlant') return result({ ok: false });
      const n = SEED_YIELD[entity.species];
      state.seeds[entity.species] += n;
      state.selectedSeed = entity.species;
      entity.lastSeedDay = state.day;
      return result({
        messages: [`Collected ${n} ${SEED_NOUN[entity.species]}${n > 1 ? 's' : ''}. Sow them in a nursery tray at base.`],
        fx: 'sparkle',
        at,
      });
    }

    case 'capture': {
      if (entity?.kind !== 'invasiveAnimal') return result({ ok: false });
      removeEntity(state, entity.id);
      if (INVASIVE_ANIMALS[entity.species].container === 'jar') {
        state.jar++;
        return result({ messages: ['Gently caught an anole in your jar.'], fx: 'capture', at });
      }
      const name = entity.species === 'cat' ? CAT_NAMES[state.catNameIndex++ % CAT_NAMES.length] : undefined;
      state.crate = { species: entity.species, name };
      const msg =
        entity.species === 'cat'
          ? `Coaxed a cat into the crate with a treat. Let's call them ${name}. Off to the pad!`
          : `${speciesName(entity.species)} safely crated. Bring it to the relocation pad.`;
      return result({ messages: [msg], fx: 'capture', at });
    }

    case 'greet': {
      if (entity?.kind !== 'nativeAnimal') return result({ ok: false });
      const facts = GUIDE_BY_ID[entity.species].facts;
      return result({ messages: [facts[(state.day + entity.id) % facts.length]], fx: 'sparkle', at });
    }

    case 'plant': {
      const spot = action.spot;
      if (!spot) return result({ ok: false });
      const species = seedlingFor(state, zoneAt(spot.tx, spot.ty));
      if (!species) return result({ ok: false });
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
      return result({ messages: [`Planted a ${speciesName(species).toLowerCase()}. Welcome home, little one!`], fx: 'sparkle', at });
    }

    case 'none':
      return result({ ok: false });
  }
}
