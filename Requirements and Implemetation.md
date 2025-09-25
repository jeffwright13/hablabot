# HablaBot - Detailed Requirements & Implementation Specification

## Project Overview
**HablaBot** is a Progressive Web App (PWA) that provides interactive Spanish conversation practice through AI-powered voice conversations. Built entirely client-side using vanilla JavaScript, it works on all devices without requiring app store downloads.

## Technical Architecture

### Core Technology Stack
- **Frontend**: Pure HTML5/CSS3/JavaScript ES6+ (no frameworks)
- **Speech Recognition**: Web Speech API (browser-native)
- **Text-to-Speech**: Web Speech Synthesis API + ElevenLabs API fallback
- **AI Conversations**: OpenAI GPT-4 API (direct client calls)
- **Data Storage**: IndexedDB for vocabulary, progress, and session history
- **Deployment**: GitHub Pages (static hosting)
- **Audio**: Web Audio API for microphone access and audio processing

### Project Structure
```
hablabot/
├── index.html              # Main app entry point
├── manifest.json           # PWA manifest
├── sw.js                  # Service worker for offline functionality
├── css/
│   ├── main.css           # Main styles
│   ├── mobile.css         # Mobile-responsive styles
│   └── animations.css     # UI animations and transitions
├── js/
│   ├── app.js             # Main application controller
│   ├── speech/
│   │   ├── recognition.js # Speech-to-text handling
│   │   └── synthesis.js   # Text-to-speech handling
│   ├── ai/
│   │   ├── conversation.js # AI conversation management
│   │   └── prompts.js     # Spanish tutor prompt templates
│   ├── vocabulary/
│   │   ├── manager.js     # Vocabulary CRUD operations
│   │   └── spaced-repetition.js # SM-2 algorithm implementation
│   ├── storage/
│   │   └── database.js    # IndexedDB wrapper and data models
│   ├── ui/
│   │   ├── components.js  # Reusable UI components
│   │   └── state.js       # Application state management
│   └── utils/
│       ├── audio.js       # Audio utility functions
│       ├── config.js      # Configuration management
│       └── helpers.js     # General utility functions
├── assets/
│   ├── icons/            # PWA icons (various sizes)
│   ├── sounds/           # UI sound effects
│   └── images/           # App images and graphics
└── README.md
```

## Detailed Functional Requirements

### 1. User Onboarding & Setup

#### First-Time Setup
```javascript
// Required setup steps:
1. Welcome screen with app explanation
2. Microphone permission request
3. OpenAI API key input (stored locally in IndexedDB)
4. Voice settings configuration (speed, gender, accent)
5. Initial vocabulary import (optional CSV upload or manual entry)
6. Language level assessment (beginner/intermediate/advanced)
```

#### Configuration Management
- **API Key Storage**: Encrypted in IndexedDB, never sent to external servers
- **Voice Preferences**: Spanish voice selection, speech rate (0.5x - 2.0x)
- **Learning Preferences**: Session length (5-30 minutes), correction frequency
- **Privacy Settings**: Data retention period, conversation logging preferences

### 2. Vocabulary Management System

#### Data Model
```javascript
// Vocabulary Item Schema
VocabularyItem = {
  id: String,                    // UUID
  spanish: String,               // Spanish word/phrase
  english: String,               // English translation
  phonetic: String,              // IPA pronunciation (optional)
  difficulty: Number,            // 1-5 scale
  category: String,              // "food", "travel", "family", etc.
  examples: Array[String],       // Example sentences
  masteryLevel: Number,          // SM-2 algorithm score
  lastReviewed: Date,
  nextReviewDate: Date,
  timesCorrect: Number,
  timesIncorrect: Number,
  createdDate: Date,
  tags: Array[String]            // Custom user tags
}
```

#### Vocabulary Operations
- **Import Methods**: CSV upload, manual entry, voice input
- **Export Functions**: CSV download, JSON backup
- **Search & Filter**: By category, difficulty, mastery level, date added
- **Bulk Operations**: Mass edit, delete, difficulty adjustment
- **Smart Suggestions**: Detect related words, suggest example sentences

### 3. Spaced Repetition Algorithm

