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

## 2026-07-22 — Two more rounds of manual testing: unexpected-disconnect UX fixed, transcript still open

**Fixed:** the reported "froze after second reply" wasn't really a freeze — the connection was
dying (`ICE connection state -> disconnected`) and `app.js`'s `onStatusChange` only ever showed a
toast for `status === 'error'`. A natural disconnect goes to `'idle'` with zero user-facing
feedback, so from the user's side the app just silently stopped responding. `session.js`'s
`_setStatus` now takes a `meta` object; `dc.onclose` (the natural-disconnect path) passes
`{ unexpected: true }`, while the deliberate `disconnect()` method (user clicks "End Session") does
not — the two were previously indistinguishable from the callback's perspective. `app.js` now shows
a clear toast and resets to the setup screen when `meta.unexpected` is true, instead of leaving the
conversation-active screen showing with nothing responding.

**Still open, not chasing further right now:** transcript stayed `null` on every single user turn
across three different config attempts (nested `whisper-1`, flat field — rejected outright by the
API — nested `gpt-realtime-whisper`), including turns with a demonstrably stable connection. This
now matches what the community thread (linked in the earlier entry) described as an open, not
fully understood issue for other developers too, not something more field-name guessing is likely
to resolve. Leaving `gpt-realtime-whisper` in place as the most defensible current guess; Issue #4's
vocabulary-tracking bridge remains unable to fire in live sessions until this is actually resolved
(structurally ready, just never receives a non-null transcript to act on).

**Also observed, not yet fixed:** disconnects are happening fairly consistently after roughly 2
user turns across multiple fresh sessions — added `_connectedAt` timing + a
`console.warn` logging elapsed connected seconds on unexpected disconnect, specifically to find out
whether this is a fixed session/ephemeral-token lifetime limit (in which case the fix is proactive
reconnection/renewal, not more STUN/TURN work) versus ongoing network flakiness. Next manual test's
console output will have the actual elapsed-seconds figures to check this against.

## 2026-07-22 — Confirmed ~1 minute session cap; added transparent auto-reconnect

Manual testing measured a disconnect at **56.6s connected** — close enough to this file's own
original "60s TTL" comment (written before any of this session's changes, presumably reflecting
actual prior documentation for the old ephemeral-token endpoint) to treat as a real session/token
lifetime cap rather than coincidence, especially combined with how consistently every test so far
died after roughly 2 user turns (random network flakiness would vary more than that). Not
confirmed by OpenAI's current docs either way — a fetch asked directly about ephemeral token TTL
and session duration limits and came back with no information either way — so this is circumstantial
but strong evidence, not a documented fact.

Given the choice between (a) building true seamless renewal — proactive token refresh + ICE
restart before the cap hits, keeping one continuous connection — and (b) transparently starting a
brand-new session each time the old one drops, chose (b): asked the user directly given the real
scope difference between the two, and (b) is meaningfully simpler to build and verify correctly.

Implementation (`js/realtime/session.js`): `connect()` takes an internal `_isReconnect` flag and
remembers its own arguments (`_lastConnectArgs`) on a normal (non-reconnect) call. `_teardown()` is
a new private method factored out of the old `disconnect()` body — shared between a deliberate
user-initiated disconnect and the auto-reconnect path, since both need to release the mic/close the
peer connection, but only one of them should actually decide "give up" vs. "try again." `dc.onclose`
now retries up to 5 times with a 1s delay before falling back to the existing "unexpected disconnect"
UX from the previous entry. Reconnects always pass `autoGreet: false` regardless of the original
options, so the AI doesn't re-greet mid-conversation.

