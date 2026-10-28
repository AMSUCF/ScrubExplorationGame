# Scrub Bot — Illustration Asset Brief

This brief is for the illustration model or artist producing final art for **Scrub Bot**, a cozy, wordless, top-down game about a small robot restoring an abandoned patch of **Florida scrub**. Every asset below already exists in the game as a code-drawn placeholder with the same **texture key**. Finished PNGs drop straight in (see [Delivery](#delivery)).

Two goals pull against each other, and the art must satisfy both:

1. **Cozy cartoon:** soft, round, friendly and readable at small sizes, in the spirit of Animal Crossing and *The Wild Robot*'s painterly warmth.
2. **Naturalist accuracy:** every plant and animal must show its real **field marks**, so that a player who later meets it outdoors recognizes it. Simplify shapes, never the identifying features. Each entry below lists **Must show** (required) and **Avoid** (common mistakes).

---

## 1. Global style guide

### Camera and perspective
- **Top-down ¾ view** (camera tilted about 45°): we see the top and the front face of objects. Every world asset faces the same way: front toward the viewer, slightly from above.
- Animals are shown in **side or ¾ profile facing right**. The game flips them for leftward motion, so avoid text and asymmetric lighting cues that would break when mirrored.
- **Light from the upper-left**, warm late-morning sun. Shading falls to the lower-right.

### Line and colour
- **Soft coloured outlines**, never black. Use a darker, warmer shade of each fill (for example, a leaf green outlined in deep olive). Line weight ≈ 2 px at display size (≈ 8 px at 4× delivery), slightly thicker on the outer silhouette than on interior lines.
- **Flat colour + one soft shade + one highlight.** At most a light painterly grain on large surfaces (ground, room walls). No photographic texture and no hard cel-shading.
- **Muted, sun-bleached palette**: sand creams, sage and olive greens, dusty blues, with small warm accents (berries, flowers, robot cheeks). Invasive species may be a touch more saturated or "too lush" than natives, but they must not look evil. This is a cozy game.
- **Contact shadow:** every standing object includes a soft elliptical shadow at its base, `rgba(60, 45, 25, 0.22)`, offset slightly right.

### Shape language and proportions
- Rounded, chunky silhouettes with gentle curves. Mildly chibi proportions for animals: heads about 15–25% larger than life. Keep each species' **body plan** and **field marks** exact.
- **Silhouette test:** each asset must be identifiable as a solid black shape at display size. The field guide literally shows undiscovered species as silhouettes.
- **Readability at size:** display sizes are small, 14–44 px for most sprites. Exaggerate field marks (the jay's necklace, the iguana's cheek scale) rather than add fine detail that disappears.

### Reference palette (current placeholders)
Match or harmonize with these:

| Use | Hex |
| --- | --- |
| Sand / scrub ground | `#ecdfb8`, shade `#dccb9c` |
| Oak scrub ground | `#d3c48f` |
| Rosemary bald (white sand) | `#f6f1e2` |
| Native leaf greens | `#6f9a6a`, `#4d7a52`, `#9cc48e` |
| Oak greens | `#5f8150`, `#466640` |
| Rosemary grey-green | `#9fb38f` |
| Bark | `#7a5a3c` |
| UI paper / ink | `#fbf5e6` / `#3d3328` |
| Robot shell / plate / mint / blush / accent | `#fffaf0` / `#3b3a48` / `#a8dccf` / `#f7a8b8` / `#ffb59a` |

---

## Delivery

- **Format:** PNG, transparent background (except ground tiles and room shells), sRGB.
- **Resolution:** **4× the logical size** in the tables (e.g. the robot is 36×36 logical, so deliver 144×144). The game scales art into the logical box, so **keep the exact aspect ratio**.
- **Filename:** `<texture-key>.png`, placed in `public/art/`, with the key added to `public/art/manifest.json`. Anything not listed keeps its placeholder, so assets can ship in batches.
- **Anchors:** unless noted, the game places a sprite by its **bottom-centre**, so the object's base and contact shadow must sit on the bottom edge of the canvas, horizontally centred. Animals use a point about 85% of the way down. Leave about 4–6% padding on the other edges.
- **Variants:** where a table lists states, each state is a separate file with an identical canvas and an identical anchor, so swaps don't jitter.

---

## 2. The robot (hero character)

The robot is the soul of the game: curious, gentle, a little clumsy, and expressive without words.

**Design direction:** inspired by **Hugging Face's Reachy Mini** (a big rounded head, two large round lens-eyes, two springy antennas) and pushed toward **Sanrio** softness. It must **not** read as Disney/Pixar's Wall-E: **no binocular eyes on a neck, no boxy trash-compactor body, no rust-brown palette.**

| Key | Logical size | Notes |
| --- | --- | --- |
| `robot` | 36×36 | Idle, eyes open. Anchor at the centre (feet near the bottom). |
| `robot_blink` | 36×36 | Eyes closed as flat lines. |
| `robot_happy` | 36×36 | Eyes as upturned happy arcs (^ ^). |
| `antenna` | 8×16 | One antenna: a thin dark stalk with a gentle S-curve and a round peach ball tip with a highlight. Anchor at the bottom-centre (the base attaches to the head). The game uses two copies and wobbles them. |
| `crate` | 20×15 | The small wooden pet carrier the robot carries above its head: slatted sides, carry handle, a little air-hole pattern. |

**Must show:**
- A **big, round, cream head** (`#fffaf0`) that is wider than tall and takes about 60% of the height.
- A **dark rounded face plate** (`#3b3a48`) holding **two large glossy round lens-eyes** with mint rings (`#8fe0cf`) and two white catch-lights each.
- **Pink blush cheeks** below the plate.
- A **small mint body** (`#a8dccf`) with a tiny leaf badge.
- **Two short rounded treads** in soft grey.
- The antennas mount on the top of the head, slightly apart.

**Optional extra animation frames** for later (same canvas):
- `robot_walk_0..3`: tread roll and slight body bob.
- `robot_sad`: eyes as drooping arcs, plate tilted.
- `robot_scan`: eyes glowing mint.

---

## 3. The pod (home exterior) and intro

| Key | Logical size | Notes |
| --- | --- | --- |
| `pod0` | 104×74 | A landed escape pod turned cottage: a cream capsule lying on its side, a mint stripe, two round porthole windows glowing warm yellow, a small antenna with a peach ball, and a rounded **open** door with warm light inside. Light landing scuffs. Bottom-centre anchor. |
| `pod1` | 104×74 | Same as `pod0`, plus a **greenhouse dome** of glass ribs on the right side with small plants visible inside. |
| `pod2` | 104×74 | Same as `pod1`, plus a **solar canopy** on a post at the left and a **flower box** under the windows with tiny pink, yellow and lavender blooms. |
| `pod_shut` | 104×74 | `pod0` with the door **closed** (used falling from the sky in the intro). |
| `flame` | 20×40 | The descent trail: a soft tapering cream-to-peach flame, fading to transparent. Bottom-centre anchor (the game rotates it). |
| `dust` | 10×10 | A soft round sand-dust puff particle. |

---

## 4. Native plants

All natives also appear as **sprigs** (section 9) and in field-guide cards. Natives appear in two states. The game currently tints the normal art for the choked state; a dedicated `<key>_choked` variant is welcome: the same plant, desaturated, drooping, and partly overgrown.

### Saw palmetto (*Serenoa repens*): `palmetto`, 34×30
- **Must show:**
  - **Fan-shaped (palmate) leaves**, each a stiff semicircle of 20+ narrow, pleated segments radiating from one point. Colour ranges from green to the **silvery blue-green** coastal form; mix both tones in a clump.
  - **Petioles (leaf stalks) edged with small sharp saw teeth**, the plant's namesake. Make the teeth visible on at least one stalk.
  - The low, sprawling clump habit, growing from **horizontal, creeping trunks** that lie along the sand.
  - Optional: a short cluster of berries (green → yellow-orange → black).
- **Avoid:** feather-shaped (pinnate) palm fronds, a tall upright trunk (that's a cabbage palm), smooth stalks.

### Florida rosemary (*Ceratiola ericoides*): `rosemary`, 30×28
- **Must show:**
  - A **dense, rounded dome shrub**, almost a soft cloud or mop shape.
  - **Short needle-like leaves** in whorls, crowded at the branch tips, giving a fine bristly texture.
  - **Grey-green to olive** colour.
  - It sits on **bare white sand** with gaps around it; the game's "rosemary bald" ground has patches of grey **reindeer lichen (*Cladonia*)** nearby.
  - Optional: tiny yellowish-to-red berries on female plants.
- **Avoid:** culinary rosemary sprigs or purple flowers. This is a wild scrub shrub and should read as a fuzzy dome.

### Scrub oak (sand live oak *Quercus geminata* and myrtle oak *Q. myrtifolia*): `oak`, 38×38
- **Must show:**
  - A **short, shrubby, multi-stemmed** small tree (the scrub's oaks stay knee- to head-height), with smooth grey bark.
  - Sand live oak leaves: **thick, leathery, dark green, with edges rolled under (revolute)**, deeply veined on top and **pale and fuzzy underneath**. Show a few cupped leaves flashing their pale undersides.
  - Myrtle oak leaves: **small, glossy, rounded to egg-shaped**. Mixing both leaf types in one shrub is fine.
  - A few **small acorns with shallow caps**. Scrub-jays depend on these.
- **Avoid:** lobed northern oak leaves (red or white oak shapes), a towering canopy tree, Spanish moss draped heavily (save it for a later "old oak" prop).

### Scrub hickory (*Carya floridana*): `hickory`, 36×42
- **Must show:**
  - A small tree or tall shrub with **light grey bark**.
  - **Pinnately compound leaves** (5–7 leaflets on a central stalk).
  - Its signature: **rusty-brown / silvery scales** on twigs and leaf undersides, giving a coppery shimmer.
  - Optional: round nuts in husks splitting into **four sections**.
- **Note:** found only on the central Florida ridges. Lighter, yellower green than the oaks.
- **Avoid:** palmate leaves, oak-like simple leaves.

---

## 5. Invasive plants

Make them believable, not monstrous: slightly too lush, crowding and smothering.

### Cogon grass (*Imperata cylindrica*): `cogon`, 30×30
- **Must show:**
  - An upright clump of **yellow-green, stiff, flat blades**.
  - Its key field mark: a **whitish midrib that runs off-centre** along each blade.
  - Finely **serrated edges**.
  - **Fluffy, silky white, cylindrical plume seedheads** above the blades. Make these the eye-catcher.
  - Optional: a few blade tips tinged reddish-brown.
- **Avoid:** a soft lawn grass; pink plumes (that's natal grass).

### Brazilian pepper (*Schinus terebinthifolia*): `pepper`, 44×44
- **Must show:**
  - A sprawling, **multi-stemmed** shrub or small tree with dense dark foliage.
  - **Pinnately compound leaves (usually 7–9 leaflets)** with **reddish leaf stalks (rachis)**, the leaflets glossy dark green with lightly toothed edges.
  - **Dense clusters of small, shiny, bright red berries** (drupes). This is the strongest visual cue.
- **Avoid:** holly leaves, single red berries scattered sparsely, a neat lollipop shape.

### Air potato (*Dioscorea bulbifera*): `airpotato`, 34×30
- **Must show:**
  - A **twining vine** draped over a mound (smothering a shrub).
  - Large **heart-shaped leaves** with **prominent curved veins that arc from the base and converge at the leaf tip**, on long stalks, alternating along the vine.
  - **Aerial bulbils**: small **brown-grey, warty, potato-like** lumps hanging in the leaf axils, with a few fallen ones on the ground.
- **Avoid:** ivy-lobed leaves, morning-glory flowers.

### Natal grass (*Melinis repens*): `natal`, 30×30
- **Must show:**
  - An open, clumping grass with narrow, slightly blue-green blades.
  - **Fluffy, silky seed heads in rose-pink to purple-red**, fading to silvery-white on older heads. Show a mix.
- **Avoid:** white plumes (cogon), wheat-like heads.

---

## 6. Hazards

| Key | Logical size | Description |
| --- | --- | --- |
| `tire` | 24×18 | An old car tire lying flat, worn tread, a pool of **rainwater inside** (a mosquito nursery, which the field guide mentions), a few dead leaves in it. |
| `bottle` | 16×18 | A green glass bottle on its side, half-buried in sand, with a sun-faded blank label. A clear sense of "trap for small critters". |
| `fence` | 32×32 | One section of old fence: two **weathered grey-brown wooden posts** with sagging **rusty barbed wire** in three strands. Several sections line up vertically to form a fence line, so the left and right edges should read as continuous. |
| `thicket` | 40×36 | **Fire-suppressed overgrowth**: an overly dense, tall tangle of scrub oak and palmetto with **dead grey stems, curled dry leaves and leaf-litter piles**. It should feel stuffy and closed-in, not evil. (The scrub needs periodic fire; this asset represents its absence.) |
| `burrow` | 30×20 | A **gopher tortoise burrow**: a **half-moon (dome-topped, flat-bottomed) entrance** as wide as a tortoise shell, angled down into the sand, with a fan-shaped **apron of loose, freshly dug sand** spilling in front. Drawn flat on the ground; centre anchor. |

---

## 7. Native wildlife

These are the stars. Each returns as the habitat improves, wanders the map, and shows thought bubbles. They need to be adorable **and** unmistakable.

### Gopher tortoise (*Gopherus polyphemus*): `tortoise`, 28×20
- **Must show:**
  - A **high-domed, oblong carapace** in tan to dark grey-brown. Each scute shows **concentric growth rings**.
  - A **yellowish plastron** edge.
  - **Front legs flattened like shovels, scaly, with thick digging claws.**
  - **Stumpy, elephant-like hind legs.**
  - A **blunt, rounded grey-brown head**.
- **Avoid:** webbed feet or flippers (it's a land tortoise, not a turtle), a flat shell, bright patterns.

### Florida mouse (*Podomys floridanus*): `mouse`, 14×11
- **Must show:**
  - **Very large round ears** and **big dark eyes**.
  - **Large hind feet.**
  - A **tawny / cinnamon-orange back** with a crisp line to a **white belly and white feet**.
  - A tail **shorter than the body**, darker above and paler below.
- **Note:** the only mouse species found only in Florida; it lives in tortoise burrows (a "gopher mouse").
- **Avoid:** a plain grey house mouse, a long naked tail.

### Florida scrub-jay (*Aphelocoma coerulescens*): `jay`, 19×16
- **Must show:**
  - **No crest.** A smooth rounded head; this is the key difference from the blue jay.
  - **Blue head, wings and long tail.**
  - A **grey-brown back patch** between the wings.
  - A **pale grey-white throat and belly**.
  - A **faint blue-grey "necklace" band across the upper breast**, framing the white throat.
  - A **whitish forehead / eyebrow**.
  - A **stout black bill**.
  - Ideally perched upright, as on a sentinel lookout.
- **Avoid:** a crest, black barring or white wing spots (blue jay), all-over blue.

### Eastern indigo snake (*Drymarchon couperi*): `indigo`, 41×16
- **Must show:**
  - A long, heavy-bodied snake in a relaxed S-curve, **glossy blue-black with an iridescent blue-purple sheen** (strong highlight streaks).
  - **Smooth, shiny scales.**
  - A **reddish-orange to cream chin, throat and cheeks**.
  - **Round pupils** and a calm, friendly expression. It is non-venomous and gentle.
- **Avoid:** a triangular "viper" head, slit pupils, rattles, a dull matte black.

### Future (not in the game yet, but planned): green anole (*Anolis carolinensis*), `green_anole`, 16×8
- Slender, **bright green** (able to turn brown), long pointed snout, **pink dewlap**. The native counterpart to the brown anole.

---

## 8. Invasive animals

Cozy rules: no menace, no blood, no suffering. They are simply in the wrong place and get rescued and relocated.

### Feral cat (*Felis catus*): `cat`, 23×18
- **Must show:** an ordinary **orange tabby** shorthair, a little scruffy, collarless, crouched in a curious stalking pose with its tail up. Friendly and huggable; it's going to be adopted.
- **Avoid:** menacing fangs, a skinny or sick look.

### Argentine black-and-white tegu (*Salvator merianae*): `tegu`, 30×14
- **Must show:**
  - A large, **thick-bodied** lizard with **bold black and white (cream) banding**: chevron-like bands across the body and a **long ringed tail**.
  - A broad head (males have puffy jowls).
  - A **forked tongue** optionally flicking.
- **Avoid:** green colouring, spines.

### Green iguana (*Iguana iguana*): `iguana`, 34×16
- **Must show:**
  - A **row of tall spines along the back** (dorsal crest).
  - A **large round cheek scale (subtympanic shield)** below the ear. This is the key field mark.
  - A **dewlap** under the chin.
  - A **long tail with dark rings**.
  - Colour bright green (juvenile) to grey-green with orange tints.
- **Avoid:** a frilled neck, smooth back.

### Cuban brown anole (*Anolis sagrei*): `anole`, 16×8
- **Must show:**
  - A small, **brown** lizard with a **darker diamond / chevron pattern down the back** (or a pale wavy-edged stripe for a female).
  - Optionally the male's **orange-red dewlap with a pale edge**, half-extended.
- **Avoid:** green colouring (that's the native anole).

---

## 9. Home interior (pod)

Warm, lived-in, slightly whimsical: the robot's collection of treasures. Think of a tiny greenhouse cabin inside a space capsule.

| Key | Logical size | Notes |
| --- | --- | --- |
| `room0` | 384×256 | Room shell, level 0, **opaque**. Rounded capsule frame in dark slate (`#3b3a48`) with about 6 px rounded inner corners. The top 64 px is **wall**: soft cream wallpaper with faint warm stripes and a wood baseboard. Below is a **warm honey wood plank floor** with a round mint rug centred in the lower floor. Leave wall space clear at x≈100–160 (monitor), x≈170–230 (shelf), x≈290–350 (corkboard). |
| `room1` | 480×288 | Level 1, same style. Leave space for a window at the wall centre. |
| `room2` | 576×320 | Level 2, same style, with a more "greenhouse" feel: hanging plants at the top corners and a skylight hint in the wall. |
| `cradle` | 64×34 | Charging bed: a soft lavender rounded pad with a pillow, a mint charging strip glowing faintly, a cable and plug, and a tiny moon sticker. |
| `hydro_<stage>_<dry\|wet>` | 28×36 each, 8 files | A hydroponic **glass jar** with a grey net cup on top and a **purple LED grow-light bar** above. `wet` = full, bright blue water; `dry` = low, pale water. Stages: `empty`; `sown` (seeds dotted in the net cup); `sprout` (two tiny seedlings, short white roots in the water); `ready` (a sturdy leafy seedling, long roots). |
| `monitor` | 44×34 | A wall-mounted retro CRT in cream plastic, with a dark green screen showing a glowing mint line graph trending up and a little status LED. |
| `board` | 46×34 | A corkboard with a wooden frame (the game pins tiny photos on it). |
| `bench` | 64×36 | A workbench: wooden top and legs, a wrench, a gear and a small pink toolbox. |
| `vase` | 24×30 | A small round side table with a **terracotta vase**; the vase mouth is about 10 px from the top. The game stands sprigs in it. |
| `window` | 52×36 | A rounded window frame showing blue sky, green scrub and a sun. |
| `doormat` | 48×14 | A green woven mat with a warm light strip from the door above. |
| `polaroid` | 18×21 | A blank instant-photo frame (the game places the animal inside the square). |
| `postcard` | 22×16 | A blank postcard with a stamp corner. |
| `pin` | 6×6 | A red push-pin with a highlight. |

**Sprigs** (`sprig_<species>`, 12×21 each; bottom-centre is the stem end that goes in the vase). Botanically faithful miniatures:
- `sprig_palmetto`: one small toothed-stalk fan leaf.
- `sprig_rosemary`: a needle-whorled grey-green twig.
- `sprig_oak`: a twig of rolled-edge leathery leaves with one acorn.
- `sprig_hickory`: a compound-leaf twig with a coppery sheen.

**Shelf figurines** (optional; the game currently reuses the animal sprites): `figure_<species>`, 12×12. Tiny carved-wood or clay versions of each returned native animal, as the robot's keepsakes.

---

## 10. Base stations (outside)

| Key | Logical size | Notes |
| --- | --- | --- |
| `recycler` | 36×40 | A friendly green recycling machine: a rounded bin with a hopper lid, a recycling-arrows emblem and a little chute. |
| `pad` | 40×32 | The relocation pad: a wooden platform with a small post sign showing a **paw print**. A clean, welcoming "pickup spot". |

---

## 11. Ground tiles (seamless)

The ground is painted per zone with organic blob borders. Deliver **seamless, tileable** squares at 128×128 logical (512×512 at 4×), **opaque**. Keep detail low-contrast so sprites stay readable on top.

| Key | Zone | Look |
| --- | --- | --- |
| `ground_sand` | Sand Scrub | Pale tan sand, sparse **wiregrass** tufts, a few fallen palmetto bits, tiny ant-hill pocks. |
| `ground_oak` | Oak Scrub | Slightly darker, warmer sand with **oak leaf litter** (curled brown leaves), occasional acorn caps. |
| `ground_rosemary` | Rosemary Bald | Bright **white quartz sand** with grey-green **reindeer lichen (*Cladonia*)** clumps and the odd small cactus pad or wildflower. |
| `ground_base` | Home clearing | Packed sand, faint tread tracks, a few pebbles. |

The map edge (`edge` bushes) is currently drawn procedurally as dense dark scrub; a matching `edge_bush` (48×48) is optional.

---

## 12. Effects and UI

| Key | Logical size | Notes |
| --- | --- | --- |
| `sparkle` | 10×10 | A four-point cream star twinkle. |
| `ring` | 32×32 | Scan ring: a thin mint circle with a soft glow. |
| `bubble` | 34×32 | A thought bubble: a white puffy cloud with two small trailing dots at the bottom-left and a light warm outline. Content (a need icon) is drawn on top, centred about 2 px above the middle. |

**UI icon set (phase 2).** The game is wordless, so its buttons are pictograms; it currently uses emoji placeholders listed in `src/data/icons.ts`. A matching set of 64×64 rounded, chunky icons with cream outlines would replace them:
- Actions: scan, pull, cut, pick up, trim, seeds, sprig, crate, jar, greet, info / book, plant, sleep, recycle, drop-off, water, pot, clear, corkboard, monitor, enter, exit.
- Status: battery, parts / gear, bag, heart, sparkle, question, alert, waiting, done, wilted, lock, up / down arrows, sun / day, eye, postcard, truck, lab.
- Upgrades: more jars, vase, room.
- Sound and controls: music, sound effects, mute, fullscreen, play, skip.

Wiring the icons in needs a small code change (emoji → `<img>`).

---

## 13. Consistency checklist (for every asset)

- [ ] ¾ top-down view, facing the viewer; animals face right.
- [ ] Light from the upper-left; soft coloured outline (no black lines).
- [ ] Flat colour + one shade + one highlight; muted, sun-bleached palette.
- [ ] Bottom-centre anchor with a soft contact shadow (except tiles, room shells, burrow, effects).
- [ ] The exact logical aspect ratio, delivered at 4×, transparent PNG.
- [ ] The species' **Must show** field marks are visible at display size and in silhouette.
- [ ] Nothing scary: cozy, gentle and friendly expressions.

## 14. Suggested production order
1. `robot`, `robot_blink`, `robot_happy`, `antenna`, then `pod0`–`pod2` and `pod_shut` (they set the style).
2. Native wildlife: `tortoise`, `jay`, `mouse`, `indigo`, `burrow`.
3. Native plants: `palmetto`, `rosemary`, `oak`, `hickory`, plus the sprigs.
4. Invasive plants and animals.
5. Ground tiles.
6. Interior set and room shells.
7. Hazards, stations and effects; then the UI icon set.
