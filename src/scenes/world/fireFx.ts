// Fire you can see: flickering flames with a warm ground glow, smoke drifting downwind, rising
// embers, scorched earth that fades as the ground recovers, and raked firebreaks.
import Phaser from 'phaser';
import { MAP_W, WORLD_H, WORLD_W } from '../../config';
import { tex, texScale } from '../../art/effects';
import { tileCenter } from '../../data/map';
import { tileIndex, zoneOf } from '../../systems/fire';
import { GameState } from '../../systems/state';
import { hash2 } from '../../systems/rng';

const SCORCH_DAYS = 12;

interface Flame {
  flame: Phaser.GameObjects.Image;
  glow: Phaser.GameObjects.Image;
  seed: number;
}

export class FireFx {
  private flames = new Map<number, Flame>();
  private breaks = new Map<string, Phaser.GameObjects.Image>();
  private scorch: Phaser.GameObjects.RenderTexture;
  private stamp: Phaser.GameObjects.Image;
  private smoke: Phaser.GameObjects.Particles.ParticleEmitter;
  private embers: Phaser.GameObjects.Particles.ParticleEmitter;
  private puff = 0;
  private scorchBoost: number;

  constructor(private scene: Phaser.Scene, private state: GameState) {
    this.scorch = scene.add.renderTexture(0, 0, WORLD_W, WORLD_H).setOrigin(0).setDepth(-6);
    this.stamp = scene.make.image({ key: tex(scene, 'scorch'), add: false }).setDisplaySize(50, 36);
    // The painted scorch is lighter and more open than the placeholder: darken it to read as charred.
    this.scorchBoost = tex(scene, 'scorch') === 'scorch' ? 1 : 1.3;
    if (this.scorchBoost > 1) this.stamp.setTint(0x6e6052);
    const w = state.weather.wind, speed = state.weather.windSpeed;
    const smokeScale = texScale(scene, 'smoke'), emberScale = texScale(scene, 'ember');
    this.smoke = scene.add.particles(0, 0, tex(scene, 'smoke'), {
      speedX: { min: w.x * 30 * (0.3 + speed) - 6, max: w.x * 60 * (0.3 + speed) + 6 },
      speedY: { min: -38 + w.y * 20, max: -18 + w.y * 30 },
      lifespan: 2800,
      scale: { start: 0.35 * smokeScale, end: 1.3 * smokeScale },
      alpha: { start: 0.5, end: 0 },
      emitting: false,
    }).setDepth(150000);
    this.embers = scene.add.particles(0, 0, tex(scene, 'ember'), {
      speedX: { min: -20 + w.x * 30, max: 20 + w.x * 50 },
      speedY: { min: -110, max: -50 },
      lifespan: 1000,
      scale: { start: 0.9 * emberScale, end: 0.2 * emberScale },
      alpha: { start: 1, end: 0 },
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    }).setDepth(150001);
    this.paintScorch();
  }

  /** Burned ground darkens, then fades back to sand over about two weeks. */
  private paintScorch(): void {
    const s = this.state;
    this.scorch.clear();
    for (let i = 0; i < s.burned.length; i++) {
      const age = s.day - s.burned[i];
      if (age < 0 || age >= SCORCH_DAYS) continue;
      const tx = i % MAP_W, ty = Math.floor(i / MAP_W);
      if (zoneOf(tx, ty) === 'base') continue;
      this.stampAt(tx, ty, 0.85 * (1 - age / SCORCH_DAYS));
    }
  }

  private stampAt(tx: number, ty: number, alpha: number): void {
    const p = tileCenter(tx, ty);
    this.stamp.setAlpha(Math.min(1, alpha * this.scorchBoost)).setAngle(hash2(tx, ty, 61) * 360);
    this.scorch.draw(this.stamp, p.x + (hash2(tx, ty, 62) - 0.5) * 6, p.y + (hash2(tx, ty, 63) - 0.5) * 6);
  }

