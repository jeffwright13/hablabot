// Layout checks that need a real layout engine. tests/toast-styles.test.js and
// version-label-contrast.test.js check the CSS text; these check where things
// actually land, which is how the unstyled-toast and Settings-grid bugs got
// past the unit tests.
import { test, expect, openApp } from './fixtures.js';

const LONG_WARNING = 'Transcription model "gpt-transcribe" returned nothing for your last 2 turns, '
  + 'so they won\'t appear in the history. Change it in Settings → Advanced.';

async function showToasts(page) {
  await page.evaluate((longText) => {
    for (const type of ['info', 'success', 'warning']) window.H.showToast(`Sample ${type}`, type, 60_000);
    window.H.showToast(longText, 'error', 60_000);
  }, LONG_WARNING);
  // Toasts slide in from the right; measure where they come to rest.
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState === 'finished'));
}

/** The element actually hit at the centre of a locator's box. */
function hitAtCentre(page, selector) {
  return page.evaluate((sel) => {
    const box = document.querySelector(sel).getBoundingClientRect();
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    return hit?.closest(sel) ? 'self' : (hit?.className || hit?.tagName || 'nothing');
  }, selector);
}

for (const colorScheme of ['light', 'dark']) {
  test.describe(`toasts on desktop (${colorScheme})`, () => {
    test.use({ colorScheme });

    test('sit fixed at the top right, below the header, without covering its nav', async ({ page }) => {
      await openApp(page);
      await showToasts(page);

      const container = page.locator('#toast-container');
      expect(await container.evaluate((el) => getComputedStyle(el).position)).toBe('fixed');
      const header = await page.locator('.app-header').boundingBox();
      const toasts = await container.boundingBox();
      for (const toast of await page.locator('.toast').all()) {
        expect((await toast.boundingBox()).y).toBeGreaterThanOrEqual(header.y + header.height);
      }
      expect(toasts.x + toasts.width).toBeGreaterThan(1280 * 0.75);
      for (const nav of ['#conversation-btn', '#settings-btn']) {
        expect(await hitAtCentre(page, nav), nav).toBe('self');
      }
    });

    test('stay visible after scrolling, with each type colored', async ({ page }) => {
      await openApp(page);
      await showToasts(page);
      await page.mouse.wheel(0, 2000);

      const toasts = page.locator('.toast');
      await expect(toasts).toHaveCount(4);
      for (const toast of await toasts.all()) await expect(toast).toBeInViewport();
      const backgrounds = await toasts.evaluateAll((els) => els.map((el) => getComputedStyle(el).backgroundColor));
      expect(new Set(backgrounds).size).toBe(4);
      expect(backgrounds).not.toContain('rgba(0, 0, 0, 0)');
    });
  });
}

test.describe('toasts on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  // KNOWN BUG, PLAN Stage 5 (PR #24 review): mobile.css pins toasts over the
  // header. This asserts the bug as it is today, so a broken selector or a
  // failed setup fails loudly (test.fail() would have hidden those). When
  // Stage 5 fixes it, this fails: flip it to "below the header", as on desktop.
  test('cover the header (known bug: assert it until Stage 5 fixes it)', async ({ page }) => {
    await openApp(page);
    await showToasts(page);
    const header = await page.locator('.app-header').boundingBox();
    const toasts = page.locator('.toast');
    await expect(toasts).toHaveCount(4);
    const firstToast = await toasts.first().boundingBox();
    expect(firstToast.y).toBeLessThan(header.y + header.height);
  });
});
