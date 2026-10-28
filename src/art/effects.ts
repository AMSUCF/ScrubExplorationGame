// Procedural placeholders for the seasons, weather, fire and mini-game art. Each key is listed with
// its logical size in docs/ART_ASSET_BRIEF_2.md; a delivered PNG with the same key replaces it
// (make() prefers art), so illustrations can arrive one at a time.
import Phaser from 'phaser';
import { Ctx, circle, ellipse, line, make, roundRect, shadow } from './placeholders';

import { EFFECT_SIZES, PICTOGRAMS } from './effectSizes';

export { EFFECT_SIZES, PICTOGRAMS };

/** The best texture for a key: a delivered illustration, else the procedural placeholder. */
export function tex(scene: Phaser.Scene, key: string): string {
  return scene.textures.exists(`art:${key}`) ? `art:${key}` : key;
}

function poly(c: Ctx, pts: number[][], fill: string, stroke?: string, lw = 1.4) {
  c.beginPath();
  pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.closePath();
  c.fillStyle = fill;
  c.fill();
  if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = lw;
    c.stroke();
  }
}

function flame(c: Ctx, x: number, base: number, w: number, h: number, fill: string, stroke?: string) {
  c.beginPath();
  c.moveTo(x, base - h);
  c.bezierCurveTo(x + w * 0.2, base - h * 0.62, x + w * 0.62, base - h * 0.48, x + w * 0.42, base - h * 0.12);
  c.quadraticCurveTo(x + w * 0.3, base, x, base);
  c.quadraticCurveTo(x - w * 0.3, base, x - w * 0.42, base - h * 0.12);
  c.bezierCurveTo(x - w * 0.62, base - h * 0.45, x - w * 0.08, base - h * 0.55, x, base - h);
  c.fillStyle = fill;
  c.fill();
  if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = 1.2;
    c.stroke();
  }
}

function cloud(c: Ctx, x: number, y: number, s: number, fill: string, stroke: string) {
  c.beginPath();
  c.arc(x - s * 0.9, y + s * 0.15, s * 0.65, Math.PI * 0.5, Math.PI * 1.5);
  c.arc(x - s * 0.2, y - s * 0.35, s * 0.85, Math.PI, Math.PI * 1.9);
  c.arc(x + s * 0.75, y + s * 0.05, s * 0.75, Math.PI * 1.35, Math.PI * 0.5);
  c.closePath();
  c.fillStyle = fill;
  c.fill();
  c.strokeStyle = stroke;
  c.lineWidth = 2.6;
  c.stroke();
}

function bolt(c: Ctx, pts: number[][], fill: string, stroke: string) {
  poly(c, pts, fill, stroke, 2.2);
}

// --- world effects -----------------------------------------------------------------------

function drawWildfire(c: Ctx) {
  ellipse(c, 12, 30, 10, 2.4, 'rgba(255, 140, 40, 0.35)');
  flame(c, 7, 31, 11, 19, '#e8572e');
  flame(c, 16, 31, 12, 23, '#ee6a31');
  flame(c, 12, 31, 14, 30, '#f2823a', '#c84a28');
  flame(c, 12, 31, 9, 20, '#f7b24a');
  flame(c, 12, 31, 5, 11, '#fff0b0');
}

function drawSmoke(c: Ctx) {
  for (const [x, y, r, a] of [[12, 13, 9, 0.5], [8, 10, 6, 0.4], [16, 9, 6, 0.4], [12, 7, 5, 0.35]]) ellipse(c, x, y, r, r * 0.9, `rgba(120, 112, 104, ${a})`);
  ellipse(c, 10, 9, 3, 2.4, 'rgba(255,255,255,0.25)');
}

function drawEmber(c: Ctx) {
  circle(c, 3, 3, 3, 'rgba(255, 150, 60, 0.45)');
  circle(c, 3, 3, 1.5, '#ffd27a');
}

function drawScorch(c: Ctx) {
  for (const [x, y, rx, ry, a] of [[22, 15, 21, 13, 0.32], [20, 14, 15, 9, 0.45], [26, 17, 9, 6, 0.4], [14, 18, 7, 5, 0.35]]) ellipse(c, x, y, rx, ry, `rgba(52, 40, 32, ${a})`);
  for (let i = 0; i < 16; i++) circle(c, 7 + ((i * 11) % 30), 6 + ((i * 7) % 17), 0.7, i % 5 ? 'rgba(200, 192, 178, 0.6)' : 'rgba(240, 130, 60, 0.6)');
  for (let i = 0; i < 4; i++) line(c, 10 + i * 6, 12 + (i % 2) * 6, 14 + i * 6, 10 + (i % 2) * 6, 'rgba(35, 28, 22, 0.55)', 1);
}

