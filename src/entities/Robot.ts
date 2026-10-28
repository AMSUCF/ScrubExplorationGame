// The player robot: path following, springy antennas, blinking, and wordless emotes.
import Phaser from 'phaser';
import { ART_SCALE } from '../art/placeholders';
import { audio } from '../audio';
import { RobotMood } from '../audio/voices';
import { Mood } from '../systems/actions';

const S = 1 / ART_SCALE;

const MOOD_ICON: Record<Mood, string> = {
  happy: '✨',
  love: '💗',
  sad: '💧',
  surprise: '❗',
  proud: '⭐',
};

const EMOTE_VOICE: Record<string, RobotMood> = {
  happy: 'happy',
  love: 'love',
  sad: 'sad',
  surprise: 'surprise',
  proud: 'proud',
  '❓': 'question',
  '❗': 'surprise',
  '📸': 'curious',
  '🪫': 'sad',
};

export class Robot {
  readonly body: Phaser.Physics.Arcade.Image;
  private antennas: Phaser.GameObjects.Image[];
  private crate: Phaser.GameObjects.Image;
  private path: { x: number; y: number }[] = [];
  private onArrive: (() => void) | null = null;
  private follow: { x: number; y: number } | null = null;
  private stuckTime = 0;
  private lastPos = { x: 0, y: 0 };
  private blinkAt = 0;
  private happyUntil = 0;
  facing = { x: 0, y: 1 };

  constructor(
    private scene: Phaser.Scene,
    x: number,
    y: number,
  ) {
    this.body = scene.physics.add.image(x, y, 'robot').setScale(S);
    this.body.setCircle(18, 18, 38);
    this.body.setCollideWorldBounds(true);
    this.antennas = [0, 1].map(() => scene.add.image(x, y, 'antenna').setScale(S).setOrigin(0.5, 0.95));
    this.crate = scene.add.image(x, y, 'crate').setScale(S).setVisible(false);
    this.blinkAt = scene.time.now + 2000;
  }

  get x(): number {
    return this.body.x;
  }

  get y(): number {
    return this.body.y;
  }

  /** Feet position: where the robot actually stands. */
  get feet(): { x: number; y: number } {
    return { x: this.body.x, y: this.body.y + 8 };
  }

  setPosition(x: number, y: number): void {
    this.body.setPosition(x, y);
    this.stop();
  }

  walk(points: { x: number; y: number }[], onArrive?: () => void): void {
    this.follow = null;
    this.path = points;
    this.onArrive = onArrive ?? null;
    this.stuckTime = 0;
    if (points.length === 0) this.arrive();
  }

  /** Drive straight toward a point every frame (finger held down). */
  steer(x: number, y: number): void {
    this.path = [];
    this.onArrive = null;
    this.follow = { x, y };
  }

  stop(): void {
    this.path = [];
    this.follow = null;
    this.onArrive = null;
    this.body.setVelocity(0, 0);
  }

  get busy(): boolean {
    return this.path.length > 0 || !!this.follow;
  }

  private arrive(): void {
    const cb = this.onArrive;
    this.path = [];
    this.onArrive = null;
    this.body.setVelocity(0, 0);
    cb?.();
  }

