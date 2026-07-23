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

## 2026-07-22 — GitHub Actions CI (Issue #2)

Added `.github/workflows/test.yml`: Node 20.x/22.x matrix, `npm ci` + `npm test` on push/PR to
`main`. Modeled on `retirement-scenario-explorer`'s `.github/workflows/test.yml` (noted as a good
template back in the Issue #1 entries), but deliberately left out its coverage/codecov step —
hablabot has no coverage tooling installed (`@vitest/coverage-v8` isn't a devDependency) and no
Codecov account to upload to; adding either wasn't asked for and would need real setup (token,
account) beyond just writing a workflow file. Verified `npm ci` + `npm test` succeed locally with a
clean `node_modules` before committing, since `npm ci` is stricter than `npm install` about lockfile
consistency and is what CI actually runs.

Noted, not acted on: `npm audit` reports 5 pre-existing vulnerabilities (3 moderate, 1 high, 1
critical) in `vitest`/`jsdom`'s transitive dependencies — unrelated to this change, not something to
silently "fix" with `npm audit fix --force` (can introduce breaking changes) without being asked.

## 2026-07-22 — GitHub Pages (Issue #3)

Added `.nojekyll` (empty file, standard for non-Jekyll static sites on GH Pages) and enabled Pages
via the API — `build_type: "legacy"`, source = `main` branch, path `/`. No Action needed: confirmed
during Issue #1's research that `retirement-scenario-explorer` (same shape of app, static/no-build)
uses exactly this config successfully. This is a live repo-settings change, not just a commit —
noted explicitly since it makes the site publicly reachable at a real URL, unlike everything else in
this log.

## 2026-07-22 — Issue #8: transcription model changed to gpt-4o-transcribe, .failed event now handled

Went further than the prose-doc research that produced the earlier (unsuccessful) attempts. Pulled
ground truth from two more reliable sources:

- OpenAI's actual TypeScript API reference for creating a client secret — confirms
  `session.audio.input.transcription` (with `model`/`language`/`prompt`/`delay` sub-fields) is the
  correct, current shape for a `type: "realtime"` session. This validates the nesting tried
  previously was right all along; the problem was elsewhere.
