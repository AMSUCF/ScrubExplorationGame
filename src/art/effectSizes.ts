// Logical sizes of the procedural placeholder art (no Phaser here, so tests and tools can read it).
// docs/art-requests.json lists the same keys for illustration; a test keeps the two in step.

export const EFFECT_SIZES: Record<string, readonly [number, number]> = {
  wildfire: [24, 32], smoke: [24, 24], ember: [6, 6], scorch: [44, 30], firebreak: [34, 22], resprout: [26, 22],
  raindrop: [3, 14], puddle: [36, 14], leaf_blown: [10, 8], lightning: [40, 140], fog_wisp: [128, 48], firefly: [8, 8],
  frost: [10, 10], petal: [6, 6], seed_fluff: [6, 6],
  balloon: [16, 24], plastic: [20, 14], can: [14, 10],
  frog: [18, 14], beetle: [12, 9], cricket: [16, 11],
  fire: [48, 48], storm: [48, 48], edge: [48, 48],
  burrow_section: [180, 320], dig_sand: [270, 270],
};

/** 64×64 pictograms, delivered as `ui_<name>`. */
export const PICTOGRAMS = [
  'breezy', 'heat', 'rain', 'storm', 'hurricane', 'fog', 'cold', 'spring', 'summer', 'fall', 'winter',
  'fire', 'douse', 'rake', 'torch', 'dig', 'scope', 'sort', 'task', 'level', 'edge', 'tank',
] as const;
