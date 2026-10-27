// ALL visuals live here. Each texture is drawn with Canvas 2D at ART_SCALE× and displayed at
// 1/ART_SCALE so it stays crisp on phones. To swap in real art later, load image files under the
// same texture keys in BootScene and skip the matching draw call — nothing else needs to change.
import Phaser from 'phaser';
import { MAP_H, MAP_W, TILE, WORLD_H, WORLD_W } from '../config';
import { ZoneId, zoneAt } from '../data/map';
import { PAL } from '../data/palette';
import { hash2 } from '../systems/rng';

export const ART_SCALE = 2;

type Ctx = CanvasRenderingContext2D;

function make(scene: Phaser.Scene, key: string, w: number, h: number, draw: (c: Ctx) => void) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, w * ART_SCALE, h * ART_SCALE);
  if (!tex) return;
  const c = tex.getContext();
  c.save();
  c.scale(ART_SCALE, ART_SCALE);
  c.lineJoin = 'round';
  c.lineCap = 'round';
  draw(c);
  c.restore();
  tex.refresh();
}

// --- tiny drawing helpers ---------------------------------------------------------

function ellipse(c: Ctx, x: number, y: number, rx: number, ry: number, fill: string) {
  c.fillStyle = fill;
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  c.fill();
}

function circle(c: Ctx, x: number, y: number, r: number, fill: string) {
  ellipse(c, x, y, r, r, fill);
}

function roundRect(c: Ctx, x: number, y: number, w: number, h: number, r: number, fill: string, stroke?: string) {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
  c.fillStyle = fill;
  c.fill();
  if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = 1.2;
    c.stroke();
  }
}

function line(c: Ctx, x1: number, y1: number, x2: number, y2: number, color: string, width = 1.5) {
  c.strokeStyle = color;
  c.lineWidth = width;
  c.beginPath();
  c.moveTo(x1, y1);
  c.lineTo(x2, y2);
  c.stroke();
}

function blade(c: Ctx, x: number, y: number, len: number, lean: number, color: string, width = 1.6) {
  c.strokeStyle = color;
  c.lineWidth = width;
  c.beginPath();
  c.moveTo(x, y);
  c.quadraticCurveTo(x + lean * 0.3, y - len * 0.6, x + lean, y - len);
  c.stroke();
}

function shadow(c: Ctx, x: number, y: number, rx: number, ry = rx * 0.35) {
  ellipse(c, x, y, rx, ry, PAL.shadow);
}

// --- characters -------------------------------------------------------------------

function drawRobot(c: Ctx) {
  shadow(c, 18, 32, 13, 4);
  // Treads
  roundRect(c, 4, 22, 11, 10, 4, PAL.robotTread);
  roundRect(c, 21, 22, 11, 10, 4, PAL.robotTread);
  for (let i = 0; i < 3; i++) {
    line(c, 6, 24.5 + i * 3, 13, 24.5 + i * 3, '#6a625c', 1);
    line(c, 23, 24.5 + i * 3, 30, 24.5 + i * 3, '#6a625c', 1);
  }
  // Boxy body
  roundRect(c, 8, 13, 20, 13, 2.5, PAL.robotBody, PAL.robotShade);
  roundRect(c, 8, 22, 20, 4, 1.5, PAL.robotShade);
  // Little rust freckles + a leaf sticker
  circle(c, 11, 16, 0.9, PAL.robotShade);
  circle(c, 24, 18, 1.1, PAL.robotShade);
  ellipse(c, 20, 17, 2.4, 1.3, PAL.leafDark);
  // Neck
  line(c, 18, 13, 18, 9, PAL.robotEye, 2);
  // Binocular eyes
  roundRect(c, 9, 2, 8.5, 8, 3, PAL.robotEye);
  roundRect(c, 18.5, 2, 8.5, 8, 3, PAL.robotEye);
  circle(c, 13.2, 6, 2.8, PAL.robotLens);
  circle(c, 22.8, 6, 2.8, PAL.robotLens);
  circle(c, 14.2, 5, 1, PAL.white);
  circle(c, 23.8, 5, 1, PAL.white);
  // Arms
  line(c, 8, 18, 4, 21, PAL.robotEye, 1.8);
  line(c, 28, 18, 32, 21, PAL.robotEye, 1.8);
}

