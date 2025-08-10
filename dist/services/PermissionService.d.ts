export = PermissionService;
/**
 * Service for managing permission validation and role-based access control
 * Centralizes permission checking logic for bot commands and operations
 * @class PermissionService
 * @example
 * const permissionService = new PermissionService(configRepo);
 * const canModerate = await permissionService.canModerateUser(member, target);
 */
declare class PermissionService {
    /**
     * Initialize permission service
     * @param {ConfigRepository} configRepository - Server configuration repository
     */
    constructor(configRepository: ConfigRepository);
    /**
     * Configuration repository for server-specific settings
     * @type {ConfigRepository}
     * @private
     */
    private _configRepo;
    /**
     * Cache for permission lookups to improve performance
     * @type {Map<string, Object>}
     * @private
     */
    private _permissionCache;
    /**
     * Cache TTL in milliseconds (5 minutes)
     * @type {number}
     * @private
     */
    private _cacheTTL;
    /**
     * Check if user has Discord permission
     * @param {GuildMember} member - Discord guild member
     * @param {string|Array<string>} permissions - Permission(s) to check
     * @returns {boolean} Whether user has the permission(s)
     * @example
     * const canKick = permissionService.hasDiscordPermission(member, 'KICK_MEMBERS');
     * const canModerate = permissionService.hasDiscordPermission(member, ['KICK_MEMBERS', 'BAN_MEMBERS']);
     */
    hasDiscordPermission(member: GuildMember, permissions: string | Array<string>): boolean;
    /**
     * Check if user has moderator role
     * @param {GuildMember} member - Discord guild member
     * @returns {Promise<boolean>} Whether user has moderator role
     * @throws {Error} When permission check fails
     * @example
     * const isModerator = await permissionService.hasModeratorRole(member);
     * if (isModerator) {
     *   console.log('User can use moderation commands');
     * }
     */
    hasModeratorRole(member: GuildMember): Promise<boolean>;
    /**
     * Check if user can moderate another user (hierarchy check)
     * @param {GuildMember} moderator - Member attempting to moderate
     * @param {GuildMember} target - Member being moderated
     * @returns {boolean} Whether moderation is allowed
     * @example
     * const canModerate = permissionService.canModerateUser(moderator, target);
     * if (!canModerate) {
     *   throw new Error('Cannot moderate user with equal or higher role');
     * }
     */
    canModerateUser(moderator: GuildMember, target: GuildMember): boolean;
    /**
     * Check if bot can moderate user (bot hierarchy check)
     * @param {Guild} guild - Discord guild
     * @param {GuildMember} target - Member being moderated
     * @returns {boolean} Whether bot can moderate the user
     * @example
     * const botCanModerate = permissionService.botCanModerateUser(guild, target);
     * if (!botCanModerate) {
     *   throw new Error('Bot cannot moderate user with higher role');
     * }
     */
    botCanModerateUser(guild: Guild, target: GuildMember): boolean;
    /**
     * Validate command permissions comprehensively
     * @param {CommandInteraction} interaction - Discord command interaction
     * @param {Object} requirements - Permission requirements
     * @param {Array<string>} [requirements.discordPermissions] - Required Discord permissions
     * @param {boolean} [requirements.moderatorRole=false] - Whether moderator role is required
     * @param {boolean} [requirements.checkHierarchy=false] - Whether to check role hierarchy for target
     * @returns {Promise<{allowed: boolean, reason: string|null}>} Validation result
     * @throws {Error} When validation fails
     * @example
     * const validation = await permissionService.validateCommandPermissions(interaction, {
     *   discordPermissions: ['KICK_MEMBERS'],
     *   moderatorRole: true,
     *   checkHierarchy: true
     * });
     *
     * if (!validation.allowed) {
     *   return interaction.reply({ content: validation.reason, ephemeral: true });
     * }
     */
    validateCommandPermissions(interaction: CommandInteraction, requirements?: {
        discordPermissions?: Array<string>;
        moderatorRole?: boolean;
        checkHierarchy?: boolean;
    }): Promise<{
        allowed: boolean;
        reason: string | null;
    }>;
    /**
     * Check if user can access ticket
     * @param {GuildMember} member - Discord guild member
     * @param {Ticket} ticket - Ticket entity
     * @returns {Promise<boolean>} Whether user can access ticket
     * @throws {Error} When permission check fails
     * @example
     * const canAccess = await permissionService.canAccessTicket(member, ticket);
     * if (!canAccess) {
     *   throw new Error('You do not have permission to access this ticket');
     * }
     */
    canAccessTicket(member: GuildMember, ticket: Ticket): Promise<boolean>;
    /**
     * Check if user can manage server configuration
     * @param {GuildMember} member - Discord guild member
     * @returns {boolean} Whether user can manage configuration
     * @example
     * const canManageConfig = permissionService.canManageServerConfig(member);
     * if (!canManageConfig) {
     *   throw new Error('You do not have permission to manage server configuration');
     * }
     */
    canManageServerConfig(member: GuildMember): boolean;
    /**
     * Get permission level for user
     * @param {GuildMember} member - Discord guild member
     * @returns {Promise<string>} Permission level (owner, admin, moderator, member)
     * @throws {Error} When permission check fails
     * @example
     * const level = await permissionService.getPermissionLevel(member);
     * console.log(`User permission level: ${level}`);
     */
    getPermissionLevel(member: GuildMember): Promise<string>;
    /**
     * Check if user can use autorole system
     * @param {GuildMember} member - Discord guild member
     * @returns {Promise<boolean>} Whether user can manage autoroles
     * @throws {Error} When permission check fails
     * @example
     * const canManageAutoroles = await permissionService.canManageAutoroles(member);
     */
    canManageAutoroles(member: GuildMember): Promise<boolean>;
    /**
     * Check if user can manage templates
     * @param {GuildMember} member - Discord guild member
     * @returns {boolean} Whether user can manage templates
     * @example
     * const canManageTemplates = permissionService.canManageTemplates(member);
     */
    canManageTemplates(member: GuildMember): boolean;
    /**
     * Get cached permission result
     * @private
     * @param {string} key - Cache key
     * @returns {*|null} Cached value or null if expired/not found
     */
    private _getFromCache;
    /**
     * Set permission result in cache
     * @private
     * @param {string} key - Cache key
     * @param {*} value - Value to cache
     */
    private _setCache;
    /**
     * Clean up expired cache entries
     * @private
     */
    private _cleanupCache;
    /**
     * Clear permission cache
     * @param {string} [guildId] - Specific guild to clear (all if not specified)
     * @example
     * permissionService.clearCache('123456789'); // Clear cache for specific guild
     * permissionService.clearCache(); // Clear all cache
     */
    clearCache(guildId?: string): void;
    /**
     * Get cache statistics
     * @returns {Object} Cache statistics
     * @example
     * const stats = permissionService.getCacheStats();
     * console.log(`Cache hit rate: ${stats.hitRate}%`);
     */
    getCacheStats(): any;
}
//# sourceMappingURL=PermissionService.d.ts.map