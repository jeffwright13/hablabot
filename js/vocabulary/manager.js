// HablaBot Vocabulary Manager
class VocabularyManager {
  constructor() {
    this.database = null;
    this.vocabularyList = [];
    this.filteredList = [];
    this.currentFilters = {
      search: '',
      category: '',
      difficulty: ''
    };
    
    // Event callbacks
    this.onVocabularyUpdate = null;
    this.onImportComplete = null;
    this.onExportComplete = null;
    
    // Default categories
    this.categories = [
      'general', 'food', 'travel', 'family', 'work', 
      'health', 'shopping', 'emergency', 'education', 'entertainment'
    ];
  }

  // Initialize vocabulary manager
  async init(database) {
    this.database = database;

    // Load vocabulary from database
    await this.loadVocabulary();
    
    console.log('Vocabulary manager initialized');
  }

  // Load all vocabulary from database
  async loadVocabulary() {
    try {
      this.vocabularyList = await this.database.getAll('vocabulary');
      this.filteredList = [...this.vocabularyList];
      
      if (this.onVocabularyUpdate) {
        this.onVocabularyUpdate(this.filteredList);
      }
      
      console.log(`Loaded ${this.vocabularyList.length} vocabulary items`);
    } catch (error) {
      console.error('Failed to load vocabulary:', error);
      throw error;
    }
  }

  // Add new vocabulary item
  async addVocabularyItem(itemData) {
    try {
      // Validate required fields
      if (!itemData.spanish || !itemData.english) {
        throw new Error('Spanish and English translations are required');
      }
      
      // Check for duplicates
      const existing = this.vocabularyList.find(item => 
        item.spanish.toLowerCase() === itemData.spanish.toLowerCase()
      );
      
      if (existing) {
        throw new Error('This Spanish word already exists in your vocabulary');
      }
      
      // Create vocabulary item
      const vocabularyItem = {
        spanish: itemData.spanish.trim(),
        english: itemData.english.trim(),
        phonetic: itemData.phonetic?.trim() || '',
        difficulty: parseInt(itemData.difficulty) || 1,
        category: itemData.category || 'general',
        examples: itemData.examples || [],
        tags: itemData.tags || []
      };
      
      // Add to database
      const id = await this.database.addVocabularyItem(vocabularyItem);
      
      // Add to local list
      const newItem = { ...vocabularyItem, id };
      this.vocabularyList.push(newItem);
      
      // Update filtered list
      this.applyFilters();
      
      if (this.onVocabularyUpdate) {
        this.onVocabularyUpdate(this.filteredList);
      }
      
      console.log('Added vocabulary item:', newItem.spanish);
      return newItem;
      
    } catch (error) {
      console.error('Failed to add vocabulary item:', error);
      throw error;
    }
  }

  // Update existing vocabulary item
  async updateVocabularyItem(id, updates) {
    try {
      const existingItem = this.vocabularyList.find(item => item.id === id);
      if (!existingItem) {
        throw new Error('Vocabulary item not found');
      }
      
      // Merge updates
      const updatedItem = {
        ...existingItem,
        ...updates,
        id: id // Ensure ID doesn't change
      };
      
      // Update in database
      await this.database.put('vocabulary', updatedItem);
      
      // Update in local list
      const index = this.vocabularyList.findIndex(item => item.id === id);
      this.vocabularyList[index] = updatedItem;
      
      // Update filtered list
      this.applyFilters();
      
      if (this.onVocabularyUpdate) {
        this.onVocabularyUpdate(this.filteredList);
      }
      
      console.log('Updated vocabulary item:', updatedItem.spanish);
      return updatedItem;
      
    } catch (error) {
      console.error('Failed to update vocabulary item:', error);
      throw error;
    }
  }

  // Delete vocabulary item
  async deleteVocabularyItem(id) {
    try {
      // Remove from database
      await this.database.delete('vocabulary', id);
      
      // Remove from local list
      this.vocabularyList = this.vocabularyList.filter(item => item.id !== id);
      
      // Update filtered list
      this.applyFilters();
      
      if (this.onVocabularyUpdate) {
        this.onVocabularyUpdate(this.filteredList);
      }
      
      console.log('Deleted vocabulary item:', id);
      
    } catch (error) {
      console.error('Failed to delete vocabulary item:', error);
      throw error;
    }
  }

  // Get vocabulary item by ID
  getVocabularyItem(id) {
    return this.vocabularyList.find(item => item.id === id);
  }

  // Search vocabulary
  searchVocabulary(query) {
    this.currentFilters.search = query.toLowerCase();
    this.applyFilters();
    
    if (this.onVocabularyUpdate) {
      this.onVocabularyUpdate(this.filteredList);
    }
    
    return this.filteredList;
  }

