# CLAUDE.md

Guidance for Claude Code when working in this repository. It **adds to** `~/coding/CLAUDE.md`
(global working preferences, git workflow, TDD, versioning, documentation conventions); it does
not replace it. Where the two differ, this file wins for this repo only.

Reference repos for conventions: `~/coding/krashen` (docs set, decision-entry format, model
migration) and `~/coding/dreaming-tools` (TESTING/TODO/PRIVACY docs, pre-commit test gate,
coverage thresholds).

## Project Overview

HablaBot is a **Progressive Web App** for spoken Spanish conversation practice with an AI tutor.
It runs entirely in the browser: no build system, no bundler, no framework, no backend. All
JavaScript is loaded by `<script>` tags in `index.html` and exposes globals on `window`.
`package.json` and `node_modules` exist only for the Vitest suite; they play no part in running
the app.

What it is, who it's for, and the hard constraints: `docs/BRIEF.md`. How each feature behaves
today: `docs/SPEC.md`.

## Docs: read before changing, update in the same commit

| File | Kind | Rule |
|---|---|---|
| `docs/BRIEF.md` | Stable | Change only when the fundamentals change. |
| `docs/SPEC.md` | Living | Edit the affected section **in place** so it always matches the code. §7 is the AI model table. |
| `docs/DECISIONS.md` | Append-only | New entries go **at the bottom** (the log is oldest-first). Never rewrite old entries; supersede them with a new one that says so. |
| `docs/PLAN.md` | Living | Staged work with status. Update a stage's status as it lands. |
| `docs/TODO.md` | Living | Open, unscheduled items. Remove an item once it's decided, recording it in DECISIONS and SPEC. |
| `docs/TESTING.md` | Living | Test layers, the test gate, manual live checklists, release checklist. |
| `PRIVACY.md` | Living | What data goes where. Update with **any** change to storage or network destinations. |
| `docs/archive/` | Frozen | Superseded documents, kept for history. |

New DECISIONS entries use krashen's format:

```markdown
## YYYY-MM-DD — <decision in a few words>
**Decision:** what was chosen, naming the files and symbols.
**Rationale:** why, including the alternatives rejected and why.
**Verified:** the tests added or changed, and any live check (browser + version).
```

A change isn't done until its docs are: check SPEC, DECISIONS, PLAN, TODO, PRIVACY and README
every time.

## Test-Driven Development (mandatory)

- **Red → Green → Refactor for every behavior change, bug fixes included.** Write the failing
  test, run it, see it fail for the right reason, then implement. When a bug is found by hand,
  write the test that reproduces it before fixing it.
- `npm test` runs the suite once, `npm run test:watch` re-runs it on changes. Paste the actual
  output before calling anything done.
- `npm run test:coverage` adds v8 coverage with **ratcheting minimums** in `vitest.config.js`, and
  is what CI runs. When tests raise coverage, raise the minimums to the new measurement in the
  same commit. Never lower them; see `docs/TESTING.md`.
- A **pre-commit hook** runs `npm test` and blocks the commit if it fails. Git doesn't version
  hooks, so the install snippet is in `docs/TESTING.md`. Never bypass it with `--no-verify`
  unless the user asks.
- `vitest.config.js` sets `environment: 'jsdom'` globally, because every `js/` file assigns
  `window.HablaBotX` when imported.
- **New `js/` modules follow the existing pattern:** set one `window.HablaBotX` global, then end
  with `if (typeof module !== 'undefined' && module.exports) { module.exports = ...; }` so tests
  can `import` them. Pass side effects in (`fetchFn`, timers) rather than reaching for globals;
  see `js/utils/version.js`.
- Tests never make real network calls. Stub `fetch`, `RTCPeerConnection`, `getUserMedia`, and
  `indexedDB` (jsdom has none).
- Anything that needs a real API key, microphone or browser goes on the **manual live checklist**
  in `docs/TESTING.md`. Run it before merging changes to `js/realtime/`, prompts, voice settings
  or `sw.js`. Use Chrome as the reference browser; Firefox has a known WebRTC disconnect issue.
- `tests/sw-precache.test.js` fails if `sw.js`'s `STATIC_CACHE_URLS` stops matching the scripts
  `index.html` loads. When it fails, fix the list **and bump `CACHE_NAME`**. A stale service
  worker once made a working fix look broken through an entire investigation.

## AI Models: expect churn

OpenAI's supported models and Realtime API shapes change often. GPT-4o and 4.1 retire on
2027-01-14; the Realtime schema changed once already, in July 2026.

- **Never hardcode a model ID outside `js/utils/models.js`** (`HablaBotModels`). Add a role to
  `DEFAULT_MODELS` and resolve it with `resolveModels(config.get('models'))`. `session.js` takes
  IDs as options and contains none.
- When a model is deprecated: add its shutdown to `KNOWN_SHUTDOWNS` (this arms the 30-day
  tripwire test). When it retires: add it to `RETIRED_MODELS` with its documented replacement,
  so saved Settings overrides migrate on load. **Never silence the tripwire.** Pick, live-test
  and switch to a replacement instead.
- Before any model-related change, **read the provider's current models and deprecations
  pages**, then update the SPEC §7 table and its "last checked" date.
- Stored settings override defaults. That's why `Config.load()` migrates retired IDs and saves
  the fix (the `krashen` `migrateRetiredModels()` pattern).