function drawCrate(c: Ctx) {
  roundRect(c, 1, 2, 18, 12, 2, PAL.wood, PAL.woodDark);
  for (let x = 5; x < 18; x += 4) line(c, x, 4, x, 12, PAL.woodDark, 1);
  roundRect(c, 7, 0, 6, 3, 1.5, PAL.woodDark);
}

function drawCat(c: Ctx) {
  shadow(c, 11, 16, 9, 2.5);
  ellipse(c, 10, 11, 7.5, 4.5, '#e08c3c');
  c.strokeStyle = '#e08c3c';
  c.lineWidth = 2.2;
  c.beginPath();
  c.moveTo(3, 10);
  c.quadraticCurveTo(-1, 6, 2, 3);
  c.stroke();
  circle(c, 17, 7.5, 4.2, '#e08c3c');
  c.fillStyle = '#e08c3c';
  c.beginPath();
  c.moveTo(14, 5); c.lineTo(14.5, 1); c.lineTo(17, 4);
  c.moveTo(18, 4); c.lineTo(20.5, 1); c.lineTo(21, 5.5);
  c.fill();
  line(c, 8, 8, 9, 13, '#b8672a', 1.2);
  line(c, 11, 8, 12, 13, '#b8672a', 1.2);
  circle(c, 16, 7, 0.8, PAL.ink);
  circle(c, 19, 7, 0.8, PAL.ink);
  ellipse(c, 10, 14.5, 6, 1.2, '#fbe3c4');
}

function lizard(c: Ctx, len: number, body: string, pattern: string | null, spikes = false) {
  const h = len * 0.45;
  shadow(c, len / 2, h + 1, len * 0.4, 2);
  c.strokeStyle = body;
  c.lineWidth = h * 0.35;
  c.beginPath();
  c.moveTo(len * 0.35, h * 0.6);
  c.quadraticCurveTo(len * 0.12, h * 0.9, 1, h * 0.4);
  c.stroke();
  ellipse(c, len * 0.55, h * 0.6, len * 0.24, h * 0.32, body);
  ellipse(c, len * 0.84, h * 0.55, len * 0.12, h * 0.25, body);
  // Legs
  for (const lx of [0.42, 0.66]) {
    line(c, len * lx, h * 0.6, len * lx - 1.5, h * 0.95, body, 1.6);
    line(c, len * lx, h * 0.6, len * lx + 1.5, h * 0.2, body, 1.6);
  }
  if (pattern) for (let i = 0; i < 4; i++) line(c, len * (0.38 + i * 0.09), h * 0.35, len * (0.38 + i * 0.09), h * 0.85, pattern, 1.2);
  if (spikes) for (let i = 0; i < 5; i++) line(c, len * (0.38 + i * 0.07), h * 0.32, len * (0.4 + i * 0.07), h * 0.12, PAL.leafDark, 1);
  circle(c, len * 0.88, h * 0.48, 0.8, PAL.ink);
}

function drawTortoise(c: Ctx) {
  shadow(c, 13, 18, 11, 3);
  ellipse(c, 23, 12, 3.5, 3, '#9a8a62');
  for (const [x, y] of [[6, 16], [19, 16], [7, 8], [19, 8]]) ellipse(c, x, y, 2.5, 2, '#9a8a62');
  ellipse(c, 13, 12, 10, 7.5, '#8b6b45');
  ellipse(c, 13, 11, 8.5, 6, '#a58257');
  for (const [x, y] of [[13, 10], [9, 12], [17, 12], [10, 8], [16, 8]]) roundRect(c, x - 1.8, y - 1.5, 3.6, 3, 1, '#8b6b45');
  circle(c, 24.5, 11, 0.8, PAL.ink);
}

function drawMouse(c: Ctx) {
  shadow(c, 7, 9.5, 6, 1.5);
  c.strokeStyle = '#c9a98a';
  c.lineWidth = 0.8;
  c.beginPath();
  c.moveTo(2, 7); c.quadraticCurveTo(-1, 4, 1, 1);
  c.stroke();
  ellipse(c, 6.5, 6.5, 4.5, 3, '#c49a6c');
  circle(c, 10.5, 5, 2.5, '#c49a6c');
  circle(c, 9.5, 2.5, 1.8, '#e7c3a8');
  circle(c, 12, 2.6, 1.5, '#e7c3a8');
  circle(c, 11.5, 4.8, 0.6, PAL.ink);
  ellipse(c, 6.5, 8, 3, 1, '#f3e6d6');
}

