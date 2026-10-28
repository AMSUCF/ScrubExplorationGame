// End-to-end smoke test in a phone-sized viewport. Usage: npm run build && npm run smoke
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { preview } from 'vite';

// Playwright may be installed globally (CI images, cloud sandboxes) rather than in node_modules.
const { chromium } = createRequire(import.meta.url)('playwright');

const PORT = 4174;
const URL = `http://localhost:${PORT}/?debug`;
mkdirSync('screenshots', { recursive: true });

const server = await preview({ preview: { port: PORT, strictPort: true }, logLevel: 'warn' });

const fail = (msg) => {
  console.error('SMOKE FAIL:', msg);
  process.exitCode = 1;
};

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  const scene = (key, src, arg) =>
    page.evaluate(([k, s, a]) => new Function('w', 'a', s)(window.__game.scene.getScene(k), a), [key, src, arg]);
  const active = (key) => page.waitForFunction((k) => window.__game?.scene.isActive(k), key, { timeout: 15000 });
  /** CSS-pixel screen position of a world point in a scene. */
  const screenOf = (key, x, y) =>
    scene(key, `const c = w.cameras.main, d = w.registry.get('dpr');
      return { x: (a.x - c.worldView.x) * c.zoom / d, y: (a.y - c.worldView.y) * c.zoom / d };`, { x, y });
  const tapWorld = async (key, x, y) => {
    const p = await screenOf(key, x, y);
    await page.touchscreen.tap(p.x, p.y);
  };
  const menuButton = (label) => page.locator(`.rbtn[aria-label="${label}"]`);

  await page.goto(URL);
  await page.getByRole('button', { name: 'Start' }).click();
  await active('Intro');
  await page.waitForTimeout(3600);
  await page.screenshot({ path: 'screenshots/1-intro.png' });
  await page.getByRole('button', { name: 'Skip intro' }).click();
  await active('World');
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'screenshots/2-world.png' });

  // Tap the tutorial cogon: a radial menu opens; choosing Scan walks over and scans it.
  const cogon = await scene('World', `
    const c = w.state.entities.filter(e => e.species === 'cogon').sort((a, b) => Math.hypot(a.tx - 28, a.ty - 35) - Math.hypot(b.tx - 28, b.ty - 35))[0];
    return { id: c.id, x: c.tx * 32 + 16, y: c.ty * 32 + 16 };`);
  await tapWorld('World', cogon.x, cogon.y);
  await menuButton('Scan').waitFor();
  await page.screenshot({ path: 'screenshots/3-radial.png' });
  await menuButton('Scan').dispatchEvent('pointerdown');
  await page.getByRole('button', { name: 'Close' }).waitFor({ timeout: 8000 });
  await page.screenshot({ path: 'screenshots/4-discovery.png' });
  await page.getByRole('button', { name: 'Close' }).click();
  await menuButton('Pull').waitFor();
  await menuButton('Pull').dispatchEvent('pointerdown');
  await page.waitForTimeout(500);
  const gone = await scene('World', 'return !w.state.entities.some(e => e.id === a)', cogon.id);
  if (!gone) fail('cogon not removed via radial menu');
  await page.screenshot({ path: 'screenshots/5-after-pull.png' });

  // Tap-to-go: tap open ground and the robot drives there.
  const before = await scene('World', 'return { x: w.robot.x, y: w.robot.y }');
  await tapWorld('World', before.x + 70, before.y + 40);
  await page.waitForTimeout(1200);
  const after = await scene('World', 'return { x: w.robot.x, y: w.robot.y }');
  if (Math.hypot(after.x - before.x, after.y - before.y) < 30) fail(`tap-to-go did not move robot (${JSON.stringify(before)} → ${JSON.stringify(after)})`);

  // Go home: tap the pod, choose Go inside.
  await scene('World', 'w.robot.setPosition(28 * 32 + 16, 35 * 32 + 4)');
  await page.waitForTimeout(900);
  await tapWorld('World', 28 * 32 + 16, 33 * 32 + 18);
  await menuButton('Go inside').waitFor();
  await menuButton('Go inside').dispatchEvent('pointerdown');
  await active('Home');
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'screenshots/6-home.png' });

  // Wildlife monitor.
  const item = (kind) => scene('Home', `const it = w.interactables().find(i => i.target.item.kind === a); return { x: it.x, y: it.y };`, kind);
  const mon = await item('monitor');
  await tapWorld('Home', mon.x, mon.y);
  await menuButton('Wildlife monitor').waitFor();
  await menuButton('Wildlife monitor').dispatchEvent('pointerdown');
  await page.locator('.monitor .screen').waitFor({ timeout: 6000 });
  await page.screenshot({ path: 'screenshots/7-monitor.png' });
  await page.getByRole('button', { name: 'Close' }).click();
  await page.waitForTimeout(300);

  // Sleep in the cradle.
  const cradle = await item('cradle');
  await tapWorld('Home', cradle.x, cradle.y);
  await menuButton('Sleep').waitFor();
  await menuButton('Sleep').dispatchEvent('pointerdown');
  await page.getByRole('button', { name: 'Start the day' }).waitFor({ timeout: 8000 });
  await page.screenshot({ path: 'screenshots/8-morning.png' });
  await page.getByRole('button', { name: 'Start the day' }).click();
  await page.waitForTimeout(900);

  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('scrubbot.save') ?? 'null'));
  if (saved?.day !== 2 || saved?.location !== 'home') fail(`expected saved day 2 at home, got ${saved?.day}/${saved?.location}`);

  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'screenshots/9-home-landscape.png' });

  await page.reload();
  await page.getByRole('button', { name: 'Continue' }).click();
  await active('Home');
  const day = await scene('Home', 'return w.state.day');
  if (day !== 2) fail(`continue did not restore day (got ${day})`);

  if (errors.length) fail(`page errors:\n  ${errors.join('\n  ')}`);
  if (!process.exitCode) console.log('SMOKE OK — screenshots in ./screenshots');
} finally {
  await browser.close();
  await server.close();
}
