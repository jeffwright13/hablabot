// The live layer's "learner": synthesized Spanish played into the app as its
// microphone.
//
// Why not Chromium's --use-file-for-fake-audio-capture: on macOS, every
// Playwright-launched browser (bundled Chromium, headed or headless, and
// installed Chrome) left getUserMedia pending forever, fake devices included,
// apparently on the OS microphone-permission check (2026-11-27). Instead an
// init script replaces getUserMedia with a stream from a Web Audio graph in
// the page, and tests play each clip into it on cue. The real WebRTC
// connection sends that stream to OpenAI exactly as it would a microphone.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// macOS's Mexican Spanish voice; the app pins Mexican Spanish (PLAN Stage 3a).
const VOICE = 'Paulina';
const SAMPLE_FORMAT = 'LEI16@24000'; // 16-bit PCM, 24 kHz mono
const CACHE_DIR = fileURLToPath(new URL('./.audio/', import.meta.url));
const SPEECH_ROUTE = '/__speech/';

export function canSynthesizeSpeech() {
  if (process.platform !== 'darwin') return false;
  try {
    return execFileSync('say', ['-v', '?'], { encoding: 'utf8' }).includes(VOICE);
  } catch {
    return false;
  }
}

/** Render a phrase to a cached WAV (keyed by voice and text); returns its file name. */
export function synthesize(text) {
  mkdirSync(CACHE_DIR, { recursive: true });
  const name = `${createHash('sha256').update(`${VOICE}\n${text}`).digest('hex').slice(0, 16)}.wav`;
  const path = join(CACHE_DIR, name);
  if (!existsSync(path)) {
    execFileSync('say', ['-v', VOICE, '--file-format=WAVE', `--data-format=${SAMPLE_FORMAT}`, '-o', path, text]);
  }
  return name;
}

// Runs inside the page before any app script (serialized by Playwright).
function speechMicrophoneInitScript() {
  let context;
  let destination;
  function graph() {
    if (!context) {
      context = new AudioContext();
      destination = context.createMediaStreamDestination();
    }
    return { context, destination };
  }

  navigator.mediaDevices.getUserMedia = async () => {
    const { context: ctx, destination: dest } = graph();
    await ctx.resume();
    return dest.stream;
  };

  async function play(buffer) {
    const { context: ctx, destination: dest } = graph();
    await ctx.resume();
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(dest);
    await new Promise((resolve) => {
      source.onended = resolve;
      source.start();
    });
  }

  window.__speech = {
    async say(url) {
      const { context: ctx } = graph();
      const bytes = await (await fetch(url)).arrayBuffer();
      await play(await ctx.decodeAudioData(bytes));
    },
    // A cough-like burst: decaying noise, no words.
    async cough(seconds = 0.4) {
      const { context: ctx } = graph();
      const buffer = ctx.createBuffer(1, Math.round(ctx.sampleRate * seconds), ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) {
        data[i] = (Math.random() * 2 - 1) * 0.6 * Math.exp(-4 * (i / data.length));
      }
      await play(buffer);
    },
  };
}

/** Install the speech microphone and serve cached clips under SPEECH_ROUTE. */
export async function installSpeechMicrophone(page) {
  await page.route(`**${SPEECH_ROUTE}*`, (route) => {
    const name = new URL(route.request().url()).pathname.slice(SPEECH_ROUTE.length);
    if (!/^[0-9a-f]{16}\.wav$/.test(name)) return route.abort();
    return route.fulfill({ status: 200, contentType: 'audio/wav', body: readFileSync(join(CACHE_DIR, name)) });
  });
  await page.addInitScript(speechMicrophoneInitScript);
}

/** Speak a phrase into the app's microphone; resolves when the clip ends. */
export function say(page, text) {
  const name = synthesize(text);
  return page.evaluate((url) => window.__speech.say(url), `${SPEECH_ROUTE}${name}`);
}

export function cough(page) {
  return page.evaluate(() => window.__speech.cough());
}

