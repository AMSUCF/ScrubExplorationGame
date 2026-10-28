# Scrub Bot — finished art direction

The delivered set follows [the illustration brief](ART_ASSET_BRIEF.md): rounded, gentle characters,
warm colored outlines, sun-bleached foliage, cream highlights, and a tactile picture-book setting.
The robot is an original cream-and-mint character with a wide head, dark face plate, glossy lens
eyes, peach cheeks, soft treads, and separately animated antennas. It has matching blink and happy
states. The title illustration gives the robot, tortoise, scrub-jay, and pod a shared home in the scrub.
Nature uses finer botanical painting: small leaves on branching twigs, irregular crowns with gaps,
bark fissures, pleated fans, needle foliage, shell growth rings, and feather and scale detail. This
supersedes the first brief's flat nature silhouettes while retaining its warm, gentle character style.

## Delivery and integration

`public/art/` contains **159 PNGs** at 4× logical resolution, plus the WebP title illustration.
All **66 required texture keys** in the brief are supplied. The set also includes **58 UI
pictograms**, four shelf figurines, a future green anole, an edge bush, and small habitat decorations.
The brief's optional additional robot animation frames and dedicated choked-plant variants remain
optional future work: the game already animates the antennas, blinks, swaps happy eyes, and tints
choked plants.

- Species are isolated against true transparency. Plant canvases now use ecological world sizes:
  a mature scrub oak is 148×142, hickory 132×172, palmetto 92×82, and rosemary 84×78, compared with
  the 36×36 robot. Plants vary modestly in size without changing their proportions. Wildlife has
  separate high-resolution delivery canvases for close inspection and smaller ecological world
  sizes in `src/data/visuals.ts`. Inventory and field-guide views fit the full illustrations into
  their own thumbnail boxes. Roots and feet share consistent ground anchors; no painted soil plates.
  The tortoise burrow uses a wider 76×50 ground footprint so its entrance accommodates the shell
  and its loose sand apron extends beyond the opening.
- Robot expressions share the same silhouette and baseline. Pod upgrades use a common body scale.
- Wet/dry hydroponic jars use identical geometry; water level, seeds, roots, and leaves show state.
- Opaque room shells preserve the existing furniture layout and collision grid. Wood grain,
  woven rugs, botanical wallpaper, warm trim, sunbeams, hanging plants, and an upper-level skylight
  make the space feel lived in without introducing painted-on interactive furniture.
- Twelve tileable ground surfaces (three per habitat) show quartz grains, tiny mineral fragments,
  curled oak leaves and acorn caps, branching reindeer lichen, or packed sand. Cosine overlap blends
  the edges without reflected motifs. Rotated, feathered patches break up the repeated tiles;
  feathered zone masks preserve distinct habitats. Fallen wood and fans vary in angle, grass stays
  upright, and the boundary scrub has an uneven outline. Three soft litter mats and six shadows
  projected from the actual canopy silhouettes connect plants to the ground.
- Canopies overlap using ground-depth sorting; narrow trunk collisions preserve paths underneath.
  Canopies fade when the robot passes behind them. Climbing stems, heart-shaped leaves and bulbils
  visibly connect air potato to the native host selected by the same radius as the choking rules.
  Thin climbing stems carry many small, veined leaves and a few warty bulbils, preserving the host's
  structure rather than covering it with oversized leaf symbols.
  Clearing the threat removes the climbing layer, restores the native's color, and lets small flowers
  and butterflies appear when the native is free. Young planted natives grow over several mornings.
- Pictograms retain the existing accessible button names and keyboard controls. Semantic tokens
  stay separate from their DOM and Phaser representations. The title offers continue/new-game
  actions, sound controls, save reassurance, and a two-tap safeguard before starting over.
- Short text now accompanies icons: stable action trays explain costs and blocked tools; the nursery
  shows plant names, daily water status and growth; the monitor names species and spells out their
  habitat requirements. A whole-room overview and home toolbar keep indoor stations accessible.
- The title adapts to phone portrait, landscape, and desktop layouts. Motion honors the system's
  reduced-motion preference. Nunito and Fraunces are bundled locally, including their SIL Open
  Font License notices; the game makes no Google Fonts requests.

## Natural-history decisions

Field marks come from the species-specific requirements in the illustration brief. Accuracy takes
priority over decorative motifs: palmetto fans and creeping bases; needle-whorled Florida rosemary
without culinary-rosemary flowers; small unlobed scrub-oak leaves; pinnately compound hickory
leaflets with rusty undersides; white cogon versus pink natal plumes; red pepper berry clusters;
and heart-leaved air potato with brown bulbils.

Wildlife keeps the tortoise's high dome and digging legs, the cinnamon mouse's white belly and large
ears, the scrub-jay's smooth crestless head and pale throat, and the indigo snake's dark iridescent
body and warm chin. Tegu banding, the iguana's spines and round cheek scale, and the brown anole's
orange dewlap distinguish the lizards. Wildlife keeps natural body proportions and a gentle expression;
the little robot supplies the stronger character exaggeration. These are painted learning aids,
not identification photographs.

## Sources and regeneration

The title, species, and major furniture were created as original generated illustrations for this
project. No downloaded wildlife photography or third-party game sprites are included. Retained
production sheets are in `scripts/art/source/`. The eleven rebuilt sheets in `source/nature/` supply
all plants, wildlife, cuttings, ground materials, and botanical decorations. Earlier species sheets
are retained as original development sources. `sources.json` maps every delivered PNG to its source.
Furniture props, room shells, effects, figurines, and pictograms use the original vector constructions
in `shapes.mjs` and `icons.mjs`; `nature.mjs` imports the paintings, preserves disconnected foliage,
and builds the ground transitions, projected shadows, and vine root knot.

Run `npm run art:build` to separate the retained silhouettes, pad and size their canvases, rasterize
the vector artwork, and regenerate the manifest and catalog. This requires the pinned `sharp`
development dependency and no image-generation service. The contact sheet is written to the
ignored `screenshots/art-catalog.png`. `screenshots/nature-scale.png` places native and invasive
plants, wildlife, the robot, and pod at a shared 2× gameplay scale for proportion review. The retained
`splash.webp` is used as delivered.

Run `npm run art:check` for required-key coverage, dimensions, sprite alpha, matching ground edges, opaque backgrounds,
font signatures, and splash resolution. Then run `npm test`, `npm run build`, and `npm run smoke`.
`npm run art:smoke` checks four title layouts, sound, all sprite textures, all three room levels,
continue/new-game behavior, local fonts, and absence of external HTTP requests, with screenshots.
The existing smoke test exercises the phone-view intro, scanning, removal, movement, home entry,
the wildlife monitor, sleep, landscape resize, save, and reload. `npm run audio` checks the browser
audio path. Browser checks require Playwright and its Chromium runtime, as before.

`npm run restoration:smoke` drives actual phone touch events through safe cuts, protected-branch
feedback, bulbil dragging, and pulling. It also verifies partial-work save/reload, keyboard alternatives,
one-time care rewards, sowing/watering in the nursery, and readable monitor requirements. Partial care
and daily thank-you records are optional additions to v2 saves, so existing progress remains usable.
