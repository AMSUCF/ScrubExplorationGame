// Which sounds accompany each action — kept apart from the scenes so the mapping lives in one place.
import { Action, ActionResult } from '../systems/actions';
import { audio } from '.';
import { SfxName } from './sfx';

const REMOVE_SOUND: Record<string, SfxName> = {
  cogon: 'pull',
  natal: 'pull',
  airpotato: 'pull',
  pepper: 'cut',
  tire: 'pickup',
  bottle: 'pickup',
  fence: 'pickup',
  thicket: 'trim',
  balloon: 'pickup',
  plastic: 'pickup',
  can: 'pickup',
};

const SIMPLE: Partial<Record<Action['verb'], SfxName>> = {
  collect: 'seeds',
  snip: 'sprig',
  info: 'page',
  enter: 'door',
  exit: 'door',
  recycle: 'recycle',
  dropoff: 'dropoff',
  sow: 'sow',
  water: 'water',
  pot: 'pot',
  arrange: 'arrange',
  clearVase: 'clear',
  board: 'page',
  monitor: 'click',
  plant: 'plant',
  scope: 'scope',
  dig: 'dig',
  sort: 'open',
  photo: 'click',
  contain: 'open',
};

/** `hpBefore` lets multi-hit removals (pepper, fence, thicket) thwack until the last blow. */
export function playActionSound(a: Action, res: ActionResult, hpBefore: number): void {
  if (!res.ok) {
    audio.sfx('nope');
    return;
  }
  const t = a.target;
  const entity = t.type === 'entity' ? t.entity : null;
  switch (a.verb) {
    case 'scan':
      audio.sfx('scan');
      if (entity && (entity.kind === 'nativeAnimal' || entity.kind === 'invasiveAnimal')) audio.animal(entity.species, { delay: 0.35 });
      return;
    case 'remove':
      if (!entity || entity.kind === 'burrow' || entity.kind === 'nativeAnimal' || entity.kind === 'invasiveAnimal') return;
      audio.sfx(hpBefore > 1 ? 'hit' : REMOVE_SOUND[entity.species] ?? 'pull');
      return;
    case 'capture':
      if (entity?.kind !== 'invasiveAnimal') return;
      audio.animal(entity.species);
      audio.sfx(entity.species === 'anole' ? 'jar' : 'crate', { delay: 0.3 });
      return;
    case 'greet':
      if (entity?.kind === 'nativeAnimal') audio.animal(entity.species);
      return;
    case 'upgrade':
      audio.sfx(a.param === 'room' ? 'roomUp' : 'upgrade');
      return;
    default: {
      const name = SIMPLE[a.verb];
      if (name) audio.sfx(name);
    }
  }
}
