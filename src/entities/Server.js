/**
 * Server entity representing Discord guild configuration and settings
 * Encapsulates server-specific bot configuration and template management
 * @class Server
 * @example
 * const server = new Server('123456789', 'My Discord Server');
 * server.setJailChannel('987654321');
 * server.setModeratorRole('555444333');
 */
class Server {
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
  constructor(id, name, config = {}) {
    if (!id || typeof id !== 'string') {
      throw new Error('Server ID must be a non-empty string');
    }
    
    if (!name || typeof name !== 'string') {
      throw new Error('Server name must be a non-empty string');
    }

    /**
     * Discord guild ID (primary key)
     * @type {string}
     * @readonly
     */
    this.id = id;
    
    /**
     * Discord guild name
     * @type {string}
     */
    this.name = name;
    
    /**
     * Server configuration settings
     * @type {Object}
     * @private
     */
    this._config = {
      jailChannelId: config.jailChannelId || null,
      ticketsChannelId: config.ticketsChannelId || null,
      moderatorRoleId: config.moderatorRoleId || null,
      jailedRoleId: config.jailedRoleId || null,
      autoroles: config.autoroles || {},
      templates: config.templates || {},
      createdAt: config.createdAt || new Date(),
      updatedAt: config.updatedAt || new Date()
    };
  }

  /**
   * Set jail channel ID for jailed users
   * @param {string} channelId - Discord channel ID
   * @throws {Error} When channel ID is invalid
   * @example
   * server.setJailChannel('123456789012345678');
   */
  setJailChannel(channelId) {
    if (!channelId || typeof channelId !== 'string') {
      throw new Error('Channel ID must be a non-empty string');
    }

    this._config.jailChannelId = channelId;
    this._config.updatedAt = new Date();
  }

  /**
   * Get jail channel ID
   * @returns {string|null} Jail channel ID or null if not set
   * @example
   * const jailChannelId = server.getJailChannel();
   * if (jailChannelId) {
   *   const channel = guild.channels.cache.get(jailChannelId);
   * }
   */
  getJailChannel() {
    return this._config.jailChannelId;
  }

  /**
   * Set tickets channel ID for ticket creation
   * @param {string} channelId - Discord channel ID
   * @throws {Error} When channel ID is invalid
   * @example
   * server.setTicketsChannel('123456789012345678');
   */
  setTicketsChannel(channelId) {
    if (!channelId || typeof channelId !== 'string') {
      throw new Error('Channel ID must be a non-empty string');
    }

    this._config.ticketsChannelId = channelId;
    this._config.updatedAt = new Date();
  }

  /**
   * Get tickets channel ID
   * @returns {string|null} Tickets channel ID or null if not set
   * @example
   * const ticketsChannelId = server.getTicketsChannel();
   */
  getTicketsChannel() {
    return this._config.ticketsChannelId;
  }

  /**
   * Set moderator role ID
   * @param {string} roleId - Discord role ID
   * @throws {Error} When role ID is invalid
   * @example
   * server.setModeratorRole('123456789012345678');
   */
  setModeratorRole(roleId) {
    if (!roleId || typeof roleId !== 'string') {
      throw new Error('Role ID must be a non-empty string');
    }

    this._config.moderatorRoleId = roleId;
    this._config.updatedAt = new Date();
  }

  /**
   * Get moderator role ID
   * @returns {string|null} Moderator role ID or null if not set
   * @example
   * const modRoleId = server.getModeratorRole();
   */
  getModeratorRole() {
    return this._config.moderatorRoleId;
  }

  /**
   * Set jailed role ID
   * @param {string} roleId - Discord role ID
   * @throws {Error} When role ID is invalid
   * @example
   * server.setJailedRole('123456789012345678');
   */
  setJailedRole(roleId) {
    if (!roleId || typeof roleId !== 'string') {
      throw new Error('Role ID must be a non-empty string');
    }

    this._config.jailedRoleId = roleId;
    this._config.updatedAt = new Date();
  }

  /**
   * Get jailed role ID
   * @returns {string|null} Jailed role ID or null if not set
   * @example
   * const jailedRoleId = server.getJailedRole();
   */
  getJailedRole() {
    return this._config.jailedRoleId;
  }

  /**
   * Add autorole configuration
   * @param {string} messageId - Discord message ID with reactions
   * @param {string} emoji - Emoji for reaction role
   * @param {string} roleId - Role ID to assign
   * @throws {Error} When parameters are invalid
   * @example
   * server.addAutorole('123456789', '✅', '987654321');
   */
  addAutorole(messageId, emoji, roleId) {
    if (!messageId || typeof messageId !== 'string') {
      throw new Error('Message ID must be a non-empty string');
    }
    
    if (!emoji || typeof emoji !== 'string') {
      throw new Error('Emoji must be a non-empty string');
    }
    
    if (!roleId || typeof roleId !== 'string') {
      throw new Error('Role ID must be a non-empty string');
    }

    if (!this._config.autoroles[messageId]) {
      this._config.autoroles[messageId] = {};
    }

    this._config.autoroles[messageId][emoji] = roleId;
    this._config.updatedAt = new Date();
  }

  /**
   * Remove autorole configuration
   * @param {string} messageId - Discord message ID
   * @param {string} [emoji] - Specific emoji to remove, or remove all if not specified
   * @example
   * server.removeAutorole('123456789', '✅'); // Remove specific emoji
   * server.removeAutorole('123456789'); // Remove entire message config
   */
  removeAutorole(messageId, emoji = null) {
    if (!this._config.autoroles[messageId]) {
      return;
    }

    if (emoji) {
      delete this._config.autoroles[messageId][emoji];
      
      // Remove message config if no emojis left
      if (Object.keys(this._config.autoroles[messageId]).length === 0) {
        delete this._config.autoroles[messageId];
      }
    } else {
      delete this._config.autoroles[messageId];
    }

    this._config.updatedAt = new Date();
  }

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
  getAutoroles(messageId) {
    return this._config.autoroles[messageId] || null;
  }

