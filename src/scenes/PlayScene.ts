// Shared play loop for the outdoor scrub and the pod interior: tap-to-go, tap-to-act radial menus,
// keyboard support, wordless feedback, and saving. Subclasses describe their space and objects.
import Phaser from 'phaser';
import { BATTERY_DRIVE_DRAIN, REACH, TILE } from '../config';
import { ZoneId } from '../data/map';
import { audio } from '../audio';
import { playActionSound } from '../audio/actions';
import { Robot, floatIcon } from '../entities/Robot';
import { services } from '../services';
import { Action, ActionResult, Target, getActions, performAction } from '../systems/actions';
import { drain } from '../systems/battery';
import { Grid, Tile, findPath } from '../systems/pathfind';
import { clearSave, saveGame } from '../systems/save';
import { GameState, isAnimal, newGame } from '../systems/state';
import { keyVector, setKeyHandlers } from '../ui/input';
import { isOverlayOpen, showBoard, showDiscovery, showFieldGuide, showMenu, showMonitor } from '../ui/overlays';
import { RadialMenu } from '../ui/radial';

export interface Interactable {
  target: Target;
  x: number;
  y: number;
  /** Tap radius in world px. */
  r: number;
  /** How close the robot's feet must be to use it. */
  reach?: number;
}

const TAP_SLOP = 8;
const DRAG_START = 14;

export abstract class PlayScene extends Phaser.Scene {
  protected state!: GameState;
  protected robot!: Robot;
  protected menu!: RadialMenu;
  protected menuTarget: Interactable | null = null;
  protected busy = false;
  protected sparkles!: Phaser.GameObjects.Particles.ParticleEmitter;
  private hoverRing!: Phaser.GameObjects.Graphics;
  private hovered: Interactable | null = null;
  private saveTimer: number | null = null;
  private down: { x: number; y: number; steering: boolean } | null = null;

  // --- what subclasses provide -------------------------------------------------------------
  protected abstract grid(): Grid;
  protected abstract interactables(): Interactable[];
  /** Re-sync sprites with state after something changed. */
  protected abstract refreshViews(): void;
  protected abstract robotSpeed(): number;
  protected abstract zoneInfo(): { zone: ZoneId | null; health: number | null };
  /** The tile the robot would plant on. */
  protected abstract plantSpot(): Tile | null;
  /** Scene-specific results: entering/exiting the pod, sleeping. Return true if handled. */
  protected abstract handleTransition(res: ActionResult): boolean;

  // --- setup -------------------------------------------------------------------------------
  protected setupPlay(): void {
    this.menu = new RadialMenu(services.hud!.layer);
    this.hoverRing = this.add.graphics().setDepth(0.6);
    this.sparkles = this.add.particles(0, 0, 'sparkle', {
      speed: { min: 30, max: 90 },
      lifespan: 650,
      scale: { start: 0.55, end: 0 },
      alpha: { start: 1, end: 0 },
      gravityY: -40,
      emitting: false,
    });
    this.sparkles.setDepth(100000);

    this.input.on('pointerdown', this.onPointerDown, this);
    this.input.on('pointermove', this.onPointerMove, this);
    this.input.on('pointerup', this.onPointerUp, this);
    this.input.on('pointerupoutside', this.onPointerUp, this);

    setKeyHandlers({
      interact: () => this.keyInteract(),
      choose: (i) => this.menu.open && this.menu.pick(i),
      cancel: () => this.closeMenu(),
      guide: () => void this.openGuide(),
    });

    const save = () => this.saveNow();
    document.addEventListener('visibilitychange', save);
    window.addEventListener('pagehide', save);
    this.events.once('shutdown', () => {
      document.removeEventListener('visibilitychange', save);
      window.removeEventListener('pagehide', save);
      this.menu.hide();
      setKeyHandlers(null);
      if (this.saveTimer !== null) window.clearTimeout(this.saveTimer);
    });
    services.hud?.setVisible(true);
  }

  // --- pointer -----------------------------------------------------------------------------