  /** Match flames and firebreaks to the state; scorch newly burned ground. */
  sync(newlyBurned: { tx: number; ty: number }[] = []): void {
    for (const t of newlyBurned) this.stampAt(t.tx, t.ty, 0.85);
    const live = new Set<number>();
    for (const f of this.state.fires) {
      const i = tileIndex(f.tx, f.ty);
      live.add(i);
      let view = this.flames.get(i);
      if (!view) {
        const p = tileCenter(f.tx, f.ty);
        const glow = this.scene.add.image(p.x, p.y + 6, tex(this.scene, 'ember')).setDisplaySize(84, 50).setAlpha(0.32).setBlendMode(Phaser.BlendModes.ADD).setDepth(-2);
        const flame = this.scene.add.image(p.x + (hash2(f.tx, f.ty, 64) - 0.5) * 8, p.y + 14, tex(this.scene, 'wildfire')).setOrigin(0.5, 1).setDepth(p.y + 14.5);
        flame.setDisplaySize(26, 34).setScale(flame.scaleX * 0.2, flame.scaleY * 0.2);
        this.scene.tweens.add({ targets: flame, scaleX: flame.scaleX * 5, scaleY: flame.scaleY * 5, duration: 260, ease: 'Back.Out' });
        view = { flame, glow, seed: hash2(f.tx, f.ty, 65) * 10 };
        this.flames.set(i, view);
        if (!newlyBurned.some((t) => t.tx === f.tx && t.ty === f.ty)) this.stampAt(f.tx, f.ty, 0.85);
      }
      view.flame.setData('heat', f.heat);
    }
    for (const [i, view] of this.flames) {
      if (live.has(i)) continue;
      this.flames.delete(i);
      this.scene.tweens.add({ targets: [view.flame, view.glow], alpha: 0, duration: 500, onComplete: () => { view.flame.destroy(); view.glow.destroy(); } });
      this.smoke.explode(2, view.flame.x, view.flame.y - 10);
    }
    const breaks = new Set<string>();
    for (const b of this.state.firebreaks) {
      if (b.until < this.state.day) continue;
      const key = `${b.tx},${b.ty}`;
      breaks.add(key);
      if (!this.breaks.has(key)) {
        const p = tileCenter(b.tx, b.ty);
        this.breaks.set(key, this.scene.add.image(p.x, p.y + 4, tex(this.scene, 'firebreak')).setDisplaySize(36, 24).setAlpha(0.9).setDepth(-3));
      }
    }
    for (const [key, img] of this.breaks) {
      if (breaks.has(key)) continue;
      img.destroy();
      this.breaks.delete(key);
    }
  }

  get count(): number {
    return this.flames.size;
  }

  /** Nearest flame to a point (for the HUD arrow and crackle volume). */
  nearest(x: number, y: number): { x: number; y: number; d: number } | null {
    let best: { x: number; y: number; d: number } | null = null;
    for (const v of this.flames.values()) {
      const d = Math.hypot(v.flame.x - x, v.flame.y - y);
      if (!best || d < best.d) best = { x: v.flame.x, y: v.flame.y - 12, d };
    }
    return best;
  }

  update(dt: number): void {
    const t = this.scene.time.now / 1000;
    let i = 0;
    for (const v of this.flames.values()) {
      const heat = (v.flame.getData('heat') as number) ?? 3;
      const base = 0.85 + Math.min(0.4, heat * 0.06);
      if (!this.scene.tweens.isTweening(v.flame)) {
        const w = 26 * base * (1 + Math.sin(t * 11 + v.seed) * 0.06);
        const h = 34 * base * (1 + Math.sin(t * 13 + v.seed * 2) * 0.12);
        v.flame.setDisplaySize(w, h);
      }
      v.glow.setAlpha(0.26 + Math.sin(t * 7 + v.seed) * 0.08);
      i++;
    }
    this.puff += dt;
    if (i > 0 && this.puff > Math.max(60, 420 / Math.sqrt(i))) {
      this.puff = 0;
      const all = [...this.flames.values()];
      const pick = all[Math.floor(Math.random() * all.length)];
      this.smoke.explode(1, pick.flame.x, pick.flame.y - 24);
      if (Math.random() < 0.5) this.embers.explode(1, pick.flame.x, pick.flame.y - 18);
    }
  }

  destroy(): void {
    for (const v of this.flames.values()) { v.flame.destroy(); v.glow.destroy(); }
    for (const b of this.breaks.values()) b.destroy();
    [this.scorch, this.stamp, this.smoke, this.embers].forEach((o) => o.destroy());
  }
}
