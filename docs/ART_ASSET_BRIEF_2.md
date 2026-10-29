# Scrub Bot — Art Brief 2: seasons, weather, fire and mini-games

> Delivered: all 48 required keys below now ship in `public/art/` at 4× resolution.
> See `ART_DIRECTION.md` and `scripts/art/source/seasons/README.md` for sources,
> regeneration and review. The optional variants at the end remain future polish.

This brief records the illustration requirements for the seasons, weather, fire-ecology, edge-arrival and mini-game update. Each delivered PNG replaces a **procedural fallback**, drawn in `src/art/effects.ts` at the logical size below. Texture keys, dimensions and anchors remain the same in either form.

A machine-readable copy of this list, with one image-generation prompt per asset, is in [`art-requests.json`](art-requests.json). `npm test` checks that the file covers every placeholder at the right size.

The existing illustrated set, style rules and species field marks are in [ART_ASSET_BRIEF.md](ART_ASSET_BRIEF.md) and [ART_DIRECTION.md](ART_DIRECTION.md). This brief follows the same rules.

## Style, in brief

- **View:** top-down ¾ (camera tilted about 45°). Animals in side or ¾ profile, **facing right** (the game mirrors them).
- **Light:** from the upper-left, warm late-morning sun.
- **Line and colour:** warm coloured outlines (never black); flat colour plus one soft shade and one highlight; sun-bleached sand creams, sage and olive greens, dusty blues, small warm accents.
- **Nature:** the finer botanical painting of the current set (small leaves, bark, scale and feather detail) with natural proportions; species field marks must be visible.
- **Mood:** cozy and gentle. Fire is renewal, not disaster: no burned animals, no menace, no people.
- **Contact shadow:** standing objects carry a soft elliptical shadow, `rgba(60, 45, 25, 0.22)`, offset slightly right. Ground decals (scorch, firebreak, puddle) have no shadow and fully feathered edges.

## Delivery

- **Format:** sRGB PNG, transparent background. Mini-game backdrops and guide cards are opaque *inside* rounded corners; the corners outside stay transparent.
- **Resolution:** **4× the logical size** (the px size in each heading). Keep the exact aspect ratio.
- **Anchors:** as listed. *Bottom-centre* means the object's base and contact shadow touch the bottom edge, centred horizontally, with about 4–6% padding elsewhere.
- **Install:** save as `public/art/<key>.png`, add the key to `public/art/manifest.json` and its logical size to `src/art/catalog.json`, then run `npm run art:check`, `npm test` and `npm run seasons:smoke`.

## Prompt prefix

Prepend this to every prompt below:

> Cozy storybook illustration for a top-down 3/4-view mobile game about a small robot restoring Florida scrub. Match the existing Scrub Bot art: finely painted botanical detail for nature, rounded and gentle shapes, warm coloured outlines (never black), light from the upper-left, a sun-bleached palette of sand creams, sage and olive greens and dusty blues with small warm accents. Painterly but clean; readable when shown small. Transparent PNG background unless noted.

## Fire and weather effects

### `wildfire` · 24×32 logical · 96×128 px · anchor bottom-centre

A small cluster of wildfire flames burning one patch of scrub: three or four rounded tongues of flame in deep orange, tangerine and buttery yellow around a pale cream core, a faint warm glow at the base. Storybook-campfire friendly rather than frightening.

- **Must show:**
  - Flames only, rising from the bottom edge.
  - Soft painterly edges.
  - Bright enough to read on pale sand.
- **Avoid:**
  - Smoke, logs or ground.
  - Realistic photographic fire.
  - Black outlines.
- **Note:** The game flickers and scales it. Optional extra frames wildfire_1 and wildfire_2 on the same canvas would allow true animation.

### `smoke` · 24×24 logical · 96×96 px · anchor centre

A soft, rounded puff of grey-lavender woodsmoke, semi-transparent (about 50% opacity), slightly lighter at the top-left.

- **Must show:**
  - Feathered edges that fade to transparent.
- **Avoid:**
  - Hard outlines.
  - Black smoke.

