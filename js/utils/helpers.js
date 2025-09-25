// HablaBot Utility Functions
class HablaBotHelpers {
  // DOM Utilities
  static $(selector) {
    return document.querySelector(selector);
  }

  static $$(selector) {
    return document.querySelectorAll(selector);
  }

  static createElement(tag, attributes = {}, children = []) {
    const element = document.createElement(tag);
    
    // Set attributes
    Object.entries(attributes).forEach(([key, value]) => {
      if (key === 'className') {
        element.className = value;
      } else if (key === 'innerHTML') {
        element.innerHTML = value;
      } else if (key === 'textContent') {
        element.textContent = value;
      } else {
        element.setAttribute(key, value);
      }
    });
    
    // Add children
    children.forEach(child => {
      if (typeof child === 'string') {
        element.appendChild(document.createTextNode(child));
      } else if (child instanceof Node) {
        element.appendChild(child);
      }
    });
    
    return element;
  }

  // Show/Hide elements
  static show(element) {
    if (typeof element === 'string') {
      element = this.$(element);
    }
    if (element) {
      element.hidden = false;
      element.style.display = '';
    }
  }

  static hide(element) {
    if (typeof element === 'string') {
      element = this.$(element);
    }
    if (element) {
      element.hidden = true;
    }
  }

  static toggle(element) {
    if (typeof element === 'string') {
      element = this.$(element);
    }
    if (element) {
      if (element.hidden) {
        this.show(element);
      } else {
        this.hide(element);
      }
    }
  }

  // Add/Remove CSS classes
  static addClass(element, className) {
    if (typeof element === 'string') {
      element = this.$(element);
    }
    if (element) {
      element.classList.add(className);
    }
  }

  static removeClass(element, className) {
    if (typeof element === 'string') {
      element = this.$(element);
    }
    if (element) {
      element.classList.remove(className);
    }
  }

  static toggleClass(element, className) {
    if (typeof element === 'string') {
      element = this.$(element);
    }
    if (element) {
      element.classList.toggle(className);
    }
  }

  // Event handling
  static on(element, event, handler) {
    if (typeof element === 'string') {
      element = this.$(element);
    }
    if (element) {
      element.addEventListener(event, handler);
    }
  }

  static off(element, event, handler) {
    if (typeof element === 'string') {
      element = this.$(element);
    }
    if (element) {
      element.removeEventListener(event, handler);
    }
  }

  // String utilities
  static capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  static slugify(str) {
    return str
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  static truncate(str, length = 100, suffix = '...') {
    if (str.length <= length) return str;
    return str.substring(0, length) + suffix;
  }

  static escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Date utilities
  static formatDate(date, options = {}) {
    const defaults = {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    };
    
    return new Intl.DateTimeFormat('en-US', { ...defaults, ...options }).format(date);
  }

  static formatTime(date, options = {}) {
    const defaults = {
      hour: '2-digit',
      minute: '2-digit'
    };
    
    return new Intl.DateTimeFormat('en-US', { ...defaults, ...options }).format(date);
  }

  static formatDuration(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  static timeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return this.formatDate(date);
  }

  // Number utilities
  static formatNumber(num, options = {}) {
    return new Intl.NumberFormat('en-US', options).format(num);
  }

  static formatPercentage(num, decimals = 1) {
    return this.formatNumber(num, {
      style: 'percent',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }

  static clamp(num, min, max) {
    return Math.min(Math.max(num, min), max);
  }

  static random(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  // Array utilities
  static shuffle(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  static unique(array) {
    return [...new Set(array)];
  }

  static groupBy(array, key) {
    return array.reduce((groups, item) => {
      const group = typeof key === 'function' ? key(item) : item[key];
      groups[group] = groups[group] || [];
      groups[group].push(item);
      return groups;
    }, {});
  }

  // Object utilities
  static deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  static isEmpty(obj) {
    return Object.keys(obj).length === 0;
  }

  static pick(obj, keys) {
    const result = {};
    keys.forEach(key => {
      if (key in obj) {
        result[key] = obj[key];
      }
    });
    return result;
  }

  static omit(obj, keys) {
    const result = { ...obj };
    keys.forEach(key => {
      delete result[key];
    });
    return result;
  }

  // Validation utilities
  static isEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  }

  static isUrl(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  static isApiKey(key) {
    return typeof key === 'string' && key.length > 10 && (key.startsWith('sk-') || key.startsWith('sk-proj-'));
  }

  // Storage utilities
  static setLocalStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
      return false;
    }
  }

  static getLocalStorage(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error('Failed to read from localStorage:', error);
      return defaultValue;
    }
  }

  static removeLocalStorage(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error('Failed to remove from localStorage:', error);
      return false;
    }
  }

  // File utilities
  static downloadFile(data, filename, type = 'application/json') {
    const blob = new Blob([data], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  static readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsText(file);
    });
  }

