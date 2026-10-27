# Scrub Bot — Game Design (MVP)

## Pitch
You are a little Wall-E-like robot waking up in an abandoned Florida scrub. You can't fix it all at once, but day by day you clear what doesn't belong, grow back what does, and learn about each plant and animal along the way. The game is cozy, has no failure state, and is suitable for all ages.

## Pillars
- **Cozy, never punishing.** No death and no timers that hurt you. An empty battery just slows you down until you're home.
- **Learning through doing.** The first time you meet anything, you scan it, and it becomes a field guide card with short, true facts.
- **Ecology as mechanics.** Wildlife returns because of real relationships: the tortoise needs an open, unfenced sandy area; mice live in tortoise burrows; jays need low oaks and no cats; indigo snakes need burrows and no tegus.
- **Gentle stewardship.** Invasive animals are crated and relocated humanely, never harmed. Cats get adopted.

## Core loop (one day = one battery)
Wake → explore & restore → rescue natives & collect seeds → sow/water at the nursery → plant out → recycle & drop off → sleep → overnight results (morning card).

## Systems

| System | Rules (tuning lives in `src/config.ts`) |
| --- | --- |
| Battery | Starts at 100. Actions cost 1–5 and driving drains slowly. At 0 the robot crawls at low speed. Recycling 4 parts gives +25 max battery, up to 3 times. |
| Scanning | The first interaction with any unscanned species is a Scan (1 🔋) that unlocks its field guide card. |
| Invasive plants | Cogon (pull; **spreads nightly**), Brazilian pepper (cut ×3, blocks movement), air potato (pull; its bulbils go in your bag), natal grass (pull). |
| Hazards | Tires and bottles go in the bag (6 slots). Fences (×2) block movement and keep tortoises out. Overgrown thickets (trim ×2) stand in for missing fire. |
| Natives | A native is *choked* while any invasive is within 2 tiles. Once freed, it is *rescued*, and every day it gives seeds: palmetto berries, rosemary seeds, acorns, or hickory nuts. |
| Nursery | 4 trays. Sow → water daily → after 2 watered nights → pot up a seedling. Unwatered trays don't grow. |
| Planting | With a seedling in hand, face an empty, non-base tile and press Plant. Seedlings go to their favourite zone first. A planted native boosts zone health. |
| Invasive animals | Feral cat, Argentine tegu and green iguana go in the crate (one at a time; it slows you down). Brown anoles go in a jar (5 slots). Drop them off at the pad; they're picked up overnight and you receive postcards. |
| Zone health | `good / (good + bad)`. Natives, burrows and wildlife count as good. Invasives, hazards and invasive animals count as bad. |
| Night | Pickups → nursery growth → cogon spreads (≤4 new patches) → tortoise digs burrows → return checks → recharge → save. |

### Wildlife return conditions
| Species | Condition |
| --- | --- |
| Gopher tortoise | Sand Scrub health ≥ 65% and no fences left. It digs a burrow, and later more (up to 3). |
| Florida mouse | The tortoise is back and a burrow exists. It arrives the next night. |
| Eastern indigo snake | 2+ burrows and no tegus on the map. |
| Florida scrub-jay | Oak Scrub health ≥ 60%, 6+ healthy oaks (more than the map starts with, so you must plant some), no thickets in the Oak Scrub, and no feral cats. |

The game is "won" when all four have returned. Play continues afterward.

## Map
The map is 56×44 tiles of 32 px. Home Base sits in a clearing at the bottom-middle and holds the charging dock, recycler, relocation pad and 4 nursery trays. Around it are three zones with organic borders:
- **Sand Scrub** (west): cogon, natal grass, an old fence line, palmettos and hickories.
- **Oak Scrub** (north): pepper, air potato, thickets and oaks.
- **Rosemary Bald** (east): white sand, natal grass and Florida rosemary.

## Controls
- **Touch:** a floating joystick (drag anywhere) plus one large context button. The button's label always says what it will do, and a hint explains why when it can't.
- **Keyboard:** WASD/arrows, Space/E, and G for the guide.

## Tech
- Phaser 3 and TypeScript, built with Vite.
- Game logic is in pure TS (`src/systems`) and unit-tested, including a scripted full playthrough.
- The HUD and cards are DOM, which keeps text crisp and buttons accessible.
- Rendering is at device pixel ratio (capped at 2×), and all art is generated at 2×.
- Saves go to localStorage and are versioned, with a migration hook.

## Next up (post-MVP)
- Wild Robot-inspired painted art, animation, ambient audio and music.
- A **prescribed burn** mechanic: schedule safe burns that renew the scrub, which replaces trimming thickets.
- More zones (pond edge, flatwoods), seasons, and weather.
- Native wildflowers and pollinators; scrub lizards and the native green anole returning once the brown anoles are gone.
- An NPC ranger or companion, plus collectible postcards in an album.
- Installable PWA with offline play.
