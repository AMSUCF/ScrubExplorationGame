# Seasons illustration sources

Original generated illustrations made for Scrub Bot from `docs/ART_ASSET_BRIEF_2.md`
and the corresponding prompts, required field marks and exclusions in
`docs/art-requests.json`. No third-party sprites or photographs.

- `neighbors-litter.png`: right-facing gopher frog and scarab, and crumpled balloon,
  translucent bag and crushed unbranded red can. The unused cricket on this first
  sheet had a clipped antenna; `cricket.png` replaces it with complete antennae.
- `guide-cards.png`: prescribed burn and renewal, summer thunderhead and rain,
  and roadside fence with natal grass and arriving seeds. Delivery crops remove
  generation fringes, flatten the interior to opaque sand, and mask rounded corners.
- `sand.png`: even pale quartz grain with sparse tiny mineral and leaf specks;
  no roots or runners, which the mini-game draws interactively.
- `crops.json`: reviewed delivery rectangles and masks that exclude adjacent
  subjects while preserving ribbon and antenna tips.

`scripts/art/seasons.mjs` builds effects, pictograms and the burrow backdrop in the
existing vector palette. It keeps the scope tunnel at its exact specified path,
with an empty chamber at (112, 288). It also separates and sizes the paintings.
`npm run art:build` regenerates all 48 required second-brief deliveries, manifest,
catalog, provenance mapping and `screenshots/seasons-catalog.png` without calling
an image-generation service. Optional animation and robot-tool frames remain future
polish as described in the brief.
