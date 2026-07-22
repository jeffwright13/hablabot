# Live Voice Assessment: HablaBot vs. the r/dreamingspanish "ChatGPT Live Voice" thread

**Status:** Analysis only. No source files were modified to produce this document.
**Source thread:** https://www.reddit.com/r/dreamingspanish/comments/1v3cieq/chatgpt_live_voice/
(Reddit could not be fetched programmatically — `www.reddit.com` and `old.reddit.com` both
refused the fetch tool, and web search didn't surface a cached copy. The user pasted the post
and two comments directly into the conversation; that pasted text is the source for Step 2.)

---

## Note on a stale assumption in this repo's CLAUDE.md

`CLAUDE.md`'s "Architecture" section documents a Web Speech API design (`js/speech/recognition.js`
→ `js/speech/synthesis.js`) as if it were current. It isn't. The most recent commit
(`9846f78 feat: Replace Web Speech API with OpenAI Realtime API (WebRTC)`) replaced that whole
path with `js/realtime/session.js`, and `index.html` now loads that file with the old two commented
out (`index.html:353`). The map below reflects what's actually running.

---

## Step 1 — Codebase map (current state)

### Entry points, build, dependencies
- `index.html` is the only entry point. No bundler, no `package.json`, no test runner, no linter —
  confirmed by absence of `package.json` in the repo root. Everything is `<script>` tags on `window`.
- Run via any static file server (`python3 -m http.server`); HTTPS/localhost required because
  `getUserMedia` and WebRTC need a secure context.
- Script load order (`index.html:347-360`) matches what `CLAUDE.md` describes, **except** that
  `speech/recognition.js` and `speech/synthesis.js` are no longer loaded (commented out) — they
  still exist as files on disk but are dead code (see "Orphaned code" below).

### Conversation turn flow, end to end (as implemented today)
1. `app.js: startConversation()` builds a system prompt via
   `HablaBotPrompts.generateSystemPrompt(scenario, difficulty, [])` — note the hardcoded empty
   array where target vocabulary words should go (`app.js:384-386`). More on this below.
2. `RealtimeSession.connect(apiKey, {instructions, voice, autoGreet})` (`js/realtime/session.js`):
   - POSTs to `/v1/realtime/sessions` to exchange the long-lived API key for a 60-second ephemeral
     token (keeps the real key off the wire after the handshake).
   - Opens the mic (`getUserMedia`), creates an `RTCPeerConnection`, adds the mic track, opens a
     `RTCDataChannel` named `'oai-events'` for JSON control messages.
   - Does the WebRTC SDP offer/answer exchange as a plain HTTPS POST (this is *why* WebRTC and not
     WebSocket — the code comment at `session.js:4-9` explains browsers can't attach auth headers
     to WebSocket connections, but SDP exchange is a normal POST so `Authorization` works fine).
   - Once the data channel opens, sends `session.update` configuring `modalities`, `voice`,
     `input_audio_transcription: {model: 'whisper-1'}`, and `turn_detection: {type: 'server_vad',
     threshold: 0.5, prefix_padding_ms: 300, silence_duration_ms: 1500}` (`session.js:112-126`).
3. OpenAI's server-side VAD (voice activity detection) watches the mic stream and fires
   `input_audio_buffer.speech_started` / `speech_stopped` — these drive the listening-indicator UI.
4. When the user stops talking, OpenAI transcribes it with Whisper server-side and sends
   `conversation.item.input_audio_transcription.completed` → `onUserTranscript` → appended to the
   on-screen history.
5. The model streams its spoken reply as both audio (over the WebRTC media track, played by an
   auto-created `<audio>` element) and text deltas (`response.audio_transcript.delta` →
   `onAITranscript`). `response.done` signals the turn is over.
6. Turn-taking is entirely server-managed — `app.js:25-27` even documents this: `beginUserTurn()`
   is a deliberate no-op now, because the old manual "listen → recognize → speak → listen again"
   loop doesn't exist anymore. The Realtime API's VAD decides when to listen.
