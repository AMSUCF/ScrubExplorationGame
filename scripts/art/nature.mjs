// Imports the rebuilt botanical paintings without losing fine, disconnected foliage tips.
// Transparent RGB is deliberately ignored: generated source sheets can retain a studio backdrop
// in fully transparent pixels. Every delivered sprite has a clean alpha matte.
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { svg } from './shapes.mjs';

const source = fileURLToPath(new URL('./source/nature/', import.meta.url));
const clear = { r: 0, g: 0, b: 0, alpha: 0 };
const png = { palette: true, colours: 256, dither: .15 };

async function splitSheet(file, cols, rows) {
  const { data, info } = await sharp(source + file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info, total = w * h;
  const visited = new Uint8Array(total), owner = new Uint8Array(total), distance = new Uint8Array(total);
  const queue = new Int32Array(total), stack = new Int32Array(total);
  let qEnd = 0;
  for (let n = 0; n < total; n++) {
    if (visited[n] || data[n * 4 + 3] < 70) continue;
    let size = 1, at = 0, sumX = 0, sumY = 0;
    stack[0] = n; visited[n] = 1;
    while (at < size) {
      const p = stack[at++], x = p % w, y = Math.floor(p / w);
      sumX += x; sumY += y;
      for (const next of [x ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y ? p - w : -1, y < h - 1 ? p + w : -1]) {
        if (next < 0 || visited[next] || data[next * 4 + 3] < 70) continue;
        visited[next] = 1; stack[size++] = next;
      }
    }
    if (size < 12) continue;
    // Whole connected branches stay together, including tips that cross a nominal panel edge.
    const col = Math.min(cols - 1, Math.floor(sumX / size / w * cols));
    const row = Math.min(rows - 1, Math.floor(sumY / size / h * rows));
    const region = 1 + row * cols + col;
    for (let i = 0; i < size; i++) { owner[stack[i]] = region; queue[qEnd++] = stack[i]; }
  }
  // Recover antialiased leaf edges and softly feathered sand without importing neighboring art.
  let qStart = 0;
  while (qStart < qEnd) {
    const p = queue[qStart++];
    if (distance[p] >= 12) continue;
    const x = p % w, y = Math.floor(p / w);
    for (const next of [x ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y ? p - w : -1, y < h - 1 ? p + w : -1]) {
      if (next < 0 || owner[next] || !data[next * 4 + 3]) continue;
      owner[next] = owner[p]; distance[next] = distance[p] + 1; queue[qEnd++] = next;
    }
  }
  const bounds = Array.from({ length: cols * rows }, () => ({ x0: w, y0: h, x1: -1, y1: -1 }));
  for (let n = 0; n < total; n++) {
    if (!owner[n]) continue;
    const b = bounds[owner[n] - 1], x = n % w, y = Math.floor(n / w);
    b.x0 = Math.min(b.x0, x); b.x1 = Math.max(b.x1, x); b.y0 = Math.min(b.y0, y); b.y1 = Math.max(b.y1, y);
  }
  return Promise.all(bounds.map(async (b, index) => {
    if (b.x1 < b.x0) throw new Error(`${file}: empty illustration panel ${index}`);
    const width = b.x1 - b.x0 + 1, height = b.y1 - b.y0 + 1, pixels = Buffer.alloc(width * height * 4);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const p = (b.y0 + y) * w + b.x0 + x;
      if (owner[p] !== index + 1) continue;
      data.copy(pixels, (y * width + x) * 4, p * 4, p * 4 + 4);
    }
    return { buffer: await sharp(pixels, { raw: { width, height, channels: 4 } }).png().toBuffer(), width, height };
  }));
}

