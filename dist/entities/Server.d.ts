export = Server;
/**
 * Server entity representing Discord guild configuration and settings
 * Encapsulates server-specific bot configuration and template management
 * @class Server
 * @example
 * const server = new Server('123456789', 'My Discord Server');
 * server.setJailChannel('987654321');
 * server.setModeratorRole('555444333');
 */
declare class Server {
    /**
     * Create Server instance from database data
     * @static
     * @param {Object} data - Database document
     * @returns {Server} Server instance
     * @throws {Error} When data is invalid
     * @example
     * const serverData = await configRepository.findById('123456789');
     * const server = Server.fromDatabase(serverData);
     */
    static fromDatabase(data: any): Server;
    /**
     * Create server instance with Discord guild data
     * @param {string} id - Discord guild ID
     * @param {string} name - Discord guild name
     * @param {Object} [config={}] - Server configuration data
     * @param {string} [config.jailChannelId] - Channel ID for jailed users
     * @param {string} [config.ticketsChannelId] - Channel ID for ticket creation
     * @param {string} [config.moderatorRoleId] - Role ID for moderators
     * @param {string} [config.jailedRoleId] - Role ID for jailed users
     * @param {Object} [config.autoroles={}] - Autorole configuration
     * @param {Object} [config.templates={}] - Server template settings
     * @param {Date} [config.createdAt] - When server config was created
     * @param {Date} [config.updatedAt] - When server config was last updated
     */
    constructor(id: string, name: string, config?: {
        jailChannelId?: string;
        ticketsChannelId?: string;
        moderatorRoleId?: string;
        jailedRoleId?: string;
        autoroles?: any;
        templates?: any;
        createdAt?: Date;
        updatedAt?: Date;
    });
    /**
     * Discord guild ID (primary key)
     * @type {string}
     * @readonly
     */
    readonly id: string;
    /**
     * Discord guild name
     * @type {string}
     */
    name: string;
    /**
     * Server configuration settings
     * @type {Object}
     * @private
     */
    private _config;
    /**
     * Set jail channel ID for jailed users
     * @param {string} channelId - Discord channel ID
     * @throws {Error} When channel ID is invalid
     * @example
     * server.setJailChannel('123456789012345678');
     */
    setJailChannel(channelId: string): void;
    /**
     * Get jail channel ID
     * @returns {string|null} Jail channel ID or null if not set
     * @example
     * const jailChannelId = server.getJailChannel();
     * if (jailChannelId) {
     *   const channel = guild.channels.cache.get(jailChannelId);
     * }
     */
    getJailChannel(): string | null;
    /**
     * Set tickets channel ID for ticket creation
     * @param {string} channelId - Discord channel ID
     * @throws {Error} When channel ID is invalid
     * @example
     * server.setTicketsChannel('123456789012345678');
     */
    setTicketsChannel(channelId: string): void;
    /**
     * Get tickets channel ID
     * @returns {string|null} Tickets channel ID or null if not set
     * @example
     * const ticketsChannelId = server.getTicketsChannel();
     */
    getTicketsChannel(): string | null;
    /**
     * Set moderator role ID
     * @param {string} roleId - Discord role ID
     * @throws {Error} When role ID is invalid
     * @example
     * server.setModeratorRole('123456789012345678');
     */
    setModeratorRole(roleId: string): void;
    /**
     * Get moderator role ID
     * @returns {string|null} Moderator role ID or null if not set
     * @example
     * const modRoleId = server.getModeratorRole();
     */
    getModeratorRole(): string | null;
    /**
     * Set jailed role ID
     * @param {string} roleId - Discord role ID
     * @throws {Error} When role ID is invalid
     * @example
     * server.setJailedRole('123456789012345678');
     */
    setJailedRole(roleId: string): void;
    /**
     * Get jailed role ID
     * @returns {string|null} Jailed role ID or null if not set
     * @example
     * const jailedRoleId = server.getJailedRole();
     */
    getJailedRole(): string | null;
    /**
     * Add autorole configuration
     * @param {string} messageId - Discord message ID with reactions
     * @param {string} emoji - Emoji for reaction role
     * @param {string} roleId - Role ID to assign
     * @throws {Error} When parameters are invalid
     * @example
     * server.addAutorole('123456789', '✅', '987654321');
     */
    addAutorole(messageId: string, emoji: string, roleId: string): void;
    /**
     * Remove autorole configuration
     * @param {string} messageId - Discord message ID
     * @param {string} [emoji] - Specific emoji to remove, or remove all if not specified
     * @example
     * server.removeAutorole('123456789', '✅'); // Remove specific emoji
     * server.removeAutorole('123456789'); // Remove entire message config
     */
    removeAutorole(messageId: string, emoji?: string): void;
    /**
     * Get autorole configuration for message
     * @param {string} messageId - Discord message ID
     * @returns {Object|null} Emoji to role mapping or null if not found
     * @example
     * const autoroles = server.getAutoroles('123456789');
     * if (autoroles && autoroles['✅']) {
     *   const roleId = autoroles['✅'];
     * }
     */
    getAutoroles(messageId: string): any | null;
    /**
     * Get all autorole configurations
     * @returns {Object} Complete autorole configuration
     * @example
     * const allAutoroles = server.getAllAutoroles();
     * for (const [messageId, emojis] of Object.entries(allAutoroles)) {
     *   console.log(`Message ${messageId} has ${Object.keys(emojis).length} autoroles`);
     * }
     */
    getAllAutoroles(): any;
    /**
     * Find role ID by message and emoji
     * @param {string} messageId - Discord message ID
     * @param {string} emoji - Emoji used in reaction
     * @returns {string|null} Role ID or null if not found
     * @example
     * const roleId = server.findAutoroleId('123456789', '✅');
     * if (roleId) {
     *   await member.roles.add(roleId);
     * }
     */
    findAutoroleId(messageId: string, emoji: string): string | null;
    /**
     * Set template configuration
     * @param {string} key - Template setting key
     * @param {*} value - Template setting value
     * @example
     * server.setTemplateSetting('autoBackup', true);
     * server.setTemplateSetting('backupInterval', 24);
     */
    setTemplateSetting(key: string, value: any): void;
    /**
     * Get template configuration
     * @param {string} key - Template setting key
     * @param {*} [defaultValue] - Default value if key not found
     * @returns {*} Template setting value
     * @example
     * const autoBackup = server.getTemplateSetting('autoBackup', false);
     */
    getTemplateSetting(key: string, defaultValue?: any): any;
    /**
     * Get all template settings
     * @returns {Object} Complete template configuration
     * @example
     * const templateConfig = server.getTemplateSettings();
     */
    getTemplateSettings(): any;
    /**
     * Check if server configuration is complete
     * @returns {Object} Validation result with missing configurations
     * @example
     * const validation = server.validateConfiguration();
     * if (!validation.isValid) {
     *   console.log('Missing:', validation.missing.join(', '));
     * }
     */
    validateConfiguration(): any;
    /**
     * Get server configuration summary
     * @returns {Object} Configuration summary
     * @example
     * const summary = server.getConfigSummary();
     * console.log(`Server has ${summary.autorolesCount} autorole messages`);
     */
    getConfigSummary(): any;
    /**
     * Export server data for database storage
     * @returns {Object} Server data suitable for database storage
     * @example
     * const serverData = server.toDatabase();
     * await configRepository.updateById(server.id, serverData);
     */
    toDatabase(): any;
    /**
     * Reset server configuration to defaults
     * @param {boolean} [confirm=false] - Confirmation flag to prevent accidental resets
     * @throws {Error} When confirmation not provided
     * @example
     * server.resetConfiguration(true); // Requires explicit confirmation
     */
    resetConfiguration(confirm?: boolean): void;
    /**
     * Get when server configuration was created
     * @returns {Date} Creation date
     */
    get createdAt(): Date;
    /**
     * Get when server configuration was last updated
     * @returns {Date} Last update date
     */
    get updatedAt(): Date;
    /**
     * Get complete configuration object (read-only)
     * @returns {Object} Complete server configuration
     * @example
     * const config = server.getConfiguration();
     * console.log('Jail Channel:', config.jailChannelId);
     */
    getConfiguration(): any;
}
//# sourceMappingURL=Server.d.ts.map