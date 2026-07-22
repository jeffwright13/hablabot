# Decisions

Append-only log of non-obvious architectural/design decisions. See `~/coding/CLAUDE.md` for the
convention this file follows.

## 2026-07-22 — Vitest chosen as the test runner (Issue #1)

Chose Vitest over Jest, matching the global CLAUDE.md default for JavaScript projects. Confirmed
against precedent in two sibling repos before deciding:

- `~/coding/krashen` — same shape of app (vanilla JS, no framework, browser-only), already uses
  Vitest. Directly reused its `package.json` script shape (`test` / `test:watch`) and
  `vitest.config.js` minimalism.
- `~/coding/retirement-scenario-explorer` — uses Jest instead, but its `jest.config.js` and GH
  Actions/Pages setup were still useful precedent (see below). Not a reason to switch off Vitest.

## 2026-07-22 — jsdom environment set globally, not per-file

The global CLAUDE.md convention is "jsdom per-file for modules that touch the DOM." That doesn't
quite fit here: every file under `js/` unconditionally does `window.HablaBotX = new Thing()` at
module-eval time (e.g. `js/vocabulary/spaced-repetition.js:372`), regardless of whether the file's
actual logic touches the DOM. Under Vitest's default `node` environment, `window` doesn't exist at
all, so importing *any* hablabot source file — even pure SM-2 math — throws immediately. Set
`environment: 'jsdom'` globally in `vitest.config.js` instead of per-file.

Independently confirmed this was the right call: `retirement-scenario-explorer`'s `jest.config.js`
also sets `testEnvironment: 'jsdom'` globally rather than per-file, for the same underlying reason
(needing `window` to exist at all).

## 2026-07-22 — Confirmed the CommonJS-shim interop works

