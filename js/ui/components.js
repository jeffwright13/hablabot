// HablaBot UI Components
class UIComponents {
  constructor() {
    this.vocabularyManager = null;
    this.uiState = null;
  }

  // Initialize components
  init(vocabularyManager, uiState) {
    this.vocabularyManager = vocabularyManager;
    this.uiState = uiState;
    console.log('UI Components initialized');
  }

  // Create vocabulary item card
  createVocabularyCard(vocabularyItem) {
    const masteryLevel = vocabularyItem.masteryLevel || 0;
    const masteryClass = this.getMasteryClass(masteryLevel);
    const difficultyStars = '★'.repeat(vocabularyItem.difficulty || 1);
    
    const card = H.createElement('div', {
      className: `vocabulary-card ${masteryClass}`,
      'data-word-id': vocabularyItem.id
    });
    
    card.innerHTML = `
      <div class="vocab-card-header">
        <div class="vocab-spanish">${H.escapeHtml(vocabularyItem.spanish)}</div>
        <div class="vocab-actions">
          <button class="vocab-edit-btn" onclick="HablaBotComponents.editVocabularyItem('${vocabularyItem.id}')">
            ✏️
          </button>
          <button class="vocab-delete-btn" onclick="HablaBotComponents.deleteVocabularyItem('${vocabularyItem.id}')">
            🗑️
          </button>
        </div>
      </div>
      
      <div class="vocab-card-body">
        <div class="vocab-english">${H.escapeHtml(vocabularyItem.english)}</div>
        
        ${vocabularyItem.phonetic ? `
          <div class="vocab-phonetic">/${H.escapeHtml(vocabularyItem.phonetic)}/</div>
        ` : ''}
        
        <div class="vocab-meta">
          <span class="vocab-difficulty" title="Difficulty">
            ${difficultyStars}
          </span>
          <span class="vocab-category">${H.escapeHtml(vocabularyItem.category || 'general')}</span>
          <span class="vocab-mastery" title="Mastery Level: ${masteryLevel}/10">
            🎯 ${masteryLevel.toFixed(1)}
          </span>
        </div>
        
        ${vocabularyItem.examples && vocabularyItem.examples.length > 0 ? `
          <div class="vocab-examples">
            <strong>Examples:</strong>
            <ul>
              ${vocabularyItem.examples.map(example => 
                `<li>${H.escapeHtml(example)}</li>`
              ).join('')}
            </ul>
          </div>
        ` : ''}
        
        ${vocabularyItem.tags && vocabularyItem.tags.length > 0 ? `
          <div class="vocab-tags">
            ${vocabularyItem.tags.map(tag => 
              `<span class="vocab-tag">${H.escapeHtml(tag)}</span>`
            ).join('')}
          </div>
        ` : ''}
        
        ${vocabularyItem.nextReviewDate ? `
          <div class="vocab-review-date">
            Next review: ${H.formatDate(new Date(vocabularyItem.nextReviewDate))}
          </div>
        ` : ''}
      </div>
    `;
    
    return card;
  }

  // Get mastery level CSS class
  getMasteryClass(masteryLevel) {
    if (masteryLevel >= 8) return 'mastery-high';
    if (masteryLevel >= 5) return 'mastery-medium';
    if (masteryLevel >= 2) return 'mastery-low';
    return 'mastery-new';
  }

  // Create add vocabulary modal
  createAddVocabularyModal() {
    const modalContent = `
      <div class="add-vocabulary-modal">
        <h3>Add New Vocabulary</h3>
        <form id="add-vocabulary-form">
          <div class="form-group">
            <label for="vocab-spanish">Spanish Word/Phrase *</label>
            <input type="text" id="vocab-spanish" required placeholder="e.g., hola">
          </div>
          
          <div class="form-group">
            <label for="vocab-english">English Translation *</label>
            <input type="text" id="vocab-english" required placeholder="e.g., hello">
          </div>
          
          <div class="form-group">
            <label for="vocab-phonetic">Phonetic (IPA) - Optional</label>
            <input type="text" id="vocab-phonetic" placeholder="e.g., ˈo.la">
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label for="vocab-difficulty">Difficulty</label>
              <select id="vocab-difficulty">
                <option value="1">1 - Beginner</option>
                <option value="2">2 - Elementary</option>
                <option value="3">3 - Intermediate</option>
                <option value="4">4 - Advanced</option>
                <option value="5">5 - Expert</option>
              </select>
            </div>
            
            <div class="form-group">
              <label for="vocab-category">Category</label>
              <select id="vocab-category">
                ${this.getCategoryOptions()}
              </select>
            </div>
          </div>
          
          <div class="form-group">
            <label for="vocab-examples">Example Sentences (one per line)</label>
            <textarea id="vocab-examples" rows="3" placeholder="¡Hola! ¿Cómo estás?"></textarea>
          </div>
          
          <div class="form-group">
            <label for="vocab-tags">Tags (comma-separated)</label>
            <input type="text" id="vocab-tags" placeholder="greeting, basic, common">
          </div>
          
          <div class="form-actions">
            <button type="button" class="secondary-btn" onclick="HablaBotComponents.closeModal()">
              Cancel
            </button>
            <button type="submit" class="primary-btn">
              Add Vocabulary
            </button>
          </div>
        </form>
      </div>
    `;
    
    return modalContent;
  }

