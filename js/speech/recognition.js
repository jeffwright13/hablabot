// HablaBot Speech Recognition Manager
class SpeechRecognitionManager {
  constructor() {
    this.recognition = null;
    this.isListening = false;
    this.isSupported = false;
    this.currentLanguage = 'es-ES';
    this.confidenceThreshold = 0.7;
    this.maxAlternatives = 3;
    this.interimResults = true;
    this.continuous = false;
    
    // Retry logic
    this.maxRetries = 3;
    this.currentRetries = 0;
    this.retryDelay = 1000; // 1 second
    this.retryTimeout = null;
    this.shouldRetry = false; // Flag to track if we should retry
    
    // Event callbacks
    this.onResult = null;
    this.onError = null;
    this.onStart = null;
    this.onEnd = null;
    this.onInterimResult = null;
    
    // Initialize recognition
    this.init();
  }

  // Initialize speech recognition
  init() {
    try {
      // Check for browser support
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      
      if (!SpeechRecognition) {
        console.warn('Speech recognition not supported in this browser');
        this.isSupported = false;
        return false;
      }
      
      this.recognition = new SpeechRecognition();
      this.isSupported = true;
      
      // Configure recognition
      this.setupRecognition();
      
      console.log('Speech recognition initialized successfully');
      return true;
      
    } catch (error) {
      console.error('Failed to initialize speech recognition:', error);
      this.isSupported = false;
      return false;
    }
  }

  // Setup recognition configuration and event handlers
  setupRecognition() {
    if (!this.recognition) return;
    
    // Basic configuration
    this.recognition.lang = this.currentLanguage;
    this.recognition.continuous = this.continuous;
    this.recognition.interimResults = this.interimResults;
    this.recognition.maxAlternatives = this.maxAlternatives;
    
    // Event handlers
    this.recognition.onstart = () => {
      this.isListening = true;
      // Don't reset retry counter here - only reset when we get a successful result
      if (this.shouldRetry) {
        console.log(`Retry attempt ${this.currentRetries}/${this.maxRetries} - speech recognition started`);
      } else {
        console.log('Speech recognition started');
      }
      
      if (this.onStart) {
        this.onStart();
      }
    };
    
    this.recognition.onresult = (event) => {
      this.handleResult(event);
    };
    
    this.recognition.onerror = (event) => {
      this.handleError(event);
    };
    
    this.recognition.onend = () => {
      this.isListening = false;
      console.log('Speech recognition ended');
      
      // Only reset retry state if we're not in the middle of a retry sequence
      if (!this.shouldRetry) {
        this.currentRetries = 0;
      }
      
      if (this.onEnd) {
        this.onEnd();
      }
    };
    
    this.recognition.onnomatch = () => {
      console.log('No speech match found');
      this.handleError({ error: 'no-speech' });
    };
    
    this.recognition.onspeechstart = () => {
      console.log('Speech detected');
    };
    
    this.recognition.onspeechend = () => {
      console.log('Speech ended');
    };
  }

  // Handle recognition results
  handleResult(event) {
    const results = [];
    let finalTranscript = '';
    let interimTranscript = '';
    
    // Process all results
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const transcript = result[0].transcript;
      const confidence = result[0].confidence;
      
      if (result.isFinal) {
        finalTranscript += transcript;
        
        // Collect alternatives if available
        const alternatives = [];
        for (let j = 0; j < result.length; j++) {
          alternatives.push({
            transcript: result[j].transcript,
            confidence: result[j].confidence || 0
          });
        }
        
        results.push({
          transcript: transcript.trim(),
          confidence: confidence || 0,
          alternatives: alternatives,
          isFinal: true
        });
        
      } else {
        interimTranscript += transcript;
        
        // Call interim result callback
        if (this.onInterimResult) {
          this.onInterimResult({
            transcript: transcript.trim(),
            confidence: confidence || 0,
            isFinal: false
          });
        }
      }
    }
    