function drawJay(c: Ctx) {
  shadow(c, 9, 15, 6, 1.6);
  ellipse(c, 8, 9, 5.5, 4, '#5f86c3');
  ellipse(c, 8.5, 10.5, 3.8, 2.4, '#c7c9cc');
  c.fillStyle = '#4a6ea8';
  c.beginPath();
  c.moveTo(3, 8); c.lineTo(-1, 6); c.lineTo(3, 11);
  c.fill();
  circle(c, 13, 6, 3.2, '#5f86c3');
  ellipse(c, 13.5, 7, 1.6, 1, '#d8dade');
  c.fillStyle = PAL.ink;
  c.beginPath();
  c.moveTo(15.8, 5.5); c.lineTo(18, 6.3); c.lineTo(15.8, 7);
  c.fill();
  circle(c, 14, 5.4, 0.7, PAL.ink);
  line(c, 7, 13, 7, 15, PAL.ink, 0.8);
  line(c, 9.5, 13, 9.5, 15, PAL.ink, 0.8);
}

function drawIndigo(c: Ctx) {
  shadow(c, 20, 13, 17, 2.5);
  c.strokeStyle = '#1f2440';
  c.lineWidth = 4;
  c.beginPath();
  c.moveTo(2, 10);
  c.bezierCurveTo(8, 2, 14, 15, 21, 8);
  c.bezierCurveTo(27, 2, 31, 12, 36, 7);
  c.stroke();
  c.strokeStyle = '#4f5d9e';
  c.lineWidth = 1.2;
  c.beginPath();
  c.moveTo(4, 8.5);
  c.bezierCurveTo(9, 2.5, 14, 13, 21, 6.6);
  c.stroke();
  ellipse(c, 37, 6.5, 3, 2.3, '#1f2440');
  ellipse(c, 37.5, 8, 1.8, 1, '#b5523b');
  circle(c, 38, 5.6, 0.6, PAL.white);
}

// --- plants -------------------------------------------------------------------------

function drawCogon(c: Ctx) {
  shadow(c, 15, 27, 11, 3);
  const leans = [-6, -3, -1, 2, 4, 7, -4, 5];
  leans.forEach((l, i) => blade(c, 9 + i * 1.7, 27, 15 + (i % 3) * 3, l, i % 2 ? PAL.cogon : PAL.cogonDark));
  for (const [x, y] of [[5, 9], [14, 6], [21, 9], [10, 11]]) {
    ellipse(c, x, y, 1.6, 3.4, PAL.fluff);
  }
}

function drawPepper(c: Ctx) {
  shadow(c, 22, 41, 16, 4.5);
  line(c, 22, 41, 22, 30, PAL.trunk, 3);
  for (const [x, y, r] of [[14, 24, 9], [30, 24, 9], [22, 16, 10], [22, 27, 10], [12, 31, 6], [32, 31, 6]]) {
    circle(c, x, y, r, PAL.pepper);
  }
  for (const [x, y, r] of [[19, 13, 5], [27, 20, 5], [15, 22, 4]]) circle(c, x, y, r, PAL.pepperLight);
  for (const [x, y] of [[12, 20], [14, 21.5], [29, 28], [31, 26.5], [22, 22], [24, 23], [18, 31]]) circle(c, x, y, 1.6, PAL.berry);
}

function drawAirPotato(c: Ctx) {
  shadow(c, 17, 27, 14, 3.5);
  c.strokeStyle = PAL.vineDark;
  c.lineWidth = 1.4;
  c.beginPath();
  c.moveTo(3, 25); c.bezierCurveTo(8, 5, 20, 22, 26, 6); c.bezierCurveTo(28, 2, 32, 12, 31, 24);
  c.stroke();
  const heart = (x: number, y: number, s: number, col: string) => {
    c.fillStyle = col;
    c.beginPath();
    c.moveTo(x, y + s);
    c.bezierCurveTo(x - s * 1.4, y, x - s * 0.6, y - s, x, y - s * 0.3);
    c.bezierCurveTo(x + s * 0.6, y - s, x + s * 1.4, y, x, y + s);
    c.fill();
  };
  for (const [x, y, s] of [[6, 19, 4], [11, 12, 4.5], [18, 17, 5], [24, 10, 4.5], [29, 17, 4], [15, 23, 4], [24, 23, 4.5]]) {
    heart(x, y, s, (x + y) % 2 ? PAL.vine : PAL.vineDark);
  }
  for (const [x, y] of [[9, 25], [21, 26], [27, 26]]) ellipse(c, x, y, 2.4, 2, PAL.bulbil);
}

