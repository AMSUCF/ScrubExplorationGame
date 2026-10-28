// Expressive voices: the robot's wordless bleeps and stylised calls for every animal.
import { InvasiveAnimalId, NativeAnimalId } from '../data/species';
import { Synth } from './synth';

export type RobotMood = 'happy' | 'love' | 'sad' | 'surprise' | 'proud' | 'question' | 'curious' | 'yawn' | 'wake';

/** A little "bloop": sine body with a square edge, gliding between pitches like a cheerful droid. */
function bloop(s: Synth, at: number, from: number, to: number, dur: number, vol = 0.12, wobble = 0) {
  const vibrato = wobble ? { rate: 18, depth: wobble } : undefined;
  s.tone({ freq: from, to, at, dur, vol, attack: 0.012, vibrato, filter: { type: 'lowpass', freq: 3200, q: 0.8 } });
  s.tone({ freq: from, to, type: 'square', at, dur: dur * 0.8, vol: vol * 0.12, attack: 0.012, vibrato, filter: { type: 'lowpass', freq: 1800, q: 0.5 } });
}

export function robotVoice(s: Synth, mood: RobotMood): void {
  switch (mood) {
    case 'happy':
      bloop(s, 0, 620, 820, 0.09);
      bloop(s, 0.1, 880, 1000, 0.08);
      bloop(s, 0.19, 1180, 1320, 0.11);
      break;
    case 'love':
      bloop(s, 0, 520, 760, 0.16, 0.12);
      bloop(s, 0.18, 760, 700, 0.32, 0.11, 22);
      break;
    case 'sad':
      bloop(s, 0, 640, 360, 0.55, 0.11, 8);
      break;
    case 'surprise':
      bloop(s, 0, 480, 1500, 0.14, 0.13);
      bloop(s, 0.16, 1500, 1400, 0.06, 0.08);
      break;
    case 'proud':
      [523, 659, 784, 1047].forEach((f, i) => bloop(s, i * 0.075, f, f * 1.02, 0.1, 0.1));
      break;
    case 'question':
      bloop(s, 0, 600, 640, 0.1, 0.1);
      bloop(s, 0.12, 640, 980, 0.2, 0.11, 10);
      break;
    case 'curious':
      bloop(s, 0, 900, 700, 0.07, 0.08);
      bloop(s, 0.09, 760, 1040, 0.09, 0.08);
      break;
    case 'yawn':
      bloop(s, 0, 560, 300, 0.9, 0.09, 4);
      break;
    case 'wake':
      bloop(s, 0, 300, 700, 0.3, 0.09);
      bloop(s, 0.32, 700, 1000, 0.12, 0.1);
      break;
  }
}

export type AnimalId = NativeAnimalId | InvasiveAnimalId;

/** Stylised (not literal) calls, tuned to feel like each creature. */
export function animalCall(s: Synth, species: AnimalId, vol = 1, pan = 0): void {
  const v = (x: number) => x * vol;
  switch (species) {
    case 'tortoise': {
      // A slow, low "hmph" and a sandy shuffle.
      s.noise({ dur: 0.35, vol: v(0.18), attack: 0.04, pan, filter: { type: 'lowpass', freq: 380, q: 1.5 } });
      s.tone({ freq: 110, to: 85, dur: 0.3, vol: v(0.08), attack: 0.03, pan });
      for (let i = 0; i < 3; i++) s.noise({ at: 0.4 + i * 0.22, dur: 0.12, vol: v(0.07), pan, filter: { type: 'bandpass', freq: 1800, q: 1 } });
      break;
    }
    case 'mouse':
      // Tiny high squeaks.
      for (let i = 0; i < 3; i++) s.tone({ at: i * 0.11, freq: 3200 + i * 300, to: 4200, dur: 0.06, vol: v(0.08), attack: 0.004, pan });
      break;
    case 'jay':
      // The scrub-jay's raspy, scolding "shreep! shreep!"
      for (let i = 0; i < 2; i++) {
        s.tone({ at: i * 0.22, freq: 2100, to: 1300, type: 'sawtooth', dur: 0.14, vol: v(0.16), attack: 0.006, pan, vibrato: { rate: 90, depth: 120 }, filter: { type: 'bandpass', freq: 2300, q: 2.5 } });
        s.noise({ at: i * 0.22, dur: 0.12, vol: v(0.12), pan, filter: { type: 'bandpass', freq: 3000, q: 3 } });
      }
      break;
    case 'indigo':
      // A soft hiss and a tick-tick of the tail in the leaf litter.
      s.noise({ dur: 0.7, vol: v(0.07), attack: 0.08, pan, filter: { type: 'highpass', freq: 3800, q: 0.7 } });
      for (let i = 0; i < 5; i++) s.noise({ at: 0.15 + i * 0.05, dur: 0.025, vol: v(0.06), pan, filter: { type: 'bandpass', freq: 2500, q: 4 } });
      break;
    case 'cat': {
      // "Mi-aow": a voice through two moving formants.
      const glide = (at: number, f1: number, f2: number, dur: number) =>
        s.tone({ at, freq: f1, to: f2, type: 'sawtooth', dur, vol: v(0.2), attack: 0.03, pan, filter: { type: 'bandpass', freq: 1100, to: 800, q: 3 } });
      glide(0, 480, 680, 0.22);
      glide(0.2, 680, 420, 0.35);
      break;
    }
    case 'tegu':
      // Throaty puffing hiss.
      s.noise({ dur: 0.5, vol: v(0.3), attack: 0.03, pan, tremolo: { rate: 14, depth: 0.5 }, filter: { type: 'bandpass', freq: 1200, q: 1.2 } });
      break;
    case 'iguana':
      s.noise({ dur: 0.45, vol: v(0.25), attack: 0.05, pan, filter: { type: 'bandpass', freq: 900, q: 1 } });
      for (let i = 0; i < 3; i++) s.noise({ at: 0.5 + i * 0.09, dur: 0.03, vol: v(0.15), pan, filter: { type: 'lowpass', freq: 700 } });
      break;
    case 'anole':
      // Quick skitter of tiny feet.
      for (let i = 0; i < 7; i++) s.noise({ at: i * 0.035, dur: 0.018, vol: v(0.05), pan, filter: { type: 'highpass', freq: 5000 } });
      break;
  }
}
