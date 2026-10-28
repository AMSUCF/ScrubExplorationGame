// Generative instrumental soundtrack: warm pentatonic melodies over gentle seventh chords, like a
// lazy Florida afternoon. Each theme is a few numbers; the melody is improvised fresh every loop.
import { Synth, midi } from './synth';

export type ThemeId = 'scrub' | 'home' | 'intro';

export interface Theme {
  bpm: number;
  /** MIDI note of the key's tonic. */
  root: number;
  /** Chords as semitone offsets from the root; the first note doubles as the bass. */
  chords: number[][];
  barsPerChord: number;
  lead: 'pluck' | 'bell';
  leadVol: number;
  padVol: number;
  bassVol: number;
  shakerVol: number;
  /** 0..1 — how busy the melody is. */
  density: number;
  swing: number;
  /** Little bird-like grace notes up high. */
  birdie: boolean;
}

const PENTATONIC = [0, 2, 4, 7, 9];

export const THEMES: Record<ThemeId, Theme> = {
  // D major: Dmaj7 – Bm7 – Gmaj7 – A
  scrub: {
    bpm: 84,
    root: 62,
    chords: [[0, 4, 7, 11], [-3, 0, 4, 7], [-7, -3, 0, 4], [-5, -1, 2, 7]],
    barsPerChord: 2,
    lead: 'pluck',
    leadVol: 0.07,
    padVol: 0.05,
    bassVol: 0.07,
    shakerVol: 0.012,
    density: 0.55,
    swing: 0.12,
    birdie: true,
  },
  // F major, slower, music-box: Fmaj7 – Dm7 – Bbmaj7 – C6
  home: {
    bpm: 66,
    root: 65,
    chords: [[0, 4, 7, 11], [-3, 0, 3, 7], [-7, -3, 0, 4], [-5, -1, 2, 4]],
    barsPerChord: 2,
    lead: 'bell',
    leadVol: 0.05,
    padVol: 0.05,
    bassVol: 0.05,
    shakerVol: 0,
    density: 0.42,
    swing: 0,
    birdie: false,
  },
  // Spacious and hopeful for the pod drop.
  intro: {
    bpm: 60,
    root: 62,
    chords: [[-7, -3, 0, 4], [0, 4, 7, 11]],
    barsPerChord: 2,
    lead: 'bell',
    leadVol: 0.04,
    padVol: 0.06,
    bassVol: 0.05,
    shakerVol: 0,
    density: 0.25,
    swing: 0,
    birdie: false,
  },
};

/** Scale notes (MIDI) for the melody: two octaves of pentatonic above the root. */
export function melodyScale(root: number): number[] {
  const out: number[] = [];
  for (let oct = 0; oct < 2; oct++) for (const d of PENTATONIC) out.push(root + 12 + oct * 12 + d);
  return out;
}

/** Picks the next melody index with a gentle random walk, preferring chord tones on strong beats. */
export function nextMelodyIndex(prev: number, scale: number[], chord: number[], root: number, strong: boolean, rnd: () => number): number {
  const steps = [-2, -1, -1, 0, 1, 1, 2];
  let idx = Math.max(0, Math.min(scale.length - 1, prev + steps[Math.floor(rnd() * steps.length)]));
  if (strong) {
    const tones = new Set(chord.map((c) => (((root + c) % 12) + 12) % 12));
    let best = idx;
    let bestD = Infinity;
    scale.forEach((n, i) => {
      if (tones.has(n % 12) && Math.abs(i - idx) < bestD) {
        best = i;
        bestD = Math.abs(i - idx);
      }
    });
    idx = best;
  }
  return idx;
}

export class MusicPlayer {
  private gain: GainNode | null = null;
  private theme: Theme | null = null;
  private themeId: ThemeId | null = null;
  private step = 0;
  private nextTime = 0;
  private melodyIdx = 4;
  private timer: number | null = null;

