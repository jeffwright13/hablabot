import { describe, it, expect, beforeEach, vi } from 'vitest';
import { displayAppVersion } from '../js/utils/version.js';

describe('displayAppVersion', () => {
  let element;

  beforeEach(() => {
    element = document.createElement('span');
    element.textContent = 'v?.?.?';
  });

  function fetchReturning(body, ok = true) {
    return vi.fn().mockResolvedValue({ ok, json: () => Promise.resolve(body) });
  }

  it('fetches ./package.json and shows its version with a v prefix', async () => {
    const fetchFn = fetchReturning({ version: '0.2.0' });

    await displayAppVersion(element, fetchFn);

    expect(fetchFn).toHaveBeenCalledWith('./package.json');
    expect(element.textContent).toBe('v0.2.0');
  });

  it('keeps the HTML placeholder when the response is not ok', async () => {
    await displayAppVersion(element, fetchReturning({ version: '0.2.0' }, false));

    expect(element.textContent).toBe('v?.?.?');
  });

  it('keeps the placeholder when package.json has no version field', async () => {
    await displayAppVersion(element, fetchReturning({ name: 'hablabot' }));

    expect(element.textContent).toBe('v?.?.?');
  });

  it('keeps the placeholder and does not throw when the fetch rejects', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error('offline'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(displayAppVersion(element, fetchFn)).resolves.toBeUndefined();

    expect(element.textContent).toBe('v?.?.?');
    warn.mockRestore();
  });

  it('does nothing when the target element is missing', async () => {
    const fetchFn = fetchReturning({ version: '0.2.0' });

    await expect(displayAppVersion(null, fetchFn)).resolves.toBeUndefined();
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