function drawNatal(c: Ctx) {
  shadow(c, 15, 27, 10, 3);
  [-5, -2, 1, 4, 6, -6].forEach((l, i) => blade(c, 11 + i * 1.6, 27, 14 + (i % 2) * 4, l, PAL.natalStem, 1.3));
  for (const [x, y] of [[6, 10], [12, 7], [18, 9], [22, 12], [9, 13]]) {
    ellipse(c, x, y, 3, 2.3, PAL.natal);
    ellipse(c, x - 0.6, y - 0.6, 1.6, 1.1, '#e7b8d5');
  }
}

function drawPalmetto(c: Ctx) {
  shadow(c, 17, 28, 13, 3.5);
  const fan = (cx: number, cy: number, angle: number, len: number, col: string) => {
    for (let i = -3; i <= 3; i++) {
      const a = angle + i * 0.17;
      blade(c, cx, cy, len, Math.sin(a) * len, col, 1.6);
    }
  };
  fan(10, 26, -0.7, 16, PAL.leafDark);
  fan(24, 26, 0.7, 16, PAL.leafDark);
  fan(17, 27, 0, 20, PAL.leaf);
  fan(13, 27, -0.25, 14, PAL.leafLight);
}

function drawRosemary(c: Ctx) {
  shadow(c, 15, 26, 12, 3.2);
  ellipse(c, 15, 16, 12, 10, PAL.rosemaryDark);
  ellipse(c, 14, 14, 10, 8, PAL.rosemary);
  for (let i = 0; i < 18; i++) {
    const x = 6 + ((i * 7) % 18);
    const y = 8 + ((i * 5) % 14);
    line(c, x, y, x + 1.5, y - 1.5, '#c4d0b6', 0.8);
  }
}

function drawOak(c: Ctx) {
  shadow(c, 19, 36, 14, 4);
  line(c, 19, 36, 19, 24, PAL.trunk, 3.2);
  for (const [x, y, r] of [[11, 20, 8], [27, 20, 8], [19, 13, 10], [19, 22, 9]]) circle(c, x, y, r, PAL.oakDark);
  for (const [x, y, r] of [[15, 12, 5], [24, 15, 5], [11, 18, 4]]) circle(c, x, y, r, PAL.oak);
  for (const [x, y] of [[13, 24], [25, 25], [20, 18]]) ellipse(c, x, y, 1.3, 1.7, '#8f6a3c');
}

function drawHickory(c: Ctx) {
  shadow(c, 18, 40, 12, 3.5);
  line(c, 18, 40, 18, 22, PAL.trunk, 3);
  line(c, 18, 28, 12, 22, PAL.trunk, 1.8);
  for (const [x, y, r] of [[18, 13, 10], [10, 18, 7], [26, 18, 7], [18, 22, 7]]) circle(c, x, y, r, PAL.hickory);
  for (const [x, y, r] of [[14, 10, 4], [23, 13, 4]]) circle(c, x, y, r, '#a5c47c');
}

// --- hazards ------------------------------------------------------------------------

function drawTire(c: Ctx) {
  shadow(c, 12, 15, 11, 3);
  ellipse(c, 12, 10, 11, 7, PAL.rubber);
  ellipse(c, 12, 10, 5, 3, '#9a8f74');
  ellipse(c, 12, 9.5, 4.5, 2.4, '#7aa6b8');
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    line(c, 12 + Math.cos(a) * 8, 10 + Math.sin(a) * 5, 12 + Math.cos(a) * 10, 10 + Math.sin(a) * 6.3, '#58534f', 1);
  }
}

function drawBottle(c: Ctx) {
  shadow(c, 8, 15, 7, 2);
  c.save();
  c.translate(8, 10);
  c.rotate(-1.1);
  roundRect(c, -4, -6, 8, 12, 3, PAL.glass);
  roundRect(c, -1.8, -10, 3.6, 5, 1, PAL.glass);
  roundRect(c, -2.2, -11, 4.4, 2, 1, '#e0e0e0');
  roundRect(c, -2.5, -4, 1.5, 8, 0.7, 'rgba(255,255,255,0.6)');
  c.restore();
}

