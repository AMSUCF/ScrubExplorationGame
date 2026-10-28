// The robot (Reachy-Mini-ish head, Sanrio-soft proportions), its landing pod / home, and intro bits.
import Phaser from 'phaser';
import { Ctx, circle, ellipse, line, make, roundRect, shadow } from './placeholders';

export const ROBOT_COLORS = {
  shell: '#fffaf0',
  shellShade: '#eadfcb',
  plate: '#3b3a48',
  eye: '#1d1b26',
  ring: '#8fe0cf',
  cheek: '#f7a8b8',
  body: '#a8dccf',
  bodyShade: '#86c3b4',
  accent: '#ffb59a',
  tread: '#8d8a96',
};

const R = ROBOT_COLORS;

/** Head + body; antennas are separate sprites so they can wobble. */
function drawRobotBody(c: Ctx, eyes: 'open' | 'blink' | 'happy') {
  shadow(c, 18, 34, 12, 3.5);
  // Little treads
  roundRect(c, 8, 27, 8, 6, 3, R.tread);
  roundRect(c, 20, 27, 8, 6, 3, R.tread);
  // Body
  roundRect(c, 11, 20, 14, 10, 5, R.body);
  roundRect(c, 11, 26, 14, 4, 2, R.bodyShade);
  // A tiny leaf badge
  ellipse(c, 18, 24, 2.2, 1.4, '#6fb57f');
  line(c, 16.4, 24, 19.6, 24, '#4f9562', 0.6);
  // Big round head
  ellipse(c, 18, 13.5, 14, 11, R.shellShade);
  ellipse(c, 18, 12.8, 13.5, 10.3, R.shell);
  // Dark face plate with two big lens eyes
  roundRect(c, 6.5, 7.5, 23, 11, 5.5, R.plate);
  if (eyes === 'open') {
    for (const x of [12.8, 23.2]) {
      circle(c, x, 13, 4.1, R.ring);
      circle(c, x, 13, 3.4, R.eye);
      circle(c, x - 1.2, 11.7, 1.3, '#ffffff');
      circle(c, x + 1.1, 14.4, 0.6, '#ffffff');
    }
  } else {
    c.strokeStyle = R.ring;
    c.lineWidth = 1.6;
    for (const x of [12.8, 23.2]) {
      c.beginPath();
      if (eyes === 'happy') c.arc(x, 14.2, 2.8, Math.PI * 1.15, Math.PI * 1.85);
      else {
        c.moveTo(x - 2.8, 13.2);
        c.lineTo(x + 2.8, 13.2);
      }
      c.stroke();
    }
  }
  // Blushing cheeks
  ellipse(c, 6.8, 18.5, 2.6, 1.5, R.cheek);
  ellipse(c, 29.2, 18.5, 2.6, 1.5, R.cheek);
}

function drawAntenna(c: Ctx) {
  c.strokeStyle = R.plate;
  c.lineWidth = 1.2;
  c.beginPath();
  c.moveTo(4, 15);
  c.bezierCurveTo(4, 11, 2.5, 8, 4, 4.5);
  c.stroke();
  circle(c, 4, 3.4, 2.6, R.accent);
  circle(c, 3.2, 2.6, 0.8, '#ffffff');
}

// --- pod / home exterior ------------------------------------------------------------------

function drawPod(c: Ctx, level: number, open: boolean) {
  const W = 104;
  shadow(c, W / 2, 70, 44, 6);
  if (level >= 1) {
    // Greenhouse dome on the right
    ellipse(c, 86, 56, 17, 14, 'rgba(190, 235, 220, 0.75)');
    c.strokeStyle = '#ffffff';
    c.lineWidth = 1;
    for (const a of [-0.9, -0.3, 0.3, 0.9]) {
      c.beginPath();
      c.moveTo(86, 42);
      c.lineTo(86 + Math.sin(a) * 17, 56 + Math.cos(a) * 4);
      c.stroke();
    }
    for (const [x, y] of [[80, 60], [88, 58], [93, 62]]) circle(c, x, y, 3, '#6fb57f');
  }
  if (level >= 2) {
    // Solar canopy + flower box
    line(c, 14, 30, 14, 66, '#9a8f84', 1.6);
    roundRect(c, 2, 22, 26, 9, 2, '#38506b', '#24364a');
    for (let x = 7; x < 28; x += 5) line(c, x, 23, x, 30, '#5c7da0', 0.6);
    roundRect(c, 30, 62, 30, 6, 2, '#b98a5e');
    for (const [x, col] of [[34, '#f7a8b8'], [40, '#ffd36b'], [46, '#c9a6e8'], [52, '#f7a8b8'], [57, '#ffd36b']] as [number, string][]) {
      circle(c, x, 61, 2.2, col);
    }
  }
  // Capsule body
  ellipse(c, W / 2, 46, 36, 24, R.shellShade);
  ellipse(c, W / 2, 44, 35, 23, R.shell);
  // Mint stripe
  c.save();
  c.beginPath();
  c.ellipse(W / 2, 44, 35, 23, 0, 0, Math.PI * 2);
  c.clip();
  c.fillStyle = R.body;
  c.fillRect(0, 50, W, 6);
  c.restore();
  // Porthole windows
  for (const x of [32, 72]) {
    circle(c, x, 38, 6.5, R.plate);
    circle(c, x, 38, 5, '#ffe9a8');
    circle(c, x - 1.6, 36.4, 1.4, '#ffffff');
  }
  // Antenna on top (echoing the robot)
  line(c, W / 2, 21, W / 2, 12, R.plate, 1.4);
  circle(c, W / 2, 11, 3, R.accent);
  // Door
  roundRect(c, W / 2 - 9, 44, 18, 22, 8, R.plate);
  if (open) roundRect(c, W / 2 - 7, 46, 14, 20, 7, '#ffe2a0');
  else {
    roundRect(c, W / 2 - 7, 46, 14, 20, 7, '#4f4e5e');
    circle(c, W / 2 + 4, 57, 1.1, R.accent);
  }
  // Little scuffs from the landing
  circle(c, 27, 54, 1, R.shellShade);
  circle(c, 79, 47, 1.3, R.shellShade);
}

function drawFlame(c: Ctx) {
  const g = c.createLinearGradient(0, 0, 0, 40);
  g.addColorStop(0, 'rgba(255, 230, 160, 0.95)');
  g.addColorStop(1, 'rgba(255, 140, 90, 0)');
  c.fillStyle = g;
  c.beginPath();
  c.moveTo(4, 0);
  c.quadraticCurveTo(10, 20, 10, 40);
  c.quadraticCurveTo(10, 20, 16, 0);
  c.fill();
}

export function generateRobotTextures(scene: Phaser.Scene): void {
  make(scene, 'robot', 36, 36, (c) => drawRobotBody(c, 'open'));
  make(scene, 'robot_blink', 36, 36, (c) => drawRobotBody(c, 'blink'));
  make(scene, 'robot_happy', 36, 36, (c) => drawRobotBody(c, 'happy'));
  make(scene, 'antenna', 8, 16, drawAntenna);
  for (let level = 0; level < 3; level++) make(scene, `pod${level}`, 104, 74, (c) => drawPod(c, level, true));
  make(scene, 'pod_shut', 104, 74, (c) => drawPod(c, 0, false));
  make(scene, 'flame', 20, 40, drawFlame);
  make(scene, 'dust', 10, 10, (c) => circle(c, 5, 5, 4.5, 'rgba(236, 223, 184, 0.9)'));
}
