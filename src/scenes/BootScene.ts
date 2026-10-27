import Phaser from 'phaser';
import { generateTextures } from '../art/placeholders';
import { loadGame } from '../systems/save';
import { newGame } from '../systems/state';
import { showTitle } from '../ui/overlays';
import { services } from '../services';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
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
    const choice = await showTitle(!!saved, services.icon);
    const state = choice === 'continue' && saved ? saved : newGame();
    this.scene.start('World', { state, fresh: choice === 'new' });
  }
}
