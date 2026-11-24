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
      // Ratchet, not a target: set to the measured baseline (rounded down) on
      // 2026-11-24 and raised as each PLAN.md stage adds tests. The aim is
      // dreaming-tools' 80/90/90/90. Never lower a number to get a commit
      // through; add the missing tests instead (see docs/TESTING.md).
      thresholds: {
        statements: 30,
        branches: 78,
        functions: 35,
        lines: 30,
        // The core conversation path is already well covered. A per-glob
        // floor stops a regression there from hiding behind the large,
        // untested files that dominate the global numbers.
        'js/realtime/**': {
          statements: 93,
          branches: 85,
          functions: 77,
          lines: 93,
        },
      },
    },
  },
});
