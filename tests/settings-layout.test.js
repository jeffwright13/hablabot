import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// .setting-item is a two-column grid (label | control). A third child (the
// Select User and Test buttons, the speech rate and volume readouts) wrapped
// onto a new row in the LEFT column, under the label (seen in Chrome,
// 2026-11-25). Firefox only looked right because a password manager injected
// an element beside the API key field and pushed Test across. jsdom has no
// layout, so this reads the CSS and HTML as text.
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(join(root, file), 'utf8');
const mainCss = read('css/main.css');
const mobileCss = read('css/mobile.css');
const indexHtml = read('index.html');

function ruleBody(css, selector) {
  const escaped = selector.replace(/[.>:()+]/g, (c) => `\\${c}`).replace(/\s+/g, '\\s*');
  const match = css.match(new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([^}]*)\\}`));
  return match ? match[1] : null;
}

function declaration(body, property) {
  const match = body && body.match(new RegExp(`(?:^|[;\\s])${property}:\\s*([^;]+);`));
  return match ? match[1].trim() : null;
}

function mobileBlock() {
  const start = mobileCss.indexOf('@media (max-width: 768px)');
  const next = mobileCss.indexOf('@media', start + 1);
  return mobileCss.slice(start, next === -1 ? undefined : next);
}

describe('Settings row layout', () => {
  // Any child after the label and its control: buttons and value readouts alike.
  const EXTRA_CHILDREN = '.setting-item > :nth-child(n+3)';

  it('puts everything after the label and control in the control column on desktop', () => {
    expect(declaration(ruleBody(mainCss, EXTRA_CHILDREN), 'grid-column')).toBe('2');
  });

  it('lets them fall back to the single column on mobile', () => {
    expect(declaration(ruleBody(mobileBlock(), EXTRA_CHILDREN), 'grid-column')).toBe('auto');
  });

  it('styles the API key Test button like the other Settings buttons', () => {
    const button = indexHtml.match(/<button id="test-api-key"[^>]*>/)[0];
    expect(button).toMatch(/class="[^"]*\bsecondary-btn\b/);
  });
});
