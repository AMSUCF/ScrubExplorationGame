// A rare frosty morning, as Florida scrub has it: never snow, but hoarfrost from a calm, clear night.
// It is heaviest on thin, low things in the open (lichens, rosemary, grass, palmetto fans, the pod's
// roof), only a thin sheen on bare sand, and none under oak crowns. Ice crystals glint in the low sun.
// Sunlit frost melts first, leaving frost in each plant's shadow, which shrinks toward the plant
// until it too is gone by mid-morning; a few wisps of steam lift off as the sun reaches the frost.
import Phaser from 'phaser';
import { MAP_H, MAP_W, TILE, WORLD_H, WORLD_W } from '../../config';
import { tex, texScale } from '../../art/effects';
import { line, make } from '../../art/placeholders';
import { ZoneId, zoneAt } from '../../data/map';
import { GameState } from '../../systems/state';
import { mulberry32 } from '../../systems/rng';

/** How readily frost settles on the ground: lichen balds most; bare sand, warmed from below, only thinly. */
const ZONE_FROST: Record<ZoneId, number> = { rosemary: 0.8, sand: 0.45, base: 0.35, oak: 0.25 };
/** Trees whose crowns radiate warmth back down and keep the ground beneath them frost-free. */
const CANOPY = new Set(['oak', 'hickory', 'pepper']);
const SHEET = 'frost_sheet';
const PATCH = 'frost_patch';
/** Morning shade (and the frost in it) lies on the west side of things: the sun rises in the east. */
const SHADE_ANGLE = 10;

/** Frost left on the ground, 1 at dawn to 0 once melted: it lasts the first quarter of the day. */
export function frostLeft(dayLeft: number): number {
  return Phaser.Math.Clamp((dayLeft - 0.7) / 0.25, 0, 1);
}
/**
 * Frost left today, 1 at dawn to 0 once melted. Melted frost stays melted for the rest of the day, even
 * if a battery upgrade adds energy or the robot pops home and back.
 */
export function frostToday(scene: Phaser.Scene, state: GameState, dayLeft: number): number {
  if (state.weather.kind !== 'cold') return 0;
  const melt = scene.registry.get('frostMelt') as { day: number; f: number } | undefined;
  const f = Math.min(frostLeft(dayLeft), melt?.day === state.day ? melt.f : 1);
  scene.registry.set('frostMelt', { day: state.day, f });
  return f;
}
/** Frost in the sun goes first... */
const sunFrost = (f: number) => Phaser.Math.Clamp((f - 0.35) / 0.65, 0, 1);
/** ...and frost in the shade lasts to the end. */
const shadeFrost = (f: number) => Phaser.Math.Clamp(f / 0.6, 0, 1);

/** Something frost settles on: a plant, or the pod and stations. `weight` is how much (trees less). */
export interface Frosted {
  sprite: Phaser.GameObjects.Image;
  weight: number;
}

interface Coat {
  rime: Phaser.GameObjects.Image;
  shade: Phaser.GameObjects.Image | null;
}

export class FrostFx {
  private cover = new Float32Array(MAP_W * MAP_H);
  private sheet: Phaser.GameObjects.Image | null = null;
  private coats = new Map<Phaser.GameObjects.Image, Coat>();
  private glints: Phaser.GameObjects.Particles.ParticleEmitter;
  private steam: Phaser.GameObjects.Particles.ParticleEmitter;
  private sun = 1;
  private shade = 1;
  private gone = false;
  private sheetCanvas: HTMLCanvasElement | null = null;
  private repaintSheet: (() => void) | null = null;

