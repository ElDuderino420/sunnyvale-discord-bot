/**
 * User entity representing Discord user with moderation history and role management
 * Encapsulates user data and provides methods for moderation tracking and role operations
 * @class User
 * @example
 * const user = new User('123456789', 'username#1234');
 * await user.addModerationAction('kick', moderatorId, 'Spam');
 * const history = user.getModerationHistory();
 */
class User {
  /**
   * Create user instance with Discord data
   * @param {string} id - Discord user ID
   * @param {string} tag - Discord user tag (username#discriminator)
   * @param {Object} [data={}] - Additional user data
   * @param {Array<string>} [data.originalRoles=[]] - Roles stored during jail
   * @param {Array<string>} [data.persistentRoles=[]] - Roles stored on server leave
   * @param {Array<Object>} [data.moderationHistory=[]] - User's moderation history
   * @param {Date} [data.createdAt] - When user record was created
   * @param {Date} [data.updatedAt] - When user record was last updated
   */
  constructor(id, tag, data = {}) {
    if (!id || typeof id !== 'string') {
      throw new Error('User ID must be a non-empty string');
    }
    
    if (!tag || typeof tag !== 'string') {
      throw new Error('User tag must be a non-empty string');
    }

    /**
     * Discord user ID (primary key)
     * @type {string}
     * @readonly
     */
    this.id = id;
    
    /**
     * Discord user tag (username#discriminator)
     * @type {string}
     */
    this.tag = tag;
    
    /**
     * User roles stored during jail operation
     * @type {Array<string>}
     * @private
     */
    this._originalRoles = data.originalRoles || [];
    
    /**
     * User roles stored when leaving server (for persistent roles)
     * @type {Array<string>}
     * @private
     */
    this._persistentRoles = data.persistentRoles || [];
    
    /**
     * Complete moderation history for this user
     * @type {Array<ModerationAction>}
     * @private
     */
    this._moderationHistory = data.moderationHistory || [];
    
    /**
     * When user record was created
     * @type {Date}
     * @readonly
     */
    this.createdAt = data.createdAt || new Date();
    
    /**
     * When user record was last updated
     * @type {Date}
     */
    this.updatedAt = data.updatedAt || new Date();
  }

  /**
   * Add moderation action to user history
   * @param {string} action - Type of moderation action (kick, ban, warn, jail, etc.)
   * @param {string} moderatorId - ID of moderator performing action
   * @param {string} reason - Reason for moderation action
   * @param {Date} [timestamp=new Date()] - When action occurred
   * @param {Object} [metadata={}] - Additional action metadata
   * @returns {ModerationAction} Created moderation action
   * @throws {Error} When action type is invalid or required parameters missing
   * @example
   * const action = user.addModerationAction('warn', '987654321', 'Inappropriate language');
   * console.log(`Added ${action.action} by ${action.moderator}`);
   */
  addModerationAction(action, moderatorId, reason, timestamp = new Date(), metadata = {}) {
    if (!action || typeof action !== 'string') {
      throw new Error('Action must be a non-empty string');
    }
    
    if (!moderatorId || typeof moderatorId !== 'string') {
      throw new Error('Moderator ID must be a non-empty string');
    }
    
    if (!reason || typeof reason !== 'string') {
      throw new Error('Reason must be a non-empty string');
    }

    const validActions = ['warn', 'kick', 'ban', 'tempban', 'jail', 'unjail', 'mute', 'unmute'];
    if (!validActions.includes(action.toLowerCase())) {
      throw new Error(`Invalid action type: ${action}. Valid types: ${validActions.join(', ')}`);
    }

    const moderationAction = {
      id: this._generateActionId(),
      action: action.toLowerCase(),
      moderator: moderatorId,
      reason: reason.trim(),
      timestamp: timestamp,
      metadata: metadata || {}
    };

    this._moderationHistory.push(moderationAction);
    this.updatedAt = new Date();

    return moderationAction;
  }

  /**
   * Get complete moderation history
   * @param {string} [actionType] - Filter by specific action type
   * @param {number} [limit] - Limit number of results
   * @returns {Array<ModerationAction>} Moderation history (most recent first)
   * @example
   * const allActions = user.getModerationHistory();
   * const warnings = user.getModerationHistory('warn');
   * const recent = user.getModerationHistory(null, 5);
   */
  getModerationHistory(actionType = null, limit = null) {
    let history = [...this._moderationHistory];
    
    // Filter by action type if specified
    if (actionType) {
      history = history.filter(action => action.action === actionType.toLowerCase());
    }
    
    // Sort by timestamp (most recent first)
    history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Apply limit if specified
    if (limit && typeof limit === 'number' && limit > 0) {
      history = history.slice(0, limit);
    }
    
    return history;
  }

  /**
   * Get moderation statistics summary
   * @returns {Object} Statistics object with counts per action type
   * @example
   * const stats = user.getModerationStats();
   * console.log(`User has ${stats.warn} warnings and ${stats.kick} kicks`);
   */
  getModerationStats() {
    const stats = {
      warn: 0,
      kick: 0,
      ban: 0,
      tempban: 0,
      jail: 0,
      mute: 0,
      total: this._moderationHistory.length
    };

    for (const action of this._moderationHistory) {
      if (stats.hasOwnProperty(action.action)) {
        stats[action.action]++;
      }
    }

    return stats;
  }

