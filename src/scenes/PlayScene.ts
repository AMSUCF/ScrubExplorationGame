// Shared play loop for the outdoor scrub and the pod interior: tap-to-go, tap-to-act radial menus,
// keyboard support, wordless feedback, and saving. Subclasses describe their space and objects.
import Phaser from 'phaser';
import { BATTERY_DRIVE_DRAIN, REACH, TILE } from '../config';
import { ZoneId, tileCenter } from '../data/map';
import { audio } from '../audio';
import { playActionSound } from '../audio/actions';
import { Robot, floatIcon } from '../entities/Robot';
import { services } from '../services';
import { ICON } from '../data/icons';
import { Action, ActionResult, Minigame, Target, getActions, performAction, result, withCredit } from '../systems/actions';
import { CareEvent } from '../systems/progress';
import { logGuests, planBurrow } from '../systems/minigames/burrowScope';
import { digOut } from '../systems/minigames/rhizome';
import { recordPortrait } from '../systems/minigames/portrait';
import { bagContents, finishSort } from '../systems/minigames/sorting';
import { WEATHER } from '../systems/weather';
import { showBurrowScope } from '../ui/minigames/burrowScope';
import { showFireLine } from '../ui/minigames/fireLine';
import { showPortrait } from '../ui/minigames/portrait';
import { showRhizomeDig } from '../ui/minigames/rhizome';
import { showSorting } from '../ui/minigames/sorting';
import { drain } from '../systems/battery';
import { Grid, Tile, findPath } from '../systems/pathfind';
import { clearSave, saveGame } from '../systems/save';
import { GameState, isAnimal, newGame } from '../systems/state';
import { vineHost } from '../data/visuals';
import { showVineCare } from '../ui/vineCare';
import { targetInfo } from '../ui/targetInfo';
import { keyVector, setKeyHandlers } from '../ui/input';
import { isOverlayOpen, showBoard, showDiscovery, showFieldGuide, showLevelUp, showMenu, showMonitor } from '../ui/overlays';
import { RadialMenu } from '../ui/radial';

export interface Interactable {
  target: Target;
  x: number;
  y: number;
  /** Tap radius in world px. */
  r: number;
  /** How close the robot's feet must be to use it. */
  reach?: number;
  /** Art bounds can extend well above a small walkable trunk footprint. */
  bounds?: { x: number; y: number; w: number; h: number };
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
  protected down: { x: number; y: number; steering: boolean } | null = null;

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
      this.menu.destroy();
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
      const b = it.bounds;
      const d = b ? Math.hypot((wx - b.x - b.w / 2) / (b.w / 2), (wy - b.y - b.h / 2) / (b.h / 2)) : Math.hypot(wx - it.x, wy - it.y) / (it.r + TAP_SLOP);
      const inside = b ? wx >= b.x && wx <= b.x + b.w && wy >= b.y && wy <= b.y + b.h : d < 1;
      if (inside && d < bestD) {
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
    if (this.busy || isOverlayOpen()) { this.down = null; return; }
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
    this.menu.show(actions, (a) => this.choose(a), targetInfo(this.state, it.target), () => this.closeMenu());
    audio.sfx('open');
    this.positionMenu();
  }

  protected closeMenu(): void {
    this.menuTarget = null;
    this.menu.hide();
  }