7. `endConversation()` calls `database.saveConversationSession(this.currentSession)` — but
   `this.currentSession.conversationHistory` and `.wordsUsed` are initialized empty at session
   start (`app.js:373-376`) and **nothing in the realtime flow ever populates them**. Every saved
   session record has empty history and word-usage data. This is a real bug, independent of
   anything from the Reddit thread — flagged here because it matters for Step 3/5.

### Speech input/output
Fully delegated to the OpenAI Realtime API over WebRTC — no browser Web Speech API involved in the
live path anymore. TTS is whatever voice OpenAI's model speaks in (`'alloy'`, hardcoded in two
places: `app.js:390` and as a default in `session.js:77`); it is **not** the browser's
`speechSynthesis`. The Settings UI still has voice-rate/volume/voice-select controls
(`index.html:276-293`) that write to `config.js` settings consumed by the old
`HablaBotSpeechSynthesis` — those controls are now inert for the live conversation, since that
manager is no longer wired to anything that plays audio.

### Prompts, persona, and difficulty
`js/ai/prompts.js` (`ConversationPrompts`) is the one part of the "old" architecture still fully
in use. It composes a system prompt from four pieces: a base persona ("María", a patient Spanish
tutor, with an explicit correction philosophy — model correct usage rather than saying "that's
wrong"), a scenario block (7 scenarios: restaurant, travel, shopping, family, work, health,
emergency — each with its own key vocabulary and opening lines), a difficulty block (beginner /
intermediate / advanced, each with concrete example sentences), and — when passed a non-empty
array — a target-vocabulary section instructing the model to work specific words into the
conversation 2-3 times. Difficulty is chosen once, at session start, via a `<select>`
(`index.html:98-104`); nothing changes it mid-session.

### State, persistence, session handling, configuration
- **`localStorage['hablabot-config']`** (`js/utils/config.js`): API key stored in plaintext (the
  README's privacy claims aside), speech rate/volume, correction frequency, target words-per-session,
  a `enableElevenLabs` feature flag that's off and unused.
- **IndexedDB, one DB per user** (`js/storage/database.js`, `HablaBotDB`): stores `vocabulary`,
  `sessions`, `userSettings`, `conversationHistory`. Multi-user via `HablaBotUserManager`
  (profiles in `localStorage`, one DB name per user).
- **Vocabulary + spaced repetition** (`js/vocabulary/manager.js`, `js/vocabulary/spaced-repetition.js`):
  a real SM-2 implementation — easiness factor, repetition count, mastery level 0-10, next-review
  date. `selectWordsForSession(vocabularyItems, options)` already exists and already knows how to
  pick due/priority words by difficulty and scenario. **It is simply never called from
  `app.js: startConversation()`.**

### Anything already half-built toward live voice
The entire `js/realtime/` module *is* the live-voice implementation — this is not a future feature
to build, it's already shipped in the last commit. The relevant gap is not "does HablaBot have live
voice" (yes) but "does HablaBot's existing vocabulary/pedagogy layer still talk to it" (no, see above).

### Orphaned code (found during this pass, not asked for, noted for awareness only)
- `js/speech/recognition.js`, `js/speech/synthesis.js` — no longer loaded by `index.html`, dead.
- `js/ai/conversation.js` (`ConversationEngine`) — still `init()`'d in `app.js:99-100`, but its
  `startSession()` / `processUserInput()` (which is what did vocabulary-usage analysis and session
  stats against a `gpt-4` chat-completions call) are **never invoked** anywhere in the realtime
  flow. It's initialized and then unused.

These aren't in scope to fix here (no files were modified), but they explain *why* the vocabulary
integration is currently broken: the migration to the Realtime API replaced the old
listen→transcribe→chat-completion→speak loop wholesale, and nothing carried the vocabulary-tracking
logic over to the new event-driven callback shape.

---

## Step 2 — The external approach (r/dreamingspanish thread), as capabilities

The thread is short: one original post and two comments (pasted by the user; no other replies were
recoverable since Reddit couldn't be fetched directly).

**Core idea (pedagogical):** OP reports that ChatGPT's voice mode update (roughly a week before
posting) made half-hour practice sessions "go by really quickly," versus previously giving up
after ~10 minutes out of frustration/boredom. The claimed mechanism is that the assistant can now
listen and speak "at the same time" (full-duplex-feeling turn-taking) and "adapts speed and
language to your level automatically." The pedagogical bet is: lower conversational friction →
longer sustained engagement → more practice reps, which matters more for a beginner than any single
correction or vocabulary drill.

**Implementation mechanics (from the thread + general knowledge of the product, since the thread
itself gives no technical specifics — flagged as inference, see Assumptions):** ChatGPT's Advanced
Voice Mode is built on OpenAI's realtime speech-to-speech model family (the consumer-app surface of
the same underlying technology as the public Realtime API). It does low-latency, server-side voice
activity detection with barge-in (the model can be interrupted, and will stop talking), which is
mechanically the same `server_vad` approach HablaBot's `session.js` already uses. The "adapts to
your level automatically" claim is not explained anywhere in the thread — there's no visible prompt
or settings toggle for it in the ChatGPT app; it would have to be either implicit model behavior or
a system-prompt-level instruction OpenAI ships internally. **This is unverified.**

