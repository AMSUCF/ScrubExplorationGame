// Original vector artwork for the small props, seamless surfaces, and pictogram set.
// All coordinates are logical pixels; the build script rasterizes these at 4x.
export const C = { ink: '#625342', green: '#79956a', dark: '#506a50', mint: '#b5d4ba', cream: '#fff6df', sand: '#eddfb9', peach: '#eaaa88', blue: '#8db6bb', purple: '#b9a0c5', wood: '#c89c6d' };
export const path = (d, fill = 'none', stroke = C.ink, sw = 1) => `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`;
export const ellipse = (x, y, rx, ry, fill, stroke = 'none', sw = 1) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
export const rect = (x, y, w, h, r, fill, stroke = 'none', sw = 1) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
export const group = (body, transform) => `<g transform="${transform}">${body}</g>`;
export const shadow = (x, y, rx, ry) => ellipse(x, y, rx, ry, '#736046', 'none').replace('/>', ' opacity=".17"/>');
export const leaf = (x, y, s, angle, fill = C.green) => group(path('M0 0Q-6-8 0-14Q7-8 0 0Z', fill, C.dark, .5) + path('M0-1 0-11', 'none', '#d9dfac', .5), `translate(${x} ${y}) rotate(${angle}) scale(${s})`);
export const svg = (w, h, body, texture = false) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w * 4}" height="${h * 4}" viewBox="0 0 ${w} ${h}"><defs><linearGradient id="glass" x2="1" y2="1"><stop stop-color="#eff8ee" stop-opacity=".85"/><stop offset="1" stop-color="#94bfc2" stop-opacity=".7"/></linearGradient><linearGradient id="water" x2="0" y2="1"><stop stop-color="#b3e2df"/><stop offset="1" stop-color="#80b9ca"/></linearGradient><radialGradient id="glow"><stop stop-color="#fff6d7" stop-opacity=".65"/><stop offset="1" stop-color="#fff6d7" stop-opacity="0"/></radialGradient><filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".75" numOctaves="3" seed="8" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope=".065"/></feComponentTransfer><feBlend in="SourceGraphic" mode="multiply"/></filter></defs><g${texture ? ' filter="url(#grain)"' : ''}>${body}</g></svg>`;

// Deterministic artwork: regeneration never rearranges the world decoration.
export function random(seed) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }

function lichen(x, y, s = 1) {
  let a = '';
  for (let i = -2; i <= 2; i++) a += path(`M0 2Q${i * 2} -1 ${i * 2.4} -5M${i * 2} -2l-2-2m2 2 2-3`, 'none', i % 2 ? '#b8bfaa' : '#d1d6bd', 1.2);
  return group(a, `translate(${x} ${y}) scale(${s})`);
}

export function ground(zone, variant = 0) {
  const bg = { sand: '#ede0bc', oak: '#dcd1a8', rosemary: '#f3eedc', base: '#e6d3ad' }[zone];
  const rand = random({ sand: 3, oak: 8, rosemary: 11, base: 17 }[zone] + variant * 71);
  let b = rect(0, 0, 128, 128, 0, bg);
  // Every motif wraps at all four edges. No baked-in lighting seam.
  const wrap = (x, y, motif) => {
    for (const dx of [-128, 0, 128]) for (const dy of [-128, 0, 128]) b += group(motif, `translate(${x + dx} ${y + dy})`);
  };
  for (let i = 0; i < 520; i++) {
    const x = rand() * 128, y = rand() * 128;
    wrap(x, y, ellipse(0, 0, .15 + rand() * .6, .15 + rand() * .3, i % 3 ? '#b3a17c' : '#fffdf0').replace('/>', ' opacity=".25"/>'));
  }
  for (let i = 0; i < 22; i++) {
    const x = rand() * 128, y = rand() * 128;
    let detail;
    if (zone === 'oak' && i < 13) detail = group(path('M-3 0Q-5-3-1-4Q4-4 4-1Q2 1-3 0Z', i % 2 ? '#b6a17b' : '#c2a980', '#a89570', .35) + path('M-3 0 3-2', 'none', '#e7d3a9', .4), `rotate(${rand() * 360})`);
    else if (zone === 'rosemary' && i < 10) detail = lichen(0, 0, .55 + rand() * .3);
    else if (zone === 'base') detail = ellipse(0, 0, 1.1, .6, '#cbb68e') + path('M-.6-.4 .5-.5', 'none', '#f8eacc', .4);
    else detail = path('M-2 0Q-4-3-4-5M0 0Q-1-5 0-7M1 0Q3-4 4-5', 'none', '#bab986', .65);
    wrap(x, y, detail);
  }
  return svg(128, 128, b, true);
}

