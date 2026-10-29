# Scrub Bot — Game Design

## Pitch
A small, round robot drops by pod into a neglected patch of Florida scrub to be its new caretaker. Through curiosity, expressive reactions, and short readable tool labels, the robot works out what doesn't belong, grows back what does, and turns its landed pod into a cozy home full of seedlings, sprigs and keepsakes. Meanwhile, the wildlife slowly comes back. Seasons turn, summer storms spark fires that may renew the scrub or need holding back, and the world beyond the edge keeps sending new seeds, pets and litter: caring for a wild place is never finished. The game is cozy, has no failure state, and is suitable for all ages.

## Pillars
- **Show, then explain just enough.** Pictures, icons, animation and the robot's reactions carry the mood. Short text explains tools, costs, plant care and habitat needs; the field guide keeps written natural-history facts.
- **Learning through doing.** The first time you meet anything, you scan it, and the field guide fills in.
- **Ecology as mechanics.** Wildlife arrives, grows and dips according to real relationships: tortoises need open, unfenced sand; mice live in tortoise burrows; jays need low oaks and no cats; indigo snakes need burrows and no tegus.
- **Gentle stewardship.** Invasive animals are crated and relocated, never harmed. Cats get adopted.
- **A home that grows with you.** In the spirit of Wall-E's collection and Animal Crossing's house, the pod fills up with things you've grown and found, and it expands as the scrub recovers.
- **Fire is part of the scrub.** Fire renews overdue scrub and harms ground that burned only days ago. The player reads each area's burn history to decide whether to contain a fire or let it burn.
- **Never quite done.** Seasons repeat, fuel builds back up, and invaders keep arriving from the edges. There is always a next small job, and always a next level.

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
Wake in the cradle → read the morning card (weather, forecast, arrivals, fire report, today's three goals) → tend hydroponics → head out → scan, clear, rescue, collect seeds and sprigs, crate invaders, decide about fires, play the close-up activities → recycle (or sort) and drop off → come home, arrange vases, check the monitor and spend parts → sleep.

Over weeks: seasons cycle (spring, summer, fall, winter), each zone's fuel builds back up after a fire, overdue scrub closes in with thickets, edge pressure slowly rises, and stewardship levels unlock new tools.

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
| Home upgrades (workbench) | 🔋 +25 battery (4 ⚙️, ×3); 🌱 +2 jars (3 ⚙️); 🏺 +1 vase (2 ⚙️); 🏡 room expansion (6 ⚙️); 🪣 +2 water tank (3 ⚙️, ×3). Expansion 1 needs the tortoise and expansion 2 needs the scrub-jay. Jars and vases are capped by room size. |
| Night | Pad pickups → hydroponics → remaining fires burn out → wildlife responds to the evening's scrub (burrows, populations) → rain soaks young plantings → day advances → seedbank sprouts (rosemary after fire, stubborn roots) → cogon spreads → arrivals from the edge → overgrowth in overdue scrub → new weather → recharge → three new goals → save. |
| Seasons | 7 days each: spring (dry, fires run), summer (wet season: storms and lightning, faster cogon), fall (acorn crop: oaks give +2 seeds; rare hurricanes), winter (calm burn weather, cold snaps). Years repeat forever. |
| Weather | Rolled from the save's seed per day, so it is stable and forecastable. Clear, breezy (wind pushes fire and seeds), hot and dry (+30% driving drain, fierce fire), rain (damps fire; young plantings grow a day faster), thunderstorm (2–3 lightning strikes; litter blows in), hurricane (lots of litter and seeds), fog (spot wildlife from farther), cold snap (iguanas go stiff: capture costs 2). |
| Fire | Every tile remembers the day it last burned. Fuel builds back over ~24 days; bare-sand gaps and recently burned ground act as firebreaks. A flame catches neighbors based on fuel × weather × wind. Ground burned 20+ days ago is renewed (thickets clear, invasives burn but may resprout from roots, oaks/hickories/palmettos resprout, palmettos bloom with double berries, rosemary dies but reseeds). Ground burned under 8 days ago is harmed: its young plants are lost. Burrows shelter wildlife. Overdue ground (40+ days) counts against zone health and grows new thickets. |
| Containment | Tap a flame: **Contain the fire** (the fire-line close-up, using the water tank and raked firebreaks), **Let it burn**, or read the guide. The tank holds 6 (+3 at level 6 and 10, +2 per workbench upgrade) and refills overnight. |
| Prescribed burns | With the drip torch (level 4): only on ground ready for fire and on calm days (clear, fog or cold). |
| The edges | Each night, 0.8 + 0.04×day newcomers (max 3.5, plus storms) try to settle near the map edge: cogon, natal grass, pepper and air potato by zone; anoles, cats, tegus and iguanas now and then; litter after storms. Healthy natives within 2 tiles stop 65% of plant arrivals. Soft caps keep a neglected scrub bounded. |
| Levels | Care points for everything: clearing, rescues, planting, captures, scans, mini-game stars, renewal by fire, wildlife growth (+5) and arrivals (+25), and goals (+10 each, +15 for all three). Level 2 camera, 3 rhizome probe, 4 drip torch, 5 burrow scope, 6–10 perks (tank, seed pouch, battery, sharp eyes, rain barrel), then +3 parts every level forever. |
| Goals | Three small goals each morning, chosen from what is relevant today (clear, litter, capture, seeds, water, sow, plant, greet, portrait, dig, scope, sort, thicket, prescribed burn). Each pays 1–3 parts; finishing all three pays 2 more. |

### Wildlife
| Species | Arrives when | Grows toward | Thought-bubble worries |
| --- | --- | --- | --- |
| Gopher tortoise | Sand Scrub ≥ 65% and no fences there | Up to 6, rising with Sand Scrub health | Fence, the worst problem in the Sand Scrub, tegus |
| Florida mouse | A night after the first burrow | 2 per burrow | Burrows, cats |
| Eastern indigo snake | 2+ burrows and no tegus | 1 per 2 burrows | Burrows, tegus |
| Florida scrub-jay | Oak Scrub ≥ 60%, 6+ healthy oaks (so you must plant some), no thickets in the Oak Scrub, no cats | 1 family per 3 oaks | The worst problem in the Oak Scrub, oaks, thickets, cats |

Each night, a species' population grows by 1 if all its needs are met and it's below what the habitat can support. It drops by 1 if any need is unmet, but never below 1. Recently burned, open ground raises capacity: tortoises (Sand Scrub) and scrub-jays (Oak Scrub) can each support one more when 20% of their zone burned in the last 20 days. The wildlife monitor graphs populations over time and pictures each species' unmet needs. Before a species arrives, the monitor and the guide show its arrival needs as hints. The scrub counts as restored when all four species are home; play continues afterward, with new arrivals from the edges, overdue scrub and fire seasons to manage.

## Mini-games
Close-up activities share one layout (play area plus notebook), work with touch, mouse and keyboard, and can be left at any time.

| Activity | Where | How it plays | Outcome |
| --- | --- | --- | --- |
| Vine care | Air potato on a native | Safe snips, drag 3 bulbils to the bag, pull downward | Frees the host; +1 part if no branch was brushed |
| Hold the line | Tap a flame → Contain | A 9×9 close-up of the real ground: the fire keeps spreading every second. Tap flames to spray (water tank), tap dry ground to rake firebreaks (1 energy each) | Stars for protecting natives; the world keeps whatever happened |
| Portrait | Native animal (camera, level 2) | Drag the viewfinder to frame the animal, wait for the lens to focus, catch a signature pose (tortoise munching, mouse sitting up, jay on sentinel watch, indigo raising its head). 3 shots | Best stars per species on the corkboard; first 3-star portrait: +2 parts |
| Roots and all | Cogon (rhizome probe, level 3) | Trace every pale runner outward from the clump to each green shoot within 50 s; runners only count when connected to the clump | Complete: the clump and joined cogon (up to 7) lifted with no resprouting. Partial: clump lifted, runners may resprout |
| Burrow scope | Burrow (level 5, once a day each) | Lower a light down the tunnel; tap neighbors in the light before shy ones scoot deeper | Gopher frog, scarab beetle and camel cricket join the guide (+1 part each) |
| Sort it out | Recycler, 2+ items | Items ride a belt; drag or tap each into glass, metal, plastic, rubber or the sealed bag (bulbils and foil balloons) | All items recycle; +1 part per 2 sorted right, +1 for a perfect sort |

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

## Look of the weather
Seasons tint the light (spring blush, summer gold, fall amber, winter blue) and fill the wind with petals, cogon fluff or oak leaves. Rain leans with the wind and leaves puddles; storms darken the sky and flash with lightning; fog drifts in banks; cold snaps frost the air; summer and spring dusks bring fireflies. Grass and shrubs sway with the wind. Fires flicker with a ground glow, drift smoke downwind, and leave scorched earth that fades over about 12 days, while burned natives show green resprouts. A little flame at the screen edge points to off-screen fires.

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
- **Weather and fire:** rain hiss, wind that follows the day's wind speed, insects that hush in rain and cold, thunder delayed and panned by distance, and a fire roar with crackles that grows as the robot gets close.
- **Effects:** every action has its own sound, as do rescues, gains, photos, discoveries, the morning card, upgrades and room expansions, spraying, raking, igniting, the camera shutter, digging, sorting, goals and level-ups (and the gopher frog's snore). The robot's motor hum follows its speed.
- `npm run audio` renders everything offline in a real browser to check levels and write WAV previews.

## Tech
- Phaser 3 and TypeScript, built with Vite.
- Game logic is pure TS in `src/systems` and unit-tested, including a scripted full playthrough.
- The HUD, radial menu and cards are DOM, so they stay crisp and accessible (aria labels on icon buttons).
- Rendering is at device pixel ratio (capped at 3×, or 2× on devices reporting under 4 GB of memory); the world ground is painted at 2×.
- Saves go to localStorage and are versioned with migrations (v1 → v2 adds the home, populations and collections; v2 → v3 adds weather, per-tile burn history, fires, the seedbank, levels, goals, portraits, burrow guests and bag contents, crediting earlier progress as care points).

## Next up
- Optional art polish from [ART_ASSET_BRIEF_2.md](ART_ASSET_BRIEF_2.md): extra wildfire frames, burnt plants and robot tool poses.
- More zones (pond edge, flatwoods) and a gopher frog breeding pond.
- Native wildflowers and pollinators; scrub lizards and native green anoles returning once brown anoles are scarce.
- More collectibles for the shelf (found trinkets) and decorations from milestones and levels.
- Installable PWA with offline play.
