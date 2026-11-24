# HablaBot — Feature Spec

_Living document: how each feature behaves **today**. Edit the affected section in place in the
same commit as the code that changes it. Reasoning goes in `DECISIONS.md`; planned work goes in
`PLAN.md` and `TODO.md`. Last full review against the code: 2026-11-24._

---

## 1. Profiles

- A profile is a local learner identity: a name and an avatar, stored in `localStorage`
  (`hablabot_users`, with `hablabot_current_user` holding the active one). Managed by
  `js/utils/user-manager.js`.
- Each profile gets its own IndexedDB database (`{userId prefix}HablaBotDB`), opened by
  `HablaBotDB.init()` when the profile is selected.
- Settings (section 5) and the API key are **shared** by all profiles. There is one
  `hablabot-config` entry, not one per profile.
- **Known defect:** deleting a profile removes it from `localStorage` but leaves its IndexedDB
  database (vocabulary, sessions, transcripts) on disk, although the confirm dialog says all
  data is deleted. Fix planned in `PLAN.md`, Stage 5.

## 2. Conversation

### 2.1 Session setup
- **Scenario:** 16 options (`index.html` `#scenario-select`). Each maps to a Spanish scenario
  block in `js/ai/prompts.js` `getScenarioPrompts()`.
- **Difficulty:** beginner, intermediate or advanced. This sets the prompt's difficulty block
  and the turn-detection profile (2.3).
- **Session length:** 5–30 minutes in steps of 5. A countdown and progress bar run during the
  session, and **the session ends and saves automatically when the countdown reaches zero**
  (`app.js` `startSessionTimer()`).
- **Target words:** up to 5 words from the profile's vocabulary, filtered by difficulty
  (beginner = levels 1–2, intermediate = 3–4, advanced = 4–5) and by scenario (category or
  tag), then shuffled (`VocabularyManager.selectWordsForSession()`).

### 2.2 System prompt
`HablaBotPrompts.generateSystemPrompt(scenario, difficulty, targetWords)` joins five parts, in
this order:
1. the base persona (María: patient, implicit recasts, 1–2 sentence replies, Spanish only
   unless the learner is lost);
2. the scenario block;
3. the difficulty block;
4. a target-vocabulary block (only when there are target words), asking for each word to be
   used 2–3 times;
5. the session goals.

The prompt is sent once, in `session.update`, at connect time. It is never changed during a
session.

Open issue (`PLAN.md`, Stage 3): the persona says "española/latinoamericana" and its examples
mix Spain and Mexico. No accent or dialect is pinned.

### 2.3 Turn-taking
- Turn-taking is entirely server-side: the Realtime API's `server_vad`. There is no push-to-talk.
- Pause tolerance depends on difficulty (`js/realtime/turn-profiles.js`). `silence_duration_ms`
  is beginner 2200, intermediate 1500, advanced 1000. All levels use `threshold` 0.5 and
  `prefix_padding_ms` 300.
- The learner can interrupt the tutor (barge-in). The server handles this itself.

### 2.4 Live display and history
- The listening indicator follows VAD speech start and stop. The speaking indicator follows the
  first AI transcript delta through to `response.done`.
- The AI's text streams into `#ai-text` and is committed to the history once, when final. An
  identical consecutive final transcript is dropped (`_lastFinalAITranscript`).
- User transcripts come from `conversation.item.input_audio_transcription.completed` or
  `conversation.item.done`. Assistant-role items are skipped.
- Each turn is appended both to the on-screen history and to
  `currentSession.conversationHistory` (`{ speaker, text, timestamp }`).
- Target-word usage: each user transcript is matched case-insensitively against the target
  words (`SessionVocabBridge.trackUserTranscript()`), and the counts are saved with the session.

### 2.5 Ending and saving
- On **End Session** or timer expiry, `endConversation()` collects the word-usage counts, saves
  the session record to IndexedDB (`sessions` store), then disconnects.
- **Known defects (`PLAN.md`, Stage 5):** if the save throws, `disconnect()` is never reached and
  the mic stays live. On an *unexpected* disconnect once auto-reconnect has given up, the session
  is discarded without being saved.

### 2.6 Connection and recovery
- Connecting takes five steps (`js/realtime/session.js` `connect()`):
  1. exchange the API key for an ephemeral token (`POST /v1/realtime/client_secrets`);
  2. open the mic with `getUserMedia`, with echo cancellation, noise suppression and auto gain on;
  3. create an `RTCPeerConnection` with a Google STUN server;
  4. exchange SDP (`POST /v1/realtime/calls`);
  5. send `session.update` once the data channel opens.
- **Auto-reconnect:** losing the connection (peer `failed`, or `disconnected` for longer than a
  3 s grace period, or the data channel closing) triggers up to 5 reconnect attempts, 2 s apart,
  with no re-greeting. Each reconnect is a new server-side session, so **the model forgets
  earlier turns**. This happens mostly in Firefox (see `DECISIONS.md`, 2026-07-22, NAT
  root-cause entry).
