// HablaBot AI Conversation Engine
class ConversationEngine {
  constructor() {
    this.config = null;
    this.prompts = null;
    this.currentSession = null;
    this.conversationHistory = [];
    this.targetWords = [];
    this.wordsUsed = {};
    this.apiEndpoint = 'https://api.openai.com/v1/chat/completions';
    this.maxRetries = 3;
    this.retryDelay = 1000;
    
    // Conversation state
    this.isActive = false;
    this.messageCount = 0;
    this.lastResponse = null;
    
    // Event callbacks
    this.onResponse = null;
    this.onError = null;
    this.onWordUsed = null;
    this.onSessionUpdate = null;
  }

  // Initialize the conversation engine
  async init(config, prompts) {
    this.config = config;
    this.prompts = prompts;
    console.log('Conversation engine initialized');
  }

  // Start a new conversation session
  async startSession(sessionConfig) {
    try {
      this.currentSession = {
        id: sessionConfig.id,
        scenario: sessionConfig.scenario,
        difficulty: sessionConfig.difficulty,
        targetWords: sessionConfig.targetWords || [],
        startTime: new Date(),
        messageCount: 0,
        wordsUsed: {},
        userPerformance: {}
      };
      
      this.conversationHistory = [];
      this.targetWords = this.currentSession.targetWords;
      this.wordsUsed = {};
      this.messageCount = 0;
      this.isActive = true;
      
      // Generate system prompt
      const systemPrompt = this.prompts.generateSystemPrompt(
        this.currentSession.scenario,
        this.currentSession.difficulty,
        this.targetWords
      );
      
      // Add system message to history
      this.conversationHistory.push({
        role: 'system',
        content: systemPrompt
      });
      
      // Generate opening message
      const openingMessage = this.prompts.getConversationStarters(
        this.currentSession.scenario,
        this.currentSession.difficulty
      );
      
      // Add AI opening message
      this.conversationHistory.push({
        role: 'assistant',
        content: openingMessage
      });
      
      console.log('Conversation session started:', this.currentSession.id);
      
      return {
        success: true,
        message: openingMessage,
        sessionId: this.currentSession.id
      };
      
    } catch (error) {
      console.error('Failed to start conversation session:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Process user input and generate AI response
  async processUserInput(userText, confidence = 1.0) {
    if (!this.isActive || !this.currentSession) {
      throw new Error('No active conversation session');
    }
    
    if (!userText || userText.trim() === '') {
      throw new Error('No user input provided');
    }
    
    try {
      // Clean and prepare user input
      const cleanedInput = this.cleanUserInput(userText);
      
      // Add user message to history
      this.conversationHistory.push({
        role: 'user',
        content: cleanedInput
      });
      
      // Analyze user input for vocabulary usage
      this.analyzeVocabularyUsage(cleanedInput);
      
      // Generate AI response
      const aiResponse = await this.generateAIResponse();
      
      // Add AI response to history
      this.conversationHistory.push({
        role: 'assistant',
        content: aiResponse
      });
      
      // Update session statistics
      this.updateSessionStats(cleanedInput, aiResponse, confidence);
      
      // Trigger callbacks
      if (this.onResponse) {
        this.onResponse({
          userInput: cleanedInput,
          aiResponse: aiResponse,
          confidence: confidence,
          sessionStats: this.getSessionStats()
        });
      }
      
      this.lastResponse = aiResponse;
      return {
        success: true,
        response: aiResponse,
        confidence: confidence,
        wordsUsed: this.getWordsUsedInText(cleanedInput),
        sessionStats: this.getSessionStats()
      };
      
    } catch (error) {
      console.error('Failed to process user input:', error);
      
      if (this.onError) {
        this.onError(error);
      }
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Generate AI response using OpenAI API
  async generateAIResponse() {
    const apiKey = this.config.get('openaiApiKey');
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }
    
    // Prepare messages for API call
    const messages = this.prepareMessagesForAPI();
    
    const requestBody = {
      model: 'gpt-4',
      messages: messages,
      max_tokens: 150,
      temperature: 0.7,
      presence_penalty: 0.1,
      frequency_penalty: 0.1
    };
    
    let lastError;
    
    // Retry logic
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await fetch(this.apiEndpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(`API request failed: ${response.status} - ${errorData.error?.message || response.statusText}`);
        }
        
        const data = await response.json();
        
        if (!data.choices || data.choices.length === 0) {
          throw new Error('No response generated by AI');
        }
        
        const aiResponse = data.choices[0].message.content.trim();
        
        if (!aiResponse) {
          throw new Error('Empty response from AI');
        }
        
        return aiResponse;
        
      } catch (error) {
        lastError = error;
        console.error(`API attempt ${attempt} failed:`, error);
        
        if (attempt < this.maxRetries) {
          await this.sleep(this.retryDelay * attempt);
        }
      }
    }
    
    throw lastError;
  }

  // Prepare conversation history for API call
  prepareMessagesForAPI() {
    // Limit conversation history to prevent token overflow
    const maxMessages = 20;
    let messages = [...this.conversationHistory];
    
    // Always keep the system message
    const systemMessage = messages.find(msg => msg.role === 'system');
    const otherMessages = messages.filter(msg => msg.role !== 'system');
    
    // Keep only recent messages if too many
    if (otherMessages.length > maxMessages) {
      const recentMessages = otherMessages.slice(-maxMessages);
      messages = [systemMessage, ...recentMessages];
    }
    
    return messages;
  }

  // Clean user input
  cleanUserInput(text) {
    return text
      .trim()
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[^\w\s\u00C0-\u017F¿¡.,!?]/g, ''); // Keep Spanish characters and basic punctuation
  }

  // Analyze vocabulary usage in user input
  analyzeVocabularyUsage(userText) {
    const lowerText = userText.toLowerCase();
    
    this.targetWords.forEach(word => {
      const spanishWord = word.spanish.toLowerCase();
      
      // Check if word is used (simple word matching)
      if (lowerText.includes(spanishWord)) {
        this.wordsUsed[word.id] = (this.wordsUsed[word.id] || 0) + 1;
        
        if (this.onWordUsed) {
          this.onWordUsed({
            word: word,
            usage: this.wordsUsed[word.id],
            context: userText
          });
        }
      }
    });
  }

  // Get words used in specific text
  getWordsUsedInText(text) {
    const lowerText = text.toLowerCase();
    const wordsFound = [];
    
    this.targetWords.forEach(word => {
      if (lowerText.includes(word.spanish.toLowerCase())) {
        wordsFound.push(word);
      }
    });
    
    return wordsFound;
  }

  // Update session statistics
  updateSessionStats(userInput, aiResponse, confidence) {
    this.messageCount++;
    this.currentSession.messageCount = this.messageCount;
    
    // Update word usage statistics
    this.currentSession.wordsUsed = { ...this.wordsUsed };
    
    // Track user performance based on confidence and vocabulary usage
    const wordsInInput = this.getWordsUsedInText(userInput);
    wordsInInput.forEach(word => {
      if (!this.currentSession.userPerformance[word.id]) {
        this.currentSession.userPerformance[word.id] = {
          attempts: 0,
          successfulUses: 0,
          averageConfidence: 0
        };
      }
      
      const performance = this.currentSession.userPerformance[word.id];
      performance.attempts++;
      
      if (confidence >= 0.7) {
        performance.successfulUses++;
      }
      
      performance.averageConfidence = 
        (performance.averageConfidence * (performance.attempts - 1) + confidence) / performance.attempts;
    });
    
    if (this.onSessionUpdate) {
      this.onSessionUpdate(this.getSessionStats());
    }
  }

  // Get current session statistics
  getSessionStats() {
    if (!this.currentSession) return null;
    
    const totalTargetWords = this.targetWords.length;
    const wordsUsed = Object.keys(this.wordsUsed).length;
    const wordsUsedPercentage = totalTargetWords > 0 ? (wordsUsed / totalTargetWords) * 100 : 0;
    
    return {
      sessionId: this.currentSession.id,
      messageCount: this.messageCount,
      totalTargetWords: totalTargetWords,
      wordsUsed: wordsUsed,
      wordsUsedPercentage: Math.round(wordsUsedPercentage),
      wordsUsageDetails: this.wordsUsed,
      userPerformance: this.currentSession.userPerformance,
      duration: Date.now() - this.currentSession.startTime.getTime()
    };
  }

  // End current conversation session
  endSession() {
    if (!this.currentSession) return null;
    
    const sessionData = {
      ...this.currentSession,
      endTime: new Date(),
      conversationHistory: this.conversationHistory.filter(msg => msg.role !== 'system'),
      finalStats: this.getSessionStats()
    };
    
    this.isActive = false;
    this.currentSession = null;
    this.conversationHistory = [];
    this.targetWords = [];
    this.wordsUsed = {};
    this.messageCount = 0;
    
    console.log('Conversation session ended');
    return sessionData;
  }

  // Pause conversation
  pauseSession() {
    this.isActive = false;
  }

  // Resume conversation
  resumeSession() {
    if (this.currentSession) {
      this.isActive = true;
    }
  }

  // Get conversation history for display
  getConversationHistory() {
    return this.conversationHistory
      .filter(msg => msg.role !== 'system')
      .map(msg => ({
        speaker: msg.role === 'user' ? 'user' : 'ai',
        text: msg.content,
        timestamp: new Date()
      }));
  }

  // Generate vocabulary-focused prompt
  generateVocabularyPrompt(unusedWords) {
    if (unusedWords.length === 0) return null;
    
    const word = unusedWords[Math.floor(Math.random() * unusedWords.length)];
    
    const prompts = [
      `Por cierto, ¿conoce la palabra "${word.spanish}"? Significa ${word.english}.`,
      `Hablando de ${word.spanish}... ¿${word.spanish} es importante para usted?`,
      `¿Ha usado alguna vez la palabra "${word.spanish}"? Es muy útil.`
    ];
    
    return prompts[Math.floor(Math.random() * prompts.length)];
  }

  // Get unused target words
  getUnusedTargetWords() {
    return this.targetWords.filter(word => !this.wordsUsed[word.id]);
  }

  // Evaluate user response quality
  evaluateResponseQuality(userInput, confidence) {
    let quality = 0;
    
    // Base quality on confidence
    quality += confidence * 3;
    
    // Bonus for using target vocabulary
    const wordsUsed = this.getWordsUsedInText(userInput);
    quality += wordsUsed.length * 0.5;
    
    // Bonus for response length (indicates engagement)
    const wordCount = userInput.split(' ').length;
    if (wordCount >= 3) quality += 0.5;
    if (wordCount >= 6) quality += 0.5;
    
    // Cap at 5 (SM-2 scale)
    return Math.min(5, Math.max(0, Math.round(quality)));
  }

  // Generate correction feedback
  generateCorrectionFeedback(userInput, corrections) {
    if (!corrections || corrections.length === 0) return null;
    
    // This would be enhanced with actual grammar checking
    return `Muy bien. Una pequeña corrección: en lugar de "${userInput}", sería mejor decir "...". ¡Pero se entiende perfectamente!`;
  }

  // Check if session should continue
  shouldContinueSession() {
    if (!this.currentSession) return false;
    
    const stats = this.getSessionStats();
    const duration = stats.duration / (1000 * 60); // minutes
    const targetDuration = 15; // default session length
    
    // Continue if under time limit and user is engaged
    return duration < targetDuration && stats.messageCount > 0;
  }

  // Utility function for delays
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Get current session status
  getStatus() {
    return {
      isActive: this.isActive,
      hasSession: !!this.currentSession,
      sessionId: this.currentSession?.id || null,
      messageCount: this.messageCount,
      targetWordsCount: this.targetWords.length,
      wordsUsedCount: Object.keys(this.wordsUsed).length
    };
  }

  // Clean up resources
  destroy() {
    this.endSession();
    this.config = null;
    this.prompts = null;
    this.onResponse = null;
    this.onError = null;
    this.onWordUsed = null;
    this.onSessionUpdate = null;
  }
}

// Create global instance
window.HablaBotConversation = new ConversationEngine();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ConversationEngine;
}