  // Create edit vocabulary modal
  createEditVocabularyModal(vocabularyItem) {
    const modalContent = `
      <div class="edit-vocabulary-modal">
        <h3>Edit Vocabulary</h3>
        <form id="edit-vocabulary-form" data-word-id="${vocabularyItem.id}">
          <div class="form-group">
            <label for="edit-vocab-spanish">Spanish Word/Phrase *</label>
            <input type="text" id="edit-vocab-spanish" required value="${H.escapeHtml(vocabularyItem.spanish)}">
          </div>
          
          <div class="form-group">
            <label for="edit-vocab-english">English Translation *</label>
            <input type="text" id="edit-vocab-english" required value="${H.escapeHtml(vocabularyItem.english)}">
          </div>
          
          <div class="form-group">
            <label for="edit-vocab-phonetic">Phonetic (IPA) - Optional</label>
            <input type="text" id="edit-vocab-phonetic" value="${H.escapeHtml(vocabularyItem.phonetic || '')}">
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label for="edit-vocab-difficulty">Difficulty</label>
              <select id="edit-vocab-difficulty">
                ${this.getDifficultyOptions(vocabularyItem.difficulty)}
              </select>
            </div>
            
            <div class="form-group">
              <label for="edit-vocab-category">Category</label>
              <select id="edit-vocab-category">
                ${this.getCategoryOptions(vocabularyItem.category)}
              </select>
            </div>
          </div>
          
          <div class="form-group">
            <label for="edit-vocab-examples">Example Sentences (one per line)</label>
            <textarea id="edit-vocab-examples" rows="3">${(vocabularyItem.examples || []).join('\n')}</textarea>
          </div>
          
          <div class="form-group">
            <label for="edit-vocab-tags">Tags (comma-separated)</label>
            <input type="text" id="edit-vocab-tags" value="${(vocabularyItem.tags || []).join(', ')}">
          </div>
          
          <div class="vocab-stats">
            <div class="stat-item">
              <label>Mastery Level:</label>
              <span>${(vocabularyItem.masteryLevel || 0).toFixed(1)}/10</span>
            </div>
            <div class="stat-item">
              <label>Times Correct:</label>
              <span>${vocabularyItem.timesCorrect || 0}</span>
            </div>
            <div class="stat-item">
              <label>Times Incorrect:</label>
              <span>${vocabularyItem.timesIncorrect || 0}</span>
            </div>
            <div class="stat-item">
              <label>Last Reviewed:</label>
              <span>${vocabularyItem.lastReviewed ? H.formatDate(new Date(vocabularyItem.lastReviewed)) : 'Never'}</span>
            </div>
          </div>
          
          <div class="form-actions">
            <button type="button" class="secondary-btn" onclick="HablaBotComponents.closeModal()">
              Cancel
            </button>
            <button type="submit" class="primary-btn">
              Save Changes
            </button>
          </div>
        </form>
      </div>
    `;
    
    return modalContent;
  }

