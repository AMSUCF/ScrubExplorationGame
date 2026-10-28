import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';
import { hydro, prop, room } from './shapes.mjs';
import { ICON_ART, iconSvg } from './icons.mjs';
import { buildNature } from './nature.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const out = path.join(root, 'public/art');
const sources = path.join(root, 'scripts/art/source');
await mkdir(out, { recursive: true });
const catalog = {};
const sourceIndex = {};
const transparent = { r: 0, g: 0, b: 0, alpha: 0 };

async function emit(key, w, h, buffer, source, pngOptions = {}) {
  const dest = path.join(out, `${key}.png`);
  await sharp(buffer).resize(w * 4, h * 4, { fit: 'contain', background: transparent }).png({ compressionLevel: 9, ...pngOptions }).toFile(dest);
  catalog[key] = [w, h];
  sourceIndex[key] = source;
}

// Split connected silhouettes instead of assuming the illustration model used an exact grid.
// This preserves whole tails and leaf tips even when they extend past nominal cell edges.
// Only cutting, padding and sizing happen here; the illustrations are retained in source/.
async function silhouettes(file, expected) {
  const { data, info } = await sharp(path.join(sources, file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const labels = new Int32Array(w * h);
  const comps = [];
  let id = 0;
  for (let n = 0; n < labels.length; n++) {
    if (labels[n] || data[n * 4 + 3] < 100) continue;
    id++;
    const stack = [n];
    labels[n] = id;
    let count = 0, x0 = w, y0 = h, x1 = 0, y1 = 0;
    while (stack.length) {
      const at = stack.pop(), x = at % w, y = Math.floor(at / w);
      count++; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
      for (const next of [x > 0 ? at - 1 : -1, x < w - 1 ? at + 1 : -1, y > 0 ? at - w : -1, y < h - 1 ? at + w : -1]) {
        if (next < 0 || labels[next] || data[next * 4 + 3] < 100) continue;
        labels[next] = id;
        stack.push(next);
      }
    }
    if (count > 800) comps.push({ id, count, x0, y0, x1, y1 });
  }
  if (comps.length !== expected) throw new Error(`${file}: expected ${expected} complete silhouettes, found ${comps.length}`);
  comps.sort((a, b) => expected === 16 ? Math.round((a.y0 + a.y1) / 2 / (h / 4) - .5) - Math.round((b.y0 + b.y1) / 2 / (h / 4) - .5) || a.x0 - b.x0 : a.x0 - b.x0);
  const result = [];
  for (const comp of comps) {
    // A small transparent/antialiased perimeter retains the soft painted edge and shadow.
    const pad = 9;
    const x0 = Math.max(0, comp.x0 - pad), y0 = Math.max(0, comp.y0 - pad);
    const width = Math.min(w - 1, comp.x1 + pad) - x0 + 1, height = Math.min(h - 1, comp.y1 + pad) - y0 + 1;
    const pixels = Buffer.alloc(width * height * 4);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const pos = (y + y0) * w + x + x0;
      // Exclude any neighboring subject that happens to enter the padded rectangle.
      if (labels[pos] && labels[pos] !== comp.id) continue;
      const i = pos * 4, j = (y * width + x) * 4;
      data.copy(pixels, j, i, i + 4);
    }
    const buffer = await sharp(pixels, { raw: { width, height, channels: 4 } }).png().toBuffer();
    result.push({ buffer, width, height });
  }
  return result;
}

async function sprite(key, w, h, item, source, fit = 'bottom') {
  const inset = .94;
  const scaled = await sharp(item.buffer).resize(Math.round(w * 4 * inset), Math.round(h * 4 * inset), { fit: 'inside' }).toBuffer({ resolveWithObject: true });
  const left = Math.round((w * 4 - scaled.info.width) / 2);
  const top = fit === 'center' ? Math.round((h * 4 - scaled.info.height) / 2) : h * 4 - scaled.info.height;
  const canvas = await sharp({ create: { width: w * 4, height: h * 4, channels: 4, background: transparent } }).composite([{ input: scaled.data, left, top }]).png().toBuffer();
  await emit(key, w, h, canvas, source);
}

const homes = await silhouettes('home.png', 16);
const home = [
  ['robot', 36, 36], ['robot_blink', 36, 36], ['robot_happy', 36, 36], ['antenna', 8, 16],
  ['pod0', 104, 74], ['pod1', 104, 74], ['pod2', 104, 74], ['pod_shut', 104, 74],
  ['cradle', 64, 34], ['monitor', 44, 34], ['bench', 64, 36], ['vase', 24, 30],
  ['recycler', 36, 40], ['pad', 40, 32], ['thicket', 134, 124], ['burrow', 30, 20],
];
for (let i = 0; i < home.length; i++) {
  const [key, w, h] = home[i];
  if (key === 'thicket' || key === 'burrow') continue; // rebuilt with the nature paintings
  if (i >= 4 && i <= 7) {
    // All pod upgrades share the same body scale and baseline, so upgrading never jumps.
    const item = homes[i];
    const factor = .273 * 4;
    const input = await sharp(item.buffer).resize(Math.round(item.width * factor), Math.round(item.height * factor)).toBuffer({ resolveWithObject: true });
    const coreX = [145, 125, 163, 136][i - 4];
    const left = Math.round(w * 2 - coreX * factor);
    const canvas = await sharp({ create: { width: w * 4, height: h * 4, channels: 4, background: transparent } }).composite([{ input: input.data, left: Math.max(0, left), top: h * 4 - input.info.height }]).png().toBuffer();
    await emit(key, w, h, canvas, 'source/home.png');
  } else await sprite(key, w, h, homes[i], 'source/home.png', i < 3 || key === 'burrow' ? 'center' : 'bottom');
}

for (const [level, w, h] of [[0, 384, 256], [1, 480, 288], [2, 576, 320]]) await emit(`room${level}`, w, h, Buffer.from(room(level, w, h)), 'shapes.mjs');
for (const stage of ['empty', 'sown', 'sprout', 'ready']) for (const water of ['dry', 'wet']) await emit(`hydro_${stage}_${water}`, 28, 36, Buffer.from(hydro(stage, water === 'wet')), 'shapes.mjs');
for (const [key, w, h] of [
  ['crate', 20, 15], ['tire', 24, 18], ['bottle', 16, 18], ['fence', 32, 32], ['board', 46, 34],
  ['window', 52, 36], ['doormat', 48, 14], ['polaroid', 18, 21], ['postcard', 22, 16], ['pin', 6, 6],
  ['sparkle', 10, 10], ['ring', 32, 32], ['bubble', 34, 32], ['dust', 10, 10], ['flame', 20, 40], ['light_mote', 8, 8], ['decor_tracks', 24, 14],
  ['figure_tortoise', 12, 12], ['figure_mouse', 12, 12], ['figure_jay', 12, 12], ['figure_indigo', 12, 12],
]) await emit(key, w, h, Buffer.from(prop(key)), 'shapes.mjs');

for (const key of Object.keys(ICON_ART)) await emit(`ui_${key}`, 64, 64, Buffer.from(iconSvg(key)), 'icons.mjs');

// The retained botanical paintings supersede the first-pass silhouettes and vector nature props.
await buildNature(emit, out);

await writeFile(path.join(out, 'manifest.json'), `${JSON.stringify(Object.keys(catalog), null, 2)}\n`);
await writeFile(path.join(root, 'src/art/catalog.json'), `${JSON.stringify(catalog, null, 2)}\n`);
await writeFile(path.join(sources, '../sources.json'), `${JSON.stringify(sourceIndex, null, 2)}\n`);
console.log(`Built ${Object.keys(catalog).length} production PNG assets at 4x logical size.`);

// Contact sheet is a developer artifact; it is not loaded by the game.
const cells = [];
const entries = Object.entries(catalog).filter(([key]) => !key.startsWith('ui_') && !key.startsWith('room') && !key.startsWith('ground_'));
for (let i = 0; i < entries.length; i++) {
  const [key] = entries[i];
  const picture = await sharp(path.join(out, `${key}.png`)).resize(112, 96, { fit: 'contain', background: '#f2e7cc' }).png().toBuffer();
  const label = Buffer.from(`<svg width="128" height="24"><text x="64" y="16" text-anchor="middle" font-family="sans-serif" font-size="10" fill="#625342">${key}</text></svg>`);
  const x = (i % 8) * 128, y = Math.floor(i / 8) * 128;
  cells.push({ input: picture, left: x + 8, top: y + 4 }, { input: label, left: x, top: y + 102 });
}
await mkdir(path.join(root, 'screenshots'), { recursive: true });
await sharp({ create: { width: 1024, height: Math.ceil(entries.length / 8) * 128, channels: 3, background: '#f2e7cc' } }).composite(cells).png().toFile(path.join(root, 'screenshots/art-catalog.png'));

// A uniform-thumbnail sheet conceals scale mistakes. This plate keeps every subject at the
// same 2x gameplay scale, including the robot and pod as references beside the rebuilt foliage.
const plate = [];
const caption = (x, y, message, size = 18) => plate.push({ input: Buffer.from(`<svg width="1600" height="32"><text x="${x}" y="24" font-family="sans-serif" font-size="${size}" fill="#554d3d">${message}</text></svg>`), left: 0, top: y });
caption(35, 15, 'BOTANICAL SCALE REVIEW — all subjects at twice their gameplay size', 24);
caption(35, 65, 'Native plants · irregular crowns, visible branching, small foliage');
caption(35, 510, 'Invasive plants · contrasting growth forms');
caption(35, 920, 'Wildlife and burrow · natural body proportions, a shell-sized entrance and a broad sandy apron');
for (const [keys, startX, baseline, animal] of [
  [['oak', 'hickory', 'palmetto', 'rosemary', 'robot', 'pod0'], 35, 455, false],
  [['cogon', 'natal', 'pepper', 'airpotato', 'thicket', 'robot'], 65, 850, false],
  [['tortoise', 'burrow', 'mouse', 'jay', 'indigo', 'cat', 'tegu', 'iguana', 'anole'], 60, 1080, true],
]) {
  let x = startX;
  for (const key of keys) {
    const factor = animal && key !== 'burrow' ? 2 / 3 : key === 'pod0' ? 3 : 2;
    const [w, h] = catalog[key].map(n => Math.round(n * factor));
    plate.push({ input: await sharp(path.join(out, `${key}.png`)).resize(w, h).png().toBuffer(), left: x, top: baseline - h });
    caption(x, baseline + 7, key, 16);
    x += w + (animal ? 45 : 30);
  }
}
await sharp({ create: { width: 1600, height: 1140, channels: 3, background: '#f5eddc' } }).composite(plate).png().toFile(path.join(root, 'screenshots/nature-scale.png'));
