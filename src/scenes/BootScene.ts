import Phaser from 'phaser';
import { generateTextures } from '../art/placeholders';
import { services } from '../services';
import { loadGame } from '../systems/save';
import { GameState, newGame } from '../systems/state';
import { showTitle } from '../ui/overlays';

export function startGame(scene: Phaser.Scene, state: GameState): void {
  if (!state.introSeen) scene.scene.start('Intro', { state });
  else if (state.location === 'home') scene.scene.start('Home', { state, spawn: 'cradle' });
  else scene.scene.start('World', { state });
}

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  /** Queue any finished illustrations listed in public/art/manifest.json (missing files are fine). */
  preload(): void {
    this.load.json('art-manifest', 'art/manifest.json');
    this.load.on('filecomplete-json-art-manifest', (_key: string, _type: string, keys: unknown) => {
      if (!Array.isArray(keys)) return;
      for (const k of keys) if (typeof k === 'string') this.load.image(`art:${k}`, `art/${k}.png`);
    });
    this.load.on('loaderror', (file: Phaser.Loader.File) => console.warn(`Art not loaded: ${file.key}`));
  }

  async create(): Promise<void> {
    generateTextures(this);
    const cache = new Map<string, string>();
    services.icon = (key) => {
      let url = cache.get(key);
      if (!url) {
        url = this.textures.exists(key) ? (this.textures.getBase64(key) as string) : '';
        cache.set(key, url);
      }
      return url;
    };

    const saved = loadGame();
    const choice = await showTitle(!!saved);
    startGame(this, choice === 'continue' && saved ? saved : newGame());
  }
}
