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

for (const key of manifest) {
  const pic = sharp(path.join(dir, `${key}.png`));
  const meta = await pic.metadata();
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
}

for (const font of ['nunito', 'fraunces']) {
  const bytes = await readFile(path.join(root, `public/fonts/${font}-latin.woff2`));
  assert.equal(bytes.subarray(0, 4).toString(), 'wOF2', `${font}: invalid font`);
}
const splash = await sharp(path.join(dir, 'splash.webp')).metadata();
assert(splash.width >= 1440 && splash.width > splash.height, 'Splash must be a large landscape illustration');
console.log(`ART OK — ${manifest.length} assets, ${required.length} required brief keys, 4× dimensions, transparent sprites, opaque surfaces, fonts and splash verified.`);
