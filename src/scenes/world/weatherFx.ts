// Weather you can see: rain sheets that lean with the wind, blown leaves or petals, drifting fog,
// storm gloom, frosty cold snaps, summer fireflies at dusk, and a gentle seasonal colour wash.
import Phaser from 'phaser';
import { WORLD_H, WORLD_W } from '../../config';
import { tex, texScale } from '../../art/effects';
import { Season } from '../../systems/calendar';
import { Weather, WEATHER } from '../../systems/weather';
import { hash2 } from '../../systems/rng';

const SEASON_TINT: Record<Season, [number, number]> = { spring: [0xffd6e4, 0.05], summer: [0xfff0b8, 0.04], fall: [0xe8a050, 0.08], winter: [0xc8dcff, 0.07] };
const WEATHER_TINT: Partial<Record<Weather['kind'], [number, number]>> = {
  storm: [0x2a3040, 0.24], hurricane: [0x232a38, 0.32], rain: [0x4a5a6a, 0.14], fog: [0xf4f4f0, 0.16], cold: [0xa8c8ee, 0.1], heat: [0xffb060, 0.07],
};
/** How far plants lean and rock, in degrees. */
const SWAY: Record<Weather['kind'], number> = { clear: 0.5, breezy: 1.8, heat: 0.3, rain: 1, storm: 2.8, hurricane: 4.2, fog: 0.2, cold: 0.6 };

export class WeatherFx {
  readonly sway: number;
  private seasonTint: Phaser.GameObjects.Rectangle;
  private weatherTint: Phaser.GameObjects.Rectangle;
  private rainZone = new Phaser.Geom.Rectangle(0, 0, 10, 10);
  private driftZone = new Phaser.Geom.Rectangle(0, 0, 10, 10);
  private rain: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private drift: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private fireflies: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private frost: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private fog: Phaser.GameObjects.Image[] = [];
  private puddles: Phaser.GameObjects.Image[] = [];
  private gloom: number;

