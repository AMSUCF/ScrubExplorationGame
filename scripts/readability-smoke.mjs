// Readability: the rendered size of every visible piece of text on each screen, at window sizes from
// a small phone to a large desktop. Sentences (four or more words) must render at READ px or more and
// labels (a few words, numbers, uppercase captions) at LABEL px or more. On large windows both floors
// rise, because the scrub zooms up there and the interface must grow with it.
// Usage: npm run build && npm run readability:smoke   (add --report to print every size)
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { preview } from 'vite';

const { chromium } = createRequire(import.meta.url)('playwright');
const PORT = 4179;
const URL = `http://localhost:${PORT}/?debug`;
const REPORT = process.argv.includes('--report');
/** CSS px: [label, sentence] floors for phones and tablets, and for large windows (≥ 1200 × 720). */
const FLOORS = { small: [12, 13], large: [14, 15] };
mkdirSync('screenshots', { recursive: true });

const VIEWPORTS = [
  ['desktop-1920', 1920, 1080, false],
  ['desktop-1440', 1440, 900, false],
  ['desktop-1280', 1280, 800, false],
  ['tablet-1024', 1024, 768, true],
  ['tablet-768', 768, 1024, true],
  ['phone-390', 390, 844, true],
  ['phone-320', 320, 568, true],
  ['landscape-844', 844, 390, true],
];

/** Every visible run of text: its rendered size, what it is, and a sample. */
const MEASURE = () => {
  const out = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const text = n.textContent.replace(/\s+/g, ' ').trim();
    if (!text) continue;
    const el = n.parentElement;
    if (!el || seen.has(el)) continue;
    seen.add(el);
    const range = document.createRange();
    range.selectNodeContents(n);
    const r = range.getBoundingClientRect();
    if (r.width < 1 || r.height < 1 || r.bottom < 0 || r.right < 0 || r.top > innerHeight || r.left > innerWidth) continue;
    let hidden = false;
    for (let p = el; p; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) < 0.05 || p.hidden) { hidden = true; break; }
    }
    if (hidden) continue;
    // Rendered size: computed font size times any zoom on the way up.
    let zoom = 1;
    for (let p = el; p; p = p.parentElement) zoom *= Number(getComputedStyle(p).zoom) || 1;
    const size = parseFloat(getComputedStyle(el).fontSize) * zoom;
    const cls = (e) => `${e.tagName.toLowerCase()}${e.classList.length ? '.' + [...e.classList].filter((c) => c !== 'tut-glow').join('.') : ''}`;
    const path = [cls(el), el.parentElement ? cls(el.parentElement) : ''].reverse().filter(Boolean).join(' > ');
    out.push({ size: Math.round(size * 10) / 10, path, text: text.slice(0, 40), caps: getComputedStyle(el).textTransform === 'uppercase' });
  }
  // Labels painted on the pod's canvas scale with the camera.
  const g = window.__game;
  const home = g?.scene.isActive('Home') ? g.scene.getScene('Home') : null;
  if (home) {
    const cam = home.cameras.main, dpr = home.registry.get('dpr');
    const walk = (list) => list.flatMap((o) => (o.list ? walk(o.list) : [o]));
    for (const t of walk(home.children.list)) {
      if (t.type !== 'Text' || !t.visible) continue;
      out.push({ size: Math.round(parseFloat(t.style.fontSize) * t.scaleY * (cam.zoom / dpr) * 10) / 10, path: 'canvas: room label', text: t.text });
    }
  }
  return out;
};

const server = await preview({ preview: { port: PORT, strictPort: true }, logLevel: 'warn' });
const browser = await chromium.launch();
const problems = [];
const errors = [];

async function audit(page, viewport, screen, large) {
  await page.waitForTimeout(350);
  const items = await page.evaluate(MEASURE);
  const [LABEL, READ] = large ? FLOORS.large : FLOORS.small;
  for (const it of items) {
    // Four or more words is a sentence to read; anything shorter (or set in capitals) is a label.
    const words = it.text.split(/\s+/).filter((w) => /[a-z]/i.test(w)).length;
    const floor = words >= 4 && !it.caps ? READ : LABEL;
    if (it.size + 0.05 < floor) problems.push({ viewport, screen, ...it, floor });
    if (REPORT) console.log(`${viewport.padEnd(14)} ${screen.padEnd(12)} ${String(it.size).padStart(5)}px  ${it.path}  “${it.text}”`);
  }
  return items;
}

