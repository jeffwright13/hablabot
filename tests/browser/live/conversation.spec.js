// LIVE: a real conversation with the OpenAI Realtime API. A synthesized
// Mexican Spanish voice is the learner. Costs a few cents per run; never run
// in CI. Needs OPENAI_API_KEY in the environment (see docs/TESTING.md).
//
// The key goes from the environment into the page's localStorage and is
// never written anywhere else: the live project records no traces, because a
// trace would contain the token request's Authorization header.
import { test, expect, openApp, seedConfig, startLiveConversation } from './live-fixtures.js';
import { cough, say } from './speech.js';
import { countReceived, sentOfType, waitForReceived } from './realtime-recorder.js';

const TURN_TIMEOUT_MS = 45_000;
// Longer than session.js's 10 s transcript timeout, so a missing transcript
// would have had time to show up as a warning.
const AFTER_COUGH_WAIT_MS = 15_000;

const LEARNER_TURNS = [
  'Hola, buenas tardes.',
  'Quiero un café con leche, por favor.',
  '¿Cuánto cuesta una torta de jamón?',
  'Muchas gracias, eso es todo.',
];

test('default models: every spoken turn is transcribed, a cough raises no warning', async ({ page }) => {
  await seedConfig(page, { openaiApiKey: process.env.OPENAI_API_KEY });
  await openApp(page);
  await startLiveConversation(page);

  // The tutor greets first.
  await waitForReceived(page, 'response.done', 0, TURN_TIMEOUT_MS);

  for (const phrase of LEARNER_TURNS) {
    const transcripts = await countReceived(page, 'conversation.item.input_audio_transcription.completed');
    const replies = await countReceived(page, 'response.done');
    await say(page, phrase);
    await waitForReceived(page, 'conversation.item.input_audio_transcription.completed', transcripts, TURN_TIMEOUT_MS);
    await waitForReceived(page, 'response.done', replies, TURN_TIMEOUT_MS);
  }

  await cough(page);
  await page.waitForTimeout(AFTER_COUGH_WAIT_MS);

  const [update] = await sentOfType(page, 'session.update');
  const defaults = await page.evaluate(() => ({
    voice: window.HablaBotModels.DEFAULT_VOICE,
    transcription: window.HablaBotModels.resolveModels({}).transcription,
  }));
  expect(update.session.audio.output.voice).toBe(defaults.voice);
  expect(update.session.audio.input.transcription.model).toBe(defaults.transcription);

  // A cough may come back as a short transcript of its own, so "at least".
  const userMessages = page.locator('#conversation-history .user-message');
  expect(await userMessages.count()).toBeGreaterThanOrEqual(LEARNER_TURNS.length);
  await expect(userMessages.nth(1)).toContainText(/caf[ée]/i);
  await expect(page.locator('.toast.error')).toHaveCount(0);

  await page.locator('#end-session').click();
  const [saved] = await page.evaluate(() => window.HablaBotApp.database.getRecentSessions(1));
  const savedUserTurns = saved.conversationHistory.filter((turn) => turn.speaker === 'user');
  expect(savedUserTurns.length).toBeGreaterThanOrEqual(LEARNER_TURNS.length);
});
