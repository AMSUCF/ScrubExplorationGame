// End-to-end smoke test in a phone-sized viewport. Usage: npm run build && npm run smoke
import { mkdirSync } from 'node:fs';
import { preview } from 'vite';
import { createRequire } from 'node:module';

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

  await page.goto(URL);
  await page.getByRole('button', { name: 'Start' }).click();
  await page.waitForFunction(() => window.__game?.scene.isActive('World'));
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'screenshots/1-start-portrait.png' });

  const world = (fn, arg) => page.evaluate(([src, a]) => new Function('w', 'a', src)(window.__game.scene.getScene('World'), a), [fn, arg]);

  // Drive with the virtual joystick: drag left from mid-screen.
  const x0 = await world('return w.robot.x');
  await page.mouse.move(200, 600);
  await page.mouse.down();
  await page.mouse.move(140, 600, { steps: 5 });
  await page.waitForTimeout(700);
  await page.mouse.up();
  const x1 = await world('return w.robot.x');
  if (!(x1 < x0 - 20)) fail(`joystick did not move robot (${x0} → ${x1})`);

  // Teleport next to the tutorial cogon, scan it, then pull it.
  const cogonBefore = await world("return w.state.entities.filter(e => e.species === 'cogon').length");
  await world('w.robot.setPosition(27 * 32 + 16, 29 * 32 + 20); w.facing = { x: 0, y: -1 };');
  await page.waitForTimeout(200);
  const label1 = await page.locator('.action-label').textContent();
  if (label1 !== 'Scan') fail(`expected Scan, got ${label1}`);
  await page.locator('.action-btn').dispatchEvent('pointerdown');
  await page.getByRole('button', { name: 'Got it!' }).waitFor();
  await page.screenshot({ path: 'screenshots/2-discovery.png' });
  await page.getByRole('button', { name: 'Got it!' }).click();
  await page.waitForTimeout(300);
  const label2 = await page.locator('.action-label').textContent();
  if (label2 !== 'Pull') fail(`expected Pull, got ${label2}`);
  await page.locator('.action-btn').dispatchEvent('pointerdown');
  await page.waitForTimeout(400);
  const cogonAfter = await world("return w.state.entities.filter(e => e.species === 'cogon').length");
  if (cogonAfter !== cogonBefore - 1) fail(`cogon not removed (${cogonBefore} → ${cogonAfter})`);
  await page.screenshot({ path: 'screenshots/3-after-pull.png' });

  // Open the field guide.
  await page.getByRole('button', { name: 'Field guide' }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'screenshots/4-guide.png' });
  await page.getByRole('button', { name: 'Close' }).click();
  await page.waitForTimeout(300);

  // Drive to the dock and sleep.
  await world('w.robot.setPosition(28 * 32 + 16, 34 * 32 + 20); w.facing = { x: 0, y: -1 };');
  await page.waitForTimeout(200);
  const label3 = await page.locator('.action-label').textContent();
  if (label3 !== 'Sleep') fail(`expected Sleep, got ${label3}`);
  await page.locator('.action-btn').dispatchEvent('pointerdown');
  await page.getByRole('button', { name: 'Start the day' }).waitFor({ timeout: 5000 });
  await page.screenshot({ path: 'screenshots/5-morning.png' });
  await page.getByRole('button', { name: 'Start the day' }).click();
  await page.waitForTimeout(900);

  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('scrubbot.save') ?? 'null'));
  if (saved?.day !== 2) fail(`expected saved day 2, got ${saved?.day}`);

  // Landscape.
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'screenshots/6-landscape.png' });

  // Reload → Continue restores the save.
  await page.reload();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.waitForFunction(() => window.__game?.scene.isActive('World'));
  const day = await world('return w.state.day');
  if (day !== 2) fail(`continue did not restore day (got ${day})`);

  if (errors.length) fail(`page errors:\n  ${errors.join('\n  ')}`);
  if (!process.exitCode) console.log('SMOKE OK — screenshots in ./screenshots');
} finally {
  await browser.close();
  await server.close();
}
