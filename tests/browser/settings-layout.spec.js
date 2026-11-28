// Where the Settings rows' extra items actually land. tests/settings-layout.test.js
// checks the CSS rule exists; this checks the layout, so an overriding rule or
// a wrapper element would be caught (PR #25 review).
import { test, expect, openApp } from './fixtures.js';

// Each extra item, and the control it belongs under.
const ROWS = [
  { item: '#test-api-key', control: '#openai-api-key' },
  { item: '#select-user-btn', control: '#current-user-display' },
  { item: '#speech-rate-value', control: '#speech-rate' },
  { item: '#speech-volume-value', control: '#speech-volume' },
];
const PIXEL_TOLERANCE = 1;

async function openSettings(page) {
  await openApp(page);
  await page.locator('#settings-btn').click();
  await expect(page.locator('#settings-view')).toBeVisible();
}

const box = (page, selector) => page.locator(selector).boundingBox();

test.describe('Settings rows on desktop', () => {
  test('each extra item sits directly under its control', async ({ page }) => {
    await openSettings(page);
    for (const { item, control } of ROWS) {
      const [itemBox, controlBox] = [await box(page, item), await box(page, control)];
      expect(Math.abs(itemBox.x - controlBox.x), `${item} x vs ${control}`).toBeLessThanOrEqual(PIXEL_TOLERANCE);
      expect(itemBox.y, `${item} below ${control}`).toBeGreaterThanOrEqual(controlBox.y + controlBox.height);
    }
  });

  // Firefox's password manager injects an element next to the key field
  // (which is why Firefox looked right before the fix). It must not push the
  // Test button out of the control column. This passes without the fix too;
  // it guards against a narrower rule such as :nth-child(3), which would put
  // the injected element in column 2 and the Test button back in column 1.
  test('the Test button stays under the key field when an element is injected into the row', async ({ page }) => {
    await openSettings(page);
    await page.evaluate(() => {
      const injected = document.createElement('div');
      injected.textContent = 'injected';
      document.querySelector('#openai-api-key').after(injected);
    });
    const [testButton, keyField] = [await box(page, '#test-api-key'), await box(page, '#openai-api-key')];
    expect(Math.abs(testButton.x - keyField.x)).toBeLessThanOrEqual(PIXEL_TOLERANCE);
  });
});

test.describe('Settings rows on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('stack in one column, each item below its control at the same left edge', async ({ page }) => {
    await openSettings(page);
    for (const { item, control } of ROWS) {
      const [itemBox, controlBox] = [await box(page, item), await box(page, control)];
      expect(Math.abs(itemBox.x - controlBox.x), `${item} x vs ${control}`).toBeLessThanOrEqual(PIXEL_TOLERANCE);
      expect(itemBox.y, `${item} below ${control}`).toBeGreaterThanOrEqual(controlBox.y + controlBox.height);
    }
  });
});
