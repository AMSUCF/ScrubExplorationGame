# Scrub Bot — finished art direction

The delivered set follows [the illustration brief](ART_ASSET_BRIEF.md): rounded, gentle characters,
warm colored outlines, sun-bleached foliage, cream highlights, and a tactile picture-book setting.
The robot is an original cream-and-mint character with a wide head, dark face plate, glossy lens
eyes, peach cheeks, soft treads, and separately animated antennas. It has matching blink and happy
states. The title illustration gives the robot, tortoise, scrub-jay, and pod a shared home in the scrub.

## Delivery and integration

`public/art/` contains **135 PNGs** at 4× logical resolution, plus the WebP title illustration.
All **66 required texture keys** in the brief are supplied. The set also includes **58 UI
pictograms**, four shelf figurines, a future green anole, an edge bush, and small habitat decorations.
The brief's optional additional robot animation frames and dedicated choked-plant variants remain
optional future work: the game already animates the antennas, blinks, swaps happy eyes, and tints
choked plants.

- Species are isolated against true transparency and assembled into the existing logical boxes.
- Robot expressions share the same silhouette and baseline. Pod upgrades use a common body scale.
- Wet/dry hydroponic jars use identical geometry; water level, seeds, roots, and leaves show state.
- Opaque room shells preserve the existing furniture layout and collision grid. Wood grain,
  woven rugs, botanical wallpaper, warm trim, sunbeams, hanging plants, and an upper-level skylight
  make the space feel lived in without introducing painted-on interactive furniture.
- Four tileable ground surfaces wrap their motifs over all edges. Feathered zone masks, diffuse
  light washes, and small wiregrass, fallen fans, golden blossoms, and reindeer lichen add detail.
- Pictograms retain the existing accessible button names and keyboard controls. Semantic tokens
  stay separate from their DOM and Phaser representations. The title offers continue/new-game
  actions, sound controls, save reassurance, and a two-tap safeguard before starting over.
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
orange dewlap distinguish the lizards. Heads and eyes are deliberately enlarged for small-screen
readability. These are stylized learning aids, not identification photographs.

## Sources and regeneration

The title, species, and major furniture were created as original generated illustrations for this
project. No downloaded wildlife photography or third-party game sprites are included. Retained
production sheets are in `scripts/art/source/`; the botanical correction sheet clarifies rosemary
needles and pinnate hickory leaflets, and the indigo sheet supplies a low, horizontal snake silhouette.
`sources.json` maps every delivered PNG to its source. All small props, surfaces, figurines, and
pictograms are original vector constructions in `shapes.mjs` and `icons.mjs`.

Run `npm run art:build` to separate the retained silhouettes, pad and size their canvases, rasterize
the vector artwork, and regenerate the manifest and catalog. This requires the pinned `sharp`
development dependency and no image-generation service. The contact sheet is written to the
ignored `screenshots/art-catalog.png`. The retained `splash.webp` is used as delivered.

Run `npm run art:check` for required-key coverage, dimensions, sprite alpha, opaque backgrounds,
font signatures, and splash resolution. Then run `npm test`, `npm run build`, and `npm run smoke`.
`npm run art:smoke` checks four title layouts, sound, all sprite textures, all three room levels,
continue/new-game behavior, local fonts, and absence of external HTTP requests, with screenshots.
The existing smoke test exercises the phone-view intro, scanning, removal, movement, home entry,
the wildlife monitor, sleep, landscape resize, save, and reload. `npm run audio` checks the browser
audio path. Browser checks require Playwright and its Chromium runtime, as before.
