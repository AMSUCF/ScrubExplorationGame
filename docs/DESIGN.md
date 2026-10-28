# Scrub Bot — Game Design

## Pitch
A small, round robot drops by pod into a neglected patch of Florida scrub to be its new caretaker. Through curiosity, expressive reactions, and short readable tool labels, the robot works out what doesn't belong, grows back what does, and turns its landed pod into a cozy home full of seedlings, sprigs and keepsakes. Meanwhile, the wildlife slowly comes back. The game is cozy, has no failure state, and is suitable for all ages.

## Pillars
- **Show, then explain just enough.** Pictures, icons, animation and the robot's reactions carry the mood. Short text explains tools, costs, plant care and habitat needs; the field guide keeps written natural-history facts.
- **Learning through doing.** The first time you meet anything, you scan it, and the field guide fills in.
- **Ecology as mechanics.** Wildlife arrives, grows and dips according to real relationships: tortoises need open, unfenced sand; mice live in tortoise burrows; jays need low oaks and no cats; indigo snakes need burrows and no tegus.
- **Gentle stewardship.** Invasive animals are crated and relocated, never harmed. Cats get adopted.
- **A home that grows with you.** In the spirit of Wall-E's collection and Animal Crossing's house, the pod fills up with things you've grown and found, and it expands as the scrub recovers.

## Look
- **Robot.** Inspired by Hugging Face's Reachy Mini and pushed toward Sanrio:
  - a big round cream head with a dark face plate and two glossy lens eyes;
  - springy antennas tipped with peach balls, blush cheeks, a little mint body and tiny treads.
  - It blinks, squints happily, droops its antennas when sad, and emotes in icon bubbles.
- **Pod.** A cream capsule with mint stripes, portholes and an antenna. With each room expansion it gains a greenhouse dome, then a solar canopy and flower box.
- **Palette.** Sun-bleached sand, soft greens and warm pastels. All art is placeholder canvas drawing in `src/art/`, keyed so that real sprites can replace it.

## Controls
- **Tap or click the ground** to drive there (A* pathfinding). Hold and drag to steer directly.
- **Tap or click a thing** to open a radial ring of icon actions. Each button shows its battery or parts cost. A disabled button has a small badge showing why: 🔋 low battery, 🎒 bag full, 🥀 choked, ⏳ growing, ✔️ done for today, 🔒 plus the species that unlocks it. Picking an action drives the robot over and does it. The ring stays open for repeat taps.
- **Tap the robot** for its own menu: plant a seedling on the tile ahead, or go home.
- **Desktop extras:** hover highlights, WASD/arrows, Space/E to open the nearest ring, 1–9 to pick, Esc, and G for the guide.

## Core loop (one day = one battery)
Wake in the cradle → tend hydroponics → head out → scan, clear, rescue, collect seeds and sprigs, crate invaders → recycle and drop off → come home, arrange vases, check the monitor and spend parts → sleep → the picture-only morning card.

## Systems

| System | Rules (tuning in `src/config.ts`, `src/systems/home.ts`, `src/systems/population.ts`) |
| --- | --- |
| Battery | Starts at 100. Actions cost 1–5 and driving drains slowly. At 0 the robot crawls. |
| Scanning | The first interaction with any unscanned species is a Scan (🔍, 1 🔋). |
| Invasive plants | Cogon (pull; **spreads nightly**, up to 4 new patches), Brazilian pepper (cut ×3 with visible work, blocks movement), air potato (safe snips → bag 3 bulbils → unwind; 4 energy at completion), natal grass (pull). |
| Hazards | Tires and bottles go in the bag (6 slots). Fences (×2) block movement and keep tortoises out. Overgrown thickets (trim ×2) stand in for missing fire. |
| Native plants | *Choked* while any invasive is within 2 tiles. Once freed, each gives seeds (🌰) and a sprig (💐) once per day. |
| Hydroponics | Starts with 4 jars. Sow (pick the species) → top up water daily → 2 watered nights → pot up a seedling. |
| Planting | From the robot's own menu, on the empty tile ahead (not at base). Planted natives boost zone health. |
| Invasive animals | Cats, tegus and iguanas go in the crate (one at a time; it slows you down). Brown anoles go in the jar (5 slots). Drop them at the pad for overnight pickup, and postcards arrive. |
| Zone health | `good / (good + bad)`. Natives, burrows and wildlife count as good. Invasives, hazards and invasive animals count as bad. |
| Populations | See **Wildlife** below. |
| Sightings | Driving near a native animal logs one sighting per species per day. The first ever sighting pins a photo to the corkboard. |
| Home upgrades (workbench) | 🔋 +25 battery (4 ⚙️, ×3); 🌱 +2 jars (3 ⚙️); 🏺 +1 vase (2 ⚙️); 🏡 room expansion (6 ⚙️). Expansion 1 needs the tortoise and expansion 2 needs the scrub-jay. Jars and vases are capped by room size. |
| Night | Pad pickups → hydroponics → cogon spreads → tortoises dig burrows → populations update → recharge → save. |

