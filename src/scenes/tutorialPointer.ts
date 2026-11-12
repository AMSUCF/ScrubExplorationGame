// The tutorial's hand in the world: a tapping finger with soft ripples over the next thing to tap,
// and a little arrow at the edge of the view when that thing is out of sight (or under the HUD).
import Phaser from 'phaser';

const DEPTH = 250002;
/** Sizes in CSS pixels, so the hand reads the same at every zoom. */
const HAND = 46;
const BADGE = 15;
const EDGE = 26;

export class TutorialPointer {
  private hand: Phaser.GameObjects.Image;
  private ripples: Phaser.GameObjects.Graphics;
  /** The edge badge, drawn fresh each frame (rotated points rather than a rotated container). */
  private edge: Phaser.GameObjects.Graphics;
  private pos: { x: number; y: number } | null = null;

  constructor(private scene: Phaser.Scene) {
    // The finger points up: its tip sits on the target and it taps down onto it.
    this.hand = scene.add.image(0, 0, 'ui_pointer').setOrigin(0.47, 0.2).setDepth(DEPTH).setVisible(false);
    this.ripples = scene.add.graphics().setDepth(DEPTH - 1);
    this.edge = scene.add.graphics().setDepth(DEPTH);
  }

  /**
   * Point at a world spot, or nothing. `topInset` is how much of the screen's top (CSS px) the HUD
   * covers, so a target hidden under it gets an arrow rather than a buried hand.
   */
  update(spot: { x: number; y: number } | null, topInset: number, delta: number): void {
    this.ripples.clear();
    this.edge.clear();
    if (!spot) {
      this.hand.setVisible(false);
      this.pos = null;
      return;
    }
    const cam = this.scene.cameras.main;
    const dpr = (this.scene.registry.get('dpr') as number) ?? 1;
    const k = dpr / cam.zoom; // world units per CSS pixel
    const view = cam.worldView;
    // Glide toward moving targets (animals), but jump straight to a new one.
    if (!this.pos || Math.hypot(spot.x - this.pos.x, spot.y - this.pos.y) > 120) this.pos = { ...spot };
    else {
      const f = Math.min(1, delta / 90);
      this.pos.x += (spot.x - this.pos.x) * f;
      this.pos.y += (spot.y - this.pos.y) * f;
    }
    const { x, y } = this.pos;
    const safe = new Phaser.Geom.Rectangle(view.x + EDGE * k, view.y + (topInset + EDGE) * k, view.width - EDGE * 2 * k, view.height - (topInset + EDGE * 2) * k);
    const t = this.scene.time.now;

    if (safe.contains(x, y)) {
      const tap = Math.abs(Math.sin(t / 340)) * 7 * k;
      this.hand.setVisible(true).setDisplaySize(HAND * k, HAND * k).setPosition(x + 2 * k, y + tap);
      for (let i = 0; i < 2; i++) {
        const phase = ((t / 1300) + i / 2) % 1;
        this.ripples.lineStyle(2.6 * k, 0xfff2b0, (1 - phase) * 0.95);
        this.ripples.strokeEllipse(x, y + 2 * k, (12 + phase * 40) * k, (7 + phase * 21) * k);
      }
      return;
    }
    this.hand.setVisible(false);
    const cx = safe.centerX, cy = safe.centerY;
    const dx = x - cx, dy = y - cy;
    const s = Math.min((safe.width / 2) / Math.abs(dx || 1e-6), (safe.height / 2) / Math.abs(dy || 1e-6));
    const bob = Math.sin(t / 260) * 3 * k;
    const angle = Math.atan2(dy, dx);
    const ax = cx + dx * s - Math.cos(angle) * bob, ay = cy + dy * s - Math.sin(angle) * bob;
    // A round badge with a dart turned toward the target (a plain triangle looks the same every 120°).
    const at = (fx: number, fy: number) => new Phaser.Math.Vector2(ax + (fx * Math.cos(angle) - fy * Math.sin(angle)) * k, ay + (fx * Math.sin(angle) + fy * Math.cos(angle)) * k);
    this.edge.fillStyle(0x3d3328, 0.18).fillCircle(ax, ay + 1.5 * k, BADGE * k);
    this.edge.fillStyle(0xfbf5e6, 0.97).fillCircle(ax, ay, BADGE * k);
    this.edge.lineStyle(2.5 * k, 0xf2c45a, 1).strokeCircle(ax, ay, BADGE * k);
    this.edge.fillStyle(0x5d8a52, 1).fillPoints([at(10, 0), at(-6, -7), at(-2, 0), at(-6, 7)], true);
  }

  destroy(): void {
    this.hand.destroy();
    this.ripples.destroy();
    this.edge.destroy();
  }
}