### `ember` · 6×6 logical · 24×24 px · anchor centre

A single glowing orange ember with a soft radial halo. Also stretched by the game into the warm glow under flames, so keep it radially soft.

- **Must show:**
  - Radial falloff to fully transparent.
- **Avoid:**
  - Sharp edges.

### `scorch` · 44×30 logical · 176×120 px · anchor centre (ground decal)

A top-down patch of freshly burned ground: soft ash-grey and soot-brown blotches, scattered white ash flecks, one or two tiny orange embers, and charred grass stubble. Feathered edges that fade into the sand. Used as a ground stamp at random rotations, so it must look natural at any angle.

- **Must show:**
  - Irregular, organic outline.
  - Edges fully feathered to transparent.
- **Avoid:**
  - Hard rim or circle.
  - Pure black.

### `firebreak` · 34×22 logical · 136×88 px · anchor centre (ground decal)

A short strip of freshly raked bare sand seen from above: parallel rake furrows in tan and light brown, a few raked-up twigs at the edges, feathered outline.

- **Must show:**
  - Parallel furrows.
  - Lighter than the surrounding ground.
- **Avoid:**
  - Tools or footprints.

### `resprout` · 26×22 logical · 104×88 px · anchor bottom-centre

A charred root crown at ground level with bright new green shoots sprouting from it: the first week after fire, when scrub oaks and saw palmettos resprout from their roots.

- **Must show:**
  - Blackened stump base with a soft contact shadow.
  - Five to seven fresh, small green shoots.
- **Avoid:**
  - Flowers.
  - A whole tree.

### `raindrop` · 3×14 logical · 12×56 px · anchor centre

One falling raindrop streak: a thin pale-blue line with a brighter head and a soft tail.

- **Must show:**
  - Very thin.
- **Avoid:**
  - Teardrop shape.

### `puddle` · 36×14 logical · 144×56 px · anchor centre (ground decal)

A shallow rain puddle on sand from above, reflecting pale sky blue, with a soft wet darker rim that fades into the ground.

- **Must show:**
  - Feathered edges.
- **Avoid:**
  - Ripples rings like a target.
  - Hard outline.

### `leaf_blown` · 10×8 logical · 40×32 px · anchor centre

A small curled dry scrub-oak leaf in tan and russet, tumbling in the wind.

- **Must show:**
  - Small unlobed oak leaf shape.
- **Avoid:**
  - Lobed northern oak or maple leaf.

### `petal` · 6×6 logical · 24×24 px · anchor centre

A single soft pink wildflower petal drifting on the spring breeze.


### `seed_fluff` · 6×6 logical · 24×24 px · anchor centre

A fluffy, silky white cogon-grass seed with a tiny brown seed at its base, floating on summer wind.

- **Must show:**
  - Silky white tuft.
- **Avoid:**
  - Dandelion clock sphere.

### `lightning` · 40×140 logical · 160×560 px · anchor bottom-centre (strike point)

A stylised lightning bolt striking down: a chunky cream-white jagged bolt with a pale yellow glow, slightly tapered toward the bottom where it hits the ground.

- **Must show:**
  - Glow fading to transparent around the bolt.
  - Base touches the bottom edge.
- **Avoid:**
  - Thin realistic branching.
  - Purple sci-fi lightning.

### `fog_wisp` · 128×48 logical · 512×192 px · anchor centre

A long, soft horizontal band of morning mist: very low-contrast white with feathered edges on every side, almost invisible on its own.

- **Must show:**
  - Fully feathered edges.
- **Avoid:**
  - Clouds with outlines.
  - Any hard shapes.

### `firefly` · 8×8 logical · 32×32 px · anchor centre

A tiny glowing yellow-green firefly light: a bright dot with a soft halo.

- **Avoid:**
  - A detailed insect body.

### `frost` · 10×10 logical · 40×40 px · anchor centre

A delicate pale-blue frost sparkle for a Florida cold snap: a six-point twinkle.

- **Avoid:**
  - Snowman or snowfall.

## Storm litter

