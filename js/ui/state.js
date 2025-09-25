// HablaBot UI State Management
class UIStateManager {
  constructor() {
    this.state = {
      // App state
      currentView: 'conversation',
      isLoading: false,
      isInitialized: false,
      
      // Conversation state
      conversationActive: false,
      isListening: false,
      isProcessing: false,
      aiSpeaking: false,
      sessionPaused: false,
      
      // Session data
      currentSession: null,
      sessionProgress: {
        wordsUsed: 0,
        totalWords: 0,
        timeRemaining: 0,
        progressPercentage: 0
      },
      
      // Vocabulary state
      vocabularyLoaded: false,
      vocabularyCount: 0,
      filteredVocabularyCount: 0,
      
      // Settings state
      apiKeyConfigured: false,
      voicesLoaded: false,
      
      // Modal and overlay state
      modalOpen: false,
      setupOverlayOpen: false,
      
      // Error state
      lastError: null,
      errorVisible: false
    };
    
    // State change listeners
    this.listeners = new Map();
    
    // UI element references
    this.elements = {};
  }

  // Initialize state manager
  init(elements) {
    this.elements = elements || {};
    
    // Only update UI if we have elements
    if (Object.keys(this.elements).length > 0) {
      this.updateUI();
    }
    
    console.log('UI State Manager initialized');
  }

  // Get current state
  getState() {
    return { ...this.state };
  }

  // Set state and trigger UI updates
  setState(updates) {
    const oldState = { ...this.state };
    this.state = { ...this.state, ...updates };
    
    // Trigger listeners
    this.notifyListeners('stateChange', {
      oldState,
      newState: this.state,
      changes: updates
    });
    
    // Update UI
    this.updateUI();
  }

  // Update specific state property
  updateState(key, value) {
    this.setState({ [key]: value });
  }

  // Add state change listener
  addListener(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
  }

