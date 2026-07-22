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