async function deliver(emit, key, w, h, item, file, animal = false) {
  const W = w * 4, H = h * 4;
  const fitted = await sharp(item.buffer).resize(Math.floor(W * .94), Math.floor(H * (animal ? .81 : .94)), { fit: 'inside' }).toBuffer({ resolveWithObject: true });
  const canvas = await sharp({ create: { width: W, height: H, channels: 4, background: clear } }).composite([{
    input: fitted.data, left: Math.round((W - fitted.info.width) / 2),
    top: Math.round(H * (animal ? .85 : .975) - fitted.info.height),
  }]).png().toBuffer();
  await emit(key, w, h, canvas, `source/nature/${file}`, png);
}

async function groundMaterials(emit) {
  const image = await readFile(source + 'ground.png'), meta = await sharp(image).metadata();
  const halfW = Math.floor(meta.width / 2), halfH = Math.floor(meta.height / 2);
  for (const [zone, col, row] of [['sand', 0, 0], ['oak', 1, 0], ['rosemary', 0, 1], ['base', 1, 1]]) {
    for (let variant = 0; variant < 3; variant++) {
      const margin = 3 + variant * 19;
      // Materialize the quadrant before rotation: Sharp can otherwise rotate the complete
      // sheet before its extract, silently mixing oak, sand and lichen between variants.
      const quadrant = await sharp(image).extract({ left: col * halfW + margin, top: row * halfH + margin, width: halfW - margin * 2, height: halfH - margin * 2 }).png().toBuffer();
      const patch = await sharp(quadrant).rotate(variant * 90).resize(640, 640).ensureAlpha().raw().toBuffer();
      // Overlap the actual painted material around a torus with a cosine window. Mirroring
      // makes conspicuous diamonds and rosettes when repeated over a whole open landscape.
      const sums = new Float32Array(512 * 512 * 3), weights = new Float32Array(512 * 512);
      for (let y = 0; y < 640; y++) for (let x = 0; x < 640; x++) {
        const weight = Math.sin(Math.PI * (x + .5) / 640) ** 2 * Math.sin(Math.PI * (y + .5) / 640) ** 2;
        const p = ((y + 448) % 512) * 512 + (x + 448) % 512, n = (y * 640 + x) * 4;
        weights[p] += weight;
        for (let k = 0; k < 3; k++) sums[p * 3 + k] += patch[n + k] * weight;
      }
      const pixels = Buffer.alloc(512 * 512 * 4);
      for (let p = 0; p < weights.length; p++) {
        for (let k = 0; k < 3; k++) pixels[p * 4 + k] = Math.round(sums[p * 3 + k] / weights[p] * .88 + [255, 245, 224][k] * .12);
        pixels[p * 4 + 3] = 255;
      }
      // Match the final edge pixels too, preventing a one-pixel line under nearest sampling.
      for (let y = 0; y < 512; y++) pixels.copy(pixels, (y * 512 + 511) * 4, y * 512 * 4, y * 512 * 4 + 4);
      pixels.copy(pixels, 511 * 512 * 4, 0, 512 * 4);
      const tile = await sharp(pixels, { raw: { width: 512, height: 512, channels: 4 } }).png().toBuffer();
      await emit(`ground_${zone}${variant ? `_${variant}` : ''}`, 128, 128, tile, 'source/nature/ground.png', png);
    }
  }
}

