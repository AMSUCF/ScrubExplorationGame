import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const root = fileURLToPath(new URL('../../', import.meta.url));
const dir = path.join(root, 'public/art');
const manifest = JSON.parse(await readFile(path.join(dir, 'manifest.json'), 'utf8'));
const catalog = JSON.parse(await readFile(path.join(root, 'src/art/catalog.json'), 'utf8'));
assert.equal(new Set(manifest).size, manifest.length, 'Duplicate manifest keys');
assert.deepEqual([...manifest].sort(), Object.keys(catalog).sort(), 'Catalog and manifest differ');
assert.deepEqual((await readdir(dir)).filter(f => f.endsWith('.png')).map(f => f.slice(0, -4)).sort(), [...manifest].sort(), 'PNG files and manifest differ');

const required = ['robot', 'robot_blink', 'robot_happy', 'antenna', 'crate', 'pod0', 'pod1', 'pod2', 'pod_shut', 'flame', 'dust',
  'palmetto', 'rosemary', 'oak', 'hickory', 'cogon', 'pepper', 'airpotato', 'natal', 'tire', 'bottle', 'fence', 'thicket', 'burrow',
  'tortoise', 'mouse', 'jay', 'indigo', 'cat', 'tegu', 'iguana', 'anole', 'room0', 'room1', 'room2', 'cradle', 'monitor', 'board', 'bench',
  'vase', 'window', 'doormat', 'polaroid', 'postcard', 'pin', 'recycler', 'pad', 'sparkle', 'ring', 'bubble',
  ...['sand', 'oak', 'rosemary', 'base'].map(z => `ground_${z}`),
  ...['palmetto', 'rosemary', 'oak', 'hickory'].map(s => `sprig_${s}`),
  ...['empty', 'sown', 'sprout', 'ready'].flatMap(s => ['dry', 'wet'].map(w => `hydro_${s}_${w}`))];
for (const key of required) assert(manifest.includes(key), `Missing brief asset: ${key}`);
const requests = JSON.parse(await readFile(path.join(root, 'docs/art-requests.json'), 'utf8')).assets;
for (const asset of requests) {
  assert(manifest.includes(asset.key), `Missing second-brief asset: ${asset.key}`);
  assert.deepEqual(catalog[asset.key], asset.logical, `${asset.key}: request dimensions differ`);
  if (asset.group === 'Field guide cards' || asset.group === 'Mini-game backdrops') {
    const { data, info } = await sharp(path.join(dir, `${asset.key}.png`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.equal(data[3], 0, `${asset.key}: rounded corner must be transparent`);
    assert.equal(data[((Math.floor(info.height / 2) * info.width + Math.floor(info.width / 2)) * 4) + 3], 255, `${asset.key}: interior must be opaque`);
  }
}

for (const key of manifest) {
  const pic = sharp(path.join(dir, `${key}.png`));
  const meta = await pic.metadata();
  assert.equal(meta.space, 'srgb', `${key}: delivery must use sRGB`);
  const [w, h] = catalog[key];
  assert.equal(meta.width, w * 4, `${key}: wrong width`);
  assert.equal(meta.height, h * 4, `${key}: wrong height`);
  const { channels, isOpaque } = await pic.stats();
  assert(channels.some(c => c.max > c.min), `${key}: blank image`);
  if (key.startsWith('ground_') || key.startsWith('room')) assert(isOpaque, `${key}: background must be opaque`);
  else {
    assert(meta.hasAlpha, `${key}: missing transparency`);
    assert(!isOpaque, `${key}: background must be transparent`);
  }
  if (key.startsWith('ground_')) {
    const { data, info } = await pic.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    for (let y = 0; y < info.height; y++) for (let k = 0; k < 4; k++) {
      assert.equal(data[(y * info.width) * 4 + k], data[(y * info.width + info.width - 1) * 4 + k], `${key}: horizontal tile seam`);
    }
    for (let x = 0; x < info.width; x++) for (let k = 0; k < 4; k++) {
      assert.equal(data[x * 4 + k], data[((info.height - 1) * info.width + x) * 4 + k], `${key}: vertical tile seam`);
    }
  }
}

// Rotating a multi-material source sheet before cropping can put another habitat into a
// variant. Each set should keep its own overall material, in addition to matching tile edges.
for (const zone of ['sand', 'oak', 'rosemary', 'base']) {
  const means = [];
  for (const suffix of ['', '_1', '_2']) means.push((await sharp(path.join(dir, `ground_${zone}${suffix}.png`)).stats()).channels.slice(0, 3).map(c => c.mean));
  for (let channel = 0; channel < 3; channel++) {
    const values = means.map(v => v[channel]);
    assert(Math.max(...values) - Math.min(...values) < 8, `${zone}: variants contain different ground materials`);
  }
}
for (const key of ['vine_leaf', 'vine_bulbil', 'vine_root', 'litter_oak', 'litter_sand', 'litter_rosemary',
  ...['oak', 'hickory', 'palmetto', 'rosemary', 'pepper', 'thicket'].map(k => `shade_${k}`)]) {
  assert(manifest.includes(key), `Missing habitat layer: ${key}`);
}

for (const font of ['nunito', 'fraunces']) {
  const bytes = await readFile(path.join(root, `public/fonts/${font}-latin.woff2`));
  assert.equal(bytes.subarray(0, 4).toString(), 'wOF2', `${font}: invalid font`);
}
const splash = await sharp(path.join(dir, 'splash.webp')).metadata();
assert(splash.width >= 1440 && splash.width > splash.height, 'Splash must be a large landscape illustration');
console.log(`ART OK — ${manifest.length} assets, ${required.length} original + ${requests.length} second-brief keys, 4× sRGB delivery, transparent sprites, rounded cards, seamless ground edges, opaque surfaces, fonts and splash verified.`);