  /** Returns how fast the robot moved this frame (0..1) for battery drain. */
  update(dtMs: number, keys: { x: number; y: number }, speed: number, carrying: boolean): number {
    let vx = 0;
    let vy = 0;
    if (keys.x || keys.y) {
      this.path = [];
      this.follow = null;
      this.onArrive = null;
      vx = keys.x;
      vy = keys.y;
    } else if (this.follow) {
      const dx = this.follow.x - this.body.x;
      const dy = this.follow.y - (this.body.y + 8);
      const d = Math.hypot(dx, dy);
      if (d > 6) {
        vx = dx / d;
        vy = dy / d;
      }
    } else if (this.path.length > 0) {
      const next = this.path[0];
      const dx = next.x - this.body.x;
      const dy = next.y - (this.body.y + 8);
      const d = Math.hypot(dx, dy);
      if (d < 5) {
        this.path.shift();
        if (this.path.length === 0) this.arrive();
      } else {
        vx = dx / d;
        vy = dy / d;
      }
      // Give up gracefully if something blocks the way.
      const moved = Math.hypot(this.body.x - this.lastPos.x, this.body.y - this.lastPos.y);
      this.stuckTime = moved < 0.2 ? this.stuckTime + dtMs : 0;
      if (this.stuckTime > 700) this.arrive();
    }
    this.lastPos = { x: this.body.x, y: this.body.y };
    this.body.setVelocity(vx * speed, vy * speed);
    const mag = Math.min(1, Math.hypot(vx, vy));

    const t = this.scene.time.now;
    if (mag > 0.05) {
      this.facing = { x: vx / mag, y: vy / mag };
      if (Math.abs(vx) > 0.1) this.body.setFlipX(vx < 0);
      this.body.setAngle(Math.sin(t / 80) * 2);
    } else {
      this.body.setAngle(0);
    }

    // Blink now and then; squint happily after good deeds.
    if (t > this.blinkAt) {
      this.body.setTexture('robot_blink');
      if (t > this.blinkAt + 130) {
        this.body.setTexture(t < this.happyUntil ? 'robot_happy' : 'robot');
        this.blinkAt = t + 2200 + Math.random() * 2600;
      }
    } else if (this.body.texture.key === 'robot_happy' && t > this.happyUntil) {
      this.body.setTexture('robot');
    }

    // Springy antennas that lean back as the robot drives.
    const bob = mag > 0.05 ? Math.sin(t / 80) * 1 : 0;
    this.antennas.forEach((a, i) => {
      const side = i === 0 ? -1 : 1;
      a.setPosition(this.body.x + side * 6.5, this.body.y - 10.5 + bob);
      a.setAngle(side * 10 + Math.sin(t / 260 + i) * 6 - vx * 14);
      a.setDepth(this.body.y + 7.9);
    });
    this.body.setDepth(this.body.y + 8);
    this.crate.setVisible(carrying);
    if (carrying) this.crate.setPosition(this.body.x, this.body.y - 26 + bob).setDepth(this.body.y + 9);
    return mag;
  }

  /** A wordless reaction bubble above the robot's head. */
  emote(mood: Mood | string): void {
    const icon = mood in MOOD_ICON ? MOOD_ICON[mood as Mood] : mood;
    if (mood === 'love' || mood === 'happy' || mood === 'proud') {
      this.happyUntil = this.scene.time.now + 900;
      this.body.setTexture('robot_happy');
    }
    floatIcon(this.scene, this.body.x + 10, this.body.y - 30, icon);
    const voice = EMOTE_VOICE[mood];
    // Everyday "happy" chirps are sprinkled in so repeated chores don't get noisy.
    if (voice && (voice !== 'happy' || Math.random() < 0.35)) audio.robot(voice, { delay: 0.05 });
    if (mood === 'sad') this.scene.tweens.add({ targets: this.antennas, angle: '+=25', duration: 120, yoyo: true });
  }
}

/** Emoji (and optional texture) that drifts up and fades — used for emotes and pickups. */
export function floatIcon(scene: Phaser.Scene, x: number, y: number, text: string, tex?: string): void {
  const parts: Phaser.GameObjects.GameObject[] = [];
  const label = scene.add.text(0, 0, text, { fontSize: '15px', fontFamily: 'Nunito, system-ui, sans-serif', color: '#3d3328', stroke: '#fffaf0', strokeThickness: 3 });
  label.setResolution(3).setOrigin(0, 0.5);
  if (tex) {
    const pic = scene.add.image(0, 0, tex).setOrigin(1, 0.5);
    pic.setScale(Math.min(18 / pic.width, 18 / pic.height));
    parts.push(pic);
  }
  parts.push(label);
  const c = scene.add.container(x, y, parts).setDepth(300000);
  scene.tweens.add({ targets: c, y: y - 26, alpha: { from: 1, to: 0 }, duration: 1100, ease: 'Sine.Out', onComplete: () => c.destroy() });
}
