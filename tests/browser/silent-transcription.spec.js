// Stage 13a in the real app: when the transcription model silently returns
// nothing, the learner sees a warning that stays until they close it. The unit
// tests (realtime-session.test.js, helpers.test.js) cover the pieces; this
// checks they meet on screen. Playwright's clock skips the 10 s timeouts.
import { test, expect, openApp, seedConfig, startConversation } from './fixtures.js';
import { emitServerEvent, serverEvents } from './fake-openai.js';

const WARNING = /returned nothing for your last 2 turns/;
// Past session.js's TRANSCRIPT_TIMEOUT_MS (10 s).
const PAST_TRANSCRIPT_TIMEOUT_MS = 11_000;
// Far past any auto-dismissing toast (app.js uses 6 s for errors).
const LONG_AFTER_MS = 120_000;

test.describe('silent transcription warning (fake OpenAI)', () => {
  test.beforeEach(async ({ page, fakeOpenAI }) => {
    void fakeOpenAI;
    await page.clock.install();
    await seedConfig(page);
    await openApp(page);
    await startConversation(page);
  });

  const warning = (page) => page.locator('.toast.error', { hasText: WARNING });

  test('two turns with no transcription event show a warning that stays until closed', async ({ page }) => {
    await emitServerEvent(page, serverEvents.userAudioItem('item_1'));
    await emitServerEvent(page, serverEvents.userAudioItem('item_2'));
    await page.clock.runFor(PAST_TRANSCRIPT_TIMEOUT_MS);

    await expect(warning(page)).toHaveCount(1);
    await expect(warning(page)).toContainText('Settings → Advanced');
    await expect(warning(page)).toBeInViewport();

    await page.clock.runFor(LONG_AFTER_MS);
    await expect(warning(page)).toHaveCount(1);

    await warning(page).locator('.toast-close').click();
    await expect(warning(page)).toHaveCount(0);
  });

  test('is shown once per connection, however many turns go missing', async ({ page }) => {
    for (const id of ['item_1', 'item_2', 'item_3', 'item_4']) {
      await emitServerEvent(page, serverEvents.userAudioItem(id));
    }
    await page.clock.runFor(PAST_TRANSCRIPT_TIMEOUT_MS);
    await expect(page.locator('.toast.error')).toHaveCount(1);
  });

  test('turns that are transcribed, even as "" (a cough), raise no warning', async ({ page }) => {
    await emitServerEvent(page, serverEvents.userAudioItem('item_1'));
    await emitServerEvent(page, serverEvents.transcriptCompleted('item_1', 'Hola.'));
    await emitServerEvent(page, serverEvents.userAudioItem('item_2'));
    await emitServerEvent(page, serverEvents.transcriptCompleted('item_2', ''));
    await page.clock.runFor(PAST_TRANSCRIPT_TIMEOUT_MS);

    await expect(page.locator('.toast.error')).toHaveCount(0);
    await expect(page.locator('#conversation-history .user-message')).toHaveCount(1);
  });

  test('one missed turn alone raises no warning', async ({ page }) => {
    await emitServerEvent(page, serverEvents.userAudioItem('item_1'));
    await page.clock.runFor(PAST_TRANSCRIPT_TIMEOUT_MS);
    await expect(page.locator('.toast.error')).toHaveCount(0);
  });
});