#### SM-2 Implementation
```javascript
// Core SM-2 Algorithm Parameters
SpacedRepetition = {
  calculateNextInterval: (difficulty, repetitions, easinessFactor, quality) => {
    // Quality: 0-5 (0=complete blackout, 5=perfect response)
    // Returns: { nextInterval: days, newEasiness: float, newRepetitions: int }
  },
  
  updateWordScheduling: (vocabularyItem, responseQuality) => {
    // Updates masteryLevel, nextReviewDate based on performance
  },
  
  getWordsForReview: (targetDate = new Date()) => {
    // Returns array of words due for review
  },
  
  getDailyReviewCount: () => {
    // Returns number of words to review today
  }
}
```

#### Performance Tracking
- **Real-time Adaptation**: Adjust word frequency within conversation
- **Long-term Scheduling**: Words user struggles with appear more often
- **Mastery Metrics**: Track improvement over time per word
- **Review Optimization**: Balance new words vs. review words (80/20 rule)

### 4. AI Conversation Engine

#### Conversation Management
```javascript
// Conversation Session Schema
ConversationSession = {
  id: String,
  startTime: Date,
  endTime: Date,
  targetWords: Array[String],      // Words to practice this session
  scenario: String,                // "restaurant", "shopping", etc.
  difficulty: String,              // "beginner", "intermediate", "advanced"
  conversationHistory: Array[{
    speaker: String,               // "user" | "ai"
    text: String,                  // What was said
    timestamp: Date,
    confidence: Number,            // Speech recognition confidence
    corrections: Array[String]     // Grammar/pronunciation corrections
  }],
  wordsUsed: Object,              // {word: timesUsed}
  userPerformance: Object,        // {word: correctUsage}
  sessionRating: Number           // 1-5 user satisfaction
}
```

#### AI Prompt Engineering
```javascript
// System Prompt Template
const SPANISH_TUTOR_PROMPT = `
You are María, a patient and encouraging Spanish conversation tutor. 

CONTEXT:
- Student level: {userLevel}
- Target vocabulary: {targetWords}
- Conversation scenario: {scenario}
- Session goal: Practice {targetWords.length} words naturally

CONVERSATION RULES:
1. Speak only in Spanish (unless user is completely stuck)
2. Use target vocabulary naturally, repeat each word 2-3 times
3. Provide gentle corrections without breaking conversation flow
4. Keep responses to 1-2 sentences to maintain conversation pace
5. Ask follow-up questions to encourage user participation
6. If user makes errors, model correct usage in your response
7. Gradually increase difficulty if user demonstrates mastery

PERSONALITY:
- Encouraging and patient
- Culturally authentic (use appropriate regional expressions)
- Adaptive to user's energy and engagement level

Current conversation goal: {currentGoal}
`;
```

#### Conversation Scenarios
- **Restaurant**: Ordering food, asking about ingredients, paying bill
- **Travel**: Asking directions, booking hotels, transportation
- **Shopping**: Buying clothes, grocating, bargaining
- **Family**: Describing family, relationships, daily activities  
- **Work**: Job interviews, office conversations, professional settings
- **Health**: Doctor visits, describing symptoms, pharmacy
- **Emergency**: Getting help, reporting problems, urgent situations

### 5. Speech Processing System

#### Speech Recognition
```javascript
// Speech Recognition Configuration
const SpeechConfig = {
  language: 'es-ES',               // Spanish (Spain) - configurable
  continuous: false,               // Single utterance mode
  interimResults: true,            // Show partial results
  maxAlternatives: 3,              // Multiple interpretation options
  confidenceThreshold: 0.7,        // Minimum confidence to accept
  
  // Error handling
  handleNoSpeech: () => {},        // User didn't speak
  handleAudioCapture: () => {},    // Microphone issues
  handleNetwork: () => {},         // Network connectivity issues
  handleNotAllowed: () => {}       // Permission denied
};

// Recognition Flow
class SpeechRecognition {
  startListening() {
    // Visual feedback: show "listening" state
    // Start speech recognition
    // Handle real-time partial results
  }
  
  stopListening() {
    // Process final result
    // Send to AI for response
    // Update conversation history
  }
  
  handleResult(speechText, confidence) {
    // Validate confidence level
    // Clean up text (remove filler words)
    // Log for conversation history
    // Trigger AI response
  }
}
```

