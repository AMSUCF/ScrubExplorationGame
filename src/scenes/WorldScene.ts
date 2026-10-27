import Phaser from 'phaser';
import { ART_SCALE } from '../art/placeholders';
import { BATTERY_DRIVE_DRAIN, REACH, ROBOT_SPEED, ROBOT_SPEED_CARRYING, ROBOT_SPEED_EMPTY, TILE, WORLD_H, WORLD_W } from '../config';
import { Critter } from '../entities/Critter';
import { ROBOT_SPAWN, STATIONS, Station, tileCenter, zoneAtPx } from '../data/map';
import { HAZARDS, INVASIVE_PLANTS } from '../data/species';
import { Action, ActionResult, Target, getAction, performAction } from '../systems/actions';
import { batteryFraction, drain } from '../systems/battery';
import { nightTick } from '../systems/dayCycle';
import { zoneHealth } from '../systems/habitat';
import { cycleSelectedSeed, trayStage } from '../systems/nursery';
import { clearSave, saveGame } from '../systems/save';
import { Entity, GameState, isAnimal, isChoked, newGame, pxToTile } from '../systems/state';
import { services } from '../services';
import { moveVector, onAction, onGuideKey } from '../ui/input';
import { isOverlayOpen, showDiscovery, showFieldGuide, showMenu, showMorning } from '../ui/overlays';

const S = 1 / ART_SCALE;

interface EntityView {
  sprite: Phaser.GameObjects.Image;
  blocker?: Phaser.GameObjects.Zone;
  critter?: Critter;
}

export class WorldScene extends Phaser.Scene {
  private state!: GameState;
  private robot!: Phaser.Physics.Arcade.Image;
  private crateIcon!: Phaser.GameObjects.Image;
  private views = new Map<number, EntityView>();
  private stationSprites = new Map<Station, Phaser.GameObjects.Image>();
  private blockers!: Phaser.Physics.Arcade.StaticGroup;
  private highlight!: Phaser.GameObjects.Graphics;
  private dusk!: Phaser.GameObjects.Rectangle;
  private sparkles!: Phaser.GameObjects.Particles.ParticleEmitter;
  private facing = { x: 0, y: 1 };
  private action: Action | null = null;
  private busy = false;
  private saveTimer: number | null = null;
  private warnedEmpty = false;
  private unseenGuide = 0;
  private fresh = false;

  constructor() {
    super('World');
  }

  init(data: { state: GameState; fresh?: boolean }): void {
    this.state = data.state;
    this.fresh = !!data.fresh;
    this.views = new Map();
    this.stationSprites = new Map();
    this.busy = false;
    this.warnedEmpty = false;
  }

