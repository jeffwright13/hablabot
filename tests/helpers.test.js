import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import H from '../js/utils/helpers.js';

const TOAST_FADE_MS = 300; // the fade-out before removal in showToast

describe('H.showToast duration', () => {
  let container;

  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '<div id="toast-container" class="toast-container"></div>';
    container = document.getElementById('toast-container');
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('removes a toast after its duration and the fade', () => {
    H.showToast('Saved', 'success', 3000);
    expect(container.children).toHaveLength(1);
    vi.advanceTimersByTime(3000 + TOAST_FADE_MS);
    expect(container.children).toHaveLength(0);
  });

  it('keeps a TOAST_UNTIL_CLOSED toast until its close button is clicked', () => {
    H.showToast('Transcription returned nothing', 'error', H.TOAST_UNTIL_CLOSED);
    vi.advanceTimersByTime(60 * 60 * 1000);
    expect(container.children).toHaveLength(1);

    container.querySelector('.toast-close').click();
    expect(container.children).toHaveLength(0);
  });
});