  constructor(
    private ctx: AudioContext,
    private bus: AudioNode,
  ) {}

  get current(): ThemeId | null {
    return this.themeId;
  }

  play(id: ThemeId | null): void {
    if (id === this.themeId) return;
    // Fade the old theme out.
    if (this.gain) {
      const g = this.gain;
      g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.6);
      setTimeout(() => g.disconnect(), 3000);
      this.gain = null;
    }
    this.themeId = id;
    if (!id) {
      this.stopTimer();
      return;
    }
    this.theme = THEMES[id];
    this.gain = this.ctx.createGain();
    this.gain.gain.value = 0;
    this.gain.gain.setTargetAtTime(1, this.ctx.currentTime + 0.3, 0.8);
    this.gain.connect(this.bus);
    this.step = 0;
    this.melodyIdx = 4;
    this.nextTime = this.ctx.currentTime + 0.4;
    if (this.timer === null) this.timer = window.setInterval(() => this.schedule(), 60);
  }

  private stopTimer(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
  }

  private schedule(): void {
    const th = this.theme;
    const out = this.gain;
    if (!th || !out) return;
    const eighth = 30 / th.bpm;
    while (this.nextTime < this.ctx.currentTime + 0.25) {
      const swing = this.step % 2 === 1 ? eighth * th.swing : 0;
      renderStep(new Synth(this.ctx, out, this.nextTime + swing), th, this.step, this.melodyIdx, Math.random, (i) => (this.melodyIdx = i));
      this.nextTime += eighth;
      this.step++;
    }
  }
}

/** Everything that happens on one eighth-note step. Exported so it can render offline. */
export function renderStep(s: Synth, th: Theme, step: number, melodyIdx: number, rnd: () => number, setIdx: (i: number) => void): void {
  const stepsPerBar = 8;
  const bar = Math.floor(step / stepsPerBar);
  const inBar = step % stepsPerBar;
  const chord = th.chords[Math.floor(bar / th.barsPerChord) % th.chords.length];
  const eighth = 30 / th.bpm;
  const chordStart = inBar === 0 && bar % th.barsPerChord === 0;

  if (chordStart) {
    s.pad(chord.map((c) => midi(th.root + c)), 0, eighth * stepsPerBar * th.barsPerChord, th.padVol);
  }
  if (inBar === 0 || inBar === 5) {
    s.tone({ freq: midi(th.root + chord[0] - 12), type: 'sine', dur: eighth * 2.5, vol: th.bassVol, attack: 0.02 });
  }
  if (th.shakerVol > 0) {
    s.noise({ dur: 0.05, vol: th.shakerVol * (inBar % 2 === 0 ? 1 : 0.6), filter: { type: 'highpass', freq: 6500 } });
  }

  // Breathe: every fourth bar is mostly rest.
  const phraseBar = bar % 4;
  const density = phraseBar === 3 ? th.density * 0.25 : th.density;
  const strong = inBar % 4 === 0;
  if (rnd() < (strong ? density + 0.25 : density * 0.6)) {
    const scale = melodyScale(th.root);
    const idx = nextMelodyIndex(melodyIdx, scale, chord, th.root, strong, rnd);
    setIdx(idx);
    const f = midi(scale[idx]);
    const pan = (rnd() - 0.5) * 0.4;
    if (th.lead === 'pluck') s.pluck(f, 0, th.leadVol, strong ? 1.1 : 0.7, 1, pan);
    else s.bell(f, 0, th.leadVol, strong ? 1.8 : 1.2, pan);
  }
  if (th.birdie && phraseBar === 3 && inBar === 4 && rnd() < 0.5) {
    const top = midi(th.root + 31);
    [0, 0.07, 0.14].forEach((at, i) => s.tone({ at, freq: top * (1 + i * 0.12), to: top * (1.1 + i * 0.12), dur: 0.08, vol: 0.02 }));
  }
}