function hangingPlant(x, y) {
  let b = path('M-8 0 0 12 8 0M0-5V12', 'none', '#baa37e', .8) + path('M-7 11H7L5 21H-5Z', '#dca084', '#a97e60', .8);
  for (let i = 0; i < 6; i++) b += leaf((i - 2.5) * 2, 15 + i * 3, .45, (i % 2 ? 1 : -1) * 45, i % 2 ? '#91ab80' : '#729473');
  return group(b, `translate(${x} ${y})`);
}

export function room(level, w, h) {
  const rand = random(50 + level);
  let b = rect(0, 0, w, h, 0, '#2c2a36') + rect(0, 0, w, h, 24, '#4a5051') + rect(4, 4, w - 8, h - 8, 21, '#d5c3a4') + rect(8, 8, w - 16, h - 16, 18, '#f5e8cf');
  b += `<clipPath id="inside"><rect x="8" y="8" width="${w - 16}" height="${h - 16}" rx="18"/></clipPath><g clip-path="url(#inside)">`;
  for (let x = 16; x < w; x += 18) b += rect(x, 8, 7, 56, 0, '#eaddc1');
  for (let x = 18; x < w; x += 36) b += path(`M${x} 18q-3 4 0 7q3-3 0-7m0 7v6`, 'none', '#d1cba7', .6);
  b += rect(0, 63, w, h - 63, 0, '#c69e73');
  for (let y = 68, row = 0; y < h; y += 19, row++) {
    for (let x = -((row % 3) * 24); x < w; x += 72) {
      b += rect(x + .5, y, 71, 18, 1, ['#dcb88b', '#e3c298', '#d5ad7f', '#dfbd91'][Math.floor(rand() * 4)], '#be956b', .5);
      for (let k = 0; k < 3; k++) b += path(`M${x + 4} ${y + 4 + k * 4}q17 -1 28 0t33 -.4`, 'none', k % 2 ? '#c8a47b' : '#f0d2a5', .4);
      if (rand() < .28) b += ellipse(x + 22, y + 9, 3.8, 1.2, 'none', '#c6a076', .5);
    }
  }
  b += rect(0, 60, w, 7, 1, '#ae825c') + rect(0, 60, w, 2, 0, '#e3bf93');
  // Woven, stitched rug, with a little botanical medallion.
  const rx = w * .265, ry = (h - 64) * .24, cy = 64 + (h - 64) * .59;
  b += shadow(w / 2, cy + 2, rx + 2, ry + 2) + ellipse(w / 2, cy, rx, ry, '#a4b99b', '#758f77', 1.4) + ellipse(w / 2, cy, rx - 6, ry - 4, '#c4d5b5', '#e8e8cb', 1.5) + ellipse(w / 2, cy, rx - 12, ry - 7, 'none', '#9daf94', .8);
  for (let y = cy - ry + 7; y < cy + ry - 7; y += 3) {
    const span = Math.sqrt(Math.max(0, 1 - ((y - cy) / (ry - 6)) ** 2)) * (rx - 9);
    b += path(`M${w / 2 - span} ${y}H${w / 2 + span}`, 'none', '#dbe1c2', .4);
  }
  b += path(`M${w / 2 - 10} ${cy + 11}q8-8 20-23`, 'none', '#88a07e', 1.5);
  for (const [x, y, a] of [[-4, 5, -55], [4, -3, 45], [9, -10, 10]]) b += leaf(w / 2 + x, cy + y, .8, a, '#9eb58c');
  // Sunlight is translucent so the floor remains legible behind the furniture.
  b += path(`M${w - 70} 68h36l-65 ${h - 90}h-100Z`, '#fff1be', 'none').replace('/>', ' opacity=".18"/>');
  b += rect(15, 10, w - 30, 4, 2, '#fff4dc') + path(`M14 51V25Q14 14 26 14H${w - 26}Q${w - 14} 14 ${w - 14} 25V51`, 'none', '#c9b79a', 1);
  if (level >= 1) b += hangingPlant(32, 13) + hangingPlant(w - 32, 13);
  if (level === 2) {
    b += rect(w / 2 - 50, 12, 100, 25, 10, '#afd0c9', '#fff6df', 3);
    for (const x of [-25, 0, 25]) b += path(`M${w / 2 + x} 13V36`, 'none', '#f8efdd', 2);
    b += path(`M${w / 2 - 40} 27l25-13m0 19 30-19`, 'none', '#e5eddb', 2);
  }
  b += '</g>';
  for (const x of [7, w - 7]) for (const y of [36, h - 36]) b += ellipse(x, y, 1, 1.5, '#91958a');
  return svg(w, h, b, true);
}

