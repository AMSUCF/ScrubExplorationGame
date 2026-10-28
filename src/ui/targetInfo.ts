import { INVASIVE_PLANTS, speciesName } from '../data/species';
import { Target } from '../systems/actions';
import { GameState, isChoked } from '../systems/state';
import { chokingVines } from '../data/visuals';

export function targetInfo(s: GameState, target: Target): { name: string; detail: string } {
  if (target.type === 'self') return { name: 'Your little robot', detail: 'Plant a seedling in front of you, or head home to recharge.' };
  if (target.type === 'station') {
    return { pod: { name: 'Home sweet pod', detail: 'Your nursery, workshop, and a soft place to recharge.' }, recycler: { name: 'Recycling station', detail: 'Turn gathered trash and bulbils into useful parts.' }, pad: { name: 'Wildlife pickup', detail: 'Leave rescued animals here for a safe overnight pickup.' } }[target.station.kind];
  }
  if (target.type === 'home') {
    const names = { cradle: 'Charging cradle', monitor: 'Wildlife monitor', board: 'Little memories', bench: 'Workshop', slot: 'Nursery jar', vase: 'Your flower vase', window: 'A view of the scrub', door: 'Back outside' };
    const details = { cradle: 'Sleep until morning. Your battery recharges and watered seedlings grow.', monitor: 'See who has come home and what the habitat still needs.', board: 'First sightings and postcards from rescued neighbors.', bench: 'Spend recycled parts on room, battery, and nursery upgrades.', slot: 'Sow a seed, add water each day, and pot up when it is ready.', vase: 'A few native sprigs make this little home yours.', window: 'A sunny little window.', door: 'The scrub is waiting for you.' };
    return { name: names[target.item.kind], detail: details[target.item.kind] };
  }
  const e = target.entity;
  if (e.kind === 'burrow') return { name: 'Gopher tortoise burrow', detail: 'A safe underground home shared by many little neighbors.' };
  const name = speciesName(e.species);
  if (e.kind === 'nativePlant') return { name, detail: isChoked(s, e) ? chokingVines(s, e).length ? 'Climbing vines are shading this native. Free its leaves before collecting seeds.' : 'Crowding plants are stealing its sunlight. Clear the nearby invasives first.' : e.planted && s.day - e.plantedDay < 2 ? 'A little seedling settling in. Give it two mornings before harvesting.' : 'A healthy native! Gather seeds for your nursery, or a sprig for home.' };
  if (e.kind === 'invasivePlant') return { name, detail: e.species === 'airpotato' ? 'Snip safely, gather every bulbil, then gently unwind the vine. Your work saves if you leave.' : e.species === 'pepper' ? `${e.hp} of ${INVASIVE_PLANTS.pepper.hp} stems left. Cut them one at a time to open the canopy.` : 'Loosen the roots and lift this patch to give native plants space.' };
  if (e.kind === 'hazard') return { name, detail: `${e.hp > 1 ? `${e.hp} careful steps remaining. ` : ''}Clear this obstacle to make the scrub safer for wildlife.` };
  return { name, detail: e.kind === 'nativeAnimal' ? 'Say hello. A small, unhurried encounter can bring a little surprise.' : 'A gentle rescue: help this neighbor reach a safer home.' };
}