  /** `frost` is frostToday(): only build one while some frost is left. */
  constructor(private scene: Phaser.Scene, private state: GameState, frost: number) {
    for (let ty = 0; ty < MAP_H; ty++) for (let tx = 0; tx < MAP_W; tx++) this.cover[ty * MAP_W + tx] = ZONE_FROST[zoneAt(tx, ty)];
    // Under a crown the ground stays clear, with a fairly crisp edge.
    for (const e of state.entities) {
      if ((e.kind !== 'nativePlant' && e.kind !== 'invasivePlant') || !CANOPY.has(e.species)) continue;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const tx = e.tx + dx, ty = e.ty + dy;
        if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) continue;
        this.cover[ty * MAP_W + tx] *= Phaser.Math.Clamp((Math.hypot(dx, dy) - 1.1) / 0.8, 0.04, 1);
      }
    }
    // The open-ground frost is only painted while the sun hasn't melted it yet.
    if (sunFrost(frost) > 0) this.sheet = this.makeSheet(state.seed ^ Math.imul(state.day, 0x9e3779b1));
    makePatchTexture(scene);

    const zone = (pick: (p: Phaser.Types.Math.Vector2Like) => void) => ({
      type: 'random', quantity: 1,
      source: { getRandomPoint: (p: Phaser.Types.Math.Vector2Like) => (pick(p), p) },
    }) as unknown as Phaser.Types.GameObjects.Particles.EmitZoneData;
    const k = texScale(scene, 'frost');
    // Ice crystals catching the low sun: they twinkle in place on the ground, they don't fall. Ground
    // depth lets plants, the robot and animals hide them.
    this.glints = scene.add.particles(0, 0, tex(scene, 'frost'), {
      emitZone: zone((p) => this.glintPoint(p)),
      lifespan: { min: 500, max: 1000 },
      alpha: { values: [0, 1, 0] } as unknown as Phaser.Types.GameObjects.Particles.EmitterOpOnEmitType,
      scale: { min: 0.55 * k, max: 1 * k },
      rotate: { min: -12, max: 12 },
      blendMode: Phaser.BlendModes.ADD,
      frequency: 45,
    }).setDepth(-3);
    // Thin wisps of steam lift off frosted plants and the pod roof as the sun reaches them.
    const ks = texScale(scene, 'smoke');
    this.steam = scene.add.particles(0, 0, tex(scene, 'smoke'), {
      emitZone: zone((p) => this.steamPoint(p)),
      speedX: { min: -3, max: 3 },
      speedY: { min: -12, max: -6 },
      lifespan: 1400,
      scale: { start: 0.25 * ks, end: 0.7 * ks },
      alpha: { values: [0, 0.16, 0] } as unknown as Phaser.Types.GameObjects.Particles.EmitterOpOnEmitType,
      tint: 0xf6faff,
      frequency: 420,
      emitting: false,
    }).setDepth(150000);
  }

  /** `dayLeft` is the battery fraction, the game's clock. `things` are the plants and stations in view. */
  update(dayLeft: number, things: Iterable<Frosted>): void {
    if (this.gone) return;
    const f = frostToday(this.scene, this.state, dayLeft);
    this.sun = sunFrost(f);
    this.shade = shadeFrost(f);
    if (f <= 0) {
      this.melted();
      return;
    }
    this.sheet?.setAlpha(this.sun);
    if (this.sun <= 0) this.dropSheet();
    const v = this.scene.cameras.main.worldView;
    const seen = new Set<Phaser.GameObjects.Image>();
    for (const thing of things) {
      seen.add(thing.sprite);
      this.coat(thing, v);
    }
    // Plants pulled, cut or burned take their frost with them.
    for (const [sprite, coat] of this.coats) {
      if (seen.has(sprite) && sprite.active) continue;
      coat.rime.destroy();
      coat.shade?.destroy();
      this.coats.delete(sprite);
    }
    // Fewer crystals glint as the frost thins, and the last ones are warm dew drops. (Assigning the
    // frequency keeps the emitter's countdown; setFrequency() would restart it every frame.)
    const every = 45 + (1 - f) * 260;
    if (Math.abs(this.glints.frequency - every) > 1) this.glints.frequency = every;
    this.glints.particleTint = f > 0.45 ? 0xffffff : 0xfff0cc;
    const steaming = this.sun > 0.1 && this.sun < 0.9;
    if (steaming !== this.steam.emitting) steaming ? this.steam.start() : this.steam.stop();
  }

  destroy(): void {
    this.melted();
    this.glints.destroy();
    this.steam.destroy();
  }

  /** Frost on a plant or the pod: a pale silvering, brightest along its top edge, plus its frost shadow. */
  private coat({ sprite, weight }: Frosted, view: Phaser.Geom.Rectangle): void {
    let coat = this.coats.get(sprite);
    if (!coat) {
      coat = { rime: this.scene.add.image(0, 0, sprite.texture.key, sprite.frame.name).setTintFill(0xeef5fb), shade: null };
      this.coats.set(sprite, coat);
    }
    const { rime } = coat;
    // Only what's on screen (with room for its frost shadow) needs following.
    const w = sprite.displayWidth, h = sprite.displayHeight;
    const left = sprite.x - sprite.originX * w, top = sprite.y - sprite.originY * h;
    const onScreen = left + w + 32 > view.x && left - w - 32 < view.right && top + h + 32 > view.y && top - 32 < view.bottom;
    if (!onScreen) {
      rime.setVisible(false);
      coat.shade?.setVisible(false);
      return;
    }
    if (rime.texture.key !== sprite.texture.key || rime.frame.name !== sprite.frame.name) rime.setTexture(sprite.texture.key, sprite.frame.name);
    rime.setPosition(sprite.x, sprite.y - 1.2).setOrigin(sprite.originX, sprite.originY).setScale(sprite.scaleX, sprite.scaleY)
      .setAngle(sprite.angle).setFlip(sprite.flipX, sprite.flipY).setDepth(sprite.depth + 0.01)
      .setVisible(sprite.visible).setAlpha(0.42 * weight * sprite.alpha * Math.max(this.sun, this.shade * 0.35));
    // Shade lies beside anything bigger than a seedling, on its west side (the sprite itself covers the
    // ground behind it). It is measured once the plant has finished growing in.
    if (!coat.shade && w >= 14 && !this.scene.tweens.isTweening(sprite)) {
      coat.shade = this.scene.add.image(0, 0, PATCH).setOrigin(1, 0.5).setAngle(SHADE_ANGLE).setDepth(-4.5).setData('size', [w * 0.95, w * 0.4]);
    }
    const shade = coat.shade;
    if (!shade) return;
    // The shadow, and the frost in it, shrinks back toward the plant as the sun climbs. It only stands out
    // once the frost around it has melted, and never where frost didn't form (under a tree crown).
    const [sw, sh] = shade.getData('size') as number[];
    const dw = sw * (0.25 + 0.75 * this.shade), x = sprite.x - sw * 0.12, y = sprite.y - sw * 0.12;
    const ground = Math.min(1, this.coverAt(x - dw / 2, y) / 0.2);
    shade.setPosition(x, y).setDisplaySize(dw, sh * (0.5 + 0.5 * this.shade))
      .setAlpha(0.8 * weight * this.shade * (1 - 0.75 * this.sun) * ground).setVisible(this.shade > 0 && sprite.visible);
  }

  /** The open-ground frost has melted: free its world-sized texture. */
  private dropSheet(): void {
    this.sheet?.destroy();
    this.sheet = null;
    this.sheetCanvas?.removeEventListener('contextrestored', this.repaintSheet!);
    this.sheetCanvas = this.repaintSheet = null;
    if (this.scene.textures.exists(SHEET)) this.scene.textures.remove(SHEET);
  }

  private melted(): void {
    for (const coat of this.coats.values()) {
      coat.rime.destroy();
      coat.shade?.destroy();
    }
    this.coats.clear();
    this.dropSheet();
    this.glints.stop();
    this.steam.stop();
    this.gone = true;
  }

  /** Glints: on frosty ground while the sun is low, then in the shrinking frost shadows. */
  private glintPoint(p: Phaser.Types.Math.Vector2Like): void {
    const v = this.scene.cameras.main.worldView;
    if (Math.random() < this.sun || this.coats.size === 0) {
      for (let i = 0; i < 6; i++) {
        p.x = v.x + Math.random() * v.width;
        p.y = v.y + Math.random() * v.height;
        if (Math.random() < this.coverAt(p.x!, p.y!)) return;
      }
      return;
    }
    this.nearThing(p, true);
  }

  /** Steam rises from the frosted plants and the pod, not from bare sand. */
  private steamPoint(p: Phaser.Types.Math.Vector2Like): void {
    this.nearThing(p, false);
  }

  /** A random point on a frosted thing in view, or in its frost shadow. */
  private nearThing(p: Phaser.Types.Math.Vector2Like, inShade: boolean): void {
    const v = this.scene.cameras.main.worldView;
    const coats = [...this.coats].filter(([s, c]) => c.rime.visible && v.contains(s.x, s.y));
    const pick = coats[Math.floor(Math.random() * coats.length)];
    if (!pick) {
      p.x = v.x - 100;
      p.y = v.y - 100;
      return;
    }
    const [sprite, coat] = pick;
    if (inShade && coat.shade) {
      const b = coat.shade.getBounds();
      p.x = b.x + b.width * (0.1 + Math.random() * 0.6);
      p.y = b.y + b.height * (0.25 + Math.random() * 0.5);
    } else {
      const b = sprite.getBounds();
      p.x = b.x + Math.random() * b.width;
      p.y = b.y + Math.random() * b.height * 0.5;
    }
  }

  private coverAt(x: number, y: number): number {
    const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    return tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H ? 0 : this.cover[ty * MAP_W + tx];
  }

  /** Frost on the open ground, painted once into a world-sized texture that fades as the sun reaches it. */
  private makeSheet(seed: number): Phaser.GameObjects.Image | null {
    if (this.scene.textures.exists(SHEET)) this.scene.textures.remove(SHEET);
    const texture = this.scene.textures.createCanvas(SHEET, WORLD_W, WORLD_H);
    if (!texture) return null;
    // Phaser's ImageData snapshot of the blank canvas is never used (see buildGround).
    Object.assign(texture as unknown as Record<string, unknown>, { imageData: null, data: null, pixels: null, buffer: null });
    const paint = () => {
      this.paintSheet(texture.getContext(), seed);
      texture.refresh();
    };
    paint();
    // A GPU reset can blank the canvas (see make() in placeholders.ts). Phaser reuses pooled canvases,
    // so dropSheet() removes this listener again.
    this.sheetCanvas = texture.canvas;
    this.repaintSheet = () => this.scene.textures.get(SHEET) === texture && paint();
    this.sheetCanvas.addEventListener('contextrestored', this.repaintSheet);
    // Over the ground litter (-5), under the frost shadows.
    return this.scene.add.image(0, 0, SHEET).setOrigin(0).setDepth(-4.9);
  }

  private paintSheet(c: CanvasRenderingContext2D, seed: number): void {
    const rng = mulberry32(seed);
    c.clearRect(0, 0, WORLD_W, WORLD_H);
    // A thin, patchy ice-blue sheen: where frost settles, blurred at a quarter size and enlarged. The
    // tiles are drawn first and blurred once; a filter on each fill would blur the canvas every time.
    const tiles = document.createElement('canvas'), small = document.createElement('canvas');
    tiles.width = small.width = MAP_W * 8;
    tiles.height = small.height = MAP_H * 8;
    const t = tiles.getContext('2d')!;
    t.fillStyle = '#dde9f6';
    for (let ty = 0; ty < MAP_H; ty++) for (let tx = 0; tx < MAP_W; tx++) {
      t.globalAlpha = this.cover[ty * MAP_W + tx];
      t.fillRect(tx * 8 - 2, ty * 8 - 2, 12, 12);
    }
    const s = small.getContext('2d')!;
    s.filter = 'blur(5px)';
    s.drawImage(tiles, 0, 0);
    s.filter = 'none';
    tiles.width = tiles.height = 0;
    // It lies in lacy patches, between sand ripples and around grass clumps.
    s.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 2200; i++) {
      s.globalAlpha = 0.25 + rng() * 0.5;
      s.beginPath();
      s.ellipse(rng() * small.width, rng() * small.height, 1.5 + rng() * 5, 1 + rng() * 3, rng() * Math.PI, 0, Math.PI * 2);
      s.fill();
    }
    c.globalAlpha = 0.5;
    c.drawImage(small, 0, 0, WORLD_W, WORLD_H);
    small.width = small.height = 0;
    // Hoarfrost crystals: tiny bright grains and feathery needles, densest where the frost is heaviest.
    // One path per brightness keeps tens of thousands of them quick to draw.
    const grains = [new Path2D(), new Path2D(), new Path2D()];
    const needles = [new Path2D(), new Path2D(), new Path2D()];
    for (let i = 0; i < 40000; i++) {
      const x = rng() * WORLD_W, y = rng() * WORLD_H, b = Math.floor(rng() * 3);
      if (rng() > this.coverAt(x, y) ** 1.5) continue;
      if (rng() < 0.65) grains[b].rect(x, y, 1, 1);
      else {
        const a = rng() * Math.PI, l = 1.5 + rng() * 2.5;
        needles[b].moveTo(x, y);
        needles[b].lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      }
    }
    c.fillStyle = c.strokeStyle = '#ffffff';
    c.lineWidth = 0.7;
    grains.forEach((path, b) => {
      c.globalAlpha = 0.3 + b * 0.25;
      c.fill(path);
      c.stroke(needles[b]);
    });
    c.globalAlpha = 1;
  }
}

