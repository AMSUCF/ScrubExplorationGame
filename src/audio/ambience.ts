// Living soundscape: cicadas swelling in the heat, crickets as dusk comes on, wind in the
// palmettos, and the occasional cardinal, mourning dove or woodpecker. Muffled inside the pod.
import { Synth } from './synth';

export type AmbienceMode = 'day' | 'home' | 'off';

export type BirdCall = 'cardinal' | 'dove' | 'woodpecker' | 'towhee';

export function birdCall(s: Synth, bird: BirdCall, vol: number, pan: number): void {
  switch (bird) {
    case 'cardinal':
      // "cheer-cheer-cheer": clear down-slurred whistles.
      for (let i = 0; i < 3; i++) s.tone({ at: i * 0.3, freq: 3100, to: 1900, dur: 0.22, vol, pan, attack: 0.02 });
      break;
    case 'dove':
      // Mourning dove: "coo-OOO-oo-oo".
      [[0, 0.35, 0.6], [0.45, 0.6, 1], [1.15, 0.4, 0.8], [1.65, 0.4, 0.7]].forEach(([at, dur, k]) =>
        s.tone({ at, freq: 520 * (k === 1 ? 1.15 : 1), to: 470, dur, vol: vol * k, pan, attack: 0.08, vibrato: { rate: 5, depth: 6 } }),
      );
      break;
    case 'woodpecker':
      for (let i = 0; i < 10; i++) s.noise({ at: i * 0.045, dur: 0.02, vol: vol * 5, pan, filter: { type: 'bandpass', freq: 1100, q: 5 } });
      break;
    case 'towhee':
      // Eastern towhee: "drink-your-teeeea".
      s.tone({ freq: 2000, dur: 0.1, vol, pan });
      s.tone({ at: 0.14, freq: 1500, dur: 0.1, vol, pan });
      s.tone({ at: 0.3, freq: 3000, dur: 0.5, vol: vol * 0.8, pan, vibrato: { rate: 40, depth: 140 } });
      break;
  }
}

export class Ambience {
  private gain: GainNode;
  private filter: BiquadFilterNode;
  private cicadaGain: GainNode;
  private windGain: GainNode;
  private windDepth: GainNode;
  private rainGain: GainNode;
  private roarGain: GainNode;
  private fireLevel = 0;
  private nextCrackle = 0;
  /** Cicadas hush in rain and cold. */
  private cicadaScale = 1;
  private timer: number | null = null;
  private mode: AmbienceMode = 'off';
  private dusk = 0;
  private nextCricket = 0;
  private nextBird = 0;
  private nextBubble = 0;

  constructor(
    private ctx: AudioContext,
    bus: AudioNode,
  ) {
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 18000;
    this.gain = ctx.createGain();
    this.gain.gain.value = 0;
    this.gain.connect(this.filter).connect(bus);

    // Cicadas: narrow band of noise, buzzing fast and swelling slowly.
    const s = new Synth(ctx, this.gain, 0);
    const cicada = ctx.createBufferSource();
    cicada.buffer = s.noiseBuffer();
    cicada.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 5200;
    band.Q.value = 7;
    const buzz = ctx.createGain();
    buzz.gain.value = 0.5;
    const buzzLfo = ctx.createOscillator();
    buzzLfo.frequency.value = 48;
    const buzzDepth = ctx.createGain();
    buzzDepth.gain.value = 0.5;
    buzzLfo.connect(buzzDepth).connect(buzz.gain);
    this.cicadaGain = ctx.createGain();
    this.cicadaGain.gain.value = 0.02;
    const swell = ctx.createOscillator();
    swell.frequency.value = 0.06;
    const swellDepth = ctx.createGain();
    swellDepth.gain.value = 0.016;
    swell.connect(swellDepth).connect(this.cicadaGain.gain);
    cicada.connect(band).connect(buzz).connect(this.cicadaGain).connect(this.gain);

    // Warm wind in the scrub.
    const wind = ctx.createBufferSource();
    wind.buffer = s.noiseBuffer();
    wind.loop = true;
    const windLp = ctx.createBiquadFilter();
    windLp.type = 'lowpass';
    windLp.frequency.value = 420;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0.05;
    const gust = ctx.createOscillator();
    gust.frequency.value = 0.09;
    const gustDepth = ctx.createGain();
    gustDepth.gain.value = 0.035;
    this.windDepth = gustDepth;
    gust.connect(gustDepth).connect(this.windGain.gain);
    wind.connect(windLp).connect(this.windGain).connect(this.gain);

    // Rain: a soft hiss of drops on sand and leaves.
    const rain = ctx.createBufferSource();
    rain.buffer = s.noiseBuffer();
    rain.loop = true;
    const rainHp = ctx.createBiquadFilter();
    rainHp.type = 'highpass';
    rainHp.frequency.value = 900;
    const rainLp = ctx.createBiquadFilter();
    rainLp.type = 'lowpass';
    rainLp.frequency.value = 6500;
    this.rainGain = ctx.createGain();
    this.rainGain.gain.value = 0;
    rain.connect(rainHp).connect(rainLp).connect(this.rainGain).connect(this.gain);

    // Fire: a low roar under the crackles (crackles are scheduled in tick()).
    const roar = ctx.createBufferSource();
    roar.buffer = s.noiseBuffer();
    roar.loop = true;
    const roarLp = ctx.createBiquadFilter();
    roarLp.type = 'lowpass';
    roarLp.frequency.value = 320;
    this.roarGain = ctx.createGain();
    this.roarGain.gain.value = 0;
    roar.connect(roarLp).connect(this.roarGain).connect(this.gain);

    for (const n of [cicada, buzzLfo, swell, wind, gust, rain, roar]) n.start();
  }