### Wildlife
| Species | Arrives when | Grows toward | Thought-bubble worries |
| --- | --- | --- | --- |
| Gopher tortoise | Sand Scrub ≥ 65% and no fences there | Up to 6, rising with Sand Scrub health | Fence, the worst problem in the Sand Scrub, tegus |
| Florida mouse | A night after the first burrow | 2 per burrow | Burrows, cats |
| Eastern indigo snake | 2+ burrows and no tegus | 1 per 2 burrows | Burrows, tegus |
| Florida scrub-jay | Oak Scrub ≥ 60%, 6+ healthy oaks (so you must plant some), no thickets in the Oak Scrub, no cats | 1 family per 3 oaks | The worst problem in the Oak Scrub, oaks, thickets, cats |

Each night, a species' population grows by 1 if all its needs are met and it's below what the habitat can support. It drops by 1 if any need is unmet, but never below 1. The wildlife monitor graphs populations over time and pictures each species' unmet needs. Before a species arrives, the monitor and the guide show its arrival needs as hints. The scrub counts as restored when all four species are home; play continues afterward.

## Home (pod interior)
| Level | Room | Max jars / vases | Unlocked by |
| --- | --- | --- | --- |
| 0 | 12×8 | 6 / 2 | — |
| 1 | 15×9, with a window | 8 / 3 | Tortoise |
| 2 | 18×10 | 10 / 4 | Scrub-jay |

The room holds:
- **Charging cradle** for sleeping.
- **Wildlife monitor**: a green-screen display of populations, trends, needs, sightings, zone health and totals.
- **Corkboard**: photos and postcards, also pinned in miniature on the board itself.
- **Collection shelf**: little figures of every species that has come home.
- **Vases** of arranged sprigs (3 each).
- **Workbench** for upgrades.
- **Door** back outside.

## Opening
A wordless intro (skippable with ⏭):
1. Night sky, then a pod streaks down trailing fire.
2. It thumps into the sand in a puff of dust, and the door pops open.
3. The robot rolls out, looks left and right, and wonders ❓.
4. The camera glances at a smothered plant 🥀 nearby.
5. The robot perks up ❗💗, and morning begins.

## Sound
- **Fully synthesized** (Web Audio, `src/audio/`).
  - Audio starts on the first tap (a browser requirement) and pauses when the tab is hidden.
  - The game remembers the player's music and effects settings.
- **Music:** generative.
  - Each theme is a chord loop with an improvised pentatonic melody that breathes every fourth bar.
  - `scrub`: D major, guitar-like plucks, a soft shaker, little bird-like grace notes.
  - `home`: F major, music box.
  - `intro`: spacious and hopeful.
  - Themes crossfade between scenes, and the music rests at night with a lullaby.
- **Ambience:**
  - Outdoors: cicada swells (fading as the battery runs down), crickets (rising at dusk), wind, and occasional cardinals, mourning doves, eastern towhees and woodpeckers.
  - Indoors: muffled, with bubbling jars.
- **Voices:**
  - The robot bleeps by mood: happy, love, sad, surprise, proud, question, curious, yawn, wake.
  - Each animal has a stylized call. Calls are panned and attenuated by distance, and play on sightings, thought bubbles, scans, greetings and captures.
  - Invasive critters occasionally make themselves heard from the brush.
- **Effects:** every action has its own sound, as do rescues, gains, photos, discoveries, the morning card, upgrades and room expansions. The robot's motor hum follows its speed.
- `npm run audio` renders everything offline in a real browser to check levels and write WAV previews.

## Tech
- Phaser 3 and TypeScript, built with Vite.
- Game logic is pure TS in `src/systems` and unit-tested, including a scripted full playthrough.
- The HUD, radial menu and cards are DOM, so they stay crisp and accessible (aria labels on icon buttons).
- Rendering is at device pixel ratio (capped at 2×), with art generated at 2×.
- Saves go to localStorage and are versioned with migrations (v1 → v2 adds the home, populations and collections).

## Next up
- Real painted art in the Wild Robot spirit, animation, ambient audio and music.
- A **prescribed burn** mechanic to replace trimming thickets.
- More zones (pond edge, flatwoods), seasons and weather.
- Native wildflowers and pollinators; scrub lizards and native green anoles returning.
- More collectibles for the shelf (found trinkets) and decorations from milestones.
- Installable PWA with offline play.
