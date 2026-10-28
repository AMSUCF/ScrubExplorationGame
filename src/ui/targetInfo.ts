import { INVASIVE_PLANTS, speciesName } from '../data/species';
import { ZONE_NAME } from '../data/map';
import { Target, isRegrowing } from '../systems/actions';
import { FIRE_STATE_INFO, areaAge, fireState, fuelAge, zoneOf } from '../systems/fire';
import { GameState, isChoked } from '../systems/state';
import { chokingVines } from '../data/visuals';

/** "Last burned 34 days ago · Ready for fire" for the ground under a tile. */
export function burnHistory(s: GameState, tx: number, ty: number, age = areaAge(s, tx, ty)): string {
  return `Last burned ${age === 0 ? 'today' : age === 1 ? 'yesterday' : `${age} days ago`} · ${FIRE_STATE_INFO[fireState(age)].name}`;
}

export function targetInfo(s: GameState, target: Target): { name: string; detail: string } {
  if (target.type === 'self') return { name: 'Your little robot', detail: 'Plant a seedling in front of you, or head home to recharge.' };
  if (target.type === 'fire') {
    // Describe the ground the flames are moving into, not the tiles already burning.
    const age = fuelAge(s, target.tx, target.ty);
    return { name: `Fire in the ${ZONE_NAME[zoneOf(target.tx, target.ty)]}`, detail: `${burnHistory(s, target.tx, target.ty, age)}. ${FIRE_STATE_INFO[fireState(age)].note}` };
  }
  if (target.type === 'station') {
    return { pod: { name: 'Home sweet pod', detail: 'Your nursery, workshop, and a soft place to recharge.' }, recycler: { name: 'Recycling station', detail: 'Turn gathered litter and bulbils into useful parts. Sort them by material for a bonus.' }, pad: { name: 'Wildlife pickup', detail: 'Leave rescued animals here for a safe overnight pickup.' } }[target.station.kind];
  }
  if (target.type === 'home') {
    const names = { cradle: 'Charging cradle', monitor: 'Wildlife monitor', board: 'Little memories', bench: 'Workshop', slot: 'Nursery jar', vase: 'Your flower vase', window: 'A view of the scrub', door: 'Back outside' };
    const details = { cradle: 'Sleep until morning. Your battery recharges and watered seedlings grow.', monitor: 'See who has come home, what the habitat still needs, and where the scrub is ready for fire.', board: 'First sightings, portraits, burrow neighbors and postcards.', bench: 'Spend recycled parts on room, battery, and nursery upgrades.', slot: 'Sow a seed, add water each day, and pot up when it is ready.', vase: 'A few native sprigs make this little home yours.', window: 'A sunny little window.', door: 'The scrub is waiting for you.' };
    return { name: names[target.item.kind], detail: details[target.item.kind] };
  }
  const e = target.entity;
  if (e.kind === 'burrow') return { name: 'Gopher tortoise burrow', detail: 'A safe underground home shared by hundreds of kinds of little neighbors. Fire passes right over it.' };
  const name = speciesName(e.species);
  const history = 'tx' in e ? burnHistory(s, e.tx, e.ty) : '';
  if (e.kind === 'nativePlant') {
    const detail = isChoked(s, e)
      ? chokingVines(s, e).length ? 'Climbing vines are shading this native. Free its leaves before collecting seeds.' : 'Crowding plants are stealing its sunlight. Clear the nearby invasives first.'
      : e.burnedDay !== undefined && s.day - e.burnedDay < 3 ? 'Burned back to its roots, and already resprouting. Fire is part of its life.'
      : isRegrowing(s, e) ? 'A little seedling settling in. Give it two mornings before harvesting.'
      : (e.bloomUntil ?? 0) >= s.day ? 'Blooming after the fire! Its berries come in double right now.'
      : 'A healthy native! Gather seeds for your nursery, or a sprig for home.';
    return { name, detail: `${detail} ${history}.` };
  }
  if (e.kind === 'invasivePlant') {
    const detail = e.species === 'airpotato' ? 'Snip safely, gather every bulbil, then gently unwind the vine. Your work saves if you leave.'
      : e.species === 'pepper' ? `${e.hp} of ${INVASIVE_PLANTS.pepper.hp} stems left. Cut them one at a time to open the canopy.`
      : e.species === 'cogon' ? 'Pulling lifts the clump, but runners in the sand may sprout again. Digging out the roots clears it for good.'
      : 'Loosen the roots and lift this patch to give native plants space.';
    return { name, detail };
  }
  if (e.kind === 'hazard') {
    if (e.species === 'thicket') return { name, detail: `${e.hp > 1 ? `${e.hp} careful trims remaining. ` : ''}Trimming opens it up; a fire renews it. ${history}.` };
    return { name, detail: `${e.hp > 1 ? `${e.hp} careful steps remaining. ` : ''}Clear this litter to make the scrub safer for wildlife.` };
  }
  if (e.kind === 'nativeAnimal') return { name, detail: 'Say hello, or take a portrait. A small, unhurried encounter can bring a little surprise.' };
  if (e.species === 'iguana' && s.weather.kind === 'cold') return { name, detail: 'Stiff from the cold snap and easy to scoop up. A gentle rescue.' };
  return { name, detail: 'A gentle rescue: help this neighbor reach a safer home.' };
}
