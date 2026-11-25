import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { DEFAULT_VOICE } from '../js/utils/models.js';

// The default voice lives only in js/utils/models.js (Stage 3b). app.js has
// no test harness yet (PLAN Stage 5), so this reads the source as text, like
// sw-precache.test.js: no file may hardcode its own voice fallback.
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(join(root, file), 'utf8');
const indexHtml = read('index.html');
const voiceSelect = indexHtml.match(/<select id="voice-select">([\s\S]*?)<\/select>/)[1];
const VOICES = [...voiceSelect.matchAll(/<option value="([^"]+)"/g)].map(m => m[1]);

describe('default voice', () => {
  it('is one of the voices offered in Settings', () => {
    expect(VOICES.length).toBeGreaterThan(0);
    expect(VOICES).toContain(DEFAULT_VOICE);
  });

  for (const file of ['js/app.js', 'js/realtime/session.js', 'js/utils/config.js']) {
    it(`${file} has no hardcoded voice ID`, () => {
      const source = read(file);
      for (const voice of VOICES) {
        expect(source, `'${voice}' in ${file}`).not.toMatch(new RegExp(`['"]${voice}['"]`));
      }
    });
  }
});
