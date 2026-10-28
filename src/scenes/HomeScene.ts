// Inside the pod: the robot's cozy home. Hydroponic seedlings, vases of sprigs, a corkboard of
// photos and postcards, the wildlife monitor, the workbench for upgrades, and the charging cradle.
import Phaser from 'phaser';
import { generateRoomTexture } from '../art/home';
import { ART_SCALE } from '../art/placeholders';
import { REACH, ROBOT_SPEED } from '../config';
import { HOME_TILE, HomeItem, ROOM_SIZES, WALL_ROWS } from '../data/home';
import { ROBOT_SPAWN } from '../data/map';
import { audio } from '../audio';
import { Robot, floatIcon } from '../entities/Robot';
import { ActionResult } from '../systems/actions';
import { nightTick } from '../systems/dayCycle';
import { currentLayout } from '../systems/home';
import { trayStage } from '../systems/nursery';
import { Grid } from '../systems/pathfind';
import { NATIVE_ANIMALS } from '../systems/population';
import { GameState } from '../systems/state';
import { showMorning } from '../ui/overlays';
import { Interactable, PlayScene } from './PlayScene';

const S = 1 / ART_SCALE;
const T = HOME_TILE;

const ITEM_TEX: Partial<Record<HomeItem['kind'], string>> = {
  cradle: 'cradle',
  monitor: 'monitor',
  board: 'board',
  bench: 'bench',
  vase: 'vase',
  window: 'window',
  door: 'doormat',
};

export class HomeScene extends PlayScene {
  private furniture!: Phaser.GameObjects.Container;
  private blockers!: Phaser.Physics.Arcade.StaticGroup;
  private level = 0;
  private spawn: 'door' | 'cradle' | { x: number; y: number } = 'door';

  constructor() {
    super('Home');
  }

  init(data: { state: GameState; spawn?: 'door' | 'cradle' | { x: number; y: number } }): void {
    this.state = data.state;
    this.state.location = 'home';
    this.spawn = data.spawn ?? 'door';
    this.busy = false;
  }

  private get size() {
    return ROOM_SIZES[this.state.homeLevel];
  }

  create(): void {
    this.level = this.state.homeLevel;
    const { w, h } = this.size;
    this.add.image(0, 0, generateRoomTexture(this, this.level)).setOrigin(0).setScale(S).setDepth(-10);
    this.physics.world.setBounds(10, WALL_ROWS * T - 4, w * T - 20, (h - WALL_ROWS) * T - 6);
    this.blockers = this.physics.add.staticGroup();
    this.furniture = this.add.container(0, 0);

    const start =
      this.spawn === 'door'
        ? { x: (w / 2) * T, y: (h - 1) * T }
        : this.spawn === 'cradle'
          ? { x: 2.2 * T, y: 4.2 * T }
          : this.spawn;
    this.robot = new Robot(this, start.x, start.y);
    this.physics.add.collider(this.robot.body, this.blockers);
    this.buildFurniture();

    const cam = this.cameras.main;
    cam.setBackgroundColor('#2c2a36');
    this.applyZoom();
    this.scale.on('resize', this.applyZoom, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.applyZoom, this));
    cam.fadeIn(300, 255, 248, 235);

