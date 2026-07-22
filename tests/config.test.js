import { describe, it, expect, beforeEach } from 'vitest';
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
