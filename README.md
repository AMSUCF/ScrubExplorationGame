# Scrub Bot 🤖🌱

A cozy, mobile-friendly, top-down game: you play a small, rusty robot in an abandoned patch of Florida scrub. Your job is to clear the invasive plants and trash, and to gently relocate the invasive animals. You also rescue native plants, grow their seeds at your home-base nursery, and plant them back out, until gopher tortoises, Florida mice, scrub-jays and indigo snakes come home.

Inspired by Animal Crossing, cozy games, and *The Wild Robot*. The art is a set of placeholders drawn in code, which will be replaced later.

## Play

- **Phone:** drag anywhere on the screen to drive, and tap the big round button to do whatever is nearby.
- **Desktop:** WASD or the arrow keys drive, Space/E acts, and G opens the field guide.

Your progress saves automatically in the browser.

### The loop

1. **Scan** anything new to add it to your field guide. The first time you meet a species, the action button offers to scan it.
2. **Pull, cut and pick up** invasives and trash. Every action uses battery.
3. **Rescue** native plants that are choked by invasives, then **collect seeds** from them, once per plant per day.
4. At base, **sow** the seeds in nursery trays and **water** them every day. After 2 watered nights, **pot up** the seedling.
5. **Plant** seedlings in cleared ground. Each native prefers its own zone.
6. **Crate** feral cats, tegus and iguanas, **catch** brown anoles in your jar, and drop them all at the **relocation pad**. Cats get adopted 🐈.
7. **Recycle** trash for parts, which upgrade your battery.
8. **Sleep** at the charging dock to end the day. Seeds grow, cogon grass spreads, and wildlife may return overnight.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173 (also exposed on your LAN for phone testing)
npm test           # unit + full-playthrough tests for the game systems
npm run build      # typecheck + production build into dist/
npm run smoke      # after build: Playwright drives the game in a phone viewport, screenshots → screenshots/
```

Add `?debug` to the URL to expose `window.__game` for poking around in the console.

## Deploy

`.github/workflows/deploy.yml` runs the tests, builds the game, and publishes it to GitHub Pages on every push to `main` or `claude/**`.

One-time setup: go to **Settings → Pages → Source** and choose **GitHub Actions**. If a deploy is blocked by environment protection, go to **Settings → Environments → github-pages** and allow the branch.

## Project layout

| Path | What lives there |
| --- | --- |
| `src/data/` | Species facts and stats, the map/zones, and the colour palette. This is the content to edit. |
| `src/systems/` | Pure game logic with no Phaser dependency: state, actions, battery, nursery, habitat, night tick, and saving. Fully unit-tested. |
| `src/art/placeholders.ts` | **Every** visual, drawn with Canvas 2D. To swap in real art, load images under the same texture keys. |
| `src/scenes/` | Phaser scenes. `Boot` generates textures and shows the title screen; `World` holds the playfield. |
| `src/entities/` | Critter wander AI. |
| `src/ui/` | DOM HUD, joystick, keyboard input, and modal cards (field guide, morning summary, menu). |
| `docs/DESIGN.md` | The game design doc. |