**Known limitation, inherent to choosing (b):** each reconnect is a genuinely new Realtime session
on OpenAI's side — same persona/instructions get resent, but the model has no memory of turns from
before the reconnect. There's no mechanism here to replay prior conversation history into the new
session (and no way to build one reliably right now anyway, since the transcript-null issue above
means user turns aren't even being captured as text to replay). If the null-transcript issue gets
resolved, revisit whether replaying history into each reconnected session is worth adding.

## 2026-07-22 — Auto-reconnect wasn't triggering: was listening to the wrong event

Manual testing showed `connectionState` reaching `'disconnected'` with `dc.onclose` **never
firing** — the log just stopped there, no reconnect attempt logged, matching the user's report of
still-truncated playback even with auto-reconnect in place. `RTCPeerConnection` reaching
`'disconnected'`/`'failed'` doesn't reliably or promptly trigger the data channel's `close` event;
they're not the same signal. Gating all recovery logic on `dc.onclose` alone left a real gap where
the connection was visibly dead but nothing reacted.

Extracted the teardown/reconnect decision out of `dc.onclose` into a shared `_onConnectionLost(reason)`,
now also called directly from `pc.onconnectionstatechange`: `'failed'` triggers it immediately
(unambiguous, terminal per the WebRTC spec); `'disconnected'` gets a 3-second grace period first,
since that state can be transient and self-recover without needing to reconnect at all. `dc.onclose`
still calls the same shared method, now just a backstop for a data-channel-specific failure that
doesn't show up as a connection-state change. Made `_onConnectionLost` idempotent (checks
`_connectedAt`/`isConnected` before doing anything) so redundant signals for the same drop — e.g. a
delayed `dc.onclose` arriving after `onconnectionstatechange` already handled it — don't
double-trigger teardown or stack up reconnect attempts.

## 2026-07-22 — Reconnect attempt itself failing (409) silently killed all remaining retries

Manual testing: reconnect triggered correctly this time (fixed by the previous entry), but the
reconnect's own SDP exchange got `409` from `POST /v1/realtime/calls` — plausibly OpenAI hadn't
finished releasing the previous (dead) call's resources yet, only ~1s after the drop was detected.
That 409 is a plausible, recoverable, transient condition, not a fatal error.

But it exposed a real bug in `connect()`'s `catch` block: it always called the public `disconnect()`
on any failure, which unconditionally clears `_lastConnectArgs` — so a reconnect attempt's own
failure silently killed every subsequent retry after just one try, instead of continuing up to
`_maxReconnectAttempts`. The log confirmed this exactly: "attempt 1/5" tried once, failed, and
nothing tried again despite 4 more attempts being budgeted.

Fixed: the catch block now calls `_teardown()` directly (leaves `_lastConnectArgs` alone) and, when
`_isReconnect` is true and attempts remain, retries the same way `_onConnectionLost` does, rather
than unconditionally giving up. Only clears `_lastConnectArgs` and surfaces a real user-facing
error/idle-unexpected status once genuinely out of attempts (or if it was the original, non-reconnect
`connect()` call that failed — e.g. a bad API key — which should still fail immediately as before).
Also bumped `_reconnectDelayMs` from 1s to 2s to give OpenAI's side more time to release the old
call before the next attempt.

## 2026-07-22 — Accepted: mid-utterance audio cutoffs are an inherent cost of auto-reconnect

Manual testing (three clean reconnects, ~41s apart each time — very consistent, strong confirmation
of a real session cap around there) surfaced the actual cost of choosing transparent auto-reconnect
over true seamless renewal back when the session cap was first found: when the ~41s cap lands while
the AI is mid-utterance, the connection dies at that instant — the server stops sending audio bytes
— so the played-back sentence is truncated ("Claro, una bebida fría... Coca-Co[la]..."). The
**text** transcript for the same turn arrived complete in every observed case, confirming this is
not the model getting interrupted (that shows up differently, as `response.done` with
`status: "cancelled"`) — it's the connection itself ending mid-stream, with nothing buffered
client-side left to recover once that happens. Reconnecting can't fix a cutoff already in progress;
it can only continue the conversation forward (with the memory-loss tradeoff already documented).

