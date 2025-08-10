const BaseRepository = require('./BaseRepository');
const Server = require('../entities/Server');

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
class ConfigRepository extends BaseRepository {
  /**
   * Initialize configuration repository
   * @param {DatabaseManager} dbManager - Database connection manager
   */
  constructor(dbManager) {
    super(dbManager, 'servers');
  }

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
  async findServerById(guildId) {
    try {
      const serverData = await this.findById(guildId);
      return serverData ? Server.fromDatabase(serverData) : null;
    } catch (error) {
      throw new Error(`Failed to find server configuration: ${error.message}`);
    }
  }

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
  async saveServer(server) {
    try {
      if (!(server instanceof Server)) {
        throw new Error('Parameter must be a Server entity');
      }

      const serverData = server.toDatabase();
      const exists = await this.exists(server.id);

      if (exists) {
        await this.updateById(server.id, serverData);
      } else {
        await this.create(serverData);
      }

      return server;
    } catch (error) {
      throw new Error(`Failed to save server configuration: ${error.message}`);
    }
  }

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
  async getOrCreateServer(guildId, guildName) {
    try {
      let server = await this.findServerById(guildId);
      
      if (!server) {
        server = new Server(guildId, guildName);
        await this.saveServer(server);
      } else if (server.name !== guildName) {
        // Update server name if it changed
        server.name = guildName;
        await this.saveServer(server);
      }

      return server;
    } catch (error) {
      throw new Error(`Failed to get or create server: ${error.message}`);
    }
  }

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
  async findIncompleteServers() {
    try {
      const allServers = await this.findMany({});
      const incompleteServers = [];

      for (const serverData of allServers) {
        const server = Server.fromDatabase(serverData);
        const validation = server.validateConfiguration();
        
        if (!validation.isValid) {
          incompleteServers.push({
            server,
            missing: validation.missing,
            warnings: validation.warnings,
            completeness: validation.completeness
          });
        }
      }

      return incompleteServers;
    } catch (error) {
      throw new Error(`Failed to find incomplete servers: ${error.message}`);
    }
  }

  /**
   * Find servers with autorole configurations
   * @returns {Promise<Array<{server: Server, autoroleCount: number}>>} Servers with autoroles
   * @throws {Error} When query fails
   * @example
   * const autoservers = await configRepo.findServersWithAutoroles();
   * console.log(`${autoservers.length} servers have autoroles configured`);
   */
  async findServersWithAutoroles() {
    try {
      const allServers = await this.findMany({});
      const serversWithAutoroles = [];

      for (const serverData of allServers) {
        const server = Server.fromDatabase(serverData);
        const autoroles = server.getAllAutoroles();
        const autoroleCount = Object.keys(autoroles).length;

        if (autoroleCount > 0) {
          serversWithAutoroles.push({
            server,
            autoroleCount,
            totalEmojis: Object.values(autoroles)
              .reduce((sum, emojis) => sum + Object.keys(emojis).length, 0)
          });
        }
      }

      return serversWithAutoroles;
    } catch (error) {
      throw new Error(`Failed to find servers with autoroles: ${error.message}`);
    }
  }

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
  async setConfigValue(guildId, category, key, value) {
    try {
      const configId = `${guildId}_${category}_${key}`;
      const configData = {
        _id: configId,
        guildId: guildId,
        category: category,
        key: key,
        value: value,
        updatedAt: new Date()
      };

      const exists = await this.exists(configId);
      
      if (exists) {
        await this.updateById(configId, configData);
      } else {
        await this.create(configData);
      }
    } catch (error) {
      throw new Error(`Failed to set config value: ${error.message}`);
    }
  }

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
  async getConfigValue(guildId, category, key, defaultValue = null) {
    try {
      const configId = `${guildId}_${category}_${key}`;
      const configData = await this.findById(configId);
      
      return configData ? configData.value : defaultValue;
    } catch (error) {
      throw new Error(`Failed to get config value: ${error.message}`);
    }
  }

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
  async getConfigByCategory(guildId, category = null) {
    try {
      let query = { guildId: guildId };
      if (category) {
        query.category = category;
      }

      const configData = await this.findMany(query);
      const config = {};

      for (const item of configData) {
        const keyPath = category ? item.key : `${item.category}.${item.key}`;
        config[keyPath] = item.value;
      }

      return config;
    } catch (error) {
      throw new Error(`Failed to get config by category: ${error.message}`);
    }
  }

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
  async deleteConfigValue(guildId, category, key) {
    try {
      const configId = `${guildId}_${category}_${key}`;
      return await this.deleteById(configId);
    } catch (error) {
      throw new Error(`Failed to delete config value: ${error.message}`);
    }
  }

