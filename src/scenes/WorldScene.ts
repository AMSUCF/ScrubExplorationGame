import Phaser from 'phaser';
import { ART_SCALE } from '../art/placeholders';
import { MAP_H, MAP_W, REACH, ROBOT_SPEED, ROBOT_SPEED_CARRYING, ROBOT_SPEED_EMPTY, TILE, WORLD_H, WORLD_W } from '../config';
import { audio } from '../audio';
import { Critter } from '../entities/Critter';
import { Robot, floatIcon } from '../entities/Robot';
import { BASE_CENTER, POD, STATIONS, Station, isStationTile, stationTiles, tileCenter, zoneAtPx } from '../data/map';
import { HAZARDS, INVASIVE_PLANTS, NativeAnimalId } from '../data/species';
import { ActionResult, getActions, performAction } from '../systems/actions';
import { batteryFraction } from '../systems/battery';
import { zoneHealth } from '../systems/habitat';
import { Grid, Tile } from '../systems/pathfind';
import { recordSighting, unmetNeeds } from '../systems/population';
import { Entity, GameState, isAnimal, isChoked, pxToTile } from '../systems/state';
import { Interactable, PlayScene } from './PlayScene';

const S = 1 / ART_SCALE;
const SIGHT_RANGE = 120;
const BUBBLE_RANGE = 320;

interface EntityView {
  sprite: Phaser.GameObjects.Image;
  blocker?: Phaser.GameObjects.Zone;
  critter?: Critter;
  bubble?: Phaser.GameObjects.Container;
  nextBubble?: number;
  bubbleTurn?: number;
}

export class WorldScene extends PlayScene {
  private views = new Map<number, EntityView>();
  private stationSprites = new Map<Station, Phaser.GameObjects.Image>();
  private blockers!: Phaser.Physics.Arcade.StaticGroup;
  private dusk!: Phaser.GameObjects.Rectangle;
  private pointer: Phaser.GameObjects.Image | null = null;
  private warnedEmpty = false;
  private duskHeard = -1;

  constructor() {
    super('World');
  }

  init(data: { state: GameState }): void {
    this.state = data.state;
    this.state.location = 'outside';
    this.views = new Map();
    this.stationSprites = new Map();
    this.busy = false;
    this.warnedEmpty = false;
    this.pointer = null;
  }