- A real-code TypeScript event-type reference
  (`transitive-bullshit/openai-realtime-api`'s `src/events.ts`, pulled via raw GitHub, not summarized)
  and an OpenAI community thread specifically titled around this exact symptom. The thread contains
  another developer confirming this exact nested structure worked for them, with model
  **`gpt-4o-transcribe`** — a concrete, corroborated data point, unlike the single-source prose guide
  that led to trying `gpt-realtime-whisper` previously (which never worked across several live tests).

Changed `session.js`'s `audio.input.transcription` from `{ model: 'gpt-realtime-whisper' }` to
`{ model: 'gpt-4o-transcribe', language: 'es' }` — `language` added because this app is specifically
for Spanish speech (accuracy guidance per the API reference; not itself expected to be the
null-transcript fix, just a legitimate improvement while touching this config).

**Also fixed a real blind spot**: `conversation.item.input_audio_transcription.failed` is a real,
documented server event (confirmed in the events.ts reference above) that `session.js` never handled
at all. Input audio transcription runs asynchronously server-side and can fail outright — every
previous null-transcript investigation had no way to see this even if it was the actual cause the
whole time, since a failure and "transcription simply not ready yet" looked identical (both just
absent from the observed events). Added a handler that logs `msg.error` clearly, so if the model
change above doesn't fully resolve it, the next live test will show a concrete, diagnosable reason
instead of silence.

Tests: updated the existing `session.update` shape assertion for the new model/language, and added
a case confirming the `.failed` event logs clearly via `console.error` rather than being silently
ignored (`tests/realtime-session.test.js`, now 17 tests).

## 2026-07-22 — Fixed duplicate AI messages in conversation history (2-3x repeats)

Manual testing showed every assistant reply appearing 2-3 times in the conversation history with an
identical timestamp. Traced `addMessageToHistory('assistant', ...)` to a single call site
(`app.js`'s `onAITranscript` callback, only when `isFinal`), so the duplication has to come from
`onAITranscript(..., true)` itself firing more than once for the same logical response.

Best-supported theory, not confirmed via direct server evidence but consistent with everything else
in this migration saga: `_handleMessage` listens for both the old and new event names
(`response.audio_transcript.*` / `response.output_audio_transcript.*`) as a migration-safety net. If
OpenAI's server is actually emitting **both** aliases for the same underlying response — deltas
under both names, refilling `aiTranscriptBuffer`, then `.done` under both names — the handler fires
once per alias, each time with a full, correctly-reconstructed (not garbled) copy of the same text,
which exactly matches what was observed (the same complete sentence twice, not a doubled/garbled
string).

Fixed defensively regardless of the exact mechanism: `_lastFinalAITranscript` tracks the last
committed final transcript; `.done`'s handler now skips calling `onAITranscript` if the current
buffer is empty or identical to the last commit. Two consecutive real replies being byte-identical
is effectively never going to happen, so this can't accidentally suppress a genuine turn.

Tests: 3 new cases (52 total) — the duplicate-alias scenario gets committed once, two genuinely
different consecutive replies both still commit, and an empty buffer never fires the callback at
all.

## 2026-07-22 — User pushback: the mid-utterance cutoff (#7) matters more than initially assessed

Told the user "nothing about the live conversation experience itself is degraded" by the transcript
bug (#8), reasoning that the model understands/responds from raw audio regardless of what HablaBot's
own transcript extraction captures. Correctly pushed back: when a response gets audio-truncated by
the ~41s cap (#7, already accepted as a tradeoff), the **only** way to know what was actually said is
reading the AI's text transcript — which was simultaneously undermined by the duplication bug above.
Relying on reading text to know what was said out loud defeats the actual point of a
listening-comprehension tool. Correcting the record here rather than leaving the earlier, too-glib
claim standing.

## 2026-07-22 — Issue #7 reframed: pivoting from "renewal" to "diagnose the actual disconnect cause"

Before starting on true seamless renewal, checked whether existing voice-agent frameworks
(Pipecat, LiveKit Agents) already solve this — they don't cleanly apply: Pipecat's OpenAI WebRTC
transport (`@pipecat-ai/openai-realtime-webrtc-transport`) is npm-only, requiring a bundler, which
breaks HablaBot's deliberate zero-build-step architecture; LiveKit routes through their own
infrastructure, a bigger pivot than a client library; OpenAI's own official reference client
(`openai-realtime-api-beta`) is fully deprecated (beta endpoints removed May 12, 2026). Neither
documented automatic session-renewal as a built-in feature either way.

More importantly, this research surfaced a fact that reframes the whole problem: **OpenAI's docs
state the maximum Realtime session duration is 60 minutes**, not ~41 seconds. The consistent ~40-43s
disconnects measured throughout this investigation aren't hitting any documented session cap at
all. The original "60s TTL" comment in this file (present before this migration work started) was
about the *ephemeral token* used only to establish a connection — separately confirmed via OpenAI's
docs and a real GitHub issue
(`openai/openai-realtime-agents#119`, another developer asking specifically about session limits
and reporting none observed) that token expiry does not terminate an already-connected session.

Working theory now: this is a genuine connectivity bug, not a limit to design around — plausibly a
NAT/router UDP binding timeout (routers commonly time out idle-ish UDP mappings in exactly this
range; if WebRTC's ICE consent-freshness traffic isn't sufficient to keep it alive, the mapping
silently drops). Also newly relevant: manual testing has been in Firefox specifically (confirmed by
the "add a STUN/TURN server, see about:webrtc" messages, which are Firefox's own diagnostic
phrasing) — Firefox's WebRTC/ICE implementation differs from Chromium's in ways that could matter
here, untested until now.

Added two diagnostics rather than another guessed fix:
- Log the ephemeral token's actual `expires_at` (if the response includes one) against observed
  disconnect timing — directly checks the token-TTL hypothesis with real data instead of docs that
  have proven stale/incomplete elsewhere in this investigation.
- Log `RTCPeerConnection.getStats()` candidate-pair data (bytes sent/received, packet loss, RTT) at
  the moment `connectionState` reaches `disconnected`/`failed`. Bidirectional packet flow stopping
  together points at a network-level cause (NAT timeout); one-sided flow or high packet loss would
  point elsewhere.

Next test should also try Chrome or Safari alongside Firefox, to check whether this is browser-specific.

Tests: 3 new cases (55 total) covering the expiry log format, stats logging on connection loss, and
that a missing/unavailable `getStats()` doesn't throw.

## 2026-07-22 — Root cause found: Firefox-specific NAT/router UDP mapping timeout, not a session limit

Decisive comparison test: identical code, same machine, same network — **Chrome completed a full
multi-turn conversation with zero disconnects**; Firefox disconnected at ~41s and ~42s across two
consecutive reconnects in the same session, matching every prior measurement. This alone rules out
the NAT-router-timeout-affecting-everyone theory from the previous entry (same router would affect
both browsers) and rules out any server-side/OpenAI-side session limit (already suspected false
given the documented 60-minute limit, now confirmed: token `expires_at` was 600s in both browsers,
and Chrome ran well past 41-42s with no issue at all).

The `getStats()` diagnostic gave a real, non-speculative signal on the *why*: the actively-used
candidate pair, at the moment of disconnect, showed substantial bidirectional traffic
(`bytesSent: 213381, bytesReceived: 271783`) and a healthy `currentRoundTripTime` (~38ms) — not a
degraded or starved connection. But `lastPacketSentTimestamp` was **~8 seconds after**
`lastPacketReceivedTimestamp` — the client kept transmitting for 8 more seconds after the server's
inbound traffic had already stopped arriving. That specific asymmetry (inbound stops first, outbound
keeps going) is the textbook signature of a NAT/router UDP mapping timeout on the return path:
outbound UDP doesn't need an existing mapping to leave the network, but inbound return traffic does,
and a silently-expired mapping just drops incoming packets with no error surfaced to either side.

Reconciling with the same-router-should-affect-both-browsers objection: this doesn't require the
router's timeout value itself to differ per browser — only that Firefox's ICE implementation sends
consent-freshness/keepalive traffic less aggressively than Chrome's, letting the identical mapping
lapse under Firefox but not under Chrome. Not independently confirmed (would need packet-capture-level
comparison of the two browsers' ICE keepalive cadence to prove directly), but consistent with every
observation so far and a well-known category of real Firefox WebRTC behavior difference.

**Conclusion: "seamless renewal" (the original plan before this diagnostic pivot) would have been
solving a problem that doesn't really exist as a fixed session limit — it was chasing a
Firefox-specific connectivity bug.** Auto-reconnect (already built, working well) is arguably the
*right* mitigation for this specific failure mode regardless of browser, precisely because the root
cause is an unpredictable, environment-dependent NAT/keepalive interaction rather than a fixed,
schedulable boundary — there's no fixed "quiet moment before the cap" to renew around, since there's
no real cap, just an unlucky router/browser interaction that could in principle happen at any time. A
practical near-term recommendation is Chrome/Chromium-based browsers, which have shown zero instances
of this failure mode in testing.

Diagnostic code (token expiry logging, `getStats()` candidate-pair logging) is being kept in
`session.js` rather than removed now that its job is done — genuinely useful if this class of issue
resurfaces (different network, different browser update, etc.).

## 2026-07-22 — Issue #8's actual root cause: a stale service worker cache, not the API config at all

After every one of the four config attempts logged above failed identically, took a genuinely
different approach: cloned OpenAI's own official reference app (`openai/openai-realtime-console`)
and progressively matched every wire-level difference to HablaBot's code — model name, STUN server,
`getUserMedia` constraints, track-adding pattern, the redundant post-connect `session.update`, the
SDP endpoint's `?model=` query param, and finally HablaBot's actual full-length real system prompt.
**Every single variable, once matched, still produced working transcripts in the reference app —
every time.** That meant the wire protocol was never the problem; whatever was different had to be
in HablaBot's own running code, not what it sends.

Found it: `sw.js` (registered by every HablaBot session — "SW registered:" in every console log this
whole investigation) had a real, confirmed bug. `STATIC_CACHE_URLS` still listed pre-Realtime-API
files (`js/speech/recognition.js`, `js/speech/synthesis.js`) and never included any `js/realtime/*.js`
file at all. Worse, the fetch handler was pure cache-first with no revalidation — `caches.match()`
returned a cached response immediately with no network check at all, and `CACHE_NAME` had never been
bumped, so any file cached at any point stayed frozen at that exact version indefinitely. Once the
service worker was unregistered and site data cleared, **HablaBot itself started working correctly
in Chrome** — transcripts populated normally, matching the reference app's behavior all along.

**This means the entire investigation chased a phantom bug.** The API config was likely correct far
earlier than confirmed — possibly as early as the original nested `audio.input.transcription` guess
— but the browser was silently running stale `session.js` through some or all of the live tests,
making a working fix look like a failing one. Genuinely difficult to have caught sooner: the service
worker was doing its job "correctly" by its own (buggy) logic, produced no errors, and some newer
diagnostic code *did* appear in logs during the investigation (most likely because devtools'
"Disable cache" setting — commonly on by default when devtools is open, which it was this entire
session — intermittently bypassed the service worker's cache for the active tab, not because the
cache was actually being invalidated by anything in `sw.js` itself).

**Fixed `sw.js` properly, not just for this one incident:**
- Bumped `CACHE_NAME` to `hablabot-v2` (forces immediate invalidation of every stale cached entry).
- Updated `STATIC_CACHE_URLS` to match the actual current script list in `index.html` (removed the
  dead `js/speech/*.js` entries, added all three `js/realtime/*.js` files and `js/utils/user-manager.js`,
  which was also missing).
- **Changed the fetch strategy from cache-first to network-first-with-cache-fallback.** This is the
  part that actually prevents recurrence: bumping the cache name only fixes the *current* staleness
  once; the old cache-first strategy would have silently gone stale again the very next time any
  file changed. Network-first still gives full offline support (falls back to cache exactly when the
  network fetch fails) while keeping the app fresh whenever a network is available — the normal case
  during active development, and arguably the right tradeoff for an app whose primary use case isn't
  offline-first.

**Not merged, left superseded:** `fix/user-transcript-delta-accumulation` (the delta-accumulation +
duplicate-client_secrets-config branch from earlier in this investigation) added real complexity to
work around a bug that turned out not to exist. Main's simpler configuration (transcription in
`session.update` only, no delta handling needed) is now confirmed sufficient on its own, once the
service worker isn't serving stale code. That branch should be deleted rather than merged.

## 2026-07-22 — The "AI reply appears 2-3 times" bug: a different, real bug, not the earlier "fix"

With the service worker fixed and a genuinely fresh cache confirmed, retested whether the AI-message
duplication (found earlier this session, "fixed" via `_lastFinalAITranscript` deduping in the
`response.audio_transcript.done`/`response.output_audio_transcript.done` handler) was actually
resolved. It wasn't — still tripled. On reflection, that earlier fix was never going to help: even
without it, a genuine second `.done` firing for the same response would already hit an empty,
already-reset `aiTranscriptBuffer` and fail the `if (this.aiTranscriptBuffer && ...)` check on its
own. That the bug persisted despite two independent guards on that path meant the duplication was
never coming from there at all.

Found the real cause: `conversation.item.done` fires for **both** user and assistant turns — visible
throughout every reference-app log captured while investigating #8, where assistant items always had
`item.content[0].transcript` populated with the AI's own spoken text (only the user's is ever
`null`). `session.js`'s handler for this event never checked `msg.item?.role` — it unconditionally
tried to extract `item.content[].transcript` and fire `onUserTranscript` with whatever it found. For
an assistant's own turn-completion event, that meant extracting the AI's own words and injecting them
into the conversation history mislabeled as if the user had said them — with identical text to the
real assistant bubble, which is exactly what "the AI's reply appears 2-3 times" looked like.

Fixed by skipping the case entirely when `msg.item?.role === 'assistant'`, before any transcript
extraction is attempted (and before the "no recognizable transcript field" warning, which shouldn't
fire for a role this handler deliberately isn't processing). The earlier `_lastFinalAITranscript`
dedup guard is left in place — harmless, and a reasonable defensive measure regardless — but this is
the fix that actually addresses the reported symptom.

Tests: 1 new case (56 total) confirming an assistant-role `conversation.item.done` with a populated
transcript is ignored entirely, and doesn't spuriously warn either.

## 2026-07-22 — Issue #6: expanded conversation scenarios from 7 to 16

Widened scenario breadth to match/exceed competitors (Praktika, Natulang) per Issue #6. Started by
proposing a 13-item shortlist independently, then found `Requirements and Implemetation.md` (a
pre-existing planning doc at the repo root, predating this session's work and not previously read)
already had a "Conversation Scenarios" section — it listed the same 7 scenarios already implemented
(Restaurant, Travel, Shopping, Family, Work, Health, Emergency), each with a few sub-situations noted
as bullets (e.g. Travel: "asking directions, booking hotels, transportation").

That overlap mattered: 4 items from the proposed shortlist (Hotel check-in, Directions &
transportation, Job interview, Pharmacy) turned out to already be implicit sub-topics of an existing
scenario (Travel, Travel, Work, Health respectively) rather than genuine gaps. Dropped those 4 rather
than adding them as redundant top-level entries — if their coverage within the existing scenario
prompts ever feels thin, that's a content-depth issue for the existing scenario, not a case for a
new dropdown entry.

The remaining 9 were added as new top-level scenarios (`js/ai/prompts.js`, `index.html`'s
`#scenario-select`), since each represents a register or setting genuinely distinct from anything in
the original 7: Café (informal, faster-paced than a full Restaurant), Meeting Someone New / Small
Talk (purely social, no transactional goal — a gap across the entire original set), Bank/Post Office,
Phone/Tech Support (voice-only register, no visual cues to lean on), Apartment Hunting (longer-term
housing, distinct from Travel's hotel booking), Hairdresser/Salon, Gym, School, Celebrations &
Holidays.

Each new scenario follows the exact structure of the existing 7 (ESCENARIO / role setup /
VOCABULARIO CLAVE / OBJETIVOS / FRASES ÚTILES / INICIO in `getScenarioPrompts()`, plus a 3-starter ×
3-difficulty block in `getConversationStarters()`), so `generateSystemPrompt()` and
`getConversationStarters()` needed no code changes — only new data. Total: 16 scenarios.

Also added `tests/prompts.test.js` (4 tests), since `js/ai/prompts.js` had zero prior coverage. Tests
assert all 16 scenarios are defined and non-empty, `generateSystemPrompt()` correctly splices each
scenario's content in, `getConversationStarters()` returns a valid starter for every
scenario × difficulty pair, and the documented fallback behavior (unrecognized scenario/difficulty →
restaurant/beginner) still holds.

## 2026-07-22 — Settings (Speech Rate, Volume) silently ignored by the live conversation

Reported bug: changing Settings like Speech Rate had no effect on an active conversation. Root cause
was leftover wiring from the pre-Realtime-API architecture: `speechRate`/`speechVolume` (and
`speechPitch`/`voiceIndex`, though those have no UI control at all) were designed for the old
`speechSynthesis`-based engine and only ever got read back into `getSpeechSettings()` — a method
nothing in the live Realtime-API path calls. `app.js`'s Settings handlers correctly saved the values
to `Config` and updated the slider labels, but `startConversation()` never passed them to
`realtimeSession.connect()`, so the Realtime API session always used its own defaults. This is the
same category of bug as the earlier voice-select dropdown fix (`realtimeVoice`) — a Settings control
whose wiring was never carried forward through the Realtime API migration — just for a different pair
of fields.

Fixed both, since both have real, distinct levers available in the new architecture:

- **Speed**: the Realtime API's `session.update` supports `audio.output.speed` (confirmed via
  current API docs — 0.25-1.5×, default 1.0, applied as post-processing on generated audio, settable
  between turns). Wired `config.speechRate` through `connect(apiKey, { speed, ... })` into both the
  initial `client_secrets` request and the `session.update` payload, alongside the existing `voice`
  field. Added `_clampSpeed()` in `session.js` since the API's range (0.25-1.5) is narrower than
  HablaBot's Settings slider historically allowed (0.5-2.0, inherited from the old engine) — rather
  than reject or silently drop out-of-range values, clamp them. Tightened the slider's own `max` from
  `2` to `1.5` in `index.html` and `Config.validateSettings()`'s bounds to match, so the UI no longer
  implies a range the backend can't honor.
- **Volume**: the Realtime API has no concept of output volume (it's not a generation parameter) —
  this is a plain client-side playback control, so it's applied directly as `audioEl.volume` when the
  `<audio>` element is created in `connect()`, via a matching `_clampVolume()` (0-1).
- **Pitch/voiceIndex**: left alone. Neither has a UI control in `index.html` at all (checked — only
  Speech Rate and Volume sliders exist under "Voice Settings"), so there's no reported symptom to fix;
  they're vestigial `Config` keys from the old engine with nothing rendering or reading them beyond
  `getSpeechSettings()` itself. Not deleted, since `Config` doesn't distinguish "unused key" from
  "used by a caller I haven't found" without a full audit — but worth removing in a future cleanup
  pass if `getSpeechSettings()` and `js/speech/*.js` are ever formally deleted rather than left as
  dead code.

Tests: 3 new cases in `tests/realtime-session.test.js` (63 total) — speed/volume values reach
`session.update` and `audioEl.volume` correctly, out-of-range values get clamped, and unset values
default to 1.0/1.0. No `app.js`-level test added — `app.js` has no existing test harness (heavy
DOM/IndexedDB dependencies with no mocking infrastructure yet), and building one is a separate effort
from this fix; the `session.js` tests cover the actual defect (options not reaching the API/audio
element) directly.

## 2026-07-22 — Issue #13: GitHub Pages deployment fully broken (unstyled, stuck on loading screen)

Reported: https://jeffwright13.github.io/hablabot/ loads but renders with no CSS (default browser
serif) and stays stuck on "Loading your Spanish tutor..." — none of the app's JS ever runs.

Root cause: every asset reference across `index.html` (`<link>`/`<script>` `href`/`src`), `sw.js`
(`STATIC_CACHE_URLS`, the `caches.match('/index.html')` offline fallback, `clients.openWindow('/')`,
and the service worker registration call itself), and `manifest.json` (`start_url`, `scope`) used a
root-absolute path (leading `/`). That resolves correctly when the app is served from a domain root —
which is true for both local dev servers (`npm run serve`, `python3 -m http.server`) — but GitHub
Pages *project* sites (as opposed to a `<username>.github.io` *user* site) serve from a subpath:
confirmed via `gh api repos/jeffwright13/hablabot/pages` that this repo's Pages config is
`branch: main, path: /`, published at `https://jeffwright13.github.io/hablabot/`. A root-absolute
`/css/main.css` resolves to `https://jeffwright13.github.io/css/main.css` — outside the `/hablabot/`
subpath entirely, which 404s. Every stylesheet and every `<script src>` 404'd the same way, so no CSS
ever applied and no JS ever ran, leaving only the static HTML fallback text visible. This was never
caught by local testing because local dev happens to always serve from the domain root, so the bug is
invisible until deployed to a subpath.

Fixed by converting every reference to a relative path: `index.html`'s `href="/css/main.css"` →
`href="css/main.css"` (and the same pattern for all `<script src>`, the manifest link, and icon
links); `sw.js`'s registration call `register('/sw.js')` → `register('sw.js')`, `STATIC_CACHE_URLS`
entries `'/css/main.css'` → `'./css/main.css'`, `caches.match('/index.html')` →
`caches.match('./index.html')`, `clients.openWindow('/')` → `clients.openWindow('./')`;
`manifest.json`'s `start_url`/`scope` `"/"` → `"."`/`"./"` (per the Web App Manifest spec, these
resolve relative to the manifest's own URL, not the page's, and `"."` is the portable choice — it
survives a repo rename or a future move to a custom domain without further edits, unlike hardcoding
`"/hablabot/"`). Relative paths resolve correctly in both topologies: from a domain root they resolve
identically to the old absolute paths (no behavior change for local dev), and from a subpath they
resolve within that subpath instead of escaping it. `manifest.json`'s icon `src` entries and `sw.js`'s
push-notification icon paths were already relative and needed no change.

Bumped `CACHE_NAME` to `hablabot-v3`, following the same reasoning as the v1→v2 bump: the resolved
absolute URL for every `STATIC_CACHE_URLS` entry changes for any subpath deployment, so a stale v2
cache (on the rare chance one had partially formed despite the 404s) needed to be invalidated rather
than mixed with the new relative-path entries.

Verified by serving the repo two ways locally: from its own directory (mimicking `npm run serve`,
confirming no regression) and from its *parent* directory so it's reachable at `/hablabot/`
(mimicking the actual GitHub Pages topology) — confirmed every asset 404'd under the old absolute
paths when served from the subpath, and all resolve `200` after the fix, in both topologies.

No test suite coverage added — this is a static-file path-resolution bug with no unit-testable
behavior (Vitest/jsdom doesn't serve files over HTTP from a configurable base path), so verification
was via the manual dual-topology `python3 -m http.server` check above rather than an automated test.
