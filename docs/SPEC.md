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
- **Target words: none while vocabulary practice is hidden** (`vocabularyEnabled: false`, the
  default; §6). With the flag on: up to 5 words from the profile's vocabulary, filtered by
  difficulty (beginner = levels 1–2, intermediate = 3–4, advanced = 4–5) and by scenario
  (category or tag), then shuffled (`VocabularyManager.selectWordsForSession()`). That
  selection is buggy; see PLAN Stage 8.

### 2.2 System prompt
`HablaBotPrompts.generateSystemPrompt(scenario, difficulty, targetWords)` joins six parts, in
this order:
1. the base persona (María: patient, implicit recasts, 1–2 sentence replies, Spanish only
   unless the learner is lost);
2. the dialect block (`getDialectPrompt()`; see Dialect below);
3. the scenario block;
4. the difficulty block;
5. a target-vocabulary block (only when there are target words), asking for each word to be
   used 2–3 times. A target word from another region (e.g. "coche") is used exactly as listed,
   with the Mexican equivalent mentioned once ("aquí en México decimos carro"). This was the
   user's choice (PR #18 review);
6. the session goals.

The prompt is sent once, in `session.update`, at connect time. It is never changed during a
session.

**Dialect: Mexican Spanish** (DECISIONS 2026-11-24; implemented in PLAN Stage 3a).
- Every system prompt includes `getDialectPrompt()`. It asks for a consistent central-Mexican
  accent, seseo, "ustedes" for the plural you, and Mexican vocabulary (celular, carro,
  departamento, renta, recámara, colonia, mesero/a, platillo…). When the learner uses a word from
  another region, the tutor understands it and recasts with the Mexican word.
- The persona is "auténticamente mexicana", and the scenario text and examples use Mexican
  settings and vocabulary. So do the conversation starters (`getAllConversationStarters()`), but
  **the starters are never sent to the model**. Nothing outside `prompts.js` calls them, and the
  live opening line comes from the model via each scenario's `INICIO:` instruction. The same is
  true of `generateFollowUp()` and `getVocabularyIntegration()`.
- `tests/prompts.test.js` checks every system prompt and starter for:
  - the instruction being present;
  - no "España" or "español/latinoamericano" wording;
  - no vosotros forms (using Unicode-aware word boundaries);
  - no Spain terms camarero/a, estancia, alquiler, fianza or apartamento.
- **Live check (user, 2026-11-24):** one conversation "seems OK", but the user notes it's hard to
  judge at their level of Spanish. Not yet confirmed by a fluent listener. See the seseo check in
  `TESTING.md`.

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
    default is `alloy`, and the UI labels `marin` and `cedar` "recommended". In the 2026-11-24
    live test the user found all three acceptable; the default may change (PLAN Stage 3b).
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
- The transcription model comes from the registry (§7). It is currently `gpt-4o-transcribe`, which
  is deprecated.
- A failed transcription (`conversation.item.input_audio_transcription.failed`) is logged to the
  console only. The exception is a failure that names the transcription model, which means every
  turn will fail: that one is shown to the learner once per connection (§7, Error handling).
- **A transcription model this session type doesn't support fails silently** (live test,
  2026-11-24, `gpt-transcribe` and `gpt-live-transcribe`). `session.update` is accepted, the
  tutor still hears and answers, but every user item has `transcript: null` and no `completed`,
  `failed` or `error` event arrives, so the learner's turns never reach the history. Nothing
  detects this yet (PLAN Stage 13a).

## 5. Settings

Stored in `localStorage['hablabot-config']` (`js/utils/config.js`) and merged over the defaults
on load.

| Setting | UI | Used by the live app |
|---|---|---|
| `openaiApiKey` | Settings → API key and Test button (`GET /v1/models`) | Yes |
| `realtimeVoice` | Settings → AI Voice | Yes |
| `speechRate` | Settings → Speech Rate | Yes (as speed) |
| `speechVolume` | Settings → Volume | Yes |
| `vocabularyEnabled` | None (feature flag; console only) | Yes: `false` hides vocabulary practice (§6) |
| `models` (`{ realtime, transcription }`) | Settings → Advanced: AI Models. Blank means the registry default (§7) | Yes |
| `elevenLabsApiKey`, `enableElevenLabs`, `speechLanguage`, `speechPitch`, `voiceIndex`, `apiTimeout`, `maxRetries`, `dataRetentionDays`, `conversationLogging`, `speechConfidenceThreshold`, `sessionLength`, `difficultyLevel`, `theme`, `language`, `enableOfflineMode`, `enableAnalytics` | None | **No.** These are leftovers, and `PLAN.md` Stage 5 removes them. |

The API key is saved only when **Test** succeeds.

## 6. Vocabulary (hidden; planned to return in PLAN Stage 8 ⭐)

