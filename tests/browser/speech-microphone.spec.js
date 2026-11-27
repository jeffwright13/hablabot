// Checks the live layer's synthetic microphone for free: a clip played with
// say() must reach the stream the app gets from getUserMedia. If this fails,
// a live run would only show "no transcripts" and cost money to find out.
import { test, expect, openApp } from './fixtures.js';
import { canSynthesizeSpeech, cough, installSpeechMicrophone, say } from './live/speech.js';

const AUDIBLE_PEAK = 0.05;
// Between clips the mic carries faint room noise, never pure digital silence:
// a real microphone always picks up some, and the server's VAD needs audio to
// keep arriving to notice that the learner has stopped talking.
const ROOM_NOISE_MIN_PEAK = 0.0005;
const ROOM_NOISE_MAX_PEAK = 0.01;


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

  test('carries only faint room noise until something is played', async ({ page }) => {
    await page.waitForTimeout(300);
    const idlePeak = await peak(page);
    expect(idlePeak).toBeGreaterThan(ROOM_NOISE_MIN_PEAK);
    expect(idlePeak).toBeLessThan(ROOM_NOISE_MAX_PEAK);
  });

  // Only this test needs macOS; the rest is plain Web Audio and runs in CI.
  test('carries a synthesized Spanish phrase', async ({ page }) => {
    test.skip(!canSynthesizeSpeech(), 'needs macOS `say` with the Paulina (Mexican Spanish) voice');
    await say(page, 'Hola, quiero un café, por favor.');
    expect(await peak(page)).toBeGreaterThan(AUDIBLE_PEAK);
  });

  test('carries a cough', async ({ page }) => {
    await cough(page);
    expect(await peak(page)).toBeGreaterThan(AUDIBLE_PEAK);
  });
});
