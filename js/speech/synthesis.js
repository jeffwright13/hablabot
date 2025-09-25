// HablaBot Speech Synthesis Manager
class SpeechSynthesisManager {
  constructor() {
    this.synthesis = null;
    this.isSupported = false;
    this.isSpeaking = false;
    this.isPaused = false;
    this.currentUtterance = null;
    this.voiceQueue = [];
    this.availableVoices = [];
    this.selectedVoice = null;
    
    // Default settings
    this.settings = {
      language: 'es-ES',
      rate: 0.9,
      pitch: 1.0,
      volume: 0.8,
      voiceIndex: 0
    };
    
    // Event callbacks
    this.onStart = null;
    this.onEnd = null;
    this.onError = null;
    this.onPause = null;
    this.onResume = null;
    this.onBoundary = null;
    
    // Initialize synthesis
    this.init();
  }

  // Initialize speech synthesis
  init() {
    try {
      if (!('speechSynthesis' in window)) {
        console.warn('Speech synthesis not supported in this browser');
        this.isSupported = false;
        return;
      }
      
      this.synthesis = window.speechSynthesis;
      this.isSupported = true;
      
      // Load available voices
      this.loadVoices();
      
      // Listen for voice changes (some browsers load voices asynchronously)
      if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = () => {
          this.loadVoices();
        };
      }
      
      console.log('Speech synthesis initialized successfully');
      
    } catch (error) {
      console.error('Failed to initialize speech synthesis:', error);
      this.isSupported = false;
    }
  }

  // Load available voices
  loadVoices() {
    if (!this.synthesis) return;
    
    this.availableVoices = this.synthesis.getVoices();
    
    // Filter for Spanish voices
    this.spanishVoices = this.availableVoices.filter(voice => 
      voice.lang.startsWith('es') || 
      voice.name.toLowerCase().includes('spanish') ||
      voice.name.toLowerCase().includes('español')
    );
    
    // Set default voice if not already set
    if (!this.selectedVoice && this.spanishVoices.length > 0) {
      this.selectedVoice = this.spanishVoices[0];
    }
    
    console.log(`Loaded ${this.availableVoices.length} voices (${this.spanishVoices.length} Spanish)`);
  }

  // Speak text
  speak(text, options = {}) {
    if (!this.isSupported) {
      console.error('Speech synthesis not supported');
      return false;
    }
    
    if (!text || text.trim() === '') {
      console.warn('No text provided for speech synthesis');
      return false;
    }
    
    // Stop current speech if speaking
    if (this.isSpeaking) {
      this.stop();
    }
    
    // Create utterance
    const utterance = new SpeechSynthesisUtterance(text.trim());
    this.currentUtterance = utterance;
    
    // Apply settings
    this.applySettings(utterance, options);
    
    // Set up event handlers
    this.setupUtteranceEvents(utterance);
    
    // Add to queue and speak
    try {
      this.synthesis.speak(utterance);
      this.isSpeaking = true;
      return true;
    } catch (error) {
      console.error('Failed to speak text:', error);
      this.handleError(error);
      return false;
    }
  }

  // Apply settings to utterance
  applySettings(utterance, options = {}) {
    const settings = { ...this.settings, ...options };
    
    // Set voice
    if (this.selectedVoice) {
      utterance.voice = this.selectedVoice;
    } else if (settings.language) {
      utterance.lang = settings.language;
    }
    
    // Set speech parameters
    utterance.rate = Math.max(0.1, Math.min(10, settings.rate));
    utterance.pitch = Math.max(0, Math.min(2, settings.pitch));
    utterance.volume = Math.max(0, Math.min(1, settings.volume));
  }

  // Setup utterance event handlers
  setupUtteranceEvents(utterance) {
    utterance.onstart = (event) => {
      console.log('Speech synthesis started');
      this.isSpeaking = true;
      this.isPaused = false;
      
      if (this.onStart) {
        this.onStart(event);
      }
    };
    
    utterance.onend = (event) => {
      console.log('Speech synthesis ended');
      this.isSpeaking = false;
      this.isPaused = false;
      this.currentUtterance = null;
      
      if (this.onEnd) {
        this.onEnd(event);
      }
    };
    
    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event.error);
      this.isSpeaking = false;
      this.isPaused = false;
      this.currentUtterance = null;
      
      this.handleError(event);
    };
    
    utterance.onpause = (event) => {
      console.log('Speech synthesis paused');
      this.isPaused = true;
      
      if (this.onPause) {
        this.onPause(event);
      }
    };
    
    utterance.onresume = (event) => {
      console.log('Speech synthesis resumed');
      this.isPaused = false;
      
      if (this.onResume) {
        this.onResume(event);
      }
    };
    
    utterance.onboundary = (event) => {
      if (this.onBoundary) {
        this.onBoundary(event);
      }
    };
  }

  // Stop speech synthesis
  stop() {
    if (!this.synthesis) return;
    
    try {
      this.synthesis.cancel();
      this.isSpeaking = false;
      this.isPaused = false;
      this.currentUtterance = null;
    } catch (error) {
      console.error('Failed to stop speech synthesis:', error);
    }
  }

  // Pause speech synthesis
  pause() {
    if (!this.synthesis || !this.isSpeaking) return;
    
    try {
      this.synthesis.pause();
    } catch (error) {
      console.error('Failed to pause speech synthesis:', error);
    }
  }

  // Resume speech synthesis
  resume() {
    if (!this.synthesis || !this.isPaused) return;
    
    try {
      this.synthesis.resume();
    } catch (error) {
      console.error('Failed to resume speech synthesis:', error);
    }
  }

  // Handle synthesis errors
  handleError(event) {
    let errorMessage = 'Speech synthesis error';
    
    if (event && event.error) {
      switch (event.error) {
        case 'network':
          errorMessage = 'Network error during speech synthesis';
          break;
        case 'synthesis-unavailable':
          errorMessage = 'Speech synthesis service unavailable';
          break;
        case 'synthesis-failed':
          errorMessage = 'Speech synthesis failed';
          break;
        case 'language-unavailable':
          errorMessage = 'Selected language not available for speech synthesis';
          break;
        case 'voice-unavailable':
          errorMessage = 'Selected voice not available';
          break;
        case 'text-too-long':
          errorMessage = 'Text too long for speech synthesis';
          break;
        case 'invalid-argument':
          errorMessage = 'Invalid argument for speech synthesis';
          break;
        default:
          errorMessage = `Speech synthesis error: ${event.error}`;
      }
    }
    
    if (this.onError) {
      this.onError({
        type: event?.error || 'unknown',
        message: errorMessage,
        originalEvent: event
      });
    }
  }

  // Set voice by index
  setVoice(index) {
    if (index >= 0 && index < this.spanishVoices.length) {
      this.selectedVoice = this.spanishVoices[index];
      this.settings.voiceIndex = index;
      return true;
    }
    return false;
  }

  // Set voice by name
  setVoiceByName(name) {
    const voice = this.spanishVoices.find(v => 
      v.name === name || v.name.toLowerCase().includes(name.toLowerCase())
    );
    
    if (voice) {
      this.selectedVoice = voice;
      this.settings.voiceIndex = this.spanishVoices.indexOf(voice);
      return true;
    }
    return false;
  }

  // Set speech rate
  setRate(rate) {
    this.settings.rate = Math.max(0.1, Math.min(10, rate));
  }

  // Set speech pitch
  setPitch(pitch) {
    this.settings.pitch = Math.max(0, Math.min(2, pitch));
  }

  // Set speech volume
  setVolume(volume) {
    this.settings.volume = Math.max(0, Math.min(1, volume));
  }

  // Set language
  setLanguage(language) {
    this.settings.language = language;
    
    // Try to find a voice for this language
    const voice = this.spanishVoices.find(v => v.lang === language);
    if (voice) {
      this.selectedVoice = voice;
      this.settings.voiceIndex = this.spanishVoices.indexOf(voice);
    }
  }

  // Get available Spanish voices
  getSpanishVoices() {
    return this.spanishVoices.map((voice, index) => ({
      index: index,
      name: voice.name,
      lang: voice.lang,
      localService: voice.localService,
      default: voice.default,
      voiceURI: voice.voiceURI
    }));
  }

  // Get current settings
  getSettings() {
    return {
      ...this.settings,
      selectedVoice: this.selectedVoice ? {
        name: this.selectedVoice.name,
        lang: this.selectedVoice.lang
      } : null
    };
  }

  // Get current status
  getStatus() {
    return {
      isSupported: this.isSupported,
      isSpeaking: this.isSpeaking,
      isPaused: this.isPaused,
      voiceCount: this.availableVoices.length,
      spanishVoiceCount: this.spanishVoices.length,
      selectedVoice: this.selectedVoice ? this.selectedVoice.name : null
    };
  }

  // Test speech synthesis
  async testSynthesis(text = '¡Hola! Soy tu tutor de español.') {
    return new Promise((resolve) => {
      if (!this.isSupported) {
        resolve({ success: false, error: 'Speech synthesis not supported' });
        return;
      }
      
      let hasResult = false;
      const timeout = setTimeout(() => {
        if (!hasResult) {
          hasResult = true;
          this.stop();
          resolve({ success: false, error: 'Test timeout' });
        }
      }, 10000);
      
      // Store original callbacks
      const originalCallbacks = {
        onStart: this.onStart,
        onEnd: this.onEnd,
        onError: this.onError
      };
      
      // Set test callbacks
      this.onStart = () => {
        console.log('Test synthesis started');
      };
      
      this.onEnd = () => {
        if (!hasResult) {
          hasResult = true;
          clearTimeout(timeout);
          this.restoreCallbacks(originalCallbacks);
          resolve({ success: true });
        }
      };
      
      this.onError = (error) => {
        if (!hasResult) {
          hasResult = true;
          clearTimeout(timeout);
          this.restoreCallbacks(originalCallbacks);
          resolve({ success: false, error: error.message });
        }
      };
      
      // Start test
      if (!this.speak(text)) {
        clearTimeout(timeout);
        this.restoreCallbacks(originalCallbacks);
        resolve({ success: false, error: 'Failed to start synthesis' });
      }
    });
  }

  // Restore original callbacks
  restoreCallbacks(callbacks) {
    this.onStart = callbacks.onStart;
    this.onEnd = callbacks.onEnd;
    this.onError = callbacks.onError;
  }

  // Populate voice select element
  populateVoiceSelect(selectElement) {
    if (!selectElement) return;
    
    // Clear existing options
    selectElement.innerHTML = '';
    
    // Add default option
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Select a voice...';
    selectElement.appendChild(defaultOption);
    
    // Add Spanish voices
    this.spanishVoices.forEach((voice, index) => {
      const option = document.createElement('option');
      option.value = index;
      option.textContent = `${voice.name} (${voice.lang})`;
      
      if (voice.localService) {
        option.textContent += ' - Local';
      }
      
      if (this.selectedVoice && voice.name === this.selectedVoice.name) {
        option.selected = true;
      }
      
      selectElement.appendChild(option);
    });
  }

  // Break long text into chunks for better synthesis
  breakTextIntoChunks(text, maxLength = 200) {
    if (text.length <= maxLength) {
      return [text];
    }
    
    const chunks = [];
    const sentences = text.split(/[.!?]+/);
    let currentChunk = '';
    
    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      if (!trimmedSentence) continue;
      
      if (currentChunk.length + trimmedSentence.length + 1 <= maxLength) {
        currentChunk += (currentChunk ? '. ' : '') + trimmedSentence;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk + '.');
        }
        currentChunk = trimmedSentence;
      }
    }
    
    if (currentChunk) {
      chunks.push(currentChunk + '.');
    }
    
    return chunks;
  }

  // Speak long text in chunks
  async speakLongText(text, options = {}) {
    const chunks = this.breakTextIntoChunks(text);
    
    for (let i = 0; i < chunks.length; i++) {
      await new Promise((resolve) => {
        const originalOnEnd = this.onEnd;
        this.onEnd = () => {
          if (originalOnEnd) originalOnEnd();
          resolve();
        };
        
        this.speak(chunks[i], options);
      });
      
      // Small pause between chunks
      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
  }

  // Clean up resources
  destroy() {
    this.stop();
    
    this.onStart = null;
    this.onEnd = null;
    this.onError = null;
    this.onPause = null;
    this.onResume = null;
    this.onBoundary = null;
    
    this.synthesis = null;
    this.currentUtterance = null;
    this.availableVoices = [];
    this.spanishVoices = [];
    this.selectedVoice = null;
  }
}

// Create global instance
window.HablaBotSpeechSynthesis = new SpeechSynthesisManager();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SpeechSynthesisManager;
}