    this.setupPlay();
    audio.music('home');
    audio.ambient('home');
    this.saveNow();
  }

  private applyZoom = (): void => {
    const dpr = (this.registry.get('dpr') as number) ?? 1;
    const { w, h } = this.size;
    const vw = this.scale.width / dpr;
    const vh = this.scale.height / dpr - 150; // leave room for the HUD
    const fitW = vw / (w * T + 24);
    const fitH = vh / (h * T + 24);
    // Fit the whole room; on tall phone screens zoom in further and let the camera follow the robot.
    let zoom = Math.min(fitW, fitH);
    if (fitH > fitW * 1.3) zoom = Math.min(fitH, fitW * 1.6);
    zoom = Phaser.Math.Clamp(zoom, 0.6, 2.6);
    const cam = this.cameras.main;
    cam.setZoom(zoom * dpr);
    const fits = zoom <= fitW + 1e-3;
    if (fits) {
      cam.stopFollow();
      cam.removeBounds();
      cam.centerOn((w * T) / 2, (h * T) / 2 - 40 / zoom);
    } else {
      const extraY = 150 / zoom;
      cam.setBounds(-12, -12 - extraY, w * T + 24, h * T + 24 + extraY);
      cam.startFollow(this.robot.body, true, 0.12, 0.12);
    }
  };

  // --- furniture ---------------------------------------------------------------------------

  private footprint(it: HomeItem): { tx: number; ty: number }[] {
    const out: { tx: number; ty: number }[] = [];
    if (!it.bw || !it.bh) return out;
    const x0 = Math.floor(it.x - it.bw / 2 + 0.01);
    const y1 = Math.floor(it.y - 0.5);
    for (let dy = 0; dy < it.bh; dy++) for (let dx = 0; dx < it.bw; dx++) out.push({ tx: x0 + dx, ty: y1 - dy });
    return out;
  }

  private buildFurniture(): void {
    this.furniture.removeAll(true);
    this.blockers.clear(true, true);
    const add = <T extends Phaser.GameObjects.GameObject>(o: T) => {
      this.furniture.add(o);
      return o;
    };

    // Collection shelf: little figures of every species that has come home.
    const shelfX = 5.3 * T;
    const shelf = add(this.add.graphics());
    shelf.fillStyle(0xc99a72, 1).fillRoundedRect(shelfX, 1.2 * T, 1.9 * T, 4, 2);
    NATIVE_ANIMALS.filter((a) => this.state.returned.includes(a)).forEach((a, i) => {
      const fig = add(this.add.image(shelfX + 8 + i * 13, 1.2 * T, a).setOrigin(0.5, 1));
      fig.setScale(Math.min(12 / fig.width, 10 / fig.height));
    });

    for (const it of currentLayout(this.state)) {
      const x = it.x * T;
      const y = it.y * T;
      if (it.kind === 'slot') {
        const tray = this.state.trays[it.index ?? 0];
        add(this.add.image(x, y, `hydro_${trayStage(tray)}_${tray.watered ? 'wet' : 'dry'}`).setOrigin(0.5, 1).setScale(S).setDepth(y));
      } else {
        const tex = ITEM_TEX[it.kind];
        if (tex) add(this.add.image(x, y, tex).setOrigin(0.5, 1).setScale(S).setDepth(it.bh ? y : 1));
      }
      if (it.kind === 'vase') {
        const sprigs = this.state.vases[it.index ?? 0] ?? [];
        sprigs.forEach((sp, i) => {
          const off = (i - (sprigs.length - 1) / 2) * 3.5;
          add(this.add.image(x + off, y - 21, `sprig_${sp}`).setOrigin(0.5, 1).setScale(S).setAngle(off * 4).setDepth(y - 0.5));
        });
      }
      if (it.kind === 'board') this.pinBoard(x, y, add);
      if (it.kind === 'monitor') {
        const led = add(this.add.circle(x + 14, y - 3, 1.4, 0x7fe3b0));
        this.tweens.add({ targets: led, alpha: 0.2, duration: 700, yoyo: true, repeat: -1 });
      }
      for (const t of this.footprint(it)) {
        const zone = this.add.zone(t.tx * T + T / 2, t.ty * T + T / 2, T - 4, T - 6);
        this.physics.add.existing(zone, true);
        this.blockers.add(zone);
      }
    }
  }

  /** Mini photos and postcards pinned on the corkboard. */
  private pinBoard(x: number, y: number, add: <T extends Phaser.GameObjects.GameObject>(o: T) => T): void {
    const left = x - 19;
    const top = y - 30;
    const items = [
      ...this.state.photos.slice(-3).map((p) => ({ kind: 'photo' as const, tex: p.species })),
      ...this.state.postcards.slice(-3).map((p) => ({ kind: 'card' as const, tex: p.species })),
    ].slice(0, 5);
    items.forEach((p, i) => {
      const px = left + 5 + (i % 3) * 13;
      const py = top + 5 + Math.floor(i / 3) * 12;
      const frame = add(this.add.image(px, py, p.kind === 'photo' ? 'polaroid' : 'postcard').setOrigin(0, 0).setScale(S * 0.55));
      frame.setAngle((i % 2 ? 1 : -1) * 6);
      const pic = add(this.add.image(px + 5, py + 4, p.tex));
      pic.setScale(Math.min(7 / pic.width, 6 / pic.height));
      add(this.add.image(px + 4, py, 'pin').setScale(S * 0.7));
    });
  }

  // --- PlayScene hooks ---------------------------------------------------------------------

  protected grid(): Grid {
    const { w, h } = this.size;
    const blocked = new Set<string>();
    for (const it of currentLayout(this.state)) for (const t of this.footprint(it)) blocked.add(`${t.tx},${t.ty}`);
    return { w, h, blocked: (tx, ty) => ty < WALL_ROWS || ty >= h || tx < 0 || tx >= w || blocked.has(`${tx},${ty}`) };
  }

  protected interactables(): Interactable[] {
    const { h } = this.size;
    return currentLayout(this.state)
      .filter((it) => it.interactive)
      .map((it) => {
        const target = { type: 'home' as const, item: it };
        switch (it.kind) {
          case 'door':
            return { target, x: it.x * T, y: h * T - 12, r: 24, reach: 44 };
          case 'monitor':
          case 'board':
            return { target, x: it.x * T, y: (it.y - 0.5) * T, r: 22, reach: 62 };
          case 'cradle':
          case 'bench':
            return { target, x: it.x * T, y: (it.y - 0.5) * T, r: 30, reach: REACH + 10 };
          default:
            return { target, x: it.x * T, y: (it.y - 0.5) * T, r: 15, reach: REACH };
        }
      });
  }

  protected refreshViews(): void {
    if (this.state.homeLevel !== this.level) {
      // The room grew! Rebuild around the robot with a little celebration.
      this.saveNow();
      this.cameras.main.flash(300, 255, 248, 235);
      this.scene.restart({ state: this.state, spawn: { x: this.robot.x, y: this.robot.y } });
      return;
    }
    this.buildFurniture();
  }

  protected robotSpeed(): number {
    return ROBOT_SPEED * 0.8;
  }

  protected zoneInfo() {
    return { zone: 'base' as const, health: null };
  }

  protected plantSpot() {
    return null;
  }

  protected recordPosition(): void {
    // Indoors the robot is always restored at the cradle; keep its outdoor spot by the pod.
    this.state.robot = { ...ROBOT_SPAWN };
  }

  protected handleTransition(res: ActionResult): boolean {
    if (res.exit) {
      this.busy = true;
      this.robot.stop();
      this.state.robot = { ...ROBOT_SPAWN };
      this.saveNow();
      this.cameras.main.fadeOut(250, 255, 248, 235);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('World', { state: this.state }));
      return true;
    }
    if (res.sleep) {
      void this.sleep();
      return true;
    }
    return false;
  }

  private async sleep(): Promise<void> {
    this.busy = true;
    this.robot.stop();
    const cradle = currentLayout(this.state).find((i) => i.kind === 'cradle')!;
    this.robot.setPosition(cradle.x * T, (cradle.y - 0.6) * T);
    for (let i = 0; i < 3; i++) this.time.delayedCall(i * 260, () => floatIcon(this, this.robot.x + 6, this.robot.y - 20, '💤'));
    audio.robot('yawn');
    audio.sfx('lullaby', { delay: 0.4 });
    audio.music(null);
    const cam = this.cameras.main;
    await new Promise<void>((resolve) => {
      this.time.delayedCall(700, () => {
        cam.fadeOut(700, 30, 24, 48);
        cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => resolve());
      });
    });
    const summary = nightTick(this.state);
    this.robot.setPosition(cradle.x * T, (cradle.y + 0.7) * T);
    this.buildFurniture();
    this.saveNow();
    audio.sfx('morning');
    await showMorning(summary, this.state);
    audio.music('home');
    audio.robot('wake');
    cam.fadeIn(600, 255, 236, 200);
    this.robot.emote('happy');
    this.busy = false;
  }

  update(_time: number, delta: number): void {
    this.updatePlay(delta);
  }
}
