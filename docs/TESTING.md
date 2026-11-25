# Testing

_How HablaBot is tested, what each layer can and can't prove, and the manual checks that remain.
Follows `~/coding/CLAUDE.md`: test-driven development is mandatory._

---

## Workflow: Red → Green → Refactor

Every behavior change, bug fix included, starts with a test that fails for the right reason. Then
write the smallest code that passes it, then tidy up. Run the full suite after each change, and
paste the actual output (not a summary) before calling anything done. When a bug is found by
hand, first write a test that reproduces it.

## Support Policy

- **Chrome / Chromium-based (current stable):** supported, and the reference browser for live
  checks.
- **Firefox (current stable):** works, but has a known intermittent WebRTC disconnect (NAT/UDP
  keepalive; see `DECISIONS.md`, 2026-07-22) that auto-reconnect works around. Issue #11
  (TURN server) is open.
- **Safari, Edge, mobile:** not tested. Make no support claims for them.

Record the browser and OS version in any DECISIONS entry that depends on a live check.

## Test Layers

### 1. Unit and DOM tests (automated)

```bash
npm test            # vitest run, the same command the pre-commit hook and CI run
npm run test:watch
```

- Vitest with jsdom set globally (`vitest.config.js`), because every `js/` file assigns
  `window.HablaBotX` when it is imported.
- Source files need no changes to be testable. Each one ends with a CommonJS `module.exports`
  shim that Vitest's ESM `import` reads directly. **New `js/` modules must follow the same
  pattern** (see `js/utils/version.js` for a minimal example).
- Inject anything with side effects (`fetch`, timers, `RTCPeerConnection`, `getUserMedia`) as a
  parameter or a stubbed global. Never make real network calls in a unit test.
- The file for `js/<path>/<module>.js` is `tests/<module>.test.js`.

Current coverage, by module:

| Module | Test file | Notes |
|---|---|---|
| `js/realtime/session.js` | `realtime-session.test.js` | connect payloads, reconnects, transcript extraction, de-duplication, diagnostics |
| `js/realtime/turn-profiles.js` | `turn-profiles.test.js` | |
| `js/realtime/session-vocab-bridge.js` | `session-vocab-bridge.test.js` | |
| `js/vocabulary/manager.js` | `vocabulary-manager.test.js` | |
| `js/ai/prompts.js` | `prompts.test.js` | scenarios, starters, and Mexican Spanish dialect consistency across every prompt and starter |
| `js/utils/config.js` | `config.test.js` | |
| `js/utils/version.js` | `version.test.js` | |
| `js/utils/models.js` | `models.test.js` | registry, retired-ID migration, and a **shutdown tripwire** that fails 30 days before a default model's announced shutdown |
| `js/ui/model-settings.js` | `model-settings.test.js` | Settings → Advanced model overrides |
| `js/utils/features.js` | `features.test.js` | feature flags: vocabulary hidden by default; no target words and no Vocabulary tab while off |
| `sw.js` ↔ `index.html` | `sw-precache.test.js` | precache list must match the loaded scripts; reads both as text |
| `css/main.css` `.app-version` | `version-label-contrast.test.js` | WCAG AA contrast against both header gradient stops; reads the CSS as text |
| `js/app.js` | **none** | harness planned (`PLAN.md`, Stage 5) |
| `js/storage/database.js` | **none** | jsdom has no IndexedDB; needs `fake-indexeddb` |
| `js/utils/user-manager.js`, `js/ui/*` | **none** | |

### Coverage

```bash
npm run test:coverage   # suite + v8 coverage; also what CI runs. HTML report in coverage/
```

`vitest.config.js` enforces minimums, and the run fails below any of them. They are a **ratchet,
not a target**: each was set to the measured figure (rounded down) and only goes up. When a stage
adds tests, raise the numbers to the new measurement in the same commit. Never lower one to get a
commit through; write the missing tests instead. The long-term aim is dreaming-tools' 80%
branches and 90% everything else.

| Scope | Statements | Branches | Functions | Lines | Set |
|---|---|---|---|---|---|
| All shipped `js/**` (excluding the unloaded `js/speech/`) | 36 | 81 | 45 | 36 | Vocabulary flag (2026-11-24): 36.87 / 81.59 / 45.33 / 36.87. Baseline was 30 / 78.37 / 35.82 / 30 |
| `js/realtime/**` | 95 | 88 | 84 | 95 | Stage 2 (2026-11-24): 95.42 / 88.27 / 84.61 / 95.42. Baseline was 94.53 / 87.06 / 83.33 / 94.53 |

The global numbers are low because `app.js`, `database.js`, `user-manager.js`, `js/ui/*` and the
dead `audio.js` have no tests. Branch coverage looks high only because untested
files contribute few counted branches. The separate `js/realtime/**` floor exists because, in a
global average dominated by untested files, a real regression in the core conversation path would
barely move the totals. Vitest checks a glob floor against the **combined** figure for every
matching file (the `js/realtime` folder row in the report), not against any single file's row.

