import { describe, it, expect, beforeEach, vi } from 'vitest';
import '../js/utils/models.js';
import Config from '../js/utils/config.js';
import { isVocabularyEnabled, selectTargetWords, applyFeatureVisibility } from '../js/utils/features.js';

// Vocabulary practice is hidden behind a flag (DECISIONS 2026-11-24): it was
// unfinished and buggy, and it's planned to come back (PLAN Stage 8). The
// code and each profile's saved words stay; only the UI and the per-session
// target words are switched off.

function fakeConfig(settings) {
  return { get: (key) => settings[key] };
}

describe('isVocabularyEnabled', () => {
  beforeEach(() => localStorage.clear());

  it('is off by default', () => {
    expect(isVocabularyEnabled(new Config())).toBe(false);
  });

  it('is on only when the flag is exactly true', () => {
    expect(isVocabularyEnabled(fakeConfig({ vocabularyEnabled: true }))).toBe(true);
    expect(isVocabularyEnabled(fakeConfig({ vocabularyEnabled: 'true' }))).toBe(false);
    expect(isVocabularyEnabled(fakeConfig({}))).toBe(false);
    expect(isVocabularyEnabled(null)).toBe(false);
  });

  it('can be switched back on through Config and survives a reload', async () => {
    const config = new Config();
    await config.set('vocabularyEnabled', true);
    const reloaded = new Config();
    await reloaded.load();
    expect(isVocabularyEnabled(reloaded)).toBe(true);
  });
});

describe('selectTargetWords', () => {
  const options = { difficulty: 'beginner', scenario: 'restaurant' };

  it('returns no target words, without consulting the vocabulary list, when the feature is off', () => {
    const manager = { selectWordsForSession: vi.fn(() => [{ spanish: 'agua', english: 'water' }]) };
    expect(selectTargetWords(fakeConfig({ vocabularyEnabled: false }), manager, options)).toEqual([]);
    expect(manager.selectWordsForSession).not.toHaveBeenCalled();
  });

  it('delegates to the vocabulary manager when the feature is on', () => {
    const words = [{ spanish: 'agua', english: 'water' }];
    const manager = { selectWordsForSession: vi.fn(() => words) };
    expect(selectTargetWords(fakeConfig({ vocabularyEnabled: true }), manager, options)).toBe(words);
    expect(manager.selectWordsForSession).toHaveBeenCalledWith(options);
  });
});

describe('applyFeatureVisibility', () => {
  let elements;

  beforeEach(() => {
    document.body.innerHTML = `
      <button id="vocabulary-btn"></button>
      <section id="vocabulary-view"></section>`;
    elements = {
      vocabularyBtn: document.getElementById('vocabulary-btn'),
      vocabularyView: document.getElementById('vocabulary-view'),
    };
  });

  it('hides the Vocabulary tab and view when the feature is off', () => {
    applyFeatureVisibility(fakeConfig({ vocabularyEnabled: false }), elements);
    expect(elements.vocabularyBtn.hidden).toBe(true);
    expect(elements.vocabularyView.hidden).toBe(true);
  });

  it('shows the Vocabulary tab when the feature is on', () => {
    elements.vocabularyBtn.hidden = true;
    applyFeatureVisibility(fakeConfig({ vocabularyEnabled: true }), elements);
    expect(elements.vocabularyBtn.hidden).toBe(false);
  });

  it('tolerates missing elements', () => {
    expect(() => applyFeatureVisibility(fakeConfig({}), {})).not.toThrow();
  });
});
