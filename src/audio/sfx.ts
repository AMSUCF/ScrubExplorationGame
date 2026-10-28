// Sound-effect recipes. Each is a few lines of synthesis — rustles, snips, clinks, chimes.
import { Synth, midi } from './synth';

export type SfxName =
  | 'tap'
  | 'open'
  | 'nope'
  | 'click'
  | 'scan'
  | 'pull'
  | 'cut'
  | 'hit'
  | 'pickup'
  | 'trim'
  | 'seeds'
  | 'sprig'
  | 'crate'
  | 'jar'
  | 'recycle'
  | 'dropoff'
  | 'water'
  | 'sow'
  | 'pot'
  | 'arrange'
  | 'clear'
  | 'upgrade'
  | 'roomUp'
  | 'door'
  | 'plant'
  | 'rescue'
  | 'gain'
  | 'photo'
  | 'discovery'
  | 'morning'
  | 'lullaby'
  | 'powerDown'
  | 'whoosh'
  | 'land'
  | 'pop'
  | 'page';

const chime = (s: Synth, notes: number[], gap: number, vol = 0.08, decay = 1.1) =>
  notes.forEach((n, i) => s.bell(midi(n), i * gap, vol, decay));

const rustle = (s: Synth, at: number, dur: number, vol: number, freq = 2600) =>
  s.noise({ at, dur, vol, attack: 0.02, filter: { type: 'bandpass', freq, to: freq * 0.6, q: 0.9 }, tremolo: { rate: 26, depth: 0.6 } });

