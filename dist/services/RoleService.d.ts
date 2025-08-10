export = RoleService;
/**
 * Service for managing role operations and persistent role system
 * Handles role assignment, persistent roles, autoroles, and role hierarchy management
 * @class RoleService
 * @example
 * const roleService = new RoleService(userRepo, configRepo, permissionService);
 * await roleService.assignPersistentRole(member, roleId);
 */
declare class RoleService {
    /**
     * Initialize role service
     * @param {UserRepository} userRepository - User data repository
     * @param {ConfigRepository} configRepository - Server configuration repository
     * @param {PermissionService} permissionService - Permission validation service
     */
    constructor(userRepository: UserRepository, configRepository: ConfigRepository, permissionService: PermissionService);
    /**
     * User repository for data persistence
     * @type {UserRepository}
     * @private
     */
    private _userRepo;
    /**
     * Configuration repository for server settings
     * @type {ConfigRepository}
     * @private
     */
    private _configRepo;
    /**
     * Permission service for validation
     * @type {PermissionService}
     * @private
     */
    private _permissionService;
    /**
     * Cache for role hierarchy and permissions
     * @type {Map<string, Object>}
     * @private
     */
    private _roleCache;
    /**
     * Active autorole message tracking
     * @type {Map<string, Object>}
     * @private
     */
    private _autoroleMessages;
    /**
     * Rate limiting for role operations
     * @type {Map<string, number>}
     * @private
     */
    private _operationLimits;
    /**
     * Assign persistent role to user that will be restored on rejoin
     * @param {GuildMember} member - Discord guild member
     * @param {string} roleId - Role ID to assign persistently
     * @param {string} [reason='Persistent role assigned'] - Assignment reason
     * @returns {Promise<Object>} Operation result with role assignment details
     * @throws {Error} When persistent role assignment fails
     * @example
     * const result = await roleService.assignPersistentRole(member, '123456789', 'VIP role');
     * if (result.success) {
     *   console.log(`Persistent role assigned: ${result.role.name}`);
     * }
     */
    assignPersistentRole(member: GuildMember, roleId: string, reason?: string): Promise<any>;
    /**
     * Remove persistent role from user
     * @param {GuildMember} member - Discord guild member
     * @param {string} roleId - Role ID to remove from persistent list
     * @param {boolean} [removeFromMember=false] - Whether to also remove role from member
     * @param {string} [reason='Persistent role removed'] - Removal reason
     * @returns {Promise<Object>} Operation result with removal details
     * @throws {Error} When persistent role removal fails
     * @example
     * const result = await roleService.removePersistentRole(member, '123456789', true, 'No longer VIP');
     * if (result.success) {
     *   console.log(`Persistent role removed: ${result.role.name}`);
     * }
     */
    removePersistentRole(member: GuildMember, roleId: string, removeFromMember?: boolean, reason?: string): Promise<any>;
    /**
     * Restore persistent roles for user (typically on rejoin)
     * @param {GuildMember} member - Discord guild member who rejoined
     * @returns {Promise<Object>} Restoration result with details of restored roles
     * @throws {Error} When role restoration fails
     * @example
     * const result = await roleService.restorePersistentRoles(member);
     * if (result.success) {
     *   console.log(`Restored ${result.rolesRestored} persistent roles`);
     * }
     */
    restorePersistentRoles(member: GuildMember): Promise<any>;
    /**
     * Store roles as persistent when user leaves server
     * @param {string} userId - Discord user ID who left
     * @param {string} guildId - Discord guild ID
     * @param {Array<string>} roleIds - Role IDs to store as persistent
     * @returns {Promise<Object>} Storage result with stored role details
     * @throws {Error} When role storage fails
     * @example
     * const result = await roleService.storeRolesOnLeave('123456789', '987654321', ['111', '222']);
     * if (result.success) {
     *   console.log(`Stored ${result.rolesStored} roles as persistent`);
     * }
     */
    storeRolesOnLeave(userId: string, guildId: string, roleIds: Array<string>): Promise<any>;
    /**
     * Setup autorole message with reaction-role mappings
     * @param {CommandInteraction} interaction - Discord command interaction
     * @param {string} channelId - Channel ID for autorole message
     * @param {string} title - Autorole message title
     * @param {string} description - Autorole message description
     * @param {Array<Object>} roleMappings - Array of {emoji, roleId, description} objects
     * @returns {Promise<Object>} Setup result with message and mapping details
     * @throws {Error} When autorole setup fails
     * @example
     * const result = await roleService.setupAutoroleMessage(interaction, '123456789', 'Choose Your Roles', 'React to get roles', [
     *   { emoji: '🎮', roleId: '111111111', description: 'Gamer' },
     *   { emoji: '📚', roleId: '222222222', description: 'Reader' }
     * ]);
     */
    setupAutoroleMessage(interaction: CommandInteraction, channelId: string, title: string, description: string, roleMappings: Array<any>): Promise<any>;
    /**
     * Handle autorole reaction (add or remove role)
     * @param {MessageReaction} reaction - Discord message reaction
     * @param {User} user - User who reacted
     * @param {boolean} added - Whether reaction was added (true) or removed (false)
     * @returns {Promise<Object>} Reaction handling result
     * @throws {Error} When autorole reaction handling fails
     * @example
     * const result = await roleService.handleAutoroleReaction(reaction, user, true);
     * if (result.success) {
     *   console.log(`Role ${result.action}: ${result.role.name}`);
     * }
     */
    handleAutoroleReaction(reaction: MessageReaction, user: User, added: boolean): Promise<any>;
    /**
     * Get role hierarchy information for server
     * @param {string} guildId - Discord guild ID
     * @param {boolean} [useCache=true] - Whether to use cached data
     * @returns {Promise<Object>} Role hierarchy and permission information
     * @throws {Error} When hierarchy retrieval fails
     * @example
     * const hierarchy = await roleService.getRoleHierarchy('123456789');
     * console.log(`Server has ${hierarchy.totalRoles} roles`);
     */
    getRoleHierarchy(guildId: string, useCache?: boolean): Promise<any>;
    /**
     * Get persistent roles statistics for server
     * @param {string} guildId - Discord guild ID
     * @returns {Promise<Object>} Persistent roles statistics
     * @throws {Error} When statistics calculation fails
     * @example
     * const stats = await roleService.getPersistentRoleStats('123456789');
     * console.log(`${stats.usersWithPersistentRoles} users have persistent roles`);
     */
    getPersistentRoleStats(guildId: string): Promise<any>;
    /**
     * Get autorole statistics for server
     * @param {string} guildId - Discord guild ID
     * @returns {Promise<Object>} Autorole statistics and configuration
     * @throws {Error} When statistics calculation fails
     * @example
     * const stats = await roleService.getAutoroleStats('123456789');
     * console.log(`${stats.totalAutoroleMessages} autorole messages configured`);
     */
    getAutoroleStats(guildId: string): Promise<any>;
    /**
     * Clean up expired operation limits
     * @param {number} [maxAge=300000] - Maximum age in milliseconds (5 minutes default)
     * @returns {number} Number of limits cleared
     * @example
     * const cleared = roleService.clearExpiredLimits();
     * console.log(`Cleared ${cleared} expired operation limits`);
     */
    clearExpiredLimits(maxAge?: number): number;
    /**
     * Clear role cache for guild
     * @param {string} guildId - Discord guild ID
     * @returns {number} Number of cache entries cleared
     * @example
     * const cleared = roleService.clearRoleCache('123456789');
     * console.log(`Cleared ${cleared} cached role entries`);
     */
    clearRoleCache(guildId: string): number;
    /**
     * Initialize autorole message cache from database
     * @param {string} guildId - Discord guild ID
     * @returns {Promise<number>} Number of autorole messages cached
     * @throws {Error} When cache initialization fails
     * @example
     * const cached = await roleService.initializeAutoroleCache('123456789');
     * console.log(`Initialized ${cached} autorole messages in cache`);
     */
    initializeAutoroleCache(guildId: string): Promise<number>;
    /**
     * Create basic autorole message without roles (to be added later)
     * @param {string} guildId - Discord guild ID
     * @param {string} channelId - Channel ID for the message
     * @param {string} creatorId - User ID of creator
     * @param {string} title - Message title
     * @param {string} description - Message description
     * @returns {Promise<Object>} Creation result with message ID
     * @throws {Error} When creation fails
     */
    createAutoRoleMessage(guildId: string, channelId: string, creatorId: string, title: string, description: string): Promise<any>;
    /**
     * Add role to existing autorole message
     * @param {string} messageId - Discord message ID
     * @param {string} roleId - Role ID to add
     * @param {string} emoji - Emoji for the role
     * @param {string} [description] - Role description
     * @returns {Promise<Object>} Addition result
     * @throws {Error} When addition fails
     */
    addRoleToAutoRoleMessage(messageId: string, roleId: string, emoji: string, description?: string): Promise<any>;
    /**
     * Remove role from autorole message
     * @param {string} messageId - Discord message ID
     * @param {string} roleId - Role ID to remove
     * @returns {Promise<Object>} Removal result
     * @throws {Error} When removal fails
     */
    removeRoleFromAutoRoleMessage(messageId: string, roleId: string): Promise<any>;
    /**
     * Get all autorole messages for a guild
     * @param {string} guildId - Discord guild ID
     * @returns {Promise<Array>} List of autorole messages
     * @throws {Error} When retrieval fails
     */
    getAutoRoleMessages(guildId: string): Promise<any[]>;
    /**
     * Handle reaction add events (called by CommandHandler)
     * @param {MessageReaction} reaction - Discord message reaction
     * @param {User} user - User who added the reaction
     * @returns {Promise<Object>} Reaction handling result
     * @example
     * const result = await roleService.handleReactionAdd(reaction, user);
     * if (result.success) {
     *   console.log(`Role added: ${result.role.name}`);
     * }
     */
    handleReactionAdd(reaction: MessageReaction, user: User): Promise<any>;
    /**
     * Handle reaction remove events (called by CommandHandler)
     * @param {MessageReaction} reaction - Discord message reaction
     * @param {User} user - User who removed the reaction
     * @returns {Promise<Object>} Reaction handling result
     * @example
     * const result = await roleService.handleReactionRemove(reaction, user);
     * if (result.success) {
     *   console.log(`Role removed: ${result.role.name}`);
     * }
     */
    handleReactionRemove(reaction: MessageReaction, user: User): Promise<any>;
    /**
     * Save persistent roles when member leaves server
     * @param {string} guildId - Discord guild ID
     * @param {string} userId - User ID who left
     * @param {Collection} roleCollection - Discord role collection
     * @returns {Promise<Object>} Storage result
     * @example
     * const result = await roleService.savePersistentRoles(guildId, userId, member.roles.cache);
     */
    savePersistentRoles(guildId: string, userId: string, roleCollection: Collection): Promise<any>;
    /**
     * Update message ID for autorole configuration (internal helper)
     * @private
     * @param {string} tempMessageId - Temporary message ID
     * @param {string} realMessageId - Real Discord message ID
     * @returns {Promise<void>}
     */
    private _updateMessageId;
}
//# sourceMappingURL=RoleService.d.ts.map