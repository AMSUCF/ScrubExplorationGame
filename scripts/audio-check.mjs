// Renders every sound offline in a real browser (Web Audio), checks none is silent or clipping,
// and writes WAV previews to screenshots/audio/. Usage: npm run audio
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createServer } from 'vite';

const { chromium } = createRequire(import.meta.url)('playwright');
const OUT = 'screenshots/audio';
mkdirSync(OUT, { recursive: true });

const server = await createServer({ server: { port: 4180, strictPort: true }, logLevel: 'warn' });
await server.listen();
const browser = await chromium.launch();
let failed = false;
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => {
    console.error('page error:', e.message);
    failed = true;
  });
  await page.goto('http://localhost:4180/');
  const result = await page.evaluate(async () => {
    const { Synth } = await import('/src/audio/synth.ts');
    const { SFX } = await import('/src/audio/sfx.ts');
    const { robotVoice, animalCall } = await import('/src/audio/voices.ts');
    const { THEMES, renderStep } = await import('/src/audio/music.ts');
    const { birdCall } = await import('/src/audio/ambience.ts');
    const RATE = 44100;

    async function render(seconds, fn) {
      const ctx = new OfflineAudioContext(2, Math.ceil(seconds * RATE), RATE);
      const bus = ctx.createGain();
      bus.connect(ctx.destination);
      fn(ctx, bus);
      return ctx.startRendering();
    }
    const stats = (buf) => {
      let peak = 0;
      let sum = 0;
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) {
        peak = Math.max(peak, Math.abs(d[i]));
        sum += d[i] * d[i];
      }
      return { peak, rms: Math.sqrt(sum / d.length) };
    };
    const wav = (buf) => {
      const ch = [buf.getChannelData(0), buf.getChannelData(1)];
      const n = ch[0].length;
      const out = new DataView(new ArrayBuffer(44 + n * 4));
      const str = (o, s) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));
      str(0, 'RIFF'); out.setUint32(4, 36 + n * 4, true); str(8, 'WAVEfmt ');
      out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 2, true);
      out.setUint32(24, RATE, true); out.setUint32(28, RATE * 4, true); out.setUint16(32, 4, true); out.setUint16(34, 16, true);
      str(36, 'data'); out.setUint32(40, n * 4, true);
      for (let i = 0; i < n; i++) for (let c = 0; c < 2; c++) out.setInt16(44 + (i * 2 + c) * 2, Math.max(-1, Math.min(1, ch[c][i])) * 32767, true);
      let bin = '';
      const bytes = new Uint8Array(out.buffer);
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      return btoa(bin);
    };

    const report = {};
    const sounds = [
      ...Object.keys(SFX).map((k) => [`sfx:${k}`, (s) => SFX[k](s)]),
      ...['happy', 'love', 'sad', 'surprise', 'proud', 'question', 'curious', 'yawn', 'wake'].map((m) => [`robot:${m}`, (s) => robotVoice(s, m)]),
      ...['tortoise', 'mouse', 'jay', 'indigo', 'cat', 'tegu', 'iguana', 'anole'].map((a) => [`animal:${a}`, (s) => animalCall(s, a)]),
      ...['cardinal', 'dove', 'woodpecker', 'towhee'].map((b) => [`bird:${b}`, (s) => birdCall(s, b, 0.05, 0)]),
    ];
    for (const [name, fn] of sounds) {
      const buf = await render(3, (ctx, bus) => fn(new Synth(ctx, bus, 0.02)));
      report[name] = stats(buf);
    }

    // A sampler: a stretch of each theme with sounds dropped in, as one listenable file.
    const files = {};
    const sampler = async (themeId, seconds, extras) => {
      const th = THEMES[themeId];
      const buf = await render(seconds, (ctx, bus) => {
        let idx = 4;
        const eighth = 30 / th.bpm;
        for (let step = 0, t = 0.1; t < seconds - 2; step++, t += eighth) {
          renderStep(new Synth(ctx, bus, t + (step % 2 ? eighth * th.swing : 0)), th, step, idx, Math.random, (i) => (idx = i));
        }
        for (const [at, fn] of extras) fn(new Synth(ctx, bus, at));
      });
      report[`theme:${themeId}`] = stats(buf);
      files[`theme-${themeId}.wav`] = wav(buf);
    };
    await sampler('scrub', 26, [
      [3, (s) => robotVoice(s, 'happy')], [5, (s) => SFX.pull(s)], [7, (s) => SFX.scan(s)], [8.5, (s) => animalCall(s, 'jay')],
      [11, (s) => birdCall(s, 'cardinal', 0.04, -0.5)], [13, (s) => animalCall(s, 'tortoise')], [15, (s) => SFX.crate(s)],
      [15.3, (s) => animalCall(s, 'cat')], [18, (s) => SFX.rescue(s)], [20, (s) => robotVoice(s, 'love')], [22, (s) => birdCall(s, 'dove', 0.04, 0.4)],
    ]);
    await sampler('home', 22, [[4, (s) => SFX.water(s)], [8, (s) => SFX.pot(s)], [11, (s) => SFX.arrange(s)], [15, (s) => robotVoice(s, 'yawn')], [15.5, (s) => SFX.lullaby(s)]]);
    await sampler('intro', 12, [[0.2, (s) => SFX.whoosh(s)], [2, (s) => SFX.land(s)], [3.4, (s) => robotVoice(s, 'wake')]]);
    return { report, files };
  });

  for (const [name, { peak, rms }] of Object.entries(result.report)) {
    const bad = peak < 0.002 ? 'SILENT' : peak > 1.0 ? 'CLIPS' : '';
    if (bad) failed = true;
    console.log(`${bad ? '✗' : '✓'} ${name.padEnd(22)} peak ${peak.toFixed(3)}  rms ${rms.toFixed(4)} ${bad}`);
  }
  for (const [file, b64] of Object.entries(result.files)) writeFileSync(`${OUT}/${file}`, Buffer.from(b64, 'base64'));
  console.log(failed ? 'AUDIO CHECK FAILED' : `AUDIO OK — previews in ${OUT}/`);
} finally {
  await browser.close();
  await server.close();
}
process.exitCode = failed ? 1 : 0;
