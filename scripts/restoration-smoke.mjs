// End-to-end touch care, interruption/reload, and readable home views on a phone.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { preview } from 'vite';
const { chromium } = createRequire(import.meta.url)('playwright');
const server = await preview({ preview: { port: 4176, strictPort: true }, logLevel: 'warn' });
mkdirSync('screenshots', { recursive: true });
let browser;
try {
  browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage(), errors = [];
  page.setDefaultTimeout(15000);
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => m.type() === 'error' && errors.push(m.text()));
  const cdp = await ctx.newCDPSession(page);
  const touch = async (from, to) => {
    const coords = await page.evaluate(([from, to]) => {
      const svg = document.querySelector('.care-canvas'), matrix = svg.getScreenCTM();
      const convert = at => { const p = svg.createSVGPoint(); p.x = at.x; p.y = at.y; const q = p.matrixTransform(matrix); return { x: q.x, y: q.y }; };
      return [convert(from), convert(to)];
    }, [from, to]);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...coords[0], id: 1 }] });
    for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: coords[0].x + (coords[1].x - coords[0].x) * i / 8, y: coords[0].y + (coords[1].y - coords[0].y) * i / 8, id: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };
  const openVine = async () => {
    await page.evaluate(() => {
      const w = window.__game.scene.getScene('World');
      const vine = w.state.entities.find(e => e.kind === 'invasivePlant' && e.species === 'airpotato' && e.tx === 31 && e.ty === 28);
      if (!w.state.scanned.includes('airpotato')) w.state.scanned.push('airpotato');
      w.robot.setPosition(vine.tx * 32, vine.ty * 32 + 25);
      w.openMenu(w.interactables().find(it => it.target.type === 'entity' && it.target.entity.id === vine.id));
    });
    await page.getByRole('button', { name: 'Untangle vines', exact: true }).click();
    await page.locator('.vine-care.in').waitFor();
    await page.waitForTimeout(250);
  };
  const work = () => page.evaluate(() => window.__game.scene.getScene('World').state.entities.find(e => e.kind === 'invasivePlant' && e.tx === 31 && e.ty === 28)?.care);
  await page.goto('http://localhost:4176/?debug');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.getByRole('button', { name: 'Skip intro' }).click();
  await page.waitForFunction(() => window.__game.scene.isActive('World'));
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'screenshots/refined-world.png' });
  await openVine();
  for (const [name, width, height] of [['landscape', 844, 390], ['small-phone', 320, 568], ['phone', 390, 844]]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(180);
    const mark = await page.getByRole('button', { name: 'Cut vine 1', exact: true }).boundingBox();
    assert(mark && mark.width >= 24 && mark.x >= 0 && mark.x + mark.width <= width && mark.y >= 0 && mark.y + mark.height <= height, `${name}: snip mark is clipped or too small`);
    await page.screenshot({ path: `screenshots/vine-care-${name}.png` });
  }
  const before = await page.evaluate(() => window.__game.scene.getScene('World').state.battery);
  await page.screenshot({ path: 'screenshots/vine-care-before.png' });
  // A broad, unsafe swipe is caught rather than damaging the host or progressing the work.
  await touch({ x: 110, y: 346 }, { x: 430, y: 346 });
  assert.equal((await work()).cuts.length, 0);
  assert.equal((await work()).brushes, 1);
  assert.match(await page.locator('.care-feedback').textContent(), /caught the blade/);
  await touch({ x: 114, y: 346 }, { x: 162, y: 346 });
  assert.deepEqual((await work()).cuts, [0]);
  await page.getByRole('button', { name: 'Pause vine care' }).click();
  assert.equal(await page.evaluate(() => window.__game.scene.getScene('World').state.battery), before);
  await page.reload();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.waitForFunction(() => window.__game.scene.isActive('World'));
  await openVine();
  assert.deepEqual((await work()).cuts, [0]);
  await touch({ x: 294, y: 381 }, { x: 342, y: 381 });
  await touch({ x: 374, y: 338 }, { x: 422, y: 338 });
  assert.equal(await page.locator('.vine-care').getAttribute('data-stage'), 'bag');
  for (const from of [{ x: 122, y: 235 }, { x: 339, y: 184 }, { x: 412, y: 267 }]) await touch(from, { x: 397, y: 481 });
  assert.equal(await page.locator('.vine-care').getAttribute('data-stage'), 'pull');
  await touch({ x: 263, y: 432 }, { x: 263, y: 505 });
  assert.equal(await page.locator('.vine-care').getAttribute('data-stage'), 'done');
  await page.screenshot({ path: 'screenshots/vine-care-finished.png' });
  await page.getByRole('button', { name: 'Back to the scrub', exact: true }).click();
  await page.waitForFunction(() => !window.__game.scene.getScene('World').state.entities.some(e => e.kind === 'invasivePlant' && e.tx === 31 && e.ty === 28));
  assert.equal(await page.evaluate(() => window.__game.scene.getScene('World').state.bag), 3);
  assert.equal(await page.evaluate(() => window.__game.scene.getScene('World').state.battery), before - 4);
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'screenshots/grove-after-care.png' });

  // Whole-room overview and large detail views, with actions going through real game logic.
  await page.evaluate(() => {
    const g = window.__game, s = g.scene.getScene('World').state;
    s.seeds.oak = 1; g.scene.stop('World'); g.scene.start('Home', { state: s });
  });
  await page.waitForFunction(() => window.__game.scene.isActive('Home'));
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'screenshots/refined-home.png' });
  await page.getByRole('button', { name: 'Nursery', exact: true }).click();
  await page.getByRole('button', { name: 'Sow Scrub oak in jar 1', exact: true }).click();
  await page.getByRole('button', { name: 'Water in jar 1', exact: true }).click();
  assert(await page.locator('.jar-card').first().textContent().then(t => t.includes('Watered today')));
  assert.equal(await page.evaluate(() => window.__game.scene.getScene('Home').state.trays[0].seed), 'oak');
  assert.equal(await page.evaluate(() => window.__game.scene.getScene('Home').state.trays[0].watered), true);
  await page.screenshot({ path: 'screenshots/refined-nursery.png' });
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Wildlife', exact: true }).click();
  await page.locator('.monitor.in').waitFor();
  assert.match(await page.locator('.monitor').textContent(), /Clear the old fences/);
  assert.match(await page.locator('.monitor').textContent(), /Healthy scrub oaks/);
  await page.screenshot({ path: 'screenshots/refined-monitor.png' });
  await page.getByRole('button', { name: 'Close', exact: true }).click();

  // Keyboard alternatives operate the same work model, with clean-care reward paid just once.
  await page.evaluate(() => {
    const g = window.__game, s = g.scene.getScene('Home').state;
    s.entities.push({ id: s.nextId++, kind: 'invasivePlant', species: 'airpotato', tx: 31, ty: 28, hp: 1 });
    s.bag = 0; g.scene.stop('Home'); g.scene.start('World', { state: s });
  });
  await page.waitForFunction(() => window.__game.scene.isActive('World'));
  await openVine();
  for (let i = 1; i <= 3; i++) { const target = page.getByRole('button', { name: `Cut vine ${i}`, exact: true }); await target.focus(); await target.press('Enter'); }
  for (let i = 1; i <= 3; i++) { const target = page.getByRole('button', { name: `Bag bulbil ${i}`, exact: true }); await target.focus(); await target.press('Enter'); }
  const pull = page.getByRole('button', { name: 'Gently pull the vine free', exact: true }); await pull.focus(); await pull.press('Enter');
  assert.equal(await page.locator('.vine-care').getAttribute('data-stage'), 'done');
  await page.getByRole('button', { name: 'Back to the scrub', exact: true }).click();
  await page.waitForFunction(() => window.__game.scene.getScene('World').state.parts === 1);
  assert.deepEqual(errors, [], 'Browser errors');
  console.log('RESTORATION OK — real touch cuts/bagging/pulling, protected branches, partial save/reload, keyboard care, one-time rewards, nursery actions, and readable wildlife needs.');
} finally { await browser?.close(); await server.close(); }