  private hitTest(wx: number, wy: number): Interactable | 'robot' | null {
    if (Math.hypot(wx - this.robot.x, wy - (this.robot.y - 4)) < 18) return 'robot';
    let best: Interactable | null = null;
    let bestD = Infinity;
    for (const it of this.interactables()) {
      const d = Math.hypot(wx - it.x, wy - it.y);
      if (d < it.r + TAP_SLOP && d < bestD) {
        best = it;
        bestD = d;
      }
    }
    return best;
  }

  private onPointerDown(p: Phaser.Input.Pointer): void {
    if (this.busy || isOverlayOpen()) return;
    const hit = this.hitTest(p.worldX, p.worldY);
    if (hit === 'robot') {
      this.openMenu(this.selfInteractable());
      return;
    }
    if (hit) {
      this.openMenu(hit);
      this.approach(hit);
      return;
    }
    this.closeMenu();
    this.down = { x: p.x, y: p.y, steering: false };
    this.walkToPoint(p.worldX, p.worldY);
    audio.sfx('tap', { vol: 0.6 });
    this.tapMarker(p.worldX, p.worldY);
  }

  private onPointerMove(p: Phaser.Input.Pointer): void {
    if (this.down && p.isDown) {
      if (!this.down.steering && Math.hypot(p.x - this.down.x, p.y - this.down.y) > DRAG_START) this.down.steering = true;
      if (this.down.steering) this.robot.steer(p.worldX, p.worldY);
      return;
    }
    // Mouse hover highlight (desktop).
    if (p.wasTouch || isOverlayOpen()) return;
    const hit = this.hitTest(p.worldX, p.worldY);
    this.hovered = hit && hit !== 'robot' ? hit : null;
    this.game.canvas.style.cursor = hit ? 'pointer' : 'default';
  }

  private onPointerUp(): void {
    if (this.down?.steering) this.robot.stop();
    this.down = null;
  }

  private tapMarker(x: number, y: number): void {
    const g = this.add.graphics().setDepth(0.7);
    g.lineStyle(2, 0xfffaf0, 0.9);
    g.strokeCircle(0, 0, 8);
    g.setPosition(x, y);
    this.tweens.add({ targets: g, scale: 1.8, alpha: 0, duration: 380, onComplete: () => g.destroy() });
  }

  // --- movement ----------------------------------------------------------------------------

  private toTile(x: number, y: number): Tile {
    return { tx: Math.floor(x / TILE), ty: Math.floor(y / TILE) };
  }

  private center(t: Tile): { x: number; y: number } {
    return { x: t.tx * TILE + TILE / 2, y: t.ty * TILE + TILE / 2 };
  }

  /** Path the robot's feet to within `reach` of a point, then run `then`. */
  protected walkNear(x: number, y: number, reach: number, then?: () => void): void {
    const feet = this.robot.feet;
    if (Math.hypot(feet.x - x, feet.y - y) <= reach) {
      this.robot.stop();
      then?.();
      return;
    }
    const grid = this.grid();
    const start = this.toTile(feet.x, feet.y);
    const path = findPath(
      grid,
      start,
      (t) => {
        const c = this.center(t);
        return Math.hypot(c.x - x, c.y - y) <= reach;
      },
      this.toTile(x, y),
    );
    if (!path) {
      this.robot.emote('❓');
      return;
    }
    this.robot.walk(path.map((t) => this.center(t)), then);
  }

  private walkToPoint(x: number, y: number): void {
    const grid = this.grid();
    const goal = this.toTile(x, y);
    if (goal.tx < 0 || goal.ty < 0 || goal.tx >= grid.w || goal.ty >= grid.h) return;
    const feet = this.robot.feet;
    const path = findPath(grid, this.toTile(feet.x, feet.y), (t) => Math.abs(t.tx - goal.tx) <= (grid.blocked(goal.tx, goal.ty) ? 1 : 0) && Math.abs(t.ty - goal.ty) <= (grid.blocked(goal.tx, goal.ty) ? 1 : 0), goal);
    if (!path) return;
    const points = path.map((t) => this.center(t));
    // Finish exactly where tapped when that spot is walkable.
    if (!grid.blocked(goal.tx, goal.ty)) {
      if (points.length > 0) points[points.length - 1] = { x, y };
      else points.push({ x, y });
    }
    this.robot.walk(points);
  }