function drawFirebreak(c: Ctx) {
  ellipse(c, 17, 11, 16.5, 10, 'rgba(175, 145, 98, 0.55)');
  for (let i = 0; i < 6; i++) line(c, 5 + i * 5, 4 + (i % 2), 4 + i * 5, 18 - (i % 2), 'rgba(122, 94, 60, 0.6)', 1.2);
}

function drawResprout(c: Ctx) {
  ellipse(c, 13, 18, 11, 3.6, 'rgba(52, 40, 32, 0.45)');
  roundRect(c, 9, 12, 8, 6, 2, '#4a3a2c');
  for (const [x, lean, len] of [[10, -4, 9], [13, 0, 11], [16, 4, 9], [12, -2, 7], [15, 2, 7]] as const) {
    c.strokeStyle = '#7cab52';
    c.lineWidth = 1.4;
    c.beginPath();
    c.moveTo(x, 13);
    c.quadraticCurveTo(x + lean * 0.3, 13 - len * 0.6, x + lean, 13 - len);
    c.stroke();
    ellipse(c, x + lean, 13 - len, 1.8, 1.1, '#9ccc6e');
  }
}

function drawRaindrop(c: Ctx) {
  line(c, 1.5, 1, 1.5, 13, 'rgba(210, 232, 245, 0.85)', 1.4);
}

function drawPuddle(c: Ctx) {
  ellipse(c, 18, 7, 17, 6, 'rgba(120, 160, 180, 0.35)');
  ellipse(c, 15, 6, 10, 3, 'rgba(220, 240, 250, 0.35)');
}

function drawLeaf(c: Ctx) {
  ellipse(c, 5, 4, 4.4, 2.6, '#9c8a4c');
  line(c, 1.5, 4, 8.5, 4, '#6f6235', 0.7);
}

function drawLightning(c: Ctx) {
  c.save();
  c.shadowColor = 'rgba(255, 250, 200, 0.9)';
  c.shadowBlur = 8;
  bolt(c, [[24, 0], [13, 52], [22, 52], [9, 98], [19, 96], [6, 140], [31, 84], [21, 86], [33, 44], [23, 46], [32, 0]], '#fffbe0', '#f4d670');
  c.restore();
}

