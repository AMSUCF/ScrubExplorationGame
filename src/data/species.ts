// Field-guide content and per-species gameplay stats.
// Facts are written for a general, all-ages audience: short, friendly, and true.

export type InvasivePlantId = 'cogon' | 'pepper' | 'airpotato' | 'natal';
export type NativePlantId = 'palmetto' | 'rosemary' | 'oak' | 'hickory';
export type HazardId = 'tire' | 'bottle' | 'fence' | 'thicket';
export type InvasiveAnimalId = 'cat' | 'tegu' | 'iguana' | 'anole';
export type NativeAnimalId = 'tortoise' | 'mouse' | 'jay' | 'indigo';

export type SpeciesId = InvasivePlantId | NativePlantId | HazardId | InvasiveAnimalId | NativeAnimalId;

export type Category = 'invasivePlant' | 'nativePlant' | 'hazard' | 'invasiveAnimal' | 'nativeAnimal';

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
    helped: 'Trimming overgrowth keeps the scrub low and open, the way scrub-jays like it.',
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
  airpotato: { hp: 1, verb: 'Pull', cost: 4, blocks: false, bulbils: 2 },
  natal: { hp: 1, verb: 'Pull', cost: 3, blocks: false, bulbils: 0 },
};

export const HAZARDS: Record<HazardId, { hp: number; verb: string; cost: number; blocks: boolean; trash: number }> = {
  tire: { hp: 1, verb: 'Pick up', cost: 3, blocks: false, trash: 1 },
  bottle: { hp: 1, verb: 'Pick up', cost: 2, blocks: false, trash: 1 },
  fence: { hp: 2, verb: 'Remove', cost: 4, blocks: true, trash: 1 },
  thicket: { hp: 2, verb: 'Trim', cost: 4, blocks: false, trash: 0 },
};

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
