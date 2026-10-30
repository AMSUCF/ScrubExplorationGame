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

  constructor(private scene: Phaser.Scene, private state: GameState) {
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
    this.sheet = this.makeSheet(state.seed ^ Math.imul(state.day, 0x9e3779b1));
    makePatchTexture(scene);

    const zone = (pick: (p: Phaser.Types.Math.Vector2Like) => void) => ({
      type: 'random', quantity: 1,
      source: { getRandomPoint: (p: Phaser.Types.Math.Vector2Like) => (pick(p), p) },
    }) as unknown as Phaser.Types.GameObjects.Particles.EmitZoneData;
    const k = texScale(scene, 'frost');
    // Ice crystals catching the low sun: they twinkle in place, they don't fall.
    this.glints = scene.add.particles(0, 0, tex(scene, 'frost'), {
      emitZone: zone((p) => this.glintPoint(p)),
      lifespan: { min: 500, max: 1000 },
      alpha: { values: [0, 1, 0] } as unknown as Phaser.Types.GameObjects.Particles.EmitterOpOnEmitType,
      scale: { min: 0.55 * k, max: 1 * k },
      rotate: { min: -12, max: 12 },
      blendMode: Phaser.BlendModes.ADD,
      frequency: 45,
    }).setDepth(150002);
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
    // Melted frost stays melted for the rest of the day, even if a battery upgrade adds energy or
    // the robot pops home and back.
    const melt = this.scene.registry.get('frostMelt') as { day: number; f: number } | undefined;
    const f = Math.min(frostLeft(dayLeft), melt?.day === this.state.day ? melt.f : 1);
    this.scene.registry.set('frostMelt', { day: this.state.day, f });
    this.sun = sunFrost(f);
    this.shade = shadeFrost(f);
    this.sheet?.setAlpha(this.sun).setVisible(this.sun > 0);
    if (f <= 0) {
      this.melted();
      return;
    }
    for (const thing of things) this.coat(thing);
    for (const [sprite, coat] of this.coats) {
      if (sprite.active) continue;
      coat.rime.destroy();
      coat.shade?.destroy();
      this.coats.delete(sprite);
    }
    // Fewer crystals glint as the frost thins, and the last ones are warm dew drops.
    this.glints.setFrequency(45 + (1 - f) * 260);
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
  private coat({ sprite, weight }: Frosted): void {
    let coat = this.coats.get(sprite);
    if (!coat) {
      const rime = this.scene.add.image(0, 0, sprite.texture.key, sprite.frame.name).setTintFill(0xeef5fb);
      const w = sprite.displayWidth;
      // Shade lies beside anything bigger than a seedling, on its west side (the sprite itself covers
      // the ground behind it). Anchored at the plant, it shrinks back toward it.
      const shade = w < 14 ? null : this.scene.add.image(0, 0, PATCH).setOrigin(1, 0.5).setAngle(SHADE_ANGLE).setDepth(-4.5);
      shade?.setData('size', [w * 0.95, w * 0.4]);
      coat = { rime, shade };
      this.coats.set(sprite, coat);
    }
    const { rime, shade } = coat;
    if (rime.texture.key !== sprite.texture.key || rime.frame.name !== sprite.frame.name) rime.setTexture(sprite.texture.key, sprite.frame.name);
    rime.setPosition(sprite.x, sprite.y - 1.2).setOrigin(sprite.originX, sprite.originY).setScale(sprite.scaleX, sprite.scaleY)
      .setAngle(sprite.angle).setFlip(sprite.flipX, sprite.flipY).setDepth(sprite.depth + 0.01)
      .setVisible(sprite.visible).setAlpha(0.42 * weight * sprite.alpha * Math.max(this.sun, this.shade * 0.35));
    if (shade) {
      // The shadow, and the frost in it, shrinks back toward the plant as the sun climbs.
      const [w, h] = shade.getData('size') as number[];
      shade.setPosition(sprite.x - w * 0.12, sprite.y - w * 0.12).setDisplaySize(w * (0.25 + 0.75 * this.shade), h * (0.5 + 0.5 * this.shade))
        .setAlpha(0.8 * weight * this.shade).setVisible(this.shade > 0);
    }
  }

  private melted(): void {
    for (const coat of this.coats.values()) {
      coat.rime.destroy();
      coat.shade?.destroy();
    }
    this.coats.clear();
    this.sheet?.destroy();
    this.sheet = null;
    this.glints.stop();
    this.steam.stop();
    if (this.scene.textures.exists(SHEET)) this.scene.textures.remove(SHEET);
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
    const coats = [...this.coats].filter(([s]) => s.visible && v.contains(s.x, s.y));
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
    // A GPU reset can blank the canvas (see make() in placeholders.ts).
    texture.canvas.addEventListener('contextrestored', () => this.scene.textures.get(SHEET) === texture && paint());
    return this.scene.add.image(0, 0, SHEET).setOrigin(0).setDepth(-5);
  }

  private paintSheet(c: CanvasRenderingContext2D, seed: number): void {
    const rng = mulberry32(seed);
    c.clearRect(0, 0, WORLD_W, WORLD_H);
    // A thin, patchy ice-blue sheen: where frost settles, blurred at a quarter size and enlarged.
    const small = document.createElement('canvas');
    small.width = MAP_W * 8; small.height = MAP_H * 8;
    const s = small.getContext('2d')!;
    s.filter = 'blur(5px)';
    s.fillStyle = '#dde9f6';
    for (let ty = 0; ty < MAP_H; ty++) for (let tx = 0; tx < MAP_W; tx++) {
      s.globalAlpha = this.cover[ty * MAP_W + tx];
      s.fillRect(tx * 8 - 2, ty * 8 - 2, 12, 12);
    }
    s.filter = 'none';
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