/** A soft, speckled oval of frost for the shadows; it is stretched to fit each one. */
function makePatchTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(PATCH)) return;
  const w = 48, h = 20;
  make(scene, PATCH, w, h, (c) => {
    const rng = mulberry32(77);
    const fade = c.createRadialGradient(w / 2, w / 2, 1, w / 2, w / 2, w / 2);
    fade.addColorStop(0, 'rgba(221, 233, 246, 0.62)');
    fade.addColorStop(0.65, 'rgba(221, 233, 246, 0.36)');
    fade.addColorStop(1, 'rgba(221, 233, 246, 0)');
    c.save();
    c.scale(1, h / w);
    c.fillStyle = fade;
    c.fillRect(0, 0, w, w);
    c.restore();
    c.fillStyle = '#ffffff';
    // Hoarfrost needles and grains, thinning toward the edge.
    for (let i = 0; i < 520; i++) {
      const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * 0.48;
      const x = w / 2 + Math.cos(a) * r * w, y = h / 2 + Math.sin(a) * r * h;
      c.globalAlpha = (0.35 + rng() * 0.65) * (1 - r * 1.4);
      if (rng() < 0.7) c.fillRect(x, y, 0.5, 0.5);
      else line(c, x, y, x + (rng() - 0.5) * 2.4, y + (rng() - 0.5) * 2.4, '#ffffff', 0.35);
    }
    c.globalAlpha = 1;
  });
}
