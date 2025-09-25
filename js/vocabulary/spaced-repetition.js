// HablaBot Spaced Repetition Algorithm (SM-2 Implementation)
class SpacedRepetition {
  constructor() {
    // SM-2 algorithm constants
    this.MIN_EASINESS = 1.3;
    this.DEFAULT_EASINESS = 2.5;
    this.EASINESS_BONUS = 0.1;
    this.EASINESS_PENALTY = 0.8;
    this.QUALITY_THRESHOLD = 3; // Below this, item is considered failed
    
    // Initial intervals in days
    this.INITIAL_INTERVALS = [1, 6];
  }

  /**
   * Calculate next review interval using SM-2 algorithm
   * @param {Object} item - Vocabulary item
   * @param {number} quality - Response quality (0-5)
   * @returns {Object} Updated scheduling information
   */
  calculateNextInterval(item, quality) {
    // Ensure quality is within valid range
    quality = Math.max(0, Math.min(5, Math.round(quality)));
    
    // Get current values or defaults
    let repetitions = item.repetitions || 0;
    let easinessFactor = item.easinessFactor || this.DEFAULT_EASINESS;
    let interval = item.interval || 0;
    
    // Calculate new easiness factor
    const newEasinessFactor = Math.max(
      this.MIN_EASINESS,
      easinessFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    );
    
    let newInterval;
    let newRepetitions;
    
    if (quality < this.QUALITY_THRESHOLD) {
      // Failed response - reset repetitions but keep some easiness
      newRepetitions = 0;
      newInterval = 1;
      easinessFactor = Math.max(this.MIN_EASINESS, easinessFactor - this.EASINESS_PENALTY);
    } else {
      // Successful response
      newRepetitions = repetitions + 1;
      
      if (newRepetitions === 1) {
        newInterval = this.INITIAL_INTERVALS[0];
      } else if (newRepetitions === 2) {
        newInterval = this.INITIAL_INTERVALS[1];
      } else {
        newInterval = Math.round(interval * newEasinessFactor);
      }
      
      easinessFactor = newEasinessFactor;
    }
    
    // Calculate next review date
    const nextReviewDate = new Date();
    nextReviewDate.setDate(nextReviewDate.getDate() + newInterval);
    
    return {
      repetitions: newRepetitions,
      easinessFactor: easinessFactor,
      interval: newInterval,
      nextReviewDate: nextReviewDate,
      lastReviewed: new Date(),
      quality: quality
    };
  }

  /**
   * Update vocabulary item with new scheduling
   * @param {Object} vocabularyItem - The vocabulary item to update
   * @param {number} responseQuality - User's response quality (0-5)
   * @returns {Object} Updated vocabulary item
   */
  updateWordScheduling(vocabularyItem, responseQuality) {
    const scheduling = this.calculateNextInterval(vocabularyItem, responseQuality);
    
    // Update the vocabulary item
    const updatedItem = {
      ...vocabularyItem,
      repetitions: scheduling.repetitions,
      easinessFactor: scheduling.easinessFactor,
      interval: scheduling.interval,
      nextReviewDate: scheduling.nextReviewDate,
      lastReviewed: scheduling.lastReviewed,
      lastQuality: scheduling.quality
    };
    
    // Update performance counters
    if (responseQuality >= this.QUALITY_THRESHOLD) {
      updatedItem.timesCorrect = (updatedItem.timesCorrect || 0) + 1;
    } else {
      updatedItem.timesIncorrect = (updatedItem.timesIncorrect || 0) + 1;
    }
    
    // Update mastery level (0-10 scale)
    updatedItem.masteryLevel = this.calculateMasteryLevel(updatedItem);
    
    return updatedItem;
  }

