// LIVE, Stage 13a: transcription models that silently return nothing in this
// app's session must raise the on-screen warning. Costs a few cents per model;
// never run in CI (see docs/TESTING.md, layer 2).
//
// The assertion is the invariant, not a guess about OpenAI: if no user turn
// was transcribed, the warning is showing; if turns were transcribed, it isn't.
// The test log records which happened and what the server kept, so a model
// that starts working shows up as "transcribed" rather than as a failure.
import { test, expect, openApp, seedConfig, startLiveConversation } from './live-fixtures.js';
import { say } from './speech.js';
import { countReceived, waitForReceived, waitForTutorToFinish } from './realtime-recorder.js';

// The two documented successors. A Firefox live test on 2026-11-24 saw both
// produce no user transcripts; these Chrome runs saw both work (DECISIONS
// 2026-11-28). Kept as a regression check either way.
const SUSPECT_MODELS = ['gpt-transcribe', 'gpt-live-transcribe'];
const TURN_TIMEOUT_MS = 45_000;
// session.js's 10 s transcript timeout, plus margin.
const WARNING_WAIT_MS = 15_000;
const LEARNER_TURNS = ['Hola, buenas tardes.', 'Quiero un café con leche, por favor.'];

for (const model of SUSPECT_MODELS) {
  test(`transcription model ${model}: no transcripts means the warning shows`, async ({ page, liveSetup }) => {
    await seedConfig(page, { openaiApiKey: process.env.OPENAI_API_KEY, models: { realtime: '', transcription: model } });
    await openApp(page);
    await startLiveConversation(page);

    await waitForReceived(page, 'response.done', 0, TURN_TIMEOUT_MS);
    await waitForTutorToFinish(page, TURN_TIMEOUT_MS);
    for (const phrase of LEARNER_TURNS) {
      const replies = await countReceived(page, 'response.done');
      await say(page, phrase);
      // The tutor hears the learner whatever the transcription model does.
      await waitForReceived(page, 'response.done', replies, TURN_TIMEOUT_MS);
      await waitForTutorToFinish(page, TURN_TIMEOUT_MS);
    }
    await page.waitForTimeout(WARNING_WAIT_MS);

    // Counts only, never the words: completed (and how many had text), failed.
    const events = await page.evaluate(() => {
      const received = window.__realtimeRecorder.received;
      const completed = received.filter((e) => e.type === 'conversation.item.input_audio_transcription.completed');
      return {
        completed: completed.length,
        completedWithText: completed.filter((e) => (e.transcript || '').trim()).length,
        failed: received.filter((e) => e.type === 'conversation.item.input_audio_transcription.failed').length,
      };
    });
    const transcribed = events.completed + events.failed;
    const shownUserTurns = await page.locator('#conversation-history .user-message').count();
    const confirmed = liveSetup.appLog.find((line) => line.includes('server confirmed input transcription'));
    const warning = page.locator('.toast.error', { hasText: /returned nothing/ });
    console.log(`[${model}] ${confirmed ?? 'no session.updated line'}`);
    console.log(`[${model}] spoken turns: ${LEARNER_TURNS.length}; transcription events: ${JSON.stringify(events)}; `
      + `user turns on screen: ${shownUserTurns}; warning toasts: ${await warning.count()}`);

    if (transcribed === 0) {
      await expect(warning).toHaveCount(1);
      await expect(warning).toContainText(model);
    } else {
      await expect(warning).toHaveCount(0);
    }
  });
}