  create(): void {
    this.add.image(0, 0, 'ground').setOrigin(0).setDepth(-10);
    this.physics.world.setBounds(TILE * 0.6, TILE * 0.6, WORLD_W - TILE * 1.2, WORLD_H - TILE * 1.2);
    this.blockers = this.physics.add.staticGroup();
    this.highlight = this.add.graphics().setDepth(0.5);

    for (const st of STATIONS) {
      const p = tileCenter(st.tx, st.ty);
      const img = this.add.image(p.x, p.y + 10, this.stationTexture(st)).setOrigin(0.5, 1).setScale(S).setDepth(p.y + 10);
      this.stationSprites.set(st, img);
      if (st.kind !== 'tray') this.addBlocker(p.x, p.y + 2, 30, 18);
    }

    const r = this.state.robot;
    this.robot = this.physics.add.image(r.x, r.y, 'robot').setScale(S);
    this.robot.setCircle(18, 18, 36);
    this.robot.setCollideWorldBounds(true);
    this.physics.add.collider(this.robot, this.blockers);
    this.crateIcon = this.add.image(r.x, r.y, 'crate').setScale(S).setVisible(false);

    this.sparkles = this.add.particles(0, 0, 'sparkle', {
      speed: { min: 30, max: 90 },
      lifespan: 650,
      scale: { start: 0.55, end: 0 },
      alpha: { start: 1, end: 0 },
      gravityY: -40,
      emitting: false,
    });
    this.sparkles.setDepth(100000);

    this.dusk = this.add.rectangle(0, 0, 8000, 8000, 0xff9a3c, 0).setScrollFactor(0).setDepth(200000);

    this.syncEntities(true);

    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD_W, WORLD_H);
    cam.startFollow(this.robot, true, 0.12, 0.12);
    cam.setBackgroundColor('#6f8a5c');
    this.applyZoom();
    this.scale.on('resize', this.applyZoom, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.applyZoom, this));

    onAction(() => this.doAction());
    onGuideKey(() => this.openGuide());

    const hud = services.hud!;
    hud.setVisible(true);
    this.updateHud();

    const save = () => this.saveNow();
    document.addEventListener('visibilitychange', save);
    window.addEventListener('pagehide', save);
    this.events.once('shutdown', () => {
      document.removeEventListener('visibilitychange', save);
      window.removeEventListener('pagehide', save);
    });

    if (this.fresh) {
      this.time.delayedCall(600, () => {
        hud.toast('Drag anywhere to drive. The big button does whatever is nearby.');
        this.time.delayedCall(4200, () => hud.toast('Something is smothering a plant just north of base… go take a look!'));
      });
    }
    this.saveNow();
  }

  // --- helpers ----------------------------------------------------------------------

  private applyZoom = (): void => {
    const dpr = this.registry.get('dpr') ?? 1;
    const w = this.scale.width / dpr;
    const h = this.scale.height / dpr;
    const zoom = Phaser.Math.Clamp(Math.min(w, h) / (TILE * 10), 1, 2.4);
    this.cameras.main.setZoom(zoom * dpr);
    this.dusk.setPosition(this.scale.width / 2, this.scale.height / 2);
  };

  private addBlocker(x: number, y: number, w: number, h: number): Phaser.GameObjects.Zone {
    const zone = this.add.zone(x, y, w, h);
    this.physics.add.existing(zone, true);
    this.blockers.add(zone);
    return zone;
  }

  private stationTexture(st: Station): string {
    if (st.kind !== 'tray') return st.kind;
    const tray = this.state.trays[st.index ?? 0];
    return `tray_${trayStage(tray)}_${tray.watered ? 'wet' : 'dry'}`;
  }

  private entityTexture(e: Entity): string {
    return e.kind === 'burrow' ? 'burrow' : e.species;
  }

  private blocks(e: Entity): boolean {
    if (e.kind === 'invasivePlant') return INVASIVE_PLANTS[e.species].blocks;
    if (e.kind === 'hazard') return HAZARDS[e.species].blocks;
    return false;
  }

  /** Make sprites match state: create new ones, remove gone ones, refresh looks. */
  private syncEntities(initial = false): void {
    const alive = new Set<number>();
    for (const e of this.state.entities) {
      alive.add(e.id);
      let view = this.views.get(e.id);
      if (!view) {
        view = this.createView(e);
        this.views.set(e.id, view);
        if (!initial) {
          const target = view.sprite.scale;
          view.sprite.setScale(0);
          this.tweens.add({ targets: view.sprite, scale: target, duration: 350, ease: 'Back.Out' });
        }
      }
      if (e.kind === 'nativePlant') {
        const choked = isChoked(this.state, e);
        if (choked) view.sprite.setTint(0xb8b08a);
        else view.sprite.clearTint();
        const young = e.planted && this.state.day - e.plantedDay < 2;
        if (!this.tweens.isTweening(view.sprite)) view.sprite.setScale(S * (young ? 0.6 : 1));
      }
    }
    for (const [id, view] of this.views) {
      if (alive.has(id)) continue;
      this.views.delete(id);
      view.blocker?.destroy();
      this.tweens.add({
        targets: view.sprite,
        scale: 0,
        alpha: 0,
        duration: 220,
        onComplete: () => view.sprite.destroy(),
      });
    }
    for (const [st, img] of this.stationSprites) img.setTexture(this.stationTexture(st));
  }

  private createView(e: Entity): EntityView {
    if (isAnimal(e)) {
      const sprite = this.add.image(e.x, e.y, e.species).setOrigin(0.5, 0.85).setScale(S).setDepth(e.y);
      return { sprite, critter: new Critter(e, sprite) };
    }
    const p = tileCenter(e.tx, e.ty);
    if (e.kind === 'burrow') {
      return { sprite: this.add.image(p.x, p.y, 'burrow').setScale(S).setDepth(1) };
    }
    const sprite = this.add.image(p.x, p.y + 10, this.entityTexture(e)).setOrigin(0.5, 1).setScale(S).setDepth(p.y + 10);
    const view: EntityView = { sprite };
    if (this.blocks(e)) view.blocker = this.addBlocker(p.x, p.y + 4, e.kind === 'hazard' ? 26 : 24, 16);
    return view;
  }

  private findTarget(): Target | null {
    const px = this.robot.x + this.facing.x * 10;
    const py = this.robot.y + 6 + this.facing.y * 10;
    let best: Target | null = null;
    let bestD = Infinity;
    for (const st of STATIONS) {
      const p = tileCenter(st.tx, st.ty);
      const d = Math.hypot(p.x - px, p.y - py);
      if (d < REACH + 6 && d < bestD) {
        bestD = d;
        best = { type: 'station', station: st };
      }
    }
    for (const e of this.state.entities) {
      if (e.kind === 'burrow') continue;
      const p = isAnimal(e) ? { x: e.x, y: e.y } : tileCenter(e.tx, e.ty);
      const d = Math.hypot(p.x - px, p.y - py);
      if (d < REACH && d < bestD) {
        bestD = d;
        best = { type: 'entity', entity: e };
      }
    }
    return best;
  }

  private plantSpot(): { tx: number; ty: number } {
    return pxToTile(this.robot.x + this.facing.x * 26, this.robot.y + 8 + this.facing.y * 26);
  }

  private targetPos(a: Action): { x: number; y: number } | null {
    if (a.spot) return tileCenter(a.spot.tx, a.spot.ty);
    const t = a.target;
    if (!t) return null;
    if (t.type === 'station') return tileCenter(t.station.tx, t.station.ty);
    const e = t.entity;
    return isAnimal(e) ? { x: e.x, y: e.y } : tileCenter(e.tx, e.ty);
  }

  private drawHighlight(): void {
    const g = this.highlight;
    g.clear();
    const a = this.action;
    if (!a) return;
    const p = this.targetPos(a);
    if (!p) return;
    const color = a.enabled ? 0xfff2b0 : 0xd8c8a8;
    if (a.verb === 'plant') {
      g.lineStyle(2, 0x7fbf6a, 0.9);
      g.strokeRoundedRect(p.x - 14, p.y - 14, 28, 28, 6);
    } else {
      const pulse = 0.55 + Math.sin(this.time.now / 220) * 0.15;
      g.fillStyle(color, pulse * 0.5);
      g.fillEllipse(p.x, p.y + 8, 34, 14);
      g.lineStyle(2, color, pulse);
      g.strokeEllipse(p.x, p.y + 8, 34, 14);
    }
  }

  private zoneInfo(): { zone: ReturnType<typeof zoneAtPx>; health: number | null } {
    const zone = zoneAtPx(this.robot.x, this.robot.y);
    return { zone, health: zone === 'base' ? null : zoneHealth(this.state, zone) };
  }

  private updateHud(): void {
    const { zone, health } = this.zoneInfo();
    services.hud?.update(this.state, this.action, zone, health, this.unseenGuide);
  }

  private saveSoon(): void {
    if (this.saveTimer !== null) return;
    this.saveTimer = window.setTimeout(() => {
      this.saveTimer = null;
      this.saveNow();
    }, 800);
  }

  private saveNow(): void {
    if (!this.robot) return;
    this.state.robot = { x: Math.round(this.robot.x), y: Math.round(this.robot.y) };
    saveGame(this.state);
  }

  // --- actions ----------------------------------------------------------------------

  private doAction(): void {
    if (this.busy || isOverlayOpen()) return;
    const a = this.action;
    const hud = services.hud!;
    if (!a) {
      hud.toast(this.state.battery <= 0 ? 'Battery empty — drive back to the dock to rest.' : 'Nothing to do here. Explore the scrub!');
      return;
    }
    const res = performAction(this.state, a);
    if (!res.ok) {
      if (res.messages[0]) hud.toast(res.messages[0], 'warn');
      this.robotBump();
      return;
    }
    this.playFx(res);
    if (res.sleep) {
      this.sleep();
      return;
    }
    res.messages.forEach((m, i) => hud.toast(m, i === 0 && res.rescued.length === 0 ? 'info' : 'good'));
    this.syncEntities();
    this.action = null;
    this.saveSoon();
    if (res.scanned) {
      this.unseenGuide++;
      void showDiscovery(res.scanned, services.icon);
    }
  }

  private robotBump(): void {
    this.tweens.add({ targets: this.robot, angle: { from: -6, to: 6 }, duration: 60, yoyo: true, repeat: 2, onComplete: () => this.robot.setAngle(0) });
  }

  private playFx(res: ActionResult): void {
    const at = res.at;
    if (!at) return;
    switch (res.fx) {
      case 'hit': {
        const view = this.findViewAt(at);
        if (view) this.tweens.add({ targets: view.sprite, x: view.sprite.x + 3, duration: 50, yoyo: true, repeat: 2 });
        this.sparkles.explode(3, at.x, at.y);
        break;
      }
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
  }

  private findViewAt(at: { x: number; y: number }): EntityView | undefined {
    for (const v of this.views.values()) {
      if (Math.abs(v.sprite.x - at.x) < 2 && Math.abs(v.sprite.y - 10 - at.y) < 2) return v;
    }
    return undefined;
  }

  private sleep(): void {
    this.busy = true;
    this.robot.setVelocity(0, 0);
    const cam = this.cameras.main;
    cam.fadeOut(700, 30, 24, 48);
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, async () => {
      const summary = nightTick(this.state);
      this.robot.setPosition(ROBOT_SPAWN.x, ROBOT_SPAWN.y);
      this.facing = { x: 0, y: 1 };
      this.warnedEmpty = false;
      this.syncEntities(true);
      this.saveNow();
      this.updateHud();
      await showMorning(summary);
      cam.fadeIn(600, 30, 24, 48);
      this.busy = false;
    });
  }

  async openGuide(): Promise<void> {
    if (isOverlayOpen() || this.busy) return;
    this.unseenGuide = 0;
    this.updateHud();
    await showFieldGuide(this.state, services.icon);
  }

  async openMenu(): Promise<void> {
    if (isOverlayOpen() || this.busy) return;
    const choice = await showMenu(this.state);
    if (choice === 'new') {
      clearSave();
      this.scene.restart({ state: newGame(), fresh: true });
    }
  }

  cycleSeed(): void {
    cycleSelectedSeed(this.state);
    this.updateHud();
  }

  // --- frame loop -------------------------------------------------------------------

  update(_time: number, delta: number): void {
    const dt = Math.min(delta, 50);
    const move = this.busy ? { x: 0, y: 0 } : moveVector();
    const mag = Math.hypot(move.x, move.y);
    const empty = this.state.battery <= 0;
    const speed = empty ? ROBOT_SPEED_EMPTY : this.state.crate ? ROBOT_SPEED_CARRYING : ROBOT_SPEED;
    this.robot.setVelocity(move.x * speed, move.y * speed);

    if (mag > 0.05) {
      this.facing = { x: move.x / mag, y: move.y / mag };
      if (Math.abs(move.x) > 0.1) this.robot.setFlipX(move.x < 0);
      this.robot.setAngle(Math.sin(this.time.now / 70) * 2.5);
      drain(this.state, (BATTERY_DRIVE_DRAIN * mag * dt) / 1000);
      if (this.state.battery <= 0 && !this.warnedEmpty) {
        this.warnedEmpty = true;
        services.hud?.toast('Battery empty! Creeping home to the charging dock…', 'warn');
      }
    } else if (!this.tweens.isTweening(this.robot)) {
      this.robot.setAngle(0);
    }
    this.robot.setDepth(this.robot.y + 8);

    this.crateIcon.setVisible(!!this.state.crate);
    if (this.state.crate) this.crateIcon.setPosition(this.robot.x, this.robot.y - 25).setDepth(this.robot.y + 9);

    for (const view of this.views.values()) view.critter?.update(dt);

    // Dusk tint as the battery runs down.
    const frac = batteryFraction(this.state);
    const dusk = Phaser.Math.Clamp((0.5 - frac) / 0.5, 0, 1);
    this.dusk.setFillStyle(dusk > 0.6 ? 0x6a4a8a : 0xff9a3c, dusk * 0.26);

    if (!this.busy && !isOverlayOpen()) {
      this.action = getAction(this.state, this.findTarget(), this.plantSpot());
    }
    this.drawHighlight();
    this.updateHud();
  }
}