#### Text-to-Speech
```javascript
// TTS Configuration
const TTSConfig = {
  primaryTTS: 'web-speech-api',    // Browser native
  fallbackTTS: 'elevenlabs-api',   // External service backup
  
  voiceSettings: {
    language: 'es-ES',
    rate: 0.9,                     // Speech speed
    pitch: 1.0,                    // Voice pitch
    volume: 0.8,                   // Volume level
    voiceIndex: 0                  // Preferred voice from available list
  },
  
  // Voice selection priority
  preferredVoices: [
    'Google español',
    'Microsoft Helena - Spanish',
    'Apple Mónica',
    'ElevenLabs Spanish Female'
  ]
};
```

### 6. User Interface Specifications

#### Main App Layout
```html
<!-- Primary Interface -->
<div class="app-container">
  <header class="app-header">
    <h1>HablaBot</h1>
    <nav class="main-nav">
      <button id="conversation-btn">Conversation</button>
      <button id="vocabulary-btn">Vocabulary</button>
      <button id="progress-btn">Progress</button>
      <button id="settings-btn">Settings</button>
    </nav>
  </header>
  
  <main class="app-main">
    <!-- Conversation Interface -->
    <section id="conversation-view" class="view active">
      <div class="conversation-setup">
        <select id="scenario-select">
          <option value="restaurant">Restaurant</option>
          <option value="travel">Travel</option>
          <option value="shopping">Shopping</option>
        </select>
        <input type="range" id="session-length" min="5" max="30" value="15">
        <button id="start-conversation">Start Conversation</button>
      </div>
      
      <div class="conversation-active" hidden>
        <div class="conversation-history"></div>
        <div class="current-state">
          <div class="ai-speaking" hidden>
            <span class="speaker-label">María:</span>
            <p class="ai-text"></p>
          </div>
          <div class="user-input">
            <button id="push-to-talk" class="talk-button">
              🎤 Hold to Speak
            </button>
            <div class="speech-feedback">
              <div class="listening-indicator" hidden>Listening...</div>
              <div class="processing-indicator" hidden>Processing...</div>
              <p class="user-speech-text"></p>
            </div>
          </div>
        </div>
        <div class="session-controls">
          <button id="pause-session">Pause</button>
          <button id="end-session">End Session</button>
          <div class="session-progress">
            <span class="words-practiced">0/5 words</span>
            <span class="time-remaining">15:00</span>
          </div>
        </div>
      </div>
    </section>
    
    <!-- Other views: vocabulary, progress, settings -->
  </main>
</div>
```

#### Mobile-Responsive Design
```css
/* Mobile-first responsive breakpoints */
@media (max-width: 768px) {
  .app-container {
    /* Stack elements vertically */
    /* Larger touch targets (min 44px) */
    /* Simplified navigation */
  }
  
  .talk-button {
    /* Large, prominent button */
    /* Easy thumb access */
    /* Clear visual feedback */
  }
}

/* Tablet and desktop enhancements */
@media (min-width: 769px) {
  /* Side-by-side layouts */
  /* Keyboard shortcuts */
  /* Additional features */
}
```

#### Visual Feedback States
- **Idle**: Ready to start conversation
- **Listening**: Animated microphone, visual waveform
- **Processing**: Spinner, "thinking" animation
- **AI Speaking**: Text animation, speaker icon
- **Error States**: Clear error messages with retry options
- **Success States**: Positive reinforcement animations

### 7. Data Storage & Persistence

#### IndexedDB Schema
```javascript
// Database Structure
const DatabaseSchema = {
  name: 'HablaBotDB',
  version: 1,
  stores: {
    vocabulary: {
      keyPath: 'id',
      indexes: ['category', 'difficulty', 'nextReviewDate', 'masteryLevel']
    },
    sessions: {
      keyPath: 'id',
      indexes: ['startTime', 'scenario', 'endTime']
    },
    userSettings: {
      keyPath: 'key'
    },
    conversationHistory: {
      keyPath: 'id',
      indexes: ['sessionId', 'timestamp']
    }
  }
};

// Data Access Layer
class HablaBotDatabase {
  async getVocabularyForReview(limit = 10) {}
  async updateWordPerformance(wordId, performance) {}
  async saveConversationSession(session) {}
  async getUserSettings() {}
  async exportUserData() {}
  async importUserData(data) {}
}
```

#### Data Backup & Sync
- **Local Backup**: JSON export of all user data
- **Privacy-First**: No cloud storage, all data stays local
- **Data Portability**: Easy export/import for device migration
- **Storage Limits**: Monitor IndexedDB usage, implement cleanup

