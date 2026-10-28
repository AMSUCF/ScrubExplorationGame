// Field-guide content and per-species gameplay stats.
// Facts are written for a general, all-ages audience: short, friendly, and true.

export type InvasivePlantId = 'cogon' | 'pepper' | 'airpotato' | 'natal';
export type NativePlantId = 'palmetto' | 'rosemary' | 'oak' | 'hickory';
export type HazardId = 'tire' | 'bottle' | 'fence' | 'thicket' | 'balloon' | 'plastic' | 'can';
export type InvasiveAnimalId = 'cat' | 'tegu' | 'iguana' | 'anole';
export type NativeAnimalId = 'tortoise' | 'mouse' | 'jay' | 'indigo';
/** Small neighbours met only through the burrow scope. */
export type GuestId = 'frog' | 'beetle' | 'cricket';
/** Forces that shape the scrub: written up in the guide, never tapped as things. */
export type ForceId = 'fire' | 'storm' | 'edge';
export type TrashId = Exclude<HazardId, 'fence' | 'thicket'>;

export type SpeciesId = InvasivePlantId | NativePlantId | HazardId | InvasiveAnimalId | NativeAnimalId | GuestId | ForceId;

export type Category = 'invasivePlant' | 'nativePlant' | 'hazard' | 'invasiveAnimal' | 'nativeAnimal' | 'burrowGuest' | 'scrubForce';

export interface GuideEntry {
  id: SpeciesId;
  name: string;
  sci?: string;
  category: Category;
  facts: string[];
  /** Shown once discovered: what the player's actions do for the scrub. */
  helped: string;
  /** Shown before discovery for returning animals: how to coax them back. */
  hint?: string;
}

export const CATEGORY_LABEL: Record<Category, string> = {
  invasivePlant: 'Invasive plants',
  nativePlant: 'Native plants',
  hazard: 'Hazards',
  invasiveAnimal: 'Invasive animals',
  nativeAnimal: 'Native wildlife',
  burrowGuest: 'Burrow neighbors',
  scrubForce: 'Forces of the scrub',
};

