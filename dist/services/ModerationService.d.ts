export = ModerationService;
/**
 * Service for handling user moderation operations
 * Provides comprehensive moderation capabilities with validation and audit logging
 * @class ModerationService
 * @example
 * const moderationService = new ModerationService(userRepo, configRepo, permissionService);
 * await moderationService.kickUser(interaction, targetUser, 'Violation of rules');
 */
declare class ModerationService {
    /**
     * Initialize moderation service
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
     * Active temporary bans with expiration timers
     * @type {Map<string, NodeJS.Timeout>}
     * @private
     */
    private _tempbanTimers;
    /**
     * Moderation action metadata cache
     * @type {Map<string, Object>}
     * @private
     */
    private _actionCache;
    /**
     * Kick user from server with moderation logging
     * @param {CommandInteraction} interaction - Discord command interaction
     * @param {GuildMember} targetMember - Member to kick
     * @param {string} [reason='No reason provided'] - Kick reason
     * @returns {Promise<Object>} Operation result with success status and details
     * @throws {Error} When kick operation fails
     * @example
     * const result = await moderationService.kickUser(interaction, targetMember, 'Spamming');
     * if (result.success) {
     *   console.log(`User kicked: ${result.user.tag}`);
     * }
     */
    kickUser(interaction: CommandInteraction, targetMember: GuildMember, reason?: string): Promise<any>;
    /**
     * Ban user from server with optional cleanup and logging
     * @param {CommandInteraction} interaction - Discord command interaction
     * @param {GuildMember|User} target - Member or user to ban
     * @param {string} [reason='No reason provided'] - Ban reason
     * @param {number} [deleteMessageDays=0] - Days of messages to delete (0-7)
     * @returns {Promise<Object>} Operation result with success status and details
     * @throws {Error} When ban operation fails
     * @example
     * const result = await moderationService.banUser(interaction, targetMember, 'Harassment', 1);
     * if (result.success) {
     *   console.log(`User banned: ${result.user.tag}`);
     * }
     */
    banUser(interaction: CommandInteraction, target: GuildMember | import("../entities/User"), reason?: string, deleteMessageDays?: number): Promise<any>;
    /**
     * Temporarily ban user with automatic expiration
     * @param {CommandInteraction} interaction - Discord command interaction
     * @param {GuildMember|User} target - Member or user to temporarily ban
     * @param {number} durationMs - Ban duration in milliseconds
     * @param {string} [reason='No reason provided'] - Ban reason
     * @param {number} [deleteMessageDays=0] - Days of messages to delete (0-7)
     * @returns {Promise<Object>} Operation result with success status and expiration details
     * @throws {Error} When tempban operation fails
     * @example
     * const result = await moderationService.tempbanUser(interaction, targetMember, 86400000, 'Toxicity', 1);
     * if (result.success) {
     *   console.log(`User tempbanned until: ${result.expiresAt}`);
     * }
     */
    tempbanUser(interaction: CommandInteraction, target: GuildMember | User, durationMs: number, reason?: string, deleteMessageDays?: number): Promise<any>;
    /**
     * Check if user is currently jailed
     * @param {string} guildId - Discord guild ID
     * @param {string} userId - Discord user ID
     * @returns {Promise<boolean>} Whether user is jailed
     * @throws {Error} When check fails
     * @example
     * const isJailed = await moderationService.isUserJailed('123456789', '987654321');
     * if (isJailed) {
     *   console.log('User is currently jailed');
     * }
     */
    isUserJailed(guildId: string, userId: string): Promise<boolean>;
    /**
     * Validate jail operation before execution
     * @param {string} guildId - Discord guild ID
     * @param {string} executorId - Moderator user ID
     * @param {string} targetId - Target user ID
     * @param {string} reason - Jail reason
     * @returns {Promise<Object>} Validation result with success status
     * @throws {Error} When validation fails
     * @example
     * const validation = await moderationService.validateJail('123456789', '111', '222', 'Spam');
     * if (!validation.isValid) {
     *   console.log('Cannot jail:', validation.error);
     * }
     */
    validateJail(guildId: string, executorId: string, targetId: string, reason: string): Promise<any>;
    /**
     * Jail user by removing roles and restricting to jail channel
     * @param {string} guildId - Discord guild ID
     * @param {string} executorId - Moderator user ID
     * @param {string} targetId - Target user ID
     * @param {string} [reason='No reason provided'] - Jail reason
     * @param {number} [durationMs] - Optional jail duration in milliseconds
     * @returns {Promise<Object>} Operation result with success status and role backup details
     * @throws {Error} When jail operation fails
     * @example
     * const result = await moderationService.jailUser('123456789', '111', '222', 'Rule violation');
     * if (result.success) {
     *   console.log(`User jailed with ${result.rolesBackedUp} roles backed up`);
     * }
     */
    jailUser(guildId: string, executorId: string, targetId: string, reason?: string, durationMs?: number, rolesToBackup?: any[]): Promise<any>;
    /**
     * Unjail user by restoring their original roles
     * @param {CommandInteraction} interaction - Discord command interaction
     * @param {GuildMember} targetMember - Member to unjail
     * @param {string} [reason='Released from jail'] - Unjail reason
     * @returns {Promise<Object>} Operation result with success status and restored roles count
     * @throws {Error} When unjail operation fails
     * @example
     * const result = await moderationService.unjailUser(interaction, targetMember, 'Appeal approved');
     * if (result.success) {
     *   console.log(`User unjailed with ${result.rolesRestored} roles restored`);
     * }
     */
    unjailUser(interaction: CommandInteraction, targetMember: GuildMember, reason?: string): Promise<any>;
    /**
     * Unban user from server
     * @param {CommandInteraction} interaction - Discord command interaction
     * @param {string} userId - Discord user ID to unban
     * @param {string} [reason='Unbanned by moderator'] - Unban reason
     * @returns {Promise<Object>} Operation result with success status and details
     * @throws {Error} When unban operation fails
     * @example
     * const result = await moderationService.unbanUser(interaction, '123456789', 'Appeal accepted');
     * if (result.success) {
     *   console.log(`User unbanned: ${result.user.tag}`);
     * }
     */
    unbanUser(interaction: CommandInteraction, userId: string, reason?: string): Promise<any>;
    /**
     * Get user's moderation history and statistics
     * @param {string} userId - Discord user ID
     * @param {number} [days] - Days to look back (all time if not specified)
     * @returns {Promise<Object>} User moderation summary with history and statistics
     * @throws {Error} When retrieval fails
     * @example
     * const history = await moderationService.getUserModerationHistory('123456789', 30);
     * console.log(`User has ${history.totalActions} actions in the last 30 days`);
     */
    getUserModerationHistory(userId: string, days?: number): Promise<any>;
    /**
     * Get moderation statistics for the server
     * @param {string} guildId - Discord guild ID
     * @param {number} [days=30] - Days to include in statistics
     * @returns {Promise<Object>} Server moderation statistics summary
     * @throws {Error} When statistics calculation fails
     * @example
     * const stats = await moderationService.getServerModerationStats('123456789', 7);
     * console.log(`${stats.totalActions} moderation actions this week`);
     */
    getServerModerationStats(guildId: string, days?: number): Promise<any>;
    /**
     * Get cached moderation action details
     * @param {string} actionId - Action identifier
     * @returns {Object|null} Cached action details or null if not found
     * @example
     * const action = moderationService.getCachedAction('kick_1234567890_123456789');
     * if (action) {
     *   console.log(`Action: ${action.action} by ${action.moderator}`);
     * }
     */
    getCachedAction(actionId: string): any | null;
    /**
     * Clear expired cached actions
     * @param {number} [maxAge=86400000] - Maximum age in milliseconds (24 hours default)
     * @returns {number} Number of actions cleared
     * @example
     * const cleared = moderationService.clearExpiredCache(3600000); // 1 hour
     * console.log(`Cleared ${cleared} expired cached actions`);
     */
    clearExpiredCache(maxAge?: number): number;
    /**
     * Initialize tempban timers on service startup
     * @param {string} guildId - Discord guild ID
     * @returns {Promise<number>} Number of timers restored
     * @throws {Error} When timer restoration fails
     * @example
     * const restored = await moderationService.restoreTempbanTimers('123456789');
     * console.log(`Restored ${restored} tempban timers`);
     */
    restoreTempbanTimers(guildId: string): Promise<number>;
    /**
     * Perform automatic unban for expired tempbans
     * @private
     * @param {string} guildId - Discord guild ID
     * @param {string} userId - User ID to unban
     * @param {string} reason - Unban reason
     * @returns {Promise<void>}
     */
    private _automaticUnban;
}
//# sourceMappingURL=ModerationService.d.ts.map