export function hydro(stage, wet) {
  let b = shadow(14, 33.5, 10.5, 1.8) + rect(3, 1, 22, 2.8, 1.4, '#a48cad', '#786880', .6) + rect(4, 3, 20, 1, .5, '#e9c9f4') + ellipse(14, 8, 10, 6, '#d5b8e0').replace('/>', ' opacity=".18"/>');
  b += path('M7 13Q5 15 5 19V29Q5 33 9 33H19Q23 33 23 29V19Q23 15 21 13Z', 'url(#glass)', '#85a9ad', .8);
  const top = wet ? 19 : 28;
  b += rect(6.5, top, 15, 31.7 - top, 3, wet ? 'url(#water)' : '#c4dcdb') + ellipse(14, top, 7.5, 1.4, wet ? '#c0e7e3' : '#e0e9df', '#a5cccb', .4);
  if (stage === 'sprout' || stage === 'ready') for (let i = 0; i < 4; i++) {
    const x = 11 + i * 1.8, end = stage === 'ready' ? 29 : 23;
    b += path(`M${x} 16q${i - 1.5} 7 ${i - 2} ${end - 16}m0-3 2-2m-2 2-1-2`, 'none', '#fff6dc', .65);
  }
  b += rect(7, 12, 14, 4.8, 1.4, '#596e6b', '#465452', .7) + ellipse(14, 12.8, 6.5, 1.5, '#8e9b86');
  for (let i = 0; i < 5; i++) b += path(`M${9 + i * 2.5} 13.6v2`, 'none', '#b0b39d', .45);
  if (stage === 'sown') for (const x of [11, 14, 17]) b += ellipse(x, 12.3, .8, .55, '#d2ac70', '#8d754e', .3);
  if (stage === 'sprout') for (const x of [11, 17]) b += path(`M${x} 12V8`, 'none', '#6d9868', .7) + leaf(x, 9, .28, -65, '#9dbb7c') + leaf(x, 9, .28, 65, '#81a77a');
  if (stage === 'ready') b += path('M14 12V5', 'none', '#62885c', .8) + leaf(14, 10, .53, -65, '#8fae70') + leaf(14, 8, .53, 58, '#7b9c69') + leaf(14, 7, .42, 0, '#b0c48a');
  b += path('M8 19V28M8 29v.5', 'none', '#fcffef', 1.2) + path('M20 21v7', 'none', '#e1f2e6', .6) + ellipse(18, 28, .65, .65, 'none', '#e9f5ed', .4);
  return svg(28, 36, b);
}

