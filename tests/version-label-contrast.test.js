import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// The header version label is small text (0.75rem), so WCAG AA requires a
// contrast of at least 4.5:1 against what is behind it: the header gradient,
// from --primary-color to --primary-dark. PR #14 review found the first
// version (--gray-600 text) at 1.5–2.1:1. jsdom has no layout or CSS
// cascade, so this reads css/main.css as text and does the WCAG math itself.
const WCAG_AA_NORMAL_TEXT = 4.5;

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'css', 'main.css'), 'utf8');

function cssVariable(name) {
  const match = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!match) throw new Error(`--${name} not found in main.css`);
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

function parseColor(value) {
  const varRef = value.match(/var\(--([\w-]+)\)/);
  if (varRef) return [...toRgb(cssVariable(varRef[1])), 1];
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
  const gradientStops = [cssVariable('primary-color'), cssVariable('primary-dark')].map(toRgb);

  it.each([
    ['lighter', 0],
    ['darker', 1],
  ])('meets WCAG AA (4.5:1) against the %s end of the header gradient', (_name, stop) => {
    const headerColor = gradientStops[stop];
    const background = declaration(label, 'background-color');
    const behindText = background ? composite(parseColor(background), headerColor) : headerColor;
    const text = composite(parseColor(declaration(label, 'color')), behindText);

    expect(contrastRatio(text, behindText)).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT);
  });

  it('uses no opacity, which would fade the text below the computed ratio', () => {
    expect(declaration(label, 'opacity')).toBeNull();
  });
});