  /** Rain intensity (0..1), wind speed (0..1), and whether insects sing. */
  setWeather(rain: number, wind: number, insects: number): void {
    const now = this.ctx.currentTime;
    this.rainGain.gain.setTargetAtTime(rain * 0.07, now, 1);
    this.windGain.gain.setTargetAtTime(0.03 + wind * 0.11, now, 1);
    this.windDepth.gain.setTargetAtTime(0.02 + wind * 0.07, now, 1);
    this.cicadaScale = insects;
    this.setDusk(this.dusk);
  }

  /** 0 (no fire) .. 1 (standing right beside a big fire). */
  setFire(level: number): void {
    this.fireLevel = level;
    this.roarGain.gain.setTargetAtTime(level * 0.06, this.ctx.currentTime, 0.4);
  }

  setMode(mode: AmbienceMode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    const now = this.ctx.currentTime;
    this.gain.gain.setTargetAtTime(mode === 'off' ? 0 : mode === 'home' ? 0.45 : 1, now, 0.6);
    this.filter.frequency.setTargetAtTime(mode === 'home' ? 650 : 18000, now, 0.4);
    if (mode !== 'off' && this.timer === null) this.timer = window.setInterval(() => this.tick(), 120);
    if (mode === 'off' && this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** 0 = bright day, 1 = dusk: cicadas fade, crickets rise. */
  setDusk(d: number): void {
    this.dusk = d;
    this.cicadaGain.gain.setTargetAtTime(0.02 * (1 - d * 0.8) * this.cicadaScale, this.ctx.currentTime, 1);
  }

  private tick(): void {
    const now = this.ctx.currentTime;
    if (now > this.nextCricket) {
      const s = new Synth(this.ctx, this.gain, now + 0.05);
      const vol = 0.006 + this.dusk * 0.025;
      const pan = Math.random() * 1.6 - 0.8;
      for (let i = 0; i < 3; i++) s.tone({ at: i * 0.045, freq: 4400, dur: 0.03, vol, pan, attack: 0.004 });
      this.nextCricket = now + 0.7 + Math.random() * 0.8;
    }
    if (now > this.nextBird) {
      if (this.nextBird > 0) {
        const birds: BirdCall[] = ['cardinal', 'dove', 'woodpecker', 'towhee'];
        const bird = birds[Math.floor(Math.random() * birds.length)];
        birdCall(new Synth(this.ctx, this.gain, now + 0.05), bird, 0.022 * (1 - this.dusk * 0.6), Math.random() * 1.6 - 0.8);
      }
      this.nextBird = now + 7 + Math.random() * 10;
    }
    if (this.mode === 'day' && this.fireLevel > 0.02 && now > this.nextCrackle) {
      const s = new Synth(this.ctx, this.gain, now + 0.02);
      for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) {
        s.noise({ at: Math.random() * 0.12, dur: 0.012, vol: 0.05 * this.fireLevel, pan: Math.random() * 1.2 - 0.6, filter: { type: 'highpass', freq: 2200 + Math.random() * 3000 } });
      }
      this.nextCrackle = now + 0.05 + Math.random() * 0.25 / Math.max(0.2, this.fireLevel);
    }
    if (this.mode === 'home' && now > this.nextBubble) {
      // Hydroponic jars bubbling softly.
      const s = new Synth(this.ctx, this.gain, now + 0.05);
      for (let i = 0; i < 3; i++) {
        const f = 500 + Math.random() * 500;
        s.tone({ at: i * 0.09, freq: f, to: f * 1.6, dur: 0.05, vol: 0.05 });
      }
      this.nextBubble = now + 4 + Math.random() * 6;
    }
  }
}
