// Startup in a real browser: the whole script chain in index.html, which the
// Vitest suite only ever loads one file at a time.
import { test, expect, openApp, seedConfig } from './fixtures.js';

test.describe('startup', () => {
  test('a first visit (empty storage) initializes with no errors', async ({ page, pageErrors }) => {
    await openApp(page);

    await expect(page.locator('#conversation-btn')).toBeVisible();
    await expect(page.locator('.error-screen, .app-error')).toHaveCount(0);
    await expect(page.getByText('Failed to initialize application')).toHaveCount(0);
    expect(pageErrors).toEqual([]);
  });

  test('a returning learner (saved key) initializes with no errors', async ({ page, pageErrors }) => {
    await seedConfig(page);
    await openApp(page);

    await expect(page.getByText('Failed to initialize application')).toHaveCount(0);
    expect(pageErrors).toEqual([]);
  });

  test('the header shows the package.json version', async ({ page, request }) => {
    const { version } = await (await request.get('/package.json')).json();
    await openApp(page);
    await expect(page.locator('#app-version')).toHaveText(`v${version}`);
  });

  test.describe('with the service worker', () => {
    test.use({ serviceWorkers: 'allow' });

    // The user saw "Failed to initialize application" once on a first Chrome
    // load (2026-11-25), cleared by a reload; cause unknown. These cover the
    // service worker's install and its takeover of a second load.
    test('installs, and a reload under its control still initializes', async ({ page, pageErrors }) => {
      await openApp(page);
      await expect.poll(() => page.evaluate(async () => {
        const registration = await navigator.serviceWorker.ready;
        return registration.active?.state;
      })).toBe('activated');

      await openApp(page);
      expect(await page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
      await expect(page.getByText('Failed to initialize application')).toHaveCount(0);
      expect(pageErrors).toEqual([]);
    });
  });
});