export const GUIDE: GuideEntry[] = [
  // --- Invasive plants -------------------------------------------------------
  {
    id: 'cogon',
    name: 'Cogon grass',
    sci: 'Imperata cylindrica',
    category: 'invasivePlant',
    facts: [
      'Originally from Southeast Asia, it is considered one of the worst weeds in the world.',
      'It spreads through sharp underground stems called rhizomes and fluffy wind-blown seeds.',
      'Cogon mats burn extra hot, which makes wildfires more dangerous for scrub animals.',
    ],
    helped: 'Pull it early! Left alone, cogon creeps into new ground every night.',
  },
  {
    id: 'pepper',
    name: 'Brazilian pepper',
    sci: 'Schinus terebinthifolia',
    category: 'invasivePlant',
    facts: [
      'Brought from South America as a garden shrub, it now covers huge areas of Florida.',
      'Birds eat its red berries and spread the seeds far and wide.',
      'It is related to poison ivy, and its sap can make skin itchy.',
    ],
    helped: 'Cutting pepper thickets lets sunlight back onto the sand for native plants.',
  },
  {
    id: 'airpotato',
    name: 'Air potato',
    sci: 'Dioscorea bulbifera',
    category: 'invasivePlant',
    facts: [
      'This vine from Africa and Asia can grow up to 8 inches in a single day!',
      'It climbs over shrubs and trees and smothers them in leaves.',
      'It spreads by little potato-like bulbils that drop and sprout new vines.',
    ],
    helped: 'Pulling the vine and bagging the bulbils keeps new vines from sprouting.',
  },
  {
    id: 'natal',
    name: 'Natal grass',
    sci: 'Melinis repens',
    category: 'invasivePlant',
    facts: [
      'A grass from southern Africa with pretty pink, fluffy seed heads.',
      'It loves sandy, disturbed ground — exactly like an old, abandoned scrub.',
      'It crowds out native wildflowers and grasses that pollinators need.',
    ],
    helped: 'Clearing natal grass opens space for native scrub wildflowers.',
  },

  // --- Native plants ---------------------------------------------------------
  {
    id: 'palmetto',
    name: 'Saw palmetto',
    sci: 'Serenoa repens',
    category: 'nativePlant',
    facts: [
      'Its leaf stems have tiny saw-like teeth — that is how it got its name.',
      'Some palmetto patches may be thousands of years old.',
      'Bears, deer, and birds feast on its berries, and it sprouts right back after fire.',
    ],
    helped: 'Rescued palmettos give you seeds to grow more at the nursery.',
  },
  {
    id: 'rosemary',
    name: 'Florida rosemary',
    sci: 'Ceratiola ericoides',
    category: 'nativePlant',
    facts: [
      'Not the cooking herb! It is a fragrant shrub that grows on the whitest, sandiest ground.',
      'Patches of open white sand around it are called "rosemary balds".',
      'Fire kills the old shrubs, but their seeds sprout in the cleared sand afterward.',
    ],
    helped: 'Rosemary balds are home to rare plants and lizards found nowhere else.',
  },
  {
    id: 'oak',
    name: 'Scrub oak',
    sci: 'Quercus geminata & Q. myrtifolia',
    category: 'nativePlant',
    facts: [
      'Sand live oak and myrtle oak stay short and shrubby in the scrub.',
      'Their acorns are the favorite food of the Florida scrub-jay.',
      'After a fire, scrub oaks resprout from their deep roots.',
    ],
    helped: 'Scrub-jays need plenty of short oaks to nest in and gather acorns from.',
  },
  {
    id: 'hickory',
    name: 'Scrub hickory',
    sci: 'Carya floridana',
    category: 'nativePlant',
    facts: [
      'This hickory grows naturally only in Florida.',
      'Squirrels and other animals eat its nuts.',
      'Like many scrub plants, it can resprout after a fire.',
    ],
    helped: 'Every native you plant makes the habitat healthier for wildlife.',
  },

  // --- Hazards ---------------------------------------------------------------
  {
    id: 'tire',
    name: 'Old tire',
    category: 'hazard',
    facts: [
      'Rainwater collects in old tires and becomes a nursery for mosquitoes.',
      'Tires take a very, very long time to break down.',
      'Recycled tires can become playground surfaces and roads.',
    ],
    helped: 'Bring trash to the recycler for parts to upgrade your battery.',
  },
  {
    id: 'bottle',
    name: 'Bottle',
    category: 'hazard',
    facts: [
      'Small animals like lizards and mice can crawl into bottles and get stuck.',
      'Plastic breaks into tiny pieces called microplastics that never really go away.',
    ],
    helped: 'Every bottle you collect is one less trap for scrub critters.',
  },
  {
    id: 'fence',
    name: 'Old fence',
    category: 'hazard',
    facts: [
      'Old fences cut habitats into pieces and stop animals like gopher tortoises from moving around.',
      'Loose wire can tangle and hurt wildlife.',
    ],
    helped: 'Removing fences lets wildlife travel through the scrub again.',
  },
  {
    id: 'thicket',
    name: 'Overgrown thicket',
    category: 'hazard',
    facts: [
      'Florida scrub needs fire! Natural fires used to sweep through every 5–20 years or so.',
      'Without fire, scrub grows tall and tangled, and open-sand animals lose their homes.',
      'Today, trained crews use careful "prescribed burns" to keep scrub healthy.',
    ],
    helped: 'Trimming overgrowth keeps the scrub low and open. A good fire renews it even better.',
  },
  {
    id: 'balloon',
    name: 'Stray balloon',
    category: 'hazard',
    facts: [
      'Released balloons can float hundreds of miles before they come down in wild places.',
      'Animals can mistake the shiny pieces for food or get tangled in the ribbon.',
    ],
    helped: 'Storms carry litter in from roads and yards. Every piece you gather keeps the scrub safer.',
  },
  {
    id: 'plastic',
    name: 'Plastic bag',
    category: 'hazard',
    facts: [
      'Plastic bags blow for miles and snag on shrubs like little flags.',
      'Tortoises and birds can mistake soft plastic for food.',
    ],
    helped: 'Bring it to the recycler and sort it with the other plastics.',
  },
  {
    id: 'can',
    name: 'Soda can',
    category: 'hazard',
    facts: [
      'Aluminum can be recycled again and again, forever.',
      'A recycled can can be back on a store shelf in about two months.',
    ],
    helped: 'Metal goes in its own bin at the recycler.',
  },

  // --- Invasive animals ------------------------------------------------------
  {
    id: 'cat',
    name: 'Feral cat',
    sci: 'Felis catus',
    category: 'invasiveAnimal',
    facts: [
      'Outdoor cats are one of the biggest threats to birds and small animals in the U.S.',
      'It is not the cat’s fault — cats are hunters and need safe homes indoors.',
      'Keeping pet cats inside keeps both cats and wildlife safer.',
    ],
    helped: 'Crated kitties go to an animal shelter to find a loving family.',
  },
  {
    id: 'tegu',
    name: 'Argentine tegu',
    sci: 'Salvator merianae',
    category: 'invasiveAnimal',
    facts: [
      'A big black-and-white lizard from South America that can grow up to 4 feet long.',
      'Released and escaped pets now live wild in parts of Florida.',
      'Tegus eat the eggs of ground-nesting animals — including gopher tortoise eggs.',
    ],
    helped: 'Wildlife officers take tegus away so tortoise nests are safe.',
  },
  {
    id: 'iguana',
    name: 'Green iguana',
    sci: 'Iguana iguana',
    category: 'invasiveAnimal',
    facts: [
      'Native to Central and South America, iguanas have spread across South Florida.',
      'They munch on native plants and flowers and dig burrows that damage the ground.',
      'On cold nights they can go stiff and fall out of trees — then warm up and walk away!',
    ],
    helped: 'Relocating iguanas protects native plants and flowers.',
  },
  {
    id: 'anole',
    name: 'Cuban brown anole',
    sci: 'Anolis sagrei',
    category: 'invasiveAnimal',
    facts: [
      'Now one of the most common lizards in Florida, it came from Cuba and the Bahamas.',
      'It pushes Florida’s native green anole higher up into the trees.',
      'Scientists saw green anoles grow bigger, stickier toe pads in just 15 years to cope!',
    ],
    helped: 'Small and speedy — catch them in your jar and drop them at the pad.',
  },

  // --- Native wildlife -------------------------------------------------------
  {
    id: 'tortoise',
    name: 'Gopher tortoise',
    sci: 'Gopherus polyphemus',
    category: 'nativeAnimal',
    facts: [
      'A "keystone species": its burrows average 15 feet long and shelter 350+ other species.',
      'Gopher tortoises can live 60 years or more.',
      'They munch on grasses, wildflowers, and fallen fruit in open, sunny scrub.',
    ],
    helped: 'Tortoise burrows give shelter to mice, snakes, frogs, and more.',
    hint: 'May return when the Sand Scrub is healthy (65%+) and its old fences are gone.',
  },
  {
    id: 'mouse',
    name: 'Florida mouse',
    sci: 'Podomys floridanus',
    category: 'nativeAnimal',
    facts: [
      'A big-eared, big-footed mouse that lives only in Florida.',
      'It often makes its home inside gopher tortoise burrows, digging its own side tunnels.',
      'It is sometimes called the "gopher mouse" because of this.',
    ],
    helped: 'Protecting tortoises protects the mice that share their burrows.',
    hint: 'Looks for a home in a gopher tortoise burrow.',
  },
  {
    id: 'jay',
    name: 'Florida scrub-jay',
    sci: 'Aphelocoma coerulescens',
    category: 'nativeAnimal',
    facts: [
      'The only bird that lives only in Florida!',
      'Families stick together: older kids help raise their younger siblings.',
      'Each jay buries thousands of acorns a year to eat later.',
    ],
    helped: 'Low, open oak scrub with no prowling cats is perfect jay country.',
    hint: 'Needs a healthy Oak Scrub (60%+) with 6+ scrub oaks (grow more from acorns!), no overgrown thickets, and no feral cats around.',
  },
  {
    id: 'indigo',
    name: 'Eastern indigo snake',
    sci: 'Drymarchon couperi',
    category: 'nativeAnimal',
    facts: [
      'The longest native snake in the U.S. — it can top 8 feet!',
      'It is not venomous, and it even eats venomous snakes like rattlesnakes.',
      'In winter it often shelters in gopher tortoise burrows.',
    ],
    helped: 'Indigos need big, connected habitat with lots of tortoise burrows.',
    hint: 'Needs 2+ tortoise burrows and no tegus around.',
  },

  // --- Burrow neighbors ------------------------------------------------------
  {
    id: 'frog',
    name: 'Florida gopher frog',
    sci: 'Lithobates capito',
    category: 'burrowGuest',
    facts: [
      'Gopher frogs spend most of their lives tucked inside gopher tortoise burrows.',
      'Their call sounds like a deep, rumbling snore.',
      'They hop to nearby ponds to lay eggs, then come home to the burrow.',
    ],
    helped: 'Every tortoise burrow is a little apartment building for neighbors like this one.',
    hint: 'Peek into a tortoise burrow with the burrow scope.',
  },
  {
    id: 'beetle',
    name: 'Gopher tortoise scarab',
    sci: 'Onthophagus polyphemi',
    category: 'burrowGuest',
    facts: [
      'Some scarab beetles live only in gopher tortoise burrows, and nowhere else on Earth.',
      'They recycle the tortoise’s droppings deep underground.',
    ],
    helped: 'Tiny recyclers! Protecting tortoises protects the beetles that depend on them.',
    hint: 'Peek into a tortoise burrow with the burrow scope.',
  },
  {
    id: 'cricket',
    name: 'Camel cricket',
    sci: 'Ceuthophilus sp.',
    category: 'burrowGuest',
    facts: [
      'Humpbacked, long-legged crickets hide in the cool, damp dark of the burrow.',
      'They find their way with very long antennae instead of eyes.',
    ],
    helped: 'The deep burrow stays cool in summer and mild in winter, a refuge for many small lives.',
    hint: 'Peek into a tortoise burrow with the burrow scope.',
  },

  // --- Forces of the scrub ---------------------------------------------------
  {
    id: 'fire',
    name: 'Fire',
    category: 'scrubForce',
    facts: [
      'Florida scrub is shaped by fire. Summer lightning used to spark fires every 5–20 years.',
      'Oaks, palmettos and hickories survive fire and resprout from deep roots within weeks.',
      'Florida rosemary is killed by fire, but its seeds sprout in the fresh, open sand.',
      'Too often, and fire burns young plants before they can recover. Too rarely, and the scrub grows tall and tangled.',
      'Today, trained crews light careful prescribed burns on calm days.',
    ],
    helped: 'In Scrub Bot, time runs fast: ground is ready to burn again about 20 days after a fire.',
  },
  {
    id: 'storm',
    name: 'Summer storms',
    category: 'scrubForce',
    facts: [
      'Florida gets more lightning than any other U.S. state, mostly in summer afternoon storms.',
      'Rain refills ponds and soaks young plants, and lightning starts natural fires.',
      'Fall hurricanes bring strong wind that scatters litter and invasive seeds.',
    ],
    helped: 'After a storm, look for new litter and seeds that blew in from outside.',
  },
  {
    id: 'edge',
    name: 'The habitat edge',
    category: 'scrubForce',
    facts: [
      'Patches of scrub are surrounded by roads, yards and farms.',
      'Wind, birds, pets and people keep carrying invasive seeds and animals across the edge.',
      'Restoration is never finished: caring for a wild place is a forever job.',
    ],
    helped: 'Healthy native plants near the edge make it harder for invaders to settle in.',
  },
];

