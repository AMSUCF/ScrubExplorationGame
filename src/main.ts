import Phaser from 'phaser';
import './style.css';
import { BootScene } from './scenes/BootScene';
import { WorldScene } from './scenes/WorldScene';
import { services } from './services';
import { Hud } from './ui/hud';
import { initKeyboard } from './ui/input';

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
  input: { keyboard: false, mouse: false, touch: false },
  render: { antialias: true, roundPixels: false },
  scene: [BootScene, WorldScene],
});
game.registry.set('dpr', dpr);

const world = () => game.scene.getScene('World') as WorldScene;
services.hud = new Hud(document.getElementById('ui')!, {
  onGuide: () => void world().openGuide(),
  onCycleSeed: () => world().cycleSeed(),
  onMenu: () => void world().openMenu(),
});
services.hud.setVisible(false);
initKeyboard();

const resize = () => {
  const v = viewport();
  game.scale.resize(Math.round(v.w * dpr), Math.round(v.h * dpr));
};
window.addEventListener('resize', resize);
window.visualViewport?.addEventListener('resize', resize);

// Stop iOS double-tap zoom and pinch gestures from hijacking play.
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());

// `?debug` exposes the game for automated smoke tests and console poking.
if (new URLSearchParams(location.search).has('debug')) {
  (window as unknown as { __game: Phaser.Game }).__game = game;
}