  /**
   * Calculate mastery level based on performance
   * @param {Object} item - Vocabulary item
   * @returns {number} Mastery level (0-10)
   */
  calculateMasteryLevel(item) {
    const repetitions = item.repetitions || 0;
    const easinessFactor = item.easinessFactor || this.DEFAULT_EASINESS;
    const timesCorrect = item.timesCorrect || 0;
    const timesIncorrect = item.timesIncorrect || 0;
    const totalAttempts = timesCorrect + timesIncorrect;
    
    if (totalAttempts === 0) return 0;
    
    // Base mastery on repetitions (successful reviews)
    let mastery = Math.min(repetitions * 1.5, 8);
    
    // Adjust based on accuracy
    const accuracy = timesCorrect / totalAttempts;
    mastery *= accuracy;
    
    // Adjust based on easiness factor
    const easinessBonus = (easinessFactor - this.MIN_EASINESS) / (3.0 - this.MIN_EASINESS);
    mastery += easinessBonus * 2;
    
    // Cap at 10 and round
    return Math.min(10, Math.round(mastery * 10) / 10);
  }

  /**
   * Get words due for review
   * @param {Array} vocabularyItems - All vocabulary items
   * @param {Date} targetDate - Date to check against (default: now)
   * @returns {Array} Words due for review, sorted by priority
   */
  getWordsForReview(vocabularyItems, targetDate = new Date()) {
    const dueWords = vocabularyItems.filter(item => {
      const nextReview = new Date(item.nextReviewDate || 0);
      return nextReview <= targetDate;
    });
    
    // Sort by priority (overdue first, then by easiness factor)
    return dueWords.sort((a, b) => {
      const aOverdue = this.getDaysOverdue(a, targetDate);
      const bOverdue = this.getDaysOverdue(b, targetDate);
      
      // Prioritize overdue items
      if (aOverdue !== bOverdue) {
        return bOverdue - aOverdue; // More overdue first
      }
      
      // Then by easiness factor (harder words first)
      const aEasiness = a.easinessFactor || this.DEFAULT_EASINESS;
      const bEasiness = b.easinessFactor || this.DEFAULT_EASINESS;
      return aEasiness - bEasiness;
    });
  }

  /**
   * Get number of days a word is overdue
   * @param {Object} item - Vocabulary item
   * @param {Date} currentDate - Current date
   * @returns {number} Days overdue (0 if not overdue)
   */
  getDaysOverdue(item, currentDate = new Date()) {
    const nextReview = new Date(item.nextReviewDate || 0);
    const diffTime = currentDate - nextReview;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  }

  /**
   * Get daily review count
   * @param {Array} vocabularyItems - All vocabulary items
   * @param {Date} targetDate - Date to check (default: today)
   * @returns {number} Number of words to review
   */
  getDailyReviewCount(vocabularyItems, targetDate = new Date()) {
    return this.getWordsForReview(vocabularyItems, targetDate).length;
  }

  /**
   * Get review statistics
   * @param {Array} vocabularyItems - All vocabulary items
   * @returns {Object} Review statistics
   */
  getReviewStatistics(vocabularyItems) {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date(now);
    nextWeek.setDate(nextWeek.getDate() + 7);
    
    const stats = {
      total: vocabularyItems.length,
      dueToday: this.getDailyReviewCount(vocabularyItems, now),
      dueTomorrow: this.getDailyReviewCount(vocabularyItems, tomorrow),
      dueThisWeek: 0,
      mastered: 0,
      learning: 0,
      new: 0,
      averageMastery: 0
    };
    
    let totalMastery = 0;
    
    vocabularyItems.forEach(item => {
      const mastery = item.masteryLevel || 0;
      totalMastery += mastery;
      
      if (mastery >= 8) {
        stats.mastered++;
      } else if (mastery > 0) {
        stats.learning++;
      } else {
        stats.new++;
      }
      
      const nextReview = new Date(item.nextReviewDate || 0);
      if (nextReview <= nextWeek) {
        stats.dueThisWeek++;
      }
    });
    
    stats.averageMastery = vocabularyItems.length > 0 ? 
      Math.round((totalMastery / vocabularyItems.length) * 10) / 10 : 0;
    
    return stats;
  }