  private approach(it: Interactable, then?: () => void): void {
    if (it.target.type === 'self') {
      then?.();
      return;
    }
    this.walkNear(it.x, it.y, (it.reach ?? REACH) - 6, then);
  }

  private inReach(it: Interactable): boolean {
    if (it.target.type === 'self') return true;
    const feet = this.robot.feet;
    return Math.hypot(feet.x - it.x, feet.y - it.y) <= (it.reach ?? REACH);
  }

  // --- menu --------------------------------------------------------------------------------

  protected selfInteractable(): Interactable {
    return { target: { type: 'self', spot: this.plantSpot() }, x: this.robot.x, y: this.robot.y - 6, r: 18 };
  }

  protected openMenu(it: Interactable): void {
    const actions = getActions(this.state, it.target);
    if (actions.length === 0) {
      this.closeMenu();
      this.approach(it);
      return;
    }
    this.menuTarget = it;
    this.menu.show(actions, (a) => this.choose(a));
    audio.sfx('open');
    this.positionMenu();
  }

  protected closeMenu(): void {
    this.menuTarget = null;
    this.menu.hide();
  }

  /** Live interactable for the current menu target (animals move; entities may be gone). */
  private liveMenuTarget(): Interactable | null {
    const mt = this.menuTarget;
    if (!mt) return null;
    if (mt.target.type === 'self') return this.selfInteractable();
    if (mt.target.type === 'entity') {
      const id = mt.target.entity.id;
      return this.interactables().find((i) => i.target.type === 'entity' && i.target.entity.id === id) ?? null;
    }
    return mt;
  }

  private positionMenu(): void {
    const it = this.liveMenuTarget();
    if (!it) return;
    const cam = this.cameras.main;
    const dpr = (this.registry.get('dpr') as number) ?? 1;
    const sx = ((it.x - cam.worldView.x) * cam.zoom) / dpr;
    const sy = ((it.y - 12 - cam.worldView.y) * cam.zoom) / dpr;
    this.menu.moveTo(sx, sy);
  }

  private choose(a: Action): void {
    const it = this.liveMenuTarget();
    if (!it) return this.closeMenu();
    const instant = a.verb === 'info' || a.verb === 'goHome' || a.verb === 'board' || a.verb === 'monitor';
    if (instant || this.inReach(it)) {
      void this.perform(a, it);
    } else {
      this.approach(it, () => {
        const live = this.liveMenuTarget();
        if (live && this.inReach(live)) void this.perform(a, live);
      });
    }
  }

  private keyInteract(): void {
    if (this.busy || isOverlayOpen()) return;
    if (this.menu.open) return this.closeMenu();
    const feet = this.robot.feet;
    let best: Interactable | null = null;
    let bestD = Infinity;
    for (const it of this.interactables()) {
      const d = Math.hypot(feet.x - it.x, feet.y - it.y);
      if (d <= (it.reach ?? REACH) && d < bestD) {
        best = it;
        bestD = d;
      }
    }
    this.openMenu(best ?? this.selfInteractable());
  }

  // --- doing -------------------------------------------------------------------------------

  private async perform(a: Action, it: Interactable): Promise<void> {
    // Re-resolve the action against current state (things may have changed while walking).
    const fresh = getActions(this.state, it.target).find((x) => x.verb === a.verb && x.param === a.param);
    if (!fresh) return;
    if (a.verb === 'goHome') {
      this.closeMenu();
      this.goHome();
      return;
    }
    const hpBefore = it.target.type === 'entity' && 'hp' in it.target.entity ? it.target.entity.hp : 0;
    const res = performAction(this.state, fresh);
    playActionSound(fresh, res, hpBefore);
    this.feedback(res);
    if (!res.ok) return;
    if (this.handleTransition(res)) {
      this.closeMenu();
      this.saveSoon();
      return;
    }
    this.refreshViews();
    this.saveSoon();

    if (res.scanned) {
      services.unseenGuide++;
      await showDiscovery(res.scanned);
    }
    if (res.open === 'guide') await showFieldGuide(this.state, res.guideId);
    if (res.open === 'monitor') await showMonitor(this.state);
    if (res.open === 'board') await showBoard(this.state);

    // Keep the menu up for repeat taps (e.g. cutting pepper ×3) while there's still something to do.
    const live = this.liveMenuTarget();
    if (live && this.menuTarget) {
      const next = getActions(this.state, live.target);
      if (next.length && next.some((n) => n.enabled)) this.menu.setActions(next);
      else this.closeMenu();
    } else {
      this.closeMenu();
    }
  }