export function sprig(species) {
  let b = path('M6 20Q5 12 6 4', 'none', species === 'palmetto' ? '#8a9b73' : '#9b805d', .8);
  if (species === 'palmetto') {
    for (let i = -5; i <= 5; i++) b += path(`M6 9Q${6 + i * .8} 5 ${6 + i} ${2 + Math.abs(i) * .8}Z`, i % 2 ? '#94bba7' : '#689c86', '#527966', .3);
    for (let y = 11; y < 18; y += 2) b += path(`M6 ${y}l-1-1`, 'none', '#637959', .45);
  } else if (species === 'rosemary') {
    for (let y = 4; y < 17; y += 1.6) for (const dx of [-2.5, 2.5]) b += path(`M6 ${y + 1}l${dx} -2`, 'none', dx < 0 ? '#8a9c79' : '#b2bc96', .65);
  } else if (species === 'oak') {
    for (const [x, y, a] of [[6, 7, -50], [6, 10, 55], [6, 14, -55], [6, 5, 15]]) b += leaf(x, y, .38, a, a < 0 ? '#728a59' : '#97a478');
    b += ellipse(8, 15, 1.2, 1.6, '#b28e53', '#886e43', .35) + ellipse(8, 14, 1.4, .6, '#85764e');
  } else {
    b += path('M6 14Q4 7 6 2', 'none', '#a48e60', .6);
    for (let y = 6; y < 15; y += 3.2) b += leaf(6, y, .32, -55, '#adc17c') + leaf(6, y, .32, 55, '#c1af77');
    b += leaf(6, 6, .3, 0, '#afbd74');
  }
  return svg(12, 21, b);
}

