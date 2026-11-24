import { describe, it, expect, beforeEach } from 'vitest';
// models.js first: it sets window.HablaBotModels, which Config.load() uses, the
// same order index.html loads them in.
import '../js/utils/models.js';
import Config from '../js/utils/config.js';

describe('Config realtimeVoice setting', () => {
  let config;

  beforeEach(() => {
    localStorage.clear();
    config = new Config();
  });

  it('defaults to alloy, matching what session.js falls back to', () => {
    expect(config.get('realtimeVoice')).toBe('alloy');
  });

  it('persists a chosen voice across save/load, same as any other setting', async () => {
    await config.set('realtimeVoice', 'marin');

    const reloaded = new Config();
    await reloaded.load();

    expect(reloaded.get('realtimeVoice')).toBe('marin');
  });
});

describe('Config model overrides', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  function storeConfig(settings) {
    localStorage.setItem('hablabot-config', JSON.stringify(settings));
  }

  function storedConfig() {
    return JSON.parse(localStorage.getItem('hablabot-config'));
  }

  it('defaults to no overrides (blank means use the registry default)', () => {
    expect(new Config().get('models')).toEqual({ realtime: '', transcription: '' });
  });

  it('keeps defaults for every role when an older saved config has no models key', async () => {
    storeConfig({ realtimeVoice: 'marin' });
    const config = new Config();
    await config.load();
    expect(config.get('models')).toEqual({ realtime: '', transcription: '' });
  });

  it('merges a partial saved models object instead of replacing the defaults', async () => {
    storeConfig({ models: { realtime: 'gpt-realtime-2.1-mini' } });
    const config = new Config();
    await config.load();
    expect(config.get('models')).toEqual({ realtime: 'gpt-realtime-2.1-mini', transcription: '' });
  });

  it('rewrites a retired saved override on load and persists the fix', async () => {
    storeConfig({ models: { realtime: 'gpt-4o-realtime-preview', transcription: '' } });
    const config = new Config();
    await config.load();
    expect(config.get('models').realtime).toBe('gpt-realtime-2.1');
    expect(storedConfig().models.realtime).toBe('gpt-realtime-2.1');
  });

  it('does not rewrite storage when nothing was retired', async () => {
    storeConfig({ models: { realtime: 'my-custom-model' } });
    const before = localStorage.getItem('hablabot-config');
    await new Config().load();
    expect(localStorage.getItem('hablabot-config')).toBe(before);
  });

  it('replaces a malformed saved models value with the defaults', async () => {
    storeConfig({ models: 'gpt-4' });
    const config = new Config();
    await config.init();
    expect(config.get('models')).toEqual({ realtime: '', transcription: '' });
  });

  it('keeps the defaults intact when the live models object is mutated', async () => {
    const config = new Config();
    config.get('models').realtime = 'mutated-in-place';
    await config.reset();
    expect(config.get('models')).toEqual({ realtime: '', transcription: '' });
  });

  it('round-trips an override through set() and a fresh load', async () => {
    const config = new Config();
    await config.set('models', { ...config.get('models'), transcription: 'gpt-transcribe' });
    const reloaded = new Config();
    await reloaded.load();
    expect(reloaded.get('models').transcription).toBe('gpt-transcribe');
  });
});
