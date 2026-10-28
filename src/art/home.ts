// Pod interior: room shell, furniture, hydroponic jars, vases & sprigs, plus thought bubbles.
import Phaser from 'phaser';
import { HOME_TILE, ROOM_SIZES, WALL_ROWS } from '../data/home';
import { PAL } from '../data/palette';
import { ART_SCALE, Ctx, blade, circle, ellipse, line, make, roundRect, shadow } from './placeholders';
import { ROBOT_COLORS as R } from './robot';

function drawRoom(c: Ctx, w: number, h: number) {
  const W = w * HOME_TILE;
  const H = h * HOME_TILE;
  const wallH = WALL_ROWS * HOME_TILE;
  // Rounded capsule shell around the room
  roundRect(c, 0, 0, W, H, 28, R.plate);
  c.save();
  c.beginPath();
  c.roundRect(6, 6, W - 12, H - 12, 24);
  c.clip();
  // Wallpaper with soft stripes
  c.fillStyle = '#f6e7d3';
  c.fillRect(0, 0, W, wallH + 8);
  for (let x = 10; x < W; x += 22) {
    c.fillStyle = '#f0dcc4';
    c.fillRect(x, 0, 9, wallH + 8);
  }
  // Wood floor planks
  for (let y = wallH; y < H; y += 16) {
    for (let x = ((y / 16) % 2) * -24; x < W; x += 48) {
      roundRect(c, x + 1, y + 1, 46, 14, 3, (x / 48 + y / 16) % 3 < 1 ? '#d8b088' : '#d1a87f');
    }
  }
  // Baseboard + rug
  c.fillStyle = '#c99a72';
  c.fillRect(0, wallH, W, 5);
  ellipse(c, W / 2, wallH + (H - wallH) * 0.58, W * 0.28, (H - wallH) * 0.25, '#bfe0d4');
  ellipse(c, W / 2, wallH + (H - wallH) * 0.58, W * 0.22, (H - wallH) * 0.18, '#d7eee6');
  c.restore();
}

function drawCradle(c: Ctx) {
  shadow(c, 32, 31, 28, 4);
  roundRect(c, 4, 12, 56, 18, 9, '#c9b6e4');
  roundRect(c, 8, 9, 48, 14, 7, '#e6dcf5');
  ellipse(c, 16, 14, 7, 4.5, '#ffffff');
  // Charging glow + plug
  roundRect(c, 26, 17, 26, 4, 2, '#b8f0d8');
  line(c, 60, 22, 64, 30, R.plate, 1.4);
  // Moon sticker
  circle(c, 50, 13, 3, '#ffe9a8');
  circle(c, 51.5, 12, 2.6, '#e6dcf5');
}

function drawHydro(c: Ctx, stage: 'empty' | 'sown' | 'sprout' | 'ready', wet: boolean) {
  shadow(c, 14, 33, 11, 2.5);
  // LED grow light bar
  roundRect(c, 3, 0, 22, 3, 1.5, '#d9c7f2');
  ellipse(c, 14, 6, 9, 3, 'rgba(220, 180, 255, 0.25)');
  // Glass jar
  roundRect(c, 5, 12, 18, 20, 5, 'rgba(210, 236, 240, 0.85)', '#b5d4da');
  const waterTop = wet ? 17 : 26;
  roundRect(c, 6.5, waterTop, 15, 31 - waterTop, 4, wet ? '#8fd3e6' : '#b9dfe8');
  // Roots
  if (stage === 'sprout' || stage === 'ready') {
    for (const x of [11, 14, 17]) line(c, x, 15, x + (x - 14) * 0.3, stage === 'ready' ? 28 : 22, '#f2ead6', 0.8);
  }
  // Net cup
  roundRect(c, 8, 11, 12, 5, 2, '#5f6b74');
  if (stage === 'sown') for (const x of [11, 14, 17]) circle(c, x, 11, 0.9, '#d9c08a');
  if (stage === 'sprout') {
    for (const x of [11, 17]) {
      line(c, x, 11, x, 7, PAL.leaf, 1.1);
      ellipse(c, x - 1.3, 7, 1.6, 0.9, PAL.leafLight);
      ellipse(c, x + 1.3, 7, 1.6, 0.9, PAL.leafLight);
    }
  }
  if (stage === 'ready') {
    line(c, 14, 11, 14, 2, PAL.leafDark, 1.3);
    ellipse(c, 10.5, 5.5, 3.4, 1.7, PAL.leaf);
    ellipse(c, 17.5, 4, 3.4, 1.7, PAL.leaf);
    ellipse(c, 14, 1.8, 1.8, 2.2, PAL.leafLight);
  }
}