**Constraints (closed product):** ChatGPT's voice mode is a consumer app — no exposed system
prompt, no custom persona, no per-word vocabulary tracking or spaced repetition, no session export,
and critically, no user control over turn-detection sensitivity (VAD threshold, pause tolerance).
That last point is the crux of the second comment.

**Reported limitation (2nd comment):** the always-on barge-in behavior actively hurts a beginner
who needs silent thinking time to construct a sentence before speaking it — the assistant's
turn-detection interprets a thinking pause as "done talking" and jumps in, and asking it
conversationally not to do that didn't reliably change the behavior. This is a specific, concrete,
well-evidenced complaint (as opposed to the auto-adaptation claim, which is anecdotal and vague).

**Third data point (3rd comment):** a bare recommendation of a third-party product, "Enversation"
(`enversonai.com`), with no supporting detail. I did not fetch or evaluate this site — a single
unexplained link recommending a specific product is a common enough spam/self-promotion pattern
that I'm treating it as unverified and out of scope, not as a design reference. Flagging it only so
you're aware it appeared in the thread.

---

## Step 3 — Gap analysis

| Capability | HablaBot today | Reddit/ChatGPT approach | Gap | Adopt? |
|---|---|---|---|---|
| Full-duplex speech-to-speech transport | Already implemented: OpenAI Realtime API over WebRTC (`js/realtime/session.js`), same model family (`gpt-4o-realtime-preview`) | ChatGPT Advanced Voice Mode, same underlying model family, via a consumer app | None — HablaBot is already at parity on the core transport. This is the single most important fact from Step 1. | N/A, already done |
| Turn-taking / barge-in tuning | `server_vad`, fixed `threshold: 0.5`, `silence_duration_ms: 1500`, identical regardless of difficulty (`session.js:119-124`) | Same server-VAD mechanism, but **not user-tunable** in the ChatGPT app at all | HablaBot already has a knob ChatGPT users don't — it's just unused (not keyed to difficulty) | Yes — cheap, already-available lever |
| Tolerance for beginner "thinking pauses" | Same structural risk as the complaint: a fixed 1.5s silence window will still cut off a beginner mid-thought if they pause too long | Explicitly reported as broken and *not fixable* by the end user in ChatGPT | HablaBot can actually fix this, where ChatGPT users structurally cannot | Yes — directly actionable, addresses the one concrete complaint in the thread |
| Adaptive difficulty within a session | Static: difficulty is chosen once at session start and baked into the system prompt text; nothing changes it mid-conversation | Anecdotally "adapts speed and language to your level automatically" | Real gap, but **unverified how well it actually works** — the only technical detail in the thread is a complaint, not a success mechanism to copy | Maybe — worth a cheap prompt-level experiment before building real logic for it |
| Vocabulary / spaced-repetition tied into the live conversation | **Currently broken.** `startConversation()` passes a hardcoded `[]` for target words (`app.js:385`); `selectWordsForSession()` in the vocabulary manager is never called from the live-conversation path; `ConversationEngine`, which used to track word usage, is orphaned | Not present in ChatGPT at all — no SRS, no word tracking | This is HablaBot's actual differentiator vs. "just use ChatGPT voice mode," and it's currently non-functional post-migration | Yes — this is a regression to fix, arguably higher priority than anything from the Reddit thread |
| Session history / stats persistence | DB schema supports it, but the realtime flow never populates `conversationHistory`/`wordsUsed` before saving (`app.js:373-376`, `endConversation()`) | N/A, ChatGPT doesn't persist practice history at all | Self-inflicted gap from the migration, not something to "adopt" from Reddit, but blocks any vocabulary-integration fix until addressed | Yes, but treat as a bug fix, not a feature adoption |
| Persona / system-prompt customization | Fully customizable: named persona, 7 scenarios, 3 difficulty tiers with example sentences, explicit correction philosophy (`js/ai/prompts.js`) | None — fixed assistant persona, no scenario framing | HablaBot is already ahead here | N/A |
| Cost / control model | Pay-per-use, user's own OpenAI API key, developer-level access to every API knob | Bundled into a ChatGPT subscription, no API-level control | Different business model, not a gap to close | N/A |

