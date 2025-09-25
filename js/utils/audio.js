// HablaBot Audio Utilities
class AudioUtils {
  constructor() {
    this.audioContext = null;
    this.analyser = null;
    this.microphone = null;
    this.isRecording = false;
    this.audioData = null;
    this.visualizationFrame = null;
    
    // Audio settings
    this.sampleRate = 44100;
    this.bufferSize = 2048;
    this.fftSize = 256;
    
    // Event callbacks
    this.onVolumeChange = null;
    this.onSilenceDetected = null;
    this.onSpeechDetected = null;
    
    // Volume detection settings
    this.volumeThreshold = 0.01;
    this.silenceThreshold = 0.005;
    this.silenceTimeout = 2000; // ms
    this.silenceTimer = null;
    this.lastVolumeLevel = 0;
  }

  // Initialize audio context and components
  async init() {
    try {
      // Create audio context
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) {
        throw new Error('Web Audio API not supported');
      }
      
      this.audioContext = new AudioContext();
      
      // Create analyser for volume detection
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = this.fftSize;
      this.analyser.smoothingTimeConstant = 0.8;
      
      console.log('Audio utilities initialized');
      return true;
      
    } catch (error) {
      console.error('Failed to initialize audio utilities:', error);
      return false;
    }
  }

  // Request microphone access
  async requestMicrophoneAccess() {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('MediaDevices API not supported');
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: this.sampleRate
        }
      });
      
      // Create microphone source
      this.microphone = this.audioContext.createMediaStreamSource(stream);
      
      // Connect to analyser
      this.microphone.connect(this.analyser);
      
      console.log('Microphone access granted');
      return { success: true, stream };
      
    } catch (error) {
      console.error('Microphone access denied:', error);
      return { 
        success: false, 
        error: error.name === 'NotAllowedError' ? 'permission-denied' : 'unknown',
        message: error.message 
      };
    }
  }

  // Start volume monitoring
  startVolumeMonitoring() {
    if (!this.analyser) {
      console.warn('Analyser not initialized');
      return false;
    }
    
    this.isRecording = true;
    this.audioData = new Uint8Array(this.analyser.frequencyBinCount);
    
    const monitorVolume = () => {
      if (!this.isRecording) return;
      
      this.analyser.getByteFrequencyData(this.audioData);
      
      // Calculate volume level
      const volumeLevel = this.calculateVolumeLevel(this.audioData);
      this.lastVolumeLevel = volumeLevel;
      
      // Trigger volume change callback
      if (this.onVolumeChange) {
        this.onVolumeChange(volumeLevel);
      }
      
      // Check for speech/silence
      this.detectSpeechSilence(volumeLevel);
      
      this.visualizationFrame = requestAnimationFrame(monitorVolume);
    };
    
    monitorVolume();
    return true;
  }

  // Stop volume monitoring
  stopVolumeMonitoring() {
    this.isRecording = false;
    
    if (this.visualizationFrame) {
      cancelAnimationFrame(this.visualizationFrame);
      this.visualizationFrame = null;
    }
    
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }

  // Calculate volume level from frequency data
  calculateVolumeLevel(dataArray) {
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    
    const average = sum / dataArray.length;
    return average / 255; // Normalize to 0-1
  }

  // Detect speech and silence
  detectSpeechSilence(volumeLevel) {
    if (volumeLevel > this.volumeThreshold) {
      // Speech detected
      if (this.silenceTimer) {
        clearTimeout(this.silenceTimer);
        this.silenceTimer = null;
      }
      
      if (this.onSpeechDetected) {
        this.onSpeechDetected(volumeLevel);
      }
      
    } else if (volumeLevel < this.silenceThreshold) {
      // Potential silence
      if (!this.silenceTimer) {
        this.silenceTimer = setTimeout(() => {
          if (this.onSilenceDetected) {
            this.onSilenceDetected();
          }
          this.silenceTimer = null;
        }, this.silenceTimeout);
      }
    }
  }

  // Create audio visualizer
  createVisualizer(canvas, options = {}) {
    if (!canvas || !this.analyser) return null;
    
    const ctx = canvas.getContext('2d');
    const {
      barColor = '#e74c3c',
      backgroundColor = 'transparent',
      barWidth = 2,
      barSpacing = 1,
      smoothing = 0.8
    } = options;
    
    const visualize = () => {
      if (!this.isRecording) return;
      
      this.analyser.getByteFrequencyData(this.audioData);
      
      // Clear canvas
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Draw frequency bars
      const barCount = Math.min(this.audioData.length, Math.floor(canvas.width / (barWidth + barSpacing)));
      const barWidthActual = (canvas.width - (barCount - 1) * barSpacing) / barCount;
      
      ctx.fillStyle = barColor;
      
      for (let i = 0; i < barCount; i++) {
        const barHeight = (this.audioData[i] / 255) * canvas.height;
        const x = i * (barWidthActual + barSpacing);
        const y = canvas.height - barHeight;
        
        ctx.fillRect(x, y, barWidthActual, barHeight);
      }
      
      requestAnimationFrame(visualize);
    };
    
    if (this.isRecording) {
      visualize();
    }
    
    return { start: visualize, stop: () => {} };
  }

  // Create waveform visualizer
  createWaveformVisualizer(canvas, options = {}) {
    if (!canvas || !this.analyser) return null;
    
    const ctx = canvas.getContext('2d');
    const {
      lineColor = '#e74c3c',
      backgroundColor = 'transparent',
      lineWidth = 2,
      amplitude = 1
    } = options;
    
    const timeData = new Uint8Array(this.analyser.frequencyBinCount);
    
    const visualize = () => {
      if (!this.isRecording) return;
      
      this.analyser.getByteTimeDomainData(timeData);
      
      // Clear canvas
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Draw waveform
      ctx.lineWidth = lineWidth;
      ctx.strokeStyle = lineColor;
      ctx.beginPath();
      
      const sliceWidth = canvas.width / timeData.length;
      let x = 0;
      
      for (let i = 0; i < timeData.length; i++) {
        const v = (timeData[i] / 128.0) * amplitude;
        const y = (v * canvas.height) / 2;
        
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        
        x += sliceWidth;
      }
      
      ctx.stroke();
      
      requestAnimationFrame(visualize);
    };
    
    if (this.isRecording) {
      visualize();
    }
    
    return { start: visualize, stop: () => {} };
  }

  // Create volume meter
  createVolumeMeter(element, options = {}) {
    if (!element) return null;
    
    const {
      barColor = '#e74c3c',
      backgroundColor = '#f0f0f0',
      orientation = 'horizontal', // 'horizontal' or 'vertical'
      smoothing = 0.8
    } = options;
    
    let smoothedVolume = 0;
    
    const updateMeter = () => {
      if (!this.isRecording) return;
      
      // Smooth the volume level
      smoothedVolume = smoothedVolume * smoothing + this.lastVolumeLevel * (1 - smoothing);
      
      // Update visual meter
      if (orientation === 'horizontal') {
        const percentage = Math.min(100, smoothedVolume * 100);
        element.style.background = `linear-gradient(to right, ${barColor} ${percentage}%, ${backgroundColor} ${percentage}%)`;
      } else {
        const percentage = Math.min(100, smoothedVolume * 100);
        element.style.background = `linear-gradient(to top, ${barColor} ${percentage}%, ${backgroundColor} ${percentage}%)`;
      }
      
      requestAnimationFrame(updateMeter);
    };
    
    if (this.isRecording) {
      updateMeter();
    }
    
    return { start: updateMeter, stop: () => {} };
  }

  // Play audio from URL or blob
  async playAudio(source, options = {}) {
    try {
      const {
        volume = 1.0,
        playbackRate = 1.0,
        onEnded = null,
        onError = null
      } = options;
      
      const audio = new Audio();
      
      // Set up event listeners
      audio.onended = onEnded;
      audio.onerror = onError;
      
      // Configure audio
      audio.volume = Math.max(0, Math.min(1, volume));
      audio.playbackRate = Math.max(0.25, Math.min(4, playbackRate));
      
      // Load and play
      if (source instanceof Blob) {
        audio.src = URL.createObjectURL(source);
      } else {
        audio.src = source;
      }
      
      await audio.play();
      
      return {
        audio,
        stop: () => {
          audio.pause();
          audio.currentTime = 0;
        },
        pause: () => audio.pause(),
        resume: () => audio.play()
      };
      
    } catch (error) {
      console.error('Failed to play audio:', error);
      throw error;
    }
  }

  // Record audio to blob
  async startRecording(options = {}) {
    try {
      const {
        mimeType = 'audio/webm',
        audioBitsPerSecond = 128000
      } = options;
      
      if (!this.microphone) {
        throw new Error('Microphone not initialized');
      }
      
      // Get the original stream from microphone
      const stream = this.microphone.mediaStream;
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: mimeType,
        audioBitsPerSecond: audioBitsPerSecond
      });
      
      const chunks = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      
      const recordingPromise = new Promise((resolve, reject) => {
        mediaRecorder.onstop = () => {
          const blob = new Blob(chunks, { type: mimeType });
          resolve(blob);
        };
        
        mediaRecorder.onerror = (event) => {
          reject(new Error('Recording failed: ' + event.error));
        };
      });
      
      mediaRecorder.start();
      
      return {
        stop: () => {
          mediaRecorder.stop();
          return recordingPromise;
        },
        pause: () => mediaRecorder.pause(),
        resume: () => mediaRecorder.resume(),
        isRecording: () => mediaRecorder.state === 'recording'
      };
      
    } catch (error) {
      console.error('Failed to start recording:', error);
      throw error;
    }
  }

  // Get audio device information
  async getAudioDevices() {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        throw new Error('MediaDevices enumeration not supported');
      }
      
      const devices = await navigator.mediaDevices.enumerateDevices();
      
      return {
        audioInputs: devices.filter(device => device.kind === 'audioinput'),
        audioOutputs: devices.filter(device => device.kind === 'audiooutput')
      };
      
    } catch (error) {
      console.error('Failed to get audio devices:', error);
      return { audioInputs: [], audioOutputs: [] };
    }
  }

  // Test audio functionality
  async testAudio() {
    const results = {
      webAudioAPI: false,
      mediaDevices: false,
      microphoneAccess: false,
      audioPlayback: false,
      errors: []
    };
    
    try {
      // Test Web Audio API
      if (this.audioContext) {
        results.webAudioAPI = true;
      } else {
        results.errors.push('Web Audio API not available');
      }
      
      // Test MediaDevices API
      if (navigator.mediaDevices) {
        results.mediaDevices = true;
        
        // Test microphone access
        try {
          const micResult = await this.requestMicrophoneAccess();
          results.microphoneAccess = micResult.success;
          if (!micResult.success) {
            results.errors.push(`Microphone access failed: ${micResult.message}`);
          }
        } catch (error) {
          results.errors.push(`Microphone test failed: ${error.message}`);
        }
      } else {
        results.errors.push('MediaDevices API not available');
      }
      
      // Test audio playback
      try {
        const audio = new Audio();
        audio.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmAaAjuJzfPTgC4HKm+/7+OZURE';
        await audio.play();
        results.audioPlayback = true;
      } catch (error) {
        results.errors.push(`Audio playback test failed: ${error.message}`);
      }
      
    } catch (error) {
      results.errors.push(`Audio test failed: ${error.message}`);
    }
    
    return results;
  }

  // Get current volume level
  getCurrentVolumeLevel() {
    return this.lastVolumeLevel;
  }

  // Set volume thresholds
  setVolumeThresholds(speechThreshold, silenceThreshold) {
    this.volumeThreshold = Math.max(0, Math.min(1, speechThreshold));
    this.silenceThreshold = Math.max(0, Math.min(1, silenceThreshold));
  }

  // Set silence timeout
  setSilenceTimeout(timeout) {
    this.silenceTimeout = Math.max(500, timeout);
  }

  // Check if audio is supported
  isSupported() {
    return !!(window.AudioContext || window.webkitAudioContext) &&
           !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  // Get audio context state
  getAudioContextState() {
    return this.audioContext ? this.audioContext.state : 'closed';
  }

  // Resume audio context (required for some browsers)
  async resumeAudioContext() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
        console.log('Audio context resumed');
        return true;
      } catch (error) {
        console.error('Failed to resume audio context:', error);
        return false;
      }
    }
    return true;
  }

  // Clean up resources
  destroy() {
    this.stopVolumeMonitoring();
    
    if (this.microphone) {
      this.microphone.disconnect();
      this.microphone = null;
    }
    
    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.onVolumeChange = null;
    this.onSilenceDetected = null;
    this.onSpeechDetected = null;
  }
}

// Create global instance
window.HablaBotAudio = new AudioUtils();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AudioUtils;
}