  // Remove state change listener
  removeListener(event, callback) {
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
          console.error('Error in state listener:', error);
        }
      });
    }
  }

  // Update UI based on current state
  updateUI() {
    this.updateViewVisibility();
    this.updateNavigationState();
    this.updateConversationState();
    this.updateSessionProgressUI();
    this.updateLoadingStates();
    this.updateErrorStates();
    this.updateModalStates();
  }

  // Update view visibility
  updateViewVisibility() {
    const views = ['conversation', 'vocabulary', 'progress', 'settings'];
    
    views.forEach(view => {
      const element = this.elements[`${view}View`];
      if (element) {
        if (view === this.state.currentView) {
          H.show(element);
          H.addClass(element, 'active');
        } else {
          H.hide(element);
          H.removeClass(element, 'active');
        }
      }
    });
  }

  // Update navigation state
  updateNavigationState() {
    const navButtons = this.elements.navButtons;
    if (navButtons && navButtons.length) {
      navButtons.forEach(btn => {
        if (btn && btn.dataset) {
          const view = btn.dataset.view;
          if (view === this.state.currentView) {
            H.addClass(btn, 'active');
          } else {
            H.removeClass(btn, 'active');
          }
        }
      });
    }
  }

  // Update conversation state
  updateConversationState() {
    // Show/hide conversation setup vs active conversation
    if (this.state.conversationActive) {
      H.hide(this.elements.conversationSetup);
      H.show(this.elements.conversationActive);
    } else {
      H.show(this.elements.conversationSetup);
      H.hide(this.elements.conversationActive);
    }
    
    // Update talk button state
    if (this.elements.pushToTalkBtn) {
      if (this.state.isListening) {
        H.addClass(this.elements.pushToTalkBtn, 'listening');
      } else {
        H.removeClass(this.elements.pushToTalkBtn, 'listening');
      }
      
      // Update button text
      const talkText = this.elements.pushToTalkBtn.querySelector('.talk-text');
      if (talkText) {
        if (this.state.isListening) {
          talkText.textContent = 'Listening...';
        } else if (this.state.isProcessing) {
          talkText.textContent = 'Processing...';
        } else {
          talkText.textContent = 'Hold to Speak';
        }
      }
    }
    
    // Update listening indicator
    if (this.state.isListening) {
      H.show(this.elements.listeningIndicator);
    } else {
      H.hide(this.elements.listeningIndicator);
    }
    
    // Update processing indicator
    if (this.state.isProcessing) {
      H.show(this.elements.processingIndicator);
    } else {
      H.hide(this.elements.processingIndicator);
    }
    
    // Update AI speaking state
    if (this.state.aiSpeaking) {
      H.show(this.elements.aiSpeaking);
    } else {
      H.hide(this.elements.aiSpeaking);
    }
    
    // Update session controls
    if (this.elements.pauseSessionBtn) {
      if (this.state.sessionPaused) {
        this.elements.pauseSessionBtn.textContent = '▶️ Resume';
      } else {
        this.elements.pauseSessionBtn.textContent = '⏸️ Pause';
      }
    }
  }

  // Update session progress UI elements
  updateSessionProgressUI() {
    const progress = this.state.sessionProgress;
    
    // Update words practiced
    if (this.elements.wordsPracticed) {
      this.elements.wordsPracticed.textContent = `${progress.wordsUsed}/${progress.totalWords} words`;
    }
    
    // Update time remaining
    if (this.elements.timeRemaining) {
      const minutes = Math.floor(progress.timeRemaining / 60);
      const seconds = progress.timeRemaining % 60;
      this.elements.timeRemaining.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
    
    // Update progress bar
    if (this.elements.progressFill) {
      this.elements.progressFill.style.width = `${progress.progressPercentage}%`;
    }
  }

  // Update loading states
  updateLoadingStates() {
    // App loading
    if (this.state.isLoading) {
      H.show(this.elements.loadingScreen);
      H.hide(this.elements.appContainer);
    } else {
      H.hide(this.elements.loadingScreen);
      if (this.state.isInitialized) {
        H.show(this.elements.appContainer);
      }
    }
  }

  // Update error states
  updateErrorStates() {
    if (this.state.lastError && this.state.errorVisible) {
      H.showToast(this.state.lastError, 'error');
      this.setState({ errorVisible: false });
    }
  }

  // Update modal states
  updateModalStates() {
    if (this.state.modalOpen) {
      H.show(this.elements.modalOverlay);
    } else {
      H.hide(this.elements.modalOverlay);
    }
    
    if (this.state.setupOverlayOpen) {
      H.show(this.elements.setupOverlay);
    } else {
      H.hide(this.elements.setupOverlay);
    }
  }

  // Conversation state methods
  startConversation(sessionData) {
    this.setState({
      conversationActive: true,
      currentSession: sessionData,
      sessionProgress: {
        wordsUsed: 0,
        totalWords: sessionData.targetWords?.length || 0,
        timeRemaining: sessionData.sessionLength * 60,
        progressPercentage: 0
      }
    });
  }

  endConversation() {
    this.setState({
      conversationActive: false,
      currentSession: null,
      isListening: false,
      isProcessing: false,
      aiSpeaking: false,
      sessionPaused: false,
      sessionProgress: {
        wordsUsed: 0,
        totalWords: 0,
        timeRemaining: 0,
        progressPercentage: 0
      }
    });
  }

  pauseConversation() {
    this.setState({
      sessionPaused: true,
      isListening: false,
      isProcessing: false
    });
  }

  resumeConversation() {
    this.setState({
      sessionPaused: false
    });
  }

  startListening() {
    this.setState({
      isListening: true,
      isProcessing: false
    });
  }

  stopListening() {
    this.setState({
      isListening: false,
      isProcessing: true
    });
  }

  startProcessing() {
    this.setState({
      isListening: false,
      isProcessing: true
    });
  }

  stopProcessing() {
    this.setState({
      isProcessing: false
    });
  }

  startAISpeaking(text) {
    this.setState({
      aiSpeaking: true,
      isProcessing: false
    });
    
    if (this.elements.aiText) {
      this.elements.aiText.textContent = text;
    }
  }

  stopAISpeaking() {
    this.setState({
      aiSpeaking: false
    });
  }

  updateSessionProgress(progress) {
    // Update state directly without triggering setState to avoid recursion
    this.state.sessionProgress = {
      ...this.state.sessionProgress,
      ...progress
    };
    
    // Update only the session progress UI elements
    this.updateSessionProgressUI();
  }

  // View navigation methods
  switchToView(viewName) {
    this.setState({ currentView: viewName });
  }

  // Modal methods
  showModal(content) {
    if (this.elements.modalBody) {
      this.elements.modalBody.innerHTML = content;
    }
    this.setState({ modalOpen: true });
  }

  hideModal() {
    this.setState({ modalOpen: false });
  }

  showSetupOverlay() {
    this.setState({ setupOverlayOpen: true });
  }

  hideSetupOverlay() {
    this.setState({ setupOverlayOpen: false });
  }

  // Error handling methods
  showError(error) {
    this.setState({
      lastError: error,
      errorVisible: true
    });
  }

  clearError() {
    this.setState({
      lastError: null,
      errorVisible: false
    });
  }

  // Loading methods
  setLoading(loading) {
    this.setState({ isLoading: loading });
  }

  setInitialized(initialized) {
    this.setState({ isInitialized: initialized });
  }

  // Configuration methods
  setApiKeyConfigured(configured) {
    this.setState({ apiKeyConfigured: configured });
  }

  setVoicesLoaded(loaded) {
    this.setState({ voicesLoaded: loaded });
  }

  // Vocabulary methods
  setVocabularyLoaded(loaded, count = 0) {
    this.setState({
      vocabularyLoaded: loaded,
      vocabularyCount: count
    });
  }

  updateVocabularyCount(total, filtered) {
    this.setState({
      vocabularyCount: total,
      filteredVocabularyCount: filtered
    });
  }

  // Add conversation message to UI
  addConversationMessage(speaker, text, timestamp = new Date()) {
    if (!this.elements.conversationHistory) return;
    
    const messageElement = H.createElement('div', {
      className: `message ${speaker} animate-fade-in`
    }, [
      H.createElement('div', {
        className: 'message-content',
        textContent: text
      })
    ]);
    
    this.elements.conversationHistory.appendChild(messageElement);
    
    // Scroll to bottom
    this.elements.conversationHistory.scrollTop = this.elements.conversationHistory.scrollHeight;
  }

  // Clear conversation history
  clearConversationHistory() {
    if (this.elements.conversationHistory) {
      this.elements.conversationHistory.innerHTML = '';
    }
  }

  // Update user speech text
  updateUserSpeechText(text) {
    if (this.elements.userSpeechText) {
      this.elements.userSpeechText.textContent = text;
    }
  }

  // Show success message
  showSuccess(message) {
    H.showToast(message, 'success');
  }

  // Show warning message
  showWarning(message) {
    H.showToast(message, 'warning');
  }

  // Show info message
  showInfo(message) {
    H.showToast(message, 'info');
  }

  // Get conversation state
  getConversationState() {
    return {
      active: this.state.conversationActive,
      listening: this.state.isListening,
      processing: this.state.isProcessing,
      aiSpeaking: this.state.aiSpeaking,
      paused: this.state.sessionPaused,
      session: this.state.currentSession,
      progress: this.state.sessionProgress
    };
  }

  // Get UI state summary
  getStateSummary() {
    return {
      view: this.state.currentView,
      conversationActive: this.state.conversationActive,
      isLoading: this.state.isLoading,
      isInitialized: this.state.isInitialized,
      apiKeyConfigured: this.state.apiKeyConfigured,
      vocabularyLoaded: this.state.vocabularyLoaded,
      vocabularyCount: this.state.vocabularyCount,
      hasError: !!this.state.lastError
    };
  }

  // Reset state to initial values
  reset() {
    this.state = {
      currentView: 'conversation',
      isLoading: false,
      isInitialized: false,
      conversationActive: false,
      isListening: false,
      isProcessing: false,
      aiSpeaking: false,
      sessionPaused: false,
      currentSession: null,
      sessionProgress: {
        wordsUsed: 0,
        totalWords: 0,
        timeRemaining: 0,
        progressPercentage: 0
      },
      vocabularyLoaded: false,
      vocabularyCount: 0,
      filteredVocabularyCount: 0,
      apiKeyConfigured: false,
      voicesLoaded: false,
      modalOpen: false,
      setupOverlayOpen: false,
      lastError: null,
      errorVisible: false
    };
    
    this.updateUI();
  }

  // Clean up resources
  destroy() {
    this.listeners.clear();
    this.elements = {};
    this.reset();
  }
}

// Create global instance
window.HablaBotUIState = new UIStateManager();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UIStateManager;
}
