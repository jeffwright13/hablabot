# HablaBot — Implementation Plan

_Staged, reversible plan from the 2026-11-24 architecture/TTS review. Each stage gets its own
branch and PR, is test-driven (failing test first), and updates its docs in the same commit as
its code. Mark stages done here as they merge, and move the reasoning into `DECISIONS.md`._

**Status key:** ✅ done · 🔨 in progress · ⏸ blocked on a question in `TODO.md` · ⬜ not started ·
⭐ prioritized for the near-to-mid term

---

## Up next (in order)

Updated 2026-11-24, after the live test (DECISIONS: neither transcription replacement works).

1. **Stage 13: transcription after `gpt-4o-transcribe`.** Deadline-driven: the model shuts down
   2027-02-26 and the tripwire fires 2027-01-27. First the silent-failure detection (13a), then
   the replacement design (13b).
2. **Stage 14: manual mic mute, with a hotkey.** Small, and it fixes a real annoyance from live
   use. It builds the mute mechanism that issue #9 needs too.
3. **Stage 15: session length to the minute.** Small; it can share a branch with Stage 14 or
   go straight after it.
4. **Stage 3b:** pick the default voice. A preference call; all three voices passed.
5. **Stage 3c:** prompt behavior. Add a repeat/slow-down rule, and settle the persona's name and
   gender.
6. **Stage 4:** time-to-first-audio metric.
7. **Stage 5:** data-loss fixes and cleanup, now including desktop toast styling. This also
   builds the `app.js` test harness, which Stage 8 needs.
8. ⭐ **Stage 8: bring vocabulary practice back.** It's hidden, not abandoned; see below.
9. **User-requested features:** Stage 9 (listening mode), Stage 10 (dialect selection), Stage
   11 (text input alongside voice), Stage 12 (performance feedback, opt-in). They're listed in
   the order requested; the user sets the order.
10. **Stages 6–7:** external TTS spike and evaluation. Deprioritized: the live test found the
   native voices acceptable. Revisit if voice quality becomes a complaint again.

---

## Background: what the review found

- **There is no TTS layer to swap.** Audio is the OpenAI Realtime model's own voice
  (speech-to-speech), delivered as a WebRTC track (`js/realtime/session.js`). An external TTS
  provider would mean a **cascade**: Realtime set to text-only output, then text deltas to the TTS
  provider, then client-side playback. That costs barge-in handling, possibly echo cancellation,
  and latency.
- **The seam is already partly there.** `app.js` sees only provider-neutral callbacks
  (`onAITranscript`, `onAIAudioStart`/`End`), so a provider change can stay inside
  `js/realtime/` plus a new TTS module.
- **The cheapest lever hasn't been tried.** The default voice is `alloy`, while Settings labels
  `marin` and `cedar` "recommended". The prompt mixes Spain and Mexico dialect cues.
- **Model IDs are hardcoded,** and OpenAI is retiring the GPT-4o and 4.1 families (announced
  2026-10-14, removal 2027-01-14).
- Confirmed defects: an unexpected disconnect discards the session unsaved; deleting a profile
  leaves its data; there is no time-to-first-audio metric; `app.js` has no tests; config keys and
  modules are dead.

Recommendation: **keep the architecture.** Add one narrow output seam only if the voice A/B test
(Stage 3) fails.

---

## Stage 0 — Project conventions ✅ (PR #14, released as v0.2.0)

### Scope
Bring the repo up to `~/coding/CLAUDE.md` and the `krashen` / `dreaming-tools` standards.

### Files
- `CLAUDE.md`: fix drift (script order, removed SM-2, model names); add the docs map, TDD rules,
  the model-ID rule, versioning and the decision-entry format.
- New: `docs/BRIEF.md`, `docs/SPEC.md`, `docs/PLAN.md`, `docs/TESTING.md`, `docs/TODO.md`,
  `PRIVACY.md`.
- `Requirements and Implemetation.md` → `docs/archive/` with a "superseded" banner.
- `js/utils/version.js` (new), plus changes to `index.html`, `css/main.css`, `js/app.js` and
  `sw.js` to show `v<version>` in the header.
- `.git/hooks/pre-commit` (local only; documented in `TESTING.md`).
- `README.md`: correct the session-length claim; add a docs map and a Testing section.

