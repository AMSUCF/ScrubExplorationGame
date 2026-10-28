# Scrub Bot illustration set

The game ships with a complete illustrated set: plants and wildlife, the robot and pod upgrades,
furniture, jars, sprigs, ground surfaces, room shells, effects, and a matching pictogram set.
`splash.webp` is the full-bleed title illustration. All images and fonts are served locally.

- Every sprite is a transparent sRGB PNG at **4× its logical size**.
- Each habitat has three seamless 512×512 ground variants. Room shells are opaque at their brief sizes ×4.
- `manifest.json` lists the runtime images; `src/art/catalog.json` records their logical dimensions.
- The 64×64 logical `ui_*` pictograms replace platform emoji in DOM controls and in-game reactions.
- Rebuilt botanical paintings include fine canopy leaves, bark, needle foliage, grasses, veined
  vines, natural wildlife, and ground-level wiregrass, golden asters, fallen fans, wood, and lichen.
- `shade_*` projects actual canopy outlines; `litter_*` blends each plant's ground cover into the sand.
- Enlarged plant canvases and the ecological display hierarchy are recorded in `src/data/visuals.ts`.
  `vine_leaf` and `vine_bulbil` connect invasive vines to their real native hosts in the world and care view.
- Native wildlife has little clay shelf figurines. `green_anole` is supplied for future content.

To regenerate the delivered sprites and surfaces from retained illustration sheets and vector sources:

```sh
npm ci
npm run art:build
npm run art:check
```

Source sheets, original vector artwork, and delivery mapping live in `scripts/art/`.
The build also writes ignored review plates to `screenshots/art-catalog.png` and
`screenshots/nature-scale.png`. The latter shows plants, wildlife, robot, and pod at one shared scale.
See `docs/ART_DIRECTION.md` for art direction, provenance, and validation.

## Replacing an illustration

Put finished illustrations here as `<texture-key>.png` (e.g. `tortoise.png`, `ground_sand.png`) and
list each key in `manifest.json`, for example:

```json
["robot", "robot_blink", "robot_happy", "tortoise", "ground_sand"]
```

On boot the game loads every listed PNG. `src/art/catalog.json` defines delivery canvas dimensions;
`src/data/visuals.ts` defines world proportions separately from inventory thumbnails. Preserve each
illustration's aspect ratio, transparent margin, and root/foot baseline when replacing it. Keys not
listed keep their placeholder, so art can arrive a piece at a time.
