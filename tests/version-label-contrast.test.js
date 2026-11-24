import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// The header version label is small text (0.75rem), so WCAG AA requires a
// contrast of at least 4.5:1 against what is behind it: the header gradient,
// from --primary-color to --primary-dark. PR #14 review found the first
// version (--gray-600 text) at 1.5–2.1:1. jsdom has no layout or CSS
// cascade, so this reads the CSS as text and does the WCAG math itself.
//
// Checked in BOTH color schemes: css/mobile.css's prefers-color-scheme: dark
// block redefines variables (notably --white becomes #1a1a1a, a dark surface
// color), and the first fix used var(--white) for the label text, which made
// it near-black in dark mode (~2.7:1). Found in a browser check during
// Stage 2; this test only read light-mode values at the time.
const WCAG_AA_NORMAL_TEXT = 4.5;

const cssDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'css');
const css = readFileSync(join(cssDir, 'main.css'), 'utf8');
const mobileCss = readFileSync(join(cssDir, 'mobile.css'), 'utf8');

// Variable overrides inside mobile.css's dark-scheme :root block.
const darkRoot = (() => {
  const block = mobileCss.match(/@media \(prefers-color-scheme: dark\)\s*\{\s*:root\s*\{([^}]*)\}/);
  if (!block) throw new Error('dark-scheme :root block not found in mobile.css');
  return block[1];
})();

function cssVariable(name, scheme = 'light') {
  const pattern = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`);
  const dark = scheme === 'dark' ? darkRoot.match(pattern) : null;
  const match = dark || css.match(pattern);
  if (!match) throw new Error(`--${name} not found`);
  return match[1];
}

function ruleBody(selector) {
  const match = css.match(new RegExp(`${selector.replace('.', '\\.')}\\s*\\{([^}]*)\\}`));
  if (!match) throw new Error(`${selector} rule not found in main.css`);
  return match[1];
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

// Composite a translucent rgba() layer over an opaque color.
function composite([r, g, b, alpha], under) {
  return [r, g, b].map((v, i) => Math.round(alpha * v + (1 - alpha) * under[i]));
}

function parseColor(value, scheme) {
  const varRef = value.match(/var\(--([\w-]+)\)/);
  if (varRef) return [...toRgb(cssVariable(varRef[1], scheme)), 1];
  const rgba = value.match(/rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/);
  if (rgba) return rgba.slice(1).map(Number);
  if (/^#[0-9a-fA-F]{6}$/.test(value)) return [...toRgb(value), 1];
  throw new Error(`Unsupported color value: ${value}`);
}

function declaration(body, property) {
  const match = body.match(new RegExp(`(?:^|;|\\s)${property}:\\s*([^;]+);`));
  return match ? match[1].trim() : null;
}

describe('header version label contrast', () => {
  const label = ruleBody('.app-version');

  it.each([
    ['light', 'lighter', 'primary-color'],
    ['light', 'darker', 'primary-dark'],
    ['dark', 'lighter', 'primary-color'],
    ['dark', 'darker', 'primary-dark'],
  ])('meets WCAG AA (4.5:1) in the %s scheme against the %s end of the header gradient', (scheme, _end, stopVar) => {
    const headerColor = toRgb(cssVariable(stopVar, scheme));
    const background = declaration(label, 'background-color');
    const behindText = background ? composite(parseColor(background, scheme), headerColor) : headerColor;
    const text = composite(parseColor(declaration(label, 'color'), scheme), behindText);

    expect(contrastRatio(text, behindText)).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT);
  });

  it('uses no opacity, which would fade the text below the computed ratio', () => {
    expect(declaration(label, 'opacity')).toBeNull();
  });
});
