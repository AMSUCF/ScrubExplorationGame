// Sorting at the recycler: each piece of litter has a right bin. Careful sorting earns bonus parts,
// and invasive bulbils always go in the sealed bag, never the compost, or they would sprout.
import { BAG_CAPACITY } from '../../config';
import { BagItem, GameState } from '../state';

export type Bin = 'glass' | 'metal' | 'plastic' | 'rubber' | 'sealed';

export const BINS: { id: Bin; name: string; note: string }[] = [
  { id: 'glass', name: 'Glass', note: 'Bottles and jars' },
  { id: 'metal', name: 'Metal', note: 'Cans and old wire' },
  { id: 'plastic', name: 'Plastic', note: 'Bags and film' },
  { id: 'rubber', name: 'Rubber', note: 'Tires' },
  { id: 'sealed', name: 'Sealed bag', note: 'Invasive bulbils and foil balloons' },
];

export const BIN_OF: Record<BagItem, Bin> = {
  bottle: 'glass',
  can: 'metal',
  fence: 'metal',
  plastic: 'plastic',
  tire: 'rubber',
  balloon: 'sealed',
  bulbil: 'sealed',
};

export const ITEM_NAME: Record<BagItem, string> = {
  bottle: 'glass bottle', can: 'soda can', fence: 'rusty fence wire', plastic: 'plastic bag', tire: 'old tire', balloon: 'foil balloon', bulbil: 'air potato bulbil',
};

/** The bag's actual contents (older saves only counted items, so unknown ones read as bottles). */
export function bagContents(s: GameState): BagItem[] {
  // slice(-0) would keep everything, so an empty bag is handled explicitly.
  const items = s.bag > 0 ? (s.bagItems ?? []).slice(-s.bag) : [];
  while (items.length < Math.min(s.bag, BAG_CAPACITY)) items.unshift('bottle');
  return items;
}

export interface SortResult {
  total: number;
  correct: number;
  bonus: number;
  parts: number;
  /** Items that went in the wrong bin (or fell off the belt). */
  missed: BagItem[];
}

export function sortBonus(correct: number, total: number): number {
  return Math.floor(correct / 2) + (total >= 3 && correct === total ? 1 : 0);
}

/** Recycle everything in the bag; correctly sorted items earn a bonus on top. */
export function finishSort(s: GameState, placed: (Bin | null)[]): SortResult {
  const items = bagContents(s);
  let correct = 0;
  const missed: BagItem[] = [];
  items.forEach((item, i) => (placed[i] === BIN_OF[item] ? correct++ : missed.push(item)));
  const bonus = sortBonus(correct, items.length);
  const parts = items.length + bonus;
  s.parts += parts;
  s.bag = 0;
  s.bagItems = [];
  return { total: items.length, correct, bonus, parts, missed };
}
