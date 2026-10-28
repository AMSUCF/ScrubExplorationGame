import { describe, expect, it } from 'vitest';
import { THEMES, melodyScale, nextMelodyIndex } from '../src/audio/music';
import { mulberry32 } from '../src/systems/rng';

describe('generative music', () => {
  it('builds a two-octave pentatonic scale above the root', () => {
    expect(melodyScale(62)).toEqual([74, 76, 78, 81, 83, 86, 88, 90, 93, 95]);
  });

  it('walks the melody in small steps and stays in range', () => {
    const scale = melodyScale(62);
    const rnd = mulberry32(5);
    let idx = 4;
    for (let i = 0; i < 500; i++) {
      const next = nextMelodyIndex(idx, scale, THEMES.scrub.chords[0], 62, false, rnd);
      expect(Math.abs(next - idx)).toBeLessThanOrEqual(2);
      expect(next).toBeGreaterThanOrEqual(0);
      expect(next).toBeLessThan(scale.length);
      idx = next;
    }
  });

  it('lands on chord tones on strong beats', () => {
    const scale = melodyScale(62);
    const chord = THEMES.scrub.chords[1]; // Bm7: B D F# A
    const tones = new Set(chord.map((c) => (((62 + c) % 12) + 12) % 12));
    const rnd = mulberry32(9);
    for (let i = 0; i < 100; i++) {
      const idx = nextMelodyIndex(i % scale.length, scale, chord, 62, true, rnd);
      expect(tones.has(scale[idx] % 12)).toBe(true);
    }
  });
});