export const SFX: Record<SfxName, (s: Synth) => void> = {
  tap: (s) => s.tone({ freq: 900, to: 700, dur: 0.05, vol: 0.05 }),
  open: (s) => {
    s.tone({ freq: 520, to: 880, dur: 0.09, vol: 0.06 });
    s.tone({ at: 0.04, freq: 1320, dur: 0.12, vol: 0.03 });
  },
  nope: (s) => {
    s.tone({ freq: 240, to: 200, type: 'square', dur: 0.09, vol: 0.04, filter: { type: 'lowpass', freq: 900 } });
    s.tone({ at: 0.1, freq: 200, to: 160, type: 'square', dur: 0.12, vol: 0.04, filter: { type: 'lowpass', freq: 900 } });
  },
  click: (s) => s.noise({ dur: 0.03, vol: 0.06, filter: { type: 'highpass', freq: 3000 } }),
  scan: (s) => {
    s.tone({ freq: 400, to: 1600, type: 'sine', dur: 0.45, vol: 0.06, vibrato: { rate: 30, depth: 40 } });
    s.tone({ at: 0.05, freq: 800, to: 3200, type: 'triangle', dur: 0.4, vol: 0.03 });
    chime(s, [88, 93], 0.08, 0.04, 0.6);
  },
  pull: (s) => {
    rustle(s, 0, 0.28, 0.16);
    s.tone({ at: 0.24, freq: 300, to: 900, dur: 0.08, vol: 0.1 }); // root pops free
    rustle(s, 0.3, 0.15, 0.06, 4000);
  },
  cut: (s) => {
    for (const at of [0, 0.09]) s.noise({ at, dur: 0.04, vol: 0.18, filter: { type: 'bandpass', freq: 5200, q: 3 } });
    s.tone({ at: 0.09, freq: 1800, to: 1500, dur: 0.06, vol: 0.03 });
  },
  hit: (s) => {
    s.noise({ dur: 0.08, vol: 0.2, filter: { type: 'lowpass', freq: 1400 } });
    s.tone({ freq: 160, to: 90, dur: 0.12, vol: 0.12 });
    rustle(s, 0.04, 0.2, 0.08);
  },
  pickup: (s) => {
    s.tone({ freq: 180, to: 120, dur: 0.12, vol: 0.12, type: 'triangle' });
    s.noise({ at: 0.02, dur: 0.1, vol: 0.06, filter: { type: 'bandpass', freq: 900, q: 2 } });
    s.tone({ at: 0.14, freq: 880, to: 1175, dur: 0.12, vol: 0.05 });
  },
  trim: (s) => {
    for (const at of [0, 0.08, 0.16]) s.noise({ at, dur: 0.035, vol: 0.14, filter: { type: 'bandpass', freq: 4800, q: 3 } });
    rustle(s, 0.12, 0.3, 0.1, 1800);
  },
  seeds: (s) => [0, 0.06, 0.12].forEach((at, i) => s.pluck(midi(79 + i * 2), at, 0.06, 0.3, 1.4)),
  sprig: (s) => {
    s.noise({ dur: 0.04, vol: 0.12, filter: { type: 'bandpass', freq: 5000, q: 3 } });
    chime(s, [84, 88, 91], 0.07, 0.05, 0.9);
  },
  crate: (s) => {
    s.tone({ freq: 140, to: 90, dur: 0.18, vol: 0.18, type: 'triangle' }); // wooden thunk
    s.noise({ dur: 0.08, vol: 0.08, filter: { type: 'lowpass', freq: 800 } });
    s.noise({ at: 0.22, dur: 0.03, vol: 0.12, filter: { type: 'highpass', freq: 2500 } }); // latch
    s.tone({ at: 0.22, freq: 1800, dur: 0.05, vol: 0.04 });
  },
  jar: (s) => {
    s.bell(midi(96), 0, 0.06, 0.5);
    s.bell(midi(100), 0.07, 0.05, 0.5);
    s.tone({ at: 0.14, freq: 600, to: 400, dur: 0.06, vol: 0.05 }); // lid twist
  },
  recycle: (s) => {
    s.tone({ freq: 90, to: 240, type: 'sawtooth', dur: 0.6, vol: 0.05, filter: { type: 'lowpass', freq: 700 } }); // whirr
    for (let i = 0; i < 5; i++) s.bell(midi(84 + ((i * 5) % 12)), 0.1 + i * 0.07, 0.03, 0.25); // clinks
    chime(s, [79, 84], 0.12, 0.06, 0.8);
  },
  dropoff: (s) => {
    s.tone({ freq: 120, to: 80, dur: 0.2, vol: 0.14, type: 'triangle' });
    chime(s, [72, 76, 79], 0.09, 0.05, 0.9);
  },
  water: (s) => {
    for (let i = 0; i < 6; i++) {
      const f = 700 + Math.random() * 900;
      s.tone({ at: i * 0.07 + Math.random() * 0.03, freq: f, to: f * 1.8, dur: 0.06, vol: 0.05 });
    }
    s.noise({ dur: 0.45, vol: 0.04, filter: { type: 'bandpass', freq: 1400, q: 0.8 } });
  },
  sow: (s) => {
    for (const at of [0, 0.1, 0.2]) s.noise({ at, dur: 0.05, vol: 0.06, filter: { type: 'lowpass', freq: 600 } });
    s.pluck(midi(81), 0.25, 0.04, 0.3);
  },
  pot: (s) => {
    s.tone({ freq: 220, to: 660, dur: 0.1, vol: 0.12 }); // pop out of the jar
    rustle(s, 0.08, 0.2, 0.06, 3200);
    chime(s, [79, 83, 86], 0.06, 0.05, 0.7);
  },
  arrange: (s) => chime(s, [86, 91, 95], 0.08, 0.05, 1.2),
  clear: (s) => rustle(s, 0, 0.35, 0.1, 2000),
  upgrade: (s) => {
    for (let i = 0; i < 4; i++) s.noise({ at: i * 0.06, dur: 0.03, vol: 0.08, filter: { type: 'bandpass', freq: 2200, q: 4 } }); // ratchet
    chime(s, [72, 76, 79, 84], 0.09, 0.07, 1.2);
  },
  roomUp: (s) => {
    s.pad([midi(60), midi(64), midi(67), midi(71)], 0, 2.2, 0.08);
    chime(s, [72, 76, 79, 84, 88], 0.12, 0.07, 1.5);
  },
  door: (s) => {
    s.noise({ dur: 0.35, vol: 0.06, attack: 0.08, filter: { type: 'bandpass', freq: 600, to: 1600, q: 0.8 } }); // whoosh
    s.tone({ at: 0.3, freq: 1200, dur: 0.05, vol: 0.04 });
  },
  plant: (s) => {
    s.noise({ dur: 0.12, vol: 0.12, filter: { type: 'lowpass', freq: 700 } }); // dig
    s.noise({ at: 0.13, dur: 0.1, vol: 0.08, filter: { type: 'lowpass', freq: 500 } });
    s.tone({ at: 0.25, freq: 300, to: 900, dur: 0.18, vol: 0.08, vibrato: { rate: 12, depth: 30 } }); // sprout boing
    chime(s, [84, 88], 0.08, 0.04, 0.8);
  },
  rescue: (s) => chime(s, [76, 79, 83, 86, 91], 0.07, 0.06, 1.3),
  gain: (s) => s.pluck(midi(91), 0, 0.04, 0.25, 1.5),
  photo: (s) => {
    s.noise({ dur: 0.03, vol: 0.14, filter: { type: 'highpass', freq: 2000 } });
    s.noise({ at: 0.05, dur: 0.04, vol: 0.1, filter: { type: 'bandpass', freq: 1500, q: 2 } });
    s.tone({ at: 0.1, freq: 2600, to: 3000, dur: 0.25, vol: 0.02 });
  },
  discovery: (s) => {
    s.pad([midi(62), midi(66), midi(69)], 0, 1.4, 0.05);
    chime(s, [74, 78, 81, 86], 0.1, 0.06, 1.4);
  },
  morning: (s) => {
    s.pad([midi(62), midi(66), midi(69), midi(73)], 0, 2.6, 0.06);
    [74, 78, 81, 78, 86].forEach((n, i) => s.pluck(midi(n), 0.15 + i * 0.22, 0.07, 1.2));
  },
  lullaby: (s) => [84, 81, 79, 76, 74, 72].forEach((n, i) => s.bell(midi(n), i * 0.32, 0.05, 1.6)),
  powerDown: (s) => {
    s.tone({ freq: 700, to: 90, type: 'triangle', dur: 0.9, vol: 0.08 });
    s.tone({ freq: 704, to: 92, type: 'sine', dur: 0.9, vol: 0.05 });
  },
  whoosh: (s) => s.noise({ dur: 1.6, vol: 0.12, attack: 1.2, filter: { type: 'bandpass', freq: 300, to: 2400, q: 0.8 } }),
  land: (s) => {
    s.tone({ freq: 90, to: 38, dur: 0.6, vol: 0.35 });
    s.noise({ dur: 0.7, vol: 0.2, filter: { type: 'lowpass', freq: 900, to: 200 } });
    for (let i = 0; i < 6; i++) s.noise({ at: 0.15 + i * 0.07, dur: 0.05, vol: 0.04, filter: { type: 'bandpass', freq: 3000 } }); // sand patter
  },
  pop: (s) => s.tone({ freq: 400, to: 1100, dur: 0.07, vol: 0.07 }),
  page: (s) => s.noise({ dur: 0.18, vol: 0.06, attack: 0.03, filter: { type: 'bandpass', freq: 3500, to: 1800, q: 0.7 } }),
};
