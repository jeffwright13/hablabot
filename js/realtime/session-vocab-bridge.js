// HablaBot Session Vocabulary Bridge
//
// Reconnects live conversation transcripts to target-word usage tracking. The
// migration to the Realtime API (js/realtime/session.js) dropped the vocabulary-
// usage tracking that ConversationEngine (js/ai/conversation.js) used to do against
// chat-completions responses — that class is never invoked in the realtime flow.
// This is new, small, session-scoped code rather than a resurrection of that class.
//
// This purely tallies how many times each target word came up in the current
// session, for the end-of-session summary (see HablaBotApp.endConversation).
// It used to also persist a mastery/scheduling score per word via an SM-2
// algorithm, removed as a deliberate simplification -- see docs/DECISIONS.md.
class SessionVocabBridge {
  constructor() {
    this.wordsUsed = {};
  }

  init() {
    this.reset();
  }

  // Match target words against a user transcript and accumulate usage counts
  // for the current session.
  async trackUserTranscript(text, targetWords) {
    if (!text || !targetWords || targetWords.length === 0) return [];

    const lowerText = text.toLowerCase();
    const matched = targetWords.filter(word => lowerText.includes(word.spanish.toLowerCase()));

    for (const word of matched) {
      this.wordsUsed[word.id] = (this.wordsUsed[word.id] || 0) + 1;
    }

    return matched;
  }

  getWordsUsed() {
    return { ...this.wordsUsed };
  }

  reset() {
    this.wordsUsed = {};
  }
}

window.HablaBotSessionVocabBridge = new SessionVocabBridge();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SessionVocabBridge;
}
