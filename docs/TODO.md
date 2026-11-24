# To-Do

Open items that are not yet designed or scheduled. When an item is decided, record the rationale
in `DECISIONS.md`, describe the behavior in `SPEC.md`, and remove it from here. Scheduled work
lives in `PLAN.md`.

## Product questions (they block PLAN Stages 3 and 6)

Asked during the 2026-11-24 architecture/TTS review. The dialect question was answered on
2026-11-24 (Mexican Spanish; see DECISIONS); the rest are still open.

- **What exactly sounds wrong with the current voice?** *Postponed by the user (2026-11-24)
  until after the Stage 3 listening comparison;* they haven't compared voices yet. Ask again
  after that: robotic, wrong accent, English-accented Spanish, mispronunciations, or pacing?
  Which voice and browser?
- **Is "client-only, bring your own key" a hard constraint** once a second provider key exists?
  If not, a small token-minting proxy becomes an option for the ElevenLabs key.
- **How much does barge-in matter compared with voice quality?** An external TTS provider makes
  barge-in and echo cancellation harder.
- **Who are the users:** the developer and household, or eventually the public? That decides how
  much hardening the localStorage key and self-XSS in profile cards need.
- **Other target languages?** That decides how general the model and voice registry should be.

## Model decisions (deadline-driven)

- **Pick a replacement for `gpt-4o-transcribe` before 2027-02-26.** OpenAI's deprecations page
  (notice 2026-08-26) names `gpt-live-transcribe` or `gpt-transcribe`, but per their model pages
  (read 2026-11-24) neither works as a drop-in for HablaBot's WebRTC speech-to-speech session
  with server VAD. `gpt-transcribe` works in a Realtime session only over WebSocket, with
  manual turn commits. `gpt-live-transcribe` and `gpt-realtime-whisper` work only in
  transcription-only sessions, and `gpt-live-transcribe` doesn't support server VAD and uses
  `languages: [...]`, not `language`.

  **Chosen first step (user, 2026-11-24): option 1, a live test in Settings.** Options 2 and 3
  are fallbacks if it fails. Procedure, for the user to run with a real key (Chrome):
  1. Settings → Advanced → Transcription model: enter `gpt-transcribe`. Start a beginner
     session and speak 3–4 turns.
  2. Pass means each of your turns appears in the history as accurate Spanish text, with no
     error toast. Fail means a "Transcription model … was rejected" toast, turns missing from
     the history, or `input audio transcription failed` in the console. Copy any error text
     verbatim: it's also the first real model-rejection response, which SPEC §7 needs.
  3. Repeat with `gpt-live-transcribe`. **Caveat:** the app sends `language: 'es'`, but per the
     docs this model takes `languages: ["es"]`. A failure that mentions `language` is about the
     field, not necessarily the model, and needs a small code change to retest.
  4. Clear the field afterwards (blank means the default).

  Record the result in DECISIONS. If one passes, change `DEFAULT_MODELS.transcription` (with
  tests) and remove its `KNOWN_SHUTDOWNS` entry.

  Options:
  1. Live-test whether `gpt-transcribe` or `gpt-live-transcribe` actually works in the current
     session despite the docs. Settings → Advanced makes this a no-code test. Note that
     `gpt-realtime-whisper` "never produced a transcript" in July 2026 testing, but that was
     during the stale-service-worker period (DECISIONS, Issue #8), so the result may be invalid.
  2. Run transcription as a separate transcription session alongside the conversation session.
  3. Move the conversation to `gpt-live-1.1` (`/v1/live/sessions`, a different API), which per
     its page "transcribes speech more accurately and maintains a more consistent accent and
     voice across languages". That bears directly on the voice-quality complaint, so evaluate it
     together with PLAN Stage 7. Not read yet: the Live API guide
     (`developers.openai.com/api/docs/guides/live`), its voices, and whether it supports speed.

  The tripwire in `tests/models.test.js` fails from 2027-01-27 if this is still open.

## Open issues (GitHub)

- **#9: Mute the mic during AI playback** (a workaround for echo when not using a headset).
  Becomes important if an external TTS is adopted, because its audio may not be covered by
  WebRTC echo cancellation.
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
- **Failed transcriptions are invisible to the learner** (console only).
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
