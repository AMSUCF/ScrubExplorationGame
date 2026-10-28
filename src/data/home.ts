// The pod interior: room size and furniture placement for each expansion level.
// Positions are in tiles (fractional allowed) inside the room; the top WALL_ROWS rows are wall.
import { NativeAnimalId } from './species';

export const HOME_TILE = 32;
export const WALL_ROWS = 2;

export type HomeItemKind = 'cradle' | 'slot' | 'vase' | 'board' | 'monitor' | 'bench' | 'door' | 'window';

export interface HomeItem {
  kind: HomeItemKind;
  index?: number;
  /** Where the item is drawn (tile units, anchored bottom-centre). */
  x: number;
  y: number;
  /** Footprint in tiles that blocks movement (0 = walk-through / wall-mounted). */
  bw: number;
  bh: number;
  interactive: boolean;
}

export interface RoomSize {
  w: number;
  h: number;
}

export const ROOM_SIZES: RoomSize[] = [
  { w: 12, h: 8 },
  { w: 15, h: 9 },
  { w: 18, h: 10 },
];

/** Species whose return unlocks each room expansion (index = level being unlocked). */
export const ROOM_MILESTONES: (NativeAnimalId | null)[] = [null, 'tortoise', 'jay'];

export const MAX_SLOTS_BY_LEVEL = [6, 8, 10];
export const MAX_VASES_BY_LEVEL = [2, 3, 4];

export function homeLayout(level: number, slots: number, vases: number): HomeItem[] {
  const { w, h } = ROOM_SIZES[level];
  const items: HomeItem[] = [
    { kind: 'cradle', x: 1.7, y: 3.4, bw: 2, bh: 1, interactive: true },
    { kind: 'monitor', x: 4, y: 1.8, bw: 0, bh: 0, interactive: true },
    { kind: 'board', x: w - 2.2, y: 1.8, bw: 0, bh: 0, interactive: true },
    { kind: 'bench', x: 2, y: h - 0.9, bw: 2, bh: 1, interactive: true },
    { kind: 'door', x: w / 2, y: h, bw: 0, bh: 0, interactive: true },
  ];
  if (level >= 1) items.push({ kind: 'window', x: w / 2 + 0.5, y: 1.7, bw: 0, bh: 0, interactive: false });
  for (let i = 0; i < slots; i++) {
    items.push({ kind: 'slot', index: i, x: 5.5 + i, y: 3.3, bw: 1, bh: 1, interactive: true });
  }
  for (let i = 0; i < vases; i++) {
    items.push({ kind: 'vase', index: i, x: w - 1.4, y: 4.8 + i * 1.25, bw: 1, bh: 1, interactive: true });
  }
  return items;
}
