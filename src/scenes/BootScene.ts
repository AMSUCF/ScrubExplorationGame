import Phaser from 'phaser';
import { generateEffectTextures } from '../art/effects';
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
    this.load.on('progress', (progress: number) => {
      const bar = document.querySelector<HTMLElement>('.loading-fill');
      if (bar) bar.style.transform = `scaleX(${progress})`;
      document.querySelector('[role="progressbar"]')?.setAttribute('aria-valuenow', String(Math.round(progress * 100)));
    });
    this.load.json('art-manifest', 'art/manifest.json');
    this.load.on('filecomplete-json-art-manifest', (_key: string, _type: string, keys: unknown) => {
      if (!Array.isArray(keys)) return;
      for (const k of keys) if (typeof k === 'string') this.load.image(`art:${k}`, `art/${k}.png`);
    });
    this.load.on('loaderror', (file: Phaser.Loader.File) => console.warn(`Art not loaded: ${file.key}`));
  }

  async create(): Promise<void> {
    generateTextures(this);
    generateEffectTextures(this);
    const artKeys = new Set<string>(this.cache.json.get('art-manifest') as string[]);
    const cache = new Map<string, string>();
    services.icon = (key) => {
      // DOM cards get the full 4x illustration, with no canvas downsampling or base64 copies.
      if (artKeys.has(key)) return `${import.meta.env.BASE_URL}art/${key}.png`;
      let url = cache.get(key);
      if (!url) {
        url = this.textures.exists(key) ? (this.textures.getBase64(key) as string) : '';
        cache.set(key, url);
      }
      return url;
    };

    const saved = loadGame();
    const title = showTitle(!!saved);
    document.querySelector('.app-loading')?.remove();
    const choice = await title;
    startGame(this, choice === 'continue' && saved ? saved : newGame());
  }
}