function drawMonitor(c: Ctx) {
  roundRect(c, 2, 2, 40, 30, 6, '#efe6d6', '#cfc2ac');
  roundRect(c, 6, 6, 32, 21, 4, '#1f3a34');
  c.strokeStyle = '#7fe3b0';
  c.lineWidth = 1.2;
  c.beginPath();
  c.moveTo(9, 22);
  c.lineTo(15, 19);
  c.lineTo(20, 20);
  c.lineTo(26, 13);
  c.lineTo(34, 10);
  c.stroke();
  for (const [x, y] of [[15, 19], [26, 13], [34, 10]]) circle(c, x, y, 1.1, '#c8ffe2');
  circle(c, 36, 29.5, 1.2, '#7fe3b0');
}

function drawBoard(c: Ctx) {
  roundRect(c, 1, 1, 44, 32, 3, '#b98a5e');
  roundRect(c, 4, 4, 38, 26, 2, '#d8a76e');
  for (let i = 0; i < 30; i++) circle(c, 6 + ((i * 13) % 34), 6 + ((i * 7) % 22), 0.5, '#c4925c');
}

function drawBench(c: Ctx) {
  shadow(c, 32, 34, 30, 3);
  roundRect(c, 2, 10, 60, 8, 2, '#b98a5e');
  line(c, 8, 18, 8, 33, '#8d6845', 3);
  line(c, 56, 18, 56, 33, '#8d6845', 3);
  // Tools
  line(c, 12, 8, 24, 4, '#9aa3ad', 2);
  circle(c, 25, 4, 2.2, '#9aa3ad');
  circle(c, 25, 4, 0.9, '#b98a5e');
  circle(c, 40, 6, 4, '#c3c9cf');
  circle(c, 40, 6, 1.6, '#b98a5e');
  roundRect(c, 48, 3, 8, 7, 1.5, '#f7a8b8');
}

function drawVaseTable(c: Ctx) {
  shadow(c, 12, 29, 10, 2.5);
  roundRect(c, 3, 18, 18, 4, 2, '#c99a72');
  line(c, 12, 22, 12, 29, '#a77c56', 2);
  // Vase body
  c.fillStyle = '#e4977a';
  c.beginPath();
  c.moveTo(8, 18);
  c.quadraticCurveTo(5, 12, 9.5, 8);
  c.lineTo(14.5, 8);
  c.quadraticCurveTo(19, 12, 16, 18);
  c.closePath();
  c.fill();
  roundRect(c, 9, 6.5, 6, 2.5, 1.2, '#cf7e62');
  ellipse(c, 10, 13, 1, 2.4, 'rgba(255,255,255,0.35)');
}

function drawSprig(c: Ctx, species: string) {
  switch (species) {
    case 'palmetto':
      line(c, 6, 20, 6, 8, PAL.leafDark, 1);
      for (let i = -3; i <= 3; i++) blade(c, 6, 9, 8, i * 1.6, PAL.leaf, 1);
      break;
    case 'rosemary':
      line(c, 6, 20, 6, 4, PAL.rosemaryDark, 1);
      for (let y = 5; y < 18; y += 2) {
        line(c, 6, y, 3.5, y - 1.5, PAL.rosemary, 1);
        line(c, 6, y + 1, 8.5, y - 0.5, PAL.rosemary, 1);
      }
      break;
    case 'oak':
      line(c, 6, 20, 6, 6, PAL.trunk, 1);
      for (const [x, y] of [[3.5, 8], [8.5, 10], [4, 13], [8, 6]]) ellipse(c, x, y, 2.6, 1.6, PAL.oak);
      ellipse(c, 6.5, 15, 1.2, 1.6, '#8f6a3c');
      break;
    default:
      line(c, 6, 20, 6, 6, PAL.trunk, 1);
      for (const [x, y] of [[3.5, 7], [8.5, 8], [4, 12], [8.5, 13]]) ellipse(c, x, y, 2.4, 1.2, PAL.hickory);
  }
}