  /**
   * Get all autorole configurations
   * @returns {Object} Complete autorole configuration
   * @example
   * const allAutoroles = server.getAllAutoroles();
   * for (const [messageId, emojis] of Object.entries(allAutoroles)) {
   *   console.log(`Message ${messageId} has ${Object.keys(emojis).length} autoroles`);
   * }
   */
  getAllAutoroles() {
    return { ...this._config.autoroles };
  }

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
  findAutoroleId(messageId, emoji) {
    const messageAutoroles = this._config.autoroles[messageId];
    return messageAutoroles ? messageAutoroles[emoji] || null : null;
  }

  /**
   * Set template configuration
   * @param {string} key - Template setting key
   * @param {*} value - Template setting value
   * @example
   * server.setTemplateSetting('autoBackup', true);
   * server.setTemplateSetting('backupInterval', 24);
   */
  setTemplateSetting(key, value) {
    if (!key || typeof key !== 'string') {
      throw new Error('Template setting key must be a non-empty string');
    }

    this._config.templates[key] = value;
    this._config.updatedAt = new Date();
  }

  /**
   * Get template configuration
   * @param {string} key - Template setting key
   * @param {*} [defaultValue] - Default value if key not found
   * @returns {*} Template setting value
   * @example
   * const autoBackup = server.getTemplateSetting('autoBackup', false);
   */
  getTemplateSetting(key, defaultValue = null) {
    return this._config.templates.hasOwnProperty(key) 
      ? this._config.templates[key] 
      : defaultValue;
  }

  /**
   * Get all template settings
   * @returns {Object} Complete template configuration
   * @example
   * const templateConfig = server.getTemplateSettings();
   */
  getTemplateSettings() {
    return { ...this._config.templates };
  }

  /**
   * Check if server configuration is complete
   * @returns {Object} Validation result with missing configurations
   * @example
   * const validation = server.validateConfiguration();
   * if (!validation.isValid) {
   *   console.log('Missing:', validation.missing.join(', '));
   * }
   */
  validateConfiguration() {
    const missing = [];
    const warnings = [];

    // Required configurations
    if (!this._config.jailChannelId) {
      missing.push('Jail Channel');
    }
    
    if (!this._config.moderatorRoleId) {
      missing.push('Moderator Role');
    }
    
    if (!this._config.jailedRoleId) {
      missing.push('Jailed Role');
    }

    // Optional but recommended
    if (!this._config.ticketsChannelId) {
      warnings.push('Tickets Channel not configured - ticket system unavailable');
    }

    return {
      isValid: missing.length === 0,
      missing: missing,
      warnings: warnings,
      completeness: ((4 - missing.length - warnings.length) / 4) * 100
    };
  }

  /**
   * Get server configuration summary
   * @returns {Object} Configuration summary
   * @example
   * const summary = server.getConfigSummary();
   * console.log(`Server has ${summary.autorolesCount} autorole messages`);
   */
  getConfigSummary() {
    return {
      serverId: this.id,
      serverName: this.name,
      jailConfigured: Boolean(this._config.jailChannelId && this._config.jailedRoleId),
      ticketsConfigured: Boolean(this._config.ticketsChannelId),
      moderationConfigured: Boolean(this._config.moderatorRoleId),
      autorolesCount: Object.keys(this._config.autoroles).length,
      totalEmojis: Object.values(this._config.autoroles)
        .reduce((sum, emojis) => sum + Object.keys(emojis).length, 0),
      templatesConfigured: Object.keys(this._config.templates).length > 0,
      lastUpdated: this._config.updatedAt
    };
  }

  /**
   * Export server data for database storage
   * @returns {Object} Server data suitable for database storage
   * @example
   * const serverData = server.toDatabase();
   * await configRepository.updateById(server.id, serverData);
   */
  toDatabase() {
    return {
      _id: this.id,
      name: this.name,
      config: this._config
    };
  }

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
  static fromDatabase(data) {
    if (!data || !data._id) {
      throw new Error('Invalid server data: missing ID');
    }

    return new Server(data._id, data.name || 'Unknown Server', data.config || {});
  }

  /**
   * Reset server configuration to defaults
   * @param {boolean} [confirm=false] - Confirmation flag to prevent accidental resets
   * @throws {Error} When confirmation not provided
   * @example
   * server.resetConfiguration(true); // Requires explicit confirmation
   */
  resetConfiguration(confirm = false) {
    if (!confirm) {
      throw new Error('Configuration reset requires explicit confirmation');
    }

    const currentCreatedAt = this._config.createdAt;
    
    this._config = {
      jailChannelId: null,
      ticketsChannelId: null,
      moderatorRoleId: null,
      jailedRoleId: null,
      autoroles: {},
      templates: {},
      createdAt: currentCreatedAt,
      updatedAt: new Date()
    };
  }

  /**
   * Get when server configuration was created
   * @returns {Date} Creation date
   */
  get createdAt() {
    return this._config.createdAt;
  }

  /**
   * Get when server configuration was last updated
   * @returns {Date} Last update date
   */
  get updatedAt() {
    return this._config.updatedAt;
  }

  /**
   * Get complete configuration object (read-only)
   * @returns {Object} Complete server configuration
   * @example
   * const config = server.getConfiguration();
   * console.log('Jail Channel:', config.jailChannelId);
   */
  getConfiguration() {
    return JSON.parse(JSON.stringify(this._config));
  }
}

module.exports = Server;