export const GUIDE_BY_ID = Object.fromEntries(GUIDE.map((g) => [g.id, g])) as Record<SpeciesId, GuideEntry>;

export function speciesName(id: SpeciesId): string {
  return GUIDE_BY_ID[id].name;
}

export interface InvasivePlantStats {
  hp: number;
  verb: string;
  cost: number;
  blocks: boolean;
  /** Bulbils dropped into the bag when removed. */
  bulbils: number;
}

export const INVASIVE_PLANTS: Record<InvasivePlantId, InvasivePlantStats> = {
  cogon: { hp: 1, verb: 'Pull', cost: 4, blocks: false, bulbils: 0 },
  pepper: { hp: 3, verb: 'Cut', cost: 3, blocks: true, bulbils: 0 },
  airpotato: { hp: 1, verb: 'Untangle vines', cost: 4, blocks: false, bulbils: 3 },
  natal: { hp: 1, verb: 'Pull', cost: 3, blocks: false, bulbils: 0 },
};

export const HAZARDS: Record<HazardId, { hp: number; verb: string; cost: number; blocks: boolean; trash: number }> = {
  tire: { hp: 1, verb: 'Pick up', cost: 3, blocks: false, trash: 1 },
  bottle: { hp: 1, verb: 'Pick up', cost: 2, blocks: false, trash: 1 },
  fence: { hp: 2, verb: 'Remove', cost: 4, blocks: true, trash: 1 },
  thicket: { hp: 2, verb: 'Trim', cost: 4, blocks: false, trash: 0 },
  balloon: { hp: 1, verb: 'Pick up', cost: 2, blocks: false, trash: 1 },
  plastic: { hp: 1, verb: 'Pick up', cost: 2, blocks: false, trash: 1 },
  can: { hp: 1, verb: 'Pick up', cost: 1, blocks: false, trash: 1 },
};

export const GUESTS: GuestId[] = ['frog', 'beetle', 'cricket'];

/** Seeds collected from one healthy native plant per day. */
export const SEED_YIELD: Record<NativePlantId, number> = {
  palmetto: 1,
  rosemary: 2,
  oak: 2,
  hickory: 1,
};

export const SEED_NOUN: Record<NativePlantId, string> = {
  palmetto: 'palmetto berry',
  rosemary: 'rosemary seed',
  oak: 'acorn',
  hickory: 'hickory nut',
};

export const INVASIVE_ANIMALS: Record<InvasiveAnimalId, { container: 'crate' | 'jar'; cost: number; speed: number }> = {
  cat: { container: 'crate', cost: 5, speed: 38 },
  tegu: { container: 'crate', cost: 5, speed: 30 },
  iguana: { container: 'crate', cost: 5, speed: 26 },
  anole: { container: 'jar', cost: 2, speed: 55 },
};

export const CAT_NAMES = ['Biscuit', 'Mango', 'Pepper', 'Socks', 'Luna', 'Tater', 'Clementine', 'Gizmo'];
