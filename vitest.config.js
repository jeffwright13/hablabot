import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Every js/ file assigns to `window.HablaBotX` at import time (e.g.
    // spaced-repetition.js:372), so `window` must exist even for otherwise
    // pure-logic modules — jsdom globally, not per-file.
    environment: 'jsdom',
    include: ['tests/**/*.test.js'],
  },
});