### TDD sequence
1. `tests/version.test.js`: shows the `package.json` version; keeps the placeholder when the
   fetch fails, the response is not ok, or the version field is missing; no-op without an element.
2. `tests/sw-precache.test.js`: the precache list covers every `<script src>` in `index.html`,
   includes `package.json`, and lists only files that exist. *On its first run this caught real
   drift: `js/ai/conversation.js` was loaded but not precached, so offline startup failed.*

### Done criteria
- The full suite passes with the hook active, and the docs build on each other without
  contradicting the code.
- Version bumped to `0.2.0` with `npm version minor` after merge, and the tag pushed.

## Stage 1 — Coverage baseline ✅ (PR #15)

- Add `@vitest/coverage-v8` (dev only) and a `test:coverage` script. Set thresholds in
  `vitest.config.js` at **today's measured** figures, rounded down, and raise them each stage
  toward dreaming-tools' 80/90.
- Add a coverage step to CI.
- Also: copy dreaming-tools' audit policy into CI (blocking `npm audit --omit=dev`, reported
  full audit), and ignore `coverage/`.
- Done when `npm run test:coverage` passes locally and in CI, and `TESTING.md` records the
  baseline. *Measured 2026-11-24: 30 / 78.37 / 35.82 / 30 globally, 94.53 / 87.06 / 83.33 / 94.53
  for `js/realtime/`.*
- **Every later stage** raises the `vitest.config.js` minimums to its new measurement in its
  final commit.

## Stage 2 — Model registry ✅ (PR #16, released as v0.3.0)

### Scope
Make model churn a one-line change plus a test.

### Steps
1. **Check first:** read OpenAI's current models and deprecations pages for `gpt-realtime-2.1`
   and `gpt-4o-transcribe`, and record the result in the `SPEC.md` §7 table with the date.
2. New `js/utils/models.js` (`window.HablaBotModels`) containing:
   - `DEFAULT_MODELS` by role: `realtime`, `transcription` (and later `tts`);
   - a `RETIRED_MODELS` map from old ID to replacement. It is an explicit map rather than
     krashen's name-matching regex, because a regex can catch IDs it shouldn't;
   - `resolveModels(overrides)`.
