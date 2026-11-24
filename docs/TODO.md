# To-Do

Open items that are not yet designed or scheduled. When an item is decided, record the rationale
in `DECISIONS.md`, describe the behavior in `SPEC.md`, and remove it from here. Scheduled work
lives in `PLAN.md`.

## Product questions (they block PLAN Stages 3 and 6)

Asked during the 2026-11-24 architecture/TTS review. Not yet answered.

- **What exactly sounds wrong with the current voice?** Robotic, wrong accent, English-accented
  Spanish, mispronunciations, or pacing? Which voice and browser? (The default is `alloy`, and
  most testing has probably used it.)
- **Which dialect should the tutor speak?** Castilian, Mexican, or a neutral Latin American
  Spanish? The prompt currently mixes them.
- **Is "client-only, bring your own key" a hard constraint** once a second provider key exists?
  If not, a small token-minting proxy becomes an option for the ElevenLabs key.
- **How much does barge-in matter compared with voice quality?** An external TTS provider makes
  barge-in and echo cancellation harder.
- **Who are the users:** the developer and household, or eventually the public? That decides how
  much hardening the localStorage key and self-XSS in profile cards need.
- **Other target languages?** That decides how general the model and voice registry should be.

## Open issues (GitHub)

- **#9: Mute the mic during AI playback** (a workaround for echo when not using a headset).
  Becomes important if an external TTS is adopted, because its audio may not be covered by
  WebRTC echo cancellation.
- **#10: Configurable mother tongue and persona guidance** for beginners who mix English and
  Spanish.
- **#11: Try a TURN server** to fix the Firefox-specific WebRTC disconnects.

## Known gaps

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
- **The start toast says "Hold the microphone button to speak"** (`app.js` `startConversation()`),
  but there is no push-to-talk.