  // Filter by category
  filterByCategory(category) {
    this.currentFilters.category = category;
    this.applyFilters();
    
    if (this.onVocabularyUpdate) {
      this.onVocabularyUpdate(this.filteredList);
    }
    
    return this.filteredList;
  }

  // Filter by difficulty
  filterByDifficulty(difficulty) {
    this.currentFilters.difficulty = difficulty;
    this.applyFilters();
    
    if (this.onVocabularyUpdate) {
      this.onVocabularyUpdate(this.filteredList);
    }
    
    return this.filteredList;
  }

  // Apply all current filters
  applyFilters() {
    this.filteredList = this.vocabularyList.filter(item => {
      // Search filter
      if (this.currentFilters.search) {
        const searchTerm = this.currentFilters.search;
        const matchesSearch = 
          item.spanish.toLowerCase().includes(searchTerm) ||
          item.english.toLowerCase().includes(searchTerm) ||
          item.category.toLowerCase().includes(searchTerm) ||
          (item.tags && item.tags.some(tag => tag.toLowerCase().includes(searchTerm)));
        
        if (!matchesSearch) return false;
      }
      
      // Category filter
      if (this.currentFilters.category && item.category !== this.currentFilters.category) {
        return false;
      }
      
      // Difficulty filter
      if (this.currentFilters.difficulty && item.difficulty !== parseInt(this.currentFilters.difficulty)) {
        return false;
      }

      return true;
    });
  }

  // Clear all filters
  clearFilters() {
    this.currentFilters = {
      search: '',
      category: '',
      difficulty: ''
    };
    
    this.filteredList = [...this.vocabularyList];
    
    if (this.onVocabularyUpdate) {
      this.onVocabularyUpdate(this.filteredList);
    }
  }

  // Select target words for a conversation session. Coarse-grained only --
  // filtered by the session's difficulty level and scenario, then picked at
  // random. There's no per-word mastery/scheduling concept here: a 20-30
  // minute conversation doesn't operate on the multi-day timescale spaced
  // repetition is designed for, so difficulty (chosen once, per session) is
  // the only "how hard should this be" knob. See docs/DECISIONS.md.
  selectWordsForSession(options = {}) {
    const { maxWords = 5, difficulty = 'mixed', scenario = null } = options;

    let candidates = [...this.vocabularyList];

    if (difficulty !== 'mixed') {
      const difficultyMap = {
        beginner: [1, 2],
        intermediate: [3, 4],
        advanced: [4, 5]
      };
      const targetDifficulties = difficultyMap[difficulty] || [1, 2, 3, 4, 5];
      candidates = candidates.filter(word => targetDifficulties.includes(word.difficulty || 1));
    }

    if (scenario) {
      candidates = candidates.filter(word =>
        word.category === scenario || (word.tags && word.tags.includes(scenario))
      );
    }

    return H.shuffle(candidates).slice(0, maxWords);
  }