function drawFence(c: Ctx) {
  shadow(c, 16, 29, 14, 2.5);
  roundRect(c, 4, 6, 4, 23, 1, PAL.wood, PAL.woodDark);
  roundRect(c, 24, 6, 4, 23, 1, PAL.wood, PAL.woodDark);
  for (const y of [10, 16, 22]) {
    c.strokeStyle = PAL.wire;
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(6, y);
    c.quadraticCurveTo(16, y + 2, 26, y);
    c.stroke();
    for (const x of [11, 16, 21]) line(c, x - 1, y, x + 1, y + 1.5, PAL.wire, 0.8);
  }
}

function drawThicket(c: Ctx) {
  shadow(c, 20, 33, 18, 4);
  for (const [x, y, r] of [[10, 22, 9], [30, 22, 9], [20, 14, 11], [20, 25, 10], [6, 28, 5], [34, 28, 5]]) {
    circle(c, x, y, r, PAL.thicketDark);
  }
  for (const [x, y, r] of [[15, 12, 5], [26, 15, 5], [10, 20, 4]]) circle(c, x, y, r, PAL.thicket);
  c.strokeStyle = '#3d3a22';
  c.lineWidth = 1;
  for (let i = 0; i < 9; i++) {
    c.beginPath();
    c.moveTo(4 + i * 4, 32);
    c.quadraticCurveTo(8 + i * 3, 14, 2 + i * 4.5, 6 + (i % 3) * 3);
    c.stroke();
  }
}

function drawBurrow(c: Ctx) {
  ellipse(c, 15, 12, 14, 7, '#e9d9a8');
  ellipse(c, 15, 10, 11, 5, '#d7c28c');
  ellipse(c, 15, 9, 7, 4, '#5b4632');
  ellipse(c, 15, 10, 5, 2.5, '#3a2c1f');
}

// --- base stations ------------------------------------------------------------------

function drawDock(c: Ctx) {
  shadow(c, 20, 36, 17, 4);
  roundRect(c, 4, 22, 32, 13, 4, '#8e8f88', '#6f706a');
  roundRect(c, 9, 25, 22, 7, 3, '#b8e0a8');
  line(c, 12, 28.5, 28, 28.5, '#7fbf6a', 1);
  // Solar panel on a post
  line(c, 20, 22, 20, 12, '#6f706a', 2);
  c.save();
  c.translate(20, 8);
  c.rotate(-0.12);
  roundRect(c, -15, -6, 30, 11, 1.5, '#38506b', '#24364a');
  for (let x = -10; x <= 10; x += 5) line(c, x, -5.5, x, 4.5, '#5c7da0', 0.8);
  line(c, -14.5, -0.5, 14.5, -0.5, '#5c7da0', 0.8);
  c.restore();
  // Little bolt
  c.fillStyle = '#ffd34d';
  c.beginPath();
  c.moveTo(21, 24); c.lineTo(17, 29); c.lineTo(20, 29); c.lineTo(19, 33); c.lineTo(23, 28); c.lineTo(20, 28);
  c.fill();
}

function drawRecycler(c: Ctx) {
  shadow(c, 18, 37, 15, 3.5);
  roundRect(c, 4, 10, 28, 26, 3, '#5f9a6e', '#477a55');
  roundRect(c, 2, 6, 32, 7, 2.5, '#477a55');
  roundRect(c, 12, 2, 12, 5, 2, '#3c6a49');
  // Recycling arrows
  c.strokeStyle = PAL.white;
  c.lineWidth = 1.8;
  c.beginPath();
  c.arc(18, 24, 6, 0.2, 1.9);
  c.stroke();
  c.beginPath();
  c.arc(18, 24, 6, 2.3, 4.0);
  c.stroke();
  c.beginPath();
  c.arc(18, 24, 6, 4.4, 6.0);
  c.stroke();
  roundRect(c, 8, 30, 20, 3, 1.2, '#3c6a49');
}

function drawPad(c: Ctx) {
  shadow(c, 20, 31, 18, 3);
  roundRect(c, 2, 12, 36, 18, 3, PAL.wood, PAL.woodDark);
  for (let x = 8; x < 36; x += 6) line(c, x, 13, x, 29, PAL.woodDark, 1);
  // Sign with a paw
  line(c, 32, 12, 32, 2, PAL.woodDark, 1.8);
  roundRect(c, 25, 0, 14, 9, 2, '#f3ead4', PAL.woodDark);
  circle(c, 32, 5.5, 2, PAL.ink);
  for (const [x, y] of [[29.5, 3], [31.3, 2], [33, 2], [34.6, 3]]) circle(c, x, y, 0.8, PAL.ink);
}

