import { describe, it, expect } from 'vitest';
import { getTurnDetectionConfig } from '../js/realtime/turn-profiles.js';

describe('getTurnDetectionConfig', () => {
  it('gives beginners the most pause tolerance', () => {
    const beginner = getTurnDetectionConfig('beginner');
    const intermediate = getTurnDetectionConfig('intermediate');
    const advanced = getTurnDetectionConfig('advanced');

    expect(beginner.silence_duration_ms).toBeGreaterThan(intermediate.silence_duration_ms);
    expect(intermediate.silence_duration_ms).toBeGreaterThan(advanced.silence_duration_ms);
  });

  it("intermediate matches HablaBot's original, unvaried default", () => {
    expect(getTurnDetectionConfig('intermediate')).toEqual({
      type: 'server_vad',
      threshold: 0.5,
      prefix_padding_ms: 300,
      silence_duration_ms: 1500,
    });
  });

  it('falls back to intermediate for an unrecognized or missing difficulty', () => {
    expect(getTurnDetectionConfig('expert')).toEqual(getTurnDetectionConfig('intermediate'));
    expect(getTurnDetectionConfig(undefined)).toEqual(getTurnDetectionConfig('intermediate'));
  });

  it('always returns a server_vad config, ready to send as-is in session.update', () => {
    for (const difficulty of ['beginner', 'intermediate', 'advanced']) {
      const config = getTurnDetectionConfig(difficulty);
      expect(config.type).toBe('server_vad');
      expect(typeof config.threshold).toBe('number');
      expect(typeof config.prefix_padding_ms).toBe('number');
      expect(typeof config.silence_duration_ms).toBe('number');
    }
  });
});