  // Import vocabulary from CSV
  async importFromCSV(csvText) {
    try {
      const data = H.parseCSV(csvText);
      const importedWords = [];
      const errors = [];
      
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        
        try {
          // Validate required fields
          if (!row.spanish || !row.english) {
            errors.push(`Row ${i + 1}: Missing Spanish or English translation`);
            continue;
          }
          
          // Check for duplicates
          const existing = this.vocabularyList.find(item => 
            item.spanish.toLowerCase() === row.spanish.toLowerCase()
          );
          
          if (existing) {
            errors.push(`Row ${i + 1}: "${row.spanish}" already exists`);
            continue;
          }
          
          // Create vocabulary item
          const vocabularyItem = {
            spanish: row.spanish.trim(),
            english: row.english.trim(),
            phonetic: row.phonetic?.trim() || '',
            difficulty: parseInt(row.difficulty) || 1,
            category: row.category?.trim() || 'general',
            examples: row.examples ? row.examples.split(';').map(ex => ex.trim()) : [],
            tags: row.tags ? row.tags.split(',').map(tag => tag.trim()) : []
          };
          
          // Add to database
          const id = await this.database.addVocabularyItem(vocabularyItem);
          const newItem = { ...vocabularyItem, id };
          
          this.vocabularyList.push(newItem);
          importedWords.push(newItem);
          
        } catch (error) {
          errors.push(`Row ${i + 1}: ${error.message}`);
        }
      }
      
      // Update filtered list
      this.applyFilters();
      
      if (this.onVocabularyUpdate) {
        this.onVocabularyUpdate(this.filteredList);
      }
      
      if (this.onImportComplete) {
        this.onImportComplete({
          imported: importedWords.length,
          errors: errors.length,
          errorDetails: errors
        });
      }
      
      console.log(`Imported ${importedWords.length} words, ${errors.length} errors`);
      
      return {
        success: true,
        imported: importedWords.length,
        errors: errors.length,
        errorDetails: errors
      };
      
    } catch (error) {
      console.error('Failed to import CSV:', error);
      throw error;
    }
  }

  // Export vocabulary to CSV
  exportToCSV() {
    try {
      const headers = ['spanish', 'english', 'phonetic', 'difficulty', 'category', 'examples', 'tags'];

      let csvContent = headers.join(',') + '\n';

      this.vocabularyList.forEach(item => {
        const row = [
          `"${item.spanish}"`,
          `"${item.english}"`,
          `"${item.phonetic || ''}"`,
          item.difficulty || 1,
          `"${item.category || 'general'}"`,
          `"${(item.examples || []).join(';')}"`,
          `"${(item.tags || []).join(',')}"`
        ];
        
        csvContent += row.join(',') + '\n';
      });
      
      // Download file
      const filename = `hablabot-vocabulary-${new Date().toISOString().split('T')[0]}.csv`;
      H.downloadFile(csvContent, filename, 'text/csv');
      
      if (this.onExportComplete) {
        this.onExportComplete({
          exported: this.vocabularyList.length,
          filename: filename
        });
      }
      
      console.log(`Exported ${this.vocabularyList.length} words to ${filename}`);
      
      return {
        success: true,
        exported: this.vocabularyList.length,
        filename: filename
      };
      
    } catch (error) {
      console.error('Failed to export CSV:', error);
      throw error;
    }
  }

  // Get vocabulary statistics
  getStatistics() {
    const stats = {
      total: this.vocabularyList.length,
      byCategory: {},
      byDifficulty: {}
    };

    this.vocabularyList.forEach(item => {
      // By category
      stats.byCategory[item.category] = (stats.byCategory[item.category] || 0) + 1;

      // By difficulty
      stats.byDifficulty[item.difficulty] = (stats.byDifficulty[item.difficulty] || 0) + 1;
    });

    return stats;
  }

  // Get words by category
  getWordsByCategory(category) {
    return this.vocabularyList.filter(item => item.category === category);
  }

  // Get words by difficulty
  getWordsByDifficulty(difficulty) {
    return this.vocabularyList.filter(item => item.difficulty === difficulty);
  }

  // Get random words for practice
  getRandomWords(count = 5, filters = {}) {
    let candidates = this.vocabularyList;

    // Apply filters
    if (filters.category) {
      candidates = candidates.filter(item => item.category === filters.category);
    }

    if (filters.difficulty) {
      candidates = candidates.filter(item => item.difficulty === filters.difficulty);
    }

    // Shuffle and return requested count
    const shuffled = H.shuffle(candidates);
    return shuffled.slice(0, Math.min(count, shuffled.length));
  }

  // Bulk update words
  async bulkUpdateWords(wordIds, updates) {
    try {
      const updatedWords = [];
      
      for (const id of wordIds) {
        const word = this.getVocabularyItem(id);
        if (word) {
          const updatedWord = { ...word, ...updates };
          await this.database.put('vocabulary', updatedWord);
          
          const index = this.vocabularyList.findIndex(item => item.id === id);
          this.vocabularyList[index] = updatedWord;
          updatedWords.push(updatedWord);
        }
      }
      
      // Update filtered list
      this.applyFilters();
      
      if (this.onVocabularyUpdate) {
        this.onVocabularyUpdate(this.filteredList);
      }
      
      console.log(`Bulk updated ${updatedWords.length} words`);
      return updatedWords;
      
    } catch (error) {
      console.error('Failed to bulk update words:', error);
      throw error;
    }
  }

  // Get current filtered list
  getFilteredList() {
    return this.filteredList;
  }

  // Get all vocabulary
  getAllVocabulary() {
    return this.vocabularyList;
  }

  // Get available categories
  getCategories() {
    const usedCategories = [...new Set(this.vocabularyList.map(item => item.category))];
    return [...new Set([...this.categories, ...usedCategories])].sort();
  }

  // Clean up resources
  destroy() {
    this.database = null;
    this.vocabularyList = [];
    this.filteredList = [];
    this.onVocabularyUpdate = null;
    this.onImportComplete = null;
    this.onExportComplete = null;
  }
}

// Create global instance
window.HablaBotVocabulary = new VocabularyManager();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VocabularyManager;
}