  static parseCSV(csvText) {
    const lines = csvText.split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line) {
        const values = line.split(',').map(v => v.trim());
        const row = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        data.push(row);
      }
    }
    
    return data;
  }

  // Toast notifications
  static showToast(message, type = 'info', duration = 3000) {
    const container = this.$('#toast-container');
    if (!container) return;
    
    const toast = this.createElement('div', {
      className: `toast ${type} animate-slide-in-right`,
      innerHTML: `
        <div class="toast-content">
          <span class="toast-message">${this.escapeHtml(message)}</span>
          <button class="toast-close" onclick="this.parentElement.parentElement.remove()">&times;</button>
        </div>
      `
    });
    
    container.appendChild(toast);
    
    // Auto remove after duration
    setTimeout(() => {
      if (toast.parentElement) {
        toast.classList.add('animate-fade-out');
        setTimeout(() => toast.remove(), 300);
      }
    }, duration);
  }

  // Loading states
  static showLoading(element, text = 'Loading...') {
    if (typeof element === 'string') {
      element = this.$(element);
    }
    if (element) {
      element.innerHTML = `
        <div class="loading-state">
          <div class="spinner"></div>
          <span>${text}</span>
        </div>
      `;
      element.classList.add('loading');
    }
  }

  static hideLoading(element) {
    if (typeof element === 'string') {
      element = this.$(element);
    }
    if (element) {
      element.classList.remove('loading');
    }
  }

  // Debounce function
  static debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // Throttle function
  static throttle(func, limit) {
    let inThrottle;
    return function executedFunction(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  // Promise utilities
  static sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static timeout(promise, ms) {
    return Promise.race([
      promise,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), ms)
      )
    ]);
  }

  // Browser detection
  static getBrowserInfo() {
    const ua = navigator.userAgent;
    return {
      isMobile: /Mobile|Android|iPhone|iPad/.test(ua),
      isIOS: /iPhone|iPad|iPod/.test(ua),
      isAndroid: /Android/.test(ua),
      isSafari: /Safari/.test(ua) && !/Chrome/.test(ua),
      isChrome: /Chrome/.test(ua),
      isFirefox: /Firefox/.test(ua)
    };
  }

  // Feature detection
  static supportsFeature(feature) {
    switch (feature) {
      case 'speechRecognition':
        return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
      case 'speechSynthesis':
        return 'speechSynthesis' in window;
      case 'indexedDB':
        return 'indexedDB' in window;
      case 'serviceWorker':
        return 'serviceWorker' in navigator;
      case 'mediaDevices':
        return 'mediaDevices' in navigator;
      default:
        return false;
    }
  }

  // Error handling
  static handleError(error, context = '') {
    console.error(`Error in ${context}:`, error);
    
    let message = 'An unexpected error occurred.';
    
    if (error.name === 'NetworkError') {
      message = 'Network connection failed. Please check your internet connection.';
    } else if (error.name === 'NotAllowedError') {
      message = 'Permission denied. Please allow microphone access.';
    } else if (error.message) {
      message = error.message;
    }
    
    this.showToast(message, 'error', 5000);
  }
}

// Make helpers available globally
window.H = HablaBotHelpers;

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = HablaBotHelpers;
}