  // Create import vocabulary modal
  createImportVocabularyModal() {
    const modalContent = `
      <div class="import-vocabulary-modal">
        <h3>Import Vocabulary from CSV</h3>
        
        <div class="import-instructions">
          <h4>CSV Format Requirements:</h4>
          <p>Your CSV file should have the following columns:</p>
          <ul>
            <li><strong>spanish</strong> - Spanish word/phrase (required)</li>
            <li><strong>english</strong> - English translation (required)</li>
            <li><strong>phonetic</strong> - IPA pronunciation (optional)</li>
            <li><strong>difficulty</strong> - Number 1-5 (optional, default: 1)</li>
            <li><strong>category</strong> - Category name (optional, default: general)</li>
            <li><strong>examples</strong> - Example sentences separated by semicolons (optional)</li>
            <li><strong>tags</strong> - Tags separated by commas (optional)</li>
          </ul>
          
          <div class="csv-example">
            <strong>Example:</strong>
            <pre>spanish,english,phonetic,difficulty,category,examples,tags
hola,hello,ˈo.la,1,general,¡Hola! ¿Cómo estás?,greeting,basic</pre>
          </div>
        </div>
        
        <div class="file-upload-area">
          <input type="file" id="csv-file-input" accept=".csv" style="display: none;">
          <div class="file-drop-zone" onclick="document.getElementById('csv-file-input').click()">
            <div class="drop-zone-content">
              <span class="upload-icon">📁</span>
              <p>Click to select CSV file or drag and drop</p>
              <p class="file-info">Supports .csv files up to 5MB</p>
            </div>
          </div>
        </div>
        
        <div id="import-preview" class="import-preview" hidden>
          <h4>Import Preview:</h4>
          <div id="preview-content"></div>
        </div>
        
        <div class="form-actions">
          <button type="button" class="secondary-btn" onclick="HablaBotComponents.closeModal()">
            Cancel
          </button>
          <button type="button" id="import-btn" class="primary-btn" disabled onclick="HablaBotComponents.processImport()">
            Import Vocabulary
          </button>
        </div>
      </div>
    `;
    
    return modalContent;
  }

  // Create session summary modal
  createSessionSummaryModal(sessionData) {
    const duration = sessionData.endTime - sessionData.startTime;
    const durationMinutes = Math.round(duration / (1000 * 60));
    const wordsUsed = Object.keys(sessionData.wordsUsed || {}).length;
    const totalWords = sessionData.targetWords?.length || 0;
    const accuracy = this.calculateSessionAccuracy(sessionData);
    
    const modalContent = `
      <div class="session-summary-modal">
        <h3>🎉 Session Complete!</h3>
        
        <div class="session-stats">
          <div class="stat-card">
            <div class="stat-icon">⏱️</div>
            <div class="stat-value">${durationMinutes}</div>
            <div class="stat-label">Minutes</div>
          </div>
          
          <div class="stat-card">
            <div class="stat-icon">📚</div>
            <div class="stat-value">${wordsUsed}/${totalWords}</div>
            <div class="stat-label">Words Used</div>
          </div>
          
          <div class="stat-card">
            <div class="stat-icon">🎯</div>
            <div class="stat-value">${accuracy}%</div>
            <div class="stat-label">Accuracy</div>
          </div>
          
          <div class="stat-card">
            <div class="stat-icon">💬</div>
            <div class="stat-value">${sessionData.conversationHistory?.length || 0}</div>
            <div class="stat-label">Messages</div>
          </div>
        </div>
        
        ${wordsUsed > 0 ? `
          <div class="words-practiced">
            <h4>Words You Practiced:</h4>
            <div class="word-list">
              ${Object.entries(sessionData.wordsUsed || {}).map(([wordId, count]) => {
                const word = sessionData.targetWords?.find(w => w.id === wordId);
                return word ? `
                  <div class="practiced-word">
                    <span class="word-spanish">${word.spanish}</span>
                    <span class="word-english">${word.english}</span>
                    <span class="usage-count">Used ${count} time${count > 1 ? 's' : ''}</span>
                  </div>
                ` : '';
              }).join('')}
            </div>
          </div>
        ` : ''}
        
        <div class="session-feedback">
          <h4>Rate Your Session:</h4>
          <div class="rating-stars">
            ${[1, 2, 3, 4, 5].map(rating => `
              <button class="star-btn" onclick="HablaBotComponents.rateSession(${rating})" data-rating="${rating}">
                ⭐
              </button>
            `).join('')}
          </div>
        </div>
        
        <div class="form-actions">
          <button type="button" class="secondary-btn" onclick="HablaBotComponents.closeModal()">
            Close
          </button>
          <button type="button" class="primary-btn" onclick="HablaBotComponents.startNewSession()">
            Start New Session
          </button>
        </div>
      </div>
    `;
    
    return modalContent;
  }

  // Create progress chart placeholder
  createProgressChart(canvasId, data, type = 'line') {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // Simple placeholder chart (would use Chart.js in production)
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(10, 10, canvas.width - 20, canvas.height - 20);
    
    ctx.fillStyle = 'white';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Chart Placeholder', canvas.width / 2, canvas.height / 2);
    ctx.fillText(`${type} chart for ${canvasId}`, canvas.width / 2, canvas.height / 2 + 20);
  }