The honest summary: **HablaBot doesn't need to "catch up" to the Reddit approach on voice
technology — it already ships the same core capability.** The two things actually worth doing are
(1) using a config knob HablaBot already has but doesn't use (turn-detection pause tolerance,
directly motivated by the thread's one concrete complaint), and (2) fixing a real regression from
the Realtime API migration (vocabulary integration is currently dead code). The "auto-adapts
difficulty" claim is the flashiest part of the post but the weakest-evidenced — I'd treat it as a
maybe, not a priority.

---

## Step 4 — Integration options

### Option A — Minimal (prompt/config only, no architecture change)
- **Files touched:** `js/realtime/session.js` (parameterize the hardcoded `turn_detection` block),
  `js/app.js` (pass a difficulty-derived turn-detection config into `connect()`; replace the
  hardcoded `[]` at `app.js:385` with a real call to `vocabularyManager.selectWordsForSession()`).
- **New dependencies:** none.
- **Cost:** no change — same number/shape of API calls.
- **Latency:** a longer `silence_duration_ms` for beginners adds up to ~1-2s more perceived delay
  before the AI responds (it's waiting longer to confirm you're done talking) — that's the explicit
  tradeoff, not a bug.
- **What breaks:** nothing; purely additive parameters with safe defaults.
- **Fallback:** revert to the current fixed `1500`.
- **Doesn't fix:** the fact that spoken target words still don't get tracked back into the SRS
  scheduler, even though the prompt now mentions them.

### Option B — Moderate (new module(s) alongside existing code, feature-flagged) — recommended, see Step 5
- **Files touched/added:**
  - `js/realtime/turn-profiles.js` (new) — a pure function
    `getTurnDetectionConfig(difficulty)` returning per-tier `{threshold, prefix_padding_ms,
    silence_duration_ms}`. No side effects, easy to reason about without a test runner.
  - `js/realtime/session.js` — accept `options.turnDetection` in `connect()`, falling back to the
    current hardcoded values if not passed (backward compatible).
  - `js/app.js` — wire `turn-profiles.js` into `startConversation()`; fix the `[]` → real target
    words the same as Option A.
  - `js/realtime/session-vocab-bridge.js` (new) — a small module that, on each
    `onUserTranscript(text)` callback, checks the transcript against the session's target-word list
    (reusing the matching logic currently stranded in `ConversationEngine.analyzeVocabularyUsage()`)
    and calls the vocabulary manager's `updateWordPerformance()` so SM-2 scheduling actually updates
    from live conversations again.
  - `js/utils/config.js` — one new flag, e.g. `adaptivePacing: true`, so the whole thing can be
    toggled off without touching other files.
