// Fixtures for the live project: the real OpenAI API, the speech microphone,
// and the data-channel recorder. Every live test file imports from here, so
// the skip conditions and the no-trace rule apply to all of them.
import { test as base, expect, openApp, seedConfig } from '../fixtures.js';
import { canSynthesizeSpeech, installSpeechMicrophone } from './speech.js';
import { installRealtimeRecorder } from './realtime-recorder.js';

export const test = base.extend({
  // Runs for every live test before the page loads. A test that asks for
  // `liveSetup` gets { appLog }: the RealtimeSession: console lines so far.
  liveSetup: [async ({ page }, use, testInfo) => {
    await installSpeechMicrophone(page);
    await installRealtimeRecorder(page);
    const appLog = [];
    page.on('console', (message) => {
      if (message.text().startsWith('RealtimeSession:')) appLog.push(message.text());
    });
    // Tests may read session.js's log lines (no transcript text in them).
    await use({ appLog });
    if (testInfo.status !== testInfo.expectedStatus) {
      // What the connection did, without anyone's words or the key: event
      // types with counts, error messages, and session.js's own log lines.
      const summary = await page.evaluate(() => {
        const recorder = window.__realtimeRecorder;
        if (!recorder) return null;
        const count = (events) => events.reduce((acc, e) => ({ ...acc, [e.type]: (acc[e.type] || 0) + 1 }), {});
        return {
          sent: count(recorder.sent),
          received: count(recorder.received),
          errors: recorder.received.filter((e) => e.type === 'error').map((e) => e.error?.message),
        };
      }).catch(() => null);
      const toasts = await page.locator('.toast').allTextContents().catch(() => []);
      console.log('Live diagnostics:', JSON.stringify({ ...summary, toasts }, null, 2));
      console.log('session.js log:\n' + appLog.slice(-30).join('\n'));
    }
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
