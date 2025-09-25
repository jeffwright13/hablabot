// HablaBot Configuration Management
class Config {
  constructor() {
    this.defaults = {
      // API Configuration
      openaiApiKey: '',
      elevenLabsApiKey: '',
      
      // Speech Settings
      speechLanguage: 'es-ES',
      speechRate: 0.9,
      speechPitch: 1.0,
      speechVolume: 0.8,
      voiceIndex: 0,
      
      // Learning Preferences
      correctionFrequency: 'immediate', // 'immediate', 'end-of-sentence', 'end-of-conversation'
      newWordsPerSession: 5,
      sessionLength: 15, // minutes
      difficultyLevel: 'beginner', // 'beginner', 'intermediate', 'advanced'
      
      // UI Preferences
      theme: 'light', // 'light', 'dark', 'auto'
      language: 'en', // UI language
      
      // Privacy Settings
      dataRetentionDays: 90,
      conversationLogging: true,
      
      // Performance Settings
      speechConfidenceThreshold: 0.7,
      apiTimeout: 10000, // milliseconds
      maxRetries: 3,
      
      // Feature Flags
      enableElevenLabs: false,
      enableOfflineMode: true,
      enableAnalytics: false
    };
    
    this.settings = { ...this.defaults };
    this.listeners = new Map();
  }

  // Initialize configuration
  async init() {
    try {
      await this.load();
      this.validateSettings();
      console.log('Configuration initialized successfully');
    } catch (error) {
      console.error('Failed to initialize configuration:', error);
      // Fall back to defaults
      this.settings = { ...this.defaults };
    }
  }

  // Load settings from storage
  async load() {
    try {
      const stored = localStorage.getItem('hablabot-config');
      if (stored) {
        const parsed = JSON.parse(stored);
        this.settings = { ...this.defaults, ...parsed };
      }
    } catch (error) {
      console.error('Failed to load configuration:', error);
      throw error;
    }
  }

  // Save settings to storage
  async save() {
    try {
      localStorage.setItem('hablabot-config', JSON.stringify(this.settings));
      this.notifyListeners('save', this.settings);
    } catch (error) {
      console.error('Failed to save configuration:', error);
      throw error;
    }
  }

  // Get a setting value
  get(key) {
    return this.settings[key];
  }

  // Set a setting value
  async set(key, value) {
    const oldValue = this.settings[key];
    this.settings[key] = value;
    
    try {
      await this.save();
      this.notifyListeners('change', { key, value, oldValue });
    } catch (error) {
      // Revert on save failure
      this.settings[key] = oldValue;
      throw error;
    }
  }

  // Set multiple settings at once
  async setMultiple(updates) {
    const oldValues = {};
    
    // Store old values and apply updates
    for (const [key, value] of Object.entries(updates)) {
      oldValues[key] = this.settings[key];
      this.settings[key] = value;
    }
    
    try {
      await this.save();
      this.notifyListeners('change', { updates, oldValues });
    } catch (error) {
      // Revert all changes on save failure
      for (const [key, oldValue] of Object.entries(oldValues)) {
        this.settings[key] = oldValue;
      }
      throw error;
    }
  }

  // Reset to defaults
  async reset() {
    this.settings = { ...this.defaults };
    await this.save();
    this.notifyListeners('reset', this.settings);
  }

  // Validate settings
  validateSettings() {
    // Validate speech rate
    if (this.settings.speechRate < 0.5 || this.settings.speechRate > 2.0) {
      this.settings.speechRate = this.defaults.speechRate;
    }
    
    // Validate speech volume
    if (this.settings.speechVolume < 0 || this.settings.speechVolume > 1) {
      this.settings.speechVolume = this.defaults.speechVolume;
    }
    
    // Validate session length
    if (this.settings.sessionLength < 5 || this.settings.sessionLength > 60) {
      this.settings.sessionLength = this.defaults.sessionLength;
    }
    
    // Validate new words per session
    if (this.settings.newWordsPerSession < 1 || this.settings.newWordsPerSession > 20) {
      this.settings.newWordsPerSession = this.defaults.newWordsPerSession;
    }
    
    // Validate confidence threshold
    if (this.settings.speechConfidenceThreshold < 0 || this.settings.speechConfidenceThreshold > 1) {
      this.settings.speechConfidenceThreshold = this.defaults.speechConfidenceThreshold;
    }
  }

  // Export settings
  export() {
    return {
      ...this.settings,
      exportDate: new Date().toISOString(),
      version: '1.0.0'
    };
  }

  // Import settings
  async import(data) {
    try {
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid import data');
      }
      
      // Validate import data structure
      const validKeys = Object.keys(this.defaults);
      const importSettings = {};
      
      for (const [key, value] of Object.entries(data)) {
        if (validKeys.includes(key)) {
          importSettings[key] = value;
        }
      }
      
      await this.setMultiple(importSettings);
      this.validateSettings();
      await this.save();
      
      this.notifyListeners('import', importSettings);
    } catch (error) {
      console.error('Failed to import configuration:', error);
      throw error;
    }
  }

  // Check if API key is configured
  hasApiKey() {
    return this.settings.openaiApiKey && this.settings.openaiApiKey.length > 0;
  }

  // Get API headers for OpenAI
  getOpenAIHeaders() {
    return {
      'Authorization': `Bearer ${this.settings.openaiApiKey}`,
      'Content-Type': 'application/json'
    };
  }

  // Get speech synthesis settings
  getSpeechSettings() {
    return {
      language: this.settings.speechLanguage,
      rate: this.settings.speechRate,
      pitch: this.settings.speechPitch,
      volume: this.settings.speechVolume,
      voiceIndex: this.settings.voiceIndex
    };
  }

  // Get speech recognition settings
  getRecognitionSettings() {
    return {
      language: this.settings.speechLanguage,
      continuous: false,
      interimResults: true,
      maxAlternatives: 3,
      confidenceThreshold: this.settings.speechConfidenceThreshold
    };
  }

  // Add event listener
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
  }

  // Remove event listener
  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  // Notify listeners
  notifyListeners(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in config listener:', error);
        }
      });
    }
  }

  // Get all settings (for debugging)
  getAll() {
    return { ...this.settings };
  }

  // Check if setting exists
  has(key) {
    return key in this.settings;
  }

  // Get setting with fallback
  getWithFallback(key, fallback) {
    return this.has(key) ? this.get(key) : fallback;
  }
}

// Create global config instance
window.HablaBotConfig = new Config();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Config;
}
