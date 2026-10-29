// Visual/integration checks for the complete delivered art set, using the production build.
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { preview } from 'vite';

const { chromium } = createRequire(import.meta.url)('playwright');
mkdirSync('screenshots', { recursive: true });
const server = await preview({ preview: { port: 4175, strictPort: true }, logLevel: 'warn' });
let browser;
try {
  browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const fetched = new Set();
  page.on('requestfinished', (r) => fetched.add(new URL(r.url()).pathname));
  const errors = [], external = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => m.type() === 'error' && errors.push(m.text()));
  page.on('request', req => {
    const url = new URL(req.url());
    if (['http:', 'https:'].includes(url.protocol) && url.origin !== 'http://localhost:4175') external.push(url.href);
  });
  const title = async () => {
    await page.goto('http://localhost:4175/?debug');
    await page.locator('.title.in').waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
  };
  const layout = async (name, width, height) => {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(200);
    const fit = await page.evaluate(() => {
      const start = document.querySelector('.title-start').getBoundingClientRect();
      const headline = document.querySelector('.title h1').getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(document.querySelector('.title h1'));
      const lettering = range.getBoundingClientRect();
      return start.left >= 0 && start.right <= innerWidth && start.top >= 0 && start.bottom <= innerHeight &&
        headline.top >= 0 && headline.bottom < start.top && lettering.right <= innerWidth && document.documentElement.scrollWidth === innerWidth;
    });
    assert(fit, `${name}: title layout overflows or overlaps`);
    await page.screenshot({ path: `screenshots/title-${name}.png` });
  };

  await title();
  assert(await page.evaluate(() => document.fonts.check('700 16px Nunito') && document.fonts.check('650 32px Fraunces')), 'Local fonts did not load');
  assert.equal(await page.locator('.title-landscape').evaluate(el => el.naturalWidth), 1536);
  await layout('desktop', 1440, 1000);
  await layout('phone', 390, 844);
  await layout('small-phone', 320, 568);
  await layout('landscape', 844, 390);

  const sound = page.getByRole('button', { name: 'Sound', exact: true });
  const before = await sound.getAttribute('aria-pressed');
  await sound.click();
  assert.notEqual(await sound.getAttribute('aria-pressed'), before, 'Title sound toggle did not change');
  await sound.click();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.getByRole('button', { name: 'Skip intro', exact: true }).click();
  await page.waitForFunction(() => window.__game.scene.isActive('World'));
  await page.waitForFunction(() => !window.__game.scene.getScene('World').cameras.main.fadeEffect.isRunning);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(250);
  await page.screenshot({ path: 'screenshots/world-final.png' });
  // Art only DOM cards and mini-games show (DOM_ONLY in src/art/effects.ts) is fetched by URL once the
  // game starts, instead of becoming a Phaser texture.
  const domOnly = ['dig_sand', 'burrow_section', 'fire', 'storm', 'edge', 'frog', 'beetle', 'cricket'];
  const missing = await page.evaluate((domOnly) => {
    const g = window.__game;
    return g.cache.json.get('art-manifest').filter(k => !k.startsWith('room') && !k.startsWith('ground_') && !domOnly.includes(k) && !g.textures.exists(k));
  }, domOnly);
  assert.deepEqual(missing, [], 'Production illustrations missing Phaser textures');
  // They are fetched one at a time after Start; give the last (the large dig sand) a moment.
  const isFetched = (k) => [...fetched].some((path) => path.endsWith(`/art/${k}.png`));
  for (let i = 0; i < 100 && !domOnly.every(isFetched); i++) await page.waitForTimeout(100);
  const unfetched = domOnly.filter((k) => !isFetched(k));
  assert.deepEqual(unfetched, [], 'DOM-only art was not fetched after the game started');

  const materials = await page.evaluate(() => {
    const ground = window.__game.textures.get('ground'), c = ground.getContext(), s = ground.customData.scale ?? 1;
    return [[320, 768], [1040, 240], [1504, 944]].map(([x, y]) => {
      const pixels = c.getImageData((x - 40) * s, (y - 40) * s, 80 * s, 80 * s).data, sum = [0, 0, 0];
      for (let n = 0; n < pixels.length; n += 4) for (let k = 0; k < 3; k++) sum[k] += pixels[n + k];
      return sum.map(n => n / (pixels.length / 4));
    });
  });
  const luminance = channels => channels.reduce((a, b) => a + b, 0) / 3;
  assert(luminance(materials[1]) + 25 < luminance(materials[2]), 'Oak litter and pale lichen habitats lost their distinct materials');
  assert(materials[2][2] > materials[0][2] + 5, 'White quartz/lichen has mixed with warm scrub sand');
  const canopies = await page.evaluate(() => {
    const w = window.__game.scene.getScene('World');
    return ['oak', 'hickory', 'palmetto', 'rosemary'].map(species => {
      const e = w.state.entities.find(e => e.kind === 'nativePlant' && e.species === species);
      const image = w.views.get(e.id).sprite;
      return { species, texture: image.texture.key, width: image.displayWidth, height: image.displayHeight };
    });
  });
  for (const p of canopies) assert.equal(p.texture, `art:${p.species}`, `${p.species}: canopy uses a downsampled icon`);
  assert(canopies[0].width > 135 && canopies[1].height > 160 && canopies[2].height < canopies[0].height, 'Native canopy hierarchy changed');

  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const [name, x, y] of [['vine-grove', 1000, 850], ['oak-scrub', 1040, 280], ['sand-scrub', 350, 750], ['rosemary-bald', 1500, 920]]) {
    await page.evaluate(([x, y]) => {
      const w = window.__game.scene.getScene('World');
      w.robot.setPosition(x, y + 70); w.cameras.main.stopFollow(); w.cameras.main.centerOn(x, y);
    }, [x, y]);
    await page.waitForTimeout(350);
    await page.screenshot({ path: `screenshots/nature-${name}.png` });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => {
    const w = window.__game.scene.getScene('World');
    w.robot.setPosition(1000, 950); w.cameras.main.centerOn(1000, 850);
  });
  await page.waitForTimeout(350);
  await page.screenshot({ path: 'screenshots/nature-grove-phone.png' });

  for (let level = 0; level < 3; level++) {
    await page.evaluate(level => {
      const g = window.__game;
      const state = g.scene.getScene(g.scene.isActive('World') ? 'World' : 'Home').state;
      state.homeLevel = level;
      state.returned = ['tortoise', 'mouse', 'jay', 'indigo'];
      g.scene.stop('World'); g.scene.stop('Home'); g.scene.start('Home', { state });
    }, level);
    await page.waitForFunction(() => window.__game.scene.isActive('Home'));
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.waitForTimeout(450);
    assert(await page.evaluate(level => window.__game.textures.exists(`room${level}`), level), `Missing room ${level}`);
    await page.screenshot({ path: `screenshots/room-${level}-desktop.png` });
  }

  await title();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.waitForFunction(() => window.__game.scene.isActive('Home'));
  assert.equal(await page.evaluate(() => window.__game.scene.getScene('Home').state.homeLevel), 2, 'Continue did not restore the room');
  await title();
  await page.getByRole('button', { name: 'New game', exact: true }).click();
  assert(await page.getByRole('button', { name: 'Continue', exact: true }).isVisible(), 'A single New game tap discarded the save');
  await page.getByRole('button', { name: 'New game', exact: true }).click();
  await page.waitForFunction(() => window.__game.scene.isActive('Intro'));

  // Low-memory devices and the Canvas renderer keep the 1× ground; it must still fill the world.
  for (const [name, init] of [
    ['low-memory', () => Object.defineProperty(Navigator.prototype, 'deviceMemory', { get: () => 1 })],
    ['canvas-renderer', () => {
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...rest) { return /webgl/.test(type) ? null : getContext.call(this, type, ...rest); };
    }],
  ]) {
    const fallback = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const p = await fallback.newPage();
    p.on('pageerror', e => errors.push(`${name}: ${e.message}`));
    await p.addInitScript(init);
    await p.goto('http://localhost:4175/?debug');
    await p.getByRole('button', { name: 'Start', exact: true }).click();
    await p.getByRole('button', { name: 'Skip intro', exact: true }).click();
    await p.waitForFunction(() => window.__game.scene.isActive('World'));
    const ground = await p.evaluate(() => {
      const g = window.__game, t = g.textures.get('ground');
      const image = g.scene.getScene('World').children.list.find(o => o.texture?.key === 'ground');
      return { scale: t.customData.scale, width: t.getSourceImage().width, shown: image.displayWidth, renderer: g.renderer.type };
    });
    assert.deepEqual([ground.scale, ground.width, ground.shown], [1, 1792, 1792], `${name}: 1× ground fallback`);
    assert.equal(ground.renderer, name === 'canvas-renderer' ? 1 : 2, `${name}: unexpected Phaser renderer`);
    await p.screenshot({ path: `screenshots/ground-1x-${name}.png` });
    await fallback.close();
  }

  assert.deepEqual(errors, [], 'Browser errors');
  assert.deepEqual(external, [], 'Unexpected external HTTP requests');
  console.log('ART SMOKE OK — responsive title, local fonts, full-resolution canopies, distinct habitat grounds, desktop/phone grove views, all sprites, three rooms, sound, continue/new-game safeguard; no browser errors or external HTTP requests.');
} finally {
  await browser?.close();
  await server.close();
}
