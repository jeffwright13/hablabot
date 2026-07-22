// HablaBot Session Vocabulary Bridge
//
// Reconnects live conversation transcripts to the SM-2 spaced-repetition scheduler.
// The migration to the Realtime API (js/realtime/session.js) dropped the vocabulary-
// usage tracking that ConversationEngine (js/ai/conversation.js) used to do against
// chat-completions responses — that class is never invoked in the realtime flow.
// This is new, small, session-scoped code rather than a resurrection of that class.
//
// Note: ConversationEngine derived an SM-2 quality score (0-5) from a speech-recognition
// confidence value. The Realtime API's Whisper transcription doesn't expose a per-utterance
// confidence score at all, so that signal no longer exists. A target word appearing in the
// transcript is treated as a successful use with a fixed quality score (see DEFAULT_QUALITY)
// rather than a confidence-weighted one — documented as a simplification in docs/DECISIONS.md.
class SessionVocabBridge {
  constructor() {
    this.vocabularyManager = null;
    this.wordsUsed = {};
    this.DEFAULT_QUALITY = 4;
  }

  init(vocabularyManager) {
    this.vocabularyManager = vocabularyManager;
    this.reset();
  }

  // Match target words against a user transcript, update SM-2 scheduling for each
  // match, and accumulate usage counts for the current session.
  async trackUserTranscript(text, targetWords) {
    if (!text || !targetWords || targetWords.length === 0) return [];

    const lowerText = text.toLowerCase();
    const matched = targetWords.filter(word => lowerText.includes(word.spanish.toLowerCase()));

    for (const word of matched) {
      this.wordsUsed[word.id] = (this.wordsUsed[word.id] || 0) + 1;
      await this.vocabularyManager.updateWordPerformance(word.id, this.DEFAULT_QUALITY);
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
