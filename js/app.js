// HablaBot Main Application Controller
class HablaBotApp {
  constructor() {
    this.isInitialized = false;
    this.currentView = 'conversation';
    this.currentSession = null;
    this.isFirstTime = false;
    
    // Component references
    this.config = null;
    this.database = null;
    this.speechRecognition = null;
    this.speechSynthesis = null;
    this.conversationEngine = null;
    this.vocabularyManager = null;
    this.spacedRepetition = null;
    
    // DOM elements
    this.elements = {};
    
    // Event listeners
    this.eventListeners = new Map();
  }

  // Initialize the application
  async init() {
    try {
      console.log('Initializing HablaBot...');
      
      // Cache DOM elements first
      this.cacheElements();
      
      // Show loading screen
      this.showLoadingScreen();
      
      // Check browser compatibility
      this.checkBrowserCompatibility();
      
      // Initialize core components
      await this.initializeComponents();
      
      // Set up event listeners
      this.setupEventListeners();
      
      // Check if first time user
      await this.checkFirstTimeUser();
      
      // Initialize UI
      this.initializeUI();
      
      // Hide loading screen and show app
      this.hideLoadingScreen();
      
      this.isInitialized = true;
      console.log('HablaBot initialized successfully');
      
    } catch (error) {
      console.error('Failed to initialize HablaBot:', error);
      this.showError('Failed to initialize application. Please refresh the page.');
    }
  }

  // Check browser compatibility
  checkBrowserCompatibility() {
    const coreFeatures = ['indexedDB', 'serviceWorker'];
    const speechFeatures = ['speechRecognition', 'speechSynthesis'];
    
    const missingCoreFeatures = coreFeatures.filter(feature => 
      !H.supportsFeature(feature)
    );
    
    const missingSpeechFeatures = speechFeatures.filter(feature => 
      !H.supportsFeature(feature)
    );
    
    if (missingCoreFeatures.length > 0) {
      const message = `Your browser doesn't support core features: ${missingCoreFeatures.join(', ')}. Please use a modern browser like Chrome, Firefox, or Safari.`;
      throw new Error(message);
    }
    
    if (missingSpeechFeatures.length > 0) {
      console.warn(`Speech features not supported: ${missingSpeechFeatures.join(', ')}. Some functionality may be limited.`);
      H.showToast(`Speech features limited in this browser. For full functionality, use Chrome or Edge.`, 'warning', 5000);
    }
  }

  // Initialize core components
  async initializeComponents() {
    // Initialize configuration
    this.config = window.HablaBotConfig;
    await this.config.init();
    
    // Initialize database
    this.database = window.HablaBotDB;
    await this.database.init();
    
    // Initialize speech components
    this.speechRecognition = window.HablaBotSpeechRecognition;
    this.speechRecognition.init();
    
    // Set up speech recognition error handling
    this.speechRecognition.onError = (error) => {
      console.warn('Speech recognition error:', error);
      
      // Handle different error types
      switch (error.type) {
        case 'network':
          if (error.retriesExhausted) {
            H.showToast('Speech recognition unavailable. Please check your internet connection.', 'warning', 5000);
            this.stopListening();
          } else {
            // Show a subtle indicator that we're retrying
            H.showToast('Reconnecting...', 'info', 2000);
          }
          break;
        case 'not-allowed':
          H.showToast('Microphone access denied. Please allow microphone access and try again.', 'error', 8000);
          this.stopListening();
          break;
        case 'no-speech':
          // Don't show error for no-speech, just stop listening
          this.stopListening();
          break;
        default:
          H.showToast(error.message, 'warning', 4000);
          this.stopListening();
      }
    };
    
    this.speechSynthesis = window.HablaBotSpeechSynthesis;
    this.speechSynthesis.init();
    
    // Initialize AI conversation engine
    this.conversationEngine = window.HablaBotConversation;
    await this.conversationEngine.init(this.config, window.HablaBotPrompts);
    
    // Initialize vocabulary manager
    this.vocabularyManager = window.HablaBotVocabulary;
    await this.vocabularyManager.init(this.database, window.HablaBotSpacedRepetition);
    
    // Initialize UI components
    window.HablaBotComponents.init(this.vocabularyManager, window.HablaBotUIState);
    window.HablaBotUIState.init(this.elements);
  }

