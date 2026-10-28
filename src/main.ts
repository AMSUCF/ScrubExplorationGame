import Phaser from 'phaser';
import './style.css';
import './refinement.css';
import './minigames.css';
import './seasons.css';
import { audio } from './audio';
import { BootScene } from './scenes/BootScene';
import { HomeScene } from './scenes/HomeScene';
import { IntroScene } from './scenes/IntroScene';
import type { PlayScene } from './scenes/PlayScene';
import { WorldScene } from './scenes/WorldScene';
import { services } from './services';
import { Hud } from './ui/hud';
import { initKeyboard } from './ui/input';
import * as fire from './systems/fire';
import * as progress from './systems/progress';
import { nightTick } from './systems/dayCycle';

// Render at device pixel ratio (capped for performance) so the art stays crisp on phones.
const dpr = Math.min(window.devicePixelRatio || 1, 2);
const parent = document.getElementById('game')!;

function viewport(): { w: number; h: number } {
  return { w: parent.clientWidth || window.innerWidth, h: parent.clientHeight || window.innerHeight };
}

const { w, h } = viewport();
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent,
  backgroundColor: '#6f8a5c',
  scale: {
    mode: Phaser.Scale.NONE,
    width: Math.round(w * dpr),
    height: Math.round(h * dpr),
    zoom: 1 / dpr,
  },
  physics: { default: 'arcade', arcade: { debug: false } },
  input: { keyboard: false, mouse: true, touch: true, activePointers: 2 },
  // zoom !== 1 would otherwise switch Phaser into pixel-art mode (nearest sampling, rounded positions),
  // which makes the painted ground and sprites blocky on high-DPI phones.
  render: { antialias: true, roundPixels: false, pixelArt: false },
  scene: [BootScene, IntroScene, WorldScene, HomeScene],
});
game.registry.set('dpr', dpr);

/** Whichever play space (outdoors or the pod) is running. */
const active = (): PlayScene | null =>
  (['World', 'Home'] as const).map((k) => game.scene.getScene(k) as PlayScene).find((s) => s?.scene.isActive()) ?? null;
services.hud = new Hud(document.getElementById('ui')!, {
  onGuide: () => void active()?.openGuide(),
  onMenu: () => void active()?.openPause(),
});
services.hud.setVisible(false);
initKeyboard();

const resize = () => {
  const v = viewport();
  game.scale.resize(Math.round(v.w * dpr), Math.round(v.h * dpr));
};
window.addEventListener('resize', resize);
window.visualViewport?.addEventListener('resize', resize);

// Browsers only allow sound after a gesture: start (or resume) audio on any tap or key.
for (const ev of ['pointerdown', 'keydown', 'touchend'] as const) window.addEventListener(ev, () => audio.unlock(), { capture: true });

// Stop iOS double-tap zoom and pinch gestures from hijacking play.
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());

// `?debug` exposes the game for automated smoke tests and console poking.
if (new URLSearchParams(location.search).has('debug')) {
  Object.assign(window, { __game: game, __audio: audio, __systems: { ...fire, ...progress, nightTick } });
}
