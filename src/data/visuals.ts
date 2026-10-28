import { Entity, GameState, InvasivePlantEntity, NativePlantEntity } from '../systems/state';
import { CHOKE_RADIUS } from '../config';

/** World sizes are ecological proportions, not inventory/field-guide icon sizes. */
export const WORLD_SIZE: Record<string, readonly [number, number]> = {
  palmetto: [92, 82], rosemary: [84, 78], oak: [148, 142], hickory: [132, 172],
  cogon: [50, 62], natal: [52, 62], pepper: [138, 144], airpotato: [80, 102], thicket: [144, 136],
  tire: [30, 23], bottle: [18, 21], fence: [34, 39], burrow: [76, 50],
  tortoise: [40, 28], mouse: [17, 14], jay: [28, 25], indigo: [68, 32],
  cat: [34, 29], tegu: [62, 26], iguana: [69, 30], anole: [23, 12],
  pod0: [156, 111], pod1: [156, 111], pod2: [156, 111], pod_shut: [156, 111],
  recycler: [43, 49], pad: [53, 42],
};

export function worldSize(e: Entity, day: number): readonly [number, number] {
  if (e.kind === 'burrow') return WORLD_SIZE.burrow;
  const [w, h] = WORLD_SIZE[e.species];
  // Newly planted trees actually grow into their eventual canopy over several mornings.
  const age = e.kind === 'nativePlant' && e.planted ? Math.min(1, .35 + Math.max(0, day - e.plantedDay) * .17) : 1;
  // A stable, modest variation avoids identical crowns while keeping leaves in proportion.
  const variation = e.kind === 'nativePlant' || e.kind === 'invasivePlant' ? .94 + (e.id * 37 % 101) / 100 * .12 : 1;
  return [w * age * variation, h * age * variation];
}

/** Attachment uses exactly the same radius as choking: the visible threat matches game rules. */
export function vineHost(s: GameState, vine: InvasivePlantEntity): NativePlantEntity | undefined {
  return s.entities.filter((e): e is NativePlantEntity => e.kind === 'nativePlant' && Math.abs(e.tx - vine.tx) <= CHOKE_RADIUS && Math.abs(e.ty - vine.ty) <= CHOKE_RADIUS)
    .sort((a, b) => Math.hypot(a.tx - vine.tx, a.ty - vine.ty) - Math.hypot(b.tx - vine.tx, b.ty - vine.ty))[0];
}

export function chokingVines(s: GameState, plant: NativePlantEntity): InvasivePlantEntity[] {
  return s.entities.filter((e): e is InvasivePlantEntity => e.kind === 'invasivePlant' && e.species === 'airpotato' && Math.abs(e.tx - plant.tx) <= CHOKE_RADIUS && Math.abs(e.ty - plant.ty) <= CHOKE_RADIUS);
}