  // Cache DOM elements
  cacheElements() {
    this.elements = {
      // Main containers
      loadingScreen: H.$('#loading-screen'),
      appContainer: H.$('#app-container'),
      setupOverlay: H.$('#setup-overlay'),
      
      // Navigation
      navButtons: H.$$('.nav-btn'),
      conversationBtn: H.$('#conversation-btn'),
      vocabularyBtn: H.$('#vocabulary-btn'),
      progressBtn: H.$('#progress-btn'),
      settingsBtn: H.$('#settings-btn'),
      
      // Views
      conversationView: H.$('#conversation-view'),
      vocabularyView: H.$('#vocabulary-view'),
      progressView: H.$('#progress-view'),
      settingsView: H.$('#settings-view'),
      
      // Conversation elements
      conversationSetup: H.$('.conversation-setup'),
      conversationActive: H.$('#conversation-active'),
      scenarioSelect: H.$('#scenario-select'),
      sessionLengthSlider: H.$('#session-length'),
      sessionLengthDisplay: H.$('#session-length-display'),
      difficultySelect: H.$('#difficulty-select'),
      startConversationBtn: H.$('#start-conversation'),
      
      // Active conversation elements
      conversationHistory: H.$('#conversation-history'),
      aiSpeaking: H.$('#ai-speaking'),
      aiText: H.$('#ai-text'),
      pushToTalkBtn: H.$('#push-to-talk'),
      listeningIndicator: H.$('#listening-indicator'),
      processingIndicator: H.$('#processing-indicator'),
      userSpeechText: H.$('#user-speech-text'),
      pauseSessionBtn: H.$('#pause-session'),
      endSessionBtn: H.$('#end-session'),
      wordsPracticed: H.$('#words-practiced'),
      timeRemaining: H.$('#time-remaining'),
      progressFill: H.$('#progress-fill'),
      
      // Vocabulary elements
      addWordBtn: H.$('#add-word-btn'),
      importVocabBtn: H.$('#import-vocab-btn'),
      exportVocabBtn: H.$('#export-vocab-btn'),
      vocabularyList: H.$('#vocabulary-list'),
      
      // Settings elements
      openaiApiKey: H.$('#openai-api-key'),
      testApiKeyBtn: H.$('#test-api-key'),
      voiceSelect: H.$('#voice-select'),
      speechRate: H.$('#speech-rate'),
      speechRateValue: H.$('#speech-rate-value'),
      speechVolume: H.$('#speech-volume'),
      speechVolumeValue: H.$('#speech-volume-value'),
      
      // Modal and toast
      modalOverlay: H.$('#modal-overlay'),
      modalBody: H.$('#modal-body'),
      toastContainer: H.$('#toast-container'),

      // User Management
      currentUserDisplay: H.$('#current-user-display'),
      currentUserAvatar: H.$('#current-user-avatar'),
      currentUserName: H.$('#current-user-name'),
      switchUserBtn: H.$('#select-user-btn'),
      createUserBtn: H.$('#create-user-btn'),
      deleteUserBtn: H.$('#delete-user-btn')
    };
  }