### Dependency audit

The app ships **no npm packages**: `package.json` holds only test tooling. CI therefore runs
`npm audit --omit=dev` as a blocking step (today: 0 vulnerabilities) and the full `npm audit` as a
reported step that doesn't block but adds a warning annotation to the PR's checks summary, so
advisories stay visible. This is the same policy as dreaming-tools. Every current advisory is in
Vitest 2 and its tooling, and fixing them needs a major Vitest upgrade (tracked in `TODO.md`).

### 2. Live voice checks (manual)

A real conversation needs a real OpenAI key, a microphone and a browser, so it can't run in CI.
Run these before merging anything that touches `js/realtime/`, `js/ai/prompts.js`, voice
settings or `sw.js`, and record what you ran in the PR.

First, in DevTools → Application, **unregister the service worker and clear site data**, or
confirm that the version label shows the new version. A stale cache has faked a failing fix
before.

- [ ] Start a session at each difficulty. The tutor greets you once, in Spanish.
- [ ] While vocabulary practice is hidden: there's no Vocabulary tab in the navigation, and during
      a session `HablaBotApp.currentSession.targetWords` is `[]` in the console. (The prompt
      itself travels over the WebRTC data channel, which DevTools' Network panel doesn't show.)
- [ ] Beginner: a 2-second thinking pause doesn't trigger a reply. Advanced: replies come quickly.
- [ ] User and AI transcripts each appear exactly once, with the correct speaker. **Check your
      own turns especially:** a transcription model the session doesn't support gives no error
      at all, just a conversation where only the tutor's lines appear (SPEC §4).
- [ ] Barge-in: talking over the tutor stops its audio.
- [ ] The tutor keeps a consistent Mexican accent and vocabulary (e.g. says "departamento", not
      "piso" or "apartamento") across turns and difficulties, and never speaks stage directions.
      **A check that needs no fluency:** ask her to say "cerveza, zapato, gracias, cinco". Mexican
      seseo sounds like **s** ("ser-VE-sa"); Castilian sounds like English **th** ("ther-VE-tha").
      Also skim her transcripts for Spain markers: vosotros, os, coche, vale, piso.
- [ ] Voice, speech rate and volume settings apply to the next session.
- [ ] Settings → Advanced: the placeholders show the default model IDs, and the note shows the
      last-checked date and any shutdown date. An override persists across a reload. A bogus
      override (e.g. `gpt-does-not-exist`) gives the named-model error pointing to Settings, not a
      generic "Connection error". Clear it afterwards.
- [ ] End Session saves: DevTools → IndexedDB → `sessions` has the transcript and `wordsUsed`.
- [ ] The timer reaching zero ends and saves the session.
- [ ] A wrong API key gives a clear error and moves you to Settings.
- [ ] Firefox: run past 60 s. If it reconnects, the conversation continues without a re-greeting.
- [ ] The console shows no errors except expected diagnostics.
- [ ] Check new or changed UI in **both** light and dark mode (DevTools → Rendering → Emulate
      `prefers-color-scheme`). `css/mobile.css` redefines `--white` and the `--gray-*` variables in
      dark mode, so they are theme surface colors, not literal colors.

### 3. Release checklist

- [ ] `npm run test:coverage` passes; paste the output into the PR. If coverage rose, raise the
      minimums in `vitest.config.js` to match.
- [ ] Live voice checks done in Chrome (and Firefox if anything in `js/realtime/` changed).
- [ ] **Model check:** read OpenAI's deprecations page and update the `SPEC.md` §7 table and its
      "last checked" date. Model IDs change often; see `BRIEF.md`.
- [ ] `CACHE_NAME` in `sw.js` was bumped if any precached file was added or removed.
- [ ] Docs updated in the same commit as the code: SPEC section edited in place, DECISIONS entry
      for anything non-obvious, TODO and PLAN adjusted.
- [ ] Version bumped with `npm version <patch|minor|major>`, and the tag pushed
      (`git push origin main --tags`).

## Test Gate (pre-commit hook)

A pre-commit hook runs `npm test` and blocks the commit if it fails. Git doesn't version hooks, so
install it once per clone:

```bash
cat > .git/hooks/pre-commit <<'EOF'
#!/bin/sh
# Block the commit if the test suite fails. Bypass in an emergency with
# `git commit --no-verify`.
echo "pre-commit: running npm test"
npm test --silent || {
  echo "pre-commit: tests failed; commit aborted." >&2
  exit 1
}
EOF
chmod +x .git/hooks/pre-commit
```

This is the same script `~/coding/dreaming-tools` uses. The hook runs `npm test` (fast, no
coverage). CI (`.github/workflows/test.yml`, Node 20 and 22) runs `npm run test:coverage` and the
dependency audits on every push and PR to `main`, so a coverage drop is caught at the PR even
though the hook doesn't check it.