3. `config.js`: a `models` setting where blank means "use the default"; retired IDs are replaced
   inside `load()` (krashen's `migrateRetiredModels` pattern), and the fix is saved on the next
   write.
4. `app.js`: pass the resolved IDs to `connect()`. `session.js`: no model literals left; it uses
   `options.model` and `options.transcriptionModel`.
5. `session.js`: when `client_secrets` rejects a model, raise an error that names the model and
   points to Settings. Confirm the error shape from the docs or a live test.
6. Settings → Advanced: two optional text fields, with the defaults shown as placeholders.
7. Delete `js/ai/conversation.js` (orphaned, `gpt-4`), its init in `app.js`, its `<script>` tag
   and its precache entry.

### Tests first
- The registry's defaults.
- An override beats the default; a blank override falls back to the default.
- A retired stored ID is replaced on load, and the replacement persists after a save.
- An unknown or custom ID passes through unchanged.
- `session.js` sends whatever IDs it is given. Change `realtime-session.test.js:150` to stop
  checking for the literal `gpt-4o-transcribe` string.
- A rejected model produces the specific error message.

### Docs
DECISIONS entry; SPEC §5 and §7; CLAUDE.md model rule.

### Outcome (2026-11-24)
- The model check found `gpt-realtime-2.1` current and **`gpt-4o-transcribe` deprecated
  (shutdown 2027-02-26) with no documented drop-in replacement** for this session type. The
  defaults stay unchanged. The registry, Settings overrides and a 30-day shutdown tripwire make
  the eventual switch a one-line change, and the decision is in `TODO.md`.
- Added beyond the plan: `KNOWN_SHUTDOWNS` plus the tripwire test; the transcription-failure path
  in the rejection handling; and a fix for a latent shared-reference bug in
  `Config` defaults (`freshDefaults()`).
- Coverage minimums raised: global 36/80/43/36, `js/realtime/` 95/88/84/95.

## Stage 3 — Voice A/B and prompt 🔨 (3a ✅ in v0.4.0, accent confirmed live; 3b voices compared, default not yet chosen; 3c not started)

Split into two parts, because the dialect is decided but the voice isn't:

**3a. Pin the dialect ✅ (PR #18, released as v0.4.0).**
- `prompts.js`: replace the Spain or mixed cues with an explicit Mexican Spanish instruction
  (accent, seseo, `ustedes`, Mexican vocabulary). All five, as of 2026-11-24 (PR #17 review):
  - L18 persona: "Auténticamente española/latinoamericana"
  - L47 restaurant: "un restaurante español/latinoamericano"
  - L389 beginner: "Usa gestos descriptivos en el texto" (drop it: the model may speak stage
    directions aloud)
  - L418 intermediate example: "¿Ha probado la paella? Es un plato típico de España."
  - L503 travel opener: "¿Es su primer viaje a España?"
- Tests first in `prompts.test.js`, over every generated prompt (all scenarios × difficulties)
  and the conversation starters:
  - each contains the dialect instruction;
  - none says "española/latinoamericana" or "España", or contains the stage-direction
    instruction;
  - none contains vosotros forms. Use an explicit word list with **Unicode-aware boundaries**:
    `/(?<!\p{L})(vosotr[oa]s|os|habéis|tenéis|queréis|sois|estáis)(?!\p{L})/u`. Don't use
    `\b`: JavaScript's `\b` treats accented letters as non-word characters, and against today's
    prompts it falsely matches `os` in "cumpleaños" and "desafíos" (5 hits). The Unicode
    version finds 0.
- Live check: a few turns per difficulty, listening for a consistent Mexican accent.
- *Built 2026-11-24:* a vocabulary scan beyond the five listed cues also found camarero/a,
  estancia, and the whole apartment scenario (apartamento, alquiler, fianza, habitación,
  vecindario). These now use mesero/a, estadía, departamento, renta, depósito, recámara and
  colonia. The new test caught one more `fianza`, in an advanced starter.

**3b. Choose the voice 🔨 (comparison done 2026-11-24; default not yet chosen).**
0. ✅ Listening comparison. The user heard `alloy`, `marin` and `cedar` in live sessions (Firefox,
   v0.5.0) and found none of them bothersome (DECISIONS 2026-11-24). Not done: the separate 0.9
   vs 1.0 speed comparison. It didn't seem needed.
1. `config.js`: change the default voice from `alloy`, test first in `config.test.js`. The UI
   already labels `marin` and `cedar` "recommended", so one of them is the natural choice. It's
   the user's pick. Bear in mind 3c: the voice sets the persona's apparent gender.

**3c. Prompt behavior ⬜ (from the user's 2026-11-24 live session).**
- **Repeat/slow-down rule.** When the learner says "otra vez", "más despacio", "¿cómo?", "no
  entiendo" or similar, repeat the same idea more slowly, in shorter sentences with simpler
  words. Use English only as the last resort that base rule 1 already allows. In the live
  session the model did this on its own initiative; make it explicit. Tests first:
  `prompts.test.js` checks the rule is in every system prompt. Whether the model obeys can only
  be checked live (TESTING checklist). An automated version would need an evaluation harness
  (scripted learner turns against the real model, graded by a rubric), which is possible later
  but has a real cost.
- **Persona name and gender.** The base prompt says "Eres María", but every scenario says
  "Eres un/a vendedor/a…". With the Cedar voice the user got a male shopkeeper. Decide whether
  the name follows the selected voice, is dropped, or the scenarios use María's name.

## Stage 4 — Time-to-first-audio metric ⬜

- `session.js`: timestamp `input_audio_buffer.speech_stopped` and the first output signal (first
  transcript delta as a proxy; use a real "output audio started" event if the docs confirm one).
  Keep per-turn latency in the session record, and log p50 and p95 at the end of the session.
- Tests: simulated event sequences give the expected latencies; a turn with no reply produces no
  measurement; a barge-in doesn't corrupt the next turn's measurement.

## Stage 5 — Data-loss fixes and cleanup ⬜

- Build a minimal `tests/app.test.js` harness first: DOM from fixture HTML, stubbed
  `HablaBotDB` and `RealtimeSession`.
- Then, test first:
  - an unexpected disconnect saves the session before clearing it;
  - `endConversation()` disconnects even if the save throws;
  - deleting a profile deletes its IndexedDB database. Add `fake-indexeddb` as a dev dependency
    with approval, or inject `indexedDB.deleteDatabase`.
- **Not in scope here:** `js/vocabulary/*`, the vocabulary UI in `components.js`, and the
  session-vocab bridge. They're hidden, not dead; Stage 8 revives them.
- Remove the dead code and settings. The exact list will be confirmed before deleting:
  `js/speech/*`, `js/utils/audio.js`, the unused config keys (SPEC §5; **not** `sessionLength`,
  which Stage 15 puts to use), and the never-called
  `prompts.js` helpers `getConversationStarters()`/`getAllConversationStarters()`,
  `generateFollowUp()` and `getVocabularyIntegration()` (PR #18 review), along with the
  starter half of the dialect tests.
- Fix the "Hold the microphone button" toast and escape the profile-card fields.
- **Style toasts on desktop** (found 2026-11-24). Every `.toast`/`.toast-container` rule is
  inside `mobile.css`'s `@media (max-width: 768px)`, so on a desktop toasts, error toasts
  included, render as unstyled text at the bottom of the page. Add base rules (fixed position;
  success, warning and error colors). Test first by reading the CSS text, as
  `version-label-contrast.test.js` does: rules exist outside the media query, and each status
  color meets WCAG AA contrast in both color schemes.

## Stage 8 — Bring vocabulary practice back ⭐ ⬜ (near-to-mid term)

**Why it's hidden:** since 2026-11-24 it sits behind `vocabularyEnabled: false`
(`js/utils/features.js`; DECISIONS 2026-11-24). It was unfinished and buggy, and fixing it would
have pulled away from the voice work in progress. **The intent stays wanted:** a learner's own
words, worked into real conversation. All the code and every profile's saved words were kept.

**Redesign direction:** simpler and more direct than the old automatic selection.
- At session start, the learner **chooses a few words** to practice, or accepts suggestions,
  instead of the app silently picking at random by category.
- After the session, **show which ones they actually used**. The tally already exists in
  `session-vocab-bridge.js`; nothing displays it.
- Keep the #18 rule: a target word from another region is used as listed, with the Mexican
  equivalent mentioned once.

**Bugs to fix**, from the 2026-11-24 review. Each needs a test first:
1. **Selection:** a word qualifies only if `category === scenario`, but the category list
   (general, food, education…) mostly doesn't match the 16 scenarios, and the default "general"
   never matches. Needs a scenario-to-category mapping, with "general" eligible everywhere, or
   becomes moot under the redesign. `tests/vocabulary-manager.test.js` currently encodes the old
   rule.
2. **Export downloads twice:** `exportToCSV()` downloads the file itself and returns an object,
   and `app.exportVocabulary()` then downloads `[object Object]`.
3. **CSV round trip:** `H.parseCSV()` splits on every comma and keeps the quote marks, so
   re-importing an export corrupts words (and defeats the duplicate check). Verified with the
   real parser. Needs a quote-aware parser, and the exporter must escape embedded `"`.
4. **Switching profiles** re-opens the database but never reloads the in-memory word list.
5. **The search box and the category/difficulty filters** in the Vocabulary tab aren't wired to
   anything. The logic exists in the manager and is tested.
6. **The session view's "0/5 words" counter (`#words-practiced`) never updates.** The only code
   that rewrites it (`UIState.startConversation()` / `updateSessionProgress()`) has no callers in
   `app.js`. It's hidden while the flag is off (PR #19 review); wire it to
   `vocabBridge.getWordsUsed()` when the feature returns.
7. **Smaller issues:** the profile card's "N words" is always 0; editing a word skips the
   duplicate check.

**Done when:** the feature is re-enabled (flag default `true`, or the flag removed), the bugs
above are fixed with tests, the live checklist covers it, and SPEC §6 and the README describe
it again.

## Stage 9 — Listening mode ⬜ (user idea, 2026-11-24)
De-emphasize the **tutor's** text so the learner practices listening, like dreaming-tools'
subtitle de-emphasis but simpler, because the app already has the text.
- **Modes:** Off / Blur / Hidden, with reveal by tap or held key.
- **Scope:** applies to both the live streaming line (`#ai-text`) and the history. The
  learner's own transcript stays visible, as a check on what the model heard.
- **Accessibility:** revealed text must stay reachable by screen readers.
- **Build:** a small testable module (like `model-settings.js`) plus a CSS class, with jsdom
  tests.

## Stage 10 — Dialect selection ⬜ (user idea, 2026-11-24)
Choose Spain, Argentina, Peru, Puerto Rico and others, not just Mexico.
- **Registry:** turn `getDialectPrompt()` into one entry per dialect: accent instruction,
  vocabulary and its own test rules. Spain allows vosotros; Rioplatense needs voseo.
- **Choosing:** select the dialect at session start, like difficulty.
- **Work involved:** move the Mexican words now in the scenario texts into the dialect entries.
- **Caveat:** OpenAI's voices aren't regional, so accent quality varies by dialect and needs a
  native speaker's ear. This overlaps with Stage 7 (`gpt-live-1.1`'s claimed accent
  consistency).

## Stage 11 — Text input alongside voice ⬜ (user request, 2026-11-24)

**Why:** some learners are sometimes more comfortable typing than speaking. HablaBot stays
speaking-first (BRIEF); typing is an always-available alternative, not a replacement.

**What OpenAI's docs confirm** (Realtime conversations guide and client-events reference, read
2026-11-24):
- A typed user message can be added to the *live* voice session: `conversation.item.create`
  with `{ type: 'message', role: 'user', content: [{ type: 'input_text', text }] }`, then
  `response.create`.
- With the session's audio output, the tutor answers aloud as usual. This is implied by the
  guide rather than stated outright.
- To interrupt a reply in progress over WebRTC, send `response.cancel`, then
  `output_audio_buffer.clear`, which also truncates the conversation.

**11a. Hybrid: type or speak at any time (do first).** A text box under the conversation, with
the mic still live. There's no mode switch: the app knows which input was used from which one
arrived. This is the "dynamically deduced" option, and the docs make it nearly free.
- `session.js`: a new `sendText(text)` sends the two events above. If the tutor is speaking, it
  sends `response.cancel` and `output_audio_buffer.clear` first.
- `app.js`: show the typed message in the history right away, and save it in
  `conversationHistory` with `input: 'typed'` (spoken turns get `input: 'spoken'`).
- **Watch for:** the server echoes the typed item back (`conversation.item.added` / `.done`).
  The current user-transcript handler only reads `transcript` fields, so it shouldn't duplicate
  the message, but a test must prove it. If a later change makes it read `text`, deduplicate by
  item ID.
- Tests first: `sendText()` event shapes; cancel and clear only while the tutor is speaking;
  blank input ignored; no duplicate history entry from the echoed item; the wiring is a
  testable helper like `model-settings.js`.
- Live check: typed and spoken turns mixed in one session; typing while the tutor talks cuts
  her off cleanly.

**11b. Text-only session, no microphone (later, needs a live test).** For learners who'd rather
not grant mic permission, or who are somewhere they can't speak.
- **Not documented:** every WebRTC example adds a mic track. The likely approach is a
  receive-only audio transceiver (`pc.addTransceiver('audio', { direction: 'recvonly' })`) and
  `turn_detection: null`, but that must be live-tested.
- Chosen per session, like difficulty.

## Stage 12 — Performance feedback, opt-in ⬜ (user idea, 2026-11-24)

**Idea:** how quickly, and how accurately, the learner turns around replies, for both voice and
text input.
- **Speed (measurable):** response latency per turn, i.e. from the end of the tutor's speech to
  the learner starting to speak, or to the first keystroke and submit; typing speed. This
  reuses Stage 4's per-turn timestamps.
- **Accuracy (needs a definition first):** something has to judge the learner's Spanish.
  Candidates:
  - a post-session review of the transcript by a text model, which costs money and sends the
    transcript to OpenAI a second time (update PRIVACY);
  - counting the tutor's recasts.

  Pick and validate one before building anything.
- **Caution:** visible scores can raise anxiety, which works against the low-pressure practice
  HablaBot is for (BRIEF). So: **off by default, private, and shown as trends over sessions,
  not grades.**

## Stage 13 — Transcription after `gpt-4o-transcribe` ⬜ (deadline 2027-02-26; tripwire 2027-01-27)

The live test (DECISIONS 2026-11-24) showed that neither documented replacement works in this
app's WebRTC + server-VAD session, and that the failure is **silent**: no error, just
`transcript: null` on every user turn.

**13a. Make a silent transcription failure visible (first; small).** Tests first in
`realtime-session.test.js`, with simulated event sequences:
- After 2 consecutive user turns (VAD `speech_stopped` plus the user `conversation.item.done`)
  with no transcript within a timeout (to be named; ~10 s), notify the learner **once per
  connection**, naming the transcription model and pointing to Settings → Advanced. A
  transcript arriving resets the count; a late transcript just inside the timeout doesn't
  trigger it. Pass the timer in, as with `fetchFn`.
- Remove the "conversation.item.done had no recognizable transcript field" warning when the
  transcript is `null` (normal: it arrives later). Keep it for a genuinely unrecognized shape.
- Log the `session.updated` event's transcription settings, so a future live test shows
  whether the server kept the requested model.
- SPEC §4 and §7: document the silent-failure case and its detection.

**13b. Choose and build the replacement.** Re-read OpenAI's models, deprecations and Realtime
pages first (they change), then compare:
1. **A second, transcription-only Realtime session** fed the same mic track, using
   `gpt-live-transcribe` or `gpt-realtime-whisper` (the documented home for both). Costs a
   second connection and token per session; turns must be matched to the conversation's.
2. **A WebSocket `gpt-transcribe` session** with manual commits driven by the conversation's
   VAD events. Needs the app to stream audio over a WebSocket itself.
3. **Move the conversation to `gpt-live-1.1`** (`/v1/live/sessions`), which claims better
   transcription and a more consistent accent. Biggest change; evaluate with Stage 7.
4. **Wait for OpenAI** to support a replacement in WebRTC sessions. Only viable if it happens
   well before 2027-01-27; not a plan by itself.
Each candidate is live-tested in a spike branch before it's chosen. Record the choice in
DECISIONS, change `DEFAULT_MODELS.transcription` or the session design (with tests), and remove
the `KNOWN_SHUTDOWNS` entry only once the old model is no longer used.

## Stage 14 — Manual mic mute, with a hotkey ⬜ (user request, 2026-11-24)

**Why:** server VAD treats any sound as the learner starting to talk. Clearing your throat or
coughing makes the tutor (which backs off readily) stop mid-sentence and wait. The learner
usually feels it coming, so a mute they control beats tuning VAD.

**Mechanism:** set the mic track's `enabled` to `false`. WebRTC then sends silence, so the
server hears nothing and VAD doesn't fire. No API call, no reconnect, and the tutor keeps
talking. Muting during your own turn sends silence, which ends that turn as a normal pause would.

- `session.js`: `setMicMuted(muted)` and `isMicMuted()`, so `app.js` never reaches into
  `mediaStream`. The mute must **survive an auto-reconnect**: the new mic track starts muted if
  the learner had muted. Design it so issue #9's automatic mute during playback can share it:
  the mic is live only when neither the learner nor the automatic rule has muted it.
- UI: a mute button in the session view with an obvious muted state (icon plus text, not color
  alone; `aria-pressed`). Muting resets when a session ends.
- **Hotkey:** a toggle by default, assignable in Settings, saved in config. Ignore it while
  focus is in a text field, which Stage 11's text box makes matter. Default key to be decided
  with the user. Space is the obvious one but scrolls the page and clashes with typing; `M` is
  safer. A hold-to-mute variant (muted only while the key is held) suits throat-clearing and
  can be offered alongside.
- Tests first (`realtime-session.test.js`, plus a small pure keyboard-shortcut module so the
  key handling is testable without the `app.js` harness): mute disables every audio track and
  unmute restores it; mute before connect, after disconnect, and across a reconnect; the hotkey
  toggles, is ignored in inputs and with modifier keys, and a rebinding persists.
- Live check (TESTING): clear your throat while muted, and the tutor keeps talking.

**Related:** issue #9 (automatic mute during AI playback, as an echo workaround) uses the same
mechanism; do it here or straight after. **If built, it must be a Settings toggle, default
off** (user, 2026-11-24: "it might be lame"). It disables barge-in while the tutor talks, so
it's an escape hatch for setups without a headset, not a default. Issue #9 already proposes
exactly this, with the caveat shown next to the toggle.

## Stage 15 — Session length to the minute ⬜ (user request, 2026-11-24)

**Today:** a range slider on the start screen (`index.html` `#session-length`, 5–30 in steps of
5, default 15). The value isn't saved: `config.sessionLength` exists but nothing reads it, so
every reload goes back to 15. The user finds 5-minute steps too coarse, and a slider a poor
control for picking an exact number.

**Proposal:** replace the slider with a **number field in whole minutes**, with − and + buttons
for touch screens, and optionally a few one-tap presets (5 / 10 / 15 / 30).
- Range **1–60 minutes.** 60 is OpenAI's documented maximum Realtime session length (DECISIONS
  2026-07-22). Re-check that limit when building this; if it has changed, the cap changes with it.
- **Remember the last value** in `config.sessionLength` (wiring up the leftover key rather than
  deleting it). Change `validateSettings()` from 5–60 to 1–60, and remove the per-profile
  `sessionLength: 15` in `user-manager.js` unless per-profile lengths are wanted.
- Typed values are clamped and rounded on change (blank or invalid → the saved value), so the
  timer never gets `NaN`. Note: `parseInt` of an empty field is `NaN` in JS, not an error.
- Tests first: a small pure `parseSessionLength(input, fallback)` (bounds, decimals, blanks,
  non-numbers) and the config validation and persistence (`config.test.js`). The `app.js`
  wiring is a few lines; the timer's minute→second conversion is unchanged.
- SPEC §2.1 and §5 updated in the same commit.

## Stage 6 — External TTS spike ⏸ (`experiment/external-tts`; deprioritized 2026-11-24: native voices passed the live test)

- New `js/tts/<provider>.js`: streams text in and audio out, can be stopped, and reports
  time-to-first-byte.
- `session.js`: an `outputMode: 'native' | 'external'` option; `external` sets
  `output_modalities: ['text']` (check this is supported) and routes deltas to the TTS module.
  `app.js`'s callbacks don't change.
- `config.js`: a `ttsProvider` setting replaces the dead `enableElevenLabs`. TTS model and voice
  IDs go through the Stage 2 registry. `sw.js`: exclude the vendor's host if it's new.
- Tests: sentence chunking; stopping playback on `speech_started`; falling back to text-only when
  TTS fails; no audio after `disconnect()`.
- Risks to verify live: echo cancellation of non-WebRTC audio (issue #9's mic mute is the
  fallback), added latency, a second key in localStorage, Firefox connectivity.

## Stage 7 — TTS evaluation and decision ⬜

Compare these options. **Add `gpt-live-1.1`** (a full-duplex voice model on the separate Live
API), found during Stage 2. Its page claims more consistent accent and voice and more accurate
transcription, and it is also one route off the deprecated transcription model (`TODO.md`):
- the native Realtime voices, in live sessions;
- OpenAI's standalone TTS API, as a fixed-text proxy;
- the external provider, through the Stage 6 spike.

Test matrix (Spanish in the chosen dialect; speeds 0.75 / 0.9 / 1.0; Chrome and Firefox):
- slow beginner repetition;
- ¿…? intonation;
- the minimal pairs pero/perro, caro/carro and año/ano;
- numbers, prices, times and dates;
- regional foods and proper nouns;
- the learner's own target words;
- advanced subjunctive and conditional;
- switching to English mid-reply.

| Measure | Method |
|---|---|
| Pronunciation | Blind 1–5 rating by at least 2 native speakers of the target dialect |
| Intelligibility | Word error rate from transcribing the output and comparing it with the source text, plus a beginner dictation score |
| Latency | End of speech to first audible audio, p50 and p95 over at least 30 turns per configuration (uses Stage 4) |
| Consistency | Same text 5 times, checked for accent and voice drift within a 15-minute session |
| Error handling | Bad key, 429, mid-utterance network drop, TTS outage |
| Cost | Per 15-minute session: measured usage × **current published prices, checked at the time** |

Every vendor capability and price must be checked against current docs. The decision and the
evidence go in DECISIONS.
