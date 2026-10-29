// Visuals live in src/art/ (this file: world + shared helpers; robot.ts; home.ts). Each texture is drawn with Canvas 2D at ART_SCALE× and displayed at
// 1/ART_SCALE so it stays crisp on phones. To swap in real art later, load image files under the
// same texture keys in BootScene and skip the matching draw call — nothing else needs to change.
import Phaser from 'phaser';
import { MAP_H, MAP_W, TILE, WORLD_H, WORLD_W } from '../config';
import { ZoneId, zoneAt } from '../data/map';
import { PAL } from '../data/palette';
import { hash2 } from '../systems/rng';
import { generateHomeTextures } from './home';
import { generateRobotTextures } from './robot';
import catalog from './catalog.json';

export const ART_SCALE = 2;

export type Ctx = CanvasRenderingContext2D;

/** A finished illustration delivered for this key (see public/art/ and docs/ART_ASSET_BRIEF.md). */
export function artImage(scene: Phaser.Scene, key: string): CanvasImageSource | null {
  const k = `art:${key}`;
  return scene.textures.exists(k) ? (scene.textures.get(k).getSourceImage() as CanvasImageSource) : null;
}

export function make(scene: Phaser.Scene, key: string, w: number, h: number, draw: (c: Ctx) => void) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, w * ART_SCALE, h * ART_SCALE);
  if (!tex) return;
  const paint = () => {
    const c = tex.getContext();
    c.save();
    c.scale(ART_SCALE, ART_SCALE);
    c.lineJoin = 'round';
    c.lineCap = 'round';
    // Real art wins over the placeholder; it's scaled into the same logical box so nothing else changes.
    const art = artImage(scene, key);
    if (art) c.drawImage(art, 0, 0, w, h);
    else draw(c);
    c.restore();
    tex.refresh();
  };
  paint();
  // A GPU reset (common on Android after the browser is backgrounded) can blank every canvas, and
  // Phaser would then re-upload empty sprites. Draw it again, unless the key now has a new texture.
  tex.canvas.addEventListener('contextrestored', () => scene.textures.get(key) === tex && paint());
}

// --- tiny drawing helpers ---------------------------------------------------------

export function ellipse(c: Ctx, x: number, y: number, rx: number, ry: number, fill: string) {
  c.fillStyle = fill;
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  c.fill();
}

export function circle(c: Ctx, x: number, y: number, r: number, fill: string) {
  ellipse(c, x, y, r, r, fill);
}