  /**
   * Get configuration statistics across all servers
   * @returns {Promise<Object>} Configuration statistics
   * @throws {Error} When calculation fails
   * @example
   * const stats = await configRepo.getConfigurationStatistics();
   * console.log(`${stats.fullyConfigured} servers are fully configured`);
   */
  async getConfigurationStatistics() {
    try {
      const allServers = await this.findMany({});
      
      const stats = {
        totalServers: allServers.length,
        fullyConfigured: 0,
        partiallyConfigured: 0,
        unconfigured: 0,
        averageCompleteness: 0,
        serversWithAutoroles: 0,
        serversWithTemplates: 0,
        totalAutoroleMessages: 0,
        totalAutoroleEmojis: 0
      };

      let totalCompleteness = 0;

      for (const serverData of allServers) {
        const server = Server.fromDatabase(serverData);
        const validation = server.validateConfiguration();
        const summary = server.getConfigSummary();

        totalCompleteness += validation.completeness;

        if (validation.completeness === 100) {
          stats.fullyConfigured++;
        } else if (validation.completeness > 0) {
          stats.partiallyConfigured++;
        } else {
          stats.unconfigured++;
        }

        if (summary.autorolesCount > 0) {
          stats.serversWithAutoroles++;
          stats.totalAutoroleMessages += summary.autorolesCount;
          stats.totalAutoroleEmojis += summary.totalEmojis;
        }

        if (summary.templatesConfigured) {
          stats.serversWithTemplates++;
        }
      }

      if (stats.totalServers > 0) {
        stats.averageCompleteness = Math.round(totalCompleteness / stats.totalServers);
      }

      return stats;
    } catch (error) {
      throw new Error(`Failed to calculate configuration statistics: ${error.message}`);
    }
  }

  /**
   * Backup server configurations to JSON format
   * @param {Array<string>} [guildIds] - Specific guild IDs to backup (all if not specified)
   * @returns {Promise<Object>} Backup data object
   * @throws {Error} When backup fails
   * @example
   * const backup = await configRepo.backupServerConfigs(['123456789']);
   * await fs.writeFile('server-configs.json', JSON.stringify(backup, null, 2));
   */
  async backupServerConfigs(guildIds = null) {
    try {
      let query = {};
      if (guildIds && Array.isArray(guildIds)) {
        query = { _id: { $in: guildIds } };
      }

      const serverData = await this.findMany(query);
      
      return {
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        serverCount: serverData.length,
        servers: serverData
      };
    } catch (error) {
      throw new Error(`Failed to backup server configurations: ${error.message}`);
    }
  }

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
  async restoreServerConfigs(backupData, overwrite = false) {
    try {
      if (!backupData || !backupData.servers || !Array.isArray(backupData.servers)) {
        throw new Error('Invalid backup data format');
      }

      const results = {
        imported: 0,
        skipped: 0,
        errors: []
      };

      for (const serverData of backupData.servers) {
        try {
          const exists = await this.exists(serverData._id);
          
          if (exists && !overwrite) {
            results.skipped++;
            continue;
          }

          // Validate server data by creating Server entity
          const server = Server.fromDatabase(serverData);
          
          if (exists) {
            await this.updateById(serverData._id, serverData);
          } else {
            await this.create(serverData);
          }
          
          results.imported++;
        } catch (error) {
          results.errors.push({
            guildId: serverData._id,
            error: error.message
          });
        }
      }

      return results;
    } catch (error) {
      throw new Error(`Failed to restore server configurations: ${error.message}`);
    }
  }

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
  async cleanupOrphanedConfigs(activeGuildIds, dryRun = true) {
    try {
      const allServers = await this.findMany({});
      const activeSet = new Set(activeGuildIds);
      let cleanupCount = 0;

      for (const serverData of allServers) {
        if (!activeSet.has(serverData._id)) {
          if (!dryRun) {
            await this.deleteById(serverData._id);
          }
          cleanupCount++;
        }
      }

      return cleanupCount;
    } catch (error) {
      throw new Error(`Failed to cleanup orphaned configurations: ${error.message}`);
    }
  }

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
  async resetServerConfig(guildId, confirm = false) {
    try {
      if (!confirm) {
        throw new Error('Server configuration reset requires explicit confirmation');
      }

      const existingServer = await this.findServerById(guildId);
      if (!existingServer) {
        throw new Error('Server configuration not found');
      }

      existingServer.resetConfiguration(true);
      await this.saveServer(existingServer);

      return existingServer;
    } catch (error) {
      throw new Error(`Failed to reset server configuration: ${error.message}`);
    }
  }
}

module.exports = ConfigRepository;