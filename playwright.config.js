import { defineConfig, devices } from '@playwright/test';

// Browser tests (docs/TESTING.md, "Browser tests"). Two projects:
// - app:  the real app in Playwright's Chromium against a FAKE OpenAI
//         (tests/browser/fake-openai.js). No key, no network, no cost.
// - live: the real OpenAI Realtime API with a synthesized Spanish voice as the
//         microphone (tests/browser/live/). Needs OPENAI_API_KEY in the
//         environment, costs a few cents a run, and is never run in CI.
// Both are separate from `npm test` (Vitest), which stays fast.
// Not 4173 (vite preview's default): with a server reused there, Playwright
// would silently test another project's app.
const PORT = 47231;
// The live project exists only when asked for (`npm run test:live` sets this).
// An OPENAI_API_KEY in the environment alone must never start paid runs: a
// plain `npx playwright test` once did, 2026-11-27.
const LIVE = process.env.HABLABOT_LIVE === '1';
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: 'tests/browser',
  // One worker keeps the live project's spend and the fake project's output
  // easy to follow; the app project is fast enough either way.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    viewport: { width: 1280, height: 800 },
    permissions: ['microphone'],
    // The service worker would sit between the page and Playwright's request
    // routing. Tests that are about the service worker opt back in.
    serviceWorkers: 'block',
  },
  webServer: {
    command: `node tests/browser/static-server.js ${PORT}`,
    url: BASE_URL,
    // Always our own server; a busy port fails loudly instead.
    reuseExistingServer: false,
  },
  projects: [
    {
      name: 'app',
      testIgnore: '**/live/**',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        // No fake-device flags: getUserMedia hangs in Playwright's browsers on
        // macOS even with them, so the fake layer supplies its own microphone.
      },
    },
    ...(LIVE ? [{
      name: 'live',
      testMatch: '**/live/**/*.spec.js',
      // A real conversation is slow: connection, turns of speech, timeouts.
      timeout: 240_000,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        // The learner's voice is played into the page by tests/browser/live/
        // speech.js, not a browser flag (see that file for why).
        // Never record: a trace would hold the token request's Authorization
        // header (the API key). live-fixtures.js sets this too; the config is
        // the one place a live spec can't bypass.
        trace: 'off',
        screenshot: 'off',
        video: 'off',
      },
    }] : []),
  ],
});