- There are no request timeouts on either `fetch` in `connect()`.

## 3. Voice Output (TTS)

- **There is no separate TTS stage.** The Realtime model is speech-to-speech: it generates the
  audio itself, and the audio arrives as a WebRTC remote track played by an auto-created
  `<audio>` element. The on-screen AI text is a transcript *of* that audio.
- Controls:
  - `audio.output.voice` comes from Settings → AI Voice. There are 10 static OpenAI voices, the
    default is `alloy`, and the UI labels `marin` and `cedar` "recommended".
  - `audio.output.speed` is Settings → Speech Rate. The slider runs 0.5–1.5, and `session.js`
    clamps the value to the API's 0.25–1.5.
  - Volume is applied on the client as `audioEl.volume`, clamped to 0–1.
- Voice and speed changes apply to the **next** session, not to the one in progress.
- Replacing the voice with an external TTS provider (for example ElevenLabs) would mean changing
  the pipeline to a cascade, not changing a setting. The analysis and the evaluation plan are in
  `PLAN.md`, Stages 3, 6 and 7.

## 4. Speech Recognition

- Done server-side by the transcription model set in `session.update`
  (`audio.input.transcription`), with `language: 'es'`.
- A failed transcription (`conversation.item.input_audio_transcription.failed`) is logged to the
  console only. Nothing is shown to the learner.

## 5. Settings

Stored in `localStorage['hablabot-config']` (`js/utils/config.js`) and merged over the defaults
on load.

| Setting | UI | Used by the live app |
|---|---|---|
| `openaiApiKey` | Settings → API key and Test button (`GET /v1/models`) | Yes |
| `realtimeVoice` | Settings → AI Voice | Yes |
| `speechRate` | Settings → Speech Rate | Yes (as speed) |
| `speechVolume` | Settings → Volume | Yes |
| `elevenLabsApiKey`, `enableElevenLabs`, `speechLanguage`, `speechPitch`, `voiceIndex`, `apiTimeout`, `maxRetries`, `dataRetentionDays`, `conversationLogging`, `speechConfidenceThreshold`, `sessionLength`, `difficultyLevel`, `theme`, `language`, `enableOfflineMode`, `enableAnalytics` | None | **No.** These are leftovers, and `PLAN.md` Stage 5 removes them. |

The API key is saved only when **Test** succeeds.

## 6. Vocabulary

- Each profile has a plain word list: add, edit and delete; search; filter by category and
  difficulty; CSV import and export (`js/vocabulary/manager.js`). There is no mastery tracking
  and no scheduling (`DECISIONS.md`, 2026-07-23).
- The list feeds the target-word selection described in 2.1.

## 7. AI Models

Every model ID the app sends. **These change often.** Before any model-related work, check the
provider's deprecations page and update this table, including the date checked.

| Role | Model ID | Where it's set today | Last checked against provider docs |
|---|---|---|---|
| Realtime conversation (speech-to-speech) | `gpt-realtime-2.1` | Hardcoded in `session.js` `connect()` (`app.js` never passes `options.model`) | 2026-07-22 (`DECISIONS.md`) |
| Input transcription | `gpt-4o-transcribe` | Hardcoded in `session.js` `session.update` | 2026-07-22 (`DECISIONS.md`) |
| (orphaned) chat completions | `gpt-4` | `js/ai/conversation.js`, never called | n/a, to be deleted |

Context: OpenAI announced on 2026-10-14 that GPT-4o, GPT-4o mini, GPT-4.1 and GPT-4.1 mini will
be removed from the API on 2027-01-14 (recorded in `krashen`'s DECISIONS, 2026-10-15). Whether
that affects `gpt-4o-transcribe` has **not been checked**. `PLAN.md` Stage 2 checks it and moves
every ID into a single registry module, with Settings overrides and migration of retired IDs
when settings load.

## 8. Offline / PWA

- `sw.js` caches the app on install and serves it network-first, falling back to the cache only
  when offline. It never touches `api.openai.com` or `api.elevenlabs.io`.
- `STATIC_CACHE_URLS` must list every script `index.html` loads. This is enforced by
  `tests/sw-precache.test.js`. Bump `CACHE_NAME` whenever that list changes.
- PWA icons are missing; `assets/icons/` holds only a placeholder.

## 9. Version Display

- The header shows `v<version>` next to the title, read at runtime from `./package.json`
  (`js/utils/version.js`, the apg-web pattern). If the fetch fails, the `v?.?.?` placeholder
  stays. `package.json` is precached so the label also works offline.
- The label is white text on a translucent dark pill, giving 6.2:1 to 8.2:1 contrast across the
  header gradient. It must stay at or above WCAG AA's 4.5:1 for small text, which
  `tests/version-label-contrast.test.js` enforces.
- The version changes only through `npm version <patch|minor|major>`.
