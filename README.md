# Scrub Bot 🤖🌱

A cozy, mobile-friendly, top-down game: you play a small, round robot in an abandoned patch of Florida scrub. Your job is to clear the invasive plants and trash, and to gently relocate the invasive animals. You also rescue native plants, grow their seeds at your home-base nursery, and plant them back out, until gopher tortoises, Florida mice, scrub-jays and indigo snakes come home.

Inspired by Animal Crossing, cozy games, and *The Wild Robot*. The art pairs a storybook Florida scrub landscape with rounded, kid-friendly characters, illustrated controls, textured sand, and a warm little greenhouse home.

## Play

Pictures, little robot reactions, and short readable labels work together. The field guide holds the natural-history facts; tools, nursery jars, and wildlife needs explain what to do next.

- **Tap the ground** (or click it) to drive there. Hold and drag to steer.
- **Tap anything** to open a labelled action tray. The robot drives over and does the work. Pepper has three visible stems to cut; lifting weeds takes a short, deliberate effort.
- **Untangle climbing vines:** swipe across gold snip marks without touching the protected native branches, drag all three bulbils into the bag, then pull the freed vine downward. Leave and resume whenever you like. Keyboard users can Tab to a mark and press Enter.
- **Tap the robot** for its own menu: plant a seedling in front of you, or head home.
- **Desktop:** you can also use WASD/arrows to drive, Space/E to open the menu for whatever's nearby, 1–9 to pick an action, Esc to close, and G for the field guide.

Your progress saves automatically in the browser.

### The loop

1. **Arrival.** A pod drops into the neglected scrub and a small robot rolls out. The pod becomes its home.
2. **Explore.** Scan anything new (🔍) to fill the field guide. Pull, cut, and pick up invasive plants and trash.
3. **Rescue native plants** that invasives are choking. Each day you can **collect seeds** (🌰) and **snip a sprig** (💐) from each one.
4. **Hydroponics at home.** Open **Nursery** for large, labelled jars. Sow seeds and top up their water (💧) daily. After 2 watered nights, **pot up** (🪴) the seedling and plant it outside. Young plants gradually grow into their full canopy.
5. **Invasive animals.** **Crate** (📦) feral cats, tegus, and iguanas, and **jar** (🫙) brown anoles. Drop them at the **pad** (🚚). Cats get adopted, and postcards arrive.
6. **Wildlife returns** once its needs are met. Each species' population grows when the habitat supports it and dips (never below 1) when it doesn't. The wildlife monitor explains each need. Say hello to a native neighbor for a cute encounter and a small thank-you, once per species each day. Rescued plants attract passing butterflies.
7. **Inside the pod:**

   | Item | What it's for |
   | --- | --- |
   | Wildlife monitor | Populations, trends, needs, and sightings |
   | Corkboard | First-sighting photos and postcards |
   | Vases | Arranging your sprigs |
   | Shelf | Figures of every species that has come home |
   | Workbench | Spending recycled ⚙️ parts on a bigger battery, more jars, more vases, and room expansions (unlocked by the tortoise and the scrub-jay) |

8. **End the day** by sleeping in the **charging cradle**. A labelled morning card shows what grew, who arrived, and what needs care.

### Sound
All audio is synthesized live with the Web Audio API, so there are no sound files.

- **Music:** a generative, Florida-afternoon soundtrack. Outdoors it's warm pentatonic guitar-like plucks over seventh chords; inside the pod it's a slower music-box theme; the intro has its own hopeful theme.
- **Ambience:** swelling cicadas, crickets that rise at dusk, wind, and passing cardinals, mourning doves, towhees and woodpeckers. Inside the pod it's muffled, with bubbling hydroponic jars.
- **Robot:** wordless bleeps for each mood.
- **Animals:** a call for every animal (the scrub-jay's raspy *shreep*, a meow, tegu hiss, mouse squeaks…), played on sightings, scans, thought bubbles and captures.
- **Actions:** each one has its own sound.

Use 🔊 in the HUD to mute everything, or ⏸ → 🎵 / 🔔 to toggle music and effects separately.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173 (also exposed on your LAN for phone testing)
npm test           # unit + full-playthrough tests for the game systems
npm run build      # typecheck + production build into dist/
npm run smoke      # after build: Playwright drives the game in a phone viewport, screenshots → screenshots/
npm run audio      # renders every sound offline, checks none is silent or clipping, writes WAV previews
npm run art:build  # rebuilds production PNGs from retained illustration and vector sources
npm run art:check  # checks brief coverage, 4× sizes, transparency, fonts, and splash
npm run restoration:smoke # after build: touch vine care, pause/reload, keyboard care, nursery and monitor
```

Add `?debug` to the URL to expose `window.__game` for poking around in the console.

## Deploy

`.github/workflows/deploy.yml` runs the tests, builds the game, and publishes it to GitHub Pages on every push to `main` or `claude/**`.

One-time setup: go to **Settings → Pages → Source** and choose **GitHub Actions**. If a deploy is blocked by environment protection, go to **Settings → Environments → github-pages** and allow the branch.

**Troubleshooting:** if the live page is blank and the console shows a 404 for `/src/main.ts`, Pages is still set to *Deploy from a branch*. That setting serves the unbuilt source instead of `dist/`. Switch the source to **GitHub Actions** and push again.

## Project layout

| Path | What lives there |
| --- | --- |
| `src/data/` | Species facts and stats, the map/zones, the home layouts, the action icons, and the colour palette. This is the content to edit. |
| `src/systems/` | Pure game logic with no Phaser dependency: state, actions, battery, nursery, habitat, populations, home upgrades, pathfinding, night tick, and saving (with migration). Fully unit-tested. |
| `src/art/` | Texture assembly, fallback art, feathered habitat surfaces and the delivered-asset catalog. `src/data/visuals.ts` defines ecological world proportions, tree growth, and vine attachment. |
| `src/scenes/` | Phaser scenes: `Boot`, `Intro` (the pod drop), `World` (the scrub), and `Home` (the pod interior). Both play scenes extend `PlayScene` (tap-to-go, radial menus, and feedback). |
| `src/entities/` | The robot (path following, antennas, emotes) and critter wander AI. |
| `src/ui/` | Labelled action tray, HUD, touch/keyboard vine-care encounter, nursery dashboard, guide, morning summary and wildlife monitor. |
| `src/audio/` | Web Audio synth, sound effects, robot and animal voices, the generative music and the ambience. |
| `public/art/` | Drop-in folder for finished illustrations (listed in `manifest.json`); each replaces the placeholder with the same key. |
| `docs/DESIGN.md` | The game design doc. |
| `docs/ART_ASSET_BRIEF.md` | The illustration brief: style guide, every asset with sizes and anchors, and the field marks for each species. |