  /** Live interactable for the current menu target (animals move; entities may be gone). */
  protected liveMenuTarget(): Interactable | null {
    const mt = this.menuTarget;
    if (!mt) return null;
    if (mt.target.type === 'self') return this.selfInteractable();
    if (mt.target.type === 'entity') {
      const id = mt.target.entity.id;
      return this.interactables().find((i) => i.target.type === 'entity' && i.target.entity.id === id) ?? null;
    }
    if (mt.target.type === 'fire') {
      const { tx, ty } = mt.target;
      return this.interactables().find((i) => i.target.type === 'fire' && i.target.tx === tx && i.target.ty === ty) ?? null;
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
    if (this.busy || isOverlayOpen()) return;
    const it = this.liveMenuTarget();
    if (!it) return this.closeMenu();
    const instant = a.verb === 'info' || a.verb === 'goHome' || a.verb === 'board' || a.verb === 'monitor' || a.verb === 'watchFire';
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

  protected async perform(a: Action, it: Interactable): Promise<void> {
    // Re-resolve the action against current state (things may have changed while walking).
    const fresh = getActions(this.state, it.target).find((x) => x.verb === a.verb && x.param === a.param);
    if (!fresh) return;
    if (a.verb === 'goHome') {
      this.closeMenu();
      this.goHome();
      return;
    }
    if (!fresh.enabled) return;
    const vine = a.verb === 'rescue'
      ? this.state.entities.find(e => e.kind === 'invasivePlant' && e.species === 'airpotato' && String(e.id) === a.param)
      : it.target.type === 'entity' && it.target.entity.kind === 'invasivePlant' && it.target.entity.species === 'airpotato' && a.verb === 'remove' ? it.target.entity : undefined;
    if (vine?.kind === 'invasivePlant') {
      this.busy = true; this.robot.stop(); this.down = null; this.menu.hide();
      let complete = false;
      try { complete = await showVineCare(vine, vineHost(this.state, vine), () => this.saveNow()); }
      finally { this.busy = false; }
      if (!complete) { this.openMenu(it); return; }
    } else if (a.verb === 'remove') {
      this.busy = true; this.robot.stop();
      const name = targetInfo(this.state, it.target).name;
      services.hud?.setWork(`${a.icon} ${a.label} · ${name}`, 850);
      await new Promise<void>(resolve => this.time.delayedCall(850, () => resolve()));
      services.hud?.setWork(null);
      this.busy = false;
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
    await this.celebrate(res);
    if (res.play) {
      await this.runMinigame(res.play, fresh);
      return;
    }

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
      if (next.length && next.some((n) => n.enabled)) {
        this.menu.show(next, (action) => this.choose(action), targetInfo(this.state, live.target), () => this.closeMenu());
      }
      else this.closeMenu();
    } else {
      this.closeMenu();
    }
  }

  /** Overridden outdoors: drive back to the pod. */
  protected goHome(): void {}

  /** Play a close-up activity, then apply its outcome to the world. */
  protected async runMinigame(kind: Minigame, a: Action): Promise<void> {
    this.busy = true;
    this.robot.stop();
    this.down = null;
    this.menu.hide();
    const s = this.state;
    const t = a.target;
    const e = t.type === 'entity' ? t.entity : null;
    let out: ActionResult | null = null;
    try {
      switch (kind) {
        case 'photo': {
          if (e?.kind !== 'nativeAnimal') break;
          const shot = await showPortrait(e.species, e.id);
          const rec = recordPortrait(s, e.species, shot.stars);
          out = result({ fx: shot.stars ? 'sparkle' : 'none', at: { x: e.x, y: e.y - 10 }, mood: shot.stars >= 2 ? 'love' : 'happy', gains: rec.reward ? [{ icon: ICON.parts, n: rec.reward }] : [] });
          out.note = shot.stars === 0 ? undefined : rec.improved ? `A ${shot.stars}-star portrait, pinned to your corkboard.` : `Nice shot! Your best is still ${rec.best} stars.`;
          withCredit(out, s, [['photo', shot.stars >= 2 ? 1 : 0, shot.stars * 3]]);
          break;
        }
        case 'dig': {
          if (e?.kind !== 'invasivePlant') break;
          const dig = await showRhizomeDig(e.id * 7919 + s.day);
          const { removed, rescued } = digOut(s, e, dig.complete);
          out = result({ fx: 'pop', at: tileCenter(e.tx, e.ty), rescued, mood: dig.complete ? 'proud' : 'happy', note: dig.complete ? `Roots and all! ${removed} clump${removed === 1 ? '' : 's'} lifted for good.` : 'Clump lifted. A few runners stayed behind.' });
          const events: [CareEvent, number?, number?][] = [['dig', 1, 4 + dig.stars * 3], ['clear', removed]];
          if (rescued.length) events.push(['rescue', rescued.length]);
          withCredit(out, s, events);
          break;
        }
        case 'scope': {
          if (e?.kind !== 'burrow') break;
          const { seen } = await showBurrowScope(planBurrow(s, e));
          const { fresh, parts } = logGuests(s, seen);
          services.unseenGuide += fresh.length;
          out = result({ fx: 'sparkle', mood: fresh.length ? 'surprise' : 'happy', gains: parts ? [{ icon: ICON.parts, n: parts }] : [], note: fresh.length ? `New in your field guide: ${fresh.length} burrow neighbor${fresh.length === 1 ? '' : 's'}!` : seen.length ? 'Everyone is snug and safe down there.' : undefined });
          withCredit(out, s, [['scope', 1, 4 + seen.length * 2]]);
          break;
        }
        case 'sort': {
          const placed = await showSorting(bagContents(s));
          const sorted = finishSort(s, placed);
          out = result({ fx: 'sparkle', mood: 'proud', gains: [{ icon: ICON.parts, n: sorted.parts }], note: sorted.bonus ? `Careful sorting: +${sorted.bonus} bonus part${sorted.bonus === 1 ? '' : 's'}.` : undefined });
          withCredit(out, s, [['sort', 1, sorted.correct], ['recycle', sorted.total]]);
          break;
        }
        case 'fireLine': {
          if (t.type !== 'fire') break;
          const line = await showFireLine(s, { tx: t.tx, ty: t.ty });
          if (line.contained) {
            s.fireToday.contained++;
            s.stats.contained = (s.stats.contained ?? 0) + 1;
            out = result({ mood: 'proud', note: line.lost ? `Fire contained. ${line.lost} young plant${line.lost === 1 ? ' was' : 's were'} lost.` : 'Fire contained, and every native in reach is safe.' });
            withCredit(out, s, [['contain', 1, 6 + line.stars * 3]]);
          } else {
            out = result({ mood: 'surprise', note: 'The fire is still moving. Let it run, or try again from another side.' });
          }
          break;
        }
      }
    } finally {
      this.busy = false;
    }
    if (!out) return;
    this.feedback(out);
    this.refreshViews();
    this.saveSoon();
    await this.celebrate(out);
    const live = this.liveMenuTarget();
    if (!live) this.closeMenu();
    else this.openMenu(live);
  }

  /** Goals finished, care points, and new levels. */
  protected async celebrate(res: ActionResult): Promise<void> {
    if (res.xp && res.xp > 0) {
      this.time.delayedCall(res.gains.length * 180 + 120, () => floatIcon(this, this.robot.x + 4, this.robot.y - 34, `+${res.xp}${ICON.level}`));
    }
    const done = res.tasks ?? [];
    if (done.length) {
      audio.sfx('task', { delay: 0.2 });
      const goals = done.map((t) => `${t.label} (+${t.reward} parts)`).join(' · ');
      services.hud?.toast(res.allDone ? `All of today’s goals done! ${goals} · +2 bonus parts` : `Goal complete: ${goals}`);
    }
    if (res.levelUps?.length) await showLevelUp(res.levelUps);
  }

  protected feedback(res: ActionResult): void {
    if (res.note) services.hud?.toast(res.note);
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
    if (isOverlayOpen()) { this.down = null; this.robot.stop(); audio.motor(0); return; }
    const dt = Math.min(delta, 100);
    const keys = this.busy ? { x: 0, y: 0 } : keyVector();
    const mag = this.robot.update(dt, keys, this.robotSpeed(), !!this.state.crate);
    audio.motor(mag);
    // Hot days drain the battery faster outdoors.
    const weather = this.state.location === 'outside' ? WEATHER[this.state.weather.kind].drain : 1;
    if (mag > 0.05) drain(this.state, (BATTERY_DRIVE_DRAIN * mag * dt * weather) / 1000);

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