  // Set up event listeners
  setupEventListeners() {
    // Navigation
    this.elements.navButtons.forEach(btn => {
      H.on(btn, 'click', (e) => this.handleNavigation(e));
    });
    
    // Conversation setup
    H.on(this.elements.sessionLengthSlider, 'input', (e) => {
      this.elements.sessionLengthDisplay.textContent = e.target.value;
    });
    
    H.on(this.elements.startConversationBtn, 'click', () => {
      this.startConversation();
    });
    
    // Active conversation controls
    H.on(this.elements.pushToTalkBtn, 'mousedown', () => {
      this.startListening();
    });
    
    H.on(this.elements.pushToTalkBtn, 'mouseup', () => {
      this.stopListening();
    });
    
    H.on(this.elements.pushToTalkBtn, 'mouseleave', () => {
      this.stopListening();
    });
    
    // Touch events for mobile
    H.on(this.elements.pushToTalkBtn, 'touchstart', (e) => {
      e.preventDefault();
      this.startListening();
    });
    
    H.on(this.elements.pushToTalkBtn, 'touchend', (e) => {
      e.preventDefault();
      this.stopListening();
    });
    
    H.on(this.elements.endSessionBtn, 'click', () => {
      this.endConversation();
    });
    
    // Vocabulary controls
    H.on(this.elements.addWordBtn, 'click', () => {
      window.HablaBotComponents.showAddVocabularyModal();
    });
    
    H.on(this.elements.importVocabBtn, 'click', () => {
      window.HablaBotComponents.showImportVocabularyModal();
    });
    
    H.on(this.elements.exportVocabBtn, 'click', () => {
      this.exportVocabulary();
    });
    
    // Settings
    H.on(this.elements.testApiKeyBtn, 'click', () => {
      this.testApiKey();
    });
    
    H.on(this.elements.speechRate, 'input', (e) => {
      this.elements.speechRateValue.textContent = e.target.value + 'x';
      this.config.set('speechRate', parseFloat(e.target.value));
    });
    
    H.on(this.elements.speechVolume, 'input', (e) => {
      const value = Math.round(e.target.value * 100);
      this.elements.speechVolumeValue.textContent = value + '%';
      this.config.set('speechVolume', parseFloat(e.target.value));
    });
    
    // Modal close
    H.on(this.elements.modalOverlay, 'click', (e) => {
      if (e.target === this.elements.modalOverlay) {
        this.hideModal();
      }
    });
    
    // Global keyboard shortcuts
    H.on(document, 'keydown', (e) => {
      this.handleKeyboardShortcuts(e);
    });
    
    // Window events
    H.on(window, 'beforeunload', () => {
      this.cleanup();
    });

    // User management buttons
    this.elements.switchUserBtn.addEventListener('click', () => {
      this.showUserSelection();
    });

    this.elements.createUserBtn.addEventListener('click', () => {
      this.showUserSelection();
    });

    this.elements.deleteUserBtn.addEventListener('click', () => {
      this.deleteCurrentUser();
    });    
  }

  // Handle navigation between views
  handleNavigation(event) {
    const button = event.currentTarget;
    const targetView = button.dataset.view;
    
    if (targetView && targetView !== this.currentView) {
      this.switchView(targetView);
    }
  }

  // Switch between app views
  switchView(viewName) {
    console.log('Switching to view:', viewName); // ADD THIS LINE
    // Hide current view
    const currentViewElement = H.$(`.view.active`);
    if (currentViewElement) {
      H.removeClass(currentViewElement, 'active');
      H.hide(currentViewElement);
    }
    
    // Show new view
    const newViewElement = H.$(`#${viewName}-view`);
    if (newViewElement) {
      H.show(newViewElement);
      H.addClass(newViewElement, 'active');
    }
    
    // Update navigation
    this.elements.navButtons.forEach(btn => {
      H.removeClass(btn, 'active');
    });
    
    const activeNavBtn = H.$(`#${viewName}-btn`);
    if (activeNavBtn) {
      H.addClass(activeNavBtn, 'active');
    }
    
    this.currentView = viewName;
    
    // Load view-specific data
    this.loadViewData(viewName);
  }

