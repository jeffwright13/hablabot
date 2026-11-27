// A whole conversation through the real app.js, session.js and UI, against
// the fake OpenAI layer. app.js has no unit tests (PLAN Stage 5); this is its
// first automated coverage.
import { test, expect, openApp, seedConfig, startConversation } from './fixtures.js';
import { emitServerEvent, emitServerEvents, sentEvents, serverEvents } from './fake-openai.js';

test.describe('conversation (fake OpenAI)', () => {
  test.beforeEach(async ({ page, fakeOpenAI }) => {
    void fakeOpenAI; // installs the fake before the page loads
    await seedConfig(page);
    await openApp(page);
  });

  test('connects with the registry defaults: marin and the default models', async ({ page, fakeOpenAI }) => {
    await startConversation(page);

    const defaults = await page.evaluate(() => ({
      voice: window.HablaBotModels.DEFAULT_VOICE,
      models: window.HablaBotModels.resolveModels({}),
    }));
    const token = fakeOpenAI.find((r) => r.path === '/v1/realtime/client_secrets');
    expect(JSON.parse(token.body).session).toMatchObject({
      model: defaults.models.realtime,
      audio: { output: { voice: defaults.voice } },
    });

    const [update] = await sentEvents(page, 'session.update');
    expect(update.session.audio.output.voice).toBe(defaults.voice);
    expect(update.session.audio.input.transcription.model).toBe(defaults.models.transcription);
  });

  test('shows the learner\'s and the tutor\'s turns, each once, with the right speaker', async ({ page }) => {
    await startConversation(page);

    await emitServerEvents(page, serverEvents.assistantTurn('¡Hola! ¿Qué te gustaría pedir?'));
    await emitServerEvent(page, serverEvents.userAudioItem('item_1'));
    await emitServerEvent(page, serverEvents.transcriptCompleted('item_1', 'Quiero un café, por favor.'));
    await emitServerEvents(page, serverEvents.assistantTurn('Claro, ¿con leche?'));

    const history = page.locator('#conversation-history');
    await expect(history.locator('.user-message')).toHaveCount(1);
    await expect(history.locator('.user-message')).toContainText('Quiero un café, por favor.');
    await expect(history.locator('.assistant-message')).toHaveCount(2);
    await expect(history.locator('.assistant-message').last()).toContainText('Claro, ¿con leche?');
  });

  test('End Session saves the transcript to the profile\'s database', async ({ page }) => {
    await startConversation(page);
    await emitServerEvent(page, serverEvents.userAudioItem('item_1'));
    await emitServerEvent(page, serverEvents.transcriptCompleted('item_1', 'Buenos días.'));
    await emitServerEvents(page, serverEvents.assistantTurn('¡Buenos días!'));

    await page.locator('#end-session').click();
    await expect(page.locator('#start-conversation')).toBeVisible();

    const [saved] = await page.evaluate(() => window.HablaBotApp.database.getRecentSessions(1));
    expect(saved.conversationHistory.map(({ speaker, text }) => ({ speaker, text }))).toEqual([
      { speaker: 'user', text: 'Buenos días.' },
      { speaker: 'assistant', text: '¡Buenos días!' },
    ]);
  });
});
