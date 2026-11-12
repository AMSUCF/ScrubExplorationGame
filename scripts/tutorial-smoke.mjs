// End-to-end tutorial: start a new game with the tutorial and follow every step with real taps on a
// phone, checking the coach highlights the right button each time. Then desktop and landscape layouts,
// tucking the coach away, skipping and resuming it, reloading mid-way, and the pause menu's fresh start.
// Usage: npm run build && npm run tutorial:smoke
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { preview } from 'vite';

const { chromium } = createRequire(import.meta.url)('playwright');
const PORT = 4177;
/** `--layouts-only` runs just the landscape and small-phone checks (quick, for layout work). */
const LAYOUTS_ONLY = process.argv.includes('--layouts-only');
const URL = `http://localhost:${PORT}/?debug`;
mkdirSync('screenshots', { recursive: true });
const server = await preview({ preview: { port: PORT, strictPort: true }, logLevel: 'warn' });
const browser = await chromium.launch();
const errors = [];
/** What the driver did, with times, printed if something fails. */
const timeline = [];
const T0 = Date.now();
const mark = (what) => { timeline.push(`${((Date.now() - T0) / 1000).toFixed(1)}s ${what}`); if (timeline.length > 40) timeline.shift(); };

/** Helpers bound to one page. */
function drive(page) {
  const activeKey = () => page.evaluate(() => ['World', 'Home'].find((k) => window.__game.scene.isActive(k)) ?? null);
  const scene = async (src, arg) => {
    const key = await activeKey();
    return page.evaluate(([k, s, a]) => new Function('w', 'a', s)(window.__game.scene.getScene(k), a), [key, src, arg]);
  };
  const active = (key) => page.waitForFunction((k) => window.__game?.scene.isActive(k), key, { timeout: 30000 });
  const step = () => scene('return window.__systems.currentStepId(w.state)');
  const waitStep = (id, timeout = 15000) =>
    mark(`wait for step ${id}`) ?? page.waitForFunction((id) => {
      const g = window.__game, k = ['World', 'Home'].find((k) => g.scene.isActive(k));
      return k && window.__systems.currentStepId(g.scene.getScene(k).state) === id;
    }, id, { timeout });
  /** Where the coach's hand points, in CSS px on screen (null if nothing). */
  const handSpot = () => scene(`
    const g = window.__systems.guidance(w.state, { robot: { x: w.robot.x, y: w.robot.y } });
    const p = g && g.pointer && w.pointerSpot(g.pointer);
    if (!p) return null;
    const c = w.cameras.main, d = w.registry.get('dpr');
    return { wx: p.x, wy: p.y, x: (p.x - c.worldView.x) * c.zoom / d, y: (p.y - c.worldView.y) * c.zoom / d };`);
  /** Drive close when the target is off screen or tucked under the HUD, as a player would. */
  const ensureVisible = async () => {
    const p = await handSpot();
    assert(p, 'the coach is not pointing at anything');
    const inset = await page.evaluate(() => window.__game && document.querySelector('.coach') ? Math.max(...['.topbar', '.inventory', '.coach'].map((s) => document.querySelector(s)?.getBoundingClientRect().bottom ?? 0)) : 0);
    const vp = page.viewportSize();
    if (p.x < 30 || p.x > vp.width - 30 || p.y < inset + 20 || p.y > vp.height - 60) {
      // Hop onto a walkable tile just below the target (smoke tests skip the long drives).
      await scene(`
        const g = w.grid(), tx = Math.floor(a.wx / 32), ty = Math.floor(a.wy / 32);
        for (const [dx, dy] of [[0, 2], [1, 2], [-1, 2], [0, 3], [2, 2], [-2, 2], [1, 1], [-1, 1], [0, 1], [2, 3], [-2, 3]]) {
          if (!g.blocked(tx + dx, ty + dy)) { w.robot.stop(); w.robot.setPosition((tx + dx) * 32 + 16, (ty + dy) * 32 + 16); return; }
        }`, p);
      await page.waitForTimeout(900);
    }
    return handSpot();
  };
  const dock = page.locator('.action-dock:not([hidden])');
  /** Headless frames are slow, so wait for the camera to stop gliding before aiming a tap. */
  const settle = async () => {
    let last = '';
    for (let i = 0; i < 40; i++) {
      const v = await scene('const c = w.cameras.main; return `${Math.round(c.worldView.x)},${Math.round(c.worldView.y)}`');
      if (v === last) return;
      last = v;
      await page.waitForTimeout(120);
    }
  };
  /** Tap what the coach points at, and check the tray that opens is for that very thing. */
  const tapHand = async () => {
    mark('tap hand');
    for (let attempt = 0; attempt < 4; attempt++) {
      // A new level's card can arrive at any time (raw taps don't trigger the locator handler). Close it
      // inside the page: a Playwright click would race that handler for the same button.
      while (await page.evaluate(() => { const b = document.querySelector('.overlay.levelup.in [data-close]'); b?.click(); return !!b; })) {
        await page.waitForTimeout(250);
      }
      if (await dock.count()) {
        await dock.locator('[data-close-action]').dispatchEvent('pointerdown');
        await page.waitForTimeout(150);
      }
      await ensureVisible();
      await settle();
      const p = await handSpot();
      await page.touchscreen.tap(p.x, p.y);
      await page.waitForTimeout(150);
      const ok = await scene(`
        const g = window.__systems.guidance(w.state, { robot: { x: w.robot.x, y: w.robot.y } });
        return !g || !g.pointer || g.pointer.kind === 'point' || w.isMenuTarget(g.pointer);`);
      if (ok) return;
    }
    throw new Error('could not tap what the coach points at');
  };
  const verb = async (v, glow = true) => {
    mark(`verb ${v}`);
    const b = dock.locator(`.rbtn[data-verb="${v}"]`);
    await b.waitFor({ timeout: 8000 });
    // The coach re-highlights a few times a second of game time; headless frames can stall for seconds.
    if (glow) await page.waitForFunction((v) => document.querySelector(`.action-dock .rbtn[data-verb="${v}"]`)?.classList.contains('tut-glow'), v, { timeout: 8000 });
    await b.dispatchEvent('pointerdown');
  };
  const closeCard = async (cls) => {
    mark(`close ${cls}`);
    await page.locator(`.overlay.${cls}.in [data-close]`).first().click({ timeout: 8000 });
    await page.waitForFunction((c) => !document.querySelector(`.overlay.${c}`), cls);
  };
  /** Tap what the coach points at; scan it first if it's new; then do the verb. */
  const actOnHand = async (v) => {
    await tapHand();
    await dock.waitFor({ timeout: 8000 });
    if (await dock.locator('.rbtn[data-verb="scan"]').count()) {
      await verb('scan');
      await closeCard('discovery');
    }
    await verb(v);
  };
  /** Wait for the robot to finish: done walking over, and done with the action (slow headless frames). */
  const idle = () =>
    page.waitForFunction(() => {
      const g = window.__game, k = ['World', 'Home'].find((k) => g.scene.isActive(k));
      const w = k && g.scene.getScene(k);
      return w && !w.busy && !w.robot.busy;
    }, null, { timeout: 25000 });
  const coachTitle = () => page.locator('.coach:not([hidden]) .coach-title').textContent({ timeout: 8000 });
  const glowing = (sel) => page.waitForFunction((s) => document.querySelector(s)?.classList.contains('tut-glow'), sel, { timeout: 8000 });
  const shot = (name) => page.screenshot({ path: `screenshots/${name}.png` });
  const startTutorialGame = async () => {
    await page.goto(URL);
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    await page.locator('.overlay.begin.in').waitFor();
    await page.getByRole('button', { name: 'Start with the tutorial', exact: true }).click();
    await active('Intro');
    await page.getByRole('button', { name: 'Skip intro' }).click();
    await active('World');
    await page.locator('.coach:not([hidden]) .coach-title').waitFor();
    await page.waitForTimeout(500);
  };
  return { activeKey, scene, active, step, waitStep, handSpot, tapHand, verb, closeCard, actOnHand, idle, coachTitle, glowing, shot, dock, startTutorialGame };
}

