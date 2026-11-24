import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Every js/ file assigns to `window.HablaBotX` at import time, so `window`
    // must exist even for otherwise pure-logic modules — jsdom globally, not
    // per-file.
    environment: 'jsdom',
    include: ['tests/**/*.test.js'],
    coverage: {
      provider: 'v8',
      // Everything index.html ships. js/speech/ isn't loaded (dead code since
      // the Realtime API migration), so it doesn't count. sw.js runs in a
      // service-worker scope that v8 can't instrument here; its precache list
      // is guarded by tests/sw-precache.test.js instead.
      include: ['js/**/*.js'],
      exclude: ['js/speech/**'],
      reporter: ['text', 'html'],
      // Ratchet, not a target: set to the measured figures (rounded down) and
      // raised as each PLAN.md stage adds tests. Last raised 2026-11-24
      // (hide-vocabulary flag, incl. PR #19 review): global 36/80/43/36 -> 36/81/45/36. The aim is
      // dreaming-tools' 80/90/90/90. Never lower a number to get a commit
      // through; add the missing tests instead (see docs/TESTING.md).
      thresholds: {
        statements: 36,
        branches: 81,
        functions: 45,
        lines: 36,
        // The core conversation path is already well covered. A per-glob
        // floor stops a regression there from hiding behind the large,
        // untested files that dominate the global numbers. Vitest checks this
        // against the COMBINED figure for every file under js/realtime/
        // (95.4 / 88.02 / 84.61 / 95.4 after Stage 2), not any one file's
        // row in the report, so that combined figure is what gets rounded
        // down here.
        'js/realtime/**': {
          statements: 95,
          branches: 88,
          functions: 84,
          lines: 95,
        },
      },
    },
  },
});
