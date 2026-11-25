# To-Do

Open items that are not yet designed or scheduled. When an item is decided, record the rationale
in `DECISIONS.md`, describe the behavior in `SPEC.md`, and remove it from here. Scheduled work
lives in `PLAN.md`.

## ⭐ Planned: vocabulary practice is coming back

Vocabulary practice (your own words, worked into conversation) has been **hidden since
2026-11-24**. It isn't abandoned: it was unfinished and buggy. Reviving it is scheduled as
**PLAN Stage 8**, near-to-mid term, with the bug list and a simpler redesign. Your saved words are
still stored. To try it as-is, run `HablaBotConfig.set('vocabularyEnabled', true)` in the browser
console and reload.

## Feature requests (recorded 2026-11-24, scheduled in PLAN)

- **Text input alongside voice:** PLAN Stage 11. Type or speak at any time in the same session
  (11a), and later a text-only session with no microphone (11b).
- **Performance feedback:** PLAN Stage 12. Opt-in reply speed and accuracy, for voice and text.
- Also: listening mode (Stage 9) and dialect selection (Stage 10).
- **Manual mic mute with an assignable hotkey:** PLAN Stage 14. For coughs and throat-clearing
  that would otherwise make the tutor stop and listen.
- **Session length settable to the minute:** PLAN Stage 15. A number field (1–60) instead of
  the 5-minute-step slider, remembered between visits.

## Product questions (they block PLAN Stage 6)

Asked during the 2026-11-24 architecture/TTS review. The dialect question was answered on
2026-11-24 (Mexican Spanish; see DECISIONS). The "what sounds wrong with the voice?" question
was answered by the live test the same day: nothing, with alloy, marin or cedar (DECISIONS). The
rest are still open.

- **Is "client-only, bring your own key" a hard constraint** once a second provider key exists?
  If not, a small token-minting proxy becomes an option for the ElevenLabs key.
- **How much does barge-in matter compared with voice quality?** An external TTS provider makes
  barge-in and echo cancellation harder.
- **Who are the users:** the developer and household, or eventually the public? That decides how
  much hardening the localStorage key and self-XSS in profile cards need.
- **Other target languages?** That decides how general the model and voice registry should be.

## Model decisions (deadline-driven)

- **Replace `gpt-4o-transcribe` before 2027-02-26 → now PLAN Stage 13.** The no-code live test
  (2026-11-24, DECISIONS) failed for both documented replacements: `gpt-transcribe` and
  `gpt-live-transcribe` were accepted by `session.update` but never produced a transcript, and
  gave no error. So this is a redesign, not a model swap. The options and the silent-failure
  detection that comes first are in PLAN Stage 13. The tripwire in `tests/models.test.js` fails
  from 2027-01-27 if this is still open.

## Open issues (GitHub)

- **#9: Mute the mic during AI playback** (a workaround for echo when not using a headset).
  Becomes important if an external TTS is adopted, because its audio may not be covered by
  WebRTC echo cancellation. Shares the mute mechanism with PLAN Stage 14 (manual mute). If built: an opt-in Settings toggle,
  default off (user, 2026-11-24).
- **#10: Configurable mother tongue and persona guidance** for beginners who mix English and
  Spanish.
- **#11: Try a TURN server** to fix the Firefox-specific WebRTC disconnects.

## Known gaps

- **CI uses Node 20, which has reached end of life.** `.github/workflows/test.yml` tests on Node 20.x
  and 22.x and uses `actions/checkout@v4` and `actions/setup-node@v4`, which target Node 20. Since
  PR #15, every run raises GitHub's warning: "Node.js 20 is deprecated … forced to run on
  Node.js 24". Fix: move to current major versions of both actions, and test on current LTS
  versions (22.x and 24.x). Check them against dreaming-tools' workflow (Node 22) at the time.

- **Upgrade Vitest from 2 to the current major** (5.x at the time of writing; dreaming-tools is
  on 4.x). The remaining `npm audit` advisories (10 as of 2026-11-24: 3 critical, 1 high, 6
  moderate, down from 13 after a non-breaking `npm audit fix` of `nanoid`, `postcss` and
  `source-map-js`) are in Vitest 2, Vite, vite-node, esbuild, tinypool and the coverage plugin's
  glob/minimatch/test-exclude. The plugin is pinned to match Vitest. They are dev-only and never ship, so CI only reports them. The upgrade is breaking:
  check jsdom compatibility, the config's `thresholds` format and the CommonJS-shim imports, and
  do it on its own branch with the full suite as the check.

- **PWA icons are missing** (`assets/icons/` holds only a placeholder). Installability hasn't
  been confirmed on every platform.
- **There are no request timeouts** in `RealtimeSession.connect()`. A hung `client_secrets` or SDP
  request would leave the status at "connecting" with no way out except reloading.
- **Failed transcriptions are invisible to the learner** (console only), and a transcription
  model the session doesn't support fails with no event at all. Detection is PLAN Stage 13a.
- **Reconnects lose the model's memory of the conversation.** Replaying `conversationHistory`
  into the new session is possible now that user transcripts work, but hasn't been designed.
- **Profile cards insert `user.avatar` and `user.id` into `innerHTML`/`onclick` without escaping**
  (`app.js` `showUserSelection()`). The values are self-supplied, so this is self-XSS only today.
- **In dark mode the header title is near-black on red.** `.app-header` uses `color: var(--white)`,
  which the dark scheme redefines as `#1a1a1a`. That gives about 4.6:1 to 3.0:1 across the
  gradient: it passes WCAG AA for large text (3:1), barely, but it's probably unintended. The
  version label beside it already uses literal white for this reason. Decide whether the header
  should keep white text in both schemes.
- **The start toast says "Hold the microphone button to speak"** (`app.js` `startConversation()`),
  but there is no push-to-talk.