### `balloon` · 16×24 logical · 64×96 px · anchor bottom-centre

A half-deflated foil heart balloon that blew in on a storm and snagged on the sand, with a curly pink ribbon trailing on the ground. Muted pink foil with a soft highlight and a contact shadow.

- **Must show:**
  - Crumpled foil, clearly litter.
  - Ribbon on the ground.
- **Avoid:**
  - Text or logos.
  - A fully inflated party balloon.

### `plastic` · 20×14 logical · 80×56 px · anchor bottom-centre

A crumpled translucent white plastic grocery bag lying flat on sand, with soft folds and a contact shadow.

- **Must show:**
  - Translucent film.
- **Avoid:**
  - Text or logos.

### `can` · 14×10 logical · 56×40 px · anchor bottom-centre

A crushed red soda can lying on its side in the sand, silver rim and a dent, contact shadow.

- **Must show:**
  - Crushed side.
- **Avoid:**
  - Brand names, text or logos.

## Burrow neighbors (species)

### `frog` · 18×14 logical · 72×56 px · anchor bottom-centre; animal faces right

A Florida gopher frog (Lithobates capito) sitting at a burrow: a stout, chunky frog with a large head, creamy tan to grey body densely covered in dark brown irregular spots, warty skin, big round golden eyes with dark pupils, gentle expression.

- **Must show:**
  - Stocky body and short head.
  - Dense dark spots on pale skin.
  - Warty skin texture.
- **Avoid:**
  - Bright green colour.
  - Smooth tree-frog look.
  - Red eyes.

### `beetle` · 12×9 logical · 48×36 px · anchor bottom-centre; faces right

A gopher tortoise scarab (Onthophagus polyphemi): a tiny, rounded, glossy dark brown-black dung beetle with finely ridged wing covers and stout, spiny front legs for digging.

- **Must show:**
  - Rounded scarab body.
  - Glossy highlight.
  - Digging front legs.
- **Avoid:**
  - Ladybug spots.
  - Long horns.
  - Bright metallic green.

### `cricket` · 16×11 logical · 64×44 px · anchor bottom-centre; faces right

A camel cricket (Ceuthophilus) from a tortoise burrow: humpbacked and wingless, mottled pale tan and brown, with extremely long antennae and long, spiny, bent hind legs.

- **Must show:**
  - Humped back.
  - Very long antennae.
  - No wings.
- **Avoid:**
  - Green grasshopper look.
  - Wings.

## Field guide cards

### `fire` · 48×48 logical · 192×192 px · anchor centre (rounded card)

A rounded-square field-guide vignette of a gentle prescribed burn creeping low through wiregrass and saw palmetto under a blue sky, soft smoke drifting, fresh green shoots in the foreground. Hopeful, not scary.

- **Must show:**
  - Rounded corners with a transparent outside.
  - Low flames in scrub.
- **Avoid:**
  - People or firefighters.
  - Burning houses.
- **Note:** Opaque inside a rounded card; the corners outside the rounding must stay transparent.

### `storm` · 48×48 logical · 192×192 px · anchor centre (rounded card)

A rounded-square vignette of a Florida summer thunderhead over the scrub: a towering cloud, a single lightning bolt, and a grey curtain of rain over palmettos.

- **Must show:**
  - Rounded corners with a transparent outside.
- **Avoid:**
  - Tornado.
  - Damage.

### `edge` · 48×48 logical · 192×192 px · anchor centre (rounded card)

A rounded-square vignette of the habitat edge: a road and a fence line where the scrub begins, fluffy invasive seeds drifting in on the wind, and a pink natal-grass tuft growing by the roadside.

- **Must show:**
  - Rounded corners with a transparent outside.
  - Road or yard meeting scrub.
- **Avoid:**
  - Cars or people.

## Mini-game backdrops

### `burrow_section` · 180×320 logical · 720×1280 px · anchor whole image

