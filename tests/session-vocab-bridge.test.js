import { describe, it, expect, beforeEach } from 'vitest';
import SessionVocabBridge from '../js/realtime/session-vocab-bridge.js';

const TARGET_WORDS = [
  { id: 'w1', spanish: 'playa' },
  { id: 'w2', spanish: 'hotel' },
];

describe('SessionVocabBridge', () => {
  let bridge;

  beforeEach(() => {
    bridge = new SessionVocabBridge();
    bridge.init();
  });

  it('detects a target word spoken in a transcript', async () => {
    const matched = await bridge.trackUserTranscript('Quiero ir a la playa mañana', TARGET_WORDS);
    expect(matched.map(w => w.id)).toEqual(['w1']);
  });

  it('ignores target words that were not spoken', async () => {
    const matched = await bridge.trackUserTranscript('Hace mucho calor hoy', TARGET_WORDS);
    expect(matched).toEqual([]);
  });

  it('detects multiple target words in one transcript', async () => {
    const matched = await bridge.trackUserTranscript('Reservé un hotel cerca de la playa', TARGET_WORDS);
    expect(matched.map(w => w.id).sort()).toEqual(['w1', 'w2']);
  });

  it('accumulates wordsUsed counts across multiple transcripts', async () => {
    await bridge.trackUserTranscript('me gusta la playa', TARGET_WORDS);
    await bridge.trackUserTranscript('otra playa bonita', TARGET_WORDS);
    expect(bridge.getWordsUsed()).toEqual({ w1: 2 });
  });

  it('reset() clears accumulated word usage', async () => {
    await bridge.trackUserTranscript('me gusta la playa', TARGET_WORDS);
    bridge.reset();
    expect(bridge.getWordsUsed()).toEqual({});
  });

  it('is case-insensitive when matching', async () => {
    const matched = await bridge.trackUserTranscript('Vamos al HOTEL ahora', TARGET_WORDS);
    expect(matched.map(w => w.id)).toEqual(['w2']);
  });

  it('does nothing gracefully when there are no target words for the session', async () => {
    const matched = await bridge.trackUserTranscript('cualquier cosa', []);
    expect(matched).toEqual([]);
  });
});