function drawWindow(c: Ctx) {
  roundRect(c, 1, 1, 50, 34, 10, '#ffffff', '#d9cdb8');
  c.save();
  c.beginPath();
  c.roundRect(5, 5, 42, 26, 8);
  c.clip();
  c.fillStyle = '#bfe3f2';
  c.fillRect(0, 0, 52, 36);
  ellipse(c, 16, 26, 14, 6, PAL.oak);
  ellipse(c, 36, 28, 16, 6, PAL.leaf);
  circle(c, 40, 11, 4, '#fff1b3');
  c.restore();
  line(c, 26, 5, 26, 31, '#ffffff', 2);
}

function drawDoorMat(c: Ctx) {
  roundRect(c, 4, 0, 40, 6, 3, '#ffe2a0');
  roundRect(c, 0, 5, 48, 9, 4, '#9fc7a0');
  for (let x = 6; x < 44; x += 5) line(c, x, 7, x, 12, '#8ab48c', 1);
}

function drawPolaroid(c: Ctx) {
  roundRect(c, 0.5, 0.5, 17, 20, 1.5, '#ffffff', '#e2d8c8');
  roundRect(c, 2, 2, 14, 13, 1, '#d7eee6');
}

function drawPostcardTile(c: Ctx) {
  roundRect(c, 0.5, 0.5, 21, 15, 1.5, '#fffdf6', '#d9c8a2');
  roundRect(c, 15, 2, 5, 5, 0.8, '#f7a8b8');
}

function drawPin(c: Ctx) {
  circle(c, 3, 3, 2.6, '#e0714f');
  circle(c, 2.2, 2.2, 0.8, '#ffffff');
}

function drawBubble(c: Ctx) {
  c.fillStyle = '#ffffff';
  c.strokeStyle = 'rgba(61, 51, 40, 0.25)';
  c.lineWidth = 1;
  for (const [x, y, r] of [[17, 13, 12], [9, 14, 7], [25, 14, 7], [12, 8, 7], [22, 8, 7]]) {
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fill();
  }
  circle(c, 7, 26, 2.6, '#ffffff');
  circle(c, 3, 30, 1.6, '#ffffff');
}

export function generateRoomTexture(scene: Phaser.Scene, level: number): string {
  const key = `room${level}`;
  if (scene.textures.exists(key)) return key;
  const { w, h } = ROOM_SIZES[level];
  make(scene, key, w * HOME_TILE, h * HOME_TILE, (c) => drawRoom(c, w, h));
  return key;
}

export function generateHomeTextures(scene: Phaser.Scene): void {
  make(scene, 'cradle', 64, 34, drawCradle);
  for (const stage of ['empty', 'sown', 'sprout', 'ready'] as const) {
    make(scene, `hydro_${stage}_dry`, 28, 36, (c) => drawHydro(c, stage, false));
    make(scene, `hydro_${stage}_wet`, 28, 36, (c) => drawHydro(c, stage, true));
  }
  make(scene, 'monitor', 44, 34, drawMonitor);
  make(scene, 'board', 46, 34, drawBoard);
  make(scene, 'bench', 64, 36, drawBench);
  make(scene, 'vase', 24, 30, drawVaseTable);
  for (const sp of ['palmetto', 'rosemary', 'oak', 'hickory']) make(scene, `sprig_${sp}`, 12, 21, (c) => drawSprig(c, sp));
  make(scene, 'window', 52, 36, drawWindow);
  make(scene, 'doormat', 48, 14, drawDoorMat);
  make(scene, 'polaroid', 18, 21, drawPolaroid);
  make(scene, 'postcard', 22, 16, drawPostcardTile);
  make(scene, 'pin', 6, 6, drawPin);
  make(scene, 'bubble', 34, 32, drawBubble);
}

export { ART_SCALE };