    // Process final results
    if (finalTranscript && this.onResult) {
      const bestResult = results.find(r => r.confidence >= this.confidenceThreshold) || results[0];
      
      if (bestResult) {
        // Reset retry counter on successful result
        if (this.shouldRetry) {
          console.log('Speech recognition successful after retry - resetting retry counter');
          this.shouldRetry = false;
          this.currentRetries = 0;
        }
        
        this.onResult({
          transcript: bestResult.transcript,
          confidence: bestResult.confidence,
          alternatives: bestResult.alternatives,
          rawResults: results
        });
      }
    }
  }

  // Handle recognition errors
  handleError(event) {
    const error = event.error || event.message || 'Unknown error';
    let errorMessage = '';
    let errorType = error;
    let shouldRetry = false;
    
    switch (error) {
      case 'no-speech':
        errorMessage = 'No speech detected. Please try speaking again.';
        errorType = 'no-speech';
        break;
      case 'audio-capture':
        errorMessage = 'Microphone access denied or not available.';
        errorType = 'audio-capture';
        break;
      case 'not-allowed':
        errorMessage = 'Microphone permission denied. Please allow microphone access.';
        errorType = 'not-allowed';
        break;
      case 'network':
        errorMessage = 'Network error. Checking connection...';
        errorType = 'network';
        shouldRetry = true;
        break;
      case 'service-not-allowed':
        errorMessage = 'Speech recognition service not allowed.';
        errorType = 'service-not-allowed';
        break;
      case 'bad-grammar':
        errorMessage = 'Speech recognition grammar error.';
        errorType = 'bad-grammar';
        break;
      case 'language-not-supported':
        errorMessage = 'Language not supported.';
        errorType = 'language-not-supported';
        break;
      default:
        errorMessage = `Speech recognition error: ${error}`;
        errorType = 'unknown';
    }
    
    console.error('Speech recognition error:', error);
    
    // Handle retry logic for network errors
    if (shouldRetry && this.currentRetries < this.maxRetries) {
      this.currentRetries++;
      this.shouldRetry = true; // Set retry flag
      console.log(`Retrying speech recognition (${this.currentRetries}/${this.maxRetries})...`);
      
      // Clear any existing retry timeout
      if (this.retryTimeout) {
        clearTimeout(this.retryTimeout);
      }
      
      // Retry after delay
      this.retryTimeout = setTimeout(() => {
        if (this.shouldRetry) {
          console.log('Executing retry...');
          this.start();
        }
      }, this.retryDelay * this.currentRetries); // Exponential backoff
      
      // Don't set isListening to false yet, and don't call onError callback
      return;
    }
    
    // Reset retry counter and flag
    this.currentRetries = 0;
    this.shouldRetry = false;
    
    if (this.onError) {
      this.onError({
        type: errorType,
        message: errorMessage,
        originalError: event,
        retriesExhausted: shouldRetry
      });
    }
    
    this.isListening = false;
  }

  // Start speech recognition
  start() {
    if (!this.isSupported) {
      const error = new Error('Speech recognition not supported');
      this.handleError(error);
      return false;
    }
    
    if (this.isListening && !this.shouldRetry) {
      console.warn('Speech recognition already active');
      return false;
    }
    
    try {
      // Clear any pending retry timeout
      if (this.retryTimeout) {
        clearTimeout(this.retryTimeout);
        this.retryTimeout = null;
      }
      
      // Reset retry flag when starting successfully
      if (this.shouldRetry) {
        console.log('Retry attempt starting...');
      }
      
      this.recognition.start();
      return true;
    } catch (error) {
      console.error('Failed to start speech recognition:', error);
      this.handleError(error);
      return false;
    }
  }

  // Stop speech recognition
  stop() {
    if (!this.recognition || !this.isListening) {
      return;
    }
    
    try {
      // Clear retry flag and timeout when manually stopping
      this.shouldRetry = false;
      this.currentRetries = 0;
      if (this.retryTimeout) {
        clearTimeout(this.retryTimeout);
        this.retryTimeout = null;
      }
      
      this.recognition.stop();
    } catch (error) {
      console.error('Failed to stop speech recognition:', error);
    }
  }

  // Abort speech recognition
  abort() {
    if (!this.recognition) {
      return;
    }
    
    try {
      this.recognition.abort();
      this.isListening = false;
    } catch (error) {
      console.error('Failed to abort speech recognition:', error);
    }
  }

  // Set language
  setLanguage(language) {
    this.currentLanguage = language;
    if (this.recognition) {
      this.recognition.lang = language;
    }
  }

  // Set confidence threshold
  setConfidenceThreshold(threshold) {
    this.confidenceThreshold = Math.max(0, Math.min(1, threshold));
  }

  // Set continuous mode
  setContinuous(continuous) {
    this.continuous = continuous;
    if (this.recognition) {
      this.recognition.continuous = continuous;
    }
  }

  // Set interim results
  setInterimResults(interim) {
    this.interimResults = interim;
    if (this.recognition) {
      this.recognition.interimResults = interim;
    }
  }

  // Set max alternatives
  setMaxAlternatives(max) {
    this.maxAlternatives = Math.max(1, Math.min(10, max));
    if (this.recognition) {
      this.recognition.maxAlternatives = this.maxAlternatives;
    }
  }

  // Get current status
  getStatus() {
    return {
      isSupported: this.isSupported,
      isListening: this.isListening,
      language: this.currentLanguage,
      confidenceThreshold: this.confidenceThreshold,
      continuous: this.continuous,
      interimResults: this.interimResults,
      maxAlternatives: this.maxAlternatives
    };
  }

  // Check if microphone permission is granted
  async checkMicrophonePermission() {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        return { state: 'unsupported' };
      }
      
      const permission = await navigator.permissions.query({ name: 'microphone' });
      return { state: permission.state };
      
    } catch (error) {
      console.error('Failed to check microphone permission:', error);
      return { state: 'unknown', error };
    }
  }

  // Request microphone permission
  async requestMicrophonePermission() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Stop the stream immediately as we only needed permission
      stream.getTracks().forEach(track => track.stop());
      
      return { granted: true };
      
    } catch (error) {
      console.error('Microphone permission denied:', error);
      return { 
        granted: false, 
        error: error.name === 'NotAllowedError' ? 'permission-denied' : 'unknown' 
      };
    }
  }

  // Test speech recognition with a simple phrase
  async testRecognition(timeout = 5000) {
    return new Promise((resolve) => {
      if (!this.isSupported) {
        resolve({ success: false, error: 'Speech recognition not supported' });
        return;
      }
      
      let testTimer;
      let hasResult = false;
      
      // Store original callbacks
      const originalCallbacks = {
        onResult: this.onResult,
        onError: this.onError,
        onStart: this.onStart,
        onEnd: this.onEnd
      };
      
      // Set test callbacks
      this.onResult = (result) => {
        if (!hasResult) {
          hasResult = true;
          clearTimeout(testTimer);
          this.restoreCallbacks(originalCallbacks);
          resolve({ 
            success: true, 
            result: result.transcript,
            confidence: result.confidence 
          });
        }
      };
      
      this.onError = (error) => {
        if (!hasResult) {
          hasResult = true;
          clearTimeout(testTimer);
          this.restoreCallbacks(originalCallbacks);
          resolve({ success: false, error: error.message });
        }
      };
      
      this.onStart = () => {
        console.log('Test recognition started - please say something...');
      };
      
      this.onEnd = () => {
        if (!hasResult) {
          hasResult = true;
          clearTimeout(testTimer);
          this.restoreCallbacks(originalCallbacks);
          resolve({ success: false, error: 'No speech detected during test' });
        }
      };
      
      // Set timeout
      testTimer = setTimeout(() => {
        if (!hasResult) {
          hasResult = true;
          this.stop();
          this.restoreCallbacks(originalCallbacks);
          resolve({ success: false, error: 'Test timeout' });
        }
      }, timeout);
      
      // Start recognition
      if (!this.start()) {
        clearTimeout(testTimer);
        this.restoreCallbacks(originalCallbacks);
        resolve({ success: false, error: 'Failed to start recognition' });
      }
    });
  }

  // Restore original callbacks
  restoreCallbacks(callbacks) {
    this.onResult = callbacks.onResult;
    this.onError = callbacks.onError;
    this.onStart = callbacks.onStart;
    this.onEnd = callbacks.onEnd;
  }

  // Get available languages (static list for Spanish variants)
  getAvailableLanguages() {
    return [
      { code: 'es-ES', name: 'Spanish (Spain)', flag: '🇪🇸' },
      { code: 'es-MX', name: 'Spanish (Mexico)', flag: '🇲🇽' },
      { code: 'es-AR', name: 'Spanish (Argentina)', flag: '🇦🇷' },
      { code: 'es-CO', name: 'Spanish (Colombia)', flag: '🇨🇴' },
      { code: 'es-CL', name: 'Spanish (Chile)', flag: '🇨🇱' },
      { code: 'es-PE', name: 'Spanish (Peru)', flag: '🇵🇪' },
      { code: 'es-VE', name: 'Spanish (Venezuela)', flag: '🇻🇪' },
      { code: 'es-UY', name: 'Spanish (Uruguay)', flag: '🇺🇾' },
      { code: 'es-PY', name: 'Spanish (Paraguay)', flag: '🇵🇾' },
      { code: 'es-BO', name: 'Spanish (Bolivia)', flag: '🇧🇴' },
      { code: 'es-EC', name: 'Spanish (Ecuador)', flag: '🇪🇨' },
      { code: 'es-GT', name: 'Spanish (Guatemala)', flag: '🇬🇹' },
      { code: 'es-CR', name: 'Spanish (Costa Rica)', flag: '🇨🇷' },
      { code: 'es-PA', name: 'Spanish (Panama)', flag: '🇵🇦' },
      { code: 'es-DO', name: 'Spanish (Dominican Republic)', flag: '🇩🇴' },
      { code: 'es-PR', name: 'Spanish (Puerto Rico)', flag: '🇵🇷' },
      { code: 'es-US', name: 'Spanish (United States)', flag: '🇺🇸' }
    ];
  }

  // Clean up resources
  destroy() {
    this.stop();
    
    if (this.recognition) {
      this.recognition.onstart = null;
      this.recognition.onresult = null;
      this.recognition.onerror = null;
      this.recognition.onend = null;
      this.recognition.onnomatch = null;
      this.recognition.onspeechstart = null;
      this.recognition.onspeechend = null;
      this.recognition = null;
    }
    
    this.onResult = null;
    this.onError = null;
    this.onStart = null;
    this.onEnd = null;
    this.onInterimResult = null;
  }
}

// Create global instance
window.HablaBotSpeechRecognition = new SpeechRecognitionManager();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SpeechRecognitionManager;
}
