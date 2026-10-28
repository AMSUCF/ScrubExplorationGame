// The game's audio engine: music, ambience and sound effects on separate buses, started on the
// first tap (browsers require a gesture), paused when the tab is hidden.
import { Ambience, AmbienceMode } from './ambience';
import { MusicPlayer, ThemeId } from './music';
import { SFX, SfxName } from './sfx';
import { Synth } from './synth';
import { AnimalId, RobotMood, animalCall, robotVoice } from './voices';

const SETTINGS_KEY = 'scrubbot.audio';

interface Settings {
  music: boolean;
  sfx: boolean;
}

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { music: true, sfx: true, ...JSON.parse(raw) };
  } catch {
    // Storage unavailable — use defaults.
  }
  return { music: true, sfx: true };
}

export interface PlayOpts {
  vol?: number;
  pan?: number;
  delay?: number;
}

class AudioEngine {
  private ctx: AudioContext | null = null;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  private ambBus!: GainNode;
  private musicPlayer!: MusicPlayer;
  private ambience!: Ambience;
  private motorGain!: GainNode;
  private settings = loadSettings();
  private wantTheme: ThemeId | null = null;
  private wantAmbience: AmbienceMode = 'off';
  private listeners = new Set<() => void>();

  /** Create / resume the context. Call from a user gesture. */
  unlock(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      const ctx = new Ctor();
      this.ctx = ctx;
      const master = ctx.createDynamicsCompressor();
      master.threshold.value = -14;
      master.ratio.value = 3;
      master.connect(ctx.destination);
      this.musicBus = ctx.createGain();
      this.sfxBus = ctx.createGain();
      this.ambBus = ctx.createGain();
      for (const b of [this.musicBus, this.sfxBus, this.ambBus]) b.connect(master);
      this.musicPlayer = new MusicPlayer(ctx, this.musicBus);
      this.ambience = new Ambience(ctx, this.ambBus);

      // Robot motor: a soft electric hum that follows driving speed.
      this.motorGain = ctx.createGain();
      this.motorGain.gain.value = 0;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 380;
      for (const [f, type] of [[72, 'sawtooth'], [109, 'triangle']] as [number, OscillatorType][]) {
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.value = f;
        o.connect(lp);
        o.start();
      }
      lp.connect(this.motorGain).connect(this.sfxBus);

      this.applySettings();
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) void this.ctx?.suspend();
        else void this.ctx?.resume();
      });
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    this.musicPlayer.play(this.settings.music ? this.wantTheme : null);
    this.ambience.setMode(this.wantAmbience);
  }

  get ready(): boolean {
    return !!this.ctx && this.ctx.state === 'running';
  }

  private applySettings(): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.musicBus.gain.setTargetAtTime(this.settings.music ? 0.8 : 0, now, 0.2);
    this.sfxBus.gain.setTargetAtTime(this.settings.sfx ? 1 : 0, now, 0.05);
    this.ambBus.gain.setTargetAtTime(this.settings.sfx ? 0.9 : 0, now, 0.2);
    this.musicPlayer.play(this.settings.music ? this.wantTheme : null);
  }

  private persist(): void {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
    } catch {
      // Not saved; fine for this session.
    }
    this.applySettings();
    this.listeners.forEach((fn) => fn());
  }

  get musicOn(): boolean {
    return this.settings.music;
  }

  get sfxOn(): boolean {
    return this.settings.sfx;
  }

  toggleMusic(): void {
    this.settings.music = !this.settings.music;
    this.persist();
  }

  toggleSfx(): void {
    this.settings.sfx = !this.settings.sfx;
    this.persist();
  }

  /** Quick mute for everything (HUD speaker button). */
  toggleAll(): void {
    const on = !(this.settings.music || this.settings.sfx);
    this.settings.music = on;
    this.settings.sfx = on;
    this.persist();
  }

  onChange(fn: () => void): void {
    this.listeners.add(fn);
  }

  private synth(opts: PlayOpts = {}): Synth | null {
    if (!this.ctx || !this.settings.sfx || this.ctx.state !== 'running') return null;
    let out: AudioNode = this.sfxBus;
    if (opts.vol !== undefined && opts.vol !== 1) {
      const g = this.ctx.createGain();
      g.gain.value = opts.vol;
      g.connect(this.sfxBus);
      out = g;
    }
    if (opts.pan) {
      const p = this.ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, opts.pan));
      p.connect(out);
      out = p;
    }
    return new Synth(this.ctx, out, this.ctx.currentTime + 0.01 + (opts.delay ?? 0));
  }

  sfx(name: SfxName, opts?: PlayOpts): void {
    const s = this.synth(opts);
    if (s) SFX[name](s);
  }

  robot(mood: RobotMood, opts?: PlayOpts): void {
    const s = this.synth(opts);
    if (s) robotVoice(s, mood);
  }

  animal(species: AnimalId, opts?: PlayOpts): void {
    const s = this.synth(opts);
    if (s) animalCall(s, species);
  }

  music(theme: ThemeId | null): void {
    this.wantTheme = theme;
    if (this.ctx) this.musicPlayer.play(this.settings.music ? theme : null);
  }

  ambient(mode: AmbienceMode): void {
    this.wantAmbience = mode;
    this.ctx && this.ambience.setMode(mode);
  }

  dusk(level: number): void {
    this.ctx && this.ambience.setDusk(level);
  }

  /** 0..1 driving speed → motor hum. */
  motor(level: number): void {
    if (!this.ctx) return;
    this.motorGain.gain.setTargetAtTime(level * 0.035, this.ctx.currentTime, 0.08);
  }
}

export const audio = new AudioEngine();
export type { AnimalId, RobotMood, SfxName, ThemeId };
