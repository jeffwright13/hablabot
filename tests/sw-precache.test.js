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

function localScripts(html) {
  return [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => `./${m[1]}`);
}

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
