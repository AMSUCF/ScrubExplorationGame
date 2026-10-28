# Finished art drop-in

Put finished illustrations here as `<texture-key>.png` (e.g. `tortoise.png`, `ground_sand.png`) and
list each key in `manifest.json`, for example:

```json
["robot", "robot_blink", "robot_happy", "tortoise", "ground_sand"]
```

On boot the game loads every listed PNG and uses it instead of the code-drawn placeholder with the
same key — scaled into that texture's logical box, so keep the aspect ratios from
`docs/ART_ASSET_BRIEF.md`. Keys not listed keep their placeholder, so art can arrive a piece at a time.
