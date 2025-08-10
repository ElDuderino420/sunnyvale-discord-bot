export = ConfigRepository;
/**
 * Repository for server configuration data persistence
 * Handles server-specific configuration with Server entity integration
 * @class ConfigRepository
 * @extends {BaseRepository}
 * @example
 * const configRepo = new ConfigRepository(dbManager);
 * const serverConfig = await configRepo.findServerById('123456789');
 * await configRepo.saveServer(serverConfig);
 */
declare class ConfigRepository extends BaseRepository {
    /**
     * Initialize configuration repository
     * @param {DatabaseManager} dbManager - Database connection manager
     */
    constructor(dbManager: DatabaseManager);
    /**
     * Find server configuration by guild ID and return Server entity
     * @param {string} guildId - Discord guild ID
     * @returns {Promise<Server|null>} Server entity or null if not found
     * @throws {Error} When database operation fails
     * @example
     * const server = await configRepo.findServerById('123456789');
     * if (server) {
     *   console.log(`Found server: ${server.name}`);
     * }
     */
    findServerById(guildId: string): Promise<Server | null>;
    /**
     * Create or update server configuration
     * @param {Server} server - Server entity to save
     * @returns {Promise<Server>} Saved server entity
     * @throws {Error} When save operation fails
     * @example
     * const server = new Server('123456789', 'My Discord Server');
     * server.setJailChannel('987654321');
     * const savedServer = await configRepo.saveServer(server);
     */
    saveServer(server: Server): Promise<Server>;
    /**
     * Get or create server configuration with defaults
     * @param {string} guildId - Discord guild ID
     * @param {string} guildName - Discord guild name
     * @returns {Promise<Server>} Server entity (existing or newly created)
     * @throws {Error} When operation fails
     * @example
     * const server = await configRepo.getOrCreateServer('123456789', 'New Server');
     * // Returns existing config or creates new one with defaults
     */
    getOrCreateServer(guildId: string, guildName: string): Promise<Server>;
    /**
     * Find servers with incomplete configuration
     * @returns {Promise<Array<{server: Server, missing: Array<string>}>>} Servers with validation results
     * @throws {Error} When query fails
     * @example
     * const incompleteServers = await configRepo.findIncompleteServers();
     * for (const {server, missing} of incompleteServers) {
     *   console.log(`Server ${server.name} missing: ${missing.join(', ')}`);
     * }
     */
    findIncompleteServers(): Promise<Array<{
        server: Server;
        missing: Array<string>;
    }>>;
    /**
     * Find servers with autorole configurations
     * @returns {Promise<Array<{server: Server, autoroleCount: number}>>} Servers with autoroles
     * @throws {Error} When query fails
     * @example
     * const autoservers = await configRepo.findServersWithAutoroles();
     * console.log(`${autoservers.length} servers have autoroles configured`);
     */
    findServersWithAutoroles(): Promise<Array<{
        server: Server;
        autoroleCount: number;
    }>>;
    /**
     * Set configuration value by key-value pattern
     * @param {string} guildId - Discord guild ID
     * @param {string} category - Configuration category
     * @param {string} key - Configuration key
     * @param {*} value - Configuration value
     * @returns {Promise<void>}
     * @throws {Error} When operation fails
     * @example
     * await configRepo.setConfigValue('123456789', 'moderation', 'jailChannelId', '987654321');
     */
    setConfigValue(guildId: string, category: string, key: string, value: any): Promise<void>;
    /**
     * Get configuration value by key-value pattern
     * @param {string} guildId - Discord guild ID
     * @param {string} category - Configuration category
     * @param {string} key - Configuration key
     * @param {*} [defaultValue=null] - Default value if not found
     * @returns {Promise<*>} Configuration value
     * @throws {Error} When operation fails
     * @example
     * const jailChannel = await configRepo.getConfigValue('123456789', 'moderation', 'jailChannelId');
     */
    getConfigValue(guildId: string, category: string, key: string, defaultValue?: any): Promise<any>;
    /**
     * Get all configuration values for a guild and category
     * @param {string} guildId - Discord guild ID
     * @param {string} [category] - Configuration category (all if not specified)
     * @returns {Promise<Object>} Configuration values by key
     * @throws {Error} When operation fails
     * @example
     * const moderationConfig = await configRepo.getConfigByCategory('123456789', 'moderation');
     * console.log('Jail Channel:', moderationConfig.jailChannelId);
     */
    getConfigByCategory(guildId: string, category?: string): Promise<any>;
    /**
     * Delete configuration value
     * @param {string} guildId - Discord guild ID
     * @param {string} category - Configuration category
     * @param {string} key - Configuration key
     * @returns {Promise<boolean>} Whether value was deleted
     * @throws {Error} When operation fails
     * @example
     * const deleted = await configRepo.deleteConfigValue('123456789', 'moderation', 'oldSetting');
     */
    deleteConfigValue(guildId: string, category: string, key: string): Promise<boolean>;
    /**
     * Get configuration statistics across all servers
     * @returns {Promise<Object>} Configuration statistics
     * @throws {Error} When calculation fails
     * @example
     * const stats = await configRepo.getConfigurationStatistics();
     * console.log(`${stats.fullyConfigured} servers are fully configured`);
     */
    getConfigurationStatistics(): Promise<any>;
    /**
     * Backup server configurations to JSON format
     * @param {Array<string>} [guildIds] - Specific guild IDs to backup (all if not specified)
     * @returns {Promise<Object>} Backup data object
     * @throws {Error} When backup fails
     * @example
     * const backup = await configRepo.backupServerConfigs(['123456789']);
     * await fs.writeFile('server-configs.json', JSON.stringify(backup, null, 2));
     */
    backupServerConfigs(guildIds?: Array<string>): Promise<any>;
    /**
     * Restore server configurations from backup
     * @param {Object} backupData - Backup data object
     * @param {boolean} [overwrite=false] - Whether to overwrite existing configurations
     * @returns {Promise<{imported: number, skipped: number, errors: Array}>} Import results
     * @throws {Error} When restore fails
     * @example
     * const backup = JSON.parse(await fs.readFile('server-configs.json'));
     * const result = await configRepo.restoreServerConfigs(backup, true);
     * console.log(`Imported ${result.imported} configs, skipped ${result.skipped}`);
     */
    restoreServerConfigs(backupData: any, overwrite?: boolean): Promise<{
        imported: number;
        skipped: number;
        errors: any[];
    }>;
    /**
     * Clean up configurations for servers the bot is no longer in
     * @param {Array<string>} activeGuildIds - List of guild IDs the bot is currently in
     * @param {boolean} [dryRun=true] - Whether to actually delete or just return count
     * @returns {Promise<number>} Number of configurations cleaned up
     * @throws {Error} When cleanup fails
     * @example
     * const activeGuilds = client.guilds.cache.map(guild => guild.id);
     * const cleanedUp = await configRepo.cleanupOrphanedConfigs(activeGuilds, false);
     * console.log(`Cleaned up ${cleanedUp} orphaned configurations`);
     */
    cleanupOrphanedConfigs(activeGuildIds: Array<string>, dryRun?: boolean): Promise<number>;
    /**
     * Reset server configuration to defaults
     * @param {string} guildId - Discord guild ID
     * @param {boolean} [confirm=false] - Confirmation flag
     * @returns {Promise<Server>} Reset server configuration
     * @throws {Error} When reset fails or confirmation not provided
     * @example
     * const resetServer = await configRepo.resetServerConfig('123456789', true);
     * console.log('Server configuration reset to defaults');
     */
    resetServerConfig(guildId: string, confirm?: boolean): Promise<Server>;
}
import BaseRepository = require("./BaseRepository");
import Server = require("../entities/Server");
//# sourceMappingURL=ConfigRepository.d.ts.map