- **New dependencies:** none — still vanilla JS/`window` globals, consistent with the rest of the
  repo.
- **Cost:** no added OpenAI API cost — vocabulary matching runs client-side against text the app
  already receives.
- **Latency:** turn-detection timing is the same tradeoff as Option A; the vocabulary bridge runs
  against transcript text after the fact, adds no latency to the live audio path.
- **What breaks:** nothing, if kept additive. One thing to watch: don't let this module accidentally
  resurrect `ConversationEngine.startSession()` (it has its own, now-stale, conversation-history
  array that would double-track things) — write the bridge as new code that reads the *matching
  logic's shape*, not as a call into the old class.
- **Fallback:** flip `adaptivePacing` off; behavior reverts to "voice works, vocabulary tracking
  stays broken" (today's state).

### Option C — Substantial (refactor of the conversation/audio pipeline)
- Retire `js/ai/conversation.js` and `js/speech/*.js` outright (delete, not comment out); introduce
  a `js/realtime/session-tracker.js` that becomes the single owner of `wordsUsed` /
  `conversationHistory` / `messageCount` for the realtime path (replacing what `ConversationEngine`
  used to do for the old chat-completions flow); build real mid-session adaptive difficulty by
  periodically evaluating transcript complexity and re-issuing `session.update` with revised
  `instructions`.
- **Files touched:** the above new tracker module, deletions of the two dead files and the orphaned
  class, non-trivial rewrites in `js/app.js`'s realtime-callback wiring, possibly
  `js/ai/prompts.js` to support incremental instruction patches instead of one static prompt.
- **New dependencies:** none strictly required. A "smarter" adaptive-difficulty heuristic could use
  a cheap secondary model call (e.g. `gpt-4o-mini`) to score transcript complexity between turns —
  optional, adds a small per-turn cost if used.