Every `js/` file ends with a dual-export shim:
```js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SomeClass;
}
```
This was flagged as an open question (in a comment on Issue #1) whether Vitest's ESM `import` could
consume this cleanly, given `package.json` sets `"type": "module"`. Spiked with
`tests/spaced-repetition.test.js` — `import SpacedRepetition from '../js/vocabulary/spaced-repetition.js'`
works with no changes to the source file. No further source changes needed to make existing modules
testable.

## 2026-07-22 — Started versioning at 0.1.0

HablaBot has never had a version number (no prior `package.json`). Per the global CLAUDE.md
versioning philosophy ("start new projects at 0.1.0"), this is treated as the first version rather
than guessing a number that reflects how much is already built. Future bumps via `npm version
<patch|minor|major>`.

## 2026-07-22 — Skipped the pre-commit test-gate hook for now

Global CLAUDE.md asks whether to add a plain `.git/hooks/pre-commit` script or a framework (husky)
since this repo had neither. Decided to skip enforcement until there's more than one test file to
actually protect. `retirement-scenario-explorer`'s `.husky/pre-commit` + `lint-staged` config is the
reference to copy from if/when this is revisited.

## Deferred, noted for later (not blocking Issue #1)

- **IndexedDB isn't implement by jsdom.** `js/storage/database.js` calls `indexedDB.open(...)`
  directly; a jsdom-only environment can't run those tests as-is. Neither sibling repo's precedent
  covers this (`retirement-scenario-explorer` doesn't use IndexedDB at all). Will need a polyfill
  (e.g. `fake-indexeddb`) once test coverage expands to the database layer — out of scope for the
  first spike, which only covers `js/vocabulary/spaced-repetition.js`.
- **GH Actions (Issue #2) template**: `retirement-scenario-explorer`'s
  `.github/workflows/test.yml` (Node 18.x/20.x matrix, `npm ci` + `npm test` + coverage + codecov
  upload) is a solid starting template to adapt.
- **GH Pages (Issue #3)**: `retirement-scenario-explorer`'s Pages config is `build_type: "legacy"`,
  source = `main` branch root, no Action involved — confirms the zero-effort path works for a
  static, no-build app like HablaBot.

## 2026-07-22 — Vocabulary tracking regression fix (Issue #4): no confidence signal, so fixed quality score

Restoring the connection between live conversations and the SM-2 scheduler (`js/realtime/session-vocab-bridge.js`)
required one simplification from the pre-Realtime-API design. `ConversationEngine.evaluateResponseQuality()`
used to derive an SM-2 quality score (0-5) partly from a speech-recognition **confidence** value that
the old Web Speech API provided per result. The Realtime API's Whisper-based transcription
(`conversation.item.input_audio_transcription.completed`) doesn't expose any confidence score at all —
that signal is simply gone. Rather than fabricate one, `SessionVocabBridge` treats any target word
found in a user transcript as a successful use with a fixed quality score (4/5). This is a known
simplification, not a regression from feature parity — the old confidence-weighted score was never
a strong signal to begin with (Web Speech API confidence values are notoriously unreliable across
browsers). Revisit if a real correctness signal becomes available (e.g. a secondary model call
grading the transcript).

Also folded in while fixing this: `currentSession.conversationHistory` is now populated directly
inside the `onUserTranscript`/`onAITranscript` callbacks in `js/app.js`, rather than needing the
vocab bridge to own it — it turned out to be an independent gap (nothing populated it at all,
regardless of vocabulary matching) with a much simpler fix.

## 2026-07-22 — Fixed the empty "Spanish Voice" dropdown by repurposing it, not restoring it

Settings' voice-select dropdown was populated by `this.speechSynthesis.populateVoiceSelect(...)` —
`this.speechSynthesis` is never assigned anywhere in `HablaBotApp` (leftover reference to
`HablaBotSpeechSynthesis`, which `index.html` no longer loads since the Realtime API migration), so
the call silently no-op'd and the dropdown stayed empty.

Rather than resurrect the browser-`speechSynthesis`-based voice list (which no longer plays any
role — AI audio comes from the Realtime API's media track), repurposed the dropdown to select
among the Realtime API's own voices (`alloy, ash, ballad, cedar, coral, echo, marin, sage, shimmer,
verse` — confirmed directly against OpenAI's docs, `marin`/`cedar` recommended for best quality).
These are static, not device-dependent, so they're hardcoded `<option>`s in `index.html` rather
than populated by JS. Relabeled "Spanish Voice" → "AI Voice" since these are persona/timbre choices,
not language-specific — the model speaks whatever language it's instructed to, in whichever voice
is selected. New `config.js` setting: `realtimeVoice` (default `'alloy'`, matching the value that
was previously hardcoded in `app.js`'s `startConversation()`).

Deliberately left alone: the Speech Rate / Volume sliders in the same Settings section are the same
category of vestigial UI (the Realtime API has no equivalent "slow down the TTS" control — it's a
live audio stream, not a static request), but that wasn't the reported bug, so didn't expand scope
to fix them here.

## 2026-07-22 — OpenAI Realtime API schema migration (session.js) — mixed confidence

Manual testing surfaced a hard 404 on `connect()`: `POST /v1/realtime/sessions` returned
`Invalid URL (POST /v1/realtime/sessions)`. Not caused by either of the two fixes just merged —
OpenAI has migrated a substantial part of the Realtime API's schema since `session.js` was
originally written, unrelated to any HablaBot change. Verified against OpenAI's current docs
(`developers.openai.com/api/docs/guides/realtime-webrtc` and `realtime-conversations`) via several
targeted fetches, asking for verbatim code samples rather than paraphrases where possible. Two
confidence tiers:

**High confidence (confirmed via literal code samples in the docs):**
- Ephemeral token endpoint: `POST /v1/realtime/sessions` → `POST /v1/realtime/client_secrets`,
  with a nested `{ session: { type, model, audio: { output: { voice } } } }` body instead of a flat
  `{ model, voice }` one.
- Ephemeral token response field: `client_secret.value` → `value` (top-level).
- SDP exchange endpoint: `POST /v1/realtime?model=...` → `POST /v1/realtime/calls` (model is now
  set during the client_secrets request, not a query param here).
- Model name: `gpt-4o-realtime-preview` → `gpt-realtime-2.1`.
- Server event renames: `response.audio_transcript.delta`/`.done` →
  `response.output_audio_transcript.delta`/`.done`. `input_audio_buffer.speech_started`/`_stopped`,
  `session.created`/`.updated`, and `response.done` are unchanged.

**Best-effort / not confirmed verbatim — flag if transcripts silently stop working:**
- `session.update`'s nesting: top-level `modalities` → `output_modalities`; `voice`,
  `turn_detection`, and transcription config moved under nested `audio.output` / `audio.input`.
  The docs sample fetched showed `audio.input.turn_detection` with `"type": "semantic_vad"` — kept
  `server_vad` with the same threshold/prefix_padding_ms/silence_duration_ms fields HablaBot already
  used, since the docs didn't confirm whether `server_vad`'s granular fields still apply once
  nested, or whether `semantic_vad` is now expected instead. Went with the least-risky assumption
  (relocate, don't change semantics) rather than guess at a behavior change.
- `audio.input.transcription` field name: the docs sample didn't show transcription config at all,
  only turn_detection — this is a plausible-but-unconfirmed guess at the field name, ported from
  the old flat `input_audio_transcription`.
- The transcription-completed event itself was renamed from
  `conversation.item.input_audio_transcription.completed` to a generic `conversation.item.done`,
  and the docs didn't show its payload shape verbatim. `session.js`'s handler now listens for both
  event names, tries `msg.transcript` and a nested `msg.item.content[].transcript` guess, and
  `console.warn`s with the full message if neither matches — so a live test will surface a concrete
  payload to fix against, rather than silently dropping every user turn.

Filed as its own fix rather than folded into #4/#5 since it's unrelated API drift, not a HablaBot
bug per se.
