// HablaBot Database Management (IndexedDB)
class HablaBotDatabase {
  constructor() {
    this.dbName = 'HablaBotDB';
    this.version = 1;
    this.db = null;
    
    this.stores = {
      vocabulary: {
        keyPath: 'id',
        indexes: [
          { name: 'category', keyPath: 'category', unique: false },
          { name: 'difficulty', keyPath: 'difficulty', unique: false },
          { name: 'nextReviewDate', keyPath: 'nextReviewDate', unique: false },
          { name: 'masteryLevel', keyPath: 'masteryLevel', unique: false },
          { name: 'createdDate', keyPath: 'createdDate', unique: false }
        ]
      },
      sessions: {
        keyPath: 'id',
        indexes: [
          { name: 'startTime', keyPath: 'startTime', unique: false },
          { name: 'scenario', keyPath: 'scenario', unique: false },
          { name: 'endTime', keyPath: 'endTime', unique: false }
        ]
      },
      userSettings: {
        keyPath: 'key'
      },
      conversationHistory: {
        keyPath: 'id',
        indexes: [
          { name: 'sessionId', keyPath: 'sessionId', unique: false },
          { name: 'timestamp', keyPath: 'timestamp', unique: false }
        ]
      }
    };
  }

  // Initialize database
// Initialize database with optional custom name
async init(customDbName = null) {
  try {
    // Use custom database name if provided (for user-specific databases)
    if (customDbName) {
      this.dbName = customDbName;
    } else if (window.HablaBotUserManager && window.HablaBotUserManager.hasCurrentUser()) {
      // Use current user's database name
      this.dbName = window.HablaBotUserManager.getCurrentUserDbName();
    }

    console.log('Initializing database:', this.dbName);
    
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      
      request.onerror = () => {
        console.error('Database failed to open:', request.error);
        reject(request.error);
      };
      
      request.onsuccess = () => {
        this.db = request.result;
        console.log('Database opened successfully');
        resolve(this.db);
      };
      
      request.onupgradeneeded = (event) => {
        this.db = event.target.result;
        console.log('Database upgrade needed, creating stores...');
        this.createStores();
      };
    });
    
  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  }
}

  // Create object stores and indexes
  createStores() {
    for (const [storeName, config] of Object.entries(this.stores)) {
      if (!this.db.objectStoreNames.contains(storeName)) {
        const store = this.db.createObjectStore(storeName, { keyPath: config.keyPath });
        
        // Create indexes if defined
        if (config.indexes) {
          config.indexes.forEach(index => {
            store.createIndex(index.name, index.keyPath, { unique: index.unique });
          });
        }
        
        console.log(`Created store: ${storeName}`);
      }
    }
  }

  // Generic method to add data
  async add(storeName, data) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.add(data);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Generic method to get data by key
  async get(storeName, key) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Generic method to update data
  async put(storeName, data) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(data);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Generic method to delete data
  async delete(storeName, key) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Get all records from a store
  async getAll(storeName) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Query by index
  async getByIndex(storeName, indexName, value) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const index = store.index(indexName);
      const request = index.getAll(value);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Count records in a store
  async count(storeName) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.count();
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Clear all data from a store
  async clear(storeName) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // VOCABULARY METHODS

  // Add vocabulary item
  async addVocabularyItem(item) {
    const vocabularyItem = {
      id: this.generateId(),
      spanish: item.spanish,
      english: item.english,
      phonetic: item.phonetic || '',
      difficulty: item.difficulty || 1,
      category: item.category || 'general',
      examples: item.examples || [],
      masteryLevel: 0,
      lastReviewed: null,
      nextReviewDate: new Date(),
      timesCorrect: 0,
      timesIncorrect: 0,
      createdDate: new Date(),
      tags: item.tags || []
    };
    
    return await this.add('vocabulary', vocabularyItem);
  }

  // Get vocabulary for review
  async getVocabularyForReview(limit = 10) {
    const now = new Date();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['vocabulary'], 'readonly');
      const store = transaction.objectStore(storeName);
      const index = store.index('nextReviewDate');
      const request = index.openCursor(IDBKeyRange.upperBound(now));
      
      const results = [];
      
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor && results.length < limit) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  // Update word performance
  async updateWordPerformance(wordId, performance) {
    const word = await this.get('vocabulary', wordId);
    if (!word) throw new Error('Word not found');
    
    word.lastReviewed = new Date();
    if (performance.correct) {
      word.timesCorrect++;
    } else {
      word.timesIncorrect++;
    }
    
    // Update mastery level and next review date based on spaced repetition
    // This will be handled by the spaced repetition module
    
    return await this.put('vocabulary', word);
  }

  // Search vocabulary
  async searchVocabulary(query, filters = {}) {
    const allWords = await this.getAll('vocabulary');
    
    return allWords.filter(word => {
      // Text search
      if (query) {
        const searchText = query.toLowerCase();
        const matchesText = 
          word.spanish.toLowerCase().includes(searchText) ||
          word.english.toLowerCase().includes(searchText) ||
          word.tags.some(tag => tag.toLowerCase().includes(searchText));
        
        if (!matchesText) return false;
      }
      
      // Category filter
      if (filters.category && word.category !== filters.category) {
        return false;
      }
      
      // Difficulty filter
      if (filters.difficulty && word.difficulty !== filters.difficulty) {
        return false;
      }
      
      // Mastery level filter
      if (filters.masteryLevel !== undefined && word.masteryLevel !== filters.masteryLevel) {
        return false;
      }
      
      return true;
    });
  }

  // SESSION METHODS

  // Save conversation session
  async saveConversationSession(session) {
    const sessionData = {
      id: session.id || this.generateId(),
      startTime: session.startTime,
      endTime: session.endTime,
      targetWords: session.targetWords || [],
      scenario: session.scenario,
      difficulty: session.difficulty,
      conversationHistory: session.conversationHistory || [],
      wordsUsed: session.wordsUsed || {},
      userPerformance: session.userPerformance || {},
      sessionRating: session.sessionRating || null
    };
    
    return await this.put('sessions', sessionData);
  }

  // Get recent sessions
  async getRecentSessions(limit = 10) {
    const allSessions = await this.getAll('sessions');
    return allSessions
      .sort((a, b) => new Date(b.startTime) - new Date(a.startTime))
      .slice(0, limit);
  }

  // Get sessions by date range
  async getSessionsByDateRange(startDate, endDate) {
    const allSessions = await this.getAll('sessions');
    return allSessions.filter(session => {
      const sessionDate = new Date(session.startTime);
      return sessionDate >= startDate && sessionDate <= endDate;
    });
  }

  // STATISTICS METHODS

  // Get vocabulary statistics
  async getVocabularyStats() {
    const allWords = await this.getAll('vocabulary');
    
    const stats = {
      totalWords: allWords.length,
      masteredWords: allWords.filter(w => w.masteryLevel >= 5).length,
      reviewingWords: allWords.filter(w => w.masteryLevel > 0 && w.masteryLevel < 5).length,
      newWords: allWords.filter(w => w.masteryLevel === 0).length,
      categories: {},
      difficulties: {}
    };
    
    // Count by category and difficulty
    allWords.forEach(word => {
      stats.categories[word.category] = (stats.categories[word.category] || 0) + 1;
      stats.difficulties[word.difficulty] = (stats.difficulties[word.difficulty] || 0) + 1;
    });
    
    return stats;
  }

  // Get session statistics
  async getSessionStats() {
    const allSessions = await this.getAll('sessions');
    
    const totalTime = allSessions.reduce((sum, session) => {
      if (session.endTime && session.startTime) {
        return sum + (new Date(session.endTime) - new Date(session.startTime));
      }
      return sum;
    }, 0);
    
    return {
      totalSessions: allSessions.length,
      totalTimeMinutes: Math.round(totalTime / (1000 * 60)),
      averageRating: allSessions
        .filter(s => s.sessionRating)
        .reduce((sum, s, _, arr) => sum + s.sessionRating / arr.length, 0)
    };
  }

  // UTILITY METHODS

  // Generate unique ID
  generateId() {
    return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  // Export all data
  async exportAllData() {
    const data = {};
    
    for (const storeName of Object.keys(this.stores)) {
      data[storeName] = await this.getAll(storeName);
    }
    
    return {
      ...data,
      exportDate: new Date().toISOString(),
      version: this.version
    };
  }

  // Import data
  async importData(data) {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid import data');
    }
    
    for (const [storeName, records] of Object.entries(data)) {
      if (this.stores[storeName] && Array.isArray(records)) {
        // Clear existing data
        await this.clear(storeName);
        
        // Import new data
        for (const record of records) {
          await this.add(storeName, record);
        }
      }
    }
  }

  // Close database connection
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

// Create global database instance
window.HablaBotDB = new HablaBotDatabase();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = HablaBotDatabase;
}
