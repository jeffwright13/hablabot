# HablaBot — Implementation Plan

_Staged, reversible plan from the 2026-11-24 architecture/TTS review. Each stage gets its own
branch and PR, is test-driven (failing test first), and updates its docs in the same commit as
its code. Mark stages done here as they merge, and move the reasoning into `DECISIONS.md`._

**Status key:** ✅ done · 🔨 in progress · ⏸ blocked on a question in `TODO.md` · ⬜ not started

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

## Stage 3 — Voice A/B and prompt ⬜ (unblocked: dialect is **Mexican Spanish**)

Split into two parts, because the dialect is decided but the voice isn't:

**3a. Pin the dialect (ready to build).**
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

**3b. Choose the voice (waits for the listening comparison).**
0. With no code change, and after 3a lands, listen to `alloy`, `marin` and `cedar` at speeds 0.9
   and 1.0 in Chrome, on the same scenario. Then answer the postponed "what sounds wrong"
   question in `TODO.md`.
1. `config.js`: change the default voice to whichever wins (test in `config.test.js`).

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
- Remove the dead code and settings. The exact list will be confirmed before deleting:
  `js/speech/*`, `js/utils/audio.js`, and the unused config keys (SPEC §5).
- Fix the "Hold the microphone button" toast and escape the profile-card fields.

## Stage 6 — External TTS spike ⏸ (`experiment/external-tts`; key-handling answer needed)

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