  /**
   * Store user roles during jail operation
   * @param {Array<string>} roleIds - Array of Discord role IDs
   * @throws {Error} When roleIds is not a valid array
   * @example
   * user.storeOriginalRoles(['role1', 'role2', 'role3']);
   */
  storeOriginalRoles(roleIds) {
    if (!Array.isArray(roleIds)) {
      throw new Error('Role IDs must be an array');
    }

    this._originalRoles = roleIds.filter(id => typeof id === 'string' && id.length > 0);
    this.updatedAt = new Date();
  }

  /**
   * Get stored original roles from jail operation
   * @returns {Array<string>} Array of role IDs
   * @example
   * const roles = user.getOriginalRoles();
   * if (roles.length > 0) {
   *   await restoreUserRoles(user.id, roles);
   * }
   */
  getOriginalRoles() {
    return [...this._originalRoles];
  }

  /**
   * Clear stored original roles (after successful unjail)
   * @example
   * user.clearOriginalRoles();
   */
  clearOriginalRoles() {
    this._originalRoles = [];
    this.updatedAt = new Date();
  }

  /**
   * Store user roles for persistent role system (on server leave)
   * @param {Array<string>} roleIds - Array of Discord role IDs
   * @throws {Error} When roleIds is not a valid array
   * @example
   * user.storePersistentRoles(['member', 'verified', 'contributor']);
   */
  storePersistentRoles(roleIds) {
    if (!Array.isArray(roleIds)) {
      throw new Error('Role IDs must be an array');
    }

    this._persistentRoles = roleIds.filter(id => typeof id === 'string' && id.length > 0);
    this.updatedAt = new Date();
  }

  /**
   * Get stored persistent roles
   * @returns {Array<string>} Array of role IDs to restore on rejoin
   * @example
   * const roles = user.getPersistentRoles();
   * await restoreUserRoles(user.id, roles);
   */
  getPersistentRoles() {
    return [...this._persistentRoles];
  }

  /**
   * Clear stored persistent roles (after successful restoration)
   * @example
   * user.clearPersistentRoles();
   */
  clearPersistentRoles() {
    this._persistentRoles = [];
    this.updatedAt = new Date();
  }

  /**
   * Check if user is currently jailed (has stored original roles)
   * @returns {boolean} Whether user is jailed
   * @example
   * if (user.isJailed()) {
   *   console.log('User is currently in jail');
   * }
   */
  isJailed() {
    return this._originalRoles.length > 0;
  }

  /**
   * Check if user has persistent roles to restore
   * @returns {boolean} Whether user has roles to restore
   * @example
   * if (user.hasPersistentRoles()) {
   *   await restoreUserRoles(user.id, user.getPersistentRoles());
   * }
   */
  hasPersistentRoles() {
    return this._persistentRoles.length > 0;
  }

  /**
   * Get recent moderation actions count within time period
   * @param {number} hours - Time period in hours to check
   * @param {string} [actionType] - Specific action type to count
   * @returns {number} Count of recent actions
   * @example
   * const recentWarnings = user.getRecentActionsCount(24, 'warn');
   * if (recentWarnings >= 3) {
   *   console.log('User has multiple recent warnings');
   * }
   */
  getRecentActionsCount(hours, actionType = null) {
    if (typeof hours !== 'number' || hours <= 0) {
      throw new Error('Hours must be a positive number');
    }

    const cutoffTime = new Date(Date.now() - (hours * 60 * 60 * 1000));
    
    return this._moderationHistory.filter(action => {
      const actionTime = new Date(action.timestamp);
      const isRecent = actionTime >= cutoffTime;
      const matchesType = !actionType || action.action === actionType.toLowerCase();
      
      return isRecent && matchesType;
    }).length;
  }

  /**
   * Export user data for database storage
   * @returns {Object} User data suitable for database storage
   * @example
   * const userData = user.toDatabase();
   * await userRepository.create(userData);
   */
  toDatabase() {
    return {
      _id: this.id,
      tag: this.tag,
      originalRoles: this._originalRoles,
      persistentRoles: this._persistentRoles,
      moderationHistory: this._moderationHistory,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  /**
   * Create User instance from database data
   * @static
   * @param {Object} data - Database document
   * @returns {User} User instance
   * @throws {Error} When data is invalid
   * @example
   * const userData = await userRepository.findById('123456789');
   * const user = User.fromDatabase(userData);
   */
  static fromDatabase(data) {
    if (!data || !data._id) {
      throw new Error('Invalid user data: missing ID');
    }

    return new User(data._id, data.tag || 'Unknown#0000', {
      originalRoles: data.originalRoles,
      persistentRoles: data.persistentRoles,
      moderationHistory: data.moderationHistory,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt
    });
  }

  /**
   * Generate unique ID for moderation action
   * @private
   * @returns {string} Unique action ID
   */
  _generateActionId() {
    return `${this.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get user display information
   * @returns {Object} Display information
   * @example
   * const info = user.getDisplayInfo();
   * console.log(`${info.tag} (${info.id})`);
   */
  getDisplayInfo() {
    return {
      id: this.id,
      tag: this.tag,
      isJailed: this.isJailed(),
      hasPersistentRoles: this.hasPersistentRoles(),
      moderationCount: this._moderationHistory.length,
      lastAction: this._moderationHistory.length > 0 
        ? this._moderationHistory[this._moderationHistory.length - 1] 
        : null
    };
  }
}

/**
 * @typedef {Object} ModerationAction
 * @property {string} id - Unique action identifier
 * @property {string} action - Type of moderation action
 * @property {string} moderator - ID of moderator who performed action
 * @property {string} reason - Reason for the action
 * @property {Date} timestamp - When action was performed
 * @property {Object} metadata - Additional action metadata
 */

module.exports = User;