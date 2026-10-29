// Seasons, weather, fire and mini-games on a phone, with screenshots. Usage: npm run build && npm run seasons:smoke
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { preview } from 'vite';

const { chromium } = createRequire(import.meta.url)('playwright');
const PORT = 4178;
mkdirSync('screenshots', { recursive: true });
const server = await preview({ preview: { port: PORT, strictPort: true }, logLevel: 'warn' });
let browser;
try {
  browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.setDefaultTimeout(15000);
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const shot = (name) => page.screenshot({ path: `screenshots/seasons-${name}.png` });
  /** Run a function against the World scene (and the exposed systems). */
  const world = (src, arg) => page.evaluate(([s, a]) => new Function('w', 'sys', 'a', s)(window.__game.scene.getScene('World'), window.__systems, a), [src, arg]);
  /** Put the robot beside a thing and open its tray. */
  const openOn = (pred) => world(`
    const it = w.interactables().find(i => (${pred})(i));
    if (!it) throw new Error('no target');
    w.robot.setPosition(it.x, it.y + 20);
    w.openMenu(it);`);
  const action = (label) => page.getByRole('button', { name: label, exact: true });

  await page.goto(`http://localhost:${PORT}/?debug`);
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.getByRole('button', { name: 'Skip intro' }).click();
  await page.waitForFunction(() => window.__game.scene.isActive('World'));
  await page.waitForTimeout(600);
  const hud = await page.locator('.status').innerText();
  assert.match(hud, /Day 1/);
  assert.match(hud, /Lv 1/);
  await shot('1-hud');

  // A summer thunderstorm: rain, gloom, and a lightning strike that starts a fire in ready scrub.
  await world(`
    w.state.day = 9;
    w.state.weather = { kind: 'storm', wind: { x: 1, y: 0.3 }, windSpeed: 0.7, strikes: 1 };
    w.state.burned = w.state.burned.map(() => w.state.day - 30);
    w.scene.restart({ state: w.state });`);
  await page.waitForFunction(() => window.__game.scene.isActive('World') && window.__game.scene.getScene('World').weatherFx);
  await page.waitForTimeout(900);
  await shot('2-storm');
  await world(`w.nextStrike = 1; w.fireRng = () => 0.01;`);
  await page.waitForFunction(() => window.__game.scene.getScene('World').state.fires.length > 0, null, { timeout: 8000 }).catch(() => undefined);
  // Lightning picks its own spot; make sure there is a fire near the robot for the next steps.
  await world(`
    const t = { tx: Math.floor(w.robot.x / 32) + 3, ty: Math.floor(w.robot.y / 32) - 4 };
    for (const [dx, dy] of [[0,0],[1,0],[0,1],[-1,0]]) sys.ignite(w.state, t.tx + dx, t.ty + dy) || w.state.entities.push({ id: w.state.nextId++, kind: 'invasivePlant', species: 'cogon', tx: t.tx + dx, ty: t.ty + dy, hp: 1 });
    for (const [dx, dy] of [[0,0],[1,0],[0,1],[-1,0]]) sys.ignite(w.state, t.tx + dx, t.ty + dy);
    w.refreshViews();`);
  // The first fire opens its field guide page.
  const guide = page.getByRole('button', { name: 'Close' });
  if (await guide.isVisible().catch(() => false)) await guide.click();
  await page.waitForTimeout(700);
  await shot('3-fire');
  assert((await world('return w.state.fires.length')) > 0, 'a fire should be burning');

  // Contain it in the fire-line close-up: spray flames until the patch is out.
  await openOn(`i => i.target.type === 'fire'`);
  await action('Contain the fire').click();
  await page.locator('.mg-fireline.in').waitFor();
  await page.waitForTimeout(300);
  await shot('4-fireline');
  for (let i = 0; i < 25; i++) {
    const flame = page.locator('.fl-cell.burning').first();
    if (!(await flame.count())) break;
    await flame.click();
    await page.waitForTimeout(120);
  }
  await shot('5-fireline-done');
  await page.locator('[data-leave]').click();
  await page.waitForTimeout(400);

  // Level up to unlock the tools, then try each mini-game.
  await world(`sys.addXp(w.state, sys.xpForLevel(5) - w.state.xp); w.state.populations.tortoise = 1; w.state.weather = { kind: 'clear', wind: { x: 1, y: 0 }, windSpeed: 0.1, strikes: 0 }; w.state.fires = []; w.refreshViews();`);
  assert.equal(await world('return w.state.level'), 5);

  // Portrait of a scrub-jay.
  await world(`
    w.state.scanned.push('jay');
    w.state.entities.push({ id: w.state.nextId++, kind: 'nativeAnimal', species: 'jay', x: w.robot.x + 40, y: w.robot.y, home: 'oak' });
    w.refreshViews();`);
  await openOn(`i => i.target.type === 'entity' && i.target.entity.species === 'jay'`);
  await action('Take a portrait').click();
  await page.locator('.mg-portrait.in').waitFor();
  await page.waitForTimeout(800);
  await shot('6-portrait');
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: 'Take the photo' }).click();
    await page.waitForTimeout(450);
  }
  await shot('7-portrait-prints');
  await page.locator('.pt-done').click();
  await page.waitForTimeout(400);

  // Dig out a cogon clump, roots and all (keyboard tracing).
  await world(`
    w.state.scanned.push('cogon');
    const t = { tx: Math.floor(w.robot.x / 32) - 3, ty: Math.floor(w.robot.y / 32) - 3 };
    w.state.entities.push({ id: w.state.nextId++, kind: 'invasivePlant', species: 'cogon', tx: t.tx, ty: t.ty, hp: 1 });
    w.refreshViews();`);
  await openOn(`i => i.target.type === 'entity' && i.target.entity.species === 'cogon' && Math.hypot(i.x - w.robot.x, i.y - w.robot.y) < 200`);
  await action('Dig out roots').click();
  await page.locator('.mg-rhizome.in').waitFor();
  await page.waitForTimeout(300);
  await shot('8-rhizome');
  await page.locator('.rz-canvas').focus();
  for (let i = 0; i < 40 && (await page.locator('.rz-done').isHidden()); i++) await page.keyboard.press('Enter');
  await shot('9-rhizome-done');
  await page.locator('.rz-done').click();
  await page.waitForTimeout(400);

  // Peek into a burrow.
  await world(`
    const t = { tx: Math.floor(w.robot.x / 32) + 2, ty: Math.floor(w.robot.y / 32) + 2 };
    w.state.entities.push({ id: w.state.nextId++, kind: 'burrow', tx: t.tx, ty: t.ty });
    w.refreshViews();`);
  await openOn(`i => i.target.type === 'entity' && i.target.entity.kind === 'burrow'`);
  await action('Burrow scope').click();
  await page.locator('.mg-scope.in').waitFor();
  await page.locator('.bs-depth input').fill('55');
  await page.waitForTimeout(400);
  await shot('10-scope');
  await page.locator('.bs-done').click();
  await page.waitForTimeout(400);

  // Sort a bag of litter at the recycler.
  await world(`w.state.bag = 4; w.state.bagItems = ['bottle', 'can', 'plastic', 'bulbil'];`);
  await openOn(`i => i.target.type === 'station' && i.target.station.kind === 'recycler'`);
  await action('Sort for a bonus').click();
  await page.locator('.mg-sort.in').waitFor();
  await page.waitForTimeout(300);
  await shot('11-sort');
  for (const bin of ['Glass', 'Metal', 'Plastic', 'Sealed bag']) {
    await page.locator('.so-bin', { hasText: bin }).click();
    await page.waitForTimeout(150);
  }
  await shot('12-sort-done');
  const partsBefore = await world('return w.state.parts');
  await page.locator('.so-done').click();
  await page.waitForTimeout(400);
  assert((await world('return w.state.parts')) >= partsBefore + 6, 'sorting pays parts plus a bonus');

  // Goals list and a sleep: the morning card shows weather, forecast, arrivals and goals.
  await page.locator('button.chip.today').click();
  await page.waitForTimeout(200);
  await shot('13-goals');
  await page.locator('button.chip.today').click();
  await world(`w.goHome();`);
  // Walking uses game time; software-rendered browser frames can take much longer
  // than the short UI actions above. Still require the real trip and scene change.
  await page.waitForFunction(() => window.__game.scene.isActive('Home'), null, { timeout: 60000 });
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const h = window.__game.scene.getScene('Home');
    h.openMenu(h.interactables().find((i) => i.target.item.kind === 'cradle'));
  });
  await action('Sleep').click();
  await page.locator('.overlay.morning.in').waitFor({ timeout: 15000 });
  await page.waitForTimeout(300);
  await shot('14-morning');
  await page.getByRole('button', { name: 'Start the day' }).click();
  await page.waitForTimeout(400);
  const level = page.locator('.overlay.levelup');
  if (await level.count()) await page.getByRole('button', { name: 'Wonderful' }).click();

  // Portraits and burrow neighbors on the corkboard (a lucky shot isn't guaranteed, so pin one).
  await page.evaluate(() => {
    const h = window.__game.scene.getScene('Home');
    h.state.portraits.tortoise ??= 3;
    if (!h.state.guests.includes('frog')) h.state.guests.push('frog');
    h.openMenu(h.interactables().find((i) => i.target.item.kind === 'board'));
  });
  await action('Corkboard').click();
  await page.locator('.overlay.board.in').waitFor();
  assert((await page.locator('.cork .portrait').count()) >= 1, 'the portrait is pinned');
  await shot('15-corkboard');
  await page.getByRole('button', { name: 'Close' }).click();
  await page.getByRole('button', { name: 'Dismiss actions' }).click();
  await page.waitForTimeout(250);

  // The monitor's fire map and edge watch.
  await page.getByRole('button', { name: 'Wildlife', exact: true }).click();
  await page.locator('.overlay.monitor.in').waitFor();
  await page.locator('.fire-map').scrollIntoViewIfNeeded();
  await shot('15-monitor-fire');
  await page.getByRole('button', { name: 'Close' }).click();

  // Every board fits on a small phone and in landscape.
  await page.getByRole('button', { name: 'Rest', exact: true }).waitFor();
  await page.evaluate(() => {
    const h = window.__game.scene.getScene('Home');
    h.openMenu(h.interactables().find((i) => i.target.item.kind === 'door'));
  });
  await action('Go outside').click();
  await page.waitForFunction(() => window.__game.scene.isActive('World'));
  await page.waitForTimeout(500);
  for (const [name, width, height] of [['small-phone', 320, 568], ['landscape', 844, 390]]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(250);
    // Each viewport needs a live target: the previous fire can burn out while
    // its screenshots are being captured. Keep actual pointer interaction.
    await world(`
      w.state.fires = []; w.fireClock = 0;
      w.state.burned = w.state.burned.map(() => w.state.day - 30);
      w.robot.setPosition(20 * 32, 24 * 32);
      const t = { tx: 22, ty: 22 };
      w.state.entities.push({ id: w.state.nextId++, kind: 'invasivePlant', species: 'cogon', tx: t.tx, ty: t.ty, hp: 1 });
      sys.ignite(w.state, t.tx, t.ty);
      w.refreshViews();`);
    await openOn(`i => i.target.type === 'fire'`);
    await action('Contain the fire').click();
    await page.locator('.mg-fireline.in').waitFor();
    await page.waitForTimeout(250);
    const grid = await page.locator('.fl-grid').boundingBox();
    const card = await page.locator('.mg-fireline .card').boundingBox();
    assert(grid && card && grid.x >= 0 && grid.y >= 0 && grid.x + grid.width <= width + 1 && grid.y + grid.height <= card.y + card.height + 1, `${name}: fire grid is clipped`);
    const cell = await page.locator('.fl-cell').first().boundingBox();
    assert(cell && cell.width >= 22, `${name}: fire cells are too small to tap`);
    await shot(`16-fireline-${name}`);
    await page.locator('[data-leave]').click();
    await page.waitForTimeout(300);
    await shot(`17-hud-${name}`);
  }
  assert.deepEqual(errors, []);
  console.log('SEASONS SMOKE OK — screenshots/seasons-*.png');
} catch (e) {
  console.error('SEASONS SMOKE FAIL:', e);
  process.exitCode = 1;
} finally {
  await browser?.close();
  server.httpServer.close();
}
