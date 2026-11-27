// Checks the live layer's synthetic microphone for free: a clip played with
// say() must reach the stream the app gets from getUserMedia. If this fails,
// a live run would only show "no transcripts" and cost money to find out.
import { test, expect, openApp } from './fixtures.js';
import { canSynthesizeSpeech, cough, installSpeechMicrophone, say } from './live/speech.js';

const AUDIBLE_PEAK = 0.05;
const SILENT_PEAK = 0.001;

test.skip(!canSynthesizeSpeech(), 'needs macOS `say` with the Paulina (Mexican Spanish) voice');

async function startMeter(page) {
  await page.evaluate(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const ctx = new AudioContext();
    await ctx.resume();
    const analyser = ctx.createAnalyser();
    ctx.createMediaStreamSource(stream).connect(analyser);
    const buffer = new Float32Array(analyser.fftSize);
    window.__meter = { peak: 0 };
    setInterval(() => {
      analyser.getFloatTimeDomainData(buffer);
      for (const v of buffer) window.__meter.peak = Math.max(window.__meter.peak, Math.abs(v));
    }, 20);
  });
}

const peak = (page) => page.evaluate(() => window.__meter.peak);

test.describe('speech microphone (live layer plumbing)', () => {
  test.beforeEach(async ({ page }) => {
    await installSpeechMicrophone(page);
    await openApp(page);
    await startMeter(page);
  });

  test('is silent until something is played', async ({ page }) => {
    await page.waitForTimeout(300);
    expect(await peak(page)).toBeLessThan(SILENT_PEAK);
  });

  test('carries a synthesized Spanish phrase', async ({ page }) => {
    await say(page, 'Hola, quiero un café, por favor.');
    expect(await peak(page)).toBeGreaterThan(AUDIBLE_PEAK);
  });

  test('carries a cough', async ({ page }) => {
    await cough(page);
    expect(await peak(page)).toBeGreaterThan(AUDIBLE_PEAK);
  });
});
