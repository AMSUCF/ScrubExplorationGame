// Tiny synthesis toolkit on top of Web Audio. Every recipe takes a Synth bound to a context and an
// output node, so the same sounds play live or render offline (for previews and tests).

export interface FilterSpec {
  type: BiquadFilterType;
  freq: number;
  to?: number;
  q?: number;
}

export interface ToneSpec {
  freq: number;
  /** Glide to this frequency over the note. */
  to?: number;
  type?: OscillatorType;
  dur: number;
  vol?: number;
  attack?: number;
  /** Delay before the note starts, in seconds from `t`. */
  at?: number;
  vibrato?: { rate: number; depth: number };
  filter?: FilterSpec;
  pan?: number;
  detune?: number;
}

export interface NoiseSpec {
  dur: number;
  vol?: number;
  attack?: number;
  at?: number;
  filter?: FilterSpec;
  pan?: number;
  /** Amplitude wobble (Hz) — insects, purrs, rattles. */
  tremolo?: { rate: number; depth: number };
}

const noiseCache = new WeakMap<BaseAudioContext, AudioBuffer>();

export class Synth {
  constructor(
    readonly ctx: BaseAudioContext,
    readonly out: AudioNode,
    readonly t0: number,
  ) {}

  noiseBuffer(): AudioBuffer {
    let buf = noiseCache.get(this.ctx);
    if (!buf) {
      buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      noiseCache.set(this.ctx, buf);
    }
    return buf;
  }

  private chain(start: number, filter?: FilterSpec, dur = 0, pan?: number): { input: AudioNode; gain: GainNode } {
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    let node: AudioNode = gain;
    if (filter) {
      const f = this.ctx.createBiquadFilter();
      f.type = filter.type;
      f.frequency.setValueAtTime(filter.freq, start);
      if (filter.to) f.frequency.exponentialRampToValueAtTime(filter.to, start + dur);
      f.Q.value = filter.q ?? 1;
      gain.connect(f);
      node = f;
    }
    if (pan !== undefined && pan !== 0) {
      const p = this.ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      node.connect(p);
      node = p;
    }
    node.connect(this.out);
    return { input: gain, gain };
  }

  /** Attack / exponential decay envelope. */
  private envelope(g: AudioParam, start: number, attack: number, dur: number, vol: number) {
    g.setValueAtTime(0.0001, start);
    g.exponentialRampToValueAtTime(Math.max(0.0002, vol), start + Math.max(0.003, attack));
    g.exponentialRampToValueAtTime(0.0001, start + dur);
  }

  tone(s: ToneSpec): void {
    const start = this.t0 + (s.at ?? 0);
    const osc = this.ctx.createOscillator();
    osc.type = s.type ?? 'sine';
    osc.frequency.setValueAtTime(s.freq, start);
    if (s.to) osc.frequency.exponentialRampToValueAtTime(s.to, start + s.dur * 0.9);
    if (s.detune) osc.detune.value = s.detune;
    if (s.vibrato) {
      const lfo = this.ctx.createOscillator();
      const depth = this.ctx.createGain();
      lfo.frequency.value = s.vibrato.rate;
      depth.gain.value = s.vibrato.depth;
      lfo.connect(depth).connect(osc.frequency);
      lfo.start(start);
      lfo.stop(start + s.dur + 0.05);
    }
    const { input, gain } = this.chain(start, s.filter, s.dur, s.pan);
    this.envelope(gain.gain, start, s.attack ?? 0.01, s.dur, s.vol ?? 0.2);
    osc.connect(input);
    osc.start(start);
    osc.stop(start + s.dur + 0.05);
  }

  noise(s: NoiseSpec): void {
    const start = this.t0 + (s.at ?? 0);
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer();
    src.loop = true;
    const { input, gain } = this.chain(start, s.filter, s.dur, s.pan);
    this.envelope(gain.gain, start, s.attack ?? 0.005, s.dur, s.vol ?? 0.2);
    if (s.tremolo) {
      const trem = this.ctx.createGain();
      const lfo = this.ctx.createOscillator();
      const depth = this.ctx.createGain();
      lfo.frequency.value = s.tremolo.rate;
      depth.gain.value = s.tremolo.depth;
      trem.gain.value = 1 - s.tremolo.depth;
      lfo.connect(depth).connect(trem.gain);
      src.connect(trem).connect(input);
      lfo.start(start);
      lfo.stop(start + s.dur + 0.05);
    } else {
      src.connect(input);
    }
    src.start(start, Math.random() * 1.5);
    src.stop(start + s.dur + 0.05);
  }

  /** Plucked string / kalimba-ish note: a few decaying partials. */
  pluck(freq: number, at: number, vol: number, decay = 0.9, bright = 1, pan = 0): void {
    this.tone({ freq, type: 'triangle', at, dur: decay, vol, attack: 0.004, pan, filter: { type: 'lowpass', freq: 2400 * bright, to: 600, q: 0.7 } });
    this.tone({ freq: freq * 2, type: 'sine', at, dur: decay * 0.5, vol: vol * 0.35 * bright, attack: 0.003, pan });
    this.tone({ freq: freq * 3.01, type: 'sine', at, dur: decay * 0.25, vol: vol * 0.12 * bright, attack: 0.002, pan });
  }

  /** Bell / music-box tone: sine with an inharmonic shimmer. */
  bell(freq: number, at: number, vol: number, decay = 1.4, pan = 0): void {
    this.tone({ freq, at, dur: decay, vol, attack: 0.003, pan });
    this.tone({ freq: freq * 2.76, at, dur: decay * 0.4, vol: vol * 0.25, attack: 0.002, pan });
    this.tone({ freq: freq * 5.4, at, dur: decay * 0.15, vol: vol * 0.08, attack: 0.001, pan });
  }

  /** Soft sustained chord. */
  pad(freqs: number[], at: number, dur: number, vol: number): void {
    for (const f of freqs) {
      for (const det of [-6, 6]) {
        this.tone({ freq: f, type: 'triangle', at, dur, vol: vol / freqs.length, attack: dur * 0.35, detune: det, filter: { type: 'lowpass', freq: 900, q: 0.5 } });
      }
    }
  }
}

export const midi = (n: number): number => 440 * Math.pow(2, (n - 69) / 12);
