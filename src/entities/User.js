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
     * Staff-only notes for this user
     * @type {Array<StaffNote>}
     * @private
     */
    this._staffNotes = Array.isArray(data.staffNotes)
      ? data.staffNotes
        .map(note => this._normalizeExistingStaffNote(note))
        .filter(note => note !== null)
      : [];
    
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
   * Convenience helper to add a warn moderation action
   * @param {string} moderatorId - ID of moderator performing the warn
   * @param {string} reason - Reason for the warning
   * @param {Date} [timestamp=new Date()] - When the warning occurred
   * @param {Object} [metadata={}] - Additional metadata for the warning
   * @returns {ModerationAction} Created moderation action
   */
  addWarning(moderatorId, reason, timestamp = new Date(), metadata = {}) {
    return this.addModerationAction('warn', moderatorId, reason, timestamp, metadata);
  }

  /**
   * Get warnings for the user
   * @param {number|null} [limit=null] - Limit number of warnings returned
   * @returns {Array<ModerationAction>} Warning history (most recent first)
   */
  getWarnings(limit = null) {
    return this.getModerationHistory('warn', limit);
  }

  /**
   * Add staff-only note for this user
   * @param {string} moderatorId - Moderator ID adding the note
   * @param {string} content - Note content
   * @param {Date} [timestamp=new Date()] - When the note was created
   * @param {Object} [metadata={}] - Optional metadata for the note
   * @returns {StaffNote} Created staff note
   */
  addStaffNote(moderatorId, content, timestamp = new Date(), metadata = {}) {
    if (!moderatorId || typeof moderatorId !== 'string') {
      throw new Error('Moderator ID must be a non-empty string');
    }

    if (!content || typeof content !== 'string') {
      throw new Error('Note content must be a non-empty string');
    }

    const trimmedContent = content.trim();
    if (trimmedContent.length === 0) {
      throw new Error('Note content must be a non-empty string');
    }

    if (trimmedContent.length > 2000) {
      throw new Error('Note content cannot exceed 2000 characters');
    }

    const timestampValue = timestamp instanceof Date ? timestamp : new Date(timestamp);
    if (Number.isNaN(timestampValue.getTime())) {
      throw new Error('Invalid timestamp provided for staff note');
    }

    const sanitizedMetadata = metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? { ...metadata }
      : {};

    const noteEntry = {
      id: this._generateStaffNoteId(),
      moderator: moderatorId.trim(),
      content: trimmedContent,
      timestamp: timestampValue,
      metadata: sanitizedMetadata
    };

    this._staffNotes.push(noteEntry);
    this.updatedAt = new Date();

    return this._cloneStaffNote(noteEntry);
  }

  /**
   * Get staff notes for this user
   * @param {number|null} [limit=null] - Limit number of notes returned
   * @returns {Array<StaffNote>} Staff notes sorted by newest first
   */
  getStaffNotes(limit = null) {
    let notes = [...this._staffNotes];

    notes.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    if (Number.isInteger(limit) && limit > 0) {
      notes = notes.slice(0, limit);
    }

    return notes.map(note => this._cloneStaffNote(note));
  }

  /**
   * Find a specific staff note by ID
   * @param {string} noteId - Staff note identifier
   * @returns {StaffNote|null} Staff note if found, otherwise null
   */
  getStaffNote(noteId) {
    if (!noteId || typeof noteId !== 'string') {
      return null;
    }

    const note = this._staffNotes.find(entry => entry.id === noteId);
    return note ? this._cloneStaffNote(note) : null;
  }

  /**
   * Remove a staff note by ID
   * @param {string} noteId - Staff note identifier
   * @returns {boolean} Whether a note was removed
   */
  removeStaffNote(noteId) {
    if (!noteId || typeof noteId !== 'string') {
      return false;
    }

    const index = this._staffNotes.findIndex(entry => entry.id === noteId);
    if (index === -1) {
      return false;
    }

    this._staffNotes.splice(index, 1);
    this.updatedAt = new Date();

    return true;
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
      staffNotes: this._staffNotes.map(note => ({
        id: note.id,
        moderator: note.moderator,
        content: note.content,
        timestamp: note.timestamp instanceof Date ? new Date(note.timestamp.getTime()) : new Date(note.timestamp),
        metadata: note.metadata && typeof note.metadata === 'object' && !Array.isArray(note.metadata)
          ? { ...note.metadata }
          : {}
      })),
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
      staffNotes: data.staffNotes,
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
   * Generate unique ID for staff notes
   * @private
   * @returns {string} Unique staff note identifier
   */
  _generateStaffNoteId() {
    return `${this.id}-note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * Normalize staff note loaded from persistence
   * @private
   * @param {Object} note - Raw staff note data
   * @returns {StaffNote|null} Normalized staff note or null if invalid
   */
  _normalizeExistingStaffNote(note) {
    if (!note || typeof note !== 'object') {
      return null;
    }

    const moderator = typeof note.moderator === 'string' ? note.moderator.trim() : '';
    const content = typeof note.content === 'string' ? note.content.trim() : '';

    if (!moderator || !content) {
      return null;
    }

    const timestamp = note.timestamp instanceof Date ? note.timestamp : new Date(note.timestamp);
    if (Number.isNaN(timestamp.getTime())) {
      return null;
    }

    const metadata = note.metadata && typeof note.metadata === 'object' && !Array.isArray(note.metadata)
      ? { ...note.metadata }
      : {};

    const id = typeof note.id === 'string' && note.id.trim().length > 0
      ? note.id.trim()
      : this._generateStaffNoteId();

    return {
      id,
      moderator,
      content,
      timestamp,
      metadata
    };
  }

  /**
   * Clone staff note entry to prevent external mutation
   * @private
   * @param {StaffNote} note - Staff note entry
   * @returns {StaffNote} Cloned staff note
   */
  _cloneStaffNote(note) {
    return {
      id: note.id,
      moderator: note.moderator,
      content: note.content,
      timestamp: new Date(note.timestamp),
      metadata: note.metadata && typeof note.metadata === 'object' && !Array.isArray(note.metadata)
        ? { ...note.metadata }
        : {}
    };
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
      staffNoteCount: this._staffNotes.length,
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

/**
 * @typedef {Object} StaffNote
 * @property {string} id - Unique staff note identifier
 * @property {string} moderator - ID of moderator who created the note
 * @property {string} content - Staff note content
 * @property {Date} timestamp - When the note was created
 * @property {Object} metadata - Additional staff note metadata
 */

module.exports = User;