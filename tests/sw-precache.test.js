import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Regression guard for the stale-service-worker incident (docs/DECISIONS.md,
// 2026-07-22 "Issue #8's actual root cause"): sw.js's STATIC_CACHE_URLS had
// drifted from the scripts index.html actually loads. sw.js runs in a service
// worker scope and can't be imported here, so both files are read as text.
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(join(root, file), 'utf8');

function precachedUrls(swSource) {
  const block = swSource.match(/const STATIC_CACHE_URLS = \[([\s\S]*?)\];/);
  if (!block) throw new Error('STATIC_CACHE_URLS not found in sw.js');
  return [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

// Every <script> tag with a src attribute, whatever its other attributes or
// quote style. Absolute and protocol-relative URLs (CDNs) are skipped: the
// service worker only precaches the app's own files.
function localScripts(html) {
  return [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/g)]
    .map((m) => m[1])
    .filter((src) => !/^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(src))
    .map((src) => `./${src.replace(/^\.\//, '')}`);
}

describe('localScripts (the index.html parser this guard relies on)', () => {
  // PR #14 review: the first version matched only the exact form
  // <script src="…"></script>, so a tag with extra attributes would be skipped
  // silently and the guard would still pass.
  it('finds scripts regardless of extra attributes or attribute order', () => {
    const html = `
      <script src="js/a.js"></script>
      <script defer src="js/b.js"></script>
      <script src="js/c.js" type="text/javascript"></script>
      <script type="module" src='js/d.js'></script>`;
    expect(localScripts(html)).toEqual(['./js/a.js', './js/b.js', './js/c.js', './js/d.js']);
  });

  it('ignores inline scripts and absolute (CDN) URLs', () => {
    const html = `
      <script>console.log('inline');</script>
      <script src="https://cdn.example.com/lib.js"></script>
      <script src="//cdn.example.com/other.js"></script>
      <script src="js/local.js"></script>`;
    expect(localScripts(html)).toEqual(['./js/local.js']);
  });

  it('normalizes a leading ./ so entries match the precache list format', () => {
    expect(localScripts('<script src="./js/a.js"></script>')).toEqual(['./js/a.js']);
  });
});

describe('service worker precache list', () => {
  const precached = precachedUrls(read('sw.js'));

  it('includes every script index.html loads', () => {
    const missing = localScripts(read('index.html')).filter((src) => !precached.includes(src));
    expect(missing).toEqual([]);
  });

  it('includes package.json, which the version label fetches at runtime', () => {
    expect(precached).toContain('./package.json');
  });

  it('lists only files that exist', () => {
    const missing = precached
      .filter((url) => url !== './')
      .filter((url) => {
        try {
          read(url);
          return false;
        } catch {
          return true;
        }
      });
    expect(missing).toEqual([]);
  });
});