  create(): void {
    this.add.image(0, 0, 'ground').setOrigin(0).setDepth(-10);
    this.physics.world.setBounds(TILE * 0.6, TILE * 0.6, WORLD_W - TILE * 1.2, WORLD_H - TILE * 1.2);
    this.blockers = this.physics.add.staticGroup();

    for (const st of STATIONS) {
      const p = tileCenter(st.tx, st.ty);
      const bottom = p.y + TILE / 2 + 2;
      const img = this.add.image(p.x, bottom, this.stationTexture(st)).setOrigin(0.5, 1).setScale(S).setDepth(bottom);
      this.stationSprites.set(st, img);
      const tiles = stationTiles(st);
      const w = st.w * TILE - 6;
      const h = st.h * TILE - (st.kind === 'pod' ? 10 : 14);
      const cy = (tiles[0].ty + 1) * TILE - h / 2 - 4;
      this.addBlocker(p.x, cy, w, h);
    }

    const r = this.state.robot;
    this.robot = new Robot(this, r.x, r.y);
    this.physics.add.collider(this.robot.body, this.blockers);

    this.dusk = this.add.rectangle(0, 0, 8000, 8000, 0xff9a3c, 0).setScrollFactor(0).setDepth(200000);
    this.syncEntities(true);

    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD_W, WORLD_H);
    cam.startFollow(this.robot.body, true, 0.12, 0.12);
    cam.setBackgroundColor('#6f8a5c');
    this.applyZoom();
    this.scale.on('resize', this.applyZoom, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.applyZoom, this));
    cam.fadeIn(350, 255, 248, 235);

    this.setupPlay();
    audio.music('scrub');
    audio.ambient('day');
    if (this.state.day === 1 && this.state.stats.invasivesRemoved === 0) this.showPointer();
    this.saveNow();
  }

  // --- layout ------------------------------------------------------------------------------

  private applyZoom = (): void => {
    const dpr = (this.registry.get('dpr') as number) ?? 1;
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
    return st.kind === 'pod' ? `pod${this.state.homeLevel}` : st.kind;
  }

  private blocks(e: Entity): boolean {
    if (e.kind === 'invasivePlant') return INVASIVE_PLANTS[e.species].blocks;
    if (e.kind === 'hazard') return HAZARDS[e.species].blocks;
    return false;
  }

  protected grid(): Grid {
    const blocked = new Set<number>();
    for (const e of this.state.entities) if (!isAnimal(e) && this.blocks(e)) blocked.add(e.ty * MAP_W + e.tx);
    return {
      w: MAP_W,
      h: MAP_H,
      blocked: (tx, ty) =>
        tx < 1 || ty < 1 || tx >= MAP_W - 1 || ty >= MAP_H - 1 || isStationTile(tx, ty) || blocked.has(ty * MAP_W + tx),
    };
  }

  protected interactables(): Interactable[] {
    const out: Interactable[] = [];
    for (const st of STATIONS) {
      const p = tileCenter(st.tx, st.ty);
      out.push(
        st.kind === 'pod'
          ? { target: { type: 'station', station: st }, x: p.x, y: p.y + 2, r: 30, reach: REACH + 4 }
          : { target: { type: 'station', station: st }, x: p.x, y: p.y, r: 20 },
      );
    }
    for (const e of this.state.entities) {
      if (e.kind === 'burrow') continue;
      if (isAnimal(e)) out.push({ target: { type: 'entity', entity: e }, x: e.x, y: e.y - 6, r: 16 });
      else {
        const p = tileCenter(e.tx, e.ty);
        out.push({ target: { type: 'entity', entity: e }, x: p.x, y: p.y, r: 17 });
      }
    }
    return out;
  }

  protected plantSpot(): Tile {
    const f = this.robot.feet;
    return pxToTile(f.x + this.robot.facing.x * 24, f.y + this.robot.facing.y * 24);
  }

  protected robotSpeed(): number {
    if (this.state.battery <= 0) return ROBOT_SPEED_EMPTY;
    return this.state.crate ? ROBOT_SPEED_CARRYING : ROBOT_SPEED;
  }

  protected zoneInfo() {
    const zone = zoneAtPx(this.robot.x, this.robot.y);
    return { zone, health: zone === 'base' ? null : zoneHealth(this.state, zone) };
  }

  protected recordPosition(): void {
    this.state.robot = { x: Math.round(this.robot.x), y: Math.round(this.robot.y) };
  }

  // --- views -------------------------------------------------------------------------------

  protected refreshViews(): void {
    this.syncEntities();
    if (this.pointer && !this.state.entities.some((e) => e.id === this.pointer?.getData('id'))) {
      this.pointer.destroy();
      this.pointer = null;
    }
  }

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
        if (isChoked(this.state, e)) view.sprite.setTint(0xb8b08a);
        else view.sprite.clearTint();
        const young = e.planted && this.state.day - e.plantedDay < 2;
        if (!this.tweens.isTweening(view.sprite)) view.sprite.setScale(S * (young ? 0.6 : 1));
      }
    }
    for (const [id, view] of this.views) {
      if (alive.has(id)) continue;
      this.views.delete(id);
      view.blocker?.destroy();
      view.bubble?.destroy();
      this.tweens.add({ targets: view.sprite, scale: 0, alpha: 0, duration: 220, onComplete: () => view.sprite.destroy() });
    }
    for (const [st, img] of this.stationSprites) img.setTexture(this.stationTexture(st));
  }

  private createView(e: Entity): EntityView {
    if (isAnimal(e)) {
      const sprite = this.add.image(e.x, e.y, e.species).setOrigin(0.5, 0.85).setScale(S).setDepth(e.y);
      return { sprite, critter: new Critter(e, sprite), nextBubble: this.time.now + 1500 + Math.random() * 4000, bubbleTurn: 0 };
    }
    const p = tileCenter(e.tx, e.ty);
    if (e.kind === 'burrow') return { sprite: this.add.image(p.x, p.y, 'burrow').setScale(S).setDepth(1) };
    const sprite = this.add.image(p.x, p.y + 10, e.species).setOrigin(0.5, 1).setScale(S).setDepth(p.y + 10);
    const view: EntityView = { sprite };
    if (this.blocks(e)) view.blocker = this.addBlocker(p.x, p.y + 4, e.kind === 'hazard' ? 26 : 24, 16);
    return view;
  }

  /** A wordless "start here" finger over the first weed by the tutorial plant. */
  private showPointer(): void {
    let best: Entity | null = null;
    let bestD = Infinity;
    for (const e of this.state.entities) {
      if (e.kind !== 'invasivePlant') continue;
      const d = Math.hypot(e.tx - BASE_CENTER.tx, e.ty - BASE_CENTER.ty);
      if (d < bestD) {
        best = e;
        bestD = d;
      }
    }
    if (!best || isAnimal(best)) return;
    const p = tileCenter(best.tx, best.ty);
    this.pointer = this.add.image(p.x, p.y - 30, 'ui_pointer').setDisplaySize(22, 22).setDepth(250000);
    this.pointer.setData('id', best.id);
    this.tweens.add({ targets: this.pointer, y: p.y - 22, duration: 450, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  }

  // --- wildlife moments --------------------------------------------------------------------

  private showBubble(view: EntityView, species: NativeAnimalId): void {
    const needs = unmetNeeds(this.state, species);
    const turn = view.bubbleTurn ?? 0;
    view.bubbleTurn = turn + 1;
    const parts: Phaser.GameObjects.GameObject[] = [this.add.image(0, 0, 'bubble').setScale(S)];
    if (needs.length > 0) {
      const need = needs[turn % needs.length];
      const pic = this.add.image(1, -2, need.icon);
      pic.setScale(Math.min(18 / pic.width, 16 / pic.height));
      parts.push(pic);
    } else {
      parts.push(this.add.image(1, -2, 'ui_heart').setDisplaySize(16, 16));
    }
    const c = this.add.container(view.sprite.x + 10, view.sprite.y - 26, parts).setDepth(260000).setScale(0);
    view.bubble = c;
    this.tweens.add({ targets: c, scale: 1, duration: 220, ease: 'Back.Out' });
    this.time.delayedCall(2600, () => {
      this.tweens.add({
        targets: c,
        scale: 0,
        duration: 180,
        onComplete: () => {
          c.destroy();
          if (view.bubble === c) view.bubble = undefined;
        },
      });
    });
  }

  private wildlife(): void {
    const now = this.time.now;
    for (const [id, view] of this.views) {
      const e = this.state.entities.find((x) => x.id === id);
      if (!e || (e.kind !== 'nativeAnimal' && e.kind !== 'invasiveAnimal')) continue;
      const dx = view.sprite.x - this.robot.x;
      const d = Math.hypot(dx, view.sprite.y - this.robot.y);
      // Calls are louder up close and panned toward the animal.
      const near = { vol: Phaser.Math.Clamp(1 - d / BUBBLE_RANGE, 0.15, 1), pan: Phaser.Math.Clamp(dx / 200, -0.8, 0.8) };
      if (e.kind === 'invasiveAnimal') {
        // Invasive critters make themselves heard now and then (a meow from the brush…).
        if (now > (view.nextBubble ?? 0) && d < BUBBLE_RANGE) {
          audio.animal(e.species, { ...near, vol: near.vol * 0.6 });
          view.nextBubble = now + 7000 + Math.random() * 9000;
        }
        continue;
      }
      if (d < SIGHT_RANGE) {
        const seen = recordSighting(this.state, e.species);
        if (seen.counted) {
          floatIcon(this, view.sprite.x - 8, view.sprite.y - 22, '👁️');
          audio.animal(e.species, near);
          if (seen.firstEver) {
            this.cameras.main.flash(220, 255, 255, 255);
            audio.sfx('photo', { delay: 0.3 });
            this.robot.emote('📸');
          }
          this.saveSoon();
        }
      }
      if (view.bubble) view.bubble.setPosition(view.sprite.x + 10, view.sprite.y - 26);
      else if (now > (view.nextBubble ?? 0) && d < BUBBLE_RANGE) {
        this.showBubble(view, e.species);
        audio.animal(e.species, { ...near, vol: near.vol * 0.7 });
        view.nextBubble = now + 5500 + Math.random() * 4000;
      }
    }
  }

  // --- transitions -------------------------------------------------------------------------

  protected handleTransition(res: ActionResult): boolean {
    if (!res.enter) return false;
    this.busy = true;
    this.robot.stop();
    this.saveNow();
    this.cameras.main.fadeOut(250, 255, 248, 235);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('Home', { state: this.state }));
    return true;
  }

  protected goHome(): void {
    const door = tileCenter(POD.tx, POD.ty);
    this.walkNear(door.x, door.y + 2, REACH - 2, () => {
      const enter = getActions(this.state, { type: 'station', station: POD })[0];
      if (enter) this.handleTransition(performAction(this.state, enter));
    });
  }

  // --- frame -------------------------------------------------------------------------------

  update(_time: number, delta: number): void {
    this.updatePlay(delta);
    for (const view of this.views.values()) view.critter?.update(Math.min(delta, 50));
    this.wildlife();

    if (this.state.battery <= 0 && !this.warnedEmpty) {
      this.warnedEmpty = true;
      this.robot.emote('🪫');
      audio.sfx('powerDown');
    }
    const frac = batteryFraction(this.state);
    const dusk = Phaser.Math.Clamp((0.5 - frac) / 0.5, 0, 1);
    this.dusk.setFillStyle(dusk > 0.6 ? 0x6a4a8a : 0xff9a3c, dusk * 0.26);
    if (Math.abs(dusk - this.duskHeard) > 0.03) {
      this.duskHeard = dusk;
      audio.dusk(dusk);
    }
  }
}
