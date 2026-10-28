// Simple wander AI for scrub animals: amble to a nearby spot in their home zone, pause, repeat.
import Phaser from 'phaser';
import { TILE, WORLD_H, WORLD_W } from '../config';
import { zoneAtPx } from '../data/map';
import { INVASIVE_ANIMALS, InvasiveAnimalId, NativeAnimalId } from '../data/species';
import { AnimalEntity } from '../systems/state';

const NATIVE_SPEED: Record<NativeAnimalId, number> = { tortoise: 10, mouse: 40, jay: 34, indigo: 24 };

export class Critter {
  private target: { x: number; y: number } | null = null;
  private wait: number;
  private readonly speed: number;
  private t = Math.random() * 1000;
  /** Cold-stunned (iguanas in a cold snap): stays put. */
  frozen = false;
  private hurry = 1;

  constructor(
    readonly entity: AnimalEntity,
    readonly sprite: Phaser.GameObjects.Image,
  ) {
    this.speed =
      entity.kind === 'invasiveAnimal'
        ? INVASIVE_ANIMALS[entity.species as InvasiveAnimalId].speed
        : NATIVE_SPEED[entity.species as NativeAnimalId];
    this.wait = 500 + Math.random() * 2000;
  }

  private pickTarget(): void {
    this.hurry = 1;
    const range = this.entity.species === 'anole' ? 70 : 110;
    for (let i = 0; i < 6; i++) {
      const x = Phaser.Math.Clamp(this.sprite.x + (Math.random() - 0.5) * 2 * range, TILE * 1.5, WORLD_W - TILE * 1.5);
      const y = Phaser.Math.Clamp(this.sprite.y + (Math.random() - 0.5) * 2 * range, TILE * 1.5, WORLD_H - TILE * 1.5);
      if (zoneAtPx(x, y) === this.entity.home) {
        this.target = { x, y };
        return;
      }
    }
    this.target = null;
  }

  /** Scurry away from a flame (or anything startling), quickly and without regard for zones. */
  flee(fromX: number, fromY: number): void {
    const dx = this.sprite.x - fromX, dy = this.sprite.y - fromY;
    const d = Math.hypot(dx, dy) || 1;
    this.target = {
      x: Phaser.Math.Clamp(this.sprite.x + (dx / d) * 140, TILE * 1.5, WORLD_W - TILE * 1.5),
      y: Phaser.Math.Clamp(this.sprite.y + (dy / d) * 140, TILE * 1.5, WORLD_H - TILE * 1.5),
    };
    this.wait = 0;
    this.hurry = 3;
  }

  greet(fromX: number): void {
    this.target = null;
    this.hurry = 1;
    this.wait = 3800;
    this.sprite.setFlipX(fromX < this.sprite.x).setAngle(0);
  }

  update(dtMs: number): void {
    this.t += dtMs;
    if (this.frozen) {
      this.sprite.setAngle(0);
      return;
    }
    if (this.wait > 0) {
      this.wait -= dtMs;
      if (this.wait <= 0) this.pickTarget();
      this.sprite.setAngle(0);
      return;
    }
    if (!this.target) {
      this.wait = 1000;
      return;
    }
    const dx = this.target.x - this.sprite.x;
    const dy = this.target.y - this.sprite.y;
    const dist = Math.hypot(dx, dy);
    const step = (this.speed * this.hurry * dtMs) / 1000;
    if (dist <= step) {
      this.sprite.setPosition(this.target.x, this.target.y);
      this.target = null;
      this.hurry = 1;
      const lazy = this.entity.species === 'cat' || this.entity.species === 'tortoise';
      this.wait = (lazy ? 2500 : 900) + Math.random() * 2500;
    } else {
      this.sprite.x += (dx / dist) * step;
      this.sprite.y += (dy / dist) * step;
      this.sprite.setFlipX(dx < 0);
      // A little waddle (or a hop for the jay).
      this.sprite.setAngle(Math.sin(this.t / 90) * (this.entity.species === 'jay' ? 0 : 4));
    }
    this.sprite.setDepth(this.sprite.y);
    this.entity.x = this.sprite.x;
    this.entity.y = this.sprite.y;
  }
}