function drawTray(c: Ctx, stage: 'empty' | 'sown' | 'sprout' | 'ready', wet: boolean) {
  shadow(c, 15, 21, 14, 2.5);
  roundRect(c, 1, 8, 28, 12, 2, PAL.wood, PAL.woodDark);
  roundRect(c, 3, 9, 24, 7, 1.5, wet ? '#5a4330' : '#8a6b4b');
  if (stage === 'sown') for (const x of [7, 12, 17, 22]) circle(c, x, 12.5, 0.9, '#d9c08a');
  if (stage === 'sprout') {
    for (const x of [7, 12, 17, 22]) {
      line(c, x, 13, x, 9, PAL.leaf, 1.2);
      ellipse(c, x - 1.4, 9, 1.6, 0.9, PAL.leafLight);
      ellipse(c, x + 1.4, 9, 1.6, 0.9, PAL.leafLight);
    }
  }
  if (stage === 'ready') {
    for (const x of [8, 15, 22]) {
      line(c, x, 13, x, 4, PAL.leafDark, 1.4);
      ellipse(c, x - 2.5, 6, 3, 1.6, PAL.leaf);
      ellipse(c, x + 2.5, 5, 3, 1.6, PAL.leaf);
      ellipse(c, x, 2.5, 1.8, 2.4, PAL.leafLight);
    }
  }
}

// --- fx -----------------------------------------------------------------------------

function drawSparkle(c: Ctx) {
  c.fillStyle = '#fff6c9';
  c.beginPath();
  c.moveTo(5, 0); c.lineTo(6, 4); c.lineTo(10, 5); c.lineTo(6, 6); c.lineTo(5, 10); c.lineTo(4, 6); c.lineTo(0, 5); c.lineTo(4, 4);
  c.fill();
}

function drawRing(c: Ctx) {
  c.strokeStyle = '#7fe3ff';
  c.lineWidth = 2;
  c.beginPath();
  c.arc(16, 16, 14, 0, Math.PI * 2);
  c.stroke();
}

// --- ground -------------------------------------------------------------------------

const ZONE_GROUND: Record<ZoneId, [string, string]> = {
  base: [PAL.base, PAL.basePath],
  sand: [PAL.sand, PAL.sandShade],
  oak: [PAL.oakGround, PAL.oakGroundShade],
  rosemary: [PAL.bald, PAL.baldShade],
};

function drawGround(c: Ctx) {
  c.fillStyle = PAL.sand;
  c.fillRect(0, 0, WORLD_W, WORLD_H);
  // Overlapping blobs per tile give soft, organic zone borders instead of a grid.
  for (let ty = 0; ty < MAP_H; ty++) {
    for (let tx = 0; tx < MAP_W; tx++) {
      c.fillStyle = ZONE_GROUND[zoneAt(tx, ty)][0];
      c.beginPath();
      c.arc(tx * TILE + 16 + (hash2(tx, ty, 4) - 0.5) * 8, ty * TILE + 16 + (hash2(tx, ty, 5) - 0.5) * 8, 23, 0, Math.PI * 2);
      c.fill();
    }
  }
  // A few large, faint shade patches so the sand isn't flat.
  c.globalAlpha = 0.35;
  for (let ty = 0; ty < MAP_H; ty += 2) {
    for (let tx = 0; tx < MAP_W; tx += 2) {
      if (hash2(tx, ty, 3) > 0.3) continue;
      c.fillStyle = ZONE_GROUND[zoneAt(tx, ty)][1];
      c.beginPath();
      c.ellipse(tx * TILE + 32, ty * TILE + 32, 40 + hash2(tx, ty, 6) * 30, 26 + hash2(tx, ty, 8) * 16, 0, 0, Math.PI * 2);
      c.fill();
    }
  }
  c.globalAlpha = 1;
  // Ground details: grass tufts, lichen, pebbles.
  for (let ty = 0; ty < MAP_H; ty++) {
    for (let tx = 0; tx < MAP_W; tx++) {
      const zone = zoneAt(tx, ty);
      const n = hash2(tx, ty, 11);
      const x = tx * TILE + hash2(tx, ty, 12) * TILE;
      const y = ty * TILE + hash2(tx, ty, 13) * TILE;
      if (zone === 'rosemary' && n < 0.25) {
        ellipse(c, x, y, 3, 2, '#dfe3d2');
        ellipse(c, x + 2, y - 1, 2, 1.4, '#eef0e4');
      } else if ((zone === 'sand' || zone === 'oak') && n < 0.35) {
        for (let i = -1; i <= 1; i++) blade(c, x + i * 1.5, y, 5, i * 2, zone === 'oak' ? '#a4a46a' : '#bfb882', 1);
      } else if (zone === 'base' && n < 0.15) {
        ellipse(c, x, y, 2, 1.4, '#b8a37a');
      } else if (n > 0.93) {
        ellipse(c, x, y, 1.5, 1, '#c4b088');
      }
    }
  }
  // A worn path ring at home base.
  c.strokeStyle = 'rgba(160, 132, 92, 0.35)';
  c.lineWidth = 10;
  c.beginPath();
  c.arc(28 * TILE + 16, 35 * TILE + 16, 3.2 * TILE, 0, Math.PI * 2);
  c.stroke();
  // Wild, unrestored scrub at the map edge.
  for (let tx = 0; tx < MAP_W; tx++) {
    for (const ty of [0, MAP_H - 1]) edgeBush(c, tx, ty);
  }
  for (let ty = 0; ty < MAP_H; ty++) {
    for (const tx of [0, MAP_W - 1]) edgeBush(c, tx, ty);
  }
}

