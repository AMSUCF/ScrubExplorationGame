// Wordless opening: a pod streaks down into the neglected scrub, thumps into the sand, and a
// small robot peeks out, looks around at the mess, and decides to help.
import Phaser from 'phaser';
import { ART_SCALE } from '../art/placeholders';
import { TILE, WORLD_H, WORLD_W } from '../config';
import { BASE_CENTER, POD, tileCenter } from '../data/map';
import { audio } from '../audio';
import { Robot } from '../entities/Robot';
import { services } from '../services';
import { GameState, isAnimal } from '../systems/state';
import { ICON } from '../data/icons';
import { renderIcons } from '../ui/icons';

const S = 1 / ART_SCALE;

export class IntroScene extends Phaser.Scene {
  private state!: GameState;
  private robot: Robot | null = null;
  private skipBtn: HTMLButtonElement | null = null;
  private done = false;

  constructor() {
    super('Intro');
  }

  init(data: { state: GameState }): void {
    this.state = data.state;
    this.robot = null;
    this.done = false;
  }

  create(): void {
    services.hud?.setVisible(false);
    audio.music('intro');
    audio.ambient('day');
    audio.sfx('whoosh', { vol: 0.9 });
    this.add.image(0, 0, 'ground').setOrigin(0).setDepth(-10);
    for (const e of this.state.entities) {
      if (isAnimal(e)) {
        this.add.image(e.x, e.y, e.species).setOrigin(0.5, 0.85).setScale(S).setDepth(e.y);
      } else if (e.kind !== 'burrow') {
        const p = tileCenter(e.tx, e.ty);
        const img = this.add.image(p.x, p.y + 10, e.species).setOrigin(0.5, 1).setScale(S).setDepth(p.y + 10);
        if (e.kind === 'nativePlant') img.setTint(0xb8b08a);
      }
    }
    const recycler = tileCenter(BASE_CENTER.tx - 4, BASE_CENTER.ty + 1);
    const pad = tileCenter(BASE_CENTER.tx + 4, BASE_CENTER.ty + 1);
    this.add.image(recycler.x, recycler.y + 18, 'recycler').setOrigin(0.5, 1).setScale(S).setDepth(recycler.y + 18);
    this.add.image(pad.x, pad.y + 18, 'pad').setOrigin(0.5, 1).setScale(S).setDepth(pad.y + 18);

    const cam = this.cameras.main;
    const dpr = (this.registry.get('dpr') as number) ?? 1;
    const zoom = Phaser.Math.Clamp(Math.min(this.scale.width, this.scale.height) / dpr / (TILE * 10), 1, 2.4);
    cam.setZoom(zoom * dpr);
    cam.setBounds(0, 0, WORLD_W, WORLD_H);
    const land = tileCenter(POD.tx, POD.ty);
    const landY = land.y + TILE / 2 + 2;
    cam.centerOn(land.x, land.y);

    // Night sky fading to morning.
    const sky = this.add.rectangle(0, 0, 8000, 8000, 0x2a2650, 0.55).setScrollFactor(0).setDepth(200000);
    sky.setPosition(this.scale.width / 2, this.scale.height / 2);
    this.tweens.add({ targets: sky, alpha: 0, duration: 4200, delay: 1200 });

    // The pod falls with a fiery trail.
    const pod = this.add.image(land.x, landY - 520, 'pod_shut').setOrigin(0.5, 1).setScale(S).setDepth(landY);
    const flame = this.add.image(land.x, landY - 520, 'flame').setOrigin(0.5, 1).setScale(S * 1.4).setDepth(landY - 1).setAngle(180);
    const shadow = this.add.ellipse(land.x, landY - 4, 20, 6, 0x3d2d19, 0.25).setDepth(1);
    this.tweens.add({ targets: shadow, width: 90, height: 16, alpha: 0.35, duration: 1800, ease: 'Quad.In' });
    this.tweens.add({
      targets: pod,
      y: landY,
      duration: 1800,
      ease: 'Quad.In',
      onUpdate: () => flame.setPosition(pod.x, pod.y - 66),
      onComplete: () => this.landed(pod, flame, land.x, landY),
    });

    this.addSkip();
    this.events.once('shutdown', () => this.skipBtn?.remove());
  }

  private landed(pod: Phaser.GameObjects.Image, flame: Phaser.GameObjects.Image, x: number, y: number): void {
    flame.destroy();
    audio.sfx('land');
    this.cameras.main.shake(380, 0.012);
    const dust = this.add.particles(x, y - 4, 'dust', {
      speed: { min: 40, max: 140 },
      angle: { min: 180, max: 360 },
      lifespan: 900,
      scale: { start: 0.9, end: 0 },
      alpha: { start: 0.9, end: 0 },
      emitting: false,
    });
    dust.setDepth(y + 1);
    dust.explode(26);

    // Door pops open; the robot peeks out.
    this.time.delayedCall(900, () => {
      pod.setTexture('pod0');
      audio.sfx('pop');
      audio.robot('wake', { delay: 0.3 });
      const robot = new Robot(this, x, y - 22);
      this.robot = robot;
      robot.body.setAlpha(0).setScale(S * 0.6);
      this.tweens.add({ targets: robot.body, alpha: 1, scale: S, duration: 350, ease: 'Back.Out' });
      this.tweens.add({ targets: robot.body, y: y + 36, duration: 700, delay: 400, ease: 'Sine.InOut' });
      this.time.delayedCall(1300, () => this.lookAround());
    });
  }

  private lookAround(): void {
    const robot = this.robot!;
    const steps: [number, () => void][] = [
      [0, () => robot.body.setFlipX(true)],
      [550, () => robot.body.setFlipX(false)],
      [1100, () => robot.emote('❓')],
      [1700, () => this.panToTrouble()],
    ];
    for (const [t, fn] of steps) this.time.delayedCall(t, fn);
  }

  /** Glance at the smothered plant just north of base, then back: there's work to do. */
  private panToTrouble(): void {
    const cam = this.cameras.main;
    const trouble = tileCenter(BASE_CENTER.tx - 2, BASE_CENTER.ty - 7);
    cam.pan(trouble.x, trouble.y, 1100, 'Sine.easeInOut');
    this.time.delayedCall(1400, () => {
      const rosemary = this.add.image(trouble.x + 6, trouble.y - 30, 'ui_sad').setDisplaySize(16, 16).setDepth(300000);
      this.tweens.add({ targets: rosemary, y: trouble.y - 40, alpha: 0, duration: 1200, delay: 600 });
    });
    this.time.delayedCall(2600, () => cam.pan(this.robot!.x, this.robot!.y, 900, 'Sine.easeInOut'));
    this.time.delayedCall(3600, () => this.robot!.emote('❗'));
    this.time.delayedCall(4200, () => this.robot!.emote('love'));
    this.time.delayedCall(5000, () => this.finish());
  }

  private addSkip(): void {
    const btn = document.createElement('button');
    btn.className = 'skip-btn';
    btn.innerHTML = renderIcons(ICON.skip);
    btn.setAttribute('aria-label', 'Skip intro');
    btn.addEventListener('click', () => this.finish());
    document.body.appendChild(btn);
    this.skipBtn = btn;
  }

  private finish(): void {
    if (this.done) return;
    this.done = true;
    this.skipBtn?.remove();
    this.state.introSeen = true;
    const cam = this.cameras.main;
    cam.fadeOut(400, 255, 248, 235);
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('World', { state: this.state }));
  }

  update(_t: number, delta: number): void {
    this.robot?.update(delta, { x: 0, y: 0 }, 0, false);
  }
}