  /** Overridden outdoors: drive back to the pod. */
  protected goHome(): void {}

  protected feedback(res: ActionResult): void {
    if (res.mood) this.robot.emote(res.mood);
    const at = res.at ?? { x: this.robot.x, y: this.robot.y - 10 };
    res.gains.forEach((g, i) => {
      this.time.delayedCall(i * 180, () => {
        floatIcon(this, at.x - 6, at.y - 16, `+${g.n}${g.icon}`, g.tex);
        audio.sfx('gain', { vol: 0.7 });
      });
    });
    switch (res.fx) {
      case 'hit':
        this.sparkles.explode(3, at.x, at.y);
        this.cameras.main.shake(60, 0.002);
        break;
      case 'pop':
      case 'capture':
        this.sparkles.explode(10, at.x, at.y);
        break;
      case 'sparkle':
        this.sparkles.explode(14, at.x, at.y - 6);
        break;
      case 'scan': {
        const ring = this.add.image(at.x, at.y, 'ring').setScale(0.2).setDepth(100001);
        this.tweens.add({ targets: ring, scale: 1.4, alpha: 0, duration: 600, onComplete: () => ring.destroy() });
        break;
      }
      case 'none':
        break;
    }
    if (res.rescued.length) audio.sfx('rescue', { delay: 0.25 });
    for (const r of res.rescued) {
      const c = { x: r.tx * TILE + 16, y: r.ty * TILE + 10 };
      this.time.delayedCall(250, () => {
        this.sparkles.explode(18, c.x, c.y);
        floatIcon(this, c.x - 6, c.y - 20, '💚');
      });
    }
  }

  async openPause(): Promise<void> {
    if (isOverlayOpen() || this.busy) return;
    this.closeMenu();
    if ((await showMenu(this.state)) === 'new') {
      clearSave();
      services.unseenGuide = 0;
      this.scene.start('Intro', { state: newGame() });
    }
  }

  async openGuide(): Promise<void> {
    if (isOverlayOpen() || this.busy) return;
    services.unseenGuide = 0;
    this.closeMenu();
    await showFieldGuide(this.state);
  }

  // --- saving ------------------------------------------------------------------------------

  protected saveSoon(): void {
    if (this.saveTimer !== null) return;
    this.saveTimer = window.setTimeout(() => {
      this.saveTimer = null;
      this.saveNow();
    }, 800);
  }

  protected abstract recordPosition(): void;

  protected saveNow(): void {
    if (!this.robot) return;
    this.recordPosition();
    saveGame(this.state);
  }

  // --- frame -------------------------------------------------------------------------------

  protected updatePlay(delta: number): void {
    const dt = Math.min(delta, 50);
    const keys = this.busy ? { x: 0, y: 0 } : keyVector();
    const mag = this.robot.update(dt, keys, this.robotSpeed(), !!this.state.crate);
    audio.motor(mag);
    if (mag > 0.05) drain(this.state, (BATTERY_DRIVE_DRAIN * mag * dt) / 1000);

    if (this.menu.open) {
      if (!this.liveMenuTarget()) this.closeMenu();
      else this.positionMenu();
    }

    const g = this.hoverRing;
    g.clear();
    const ring = this.menu.open ? this.liveMenuTarget() : this.hovered;
    if (ring && ring.target.type !== 'self') {
      const pulse = 0.6 + Math.sin(this.time.now / 220) * 0.2;
      g.lineStyle(2, 0xfff2b0, pulse);
      g.fillStyle(0xfff2b0, pulse * 0.35);
      const w = Math.max(30, ring.r * 1.6);
      const y = ring.target.type === 'entity' && isAnimal(ring.target.entity) ? ring.y + 2 : ring.y + 8;
      g.fillEllipse(ring.x, y, w, w * 0.42);
      g.strokeEllipse(ring.x, y, w, w * 0.42);
    }

    const { zone, health } = this.zoneInfo();
    services.hud?.update(this.state, zone, health, services.unseenGuide);
  }
}