export async function buildNature(emit, output) {
  for (const [file, cols, rows, entries] of [
    ['canopies.png', 2, 1, [['oak', 148, 142], ['hickory', 132, 172]]],
    ['shrubs.png', 2, 1, [['palmetto', 92, 82], ['rosemary', 84, 78]]],
    ['invasives.png', 2, 1, [['pepper', 138, 144], ['airpotato', 80, 102]]],
    ['grasses.png', 2, 1, [['cogon', 50, 62], ['natal', 52, 62]]],
    ['wildlife.png', 2, 2, [['tortoise', 120, 84, true], ['mouse', 51, 42, true], ['jay', 84, 75, true], ['indigo', 204, 96, true]]],
    ['animals.png', 2, 2, [['cat', 102, 87, true], ['tegu', 186, 78, true], ['iguana', 207, 90, true], ['anole', 69, 36, true]]],
    ['understory.png', 3, 2, [['decor_grass', 24, 26], ['decor_lichen', 22, 18], ['decor_frond', 28, 22], ['decor_flower', 20, 25], ['edge_bush', 76, 64], ['thicket', 144, 136]]],
    ['details.png', 3, 2, [['vine_leaf', 28, 32], ['vine_bulbil', 15, 18], ['sprig_palmetto', 18, 28], ['sprig_rosemary', 18, 28], ['sprig_oak', 18, 28], ['sprig_hickory', 18, 28]]],
    ['debris.png', 2, 2, [['burrow', 76, 50], ['decor_deadwood', 42, 23], ['decor_acorns', 18, 15], ['green_anole', 69, 36, true]]],
    ['butterfly.png', 1, 1, [['decor_butterfly', 30, 22]]],
  ]) {
    const items = await splitSheet(file, cols, rows);
    for (let i = 0; i < entries.length; i++) {
      const [key, w, h, animal] = entries[i];
      await deliver(emit, key, w, h, items[i], file, animal);
    }
  }
  await groundMaterials(emit);

  // Ground cover belongs below the crown, with a gradual change of material at its edge.
  // Keep the grains and leaves at ground scale; stretching a painted soil plate would enlarge them.
  for (const zone of ['oak', 'sand', 'rosemary']) {
    const material = await sharp(output + `/ground_${zone}.png`).resize(560, 560).extract({ left: 0, top: 140, width: 560, height: 280 }).png().toBuffer();
    const fade = Buffer.from('<svg width="560" height="280"><defs><radialGradient id="fade"><stop offset="0" stop-color="white"/><stop offset=".48" stop-color="white" stop-opacity=".8"/><stop offset="1" stop-color="white" stop-opacity="0"/></radialGradient></defs><ellipse cx="280" cy="140" rx="280" ry="140" fill="url(#fade)"/></svg>');
    const litter = await sharp(material).composite([{ input: fade, blend: 'dest-in' }]).png().toBuffer();
    await emit(`litter_${zone}`, 140, 70, litter, 'nature.mjs', png);
  }
  // Project the real, irregular canopy silhouettes onto the sand rather than using dark ovals.
  for (const key of ['oak', 'hickory', 'palmetto', 'rosemary', 'pepper', 'thicket']) {
    const width = 560, height = 192;
    const pixels = await sharp(output + `/${key}.png`).resize(width, height, { fit: 'fill' }).ensureAlpha().raw().toBuffer();
    for (let n = 0; n < pixels.length; n += 4) {
      pixels[n] = 88; pixels[n + 1] = 88; pixels[n + 2] = 60; pixels[n + 3] = Math.round(pixels[n + 3] * .19);
    }
    const shade = await sharp(pixels, { raw: { width, height, channels: 4 } }).blur(7).png().toBuffer();
    await emit(`shade_${key}`, 140, 48, shade, 'nature.mjs', png);
  }

  // Assemble reusable painted leaflets into a root knot; no oversized mound or soil pedestal.
  const leaf = `data:image/png;base64,${(await readFile(output + '/vine_leaf.png')).toString('base64')}`;
  const bulbil = `data:image/png;base64,${(await readFile(output + '/vine_bulbil.png')).toString('base64')}`;
  let root = '<path d="M5 26Q17 21 21 8M19 25Q28 21 34 10M8 25Q20 30 33 25" fill="none" stroke="#62764a" stroke-width=".9"/>';
  for (const [x, y, a] of [[4, 10, -30], [11, 4, 20], [23, 7, 45], [27, 14, -20]]) root += `<image href="${leaf}" x="${x}" y="${y}" width="11" height="14" transform="rotate(${a} ${x + 5} ${y + 7})"/>`;
  for (const [x, y] of [[11, 23], [22, 21], [29, 25]]) root += `<image href="${bulbil}" x="${x}" y="${y}" width="5" height="6"/>`;
  await emit('vine_root', 42, 32, Buffer.from(svg(42, 32, root)), 'nature.mjs', png);
}
