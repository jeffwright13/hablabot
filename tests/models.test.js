import { describe, it, expect } from 'vitest';
import {
  DEFAULT_MODELS,
  RETIRED_MODELS,
  KNOWN_SHUTDOWNS,
  resolveModels,
  migrateRetiredModels,
  defaultsNearShutdown,
} from '../js/utils/models.js';

describe('DEFAULT_MODELS', () => {
  it('names a default for every role the app sends', () => {
    expect(DEFAULT_MODELS).toEqual({
      realtime: 'gpt-realtime-2.1',
      transcription: 'gpt-4o-transcribe',
    });
  });

  it('never defaults to a model already known to be retired', () => {
    for (const id of Object.values(DEFAULT_MODELS)) {
      expect(RETIRED_MODELS).not.toHaveProperty(id);
    }
  });
});

describe('RETIRED_MODELS', () => {
  it('maps every retired ID to a replacement that is not itself retired', () => {
    for (const [retired, replacement] of Object.entries(RETIRED_MODELS)) {
      expect(typeof replacement, retired).toBe('string');
      expect(RETIRED_MODELS, `${retired} -> ${replacement}`).not.toHaveProperty(replacement);
    }
  });

  it('covers the pre-migration model this app originally shipped with', () => {
    expect(RETIRED_MODELS['gpt-4o-realtime-preview']).toBe('gpt-realtime-2.1');
  });
});

describe('resolveModels', () => {
  it('returns the defaults when there are no overrides', () => {
    expect(resolveModels()).toEqual(DEFAULT_MODELS);
    expect(resolveModels({})).toEqual(DEFAULT_MODELS);
    expect(resolveModels(null)).toEqual(DEFAULT_MODELS);
  });

  it('uses an override when one is set, trimmed', () => {
    expect(resolveModels({ realtime: '  gpt-realtime-2.1-mini ' }).realtime).toBe('gpt-realtime-2.1-mini');
  });

  it('falls back to the default for a blank or non-string override', () => {
    const resolved = resolveModels({ realtime: '   ', transcription: 42 });
    expect(resolved).toEqual(DEFAULT_MODELS);
  });

  it('passes an unknown or custom ID through unchanged', () => {
    expect(resolveModels({ transcription: 'my-custom-model' }).transcription).toBe('my-custom-model');
  });

  it('replaces a retired override with its replacement', () => {
    expect(resolveModels({ realtime: 'gpt-4o-realtime-preview' }).realtime).toBe('gpt-realtime-2.1');
  });

  it('ignores roles it does not know', () => {
    expect(resolveModels({ chat: 'gpt-4' })).toEqual(DEFAULT_MODELS);
  });
});

describe('migrateRetiredModels', () => {
  it('rewrites retired stored overrides and reports that it did', () => {
    const { models, changed } = migrateRetiredModels({ realtime: 'gpt-4o-realtime-preview', transcription: '' });
    expect(models).toEqual({ realtime: 'gpt-realtime-2.1', transcription: '' });
    expect(changed).toBe(true);
  });

  it('leaves current, blank and custom values alone', () => {
    const stored = { realtime: 'gpt-realtime-2.1', transcription: 'my-custom-model' };
    const { models, changed } = migrateRetiredModels(stored);
    expect(models).toEqual(stored);
    expect(changed).toBe(false);
  });

  it('matches retired IDs case-insensitively, ignoring surrounding spaces', () => {
    expect(migrateRetiredModels({ realtime: ' GPT-4o-Realtime-Preview ' }).models.realtime).toBe('gpt-realtime-2.1');
  });

  it('does not mutate its input', () => {
    const stored = { realtime: 'gpt-4o-realtime-preview' };
    migrateRetiredModels(stored);
    expect(stored.realtime).toBe('gpt-4o-realtime-preview');
  });

  it('treats a missing or malformed value as no overrides', () => {
    expect(migrateRetiredModels(undefined)).toEqual({ models: {}, changed: false });
    expect(migrateRetiredModels('gpt-4')).toEqual({ models: {}, changed: false });
  });
});

describe('defaultsNearShutdown', () => {
  const WARN_DAYS = 30;

  it('lists a default whose known shutdown is within the warning window', () => {
    expect(defaultsNearShutdown(new Date('2027-02-01T00:00:00Z'), WARN_DAYS)).toEqual([
      { role: 'transcription', model: 'gpt-4o-transcribe', shutdownDate: '2027-02-26' },
    ]);
  });

  it('lists a default that is already past its shutdown date', () => {
    expect(defaultsNearShutdown(new Date('2027-03-01T00:00:00Z'), WARN_DAYS)).toHaveLength(1);
  });

  it('lists nothing well before any shutdown', () => {
    expect(defaultsNearShutdown(new Date('2026-11-24T00:00:00Z'), WARN_DAYS)).toEqual([]);
  });

  it('records the announced gpt-4o-transcribe shutdown (OpenAI deprecations, notice 2026-08-26)', () => {
    expect(KNOWN_SHUTDOWNS['gpt-4o-transcribe']).toBe('2027-02-26');
  });

  // Deliberate tripwire, checked against the real clock. It starts failing 30
  // days before a default model's announced shutdown, on every branch, so the
  // switch can't be forgotten. When it fires: pick and live-test a
  // replacement, change DEFAULT_MODELS, and record it in docs/DECISIONS.md.
  // Do not delete this test or widen the window to silence it.
  it('TRIPWIRE: no default model is within 30 days of its announced shutdown', () => {
    expect(defaultsNearShutdown(new Date(), WARN_DAYS)).toEqual([]);
  });
});
