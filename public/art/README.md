# Scrub Bot illustration set

The game ships with a complete illustrated set: plants and wildlife, the robot and pod upgrades,
furniture, jars, sprigs, ground surfaces, room shells, effects, and a matching pictogram set.
`splash.webp` is the full-bleed title illustration. All images and fonts are served locally.

- Every sprite is a transparent sRGB PNG at **4× its logical size**.
- Ground textures are seamless 512×512 PNGs. Room shells are opaque at their brief sizes ×4.
- `manifest.json` lists the runtime images; `src/art/catalog.json` records their logical dimensions.
- The 64×64 logical `ui_*` pictograms replace platform emoji in DOM controls and in-game reactions.
- Extra `decor_*` images add wiregrass, golden blossoms, fallen fans, and reindeer lichen.
- Native wildlife has little clay shelf figurines. `green_anole` is supplied for future content.

To regenerate the delivered sprites and surfaces from retained illustration sheets and vector sources:

```sh
npm ci
npm run art:build
npm run art:check
```

Source sheets, original vector artwork, and delivery mapping live in `scripts/art/`.
The build also writes an ignored contact sheet to `screenshots/art-catalog.png`.
See `docs/ART_DIRECTION.md` for art direction, provenance, and validation.

## Replacing an illustration

Put finished illustrations here as `<texture-key>.png` (e.g. `tortoise.png`, `ground_sand.png`) and
list each key in `manifest.json`, for example:

```json
["robot", "robot_blink", "robot_happy", "tortoise", "ground_sand"]
```

On boot the game loads every listed PNG and uses it instead of the code-drawn placeholder with the
same key — scaled into that texture's logical box, so keep the aspect ratios from
`docs/ART_ASSET_BRIEF.md`. Keys not listed keep their placeholder, so art can arrive a piece at a time.