  constructor(private scene: Phaser.Scene, private weather: Weather, season: Season) {
    const info = WEATHER[weather.kind];
    this.sway = SWAY[weather.kind];
    const [sc, sa] = SEASON_TINT[season];
    this.seasonTint = scene.add.rectangle(0, 0, 8000, 8000, sc, sa).setScrollFactor(0).setDepth(199990);
    const [wc, wa] = WEATHER_TINT[weather.kind] ?? [0xffffff, 0];
    this.gloom = wa;
    this.weatherTint = scene.add.rectangle(0, 0, 8000, 8000, wc, wa).setScrollFactor(0).setDepth(199991);
    const wind = weather.wind, speed = weather.windSpeed;

    if (info.rain > 0) {
      const angle = Phaser.Math.RadToDeg(Math.atan2(420, wind.x * 220 * speed)) - 90;
      this.rain = scene.add.particles(0, 0, tex(scene, 'raindrop'), {
        emitZone: { type: 'random', source: this.rainZone, quantity: 1 } as Phaser.Types.GameObjects.Particles.EmitZoneData,
        speedX: wind.x * 220 * speed,
        speedY: 420,
        rotate: angle,
        lifespan: 650,
        alpha: { start: 0.75, end: 0.3 },
        scale: 0.5 * texScale(scene, 'raindrop'),
        frequency: Math.max(6, 40 - info.rain * 34),
        quantity: Math.ceil(info.rain * 3),
      }).setDepth(199980);
      // Puddles gather in low spots on wet days.
      for (let i = 0; i < 26; i++) {
        const x = hash2(i, 3, 77) * WORLD_W, y = hash2(i, 9, 77) * WORLD_H;
        this.puddles.push(scene.add.image(x, y, tex(scene, 'puddle')).setScale((0.5 + hash2(i, 1, 78) * 0.4) * texScale(scene, 'puddle')).setAlpha(0.7 * info.rain).setDepth(-3));
      }
    }

    // Wind carries something every season: petals, cogon fluff, oak leaves, dry grass seeds.
    const drift = { spring: 'petal', summer: 'seed_fluff', fall: 'leaf_blown', winter: 'leaf_blown' }[season];
    if (speed > 0.25 || season === 'fall' || season === 'spring') {
      const k = texScale(scene, drift);
      this.drift = scene.add.particles(0, 0, tex(scene, drift), {
        emitZone: { type: 'random', source: this.driftZone, quantity: 1 } as Phaser.Types.GameObjects.Particles.EmitZoneData,
        speedX: { min: wind.x * 60 * (0.4 + speed), max: wind.x * 140 * (0.4 + speed) },
        speedY: { min: wind.y * 60 * (0.4 + speed) - 10, max: wind.y * 140 * (0.4 + speed) + 20 },
        rotate: { start: 0, end: 360 * (Math.random() < 0.5 ? 1 : -1) },
        lifespan: 4200,
        alpha: { start: 0.9, end: 0 },
        scale: { min: 0.35 * k, max: 0.55 * k },
        frequency: Math.max(60, 420 - speed * 380),
      }).setDepth(199970);
    }

    if (weather.kind === 'fog') {
      for (let i = 0; i < 9; i++) {
        this.fog.push(scene.add.image(0, 0, tex(scene, 'fog_wisp')).setScale((2.4 + (i % 3) * 0.8) * texScale(scene, 'fog_wisp')).setAlpha(0.45).setDepth(199960).setData('o', { x: hash2(i, 2, 5), y: hash2(i, 4, 5), v: 4 + (i % 4) * 3 }));
      }
    }

    if (season === 'summer' || season === 'spring') {
      const k = texScale(scene, 'firefly');
      this.fireflies = scene.add.particles(0, 0, tex(scene, 'firefly'), {
        emitZone: { type: 'random', source: this.driftZone, quantity: 1 } as Phaser.Types.GameObjects.Particles.EmitZoneData,
        speedX: { min: -12, max: 12 },
        speedY: { min: -10, max: 6 },
        lifespan: 3200,
        alpha: { values: [0, 1, 0.3, 1, 0] } as unknown as Phaser.Types.GameObjects.Particles.EmitterOpOnEmitType,
        scale: { min: 0.4 * k, max: 0.7 * k },
        blendMode: Phaser.BlendModes.ADD,
        frequency: 260,
        emitting: false,
      }).setDepth(199985);
    }

    // A cold snap: frost crystals glint here and there, then melt away.
    if (weather.kind === 'cold') {
      const k = texScale(scene, 'frost');
      this.frost = scene.add.particles(0, 0, tex(scene, 'frost'), {
        emitZone: { type: 'random', source: this.driftZone, quantity: 1 } as Phaser.Types.GameObjects.Particles.EmitZoneData,
        speedX: { min: -3, max: 3 },
        speedY: { min: 2, max: 8 },
        rotate: { min: 0, max: 60 },
        lifespan: 2600,
        alpha: { values: [0, 0.85, 0.85, 0] } as unknown as Phaser.Types.GameObjects.Particles.EmitterOpOnEmitType,
        scale: { min: 0.7 * k, max: 1.1 * k },
        frequency: 140,
      }).setDepth(199975);
    }
  }

  /** Keep screen-wide layers sized to the camera and particles raining on the visible area. */
  update(dt: number, dusk: number): void {
    const cam = this.scene.cameras.main;
    const v = cam.worldView;
    for (const r of [this.seasonTint, this.weatherTint]) r.setPosition(this.scene.scale.width / 2, this.scene.scale.height / 2);
    this.rainZone.setTo(v.x - 80, v.y - 120, v.width + 160, v.height * 0.6);
    this.driftZone.setTo(v.x - 40, v.y - 40, v.width + 80, v.height + 80);
    if (this.fireflies) {
      const on = dusk > 0.25 && this.weather.kind !== 'rain' && this.weather.kind !== 'storm';
      if (on !== this.fireflies.emitting) on ? this.fireflies.start() : this.fireflies.stop();
    }
    this.fog.forEach((f) => {
      const o = f.getData('o') as { x: number; y: number; v: number };
      o.x = (o.x + (o.v * dt) / 1000 / Math.max(1, v.width)) % 1;
      f.setPosition(v.x + o.x * (v.width + 300) - 150, v.y + o.y * v.height);
    });
    // Storms flicker now and then even without a strike.
    if (this.weather.kind === 'storm' || this.weather.kind === 'hurricane') this.weatherTint.setAlpha(this.gloom * (0.9 + Math.sin(this.scene.time.now / 900) * 0.1));
  }

  /** A lightning flash brightens everything for a moment. */
  flash(): void {
    this.scene.cameras.main.flash(160, 255, 252, 236);
    this.weatherTint.setAlpha(0);
    this.scene.time.delayedCall(220, () => this.weatherTint.setAlpha(this.gloom));
  }

  destroy(): void {
    [this.seasonTint, this.weatherTint, this.rain, this.drift, this.fireflies, this.frost, ...this.fog, ...this.puddles].forEach((o) => o?.destroy());
  }
}