/** Big canvases render slowly in headless software GL, so the desktop run uses 1× pixels. */
async function newPage(viewport, { touch = true, scale = 2 } = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: scale, hasTouch: touch, isMobile: touch });
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  // The page notes each change to the action tray, for the failure report.
  await page.addInitScript(() => {
    window.__trayLog = [];
    const t0 = Date.now();
    new MutationObserver(() => {
      const d = document.querySelector('.action-dock');
      const now = d && !d.hidden ? [...d.querySelectorAll('.rbtn')].map((b) => b.dataset.verb).join(',') : 'closed';
      const log = window.__trayLog;
      if (log[log.length - 1]?.endsWith(now)) return;
      log.push(`${((Date.now() - t0) / 1000).toFixed(1)}s tray ${now}`);
      if (log.length > 30) log.shift();
      // The document itself (not documentElement, which doesn't exist yet when init scripts run).
    }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden'] });
  });
  // New stewardship levels arrive mid-tutorial (the camera at level 2); accept them as a player would.
  await page.addLocatorHandler(page.locator('.overlay.levelup.in'), async () => {
    await page.locator('.overlay.levelup.in [data-close]').click();
  });
  return page;
}

let page;
try {
  if (!LAYOUTS_ONLY) {
  // --- The whole tutorial on a phone -------------------------------------------------------
  page = await newPage({ width: 390, height: 844 });
  const t = drive(page);
  await page.goto(URL);
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.locator('.overlay.begin.in').waitFor();
  await page.waitForTimeout(250);
  await t.shot('tutorial-01-begin');
  // Back returns to the title; the choice is offered again.
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.getByRole('button', { name: 'Start with the tutorial', exact: true }).click();
  await t.active('Intro');
  await page.getByRole('button', { name: 'Skip intro' }).click();
  await t.active('World');
  assert.equal(await t.coachTitle(), 'Roll around');
  assert.equal(await page.locator('.journey-hint').isVisible(), false, 'the old journey hint should give way to the coach');
  await page.waitForTimeout(500);
  await t.shot('tutorial-02-move');

  // Day 1: roll, scan, pull.
  await t.tapHand();
  await t.waitStep('scan');
  await page.waitForTimeout(150);
  await t.shot('tutorial-03-cheer');
  await page.waitForTimeout(1400);
  assert.equal(await t.coachTitle(), 'Scan something new');
  await t.shot('tutorial-04-scan');
  await t.tapHand();
  await t.verb('scan');
  await page.waitForTimeout(150);
  await t.closeCard('discovery');
  await t.waitStep('pull');
  await page.waitForTimeout(400);
  await t.shot('tutorial-05-pull');
  for (let i = 0; i < 8 && (await t.step()) === 'pull'; i++) {
    await t.actOnHand('remove');
    // Let the robot drive over and finish pulling before the next try (a new tap would cancel it).
    await page.waitForTimeout(300);
    await t.idle();
  }
  await t.waitStep('seeds');

  // Rescue and gather: seeds, litter, the vine-covered oak, recycling.
  await page.waitForTimeout(1400);
  await t.actOnHand('collect');
  await t.waitStep('litter');
  await page.waitForTimeout(1400);
  await t.actOnHand('remove');
  await t.waitStep('vine');
  await page.waitForTimeout(1400);
  await t.shot('tutorial-06-vine');
  await t.actOnHand('rescue');
  await page.locator('.vine-care.in').waitFor();
  assert(await page.locator('.coach').evaluate((el) => el.hidden || getComputedStyle(el).visibility === 'hidden'), 'the coach should step back during the close-up');
  for (let i = 1; i <= 3; i++) await page.getByRole('button', { name: `Cut vine ${i}`, exact: true }).press('Enter');
  for (let i = 1; i <= 3; i++) await page.getByRole('button', { name: `Bag bulbil ${i}`, exact: true }).press('Enter');
  await page.getByRole('button', { name: 'Gently pull the vine free', exact: true }).press('Enter');
  await page.getByRole('button', { name: 'Back to the scrub', exact: true }).click();
  await t.waitStep('recycle');
  await page.waitForTimeout(1400);
  await t.shot('tutorial-07-recycle');
  await t.actOnHand('recycle');
  await t.waitStep('home');

  // Home sweet pod: sow and water, the monitor, sleep.
  await page.waitForTimeout(1400);
  await t.actOnHand('enter');
  await t.active('Home');
  await t.waitStep('sow');
  await page.waitForTimeout(1600);
  await t.glowing('.home-nav [data-home="nursery"]');
  await t.shot('tutorial-08-home');
  const room = await page.evaluate(() => {
    const w = window.__game.scene.getScene('Home'), c = w.cameras.main, d = w.registry.get('dpr');
    return { top: (0 - c.worldView.y) * c.zoom / d, coach: document.querySelector('.coach').getBoundingClientRect().bottom };
  });
  assert(room.top >= room.coach, `the room (top ${Math.round(room.top)}) is tucked under the coach (bottom ${Math.round(room.coach)})`);
  await page.getByRole('button', { name: 'Nursery', exact: true }).click();
  await t.glowing('.overlay.nursery [data-verb="sow"]');
  await t.shot('tutorial-09-nursery');
  await page.locator('.overlay.nursery [data-verb="sow"].tut-glow').first().click();
  await t.glowing('.overlay.nursery [data-verb="water"]');
  await page.locator('.overlay.nursery [data-verb="water"].tut-glow').first().click();
  await t.closeCard('nursery');
  await t.waitStep('monitor');
  await page.waitForTimeout(1400);
  await t.glowing('.home-nav [data-home="wildlife"]');
  await page.getByRole('button', { name: 'Wildlife', exact: true }).click();
  await t.closeCard('monitor');
  await t.waitStep('sleep');
  await page.waitForTimeout(1400);
  await t.glowing('.home-nav [data-home="rest"]');
  await t.shot('tutorial-10-sleep');
  await page.getByRole('button', { name: 'Rest', exact: true }).click();
  await t.verb('sleep');
  await page.getByRole('button', { name: 'Start the day' }).click({ timeout: 10000 });

  // Day 2: goals, water again, relocate an invader, the field guide, another night.
  await t.waitStep('goals');
  await page.waitForTimeout(1600);
  await t.glowing('.hud [data-tasks]');
  await t.shot('tutorial-11-goals');
  await page.locator('.hud [data-tasks]').click();
  await t.waitStep('water');
  await page.locator('.hud [data-tasks]').click();
  await page.waitForTimeout(1400);
  await page.getByRole('button', { name: 'Nursery', exact: true }).click();
  await page.locator('.overlay.nursery [data-verb="water"].tut-glow').first().click({ timeout: 8000 });
  await t.closeCard('nursery');
  await t.waitStep('capture');
  await page.waitForTimeout(1400);
  assert.match(await page.locator('.coach-text').textContent(), /door mat/, 'at home, the coach should send the robot outside first');
  await t.shot('tutorial-12-detour');
  await t.actOnHand('exit');
  await t.active('World');
  await page.waitForTimeout(900);
  await t.shot('tutorial-13-capture');
  // Headless frames are slow, so a wandering animal can keep stepping out of reach: hold them still.
  await t.scene('for (const v of w.views.values()) if (v.critter) v.critter.frozen = true');
  for (let i = 0; i < 8 && (await t.step()) === 'capture'; i++) {
    await t.actOnHand('capture');
    await page.waitForTimeout(300);
    await t.idle();
  }
  await t.waitStep('dropoff');
  await page.waitForTimeout(1400);
  await t.actOnHand('dropoff');
  await t.waitStep('guide');
  await page.waitForTimeout(1400);
  await t.glowing('.hud [data-hud="guide"]');
  await page.getByRole('button', { name: 'Field guide', exact: true }).click();
  await t.closeCard('guide');
  await t.waitStep('sleep2');
  await page.waitForTimeout(1400);
  await t.shot('tutorial-14-explore');
  await t.scene('w.goHome()');
  await t.active('Home');
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: 'Rest', exact: true }).click();
  await t.verb('sleep');
  await page.getByRole('button', { name: 'Start the day' }).click({ timeout: 10000 });

  // Day 3: pot up the seedling and plant it outside.
  await t.waitStep('pot');
  await page.waitForTimeout(1400);
  await page.getByRole('button', { name: 'Nursery', exact: true }).click();
  await page.locator('.overlay.nursery [data-verb="pot"].tut-glow').first().click({ timeout: 8000 });
  await t.closeCard('nursery');
  await t.waitStep('plant');
  await page.waitForTimeout(1400);
  await t.actOnHand('exit');
  await t.active('World');
  await page.waitForTimeout(900);
  assert.equal((await t.scene('return window.__systems.guidance(w.state, { robot: { x: w.robot.x, y: w.robot.y } }).pointer.kind')), 'point', 'from the clearing, the coach should point at open sand');
  await t.shot('tutorial-15-plant');
  await t.tapHand();
  await page.waitForFunction(() => {
    const w = window.__game.scene.getScene('World');
    return window.__systems.guidance(w.state, { robot: { x: w.robot.x, y: w.robot.y } })?.pointer?.kind === 'self';
  }, null, { timeout: 15000 });
  await page.waitForTimeout(1200);
  for (let i = 0; i < 6 && (await t.step()) === 'plant'; i++) {
    await t.tapHand();
    const plant = t.dock.locator('.rbtn[data-verb="plant"]');
    await plant.waitFor();
    if (await plant.evaluate((el) => el.classList.contains('off'))) {
      // Something is in the way: face a fresh patch of sand and try again.
      await t.scene('w.closeMenu(); w.robot.stop(); w.robot.setPosition(w.robot.x - 40, w.robot.y - 20)');
      await page.waitForTimeout(600);
      continue;
    }
    await t.verb('plant');
    await page.waitForTimeout(600);
  }
  await t.waitStep('finale');
  await page.waitForTimeout(1500);
  await t.shot('tutorial-16-finale');
  const parts = await t.scene('return w.state.parts');
  await page.locator('.coach-ack').click();
  await page.waitForFunction(() => window.__game.scene.getScene('World').state.tutorial?.done === true);
  assert.equal(await t.scene('return w.state.parts'), parts + 3, 'finishing the tutorial gives 3 parts');
  await page.waitForTimeout(400);
  assert.equal(await page.locator('.coach').isVisible(), false, 'the coach leaves when the tutorial is done');
  assert.match(await page.locator('.world-message').textContent(), /Tutorial complete/);
  await t.shot('tutorial-17-done');
  // The game saves a moment after each change.
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('scrubbot.save'))?.tutorial?.done === true, null, { timeout: 5000 });
  // Each leg closes its page: running games in the background slow the next one to a crawl.
  await page.context().close();

  // --- Desktop: layout, tucking away, skipping, resuming, reload, and a fresh start ---------
  const desk = await newPage({ width: 1280, height: 800 }, { touch: false, scale: 1 });
  const d = drive(desk);
  await d.startTutorialGame();
  assert.match(await desk.locator('.coach-text').textContent(), /Click the sand/, 'desktop players get click and key wording');
  await d.shot('tutorial-desktop-world');
  await desk.getByRole('button', { name: 'Tuck the tutorial tip away' }).click();
  await desk.locator('.coach-pill').waitFor();
  await d.shot('tutorial-desktop-tucked');
  await desk.locator('.coach-pill').click();
  await desk.locator('.coach-card').waitFor();
  // Reload mid-way: Continue picks the tutorial up where it was.
  await d.scene('window.__systems.noteTutorial(w.state, "move"); w.saveNow()');
  await d.waitStep('scan');
  await d.scene('w.saveNow()');
  await desk.reload();
  await desk.getByRole('button', { name: 'Continue', exact: true }).click();
  await d.active('World');
  assert.equal(await d.coachTitle(), 'Scan something new', 'Continue resumes the tutorial');
  // Inside the pod at desktop size, the room sits below the coach.
  await d.scene('w.goHome()');
  await d.active('Home');
  await desk.waitForTimeout(1200);
  await d.shot('tutorial-desktop-home-detour');
  await desk.locator('.coach-skip').click();
  assert.equal(await desk.locator('.coach-skip').textContent(), 'Really skip?');
  await desk.locator('.coach-skip').click();
  await desk.waitForFunction(() => document.querySelector('.coach').hidden);
  assert.equal(await d.scene('return w.state.tutorial.off'), true);
  // The pause menu brings the tips back.
  await desk.getByRole('button', { name: 'Menu', exact: true }).click();
  await desk.getByRole('button', { name: 'Tutorial tips', exact: true }).click();
  assert.equal(await desk.getByRole('button', { name: 'Tutorial tips', exact: true }).getAttribute('aria-pressed'), 'true');
  await d.shot('tutorial-desktop-pause');
  await desk.getByRole('button', { name: 'Resume', exact: true }).click();
  await desk.locator('.coach:not([hidden]) .coach-card').waitFor();
  // Start fresh from the pause menu asks again how to begin; Back keeps playing.
  await desk.getByRole('button', { name: 'Menu', exact: true }).click();
  await desk.getByRole('button', { name: 'New game', exact: true }).click();
  await desk.getByRole('button', { name: 'New game', exact: true }).click();
  await desk.locator('.overlay.begin.in').waitFor();
  await desk.getByRole('button', { name: 'Back', exact: true }).click();
  await desk.waitForTimeout(300);
  assert(await desk.evaluate(() => window.__game.scene.isActive('Home')), 'Back from a fresh start keeps the game');
  await desk.getByRole('button', { name: 'Menu', exact: true }).click();
  await desk.getByRole('button', { name: 'New game', exact: true }).click();
  await desk.getByRole('button', { name: 'New game', exact: true }).click();
  await desk.getByRole('button', { name: 'Start without the tutorial', exact: true }).click();
  await d.active('Intro');
  await desk.getByRole('button', { name: 'Skip intro' }).click();
  await d.active('World');
  await desk.waitForTimeout(600);
  assert.equal(await d.scene('return w.state.tutorial'), undefined, 'a game without the tutorial has none');
  assert.equal(await desk.locator('.coach').isVisible(), false);
  assert(await desk.locator('.journey-hint').isVisible(), 'without the tutorial, the gentle hints are back');
  await d.shot('tutorial-desktop-without');
  await desk.context().close();

  }
  // --- Landscape phone and a small phone: the coach fits around the HUD and tray --------------
  for (const [name, viewport] of [['landscape', { width: 844, height: 390 }], ['small-phone', { width: 320, height: 568 }]]) {
    const p = await newPage(viewport);
    const l = drive(p);
    await l.startTutorialGame();
    await l.shot(`tutorial-${name}-world`);
    const box = await p.locator('.coach').boundingBox();
    assert(box && box.x >= 0 && box.x + box.width <= viewport.width && box.y + box.height <= viewport.height, `${name}: coach is off screen`);
    await l.scene('window.__systems.noteTutorial(w.state, "move")');
    await l.waitStep('scan');
    await p.waitForTimeout(1500);
    await l.tapHand();
    await l.dock.waitFor();
    await p.waitForTimeout(300);
    const [dockBox, coachBox] = [await l.dock.boundingBox(), await p.locator('.coach').boundingBox()];
    assert(coachBox.y + coachBox.height <= dockBox.y + 2 || coachBox.x + coachBox.width <= dockBox.x + 2 || dockBox.x + dockBox.width <= coachBox.x + 2, `${name}: the coach overlaps the action tray`);
    await l.shot(`tutorial-${name}-tray`);
    await l.verb('scan');
    await l.closeCard('discovery');
    await l.scene('w.goHome()');
    await l.active('Home');
    await p.waitForTimeout(1200);
    await l.shot(`tutorial-${name}-home`);
    const home = await p.evaluate(() => {
      const w = window.__game.scene.getScene('Home'), c = w.cameras.main, dpr = w.registry.get('dpr');
      const r = (x, y) => ({ x: (x - c.worldView.x) * c.zoom / dpr, y: (y - c.worldView.y) * c.zoom / dpr });
      const a = r(0, 0), b = r(w.size.w * 32, w.size.h * 32);
      return { room: { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y }, coach: document.querySelector('.coach').getBoundingClientRect().toJSON() };
    });
    const o = home.room, c = home.coach;
    const overlap = Math.max(0, Math.min(o.x + o.w, c.right) - Math.max(o.x, c.left)) * Math.max(0, Math.min(o.y + o.h, c.bottom) - Math.max(o.y, c.top));
    assert(overlap < 0.04 * o.w * o.h, `${name}: the coach covers the room`);
    await p.context().close();
  }

  assert.deepEqual(errors, [], 'browser errors');
  console.log('TUTORIAL OK — every step followed with real taps, highlights checked, layouts on phone, desktop, landscape and small phone; screenshots in ./screenshots');
} catch (e) {
  let n = 0;
  for (const ctx of browser.contexts()) {
    for (const p of ctx.pages()) {
      await p.screenshot({ path: `screenshots/tutorial-FAIL-${++n}.png` }).catch(() => undefined);
      // What the game was doing, so a failure explains itself.
      const state = await p.evaluate(() => {
        const g = window.__game, k = ['World', 'Home'].find((k) => g?.scene.isActive(k));
        const w = k && g.scene.getScene(k);
        return {
          scene: k, step: w && window.__systems.currentStepId(w.state), busy: w?.busy, walking: w?.robot.busy,
          robot: w && [Math.round(w.robot.x), Math.round(w.robot.y)], battery: w && Math.round(w.state.battery),
          menu: w?.menuTarget?.target.type, overlays: [...document.querySelectorAll('.overlay')].map((o) => o.className),
          tray: [...document.querySelectorAll('.action-dock:not([hidden]) .rbtn')].map((b) => `${b.dataset.verb}${b.classList.contains('off') ? ' (off)' : ''}${b.classList.contains('tut-glow') ? ' *' : ''}`),
          coach: document.querySelector('.coach-title')?.textContent,
        };
      }).catch((err) => `unavailable: ${err.message}`);
      console.error(`state (page ${n}):`, JSON.stringify(state));
      console.error(`tray (page ${n}):`, (await p.evaluate(() => window.__trayLog).catch(() => [])).slice(-12).join(' | '));
    }
  }
  console.error('driver:', timeline.slice(-14).join(' | '));
  throw e;
} finally {
  await browser.close();
  await server.close();
}
