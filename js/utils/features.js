// HablaBot feature flags
//
// Vocabulary practice is HIDDEN, not deleted (DECISIONS 2026-11-24). The
// feature was unfinished and buggy: target words rarely matched a scenario,
// CSV export downloaded twice and didn't survive re-import, the filters did
// nothing, and switching profiles kept the old list. Its intent (a learner's
// own words worked into real conversation) is wanted back in the near-to-mid
// term: see docs/PLAN.md Stage 8 for the fix list and the redesign direction.
//
// Switched off, the Vocabulary tab and view are hidden and sessions get no
// target words, so there's no prompt block and no word tally. All code and
// every profile's saved words stay as they are. To try it anyway (bugs and
// all), run HablaBotConfig.set('vocabularyEnabled', true) in the console and
// reload.

function isVocabularyEnabled(config) {
  return !!config && config.get('vocabularyEnabled') === true;
}

// The session's target words: [] while the feature is off, so nothing
// reaches the prompt or the end-of-session tally.
function selectTargetWords(config, vocabularyManager, options) {
  return isVocabularyEnabled(config) ? vocabularyManager.selectWordsForSession(options) : [];
}

// elements: { vocabularyBtn, vocabularyView } (either may be missing).
function applyFeatureVisibility(config, elements) {
  const vocabularyOn = isVocabularyEnabled(config);
  if (elements.vocabularyBtn) elements.vocabularyBtn.hidden = !vocabularyOn;
  // The view is shown only by switchView(); just make sure it's hidden when off.
  if (elements.vocabularyView && !vocabularyOn) elements.vocabularyView.hidden = true;
}

const HablaBotFeatures = { isVocabularyEnabled, selectTargetWords, applyFeatureVisibility };

window.HablaBotFeatures = HablaBotFeatures;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = HablaBotFeatures;
}