function drawFogWisp(c: Ctx) {
  const g = c.createRadialGradient(64, 24, 4, 64, 24, 62);
  g.addColorStop(0, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g;
  c.save();
  c.scale(1, 0.38);
  c.beginPath();
  c.arc(64, 63, 62, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

function drawFirefly(c: Ctx) {
  circle(c, 4, 4, 4, 'rgba(230, 255, 140, 0.35)');
  circle(c, 4, 4, 1.6, '#f6ffb8');
}

function drawFrost(c: Ctx) {
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI;
    line(c, 5 - Math.cos(a) * 4.5, 5 - Math.sin(a) * 4.5, 5 + Math.cos(a) * 4.5, 5 + Math.sin(a) * 4.5, '#e9f6ff', 1.1);
  }
  circle(c, 5, 5, 1.2, '#ffffff');
}

function drawPetal(c: Ctx) {
  ellipse(c, 3, 3, 2.8, 1.8, '#f6bfd0');
  ellipse(c, 2.4, 2.5, 1, 0.6, '#ffe6ee');
}

function drawSeedFluff(c: Ctx) {
  circle(c, 3, 3, 2.6, 'rgba(255, 253, 240, 0.85)');
  line(c, 3, 3, 3, 6, '#cfc39a', 0.6);
}

// --- litter -------------------------------------------------------------------------------

function drawBalloon(c: Ctx) {
  shadow(c, 8, 22, 6, 1.6);
  c.strokeStyle = '#d96d8a';
  c.lineWidth = 0.8;
  c.beginPath();
  c.moveTo(8, 12);
  c.bezierCurveTo(4, 15, 12, 18, 7, 22);
  c.stroke();
  // A half-deflated foil heart, snagged low.
  c.beginPath();
  c.moveTo(8, 13);
  c.bezierCurveTo(1, 9, 2, 2, 6, 3);
  c.quadraticCurveTo(8, 4, 8.5, 6);
  c.quadraticCurveTo(10, 3, 12, 3.5);
  c.bezierCurveTo(15, 5, 14, 10, 8, 13);
  c.fillStyle = '#e8a0b4';
  c.fill();
  c.strokeStyle = '#c4728a';
  c.lineWidth = 0.9;
  c.stroke();
  ellipse(c, 5.5, 6, 1.6, 1, 'rgba(255,255,255,0.7)');
}

function drawPlastic(c: Ctx) {
  shadow(c, 10, 12, 8, 1.8);
  poly(c, [[3, 11], [2, 5], [5, 2], [7, 4], [10, 2], [13, 4], [16, 2], [18, 6], [17, 11], [10, 12.5]], 'rgba(238, 240, 236, 0.92)', '#b9bdb6', 0.9);
  line(c, 6, 6, 9, 10, '#d6dad2', 0.8);
  line(c, 12, 5, 14, 10, '#d6dad2', 0.8);
}

function drawCan(c: Ctx) {
  shadow(c, 7, 8.5, 6, 1.4);
  c.save();
  c.translate(7, 5);
  c.rotate(-0.25);
  roundRect(c, -6, -3, 12, 6, 2, '#d9573f', '#a8402e');
  roundRect(c, -6, -3, 2, 6, 1, '#cfd3d6');
  line(c, -1, -2.5, 3, 2.5, '#f2b7a8', 0.8);
  c.restore();
}

// --- burrow guests -------------------------------------------------------------------------

function drawFrog(c: Ctx) {
  shadow(c, 9, 12.5, 7, 1.6);
  ellipse(c, 9, 8.5, 7, 4.6, '#b9a77a');
  for (const [x, y] of [[6, 7], [10, 6], [12, 9], [7, 10], [9, 8.5]]) circle(c, x, y, 1.1, '#6c5a3c');
  ellipse(c, 14.2, 6.6, 2.8, 2.4, '#b9a77a');
  circle(c, 15, 5.4, 1.3, '#2e2a24');
  circle(c, 15.3, 5.1, 0.4, '#ffffff');
  ellipse(c, 4.5, 11.4, 3, 1.4, '#a8966a');
  ellipse(c, 13.5, 11.6, 2.2, 1.1, '#a8966a');
}

function drawBeetle(c: Ctx) {
  shadow(c, 6, 8, 5, 1.2);
  ellipse(c, 6, 5, 4.6, 3.4, '#3a3226');
  line(c, 6, 1.8, 6, 8, '#5d5240', 0.6);
  ellipse(c, 10.2, 5, 1.6, 1.4, '#2d271e');
  ellipse(c, 4.6, 3.8, 1.4, 0.8, 'rgba(255,255,255,0.3)');
  for (const y of [4, 6, 7.5]) {
    line(c, 3, y, 1, y + 1, '#2d271e', 0.6);
    line(c, 9, y, 11, y + 1, '#2d271e', 0.6);
  }
}

function drawCricket(c: Ctx) {
  shadow(c, 8, 9.6, 6, 1.2);
  ellipse(c, 8, 6, 5, 3, '#b58c5c');
  c.strokeStyle = '#8d6a42';
  c.lineWidth = 0.9;
  c.beginPath();
  c.moveTo(4, 6.5); c.lineTo(1, 2); c.lineTo(0.5, 9);
  c.moveTo(10, 7); c.lineTo(14, 3); c.lineTo(15, 9.5);
  c.stroke();
  circle(c, 12.3, 5.3, 2, '#b58c5c');
  c.beginPath();
  c.moveTo(13.5, 4.5); c.quadraticCurveTo(15, 0, 9, 1);
  c.stroke();
  circle(c, 13, 5, 0.6, '#3d3328');
}

// --- guide illustrations ------------------------------------------------------------------

function drawFireCard(c: Ctx) {
  roundRect(c, 1, 1, 46, 46, 10, '#f8e6c4');
  ellipse(c, 24, 40, 20, 5, '#d9c49a');
  for (const x of [10, 18, 30, 38]) {
    c.strokeStyle = '#6f9a5a';
    c.lineWidth = 1.4;
    for (let i = -2; i <= 2; i++) {
      c.beginPath();
      c.moveTo(x, 40);
      c.lineTo(x + i * 3, 31 - Math.abs(i));
      c.stroke();
    }
  }
  flame(c, 24, 40, 18, 28, '#f2823a', '#c84a28');
  flame(c, 24, 40, 11, 17, '#f7b24a');
  flame(c, 24, 40, 5, 8, '#fff0b0');
}

function drawStormCard(c: Ctx) {
  roundRect(c, 1, 1, 46, 46, 10, '#d9e4ec');
  cloud(c, 24, 18, 9, '#8d98a8', '#6c7686');
  bolt(c, [[24, 22], [19, 33], [24, 33], [20, 44], [30, 29], [25, 29], [29, 22]], '#ffe680', '#d9b640');
  for (const x of [11, 15, 35, 39]) line(c, x, 28, x - 2, 34, '#8fb4cc', 1.4);
}

function drawEdgeCard(c: Ctx) {
  roundRect(c, 1, 1, 46, 46, 10, '#ede3c6');
  c.fillStyle = '#b9b2a2';
  c.fillRect(1, 31, 46, 6);
  for (let x = 4; x < 46; x += 8) line(c, x, 34, x + 4, 34, '#f4efdf', 1);
  for (const x of [8, 22, 36]) roundRect(c, x, 14, 3, 17, 1, '#9a7350', '#6e5038');
  line(c, 8, 18, 39, 18, '#8d8d8d', 1);
  line(c, 8, 24, 39, 24, '#8d8d8d', 1);
  for (const [x, y] of [[14, 9], [29, 7], [40, 11]]) {
    circle(c, x, y, 2.4, '#fffdf0');
    line(c, x, y, x - 2, y + 3, '#cfc39a', 0.8);
  }
  ellipse(c, 24, 42, 9, 3, '#c98bb5');
}

// --- mini-game backdrops ------------------------------------------------------------------

function drawBurrowSection(c: Ctx) {
  const sky = c.createLinearGradient(0, 0, 0, 40);
  sky.addColorStop(0, '#cfe7ef');
  sky.addColorStop(1, '#f1ecd8');
  c.fillStyle = sky;
  c.fillRect(0, 0, 180, 40);
  const sand = c.createLinearGradient(0, 36, 0, 320);
  sand.addColorStop(0, '#e9d6a6');
  sand.addColorStop(0.5, '#d7bb84');
  sand.addColorStop(1, '#b8945e');
  c.fillStyle = sand;
  c.fillRect(0, 36, 180, 284);
  for (let i = 0; i < 140; i++) circle(c, (i * 37) % 180, 44 + ((i * 53) % 270), 0.6 + (i % 3) * 0.3, i % 4 ? 'rgba(255,255,255,0.35)' : 'rgba(120,90,50,0.3)');
  // Roots hanging into the sand.
  for (const [x, len] of [[30, 60], [140, 80], [96, 40]]) {
    c.strokeStyle = 'rgba(122, 90, 60, 0.55)';
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(x, 36);
    c.bezierCurveTo(x + 6, 36 + len * 0.4, x - 8, 36 + len * 0.7, x + 3, 36 + len);
    c.stroke();
  }
  // The tunnel slopes down from the apron at the top-left into a chamber at the bottom.
  c.strokeStyle = '#6a4f34';
  c.lineWidth = 30;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(30, 40);
  c.bezierCurveTo(130, 90, 30, 170, 120, 220);
  c.quadraticCurveTo(160, 245, 120, 285);
  c.stroke();
  c.strokeStyle = '#4b3826';
  c.lineWidth = 22;
  c.stroke();
  ellipse(c, 112, 288, 30, 18, '#4b3826');
  ellipse(c, 30, 38, 22, 6, '#e9d6a6');
  ellipse(c, 30, 40, 14, 4, '#3d2d1f');
}

function drawDigSand(c: Ctx) {
  const g = c.createRadialGradient(135, 135, 10, 135, 135, 180);
  g.addColorStop(0, '#efe0b6');
  g.addColorStop(1, '#d9c393');
  c.fillStyle = g;
  c.fillRect(0, 0, 270, 270);
  for (let i = 0; i < 420; i++) circle(c, (i * 61) % 270, (i * 97) % 270, 0.4 + (i % 4) * 0.25, i % 5 ? 'rgba(255,255,255,0.4)' : 'rgba(140,110,70,0.25)');
}

// --- pictograms (64×64, soft pastel fill with a darker same-hue outline) -------------------

function pict(key: string, c: Ctx) {
  c.lineJoin = 'round';
  c.lineCap = 'round';
  switch (key) {
    case 'breezy':
      for (const [y, len, curl] of [[20, 40, 1], [32, 48, -1], [44, 34, 1]] as const) {
        c.strokeStyle = '#6f97a8';
        c.lineWidth = 5;
        c.beginPath();
        c.moveTo(8, y);
        c.lineTo(8 + len, y);
        c.arc(8 + len, y - 6 * curl, 6, Math.PI / 2 * curl, -Math.PI / 2 * curl, curl < 0);
        c.stroke();
        c.strokeStyle = '#b8d7e2';
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(10, y);
        c.lineTo(6 + len, y);
        c.stroke();
      }
      break;
    case 'heat':
      roundRect(c, 27, 8, 10, 36, 5, '#f4e6d6', '#b9785e');
      circle(c, 32, 48, 9, '#e8735a');
      c.strokeStyle = '#b9545a';
      c.lineWidth = 2.4;
      c.beginPath();
      c.arc(32, 48, 9, 0, Math.PI * 2);
      c.stroke();
      line(c, 32, 44, 32, 18, '#e8735a', 4);
      for (const y of [16, 24, 32]) line(c, 40, y, 46, y, '#c79a76', 2);
      break;
    case 'rain':
      cloud(c, 33, 24, 11, '#dfe8ef', '#8fa3b4');
      for (const x of [20, 32, 44]) {
        c.beginPath();
        c.moveTo(x, 40);
        c.quadraticCurveTo(x - 4, 48, x, 51);
        c.quadraticCurveTo(x + 4, 48, x, 40);
        c.fillStyle = '#8fc6dd';
        c.fill();
        c.strokeStyle = '#5f97ad';
        c.lineWidth = 1.6;
        c.stroke();
      }
      break;
    case 'storm':
      cloud(c, 33, 22, 12, '#a5adbb', '#6c7686');
      bolt(c, [[32, 30], [24, 46], [31, 46], [26, 60], [42, 40], [34, 40], [39, 30]], '#ffe680', '#c9a43a');
      break;
    case 'hurricane':
      c.strokeStyle = '#6f88a8';
      c.lineWidth = 6;
      c.beginPath();
      for (let i = 0; i <= 60; i++) {
        const a = i * 0.2, r = 4 + i * 0.42;
        const x = 32 + Math.cos(a) * r, y = 32 + Math.sin(a) * r;
        i ? c.lineTo(x, y) : c.moveTo(x, y);
      }
      c.stroke();
      c.strokeStyle = '#c3d3e6';
      c.lineWidth = 2;
      c.stroke();
      circle(c, 32, 32, 4, '#eef3f8');
      break;
    case 'fog':
      for (const [y, x0, x1] of [[20, 10, 48], [32, 16, 56], [44, 8, 44]]) {
        line(c, x0, y, x1, y, '#a9b3b6', 8);
        line(c, x0, y, x1, y, '#e3e8e8', 4);
      }
      break;
    case 'cold':
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI + Math.PI / 2;
        const dx = Math.cos(a) * 24, dy = Math.sin(a) * 24;
        line(c, 32 - dx, 32 - dy, 32 + dx, 32 + dy, '#7fa8c9', 6);
        line(c, 32 - dx, 32 - dy, 32 + dx, 32 + dy, '#dff0fb', 2.4);
        for (const s of [-1, 1]) {
          const ex = 32 + dx * 0.6 * s, ey = 32 + dy * 0.6 * s;
          line(c, ex, ey, ex + Math.cos(a + 0.7 * s) * 7 * s, ey + Math.sin(a + 0.7 * s) * 7 * s, '#7fa8c9', 3);
          line(c, ex, ey, ex + Math.cos(a - 0.7 * s) * 7 * s, ey + Math.sin(a - 0.7 * s) * 7 * s, '#7fa8c9', 3);
        }
      }
      break;
    case 'spring':
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
        c.save();
        c.translate(32 + Math.cos(a) * 12, 30 + Math.sin(a) * 12);
        c.rotate(a + Math.PI / 2);
        ellipse(c, 0, 0, 8, 11, '#f6bfd0');
        c.strokeStyle = '#d48aa2';
        c.lineWidth = 2;
        c.beginPath();
        c.ellipse(0, 0, 8, 11, 0, 0, Math.PI * 2);
        c.stroke();
        c.restore();
      }
      circle(c, 32, 30, 6, '#f4d27a');
      line(c, 32, 44, 30, 58, '#7ea366', 3);
      break;
    case 'summer':
      circle(c, 32, 26, 12, '#f7c95e');
      c.strokeStyle = '#d99a3a';
      c.lineWidth = 2.6;
      c.beginPath();
      c.arc(32, 26, 12, 0, Math.PI * 2);
      c.stroke();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        line(c, 32 + Math.cos(a) * 17, 26 + Math.sin(a) * 17, 32 + Math.cos(a) * 22, 26 + Math.sin(a) * 22, '#e4a84a', 3);
      }
      for (const y of [48, 56]) {
        c.strokeStyle = '#6fa3bd';
        c.lineWidth = 3.5;
        c.beginPath();
        for (let x = 8; x <= 56; x += 2) c.lineTo(x, y + Math.sin(x / 4) * 2);
        c.stroke();
      }
      break;
    case 'fall':
      c.save();
      c.translate(28, 28);
      c.rotate(-0.5);
      ellipse(c, 0, 0, 10, 17, '#e3a05a');
      c.strokeStyle = '#a8653a';
      c.lineWidth = 2.4;
      c.beginPath();
      c.ellipse(0, 0, 10, 17, 0, 0, Math.PI * 2);
      c.stroke();
      line(c, 0, -14, 0, 22, '#a8653a', 2);
      c.restore();
      ellipse(c, 44, 46, 7, 9, '#b98a52');
      roundRect(c, 36, 34, 16, 7, 3, '#8d6a42', '#6a4e30');
      break;
    case 'winter':
      for (const [y, col] of [[22, '#e88f80'], [30, '#f3e7c9'], [38, '#7fb0a6']] as const) roundRect(c, 10, y, 44, 8, 4, col, '#9a7a68');
      roundRect(c, 36, 38, 9, 20, 3, '#e88f80', '#9a7a68');
      for (const x of [38, 41, 44]) line(c, x, 58, x, 62, '#9a7a68', 1.6);
      break;
    case 'fire':
      flame(c, 32, 58, 34, 52, '#f2823a', '#c84a28');
      flame(c, 32, 58, 22, 33, '#f7b24a');
      flame(c, 32, 58, 11, 16, '#fff0b0');
      break;
    case 'douse':
      roundRect(c, 10, 24, 26, 14, 5, '#e8735a', '#b9545a');
      roundRect(c, 34, 27, 12, 8, 3, '#cfd3d6', '#8e959b');
      line(c, 18, 38, 14, 52, '#b9545a', 4);
      for (const [x, y] of [[52, 22], [56, 31], [53, 40], [60, 26], [60, 37]]) {
        circle(c, x, y, 2.8, '#8fc6dd');
      }
      break;
    case 'rake':
      line(c, 14, 54, 44, 14, '#b98a5e', 4.5);
      roundRect(c, 34, 8, 24, 6, 3, '#9aa3ad', '#6f7880');
      for (let i = 0; i < 5; i++) line(c, 37 + i * 5, 14, 35 + i * 5, 22, '#6f7880', 2.4);
      break;
    case 'torch':
      roundRect(c, 12, 26, 26, 30, 6, '#d9573f', '#a8402e');
      line(c, 34, 32, 50, 20, '#9aa3ad', 4);
      line(c, 50, 20, 54, 24, '#9aa3ad', 3);
      flame(c, 55, 26, 9, 14, '#f7b24a', '#d9832e');
      roundRect(c, 18, 20, 14, 7, 2, '#5f6b74');
      break;
    case 'dig':
      c.save();
      c.translate(36, 26);
      c.rotate(0.7);
      roundRect(c, -3, -20, 6, 18, 2, '#b98a5e', '#8d6845');
      c.beginPath();
      c.moveTo(-8, -2);
      c.lineTo(8, -2);
      c.quadraticCurveTo(6, 16, 0, 22);
      c.quadraticCurveTo(-6, 16, -8, -2);
      c.fillStyle = '#c3c9cf';
      c.fill();
      c.strokeStyle = '#7f878e';
      c.lineWidth = 2.2;
      c.stroke();
      c.restore();
      c.strokeStyle = '#efe6cf';
      c.lineWidth = 4;
      c.beginPath();
      c.moveTo(6, 52);
      c.bezierCurveTo(16, 44, 22, 58, 32, 50);
      c.stroke();
      c.strokeStyle = '#c4b48c';
      c.lineWidth = 1.6;
      c.stroke();
      break;
    case 'scope':
      c.strokeStyle = '#5f6b74';
      c.lineWidth = 6;
      c.beginPath();
      c.moveTo(10, 10);
      c.bezierCurveTo(40, 10, 20, 40, 44, 46);
      c.stroke();
      circle(c, 48, 48, 10, '#a8dccf');
      c.strokeStyle = '#4c7f73';
      c.lineWidth = 2.6;
      c.beginPath();
      c.arc(48, 48, 10, 0, Math.PI * 2);
      c.stroke();
      circle(c, 48, 48, 4.5, '#2f4a46');
      circle(c, 46, 46, 1.6, '#ffffff');
      break;
    case 'sort':
      for (const [x, col, edge] of [[8, '#9fc7a0', '#5f8f62'], [25, '#9cc6dd', '#5f8fad'], [42, '#f2cf7a', '#b9923a']] as const) {
        roundRect(c, x, 26, 15, 28, 4, col, edge);
        roundRect(c, x - 1, 21, 17, 6, 3, edge);
      }
      break;
    case 'task':
      roundRect(c, 12, 10, 40, 48, 6, '#f6ecd2', '#a88c62');
      roundRect(c, 22, 6, 20, 9, 3, '#a8dccf', '#5f8f80');
      for (const y of [24, 36, 48]) {
        c.strokeStyle = '#6f9a5a';
        c.lineWidth = 3;
        c.beginPath();
        c.moveTo(18, y);
        c.lineTo(21, y + 3);
        c.lineTo(26, y - 3);
        c.stroke();
        line(c, 30, y, 46, y, '#c4b48c', 2.6);
      }
      break;
    case 'level': {
      c.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 11 : 25;
        const x = 32 + Math.cos(a) * r, y = 33 + Math.sin(a) * r;
        i ? c.lineTo(x, y) : c.moveTo(x, y);
      }
      c.closePath();
      c.fillStyle = '#f7d77e';
      c.fill();
      c.strokeStyle = '#c9a03a';
      c.lineWidth = 2.6;
      c.stroke();
      ellipse(c, 32, 34, 5, 8, '#7ea366');
      line(c, 32, 28, 32, 40, '#56794a', 1.4);
      break;
    }
    case 'edge':
      for (const x of [14, 32, 50]) roundRect(c, x - 3, 22, 6, 32, 2, '#b98a5e', '#8d6845');
      line(c, 11, 30, 53, 30, '#8d8d8d', 2);
      line(c, 11, 42, 53, 42, '#8d8d8d', 2);
      c.strokeStyle = '#c9553f';
      c.lineWidth = 4;
      c.beginPath();
      c.moveTo(6, 10);
      c.quadraticCurveTo(30, 4, 40, 16);
      c.stroke();
      poly(c, [[44, 20], [34, 18], [42, 10]], '#c9553f');
      break;
    case 'tank':
      roundRect(c, 14, 14, 36, 42, 8, '#dfeef2', '#6f97a8');
      roundRect(c, 16, 32, 32, 22, 6, '#8fc6dd');
      roundRect(c, 24, 8, 16, 7, 3, '#6f97a8');
      ellipse(c, 22, 26, 2.4, 6, 'rgba(255,255,255,0.7)');
      break;
  }
}

export function generateEffectTextures(scene: Phaser.Scene): void {
  const draw: Record<string, (c: Ctx) => void> = {
    wildfire: drawWildfire, smoke: drawSmoke, ember: drawEmber, scorch: drawScorch, firebreak: drawFirebreak, resprout: drawResprout,
    raindrop: drawRaindrop, puddle: drawPuddle, leaf_blown: drawLeaf, lightning: drawLightning, fog_wisp: drawFogWisp, firefly: drawFirefly,
    frost: drawFrost, petal: drawPetal, seed_fluff: drawSeedFluff,
    balloon: drawBalloon, plastic: drawPlastic, can: drawCan,
    frog: drawFrog, beetle: drawBeetle, cricket: drawCricket,
    fire: drawFireCard, storm: drawStormCard, edge: drawEdgeCard,
    burrow_section: drawBurrowSection, dig_sand: drawDigSand,
  };
  for (const [key, fn] of Object.entries(draw)) {
    const [w, h] = EFFECT_SIZES[key];
    make(scene, key, w, h, fn);
  }
  for (const key of PICTOGRAMS) make(scene, `ui_${key}`, 64, 64, (c) => pict(key, c));
}