export function prop(key) {
  switch (key) {
    case 'vine_leaf': return svg(22, 24, path('M11 22C7 17-2 11 2 5Q7-1 11 5Q17-2 21 5C26 12 14 19 11 22Z', '#94b96b', '#5b7b47', 1) + path('M11 20V6M11 15Q7 9 4 8M11 12Q15 8 18 7', 'none', '#ccda94', .7));
    case 'vine_bulbil': return svg(12, 15, path('M6 2V0', 'none', '#8b9c63', 1) + path('M2 6C0 3 5 1 8 3Q13 3 11 9C11 15 2 16 1 11Z', '#af8c63', '#7e674c', .7) + [3, 7, 9, 5].map((x, i) => ellipse(x, 5 + i * 2, .8, .6, i % 2 ? '#c7a67b' : '#92734f')).join(''));
    case 'decor_butterfly': return svg(20, 16, path('M10 8C0-5-4 9 8 10C0 18 12 19 10 9C12 19 21 17 13 10C26 8 18-5 10 8Z', '#e3ba7b', '#a98458', .65) + path('M10 6V12M10 7 8 4M10 7 12 4', 'none', '#776c50', .7) + [4, 15].map(x => ellipse(x, 7, 1.3, 1.5, '#f7e5af')).join(''));
    case 'decor_deadwood': return svg(34, 16, shadow(17, 13, 16, 2) + path('M3 11L29 4M11 9L7 3M22 6L27 12', 'none', '#b09e7d', 4) + path('M3 10L29 3M12 8 8 3M22 5 26 11', 'none', '#decc9f', 1));
    case 'decor_acorns': return svg(16, 12, shadow(8, 10, 7, 1) + ellipse(5, 7, 2, 3, '#c4a16b', '#9e8257', .5) + ellipse(5, 5, 2.4, 1.2, '#a99a71') + group(ellipse(0, 0, 2, 3, '#bfa475', '#9e8257', .5) + ellipse(0, -2, 2.4, 1.2, '#a99a71'), 'translate(11 7) rotate(55)'));
    case 'decor_tracks': return svg(24, 14, [4, 10, 16, 22].map((x, i) => ellipse(x, i % 2 ? 9 : 4, 1.1, 1.7, '#d4c49f') + path(`M${x - 1} ${i % 2 ? 7 : 2}v-1m1 1v-1m1 1v-1`, 'none', '#cdbb93', .4)).join(''));
    case 'decor_grass': return svg(18, 16, shadow(9, 14, 8, 1.3) + path('M8 14Q3 7 1 7M8 14Q6 3 3 2M9 14Q8 3 10 1M10 14Q12 6 16 4M10 14Q14 9 17 10', 'none', '#a3af7d', .8) + path('M7 13Q5 8 4 7M10 14Q11 7 13 5', 'none', '#c0c28e', .65));
    case 'decor_lichen': return svg(16, 12, shadow(8, 10, 7, 1) + lichen(4, 8, .75) + lichen(10, 9, .85) + lichen(8, 6, .7));
    case 'decor_flower': return svg(12, 14, path('M6 13Q5 9 7 5', 'none', '#9aab75', .7) + leaf(6, 11, .24, -70, '#aebd85') + [0, 60, 120, 180, 240, 300].map(a => group(ellipse(7, 3, 1, 2.2, '#edce82'), `rotate(${a} 7 5)`)).join('') + ellipse(7, 5, 1.2, 1.2, '#c4a267'));
    case 'decor_frond': return svg(20, 12, shadow(10, 10, 8, 1) + path('M3 11L11 6', 'none', '#c0ab7d', .6) + [-5, -3, -1, 1, 3, 5, 7].map(a => path(`M11 6Q${12 + a} 5 ${11 + a} ${1 + Math.abs(a) * .5}Z`, a % 3 ? '#c8ba8e' : '#dfce9f', '#b5a77e', .3)).join(''));
    case 'light_mote': return svg(8, 8, ellipse(4, 4, 4, 4, 'url(#glow)') + ellipse(4, 4, .8, .8, '#fff3bf'));
    case 'green_anole': return svg(16, 8, shadow(8, 7, 7, .6) + path('M1 4Q4 8 7 4Q10 2 13 3', 'none', '#89ad72', 1.5) + ellipse(9, 4, 3, 1.3, '#97bd7c', '#6f935d', .3) + path('M12 4Q15 5 13 6Z', '#deaaa3', 'none') + ellipse(13, 3.2, 2, 1.1, '#aac889', '#6f935d', .3) + ellipse(14, 3, .4, .4, '#50634a') + path('M8 4L6 6M10 4L11 6', 'none', '#799d69', .6));
    case 'figure_tortoise': return svg(12, 12, shadow(6, 11, 5, .8) + rect(2, 8, 2, 3, 1, '#a8906e') + rect(7, 8, 2, 3, 1, '#a8906e') + ellipse(5, 7, 4.3, 3.5, '#bda17b', '#8c775d', .6) + path('M3 5H7L8 8H2ZM4 6H6V7H4Z', 'none', '#d8c29b', .5) + ellipse(10, 8, 1.6, 1.5, '#c1a980', '#8c775d', .5) + ellipse(10.5, 7.7, .3, .3, '#605745'));
    case 'figure_mouse': return svg(12, 12, shadow(6, 11, 5, .8) + path('M2 9Q0 7 1 5', 'none', '#ba9c78', .7) + ellipse(6, 8, 4, 2.5, '#c4a27a', '#a28664', .5) + ellipse(9, 6, 2, 2, '#c4a27a', '#a28664', .5) + ellipse(8, 4, 1.5, 1.6, '#dfbc9d', '#a28664', .5) + ellipse(10, 5.5, .4, .4, '#605745') + ellipse(7, 9.5, 2.5, .7, '#f1e3c3'));
    case 'figure_jay': return svg(12, 12, shadow(6, 11, 5, .8) + path('M2 7L0 11L5 9Z', '#8ba5b0', '#6b8793', .4) + ellipse(6, 7, 3, 3, '#abc2c3', '#738f98', .5) + ellipse(6, 8, 2, 2, '#e2e2c9') + ellipse(8.5, 4, 2.3, 2.3, '#8faeb7', '#738f98', .5) + path('M10.5 4L12 4.5L10.5 5Z', '#6a7772', 'none') + ellipse(9, 3.7, .4, .4, '#596e6b') + path('M5 9V11M7 9V11', 'none', '#7b8070', .5));
    case 'figure_indigo': return svg(12, 12, shadow(6, 11, 5, .8) + path('M1 10C-1 5 11 5 9 9C7 12 3 9 6 5L9 3', 'none', '#8993b0', 2.5) + path('M1 9Q5 6 8 8', 'none', '#c2bed0', .5) + ellipse(9, 3, 2, 1.6, '#9a9eb8', '#737e98', .4) + path('M8 4h2', 'none', '#d6ad95', .7) + ellipse(10, 2.7, .3, .3, '#58657a'));
    case 'crate': return svg(20, 15, shadow(10, 14, 9, 1) + rect(1, 4, 18, 10, 2, '#cfaa7b', '#93714e', .8) + rect(7, 1, 6, 4, 1.5, 'none', '#967653', 1.2) + [5, 9, 13, 17].map(x => rect(x - 1, 6, 1.6, 5, .8, '#78664e')).join('') + path('M2 5H18M2 12H18', 'none', '#edcfa0', .8));
    case 'bottle': return svg(16, 18, shadow(8, 16, 7, 1.4) + group(path('M-6-3H2Q4-3 4-1H7V2H4Q4 4 2 4H-6Q-8 4-8 2V-1Q-8-3-6-3Z', '#80b09c', '#547d6b', .7) + rect(-5, -2.5, 5, 6, .5, '#e7ddbd') + path('M-6-1H-1M2-1H5', 'none', '#d4e6c9', .7), 'translate(9 10) rotate(-38)') + path('M1 16Q8 13 15 16', '#e6d6b1', '#d1bd95', .5));
    case 'tire': return svg(24, 18, shadow(12, 16, 11, 1.7) + ellipse(12, 10, 10, 6.5, '#716b61', '#504d47', .9) + ellipse(12, 8, 10, 5.5, '#858074', '#59584f', .8) + ellipse(12, 8, 5.8, 3, '#4e625d', '#504d47', 1) + ellipse(12, 8.6, 4.7, 2.2, '#99bcb7') + path('M9 8l4-1m-2 3 3-.7', 'none', '#d6e6d2', .5) + [3, 6, 9, 15, 18, 21].map(x => path(`M${x} 10v3`, 'none', '#a29b88', .6)).join('') + leaf(15, 9, .25, 60, '#b6a06c'));
    case 'fence': return svg(32, 32, shadow(16, 30, 15, 1.5) + [4, 27].map(x => path(`M${x - 2} 29V5l2-2 2 2v24Z`, '#b4a488', '#8c806c', .8) + path(`M${x} 6v16m-1 2v3`, 'none', '#d9cbb1', .6)).join('') + [10, 17, 24].map(y => path(`M0 ${y}Q16 ${y + 4} 32 ${y}M10 ${y + 1}l2-2m-2 2 2 2m10-2 2-2m-2 2 2 2`, 'none', '#a08b77', .6)).join(''));
    case 'board': return svg(46, 34, shadow(23, 32, 21, 1) + rect(1, 1, 44, 32, 3, '#bb9164', '#8d704f', .9) + rect(4, 4, 38, 26, 1, '#d0ab79', '#ead2a5', .8) + Array.from({length: 90}, (_, i) => ellipse(6 + ((i * 17) % 34), 6 + ((i * 13) % 23), .4, .25, i % 2 ? '#b28d64' : '#ead0a3')).join('') + path('M2 3H43', 'none', '#e3be8e', .7));
    case 'window': return svg(52, 36, shadow(26, 35, 24, 1) + rect(1, 1, 50, 33, 9, '#d7be99', '#9e896d', .8) + rect(4, 4, 44, 26, 7, '#b9d7d0', '#fff7df', 2) + ellipse(37, 12, 4, 4, '#fff3ba') + path('M6 24Q17 12 28 24Q37 17 46 25V29H6Z', '#94ac82', 'none') + path('M6 27Q21 20 31 27Q39 23 46 28', '#789475', 'none') + path('M26 5v24M5 19h42', 'none', '#fff5db', 2) + rect(0, 31, 52, 4, 2, '#c3a47c', '#998369', .6));
    case 'doormat': return svg(48, 14, ellipse(24, 5, 23, 7, 'url(#glow)') + rect(1, 5, 46, 8, 3, '#95ad87', '#6c8969', .8) + rect(4, 7, 40, 4, 2, 'none', '#cbd3ac', .6) + Array.from({length: 20}, (_, i) => path(`M${4 + i * 2} 6v6`, 'none', '#c0c9a1', .3)).join(''));
    case 'polaroid': return svg(18, 21, rect(.6, .6, 16.8, 19.8, 1, '#fff9e9', '#c7bda4', .5) + rect(2.5, 2.5, 13, 12, .5, '#c5d7bb') + path('M5 18H13', 'none', '#e6d9bf', .6));
    case 'postcard': return svg(22, 16, rect(.5, .5, 21, 15, 1, '#fff5dc', '#baa986', .6) + path('M12 3v10M3 10h6m-6 2h4', 'none', '#c9b797', .5) + rect(16, 2, 4, 5, .4, '#e3b1a1', '#d38f82', .4) + leaf(18, 6, .23, 10, '#849c78'));
    case 'pin': return svg(6, 6, shadow(3.3, 4.5, 2, .8) + ellipse(3, 2.8, 2.3, 2.2, '#d18c77', '#aa6d5a', .4) + ellipse(2.3, 2, .8, .5, '#ffe1be'));
    case 'sparkle': return svg(10, 10, path('M5 .5Q5.6 4.4 9.5 5Q5.6 5.6 5 9.5Q4.4 5.6 .5 5Q4.4 4.4 5 .5Z', '#fff4cb', '#e4c98b', .4));
    case 'ring': return svg(32, 32, ellipse(16, 16, 14, 14, 'none', '#e4f1d9', 2) + ellipse(16, 16, 14, 14, 'none', '#8fc9ad', .8) + path('M4 10l1-2M27 23l1-2', 'none', '#fff9da', 1.8));
    case 'bubble': return svg(34, 32, shadow(18, 25, 13, 2) + path('M8 24C0 24 0 13 5 10C3 3 13 0 17 4C23-1 31 4 30 10C37 14 32 25 25 24Z', '#fff9e9', '#c6bea8', .7) + ellipse(7, 27, 2.4, 2, '#fff9e9', '#c6bea8', .5) + ellipse(3, 30, 1.2, 1, '#fff9e9', '#c6bea8', .4));
    case 'dust': return svg(10, 10, ellipse(5, 5, 4.5, 4.5, 'url(#glow)'));
    case 'flame': return svg(20, 40, '<defs><linearGradient id="fire" x2="0" y2="1"><stop stop-color="#fff5cc"/><stop offset=".5" stop-color="#efbd8d" stop-opacity=".75"/><stop offset="1" stop-color="#e7a590" stop-opacity="0"/></linearGradient></defs>' + path('M2 1Q3 12 10 39Q17 12 18 1Z', 'url(#fire)', 'none'));
    case 'edge_bush': {
      let b = shadow(24, 44, 23, 4) + path('M4 42Q-3 24 10 18Q5 5 20 7Q35-1 37 14Q52 16 44 39Z', '#657e56', '#4e6649', 1);
      for (let i = 0; i < 28; i++) b += leaf(7 + (i * 13) % 35, 14 + (i * 7) % 29, .6, (i % 2 ? -1 : 1) * 45, i % 3 ? '#81986a' : '#9baa7b');
      return svg(48, 48, b);
    }
    default: throw new Error(`Missing prop: ${key}`);
  }
}