- Treat the provider's docs as possibly stale: confirm wire-level changes with a live test, and
  record in DECISIONS what was confirmed and how.

## Running the App

Requires HTTPS or localhost, because of `getUserMedia` and WebRTC.

```bash
npm run serve            # npx serve . — prints the URL (defaults to port 3000)
python3 -m http.server 8000   # without Node
```

There is no build step and no linter. Before a live test, unregister the service worker or check
that the header's version label shows the new version.

## Versioning

SemVer per `~/coding/CLAUDE.md`. The version lives in `package.json` and changes only through
`npm version <patch|minor|major>`; push the tags. The header reads it at runtime
(`js/utils/version.js`).

## Architecture

### Script loading order (`index.html`): dependency order matters

1. `js/utils/models.js` → `window.HablaBotModels` (the model registry; must come before config,
   which uses it while loading)
2. `js/utils/config.js` → `window.HablaBotConfig`
3. `js/utils/version.js` → `window.HablaBotVersion`
4. `js/utils/features.js` → `window.HablaBotFeatures` (feature flags; **vocabulary practice is
   hidden** behind `vocabularyEnabled: false`, see PLAN Stage 8)
5. `js/utils/helpers.js` → `window.H` (DOM helpers: `H.$()`, `H.show()`, `H.hide()`, `H.showToast()`, `H.escapeHtml()`)
6. `js/utils/user-manager.js` → `window.HablaBotUserManager`
7. `js/storage/database.js` → `window.HablaBotDB`
8. `js/ui/state.js` → `window.HablaBotUIState`
9. `js/ui/components.js` → `window.HablaBotComponents`
10. `js/ui/model-settings.js` → `window.HablaBotModelSettings` (Settings → Advanced model overrides)
11. `js/realtime/session.js` → `window.HablaBotRealtimeSession`
12. `js/realtime/session-vocab-bridge.js` → `window.HablaBotSessionVocabBridge`
13. `js/realtime/turn-profiles.js` → `window.HablaBotTurnProfiles`
14. `js/ai/prompts.js` → `window.HablaBotPrompts`
15. `js/vocabulary/manager.js` → `window.HablaBotVocabulary`
16. `js/utils/audio.js` → `window.HablaBotAudio`. **Unused**; to be deleted in PLAN Stage 5.
17. `js/app.js` → `window.HablaBotApp` (main controller, initialized on DOMContentLoaded)

`js/speech/recognition.js` and `js/speech/synthesis.js` are on disk but not loaded; this is dead
code. Deleted: `js/vocabulary/spaced-repetition.js` (2026-07-23, SM-2 removed) and
`js/ai/conversation.js` (2026-11-24, the orphaned GPT-4 chat engine).

### Key patterns

- **No ES modules at runtime.** Each file creates one global singleton.
- **Multiple users:** each profile has its own IndexedDB database. `HablaBotUserManager` keeps
  profiles in `localStorage`, and `HablaBotDB.init()` opens the active profile's database.
- **Config:** `localStorage['hablabot-config']`, merged over defaults. The API key is stored there
  in plain text, shared by all profiles. Several config keys are leftovers (SPEC §5).

### A conversation turn

Turn-taking is managed entirely by the server (Realtime API server-side VAD).
`HablaBotApp.beginUserTurn()` is a deliberate no-op that records this.

1. `startConversation()` resolves the model IDs (`HablaBotModels.resolveModels`), gets the target
   words through `HablaBotFeatures.selectTargetWords()` (`[]` while vocabulary practice is hidden;
   otherwise up to 5 from `vocabularyManager.selectWordsForSession({ difficulty, scenario })`),
   builds the prompt
   (`HablaBotPrompts.generateSystemPrompt`), and calls `HablaBotRealtimeSession.connect()` with
   the voice, speed, volume and per-difficulty `turnDetection`
   (`HablaBotTurnProfiles.getTurnDetectionConfig`).
2. VAD speech start and stop drive the listening indicator (`onUserSpeechStart` /
   `onUserSpeechEnd`).
3. The user's speech is transcribed on the server and arrives through `onUserTranscript`. It is
   appended to the on-screen history and to `currentSession.conversationHistory`, and passed to
   `HablaBotSessionVocabBridge.trackUserTranscript()`, which **only tallies** target-word usage
   (no scheduling).
4. The reply streams back as audio (a WebRTC remote track, played by an auto-created `<audio>`)
   and as transcript text (`onAITranscript` deltas, then the final text, committed once).
5. `endConversation()` collects `getWordsUsed()`, saves the session, then disconnects.

### Voice output (TTS)

**There is no separate TTS stage.** The Realtime model is speech-to-speech, and the on-screen text
is a transcript of its audio. The voice (`realtimeVoice`), speed (`audio.output.speed`) and volume
(client-side `audioEl.volume`) Settings are all wired through. An external TTS provider would mean
a cascade pipeline; see `docs/PLAN.md` Stages 6–7 before attempting it.

### Storage

- **IndexedDB** (`HablaBotDB`, per profile: `{userId prefix}HablaBotDB`): `vocabulary`,
  `sessions` (including full transcripts), `userSettings`, `conversationHistory`.
- **localStorage:** `hablabot_users`, `hablabot_current_user`, `hablabot-config`.

### PWA

`sw.js` is network-first with a cache fallback, and bypasses `api.openai.com` and
`api.elevenlabs.io`. `manifest.json` is present; real icons are not (only `assets/icons/placeholder.txt`).