- **Hidden since 2026-11-24** behind `vocabularyEnabled` (default `false`, `js/utils/features.js`):
  - the Vocabulary tab and view are hidden, and `switchView('vocabulary')` is a no-op;
  - the session view's "0/5 words" counter is hidden (it never updated anyway; PLAN Stage 8);
  - an empty word list no longer counts toward "first-time user" (`isFirstTimeUser()`);
  - sessions get no target words, so there's no target-vocabulary prompt block and no word
    tally.
- **Kept:** all the code, and each profile's saved words in IndexedDB. Setting the flag to
  `true` (console: `HablaBotConfig.set('vocabularyEnabled', true)`, then reload) restores the
  previous behavior, bugs included.
- **When enabled:** each profile has a plain word list with add, edit and delete, and CSV import
  and export (`js/vocabulary/manager.js`). There is no mastery tracking or scheduling
  (DECISIONS 2026-07-23). The list feeds the target-word selection in 2.1.
- **Known bugs while enabled:**
  - selection rarely matches a scenario;
  - export downloads twice;
  - an export doesn't survive re-import;
  - switching profiles keeps the old list;
  - search and filters are unwired.

  PLAN Stage 8 has the details and the redesign.

## 7. AI Models

Every model ID the app sends lives in **one place**, `js/utils/models.js` (`HablaBotModels`).
**These change often.** Before any model-related work, re-read OpenAI's models and deprecations
pages (`developers.openai.com/api/docs/models`, `/api/docs/deprecations`), then update this table,
the registry's `MODELS_LAST_CHECKED`, and the tests.

| Role | Default ID | Status at last check | Last checked |
|---|---|---|---|
| `realtime`: speech-to-speech conversation (`/v1/realtime/calls`, WebRTC) | `gpt-realtime-2.1` | Current; not deprecated | 2026-11-24 |
| `transcription`: user-speech transcription inside that session (`audio.input.transcription`) | `gpt-4o-transcribe` | **Deprecated: shutdown 2027-02-26** (notice 2026-08-26) | 2026-11-24 |

### How the IDs are chosen
- `resolveModels(config.models)` returns the ID for each role, which `app.js` passes to
  `RealtimeSession.connect({ model, transcriptionModel })`. A Settings override wins when it is a
  non-blank string. Unknown IDs pass through unchanged, so a new model can be tried from Settings
  before the registry knows about it. `session.js` contains no IDs and falls back to the registry
  defaults if a caller passes none.
- **Retired IDs** (`RETIRED_MODELS`, an explicit list from the deprecations page) are replaced with
  their documented replacement, both when resolving and when settings load. On load the fix is
  saved straight back to `localStorage` (`Config.migrateRetiredModels()`). Covered today: the
  `gpt-4o-realtime-preview` family (shut down 2026-05-07), `gpt-realtime-mini-2025-10-06` (shut
  down 2026-07-23), and `gpt-realtime`, `gpt-realtime-2025-08-28`, `gpt-4o-realtime` and the
  `gpt-realtime-mini` variants (shutdown 2027-01-20). Mini models map to `gpt-realtime-2.1-mini`,
  the rest to `gpt-realtime-2.1`.
- **Shutdown tripwire:** `KNOWN_SHUTDOWNS` records announced dates for default models.
  `tests/models.test.js` fails, on every branch, once a default is within 30 days of its
  shutdown (for `gpt-4o-transcribe`, from 2027-01-27). Settings → Advanced also shows the date.

### Error handling
OpenAI doesn't document the error for a missing or retired model (checked 2026-11-24). When the
error names a `param`, it decides: the error is a model rejection only if `param` is that role's
model field (`model`/`*.model`; transcription when the path contains `transcription`). Any other
field, such as `…transcription.language`, passes through as-is. With no `param`, an error is a
model rejection if its message quotes the model ID. The learner then sees "<Role> model "<id>" was rejected by OpenAI (it may have been
retired or renamed): <OpenAI's message> Change it in Settings → Advanced." This covers the token
request, server `error` events, and transcription failures, which are reported once per
connection. Other errors are unchanged. **Not yet confirmed against a real rejection**; record
the real shape in DECISIONS when one is seen.

### The transcription replacement is an open decision
OpenAI names `gpt-live-transcribe` or `gpt-transcribe` as replacements, but neither works as a
drop-in for this app's session. That's per their model pages, and **confirmed by a live test on
2026-11-24** (both fail silently, see §4):
- `gpt-transcribe` works in a Realtime session only over WebSocket, with manual turn commits.
- `gpt-live-transcribe` and `gpt-realtime-whisper` work only in transcription-only sessions, and
  `gpt-live-transcribe` doesn't support server VAD.

`gpt-live-1.1` (a "full-duplex voice model for multilingual conversations") uses a different API,
`/v1/live/sessions`. The redesign options are in `PLAN.md` Stage 13.

The model-rejection message above covers only models the API *rejects*. One it accepts but
doesn't use for this session type gives no error (§4).

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