export function roundRect(c: Ctx, x: number, y: number, w: number, h: number, r: number, fill: string, stroke?: string) {
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

export function line(c: Ctx, x1: number, y1: number, x2: number, y2: number, color: string, width = 1.5) {
  c.strokeStyle = color;
  c.lineWidth = width;
  c.beginPath();
  c.moveTo(x1, y1);
  c.lineTo(x2, y2);
  c.stroke();
}

export function blade(c: Ctx, x: number, y: number, len: number, lean: number, color: string, width = 1.6) {
  c.strokeStyle = color;
  c.lineWidth = width;
  c.beginPath();
  c.moveTo(x, y);
  c.quadraticCurveTo(x + lean * 0.3, y - len * 0.6, x + lean, y - len);
  c.stroke();
}

export function shadow(c: Ctx, x: number, y: number, rx: number, ry = rx * 0.35) {
  ellipse(c, x, y, rx, ry, PAL.shadow);
}

// --- characters -------------------------------------------------------------------

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

/** Logical size of one seamless ground tile from the illustrator. */
export const GROUND_TILE = 128;
/** Device pixels per world pixel for the ground: 2× keeps sand grains crisp at phone zoom. */
export const GROUND_SCALE = 2;

/** A ground tile repeated at its logical size in whatever context draws it. */
type GroundPatterns = (ctx: Ctx, zone: ZoneId) => CanvasPattern | null;

/** Free a big scratch canvas now instead of waiting for garbage collection (iOS caps canvas memory). */
function release(canvas: HTMLCanvasElement) {
  canvas.width = 0;
  canvas.height = 0;
}

/**
 * Let the browser paint and handle input between the slow stages of drawing the ground. Canvas
 * drawing is deferred until something needs the pixels, so reading one makes the stage finish now.
 */
const breathe = (ctx?: Ctx) => {
  ctx?.getImageData(0, 0, 1, 1);
  return new Promise<void>((resolve) => setTimeout(resolve, 0));
};

/** Draws the whole world floor into `c`, which is `scale` device pixels per world pixel. */
async function drawGround(c: Ctx, scale: number, tiles: GroundPatterns, art: (key: string) => CanvasImageSource | null) {
  const scratch: HTMLCanvasElement[] = [];
  const canvas = (w: number, h: number) => {
    const el = document.createElement('canvas');
    el.width = w; el.height = h;
    scratch.push(el);
    return el;
  };
  try {
    await drawGroundLayers(c, scale, tiles, art, canvas);
  } finally {
    scratch.forEach(release);
  }
}

async function drawGroundLayers(
  c: Ctx, scale: number, tiles: GroundPatterns, art: (key: string) => CanvasImageSource | null,
  canvas: (w: number, h: number) => HTMLCanvasElement,
) {
  const edge = art('edge_bush');
  c.save();
  c.setTransform(scale, 0, 0, scale, 0, 0);
  c.fillStyle = tiles(c, 'sand') ?? PAL.sand;
  c.fillRect(0, 0, WORLD_W, WORLD_H);
  // Feather zone masks together once at boot. Individual tile circles never show through.
  // The soft masks are drawn at 1× (their blur hides any resolution); each zone's texture is then
  // painted through the enlarged mask at full ground resolution. Like the ground (Phaser makes it with
  // willReadFrequently), these canvases live in main memory, so copying them in needs no GPU read-back.
  const layer = canvas(WORLD_W, WORLD_H);
  const mask = layer.getContext('2d', { willReadFrequently: true })!;
  // At 1× the texture is painted straight into the mask, as it always was; only 2× needs a second canvas.
  const fill = scale === 1 ? layer : canvas(WORLD_W * scale, WORLD_H * scale);
  const paint = fill.getContext('2d', { willReadFrequently: true })!;
  paint.setTransform(scale, 0, 0, scale, 0, 0);
  // Each zone takes several steps; yielding between them keeps title-screen taps responsive on slow phones.
  for (const zone of ['oak', 'rosemary', 'base'] as ZoneId[]) {
    await breathe(c);
    let left = WORLD_W, top = WORLD_H, right = 0, bottom = 0;
    mask.beginPath();
    for (let ty = 0; ty < MAP_H; ty++) for (let tx = 0; tx < MAP_W; tx++) {
      if (zoneAt(tx, ty) !== zone) continue;
      left = Math.min(left, tx * TILE); right = Math.max(right, (tx + 1) * TILE);
      top = Math.min(top, ty * TILE); bottom = Math.max(bottom, (ty + 1) * TILE);
      const x = tx * TILE + 16 + (hash2(tx, ty, 4) - .5) * 8;
      const y = ty * TILE + 16 + (hash2(tx, ty, 5) - .5) * 8;
      mask.moveTo(x + 25, y); mask.arc(x, y, 25, 0, Math.PI * 2);
    }
    if (right <= left) continue;
    // Each zone covers only part of the map, so the blur, texture and composite work just inside its
    // bounds, padded for the circles (16 px out from the tile edge) and their blur's reach (3σ = 45 px).
    const pad = 64;
    const x = Math.max(0, left - pad), y = Math.max(0, top - pad);
    const w = Math.min(WORLD_W, right + pad) - x, h = Math.min(WORLD_H, bottom + pad) - y;
    // Clear all of the small mask: the 2× upscale samples a pixel past the bounds, where the last zone's mask is.
    mask.clearRect(0, 0, WORLD_W, WORLD_H);
    mask.filter = 'blur(15px)';
    mask.fillStyle = '#ffffff';
    mask.fill();
    mask.filter = 'none';
    await breathe(mask);
    if (fill !== layer) {
      paint.clearRect(x, y, w, h);
      paint.drawImage(layer, x, y, w, h, x, y, w, h);
      await breathe(paint);
    }
    paint.globalCompositeOperation = 'source-in';
    paint.fillStyle = tiles(paint, zone) ?? ZONE_GROUND[zone][0];
    paint.fillRect(x, y, w, h);
    paint.globalCompositeOperation = 'source-over';
    await breathe(paint);
    c.drawImage(fill, x * scale, y * scale, w * scale, h * scale, x, y, w, h);
  }
  release(layer);
  release(fill);
  await breathe(c);
  // Low-contrast, diffuse sun and canopy washes, with no hard circular edges.
  for (let ty = 0; ty < MAP_H; ty += 3) {
    for (let tx = 0; tx < MAP_W; tx += 3) {
      const x = tx * TILE, y = ty * TILE, r = 35 + hash2(tx, ty, 3) * 55;
      const wash = c.createRadialGradient(x, y, 0, x, y, r);
      wash.addColorStop(0, hash2(tx, ty, 6) > .5 ? 'rgba(118, 133, 83, .035)' : 'rgba(255, 251, 221, .065)');
      wash.addColorStop(1, 'rgba(255, 251, 221, 0)');
      c.fillStyle = wash; c.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }
  c.globalAlpha = 1;
  await breathe(c);
  // Feather several grain/leaf-litter variants over each habitat instead of repeating one tile.
  const stamps = new Map<string, HTMLCanvasElement>();
  for (let ty = 2; ty < MAP_H - 2; ty += 3) for (let tx = 2; tx < MAP_W - 2; tx += 3) {
    // Hundreds of large, rotated stamps are the slowest part of the ground: a few rows at a time.
    if (tx === 2 && ty > 2 && (ty - 2) % 9 === 0) await breathe(c);
    const key = `ground_${zoneAt(tx, ty)}_${hash2(tx, ty, 41) > .5 ? 1 : 2}`;
    let stamp = stamps.get(key);
    if (!stamp) {
      const variant = art(key);
      if (!variant) continue;
      // Stamps are drawn at up to 185 world px, so keep enough pixels for the ground's resolution.
      const px = 160 * scale;
      // The stamps keep default canvases: drawn rotated from main-memory ones, they came out softer.
      stamp = canvas(px, px);
      const sc = stamp.getContext('2d')!;
      sc.drawImage(variant, 0, 0, px, px);
      sc.globalCompositeOperation = 'destination-in';
      const fade = sc.createRadialGradient(px / 2, px / 2, px / 16, px / 2, px / 2, px / 2);
      fade.addColorStop(0, 'rgba(0,0,0,1)'); fade.addColorStop(.3, 'rgba(0,0,0,.95)'); fade.addColorStop(1, 'rgba(0,0,0,0)');
      sc.fillStyle = fade; sc.fillRect(0, 0, px, px);
      stamps.set(key, stamp);
    }
    const size = 130 + hash2(tx, ty, 42) * 55;
    c.save();
    c.translate(tx * TILE + (hash2(tx, ty, 43) - .5) * 35, ty * TILE + (hash2(tx, ty, 44) - .5) * 35);
    c.rotate(hash2(tx, ty, 45) * Math.PI * 2);
    c.drawImage(stamp, -size / 2, -size / 2, size, size);
    c.restore();
  }
  // Ground details: grass tufts, lichen, pebbles.
  const painted = new Set((['base', 'sand', 'oak', 'rosemary'] as ZoneId[]).filter((z) => tiles(c, z)));
  for (let ty = 0; ty < MAP_H; ty++) {
    for (let tx = 0; tx < MAP_W; tx++) {
      const zone = zoneAt(tx, ty);
      if (painted.has(zone)) continue; // painted tiles carry their own detail
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
  stamps.forEach(release);
  await breathe(c);
  // Soft desire paths connect the cottage and the two stations. They're blurred on a small canvas
  // that just holds them (their curves, padded for the stroke and the blur), not across the whole
  // ground. Canvas blur is measured in device pixels, not world pixels, so it scales with the ground.
  const [px, py, pw, ph] = [752, 895, 320, 332];
  const trail = canvas(pw * scale, ph * scale).getContext('2d')!;
  trail.setTransform(scale, 0, 0, scale, -px * scale, -py * scale);
  trail.filter = `blur(${5 * scale}px)`;
  trail.strokeStyle = 'rgba(167, 141, 98, .13)';
  trail.lineWidth = 17;
  trail.beginPath();
  trail.moveTo(784, 1165); trail.quadraticCurveTo(910, 1195, 913, 1093);
  trail.moveTo(1040, 1165); trail.quadraticCurveTo(934, 1190, 913, 1120);
  trail.moveTo(900, 1152); trail.bezierCurveTo(852, 1110, 875, 1000, 848, 927);
  trail.stroke();
  c.drawImage(trail.canvas, px, py, pw, ph);
  await breathe(c);
  // Tiny, non-interactive habitat details: wiry grasses, lichen, shed fans and golden blooms.
  // Keep the action area around the pod clear; these are baked into the ground, not blockers.
  for (let ty = 1; ty < MAP_H - 1; ty++) for (let tx = 1; tx < MAP_W - 1; tx++) {
    const n = hash2(tx, ty, 31);
    if (n > .19 || Math.hypot(tx - 28, ty - 35) < 4) continue;
    const zone = zoneAt(tx, ty);
    const key = zone === 'rosemary' ? n < .012 ? 'decor_deadwood' : 'decor_lichen' : zone === 'oak' && n < .08 ? 'decor_acorns' : n < .018 ? 'decor_deadwood' : n < .035 ? 'decor_flower' : n < .06 ? 'decor_frond' : 'decor_grass';
    const image = art(key);
    if (!image) continue;
    const x = tx * TILE + hash2(tx, ty, 32) * 22, y = ty * TILE + hash2(tx, ty, 33) * 22;
    const [w, h] = catalog[key as keyof typeof catalog];
    const size = .6 + hash2(tx, ty, 34) * .5;
    c.save(); c.translate(x, y);
    // Fallen debris can turn freely; upright grass and flowers keep their natural growth direction.
    c.rotate((hash2(tx, ty, 35) - .5) * (['decor_frond', 'decor_acorns', 'decor_deadwood'].includes(key) ? 5 : .28));
    if (hash2(tx, ty, 36) > .5) c.scale(-1, 1);
    c.drawImage(image, -w * size / 2, -h * size / 2, w * size, h * size); c.restore();
  }
  await breathe(c);
  // Wild, unrestored scrub at the map edge.
  for (let tx = 0; tx < MAP_W; tx += 1.35) {
    for (const ty of [0, MAP_H - 1]) edgeBush(c, tx, ty, edge);
  }
  for (let ty = 0; ty < MAP_H; ty += 1.35) {
    for (const tx of [0, MAP_W - 1]) edgeBush(c, tx, ty, edge);
  }
  c.restore();
}

function edgeBush(c: Ctx, tx: number, ty: number, art: CanvasImageSource | null) {
  const x = tx * TILE + 16 + (hash2(tx, ty, 24) - .5) * 24;
  const y = ty * TILE + 16 + (hash2(tx, ty, 25) - .5) * 24;
  if (art) {
    const width = 68 + hash2(tx, ty, 21) * 36, height = width * 64 / 76;
    c.save(); c.translate(x, y); c.rotate((hash2(tx, ty, 22) - .5) * .3);
    if (hash2(tx, ty, 23) > .5) c.scale(-1, 1);
    c.drawImage(art, -width / 2, -height / 2, width, height); c.restore();
    return;
  }
  circle(c, x, y, 22 + hash2(tx, ty, 21) * 6, PAL.edgeDark);
  circle(c, x - 4, y - 5, 12 + hash2(tx, ty, 22) * 5, PAL.edge);
}

// --- registry -----------------------------------------------------------------------

export function generateTextures(scene: Phaser.Scene): void {
  generateRobotTextures(scene);
  generateHomeTextures(scene);
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

  make(scene, 'recycler', 36, 40, drawRecycler);
  make(scene, 'pad', 40, 32, drawPad);

  make(scene, 'sparkle', 10, 10, drawSparkle);
  make(scene, 'ring', 32, 32, drawRing);

  // Optional illustrations and the pictogram set also get logical-size Phaser textures.
  // Room shells are lazy, and seamless tiles are assembled into the ground by buildGround().
  for (const [key, [w, h]] of Object.entries(catalog)) {
    if (scene.textures.exists(key) || key.startsWith('room') || key.startsWith('ground_')) continue;
    if (artImage(scene, key)) make(scene, key, w, h, () => undefined);
  }
}

/**
 * The world floor: one big canvas texture, drawn in stages so the title screen stays responsive.
 * Display it with groundImage(), which scales it back to world size.
 */
export async function buildGround(scene: Phaser.Scene): Promise<void> {
  // The browser can refuse this much canvas when memory is short (iOS caps total canvas memory), so a
  // 2× floor that can't be made or drawn is tried again at 1× before settling for plain sand.
  const scales = groundScale(scene) > 1 ? [groundScale(scene), 1] : [1];
  for (const scale of scales) {
    const ground = groundCanvas(scene, scale);
    if (!ground) continue;
    if (!(await paintGround(scene, ground, scale === 1))) {
      release(ground.canvas);
      continue;
    }
    // A GPU reset can blank the canvas (see make()); Phaser would then re-upload an empty floor.
    let repainting = false;
    ground.canvas.addEventListener('contextrestored', () => {
      if (repainting || scene.textures.get('ground') !== ground) return;
      repainting = true;
      void paintGround(scene, ground, true).finally(() => (repainting = false));
    });
    return;
  }
}

/** A new, blank 'ground' canvas texture, or null if the browser can't make one this size. */
function groundCanvas(scene: Phaser.Scene, scale: number): Phaser.Textures.CanvasTexture | null {
  if (scene.textures.exists('ground')) scene.textures.remove('ground');
  try {
    const ground = scene.textures.createCanvas('ground', WORLD_W * scale, WORLD_H * scale);
    if (!ground) return null;
    // Phaser keeps an ImageData snapshot, taken at creation, for pixel helpers the ground never uses.
    // Dropping it keeps a blank 40 MB buffer out of the JS heap's accounting, which eases GC pressure.
    // (Its pages were never touched, so resident memory barely changes.)
    Object.assign(ground as unknown as Record<string, unknown>, { imageData: null, data: null, pixels: null, buffer: null });
    (ground.customData as { scale?: number }).scale = scale;
    return ground;
  } catch (e) {
    console.warn(`No room for a ${scale}× ground canvas.`, e);
    return null;
  }
}

/** Draws the floor and uploads it. If the art fails, it settles for plain sand or reports false. */
async function paintGround(scene: Phaser.Scene, ground: Phaser.Textures.CanvasTexture, sandIfFailed: boolean): Promise<boolean> {
  const scale = (ground.customData as { scale?: number }).scale ?? 1;
  const tiles: GroundPatterns = (ctx, zone) => {
    const img = artImage(scene, `ground_${zone}`);
    const pattern = img && ctx.createPattern(img, 'repeat');
    if (!pattern) return null;
    const iw = (img as HTMLImageElement).width || GROUND_TILE;
    pattern.setTransform(new DOMMatrix().scale(GROUND_TILE / iw));
    return pattern;
  };
  const c = ground.getContext();
  try {
    await drawGround(c, scale, tiles, (key) => artImage(scene, key));
  } catch (e) {
    if (!sandIfFailed) {
      console.warn(`Ground art failed at ${scale}×; trying 1×.`, e);
      return false;
    }
    // Never leave the game without a floor: plain sand still plays. Clear whatever state the
    // failed stage left behind (a blur filter would soften the sand and let half-drawn art through).
    console.warn('Ground art failed; using plain sand.', e);
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.filter = 'none';
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
    c.fillStyle = PAL.sand;
    c.fillRect(0, 0, ground.width, ground.height);
  }
  ground.refresh();
  return true;
}

/**
 * 2× (3584×2816) on WebGL when the GPU and the device can hold it; otherwise the original 1×.
 * The Canvas renderer is the fallback for weak or GPU-less devices, so it keeps 1×.
 */
function groundScale(scene: Phaser.Scene): number {
  if (scene.renderer.type !== Phaser.WEBGL) return 1;
  const maxTexture = (scene.renderer as Phaser.Renderer.WebGL.WebGLRenderer).getMaxTextureSize();
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  if (memory < 2) return 1;
  return Math.max(1, Math.min(GROUND_SCALE, Math.floor(maxTexture / Math.max(WORLD_W, WORLD_H))));
}

/** The world floor, at world size whatever resolution it was drawn at. */
export function groundImage(scene: Phaser.Scene): Phaser.GameObjects.Image {
  const scale = (scene.textures.get('ground').customData as { scale?: number }).scale ?? 1;
  return scene.add.image(0, 0, 'ground').setOrigin(0).setScale(1 / scale).setDepth(-10);
}