try {
  for (const [name, width, height, touch] of VIEWPORTS) {
    const large = width >= 1200 && height >= 720;
    const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch });
    const page = await ctx.newPage();
    page.setDefaultTimeout(20000);
    page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
    const scene = (src, arg) => page.evaluate(([s, a]) => {
      const g = window.__game, k = ['World', 'Home'].find((k) => g.scene.isActive(k));
      return new Function('w', 'a', s)(g.scene.getScene(k), a);
    }, [src, arg]);
    const shot = (screen) => page.screenshot({ path: `screenshots/read-${name}-${screen}.png` });
    /** Close a card and wait for it to go (another may follow it). */
    const close = async (cls) => {
      await page.locator(`.overlay.${cls}.in [data-close]`).first().click();
      await page.waitForFunction((c) => !document.querySelector(`.overlay.${c}`), cls);
    };

    await page.goto(URL);
    await page.locator('.title.in').waitFor();
    await page.evaluate(() => document.fonts.ready);
    await audit(page, name, 'title', large);
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    await page.locator('.overlay.begin.in').waitFor();
    await audit(page, name, 'begin', large);
    await page.getByRole('button', { name: 'Start with the tutorial', exact: true }).click();
    await page.getByRole('button', { name: 'Skip intro' }).click();
    await page.waitForFunction(() => window.__game.scene.isActive('World'));
    await page.locator('.coach .coach-title').waitFor();
    await scene('w.state.xp = 39; window.__systems.noteTutorial(w.state, "move")');
    await page.waitForTimeout(600);
    await audit(page, name, 'world', large);
    await shot('world');

    // The action tray on the nearest cogon, then a field-guide discovery card and a level-up.
    await scene(`const c = w.state.entities.filter(e => e.species === 'cogon').sort((a, b) => Math.hypot(a.tx - 28, a.ty - 35) - Math.hypot(b.tx - 28, b.ty - 35))[0];
      w.robot.setPosition(c.tx * 32 + 16, c.ty * 32 + 50);
      w.openMenu(w.interactables().find(i => i.target.type === 'entity' && i.target.entity.id === c.id));`);
    await page.locator('.action-dock:not([hidden]) .rbtn').first().waitFor();
    await audit(page, name, 'tray', large);
    await shot('tray');
    // The scan earns level 2 (its card comes first), then the field guide's discovery card.
    await page.locator('.action-dock .rbtn[data-verb="scan"]').dispatchEvent('pointerdown');
    await page.locator('.overlay.levelup.in').waitFor();
    await audit(page, name, 'level-up', large);
    await close('levelup');
    await page.locator('.overlay.discovery.in').waitFor();
    await audit(page, name, 'discovery', large);
    await close('discovery');
    await page.locator('.hud [data-tasks]').click();
    await audit(page, name, 'today', large);
    await page.locator('.hud [data-tasks]').click();
    await page.locator('.action-dock:not([hidden]) [data-close-action]').dispatchEvent('pointerdown');
    await page.locator('.hud [data-hud="guide"]').click();
    await page.locator('.overlay.guide.in').waitFor();
    await audit(page, name, 'guide', large);
    await page.locator('.overlay.guide .entry:not(.unknown)').first().click();
    await audit(page, name, 'guide-entry', large);
    await close('guide');
    await page.getByRole('button', { name: 'Menu', exact: true }).click();
    await page.locator('.overlay.menu.in').waitFor();
    await audit(page, name, 'pause', large);
    await page.getByRole('button', { name: 'Resume', exact: true }).click();

    // Vine care close-up.
    await scene(`const v = w.state.entities.find(e => e.kind === 'invasivePlant' && e.species === 'airpotato' && e.tx === 31 && e.ty === 28);
      w.state.scanned.push('airpotato'); w.closeMenu(); w.robot.setPosition(v.tx * 32, v.ty * 32 + 25);
      w.openMenu(w.interactables().find(it => it.target.type === 'entity' && it.target.entity.id === v.id));`);
    await page.getByRole('button', { name: 'Untangle vines', exact: true }).click();
    await page.locator('.vine-care.in').waitFor();
    await audit(page, name, 'vine-care', large);
    await shot('vine-care');
    await page.getByRole('button', { name: 'Pause vine care' }).click();
    await page.waitForFunction(() => !document.querySelector('.overlay.vine-care'));

    // Sorting litter at the recycler (a close-up minigame).
    await scene(`w.state.bag = 3; w.state.bagItems = ['bottle', 'tire', 'can']; w.closeMenu();
      w.robot.setPosition(24 * 32 + 16, 37 * 32 + 20);
      w.openMenu(w.interactables().find(i => i.target.type === 'station' && i.target.station.kind === 'recycler'));`);
    await page.locator('.action-dock .rbtn[data-verb="sort"]').dispatchEvent('pointerdown');
    await page.locator('.overlay.mg.in').waitFor();
    await audit(page, name, 'sorting', large);
    await shot('sorting');
    await page.locator('.overlay.mg [data-leave]').click();
    await page.waitForFunction(() => !document.querySelector('.overlay.mg'));

    // Inside the pod: room, nursery, monitor, workshop, then a night's sleep and the morning card.
    await scene(`const s = w.state; s.seeds.rosemary = 2; w.closeMenu(); window.__game.scene.stop('World'); window.__game.scene.start('Home', { state: s });`);
    await page.waitForFunction(() => window.__game.scene.isActive('Home'));
    await page.waitForTimeout(800);
    await audit(page, name, 'home', large);
    await shot('home');
    await page.getByRole('button', { name: 'Nursery', exact: true }).click();
    await page.locator('.overlay.nursery.in').waitFor();
    await audit(page, name, 'nursery', large);
    await shot('nursery');
    await close('nursery');
    await page.getByRole('button', { name: 'Wildlife', exact: true }).click();
    await page.locator('.overlay.monitor.in').waitFor();
    await audit(page, name, 'monitor', large);
    await shot('monitor');
    await close('monitor');
    await page.getByRole('button', { name: 'Workshop', exact: true }).click();
    await page.locator('.action-dock:not([hidden]) .rbtn').first().waitFor();
    await audit(page, name, 'workshop', large);
    await page.locator('.action-dock:not([hidden]) [data-close-action]').dispatchEvent('pointerdown');
    await page.getByRole('button', { name: 'Rest', exact: true }).click();
    await page.locator('.action-dock .rbtn[data-verb="sleep"]').dispatchEvent('pointerdown');
    await page.locator('.overlay.morning.in').waitFor({ timeout: 20000 });
    await audit(page, name, 'morning', large);
    await shot('morning');
    await ctx.close();
  }

  if (problems.length) {
    const byRule = new Map();
    for (const p of problems) {
      const key = `${p.path} (${p.size}px < ${p.floor})`;
      const entry = byRule.get(key) ?? { where: new Set(), text: p.text };
      entry.where.add(`${p.viewport}/${p.screen}`);
      byRule.set(key, entry);
    }
    console.log(`Text below the readable floor (labels ≥ ${FLOORS.small[0]}px and sentences ≥ ${FLOORS.small[1]}px; ${FLOORS.large.join('/')}px on large windows):`);
    for (const [k, v] of byRule) console.log(`  ${k}  “${v.text}”  — ${[...v.where].slice(0, 4).join(', ')}${v.where.size > 4 ? ` +${v.where.size - 4}` : ''}`);
  }
  assert.deepEqual(errors, [], 'browser errors');
  assert.equal(problems.length, 0, `${problems.length} pieces of text are too small to read comfortably`);
  console.log(`READABILITY OK — labels ≥ ${FLOORS.small[0]}px and sentences ≥ ${FLOORS.small[1]}px everywhere, ${FLOORS.large.join('/')}px on large windows; ${VIEWPORTS.length} window sizes`);
} finally {
  await browser.close();
  await server.close();
}