  // Get category options HTML
  getCategoryOptions(selectedCategory = '') {
    const categories = this.vocabularyManager ? 
      this.vocabularyManager.getCategories() : 
      ['general', 'food', 'travel', 'family', 'work', 'health', 'shopping'];
    
    return categories.map(category => `
      <option value="${category}" ${category === selectedCategory ? 'selected' : ''}>
        ${H.capitalize(category)}
      </option>
    `).join('');
  }

  // Get difficulty options HTML
  getDifficultyOptions(selectedDifficulty = 1) {
    const difficulties = [
      { value: 1, label: '1 - Beginner' },
      { value: 2, label: '2 - Elementary' },
      { value: 3, label: '3 - Intermediate' },
      { value: 4, label: '4 - Advanced' },
      { value: 5, label: '5 - Expert' }
    ];
    
    return difficulties.map(diff => `
      <option value="${diff.value}" ${diff.value === selectedDifficulty ? 'selected' : ''}>
        ${diff.label}
      </option>
    `).join('');
  }

  // Calculate session accuracy
  calculateSessionAccuracy(sessionData) {
    if (!sessionData.userPerformance) return 0;
    
    let totalAttempts = 0;
    let successfulAttempts = 0;
    
    Object.values(sessionData.userPerformance).forEach(performance => {
      totalAttempts += performance.attempts || 0;
      successfulAttempts += performance.successfulUses || 0;
    });
    
    return totalAttempts > 0 ? Math.round((successfulAttempts / totalAttempts) * 100) : 0;
  }