- **Cost:** `session.update` mid-session is free (it's just a data-channel message); the optional
  secondary scoring call would add per-turn API cost.
- **Latency:** none added to the live audio path if adaptation logic runs asynchronously between
  turns rather than blocking the response.
- **What breaks:** real risk here — need to grep for anything still reading `speechRate` /
  `speechVolume` / `voiceSelect` settings before deleting `js/speech/synthesis.js`, since those
  Settings-page controls currently write to config keys that are already inert for the live
  conversation (audio now comes from the Realtime API's media track, not `speechSynthesis`) but
  might still be read somewhere for display purposes.
- **Fallback:** hard to do cleanly — this is a real refactor, would want its own feature branch,
  per repo convention (`feature/<name>`), and staged manual testing before merge.

---

## Step 5 — Recommendation and plan

**Recommend Option B.**

Option A only fixes the turn-detection tuning — it leaves the more consequential, already-broken
vocabulary integration untouched. Option C is a legitimate refactor, but its main payoff (real
mid-session adaptive difficulty) is chasing the single weakest-evidenced claim in the source
material — the thread gives no mechanism, and the one commenter who described the adaptive/barge-in
behavior in detail described it as actively harmful, not something to emulate faithfully. Option B
fixes the two concrete, well-evidenced problems (pause tolerance, dead vocabulary wiring) with new,
isolated, feature-flagged files and zero deletions — small diffs, each independently reviewable and
revertible, consistent with "propose a plan first" for anything touching more than ~3 files.

### Ordered task list

1. **`js/utils/config.js`** — add a `turnDetectionProfile` setting (or simplest: a
   difficulty-keyed map of `silence_duration_ms`). Pure config addition, no logic.
   *Verify manually:* settings still load/save correctly (open Settings, confirm no console errors).

2. **`js/realtime/turn-profiles.js`** (new file) — `getTurnDetectionConfig(difficulty)` returning
   `{threshold, prefix_padding_ms, silence_duration_ms}` per tier. Suggested starting values:
   beginner `silence_duration_ms: 2200`, intermediate `1500` (today's default), advanced `1000`.
   Pure function — reviewable in isolation even without a test runner in this repo.

3. **`js/realtime/session.js`** — in `connect()`, replace the hardcoded `turn_detection` object
   (currently `session.js:119-124`) with `options.turnDetection ?? { /* current defaults */ }`.
   No behavior change if a caller doesn't pass the new option.
   *Verify manually:* start a conversation without passing the new option; confirm it behaves
   exactly as it does today.

4. **`js/app.js` `startConversation()`** — pass `turnProfiles.getTurnDetectionConfig(difficulty)`
   into `realtimeSession.connect()`.
   *Verify manually:* start a beginner session and an advanced session back to back; you should be
   able to *feel* the difference in how long a pause you can take before the AI jumps in.

5. **`js/app.js` `startConversation()`** — replace the hardcoded `[]` (currently `app.js:385`) with
   `await this.vocabularyManager.selectWordsForSession({ difficulty, scenario })` (the method
   already exists in `js/vocabulary/manager.js` / `spaced-repetition.js`, it's just never called
   today).
   *Verify manually:* log the generated `instructions` string (or inspect the `session.update`
   payload in devtools' Network/WS panel) and confirm it now contains real target words instead of
   an empty vocabulary section.

6. **`js/realtime/session-vocab-bridge.js`** (new, small) — on `onUserTranscript(text)`, match
   `text` against the session's target-word list and call
   `vocabularyManager.updateWordPerformance(wordId, quality)`.
   *Verify manually:* speak a target word during a session, end it, then check IndexedDB directly
   (Chrome devtools → Application → IndexedDB → your per-user DB → `vocabulary` store) and confirm
   that word's `masteryLevel` / `nextReviewDate` actually changed.

7. **`js/app.js` `endConversation()`** — populate `currentSession.wordsUsed` /
   `conversationHistory` from the bridge's tracked state before
   `database.saveConversationSession()` (today it saves empty arrays every time).
   *Verify manually:* end a session, inspect the saved record in the `sessions` IndexedDB store,
   confirm non-empty history/word-usage data.

8. **`docs/DECISIONS.md`** (new — none exists yet in this repo) — record: why turn-detection is now
   difficulty-keyed instead of fixed, and why `ConversationEngine`/the old chat-completions path
   was left retired rather than resurrected as part of this work.

Steps 4, 6, and 7 are inherently manual-verification steps — this repo has no build system or test
runner (per `CLAUDE.md`), so "does the pause feel right" and "did IndexedDB actually update" can
only be confirmed by running the app in a browser with a real API key, not by an automated check.

---

## Assumptions flagged (because the source material was thin or inaccessible)

- **Reddit thread access:** could not be fetched programmatically at all (both `www.reddit.com`
  and `old.reddit.com` refused the tool, web search didn't surface a mirror). Step 2 is built
  entirely from the text the user pasted directly — one post, two comments. There is no confirmation
  this is the complete thread; other replies may exist that weren't pasted.
- **"Adapts speed and language to your level automatically"** is taken at face value from the
  original poster with no technical explanation offered anywhere in the pasted text. I have not
  found a mechanism to point to (prompt-level, fine-tuned, or otherwise) — treated as an
  unverified, anecdotal claim throughout, not as a spec to copy.
- **Model/tech parity assumption:** I'm assuming ChatGPT's Advanced Voice Mode and the public
  Realtime API (`gpt-4o-realtime-preview`, which `session.js` already uses) are the same underlying
  model family. OpenAI hasn't published a direct 1:1 confirmation of this that I've verified here —
  it's a reasonable inference from both being real-time speech-to-speech products from the same
  vendor, not a confirmed fact.
- **"Enversation" (enversonai.com)** — mentioned in a single comment with no supporting detail. Not
  fetched, not evaluated, not incorporated into the gap analysis or options above. Flagged only so
  you're aware a third product name came up in the thread, in case you want to look into it
  separately.
