import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Toasts (H.showToast) had no desktop styling: the only .toast and
// .toast-container rules were overrides inside mobile.css's max-width: 768px
// block, so on desktop a toast was unstyled text after the page content and
// could land below the fold (PR #21 and #22 reviews). Every error, and Stage
// 13a's silent-transcription warning, is a toast. jsdom has no layout or CSS
// cascade, so, like version-label-contrast.test.js, this reads the CSS as text.
const WCAG_AA_NORMAL_TEXT = 4.5;
const MODAL_OVERLAY_Z_INDEX = 10000; // .modal-overlay in main.css
const TOAST_TYPES = ['info', 'success', 'warning', 'error']; // every type js/ passes to showToast

const cssDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'css');
const css = readFileSync(join(cssDir, 'main.css'), 'utf8');

function ruleBody(selector) {
  const escaped = selector.replace(/\./g, '\\.');
  const match = css.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`));
  if (!match) throw new Error(`${selector} rule not found in main.css`);
  return match[1];
}

function declaration(body, property) {
  const match = body.match(new RegExp(`(?:^|[;\\s])${property}:\\s*([^;]+);`));
  return match ? match[1].trim() : null;
}

function toRgb(hex) {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

function relativeLuminance([r, g, b]) {
  const [R, G, B] = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function contrastRatio(a, b) {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('toast styles (main.css, all screen sizes)', () => {
  it('pins the container to the viewport, above modals', () => {
    const body = ruleBody('.toast-container');
    expect(declaration(body, 'position')).toBe('fixed');
    expect(declaration(body, 'top')).not.toBeNull();
    expect(declaration(body, 'right')).not.toBeNull();
    expect(Number(declaration(body, 'z-index'))).toBeGreaterThan(MODAL_OVERLAY_Z_INDEX);
  });

  it('lets clicks pass through the empty container but not through a toast', () => {
    expect(declaration(ruleBody('.toast-container'), 'pointer-events')).toBe('none');
    expect(declaration(ruleBody('.toast'), 'pointer-events')).toBe('auto');
  });

  it('caps toast width on desktop (mobile.css lifts the cap)', () => {
    expect(declaration(ruleBody('.toast'), 'max-width')).not.toBeNull();
  });

  // Literal hex colors, not var(--white)/var(--gray-*): the dark scheme in
  // mobile.css redefines those as surface colors, which broke the version
  // label once. Literals keep each pair identical in both schemes.
  for (const type of TOAST_TYPES) {
    it(`.toast.${type} has literal colors with AA contrast in both schemes`, () => {
      const body = ruleBody(`.toast.${type}`);
      const background = declaration(body, 'background-color');
      const color = declaration(body, 'color');
      expect(background, 'background-color').toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(color, 'color').toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(contrastRatio(toRgb(color), toRgb(background))).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT);
    });
  }

  it('styles the close button so it inherits the toast text color', () => {
    expect(declaration(ruleBody('.toast-close'), 'color')).toBe('inherit');
  });
});
