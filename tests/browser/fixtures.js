// Shared Playwright fixtures for the browser tests.
import { test as base, expect } from '@playwright/test';
import { installFakeOpenAI } from './fake-openai.js';

// Not a credential: a well-formed placeholder so the app's format check
// (H.validateApiKey: "sk-", longer than 10) lets a session start. The fake
// layer answers every api.openai.com request, so it never leaves the browser.
export const FAKE_API_KEY = 'sk-test-browser-fake-key';

/** Seed localStorage before the app loads, as a returning learner would have it. */
export async function seedConfig(page, settings = {}) {
  await page.addInitScript((seed) => {
    if (!localStorage.getItem('hablabot-config')) {
      localStorage.setItem('hablabot-config', JSON.stringify(seed));
    }
  }, { openaiApiKey: FAKE_API_KEY, ...settings });
}

export const test = base.extend({
  // Console errors and uncaught exceptions, collected for every test so any
  // test can assert there were none.
  pageErrors: async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(`console.error: ${message.text()}`);
    });
    await use(errors);
  },

  // A page wired to the fake OpenAI layer. Yields the intercepted requests.
  fakeOpenAI: async ({ page }, use) => {
    await use(await installFakeOpenAI(page));
  },
});

export { expect };

/** Load the app and wait until its own initialization reports success. */
export async function openApp(page) {
  const initialized = page.waitForEvent('console', {
    predicate: (message) => message.text().includes('HablaBot initialized successfully'),
  });
  await page.goto('/');
  await initialized;
}

/** Start a conversation from the setup screen and wait for the session to open. */
export async function startConversation(page) {
  await page.locator('#start-conversation').click();
  await expect.poll(() => page.evaluate(() => window.__fakeRealtime?.channel?.readyState)).toBe('open');
}
