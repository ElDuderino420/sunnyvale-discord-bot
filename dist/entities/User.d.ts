export = User;
/**
 * User entity representing Discord user with moderation history and role management
 * Encapsulates user data and provides methods for moderation tracking and role operations
 * @class User
 * @example
 * const user = new User('123456789', 'username#1234');
 * await user.addModerationAction('kick', moderatorId, 'Spam');
 * const history = user.getModerationHistory();
 */
declare class User {
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
    static fromDatabase(data: any): User;
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
    constructor(id: string, tag: string, data?: {
        originalRoles?: Array<string>;
        persistentRoles?: Array<string>;
        moderationHistory?: Array<any>;
        createdAt?: Date;
        updatedAt?: Date;
    });
    /**
     * Discord user ID (primary key)
     * @type {string}
     * @readonly
     */
    readonly id: string;
    /**
     * Discord user tag (username#discriminator)
     * @type {string}
     */
    tag: string;
    /**
     * User roles stored during jail operation
     * @type {Array<string>}
     * @private
     */
    private _originalRoles;
    /**
     * User roles stored when leaving server (for persistent roles)
     * @type {Array<string>}
     * @private
     */
    private _persistentRoles;
    /**
     * Complete moderation history for this user
     * @type {Array<ModerationAction>}
     * @private
     */
    private _moderationHistory;
    /**
     * When user record was created
     * @type {Date}
     * @readonly
     */
    readonly createdAt: Date;
    /**
     * When user record was last updated
     * @type {Date}
     */
    updatedAt: Date;
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
    addModerationAction(action: string, moderatorId: string, reason: string, timestamp?: Date, metadata?: any): ModerationAction;
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
    getModerationHistory(actionType?: string, limit?: number): Array<ModerationAction>;
    /**
     * Get moderation statistics summary
     * @returns {Object} Statistics object with counts per action type
     * @example
     * const stats = user.getModerationStats();
     * console.log(`User has ${stats.warn} warnings and ${stats.kick} kicks`);
     */
    getModerationStats(): any;
    /**
     * Store user roles during jail operation
     * @param {Array<string>} roleIds - Array of Discord role IDs
     * @throws {Error} When roleIds is not a valid array
     * @example
     * user.storeOriginalRoles(['role1', 'role2', 'role3']);
     */
    storeOriginalRoles(roleIds: Array<string>): void;
    /**
     * Get stored original roles from jail operation
     * @returns {Array<string>} Array of role IDs
     * @example
     * const roles = user.getOriginalRoles();
     * if (roles.length > 0) {
     *   await restoreUserRoles(user.id, roles);
     * }
     */
    getOriginalRoles(): Array<string>;
    /**
     * Clear stored original roles (after successful unjail)
     * @example
     * user.clearOriginalRoles();
     */
    clearOriginalRoles(): void;
    /**
     * Store user roles for persistent role system (on server leave)
     * @param {Array<string>} roleIds - Array of Discord role IDs
     * @throws {Error} When roleIds is not a valid array
     * @example
     * user.storePersistentRoles(['member', 'verified', 'contributor']);
     */
    storePersistentRoles(roleIds: Array<string>): void;
    /**
     * Get stored persistent roles
     * @returns {Array<string>} Array of role IDs to restore on rejoin
     * @example
     * const roles = user.getPersistentRoles();
     * await restoreUserRoles(user.id, roles);
     */
    getPersistentRoles(): Array<string>;
    /**
     * Clear stored persistent roles (after successful restoration)
     * @example
     * user.clearPersistentRoles();
     */
    clearPersistentRoles(): void;
    /**
     * Check if user is currently jailed (has stored original roles)
     * @returns {boolean} Whether user is jailed
     * @example
     * if (user.isJailed()) {
     *   console.log('User is currently in jail');
     * }
     */
    isJailed(): boolean;
    /**
     * Check if user has persistent roles to restore
     * @returns {boolean} Whether user has roles to restore
     * @example
     * if (user.hasPersistentRoles()) {
     *   await restoreUserRoles(user.id, user.getPersistentRoles());
     * }
     */
    hasPersistentRoles(): boolean;
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
    getRecentActionsCount(hours: number, actionType?: string): number;
    /**
     * Export user data for database storage
     * @returns {Object} User data suitable for database storage
     * @example
     * const userData = user.toDatabase();
     * await userRepository.create(userData);
     */
    toDatabase(): any;
    /**
     * Generate unique ID for moderation action
     * @private
     * @returns {string} Unique action ID
     */
    private _generateActionId;
    /**
     * Get user display information
     * @returns {Object} Display information
     * @example
     * const info = user.getDisplayInfo();
     * console.log(`${info.tag} (${info.id})`);
     */
    getDisplayInfo(): any;
}
declare namespace User {
    export { ModerationAction };
}
type ModerationAction = {
    /**
     * - Unique action identifier
     */
    id: string;
    /**
     * - Type of moderation action
     */
    action: string;
    /**
     * - ID of moderator who performed action
     */
    moderator: string;
    /**
     * - Reason for the action
     */
    reason: string;
    /**
     * - When action was performed
     */
    timestamp: Date;
    /**
     * - Additional action metadata
     */
    metadata: any;
};
//# sourceMappingURL=User.d.ts.map