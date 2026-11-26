import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
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

// app.js has no test harness yet (PLAN Stage 5), so its one line of wiring
// is checked as text: the session's { persistent: true } flag must reach
// showToast as TOAST_UNTIL_CLOSED.
describe('app.js onError wiring', () => {
  const appJs = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'js', 'app.js'), 'utf8');
  const handler = appJs.match(/this\.realtimeSession\.onError = \(([^)]*)\) => \{([\s\S]*?)\n    \};/);

  it('takes the meta argument and keeps persistent errors until closed', () => {
    expect(handler, 'onError handler not found in app.js').not.toBeNull();
    expect(handler[1]).toMatch(/message,\s*meta/);
    expect(handler[2]).toMatch(/meta\?\.persistent\s*\?\s*H\.TOAST_UNTIL_CLOSED/);
  });
});
