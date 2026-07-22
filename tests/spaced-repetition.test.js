import { describe, it, expect } from 'vitest';
import SpacedRepetition from '../js/vocabulary/spaced-repetition.js';

describe('SpacedRepetition.calculateNextInterval', () => {
  const sr = new SpacedRepetition();

  it('schedules a brand-new word 1 day out on first success', () => {
    const result = sr.calculateNextInterval({}, 4);
    expect(result.repetitions).toBe(1);
    expect(result.interval).toBe(1);
  });

  it('schedules the second successful review 6 days out', () => {
    const afterFirst = sr.calculateNextInterval({}, 4);
    const afterSecond = sr.calculateNextInterval(afterFirst, 4);
    expect(afterSecond.repetitions).toBe(2);
    expect(afterSecond.interval).toBe(6);
  });

  it('resets repetitions and interval to 1 on a failed review (quality < 3)', () => {
    const established = { repetitions: 5, easinessFactor: 2.5, interval: 30 };
    const result = sr.calculateNextInterval(established, 1);
    expect(result.repetitions).toBe(0);
    expect(result.interval).toBe(1);
  });

  it('never drops easinessFactor below the SM-2 floor of 1.3', () => {
    let item = {};
    for (let i = 0; i < 10; i++) {
      item = sr.calculateNextInterval(item, 0);
    }
    expect(item.easinessFactor).toBeGreaterThanOrEqual(1.3);
  });
});

describe('SpacedRepetition.calculateMasteryLevel', () => {
  const sr = new SpacedRepetition();

  it('is 0 for a word with no attempts yet', () => {
    expect(sr.calculateMasteryLevel({})).toBe(0);
  });

  it('increases with more successful repetitions', () => {
    const early = sr.calculateMasteryLevel({
      repetitions: 1, easinessFactor: 2.5, timesCorrect: 1, timesIncorrect: 0,
    });
    const later = sr.calculateMasteryLevel({
      repetitions: 5, easinessFactor: 2.5, timesCorrect: 5, timesIncorrect: 0,
    });
    expect(later).toBeGreaterThan(early);
  });

  it('caps at 10 regardless of how many repetitions are recorded', () => {
    const mastery = sr.calculateMasteryLevel({
      repetitions: 100, easinessFactor: 2.5, timesCorrect: 100, timesIncorrect: 0,
    });
    expect(mastery).toBeLessThanOrEqual(10);
  });
});

describe('SpacedRepetition.getWordsForReview', () => {
  const sr = new SpacedRepetition();
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  it('returns only words whose nextReviewDate has passed', () => {
    const words = [
      { id: 'due', nextReviewDate: yesterday },
      { id: 'not-due', nextReviewDate: nextWeek },
    ];
    const due = sr.getWordsForReview(words, new Date());
    expect(due.map(w => w.id)).toEqual(['due']);
  });
});
