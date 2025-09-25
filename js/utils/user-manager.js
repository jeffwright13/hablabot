// HablaBot User Profile Management
class UserManager {
  constructor() {
    this.storageKey = 'hablabot_users';
    this.currentUserKey = 'hablabot_current_user';
    this.users = {};
    this.currentUser = null;
    
    // Default avatars for users
    this.avatars = ['👤', '👩', '👨', '👧', '👦', '🧑', '👩‍🎓', '👨‍🎓', '👩‍💼', '👨‍💼', '🧑‍🎨', '👩‍🔬', '👨‍🔬'];
    
    this.init();
  }

  // Initialize user management
  init() {
    this.loadUsers();
    this.loadCurrentUser();
    console.log('User Manager initialized');
  }

  // Load users from localStorage
  loadUsers() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      this.users = stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error('Failed to load users:', error);
      this.users = {};
    }
  }

  // Save users to localStorage
  saveUsers() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.users));
    } catch (error) {
      console.error('Failed to save users:', error);
    }
  }

  // Load current user from localStorage
  loadCurrentUser() {
    try {
      const userId = localStorage.getItem(this.currentUserKey);
      if (userId && this.users[userId]) {
        this.currentUser = this.users[userId];
      }
    } catch (error) {
      console.error('Failed to load current user:', error);
    }
  }

  // Save current user to localStorage
  saveCurrentUser() {
    try {
      if (this.currentUser) {
        localStorage.setItem(this.currentUserKey, this.currentUser.id);
      }
    } catch (error) {
      console.error('Failed to save current user:', error);
    }
  }

  // Create a new user
  createUser(name, avatar = null) {
    if (!name || name.trim().length === 0) {
      throw new Error('User name is required');
    }

    const cleanName = name.trim();
    const userId = this.generateUserId(cleanName);
    
    // Check if user already exists
    if (this.users[userId]) {
      throw new Error('A user with this name already exists');
    }

    const user = {
      id: userId,
      name: cleanName,
      avatar: avatar || this.getRandomAvatar(),
      createdDate: new Date().toISOString(),
      lastActiveDate: new Date().toISOString(),
      dbPrefix: `${userId}_`,
      settings: {
        language: 'es-ES',
        difficulty: 'beginner',
        sessionLength: 15
      },
      stats: {
        totalSessions: 0,
        totalWords: 0,
        totalMinutes: 0
      }
    };

    this.users[userId] = user;
    this.saveUsers();
    
    console.log('Created new user:', user.name);
    return user;
  }

  // Generate a unique user ID from name
  generateUserId(name) {
    return name.toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .substring(0, 20) + '_' + Date.now().toString(36);
  }

  // Get a random avatar
  getRandomAvatar() {
    return this.avatars[Math.floor(Math.random() * this.avatars.length)];
  }

  // Switch to a different user
  switchUser(userId) {
    if (!this.users[userId]) {
      throw new Error('User not found');
    }

    this.currentUser = this.users[userId];
    this.currentUser.lastActiveDate = new Date().toISOString();
    this.saveUsers();
    this.saveCurrentUser();
    
    console.log('Switched to user:', this.currentUser.name);
    return this.currentUser;
  }

  // Get current user
  getCurrentUser() {
    return this.currentUser;
  }

  // Get all users
  getAllUsers() {
    return Object.values(this.users);
  }

  // Update user profile
  updateUser(userId, updates) {
    if (!this.users[userId]) {
      throw new Error('User not found');
    }

    const user = this.users[userId];
    
    // Update allowed fields
    if (updates.name && updates.name.trim()) {
      user.name = updates.name.trim();
    }
    if (updates.avatar) {
      user.avatar = updates.avatar;
    }
    if (updates.settings) {
      user.settings = { ...user.settings, ...updates.settings };
    }
    if (updates.stats) {
      user.stats = { ...user.stats, ...updates.stats };
    }

    user.lastActiveDate = new Date().toISOString();
    this.saveUsers();

    // Update current user if it's the one being updated
    if (this.currentUser && this.currentUser.id === userId) {
      this.currentUser = user;
    }

    return user;
  }

  // Delete a user
  deleteUser(userId) {
    if (!this.users[userId]) {
      throw new Error('User not found');
    }

    const user = this.users[userId];
    delete this.users[userId];
    this.saveUsers();

    // If deleting current user, clear current user
    if (this.currentUser && this.currentUser.id === userId) {
      this.currentUser = null;
      localStorage.removeItem(this.currentUserKey);
    }

    console.log('Deleted user:', user.name);
    return true;
  }

  // Check if any users exist
  hasUsers() {
    return Object.keys(this.users).length > 0;
  }

  // Check if a user is currently selected
  hasCurrentUser() {
    return this.currentUser !== null;
  }

  // Get database name for current user
  getCurrentUserDbName() {
    if (!this.currentUser) {
      return 'HablaBotDB'; // Default database name
    }
    return `${this.currentUser.dbPrefix}HablaBotDB`;
  }

  // Update user statistics
  updateUserStats(stats) {
    if (!this.currentUser) return;

    const currentStats = this.currentUser.stats;
    const updatedStats = {
      totalSessions: currentStats.totalSessions + (stats.sessions || 0),
      totalWords: currentStats.totalWords + (stats.words || 0),
      totalMinutes: currentStats.totalMinutes + (stats.minutes || 0)
    };

    this.updateUser(this.currentUser.id, { stats: updatedStats });
  }

  // Export user data structure (for debugging)
  exportUserData() {
    return {
      users: this.users,
      currentUser: this.currentUser
    };
  }

  // Import user data (for debugging/migration)
  importUserData(data) {
    if (data.users) {
      this.users = data.users;
      this.saveUsers();
    }
    if (data.currentUser) {
      this.currentUser = data.currentUser;
      this.saveCurrentUser();
    }
  }
}

// Create global instance
window.HablaBotUserManager = new UserManager();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UserManager;
}
