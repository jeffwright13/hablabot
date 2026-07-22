// HablaBot Turn-Detection Profiles
//
// Motivated by the r/dreamingspanish thread compared against in
// docs/live-voice-assessment.md: a beginner needs silent thinking time to
// construct a sentence before speaking it, and a fixed, short VAD silence
// window mistakes that pause for "done talking," cutting in or moving on too
// soon. HablaBot already exposes this knob (session.js's turn_detection
// config) but never varied it by difficulty — this fixes that.
//
// Pure function, no side effects: given a difficulty tier, returns the
// server_vad config to send in session.update.
function getTurnDetectionConfig(difficulty) {
  const profiles = {
    beginner: {
      type: 'server_vad',
      threshold: 0.5,
      prefix_padding_ms: 300,
      silence_duration_ms: 2200, // generous pause tolerance to think in Spanish
    },
    intermediate: {
      type: 'server_vad',
      threshold: 0.5,
      prefix_padding_ms: 300,
      silence_duration_ms: 1500, // HablaBot's original, unvaried default
    },
    advanced: {
      type: 'server_vad',
      threshold: 0.5,
      prefix_padding_ms: 300,
      silence_duration_ms: 1000, // natural conversational pace
    },
  };

  return profiles[difficulty] || profiles.intermediate;
}

window.HablaBotTurnProfiles = { getTurnDetectionConfig };

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getTurnDetectionConfig };
}
