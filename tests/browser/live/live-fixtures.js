// Fixtures for the live project: the real OpenAI API, the speech microphone,
// and the data-channel recorder. Every live test file imports from here, so
// the skip conditions and the no-trace rule apply to all of them.
import { test as base, expect, openApp, seedConfig } from '../fixtures.js';
import { canSynthesizeSpeech, installSpeechMicrophone } from './speech.js';
import { installRealtimeRecorder } from './realtime-recorder.js';

export const test = base.extend({
  // Runs for every live test before the page loads.
  liveSetup: [async ({ page }, use) => {
    await installSpeechMicrophone(page);
    await installRealtimeRecorder(page);
    await use();
  }, { auto: true }],
});

test.skip(!process.env.OPENAI_API_KEY, 'live tests need OPENAI_API_KEY in the environment');
test.skip(!canSynthesizeSpeech(), 'live tests need macOS `say` with the Paulina (Mexican Spanish) voice');
// A trace or screenshot could capture the API key (request headers, the
// Settings field). Keep nothing on disk.
test.use({ trace: 'off', screenshot: 'off', video: 'off' });

/** Start a conversation and wait until the real session is configured. */
export async function startLiveConversation(page) {
  await page.locator('#start-conversation').click();
  await page.waitForFunction(
    () => window.__realtimeRecorder.sent.some((e) => e.type === 'session.update'),
    null,
    { timeout: 30_000 },
  );
}

export { expect, openApp, seedConfig };