### 8. Error Handling & Edge Cases

#### Network Issues
```javascript
// Offline Capability
const OfflineHandler = {
  detectOnlineStatus: () => navigator.onLine,
  cacheEssentialResources: () => {
    // Service worker caches app shell
    // Store recent conversations for offline review
  },
  gracefulDegradation: () => {
    // Disable AI features when offline
    // Enable vocabulary review mode
    // Show appropriate user messaging
  }
};
```

#### Speech Recognition Failures
- **Low Confidence**: Ask user to repeat, offer text input fallback
- **No Speech Detected**: Provide visual cues, check microphone
- **Noise Interference**: Suggest quieter environment
- **Accent Issues**: Allow manual text correction, learn from corrections

#### API Failures
- **OpenAI Timeout**: Retry with exponential backoff
- **Rate Limiting**: Queue requests, inform user of delays  
- **Invalid API Key**: Clear setup flow to re-enter key
- **Cost Monitoring**: Track API usage, warn before limits

### 9. Performance Requirements

#### Loading & Responsiveness
- **Initial Load**: < 3 seconds on 3G connection
- **Speech-to-AI Response**: < 2 seconds average
- **TTS Playback**: < 1 second delay
- **UI Interactions**: < 100ms response time
- **Memory Usage**: < 50MB total app footprint

#### Optimization Strategies
- **Code Splitting**: Load features on-demand
- **Asset Compression**: Minified CSS/JS, optimized images
- **Caching Strategy**: Service worker for offline capability
- **Database Indexing**: Fast vocabulary lookups
- **Audio Optimization**: Compressed audio files, streaming where possible

### 10. Security & Privacy

#### Data Protection
```javascript
// API Key Security
const SecurityManager = {
  storeAPIKey: (key) => {
    // Encrypt before storing in IndexedDB
    // Never log or transmit key
  },
  
  validateAPIKey: async (key) => {
    // Test with minimal API call
    // Validate format and permissions
  },
  
  clearSensitiveData: () => {
    // Secure deletion on user request
    // Clear conversation history option
  }
};
```

#### Privacy Measures
- **Local-First**: All personal data stays on device
- **No Tracking**: No analytics or user behavior tracking
- **Minimal API Calls**: Only send necessary data to OpenAI
- **Data Retention**: User-controlled conversation history retention
- **Transparent Permissions**: Clear explanation of microphone usage

### 11. Testing Strategy

#### Unit Tests
- Vocabulary management functions
- Spaced repetition algorithm accuracy
- Speech processing utilities
- Database operations

#### Integration Tests
- Speech recognition → AI → TTS flow
- API error handling
- Offline functionality
- Cross-browser compatibility

#### User Testing
- Mobile usability testing
- Conversation flow naturalness
- Learning effectiveness validation
- Accessibility compliance

### 12. Deployment & Maintenance

#### GitHub Pages Deployment
```yaml
# GitHub Actions workflow
name: Deploy to GitHub Pages
on:
  push:
    branches: [ main ]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Build and Deploy
        run: |
          npm run build
          npm run test
          # Deploy to gh-pages branch
```

#### Version Management
- **Semantic Versioning**: Major.Minor.Patch
- **Feature Flags**: Toggle new features for testing
- **Database Migrations**: Handle schema changes gracefully
- **Rollback Strategy**: Quick revert capability

#### Monitoring & Analytics
- **Error Tracking**: Client-side error logging (privacy-compliant)
- **Performance Monitoring**: Core Web Vitals tracking
- **Usage Metrics**: Anonymous feature usage statistics
- **User Feedback**: In-app feedback collection system

## Success Metrics

### Technical Metrics
- **Speech Recognition Accuracy**: > 85% for clear speech
- **Response Latency**: < 2 seconds average
- **App Reliability**: < 1% crash rate
- **Cross-browser Compatibility**: Works on 95% of modern browsers

### Learning Effectiveness
- **Vocabulary Retention**: Measurable improvement over time
- **User Engagement**: Average session length > 10 minutes
- **Learning Progress**: Users advance through difficulty levels
- **User Satisfaction**: > 4.0/5.0 average rating

This specification provides comprehensive guidance for implementing HablaBot as a robust, user-friendly Spanish conversation tutor. The client-side architecture ensures privacy while leveraging modern web APIs for a native app-like experience.