A side-view cross-section of a gopher tortoise burrow for the burrow-scope mini-game: a thin strip of sky and scrub at the top, the burrow's sandy apron at the top-left, then layered pale-to-tan sand that grows warmer and darker with depth, a few roots hanging down, and a tortoise-shell-wide dark-brown tunnel sloping down in an S-curve to a rounded resting chamber near the bottom. Leave the tunnel empty: the game places the animals.

- **Must show:**
  - The tunnel must follow this path in the 180×320 logical canvas: M30 40 C130 90 30 170 120 220 Q160 245 120 285.
  - Chamber centred near (112, 288).
  - Rounded corners (about 12 logical px) with a transparent outside.
- **Avoid:**
  - Animals in the tunnel.
  - Text or labels.
- **Note:** The game darkens everything except a moving circle of light, so mid-tones read best.

### `dig_sand` · 270×270 logical · 1080×1080 px · anchor whole image

A top-down close-up of pale Florida scrub sand for the rhizome-dig mini-game: fine quartz grains, a few tiny pebbles and bits of leaf litter, very low contrast so that the game's white runner lines stand out on top.

- **Must show:**
  - Even, low-contrast texture.
  - Rounded corners (about 14 logical px) with a transparent outside.
- **Avoid:**
  - Plants, roots or lines (the game draws them).

## Pictograms (64×64)

Match the existing `ui_*` pictograms (for example `ui_cut`, `ui_water`, `ui_camera`): chunky rounded shapes, soft pastel fill, a darker outline of the same hue, small cream highlights, no text. 64×64 logical (256×256 delivered).

| Key | Shows | Colours |
| --- | --- | --- |
| `ui_breezy` | Wind: three curling gusts | soft blue-grey |
| `ui_heat` | Hot and dry: a thermometer with a little sun | warm coral |
| `ui_rain` | Rain: a puffy cloud with three falling drops | pale blue |
| `ui_storm` | Thunderstorm: a grey cloud with a yellow lightning bolt | slate and yellow |
| `ui_hurricane` | Hurricane: a spiral swirl | storm blue |
| `ui_fog` | Fog: three soft horizontal bands | misty grey |
| `ui_cold` | Cold snap: a frosty six-point snowflake | icy blue |
| `ui_spring` | Spring: a five-petal pink wildflower | pink and gold |
| `ui_summer` | Summer wet season: a sun over gentle waves | sunny yellow and blue |
| `ui_fall` | Fall: a small scrub-oak leaf and an acorn | russet and tan |
| `ui_winter` | Winter: a cozy striped scarf | coral, cream and mint |
| `ui_fire` | Fire: a single rounded flame | orange and yellow |
| `ui_douse` | Spray water: a little red spray nozzle with water droplets | red and blue |
| `ui_rake` | Rake a firebreak: a garden rake | wood and grey |
| `ui_torch` | Drip torch for prescribed burns: a red canister with a curved spout and a small flame at the tip | red, grey and orange |
| `ui_dig` | Dig out roots: a garden trowel with a pale root | steel grey and wood |
| `ui_scope` | Burrow scope: a little round camera lens on a bendy cable | mint and slate |
| `ui_sort` | Sort recycling: three small bins in green, blue and yellow | green, blue, yellow |
| `ui_task` | Today's goals: a clipboard with three check marks | cream and mint |
| `ui_level` | Stewardship level: a gold star with a small green leaf | gold and green |
| `ui_edge` | The habitat edge: three fence posts with an arrow curving in | wood and brick red |
| `ui_tank` | Water tank: a rounded water tank showing its water level | pale blue |

## Optional next

These would add polish; the code currently fakes them with tints and scaling:

- `wildfire_1`, `wildfire_2`: two more flame frames on the `wildfire` canvas, for a hand-drawn flicker.
- `<plant>_burnt` for `oak`, `hickory`, `palmetto`: the same canvas as each plant, burned back to a charred crown (shown the day after a fire).
- `robot_spray`, `robot_rake`, `robot_camera`: the robot (36×36) holding a spray nozzle, a rake, or a camera, for the fire line, firebreaks and portraits.
- `iguana_cold`: the green iguana (34×16 brief size) lying stiff and pale after a cold snap.