function edgeBush(c: Ctx, tx: number, ty: number) {
  const x = tx * TILE + 16;
  const y = ty * TILE + 16;
  circle(c, x, y, 22 + hash2(tx, ty, 21) * 6, PAL.edgeDark);
  circle(c, x - 4, y - 5, 12 + hash2(tx, ty, 22) * 5, PAL.edge);
}

// --- registry -----------------------------------------------------------------------

export function generateTextures(scene: Phaser.Scene): void {
  make(scene, 'robot', 36, 36, drawRobot);
  make(scene, 'crate', 20, 15, drawCrate);

  make(scene, 'cogon', 30, 30, drawCogon);
  make(scene, 'pepper', 44, 44, drawPepper);
  make(scene, 'airpotato', 34, 30, drawAirPotato);
  make(scene, 'natal', 30, 30, drawNatal);

  make(scene, 'palmetto', 34, 30, drawPalmetto);
  make(scene, 'rosemary', 30, 28, drawRosemary);
  make(scene, 'oak', 38, 38, drawOak);
  make(scene, 'hickory', 36, 42, drawHickory);

  make(scene, 'tire', 24, 18, drawTire);
  make(scene, 'bottle', 16, 18, drawBottle);
  make(scene, 'fence', 32, 32, drawFence);
  make(scene, 'thicket', 40, 36, drawThicket);
  make(scene, 'burrow', 30, 20, drawBurrow);

  make(scene, 'cat', 23, 18, drawCat);
  make(scene, 'tegu', 30, 14, (c) => lizard(c, 30, '#2b2b2b', '#e8e2d0'));
  make(scene, 'iguana', 34, 16, (c) => lizard(c, 34, '#6aa84f', null, true));
  make(scene, 'anole', 16, 8, (c) => lizard(c, 16, '#8a6a48', '#a88760'));
  make(scene, 'tortoise', 28, 20, drawTortoise);
  make(scene, 'mouse', 14, 11, drawMouse);
  make(scene, 'jay', 19, 16, drawJay);
  make(scene, 'indigo', 41, 16, drawIndigo);

  make(scene, 'dock', 40, 40, drawDock);
  make(scene, 'recycler', 36, 40, drawRecycler);
  make(scene, 'pad', 40, 32, drawPad);
  for (const stage of ['empty', 'sown', 'sprout', 'ready'] as const) {
    make(scene, `tray_${stage}_dry`, 30, 22, (c) => drawTray(c, stage, false));
    make(scene, `tray_${stage}_wet`, 30, 22, (c) => drawTray(c, stage, true));
  }

  make(scene, 'sparkle', 10, 10, drawSparkle);
  make(scene, 'ring', 32, 32, drawRing);

  // The ground is big, so it's drawn at 1× — soft edges suit it anyway.
  if (scene.textures.exists('ground')) scene.textures.remove('ground');
  const ground = scene.textures.createCanvas('ground', WORLD_W, WORLD_H);
  if (ground) {
    drawGround(ground.getContext());
    ground.refresh();
  }
}