  /**
   * Select words for a conversation session
   * @param {Array} vocabularyItems - All vocabulary items
   * @param {Object} options - Selection options
   * @returns {Array} Selected words for practice
   */
  selectWordsForSession(vocabularyItems, options = {}) {
    const {
      maxWords = 5,
      difficulty = 'mixed', // 'beginner', 'intermediate', 'advanced', 'mixed'
      scenario = null,
      prioritizeReview = true
    } = options;
    
    let candidateWords = [...vocabularyItems];
    
    // Filter by difficulty if specified
    if (difficulty !== 'mixed') {
      const difficultyMap = {
        'beginner': [1, 2],
        'intermediate': [3, 4],
        'advanced': [4, 5]
      };
      
      const targetDifficulties = difficultyMap[difficulty] || [1, 2, 3, 4, 5];
      candidateWords = candidateWords.filter(word => 
        targetDifficulties.includes(word.difficulty || 1)
      );
    }
    
    // Filter by scenario/category if specified
    if (scenario) {
      candidateWords = candidateWords.filter(word => 
        word.category === scenario || 
        (word.tags && word.tags.includes(scenario))
      );
    }
    
    // Separate due and non-due words
    const dueWords = this.getWordsForReview(candidateWords);
    const nonDueWords = candidateWords.filter(word => 
      !dueWords.find(due => due.id === word.id)
    );
    
    // Select words based on priority
    const selectedWords = [];
    
    if (prioritizeReview && dueWords.length > 0) {
      // Prioritize due words
      const reviewCount = Math.min(Math.ceil(maxWords * 0.8), dueWords.length);
      selectedWords.push(...dueWords.slice(0, reviewCount));
      
      // Fill remaining slots with new/non-due words
      const remainingSlots = maxWords - selectedWords.length;
      if (remainingSlots > 0) {
        // Prefer words with lower mastery levels
        const sortedNonDue = nonDueWords.sort((a, b) => 
          (a.masteryLevel || 0) - (b.masteryLevel || 0)
        );
        selectedWords.push(...sortedNonDue.slice(0, remainingSlots));
      }
    } else {
      // Mix of due and non-due words
      const mixedWords = [...dueWords, ...nonDueWords]
        .sort((a, b) => {
          // Sort by combination of due status and mastery level
          const aDue = this.getDaysOverdue(a) > 0 ? 1 : 0;
          const bDue = this.getDaysOverdue(b) > 0 ? 1 : 0;
          
          if (aDue !== bDue) return bDue - aDue; // Due first
          
          return (a.masteryLevel || 0) - (b.masteryLevel || 0); // Lower mastery first
        });
      
      selectedWords.push(...mixedWords.slice(0, maxWords));
    }
    
    return selectedWords;
  }

  /**
   * Convert quality score from different scales
   * @param {number} score - Score in various formats
   * @param {string} scale - Scale type ('binary', 'percentage', 'confidence', 'sm2')
   * @returns {number} SM-2 quality score (0-5)
   */
  convertToSM2Quality(score, scale = 'sm2') {
    switch (scale) {
      case 'binary': // 0 or 1
        return score ? 4 : 1;
      
      case 'percentage': // 0-100
        if (score >= 90) return 5;
        if (score >= 80) return 4;
        if (score >= 60) return 3;
        if (score >= 40) return 2;
        if (score >= 20) return 1;
        return 0;
      
      case 'confidence': // 0.0-1.0
        return Math.round(score * 5);
      
      case 'sm2': // Already 0-5
      default:
        return Math.max(0, Math.min(5, Math.round(score)));
    }
  }

  /**
   * Get optimal review schedule for upcoming days
   * @param {Array} vocabularyItems - All vocabulary items
   * @param {number} days - Number of days to look ahead
   * @returns {Array} Daily review counts
   */
  getReviewSchedule(vocabularyItems, days = 7) {
    const schedule = [];
    const today = new Date();
    
    for (let i = 0; i < days; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(today.getDate() + i);
      
      const dueCount = this.getDailyReviewCount(vocabularyItems, checkDate);
      
      schedule.push({
        date: new Date(checkDate),
        dueCount: dueCount,
        dayName: checkDate.toLocaleDateString('en-US', { weekday: 'short' })
      });
    }
    
    return schedule;
  }
}

// Create global instance
window.HablaBotSpacedRepetition = new SpacedRepetition();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SpacedRepetition;
}
