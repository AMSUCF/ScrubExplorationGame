import Phaser from 'phaser';
import { DOM_ONLY, generateEffectTextures } from '../art/effects';
import { buildGround, generateTextures } from '../art/placeholders';
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

  /**
   * Queue any finished illustrations listed in public/art/manifest.json (missing files are fine).
   * Art only the DOM shows is fetched by URL after the game starts, so it doesn't hold up the title.
   */
  preload(): void {
    this.load.on('progress', (progress: number) => {
      const bar = document.querySelector<HTMLElement>('.loading-fill');
      if (bar) bar.style.transform = `scaleX(${progress})`;
      document.querySelector('[role="progressbar"]')?.setAttribute('aria-valuenow', String(Math.round(progress * 100)));
    });
    this.load.json('art-manifest', 'art/manifest.json');
    this.load.on('filecomplete-json-art-manifest', (_key: string, _type: string, keys: unknown) => {
      if (!Array.isArray(keys)) return;
      for (const k of keys) if (typeof k === 'string' && !DOM_ONLY.has(k)) this.load.image(`art:${k}`, `art/${k}.png`);
    });
    this.load.on('loaderror', (file: Phaser.Loader.File) => console.warn(`Art not loaded: ${file.key}`));
  }

  async create(): Promise<void> {
    const artKeys = new Set<string>(this.cache.json.get('art-manifest') as string[]);
    generateTextures(this);
    generateEffectTextures(this, artKeys);
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
    const loading = document.querySelector<HTMLElement>('.app-loading');
    loading?.remove();
    // The large ground is painted while the title is up (after it has had a frame to appear).
    let groundReady = false;
    const ground = new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      .then(() => buildGround(this))
      // buildGround falls back to plain sand itself; this only guards the game start.
      .catch((e) => console.warn('No ground texture.', e))
      .then(() => void (groundReady = true));
    const choice = await title;
    // A very quick tap on a slow device: bring the loading screen back for the last moment.
    if (!groundReady && loading) {
      loading.querySelector('span')!.textContent = 'Unrolling the scrub';
      document.body.appendChild(loading);
    }
    await ground;
    loading?.remove();
    startGame(this, choice === 'continue' && saved ? saved : newGame());
    // Warm the cache for the DOM-only art, so cards and mini-games open with their pictures ready. One
    // file at a time, the big dig sand last, so the first HUD icons aren't kept waiting on a slow link.
    void (async () => {
      for (const k of [...DOM_ONLY].sort((a, b) => +(a === 'dig_sand') - +(b === 'dig_sand'))) {
        if (!artKeys.has(k)) continue;
        await new Promise<void>((done) => {
          const img = new Image();
          img.onload = img.onerror = () => done();
          img.src = services.icon(k);
        });
      }
    })();
  }
}