  // Export vocabulary data
  async exportVocabulary() {
    try {
      const vocabularyData = await this.vocabularyManager.getAllVocabulary();
      const csvData = this.vocabularyManager.exportToCSV(vocabularyData);
      
      // Create and trigger download
      const blob = new Blob([csvData], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hablabot-vocabulary-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      H.showToast('Vocabulary exported successfully!', 'success');
    } catch (error) {
      console.error('Failed to export vocabulary:', error);
      H.showToast('Failed to export vocabulary', 'error');
    }
  }

  // Load data for specific view
  async loadViewData(viewName) {
    try {
      switch (viewName) {
        case 'vocabulary':
          await this.loadVocabularyData();
          break;
        case 'progress':
          await this.loadProgressData();
          break;
        case 'settings':
          await this.loadSettingsData();
          break;
      }
    } catch (error) {
      console.error(`Failed to load ${viewName} data:`, error);
      H.showToast(`Failed to load ${viewName} data`, 'error');
    }
  }

  // Start a conversation session
  async startConversation() {
    try {
      // Validate API key
      if (!this.config.hasApiKey()) {
        H.showToast('Please configure your OpenAI API key in Settings', 'warning');
        this.switchView('settings');
        return;
      }
      
      // Get conversation parameters
      const scenario = this.elements.scenarioSelect.value;
      const sessionLength = parseInt(this.elements.sessionLengthSlider.value);
      const difficulty = this.elements.difficultySelect.value;
      
      // Create new session
      this.currentSession = {
        id: this.database.generateId(),
        startTime: new Date(),
        scenario,
        difficulty,
        sessionLength,
        targetWords: [], // Will be populated by vocabulary manager
        conversationHistory: [],
        wordsUsed: {},
        userPerformance: {}
      };
      
      // Hide setup and show active conversation
      H.hide(this.elements.conversationSetup);
      H.show(this.elements.conversationActive);
      
      // Initialize conversation with AI
      // await this.conversationEngine.startSession(this.currentSession);
      
      // Start session timer
      this.startSessionTimer();
      
      H.showToast('Conversation started! Hold the microphone button to speak.', 'success');
      
    } catch (error) {
      console.error('Failed to start conversation:', error);
      H.showToast('Failed to start conversation', 'error');
    }
  }

  // End conversation session
  async endConversation() {
    if (!this.currentSession) return;
    
    try {
      // Stop session timer
      this.stopSessionTimer();
      
      // End session
      this.currentSession.endTime = new Date();
      
      // Save session to database
      await this.database.saveConversationSession(this.currentSession);
      
      // Show setup again
      H.show(this.elements.conversationSetup);
      H.hide(this.elements.conversationActive);
      
      // Clear conversation history display
      this.elements.conversationHistory.innerHTML = '';
      
      // Reset session
      this.currentSession = null;
      
      H.showToast('Conversation ended and saved!', 'success');
      
    } catch (error) {
      console.error('Failed to end conversation:', error);
      H.showToast('Failed to save conversation', 'error');
    }
  }

  // Start listening for speech
  startListening() {
    if (!this.currentSession) return;
    
    try {
      // Check if speech recognition is available
      if (!this.speechRecognition || !this.speechRecognition.isSupported) {
        H.showToast('Speech recognition not available. Please type your response or use a supported browser.', 'warning');
        return;
      }
      
      // Update UI
      H.addClass(this.elements.pushToTalkBtn, 'listening');
      H.show(this.elements.listeningIndicator);
      H.hide(this.elements.processingIndicator);
      this.elements.userSpeechText.textContent = '';
      
      // Start speech recognition
      this.speechRecognition.start();
      
    } catch (error) {
      console.error('Failed to start listening:', error);
      this.stopListening();
    }
  }

  // Stop listening for speech
  stopListening() {
    try {
      // Update UI
      H.removeClass(this.elements.pushToTalkBtn, 'listening');
      H.hide(this.elements.listeningIndicator);
      H.hide(this.elements.processingIndicator);
      
      // Stop speech recognition
      if (this.speechRecognition && this.speechRecognition.isSupported) {
        this.speechRecognition.stop();
      }
      
      // Show text input as fallback if speech recognition failed multiple times
      if (this.speechRecognition && !this.speechRecognition.isSupported) {
        this.showTextInputFallback();
      }
      
    } catch (error) {
      console.error('Failed to stop listening:', error);
    }
  }

  // Show text input fallback when speech recognition is not available
  showTextInputFallback() {
    const fallbackHtml = `
      <div class="text-input-fallback">
        <p>Speech recognition is not available. You can type your response:</p>
        <div class="text-input-container">
          <textarea id="text-input-fallback" placeholder="Type your Spanish response here" rows="3"></textarea>
          <button id="submit-text-btn" class="primary-btn">Send</button>
        </div>
      </div>
    `;
    
    // Show the fallback in place of the push-to-talk button
    const container = this.elements.pushToTalkBtn.parentElement;
    container.innerHTML = fallbackHtml;
    
    // Set up event listener for text submission
    const submitBtn = H.$('#submit-text-btn');
    const textInput = H.$('#text-input-fallback');
    
    H.on(submitBtn, 'click', () => {
      const text = textInput.value.trim();
      if (text) {
        this.handleUserInput(text);
        textInput.value = '';
      }
    });
    
    H.on(textInput, 'keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submitBtn.click();
      }
    });
  }

  // Handle user input (from speech or text)
  async handleUserInput(userText) {
    if (!this.currentSession) return;
    
    try {
      // Show processing indicator
      H.show(this.elements.processingIndicator);
      
      // Add user message to conversation history
      this.addMessageToHistory('user', userText);
      
      // Process with conversation engine
      const response = await this.conversationEngine.processUserInput(userText, this.currentSession);
      
      // Add AI response to conversation history
      this.addMessageToHistory('assistant', response.message);
      
      // Speak the response if synthesis is available
      if (this.speechSynthesis && this.speechSynthesis.isSupported) {
        this.speechSynthesis.speak(response.message);
      }
      
      // Update session data
      if (response.vocabularyUsed) {
        Object.keys(response.vocabularyUsed).forEach(wordId => {
          this.currentSession.wordsUsed[wordId] = (this.currentSession.wordsUsed[wordId] || 0) + 1;
        });
      }
      
      // Hide processing indicator
      H.hide(this.elements.processingIndicator);
      
    } catch (error) {
      console.error('Failed to process user input:', error);
      H.showToast('Failed to process your message. Please try again.', 'error');
      H.hide(this.elements.processingIndicator);
    }
  }

  // Add message to conversation history display
  addMessageToHistory(role, message) {
    if (!this.elements.conversationHistory) return;
    
    const messageElement = H.createElement('div', {
      className: `message ${role}-message`
    });
    
    messageElement.innerHTML = `
      <div class="message-content">
        <div class="message-text">${H.escapeHtml(message)}</div>
        <div class="message-time">${new Date().toLocaleTimeString()}</div>
      </div>
    `;
    
    this.elements.conversationHistory.appendChild(messageElement);
    
    // Scroll to bottom
    this.elements.conversationHistory.scrollTop = this.elements.conversationHistory.scrollHeight;
  }

  // Show user selection interface
  showUserSelection() {
    const userManager = window.HablaBotUserManager;
    const existingUsers = userManager.getAllUsers();
    
    let modalContent = `
    <div class="user-selection-modal">
      <button class="modal-close" onclick="H.hide(window.HablaBotApp.elements.modalOverlay)">&times;</button>
      <h2>👋 Welcome to HablaBot!</h2>
      <p>Choose your profile or create a new one:</p>
  `;

    // Show existing users if any
    if (existingUsers.length > 0) {
      modalContent += `<div class="existing-users"><h3>Select User:</h3><div class="user-cards">`;
      
      existingUsers.forEach(user => {
        modalContent += `
          <div class="user-card" onclick="window.HablaBotApp.selectUser('${user.id}')">
            <div class="user-avatar">${user.avatar}</div>
            <div class="user-name">${H.escapeHtml(user.name)}</div>
            <div class="user-stats">${user.stats.totalWords} words</div>
          </div>
        `;
      });
      modalContent += `</div></div>`;
    }



    
    // Add new user form
    modalContent += `
      <div class="new-user-section">
        <h3>Create New User:</h3>
        <form id="new-user-form" onsubmit="window.HablaBotApp.createNewUser(event)">
          <input type="text" id="new-user-name" placeholder="Enter your name" required>
          <input type="hidden" id="selected-avatar" value="👤">
          <button type="submit" class="primary-btn">Create Profile</button>
        </form>
      </div>
    </div>`;
    
    // Show modal
    this.elements.modalBody.innerHTML = modalContent;
    H.show(this.elements.modalOverlay);
  }

  async selectUser(userId) {
    try {
      const userManager = window.HablaBotUserManager;
      userManager.switchUser(userId);
      H.hide(this.elements.modalOverlay);
      await this.database.init();
      H.showToast(`Welcome back, ${userManager.getCurrentUser().name}! 👋`, 'success');
    } catch (error) {
      console.error('Failed to select user:', error);
      H.showToast('Failed to select user', 'error');
    }
  }

  // Create new user
  async createNewUser(event) {
    event.preventDefault();
    
    try {
      const name = H.$('#new-user-name').value.trim();
      const avatar = H.$('#selected-avatar').value;
      
      if (!name) {
        H.showToast('Please enter your name', 'warning');
        return;
      }
      
      const userManager = window.HablaBotUserManager;
      const newUser = userManager.createUser(name, avatar);
      userManager.switchUser(newUser.id);
      
      H.hide(this.elements.modalOverlay);
      await this.database.init();
      H.showToast(`Welcome to HablaBot, ${name}! 🎉`, 'success');
      
    } catch (error) {
      console.error('Failed to create user:', error);
      H.showToast(error.message || 'Failed to create user', 'error');
    }
  }

  // Test API key
  // Test API key
  async testApiKey() {
    const apiKey = this.elements.openaiApiKey.value.trim();
    
    // Set button state FIRST, before any validation
    this.elements.testApiKeyBtn.textContent = 'Testing...';
    this.elements.testApiKeyBtn.disabled = true;
    
    if (!apiKey) {
      H.showToast('Please enter an API key', 'warning');
      this.elements.testApiKeyBtn.textContent = '❌ Empty API Key';
      setTimeout(() => {
        this.elements.testApiKeyBtn.textContent = 'Test';
        this.elements.testApiKeyBtn.disabled = false;
      }, 3000);
      return;
    }
    
    if (!H.isApiKey(apiKey)) {
      H.showToast('Invalid API key format', 'error');
      this.elements.testApiKeyBtn.textContent = '❌ Invalid API Key Format';
      setTimeout(() => {
        this.elements.testApiKeyBtn.textContent = 'Test';
        this.elements.testApiKeyBtn.disabled = false;
      }, 3000);
      return;
    }
    
    try {
      // Test API key with a simple request
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        await this.config.set('openaiApiKey', apiKey);
        H.showToast('✅ API key is valid and saved!', 'success');
        this.elements.testApiKeyBtn.textContent = '✅ Valid';

        // Reset button after 3 seconds
        setTimeout(() => {
          this.elements.testApiKeyBtn.textContent = 'Test';
          this.elements.testApiKeyBtn.disabled = false;
        }, 3000);
        
      } else {
        H.showToast('❌ Invalid API key', 'error');
        this.elements.testApiKeyBtn.textContent = '❌ Invalid API Key';

        // Reset button after 3 seconds
        setTimeout(() => {
          this.elements.testApiKeyBtn.textContent = 'Test';
          this.elements.testApiKeyBtn.disabled = false;
        }, 3000);
      }

    } catch (error) {
      console.error('API key test failed:', error);
      H.showToast('❌ Failed to test API key', 'error');
      this.elements.testApiKeyBtn.textContent = '❌ Error';

      // Reset button after 3 seconds
      setTimeout(() => {
        this.elements.testApiKeyBtn.textContent = 'Test';
        this.elements.testApiKeyBtn.disabled = false;
      }, 3000);
    }
  }

  // Session timer management
  startSessionTimer() {
    if (this.sessionTimer) {
      clearInterval(this.sessionTimer);
    }
    
    const sessionLength = this.currentSession.sessionLength * 60; // Convert to seconds
    let remainingTime = sessionLength;
    
    this.sessionTimer = setInterval(() => {
      remainingTime--;
      
      // Update display
      const minutes = Math.floor(remainingTime / 60);
      const seconds = remainingTime % 60;
      this.elements.timeRemaining.textContent = 
        `${minutes}:${seconds.toString().padStart(2, '0')}`;
      
      // Update progress bar
      const progress = ((sessionLength - remainingTime) / sessionLength) * 100;
      this.elements.progressFill.style.width = `${progress}%`;
      
      // End session when time runs out
      if (remainingTime <= 0) {
        this.endConversation();
      }
    }, 1000);
  }

  stopSessionTimer() {
    if (this.sessionTimer) {
      clearInterval(this.sessionTimer);
      this.sessionTimer = null;
    }
  }

  // Load vocabulary data
  async loadVocabularyData() {
    // Implementation will be added when vocabulary manager is created
    console.log('Loading vocabulary data...');
  }

  // Load progress data
  async loadProgressData() {
    try {
      const vocabStats = await this.database.getVocabularyStats();
      const sessionStats = await this.database.getSessionStats();
      
      // Update statistics display
      H.$('#total-words-stat').textContent = vocabStats.totalWords;
      H.$('#mastered-words-stat').textContent = vocabStats.masteredWords;
      H.$('#conversation-time-stat').textContent = `${Math.round(sessionStats.totalTimeMinutes / 60)}h`;
      H.$('#streak-stat').textContent = '0'; // Will be calculated later
      
    } catch (error) {
      console.error('Failed to load progress data:', error);
    }
  }

  // Check if this is a first-time user
  async checkFirstTimeUser() {
    const hasApiKey = this.config.hasApiKey();
    const vocabCount = await this.database.count('vocabulary');
    
    this.isFirstTime = !hasApiKey || vocabCount === 0;
    
    if (this.isFirstTime) {
      // Show onboarding flow
      this.showOnboarding();
    }
  }

  // Show onboarding flow
  showOnboarding() {
    // Implementation will be added later
    console.log('Showing onboarding...');
  }

  // Initialize UI
  initializeUI() {
    // Set initial view
    this.switchView('conversation');
    
    // Update session length display
    this.elements.sessionLengthDisplay.textContent = this.elements.sessionLengthSlider.value;

    // Update user display
    this.updateUserDisplay();
  }

  // Handle keyboard shortcuts
  handleKeyboardShortcuts(event) {
    // Space bar for push-to-talk (when in conversation)
    if (event.code === 'Space' && this.currentView === 'conversation' && this.currentSession) {
      event.preventDefault();
      if (event.type === 'keydown') {
        this.startListening();
      } else if (event.type === 'keyup') {
        this.stopListening();
      }
    }
    
    // Escape to close modals
    if (event.code === 'Escape') {
      this.hideModal();
    }
  }

  // Show modal
  showModal(content) {
    this.elements.modalBody.innerHTML = content;
    H.show(this.elements.modalOverlay);
  }

  // Hide modal
  hideModal() {
    H.hide(this.elements.modalOverlay);
  }

  // Show loading screen
  showLoadingScreen() {
    H.show(this.elements.loadingScreen);
    H.hide(this.elements.appContainer);
  }

  // Hide loading screen
  hideLoadingScreen() {
    H.hide(this.elements.loadingScreen);
    H.show(this.elements.appContainer);
  }

  // Show error message
  showError(message) {
    this.elements.loadingScreen.innerHTML = `
      <div class="loading-content">
        <h1>Error</h1>
        <p>${H.escapeHtml(message)}</p>
        <button onclick="location.reload()" class="primary-btn">Reload Page</button>
      </div>
    `;
  }

  // Load vocabulary data for vocabulary view
  async loadVocabularyData() {
    try {
      const vocabularyItems = await this.vocabularyManager.getAllVocabulary();
      window.HablaBotComponents.renderVocabularyList(vocabularyItems);
    } catch (error) {
      console.error('Failed to load vocabulary data:', error);
      H.showToast('Failed to load vocabulary', 'error');
    }
  }

  // Load progress data for progress view
  async loadProgressData() {
    // This would load user progress charts and statistics
    console.log('Loading progress data...');
  }

  // Load settings data for settings view
  async loadSettingsData() {
    console.log('loadSettingsData called'); // ADD THIS LINE
    try {
      // Populate settings form with current values
      if (this.elements.openaiApiKey) {
        this.elements.openaiApiKey.value = this.config.get('openaiApiKey') || '';
      }
      
      if (this.elements.speechRate) {
        const rate = this.config.get('speechRate') || 1.0;
        this.elements.speechRate.value = rate;
        this.elements.speechRateValue.textContent = rate + 'x';
      }
      
      if (this.elements.speechVolume) {
        const volume = this.config.get('speechVolume') || 1.0;
        this.elements.speechVolume.value = volume;
        this.elements.speechVolumeValue.textContent = Math.round(volume * 100) + '%';
      }
      
      // Populate voice selection
      if (this.speechSynthesis && this.elements.voiceSelect) {
        this.speechSynthesis.populateVoiceSelect(this.elements.voiceSelect);
      }
      // Update user display
      this.updateUserDisplay();
    } catch (error) {
      console.error('Failed to load settings data:', error);
    }
  }

  // Update user management display
  updateUserDisplay() {
    console.log('updateUserDisplay called');
    
    const userManager = window.HablaBotUserManager;
    console.log('UserManager:', userManager);
    
    if (!userManager) {
      console.error('HablaBotUserManager not found!');
      return;
    }
    
    const currentUser = userManager.getCurrentUser();
    console.log('Current user:', currentUser);
    
    if (!this.elements.currentUserAvatar || !this.elements.currentUserName) {
      console.error('User display DOM elements not found!');
      return;
    }
    
    if (currentUser) {
      this.elements.currentUserAvatar.textContent = currentUser.avatar;
      this.elements.currentUserName.textContent = currentUser.name;
      console.log('Updated user display with:', currentUser.name);
    } else {
      this.elements.currentUserAvatar.textContent = '👤';
      this.elements.currentUserName.textContent = 'No user selected';
      console.log('Set default user display');
    }
  }
  
  // Delete current user
  async deleteCurrentUser() {
    const userManager = window.HablaBotUserManager;
    const currentUser = userManager.getCurrentUser();
    
    if (!currentUser) {
      H.showToast('No user selected to delete', 'warning');
      return;
    }
    
    if (!confirm(`Are you sure you want to delete user "${currentUser.name}"? This will permanently delete all their data.`)) {
      return;
    }
    
    try {
      userManager.deleteUser(currentUser.id);
      H.showToast(`User "${currentUser.name}" deleted`, 'success');
      
      // Show user selection to pick a new user
      this.showUserSelection();
    } catch (error) {
      console.error('Failed to delete user:', error);
      H.showToast('Failed to delete user', 'error');
    }
  }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  window.HablaBotApp = new HablaBotApp();
  await window.HablaBotApp.init();
});
