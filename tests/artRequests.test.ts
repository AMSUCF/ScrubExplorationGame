import { describe, expect, it } from 'vitest';
import { EFFECT_SIZES, PICTOGRAMS } from '../src/art/effectSizes';
import handoff from '../docs/art-requests.json';
import manifest from '../public/art/manifest.json';

interface Request { key: string; logical: number[]; pixels: number[]; prompt: string }
const requests: Request[] = handoff.assets;
const delivered: string[] = manifest;

const placeholders: Record<string, readonly [number, number]> = { ...EFFECT_SIZES };
for (const p of PICTOGRAMS) placeholders[`ui_${p}`] = [64, 64];

describe('art hand-off list', () => {
  it('asks for each request at the size the game draws its placeholder, at 4×', () => {
    for (const r of requests) {
      expect(placeholders[r.key], `${r.key} is not a placeholder key`).toBeDefined();
      expect(r.logical, r.key).toEqual([...placeholders[r.key]]);
      expect(r.pixels, r.key).toEqual([r.logical[0] * 4, r.logical[1] * 4]);
      expect(r.prompt.length, r.key).toBeGreaterThan(40);
    }
  });

  it('covers every placeholder that has not been illustrated yet', () => {
    const requested = new Set(requests.map((r) => r.key));
    expect(Object.keys(placeholders).filter((k) => !requested.has(k) && !delivered.includes(k))).toEqual([]);
  });
});