Asked the user directly: build true seamless renewal now (proactive token refresh + ICE restart
before the cap, timed to a quiet moment, no gaps, no memory loss — real additional scope) vs. accept
the tradeoff and stop here. Chose to accept it for now. Auto-reconnect's actual goal — no more
freezing, no more silently dead sessions — is confirmed working well; occasional mid-sentence
truncation and memory reset at the ~41s mark is a known, accepted limitation, not a bug to keep
chasing reactively. Revisit seamless renewal as its own properly scoped piece of work if this
becomes worth fixing for real (tracked as a GitHub issue rather than left implicit here).

## 2026-07-22 — Backfilled test coverage for the whole reconnect saga

Everything in this file's entries above was found and fixed through slow, expensive manual browser
testing against the live OpenAI API — each iteration cost a full round-trip of "make a change, ask
the user to retest, read a console dump." Went back and added real unit coverage now that the dust
has settled, specifically for the pieces that were both new this session and genuinely bug-prone:

- `tests/realtime-session.test.js` (new, 14 tests) — mocks `RTCPeerConnection`/`RTCDataChannel`/
  `getUserMedia`/`fetch` (jsdom implements none of them) to test `RealtimeSession`'s connect/reconnect
  state machine without a real WebRTC connection or API key. Notably includes regression tests for
  the two real bugs found via manual testing: a failed reconnect attempt now provably keeps retrying
  up to `_maxReconnectAttempts` instead of silently giving up after one try, and `_onConnectionLost`
  is provably idempotent against redundant signals (e.g. both `onconnectionstatechange` and
  `dc.onclose` firing for the same drop). Also covers the `session.update` payload shape and
  `_handleMessage`'s transcript-extraction paths (top-level, nested, and the null case).
- `tests/config.test.js` (new, 2 tests) — `config.js` had zero coverage before this; scoped tightly
  to just the `realtimeVoice` addition from the voice-select-dropdown fix rather than building out
  full `Config` coverage as a side effect.

**Deliberately not covered:** `app.js`'s new pieces (the unexpected-disconnect UI reset, voice-select
change wiring, target-word selection in `startConversation()`). `app.js` has zero existing test
coverage as a whole, and testing it properly needs either a DOM/IndexedDB test harness (IndexedDB
isn't polyfilled yet — see the Issue #1 entry above) or refactoring pieces to be more testable in
isolation — a differently-shaped, bigger task than backfilling coverage for already-written fixes.
Flagged to the user as a separate scoping question rather than bundled in here.

## 2026-07-22 — Turn-detection tuning per difficulty (Issue #5)

Implemented per the plan in `docs/live-voice-assessment.md` (Step 5, Option B, steps 1-4), updated
for how much `session.js` changed since that plan was written (nested `audio.input.turn_detection`
instead of the flat shape assumed back then).

New `js/realtime/turn-profiles.js` — pure function `getTurnDetectionConfig(difficulty)`, three
tiers: beginner `silence_duration_ms: 2200` (generous pause tolerance to think in Spanish, directly
motivated by the Reddit thread's complaint that ChatGPT's voice mode barges in on exactly this),
intermediate `1500` (HablaBot's original, unvaried default — kept as-is, not arbitrarily changed),
advanced `1000` (natural conversational pace). Unrecognized/missing difficulty falls back to
intermediate.

`session.js`'s `connect()` now accepts `options.turnDetection`, falling back to the original
hardcoded values if not passed — existing/other callers unaffected. `app.js`'s `startConversation()`
passes `HablaBotTurnProfiles.getTurnDetectionConfig(difficulty)` through. Reconnects automatically
carry the same profile forward since `_lastConnectArgs.options` (already used for the auto-reconnect
system) includes whatever `turnDetection` was passed on the original connect.

Tests: `tests/turn-profiles.test.js` (pure function, 4 tests) plus two new cases in
`tests/realtime-session.test.js` confirming both the fallback (no override passed) and the override
path produce the exact expected `turn_detection` object in the `session.update` payload.