  // Render vocabulary list
  renderVocabularyList(vocabularyItems, containerId = 'vocabulary-list') {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '';
    
    if (vocabularyItems.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📚</div>
          <h3>No vocabulary found</h3>
          <p>Add some vocabulary words to get started with your Spanish learning journey!</p>
          <button class="primary-btn" onclick="HablaBotComponents.showAddVocabularyModal()">
            Add Your First Word
          </button>
        </div>
      `;
      return;
    }
    
    vocabularyItems.forEach(item => {
      const card = this.createVocabularyCard(item);
      container.appendChild(card);
    });
  }

  // Show add vocabulary modal
  showAddVocabularyModal() {
    const content = this.createAddVocabularyModal();
    this.uiState.showModal(content);
    
    // Set up form handler
    const form = document.getElementById('add-vocabulary-form');
    if (form) {
      form.onsubmit = (e) => {
        e.preventDefault();
        this.handleAddVocabulary();
      };
    }
  }

  // Show edit vocabulary modal
  editVocabularyItem(wordId) {
    const word = this.vocabularyManager.getVocabularyItem(wordId);
    if (!word) return;
    
    const content = this.createEditVocabularyModal(word);
    this.uiState.showModal(content);
    
    // Set up form handler
    const form = document.getElementById('edit-vocabulary-form');
    if (form) {
      form.onsubmit = (e) => {
        e.preventDefault();
        this.handleEditVocabulary();
      };
    }
  }

  // Show import vocabulary modal
  showImportVocabularyModal() {
    const content = this.createImportVocabularyModal();
    this.uiState.showModal(content);
    
    // Set up file input handler
    const fileInput = document.getElementById('csv-file-input');
    if (fileInput) {
      fileInput.onchange = (e) => {
        this.handleFileSelect(e.target.files[0]);
      };
    }
  }

  // Handle add vocabulary form submission
  async handleAddVocabulary() {
    try {
      const formData = {
        spanish: document.getElementById('vocab-spanish').value.trim(),
        english: document.getElementById('vocab-english').value.trim(),
        phonetic: document.getElementById('vocab-phonetic').value.trim(),
        difficulty: parseInt(document.getElementById('vocab-difficulty').value),
        category: document.getElementById('vocab-category').value,
        examples: document.getElementById('vocab-examples').value
          .split('\n')
          .map(ex => ex.trim())
          .filter(ex => ex.length > 0),
        tags: document.getElementById('vocab-tags').value
          .split(',')
          .map(tag => tag.trim())
          .filter(tag => tag.length > 0)
      };
      
      await this.vocabularyManager.addVocabularyItem(formData);
      this.uiState.hideModal();
      this.uiState.showSuccess('Vocabulary added successfully!');
      
    } catch (error) {
      this.uiState.showError(error.message);
    }
  }

  // Handle edit vocabulary form submission
  async handleEditVocabulary() {
    try {
      const form = document.getElementById('edit-vocabulary-form');
      const wordId = form.dataset.wordId;
      
      const updates = {
        spanish: document.getElementById('edit-vocab-spanish').value.trim(),
        english: document.getElementById('edit-vocab-english').value.trim(),
        phonetic: document.getElementById('edit-vocab-phonetic').value.trim(),
        difficulty: parseInt(document.getElementById('edit-vocab-difficulty').value),
        category: document.getElementById('edit-vocab-category').value,
        examples: document.getElementById('edit-vocab-examples').value
          .split('\n')
          .map(ex => ex.trim())
          .filter(ex => ex.length > 0),
        tags: document.getElementById('edit-vocab-tags').value
          .split(',')
          .map(tag => tag.trim())
          .filter(tag => tag.length > 0)
      };
      
      await this.vocabularyManager.updateVocabularyItem(wordId, updates);
      this.uiState.hideModal();
      this.uiState.showSuccess('Vocabulary updated successfully!');
      
    } catch (error) {
      this.uiState.showError(error.message);
    }
  }

  // Handle vocabulary deletion
  async deleteVocabularyItem(wordId) {
    if (!confirm('Are you sure you want to delete this vocabulary item?')) {
      return;
    }
    
    try {
      await this.vocabularyManager.deleteVocabularyItem(wordId);
      this.uiState.showSuccess('Vocabulary deleted successfully!');
    } catch (error) {
      this.uiState.showError(error.message);
    }
  }

  // Handle file selection for import
  async handleFileSelect(file) {
    if (!file) return;
    
    try {
      const text = await H.readFile(file);
      const preview = this.createImportPreview(text);
      
      const previewContainer = document.getElementById('import-preview');
      const previewContent = document.getElementById('preview-content');
      const importBtn = document.getElementById('import-btn');
      
      if (previewContainer && previewContent && importBtn) {
        previewContent.innerHTML = preview;
        H.show(previewContainer);
        importBtn.disabled = false;
        importBtn.dataset.csvText = text;
      }
      
    } catch (error) {
      this.uiState.showError('Failed to read file: ' + error.message);
    }
  }

  // Create import preview
  createImportPreview(csvText) {
    try {
      const data = H.parseCSV(csvText);
      const previewCount = Math.min(5, data.length);
      
      return `
        <p>Found ${data.length} rows. Showing first ${previewCount}:</p>
        <div class="preview-table">
          <table>
            <thead>
              <tr>
                <th>Spanish</th>
                <th>English</th>
                <th>Category</th>
                <th>Difficulty</th>
              </tr>
            </thead>
            <tbody>
              ${data.slice(0, previewCount).map(row => `
                <tr>
                  <td>${H.escapeHtml(row.spanish || '')}</td>
                  <td>${H.escapeHtml(row.english || '')}</td>
                  <td>${H.escapeHtml(row.category || 'general')}</td>
                  <td>${row.difficulty || 1}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (error) {
      return `<p class="error">Error parsing CSV: ${error.message}</p>`;
    }
  }

  // Process CSV import
  async processImport() {
    const importBtn = document.getElementById('import-btn');
    const csvText = importBtn?.dataset.csvText;
    
    if (!csvText) return;
    
    try {
      H.showLoading(importBtn, 'Importing...');
      
      const result = await this.vocabularyManager.importFromCSV(csvText);
      
      this.uiState.hideModal();
      
      if (result.errors > 0) {
        this.uiState.showWarning(
          `Imported ${result.imported} words with ${result.errors} errors. Check console for details.`
        );
      } else {
        this.uiState.showSuccess(`Successfully imported ${result.imported} vocabulary words!`);
      }
      
    } catch (error) {
      this.uiState.showError('Import failed: ' + error.message);
    } finally {
      H.hideLoading(importBtn);
      importBtn.textContent = 'Import Vocabulary';
    }
  }

  // Close modal
  closeModal() {
    this.uiState.hideModal();
  }

  // Rate session
  rateSession(rating) {
    // Update star display
    const stars = document.querySelectorAll('.star-btn');
    stars.forEach((star, index) => {
      if (index < rating) {
        star.style.color = '#ffd700';
      } else {
        star.style.color = '#ddd';
      }
    });
    
    // Store rating (would save to session data)
    console.log('Session rated:', rating);
  }

  // Start new session
  startNewSession() {
    this.uiState.hideModal();
    this.uiState.switchToView('conversation');
  }

  // Clean up resources
  destroy() {
    this.vocabularyManager = null;
    this.uiState = null;
  }
}

// Create global instance
window.HablaBotComponents = new UIComponents();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UIComponents;
}
