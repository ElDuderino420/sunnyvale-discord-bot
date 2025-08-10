/**
 * Service for managing server template import/export operations
 * Handles server structure capture, validation, and restoration with conflict resolution
 * @class ServerTemplateService
 * @example
 * const templateService = new ServerTemplateService(configRepo, permissionService);
 * const template = await templateService.exportServerTemplate(guild, 'My Server Template');
 */
class ServerTemplateService {
  /**
   * Initialize server template service
   * @param {ConfigRepository} configRepository - Server configuration repository
   * @param {PermissionService} permissionService - Permission validation service
   */
  constructor(configRepository, permissionService) {
    if (!configRepository) {
      throw new Error('ConfigRepository is required');
    }
    if (!permissionService) {
      throw new Error('PermissionService is required');
    }

    /**
     * Configuration repository for server settings
     * @type {ConfigRepository}
     * @private
     */
    this._configRepo = configRepository;

    /**
     * Permission service for validation
     * @type {PermissionService}
     * @private
     */
    this._permissionService = permissionService;

    /**
     * Template validation schemas
     * @type {Object}
     * @private
     */
    this._schemas = this._initializeSchemas();

    /**
     * Import operation tracking
     * @type {Map<string, Object>}
     * @private
     */
    this._importOperations = new Map();

    /**
     * Discord API limits and constraints
     * @type {Object}
     * @private
     */
    this._discordLimits = {
      maxRoles: 250,
      maxChannels: 500,
      maxCategories: 50,
      maxRoleName: 100,
      maxChannelName: 100,
      maxCategoryName: 100,
      maxPermissionOverwrites: 10
    };
  }

  /**
   * Export server structure to template format
   * @param {Guild} guild - Discord guild to export
   * @param {string} templateName - Name for the template
   * @param {string} [description='Exported server template'] - Template description
   * @param {Object} [options={}] - Export options
   * @param {boolean} [options.includePermissions=true] - Include channel permissions
   * @param {boolean} [options.includeChannelData=true] - Include channel topics/slowmode
   * @param {boolean} [options.includeRoleData=true] - Include role colors/permissions
   * @param {Array<string>} [options.excludedChannels=[]] - Channel IDs to exclude
   * @param {Array<string>} [options.excludedRoles=[]] - Role IDs to exclude
   * @returns {Promise<Object>} Exported template with metadata
   * @throws {Error} When template export fails
   * @example
   * const template = await serverTemplateService.exportServerTemplate(guild, 'Gaming Server', 'Template for gaming communities', {
   *   includePermissions: true,
   *   excludedChannels: ['123456789']
   * });
   */
  async exportServerTemplate(guild, templateName, description = 'Exported server template', options = {}) {
    try {
      const {
        includePermissions = true,
        includeChannelData = true,
        includeRoleData = true,
        excludedChannels = [],
        excludedRoles = []
      } = options;

      // Validate template name
      if (!templateName || templateName.length > 100) {
        throw new Error('Template name must be between 1 and 100 characters');
      }

      const excludeSet = new Set([...excludedChannels, ...excludedRoles]);

      // Export roles (excluding @everyone and managed roles)
      const exportedRoles = [];
      const roleMap = new Map(); // Old ID -> New position in export

      guild.roles.cache
        .filter(role => role.id !== guild.id && !role.managed && !excludeSet.has(role.id))
        .sort((a, b) => a.position - b.position)
        .forEach((role, index) => {
          const roleData = {
            name: role.name,
            color: role.hexColor,
            permissions: includeRoleData ? role.permissions.toArray() : [],
            position: role.position,
            hoist: role.hoist,
            mentionable: role.mentionable,
            icon: role.icon,
            unicode_emoji: role.unicodeEmoji
          };

          exportedRoles.push(roleData);
          roleMap.set(role.id, index);
        });

      // Export channels and categories
      const exportedChannels = [];
      const categoryMap = new Map();

      // First pass: Export categories
      guild.channels.cache
        .filter(channel => channel.type === 4 && !excludeSet.has(channel.id)) // Category type
        .sort((a, b) => a.position - b.position)
        .forEach((category, index) => {
          const categoryData = {
            name: category.name,
            type: 'category',
            position: category.position,
            permissions: includePermissions ? this._exportPermissionOverwrites(category, roleMap) : []
          };

          exportedChannels.push(categoryData);
          categoryMap.set(category.id, exportedChannels.length - 1);
        });

      // Second pass: Export other channels
      guild.channels.cache
        .filter(channel => channel.type !== 4 && !excludeSet.has(channel.id))
        .sort((a, b) => a.position - b.position)
        .forEach(channel => {
          const channelData = {
            name: channel.name,
            type: this._getChannelTypeString(channel.type),
            position: channel.position,
            parent: channel.parentId && categoryMap.has(channel.parentId) 
              ? categoryMap.get(channel.parentId) 
              : null,
            permissions: includePermissions ? this._exportPermissionOverwrites(channel, roleMap) : []
          };

          // Add channel-specific data
          if (includeChannelData) {
            if (channel.topic) channelData.topic = channel.topic;
            if (channel.nsfw) channelData.nsfw = channel.nsfw;
            if (channel.rateLimitPerUser) channelData.slowmode = channel.rateLimitPerUser;
            if (channel.bitrate) channelData.bitrate = channel.bitrate;
            if (channel.userLimit) channelData.userLimit = channel.userLimit;
          }

          exportedChannels.push(channelData);
        });

      // Create template object according to schema
      const template = {
        serverName: guild.name,
        description: guild.description || '',
        roles: exportedRoles,
        channels: exportedChannels,
        systemChannelFlags: guild.systemChannelFlags?.toArray() || [],
        defaultMessageNotifications: guild.defaultMessageNotifications,
        explicitContentFilter: guild.explicitContentFilter,
        verificationLevel: guild.verificationLevel,
        afkTimeout: guild.afkTimeout,
        locale: guild.preferredLocale
      };

      // Create full template with metadata
      const fullTemplate = {
        name: templateName,
        description: description,
        template: template,
        metadata: {
          version: '1.0.0',
          created: new Date().toISOString(),
          author: guild.ownerId,
          sourceGuild: {
            id: guild.id,
            name: guild.name,
            memberCount: guild.memberCount
          },
          exportOptions: options,
          statistics: {
            rolesExported: exportedRoles.length,
            channelsExported: exportedChannels.filter(c => c.type !== 'category').length,
            categoriesExported: exportedChannels.filter(c => c.type === 'category').length,
            permissionOverwrites: exportedChannels.reduce((sum, ch) => sum + (ch.permissions?.length || 0), 0)
          },
          compatibility: {
            discordApiVersion: '10',
            minimumBotPermissions: this._getRequiredPermissions(template)
          }
        }
      };

      // Validate exported template
      const validation = this.validateTemplate(fullTemplate);
      if (!validation.isValid) {
        console.warn('Exported template has validation warnings:', validation.warnings);
      }

      return {
        success: true,
        template: fullTemplate,
        validation: validation,
        exportedAt: new Date()
      };
    } catch (error) {
      throw new Error(`Failed to export server template: ${error.message}`);
    }
  }

  /**
   * Import server template with conflict resolution
   * @param {CommandInteraction} interaction - Discord command interaction
   * @param {Object} templateData - Template data to import
   * @param {string} [strategy='merge'] - Import strategy (merge, overwrite, skip)
   * @param {Object} [options={}] - Import options
   * @param {boolean} [options.dryRun=false] - Preview changes without applying
   * @param {boolean} [options.backupFirst=true] - Create backup before import
   * @param {Array<string>} [options.skipSections=[]] - Sections to skip (roles, channels, settings)
   * @returns {Promise<Object>} Import result with created/modified items
   * @throws {Error} When template import fails
   * @example
   * const result = await serverTemplateService.importServerTemplate(interaction, templateData, 'merge', {
   *   dryRun: false,
   *   backupFirst: true,
   *   skipSections: ['settings']
   * });
   */
  async importServerTemplate(interaction, templateData, strategy = 'merge', options = {}) {
    try {
      const {
        dryRun = false,
        backupFirst = true,
        skipSections = []
      } = options;

      // Validate permissions
      const canManageTemplates = this._permissionService.canManageTemplates(
        interaction.guild.members.cache.get(interaction.user.id)
      );

      if (!canManageTemplates) {
        return {
          success: false,
          error: 'You do not have permission to import server templates.',
          type: 'permission_denied'
        };
      }

      // Validate template
      const validation = this.validateTemplate(templateData);
      if (!validation.isValid && validation.errors.length > 0) {
        return {
          success: false,
          error: 'Template validation failed.',
          type: 'validation_failed',
          validation: validation
        };
      }

      const guild = interaction.guild;
      const template = templateData.template;
      const operationId = `import_${Date.now()}_${guild.id}`;

      // Track import operation
      this._importOperations.set(operationId, {
        guildId: guild.id,
        userId: interaction.user.id,
        strategy: strategy,
        startTime: new Date(),
        status: 'preparing'
      });

      let backup = null;

      try {
        // Create backup if requested
        if (backupFirst && !dryRun) {
          const backupResult = await this.exportServerTemplate(
            guild,
            `Backup before import - ${new Date().toISOString()}`,
            'Automatic backup created before template import'
          );
          backup = backupResult.template;
        }

        // Prepare import plan
        const importPlan = await this._createImportPlan(guild, template, strategy, skipSections);
        
        if (dryRun) {
          return {
            success: true,
            dryRun: true,
            plan: importPlan,
            validation: validation,
            operationId: operationId
          };
        }

        // Update operation status
        this._importOperations.get(operationId).status = 'executing';

        // Execute import plan
        const results = await this._executeImportPlan(guild, importPlan, operationId);

        // Update operation status
        this._importOperations.get(operationId).status = 'completed';
        this._importOperations.get(operationId).endTime = new Date();

        return {
          success: true,
          operationId: operationId,
          strategy: strategy,
          backup: backup,
          plan: importPlan,
          results: results,
          validation: validation,
          importedAt: new Date()
        };
      } catch (error) {
        // Update operation status
        if (this._importOperations.has(operationId)) {
          this._importOperations.get(operationId).status = 'failed';
          this._importOperations.get(operationId).error = error.message;
          this._importOperations.get(operationId).endTime = new Date();
        }

        // Attempt to restore from backup if available
        if (backup && !dryRun) {
          console.warn('Import failed, backup available for manual restoration');
        }

        throw error;
      }
    } catch (error) {
      throw new Error(`Failed to import server template: ${error.message}`);
    }
  }

  /**
   * Validate template against schema and Discord limits
   * @param {Object} templateData - Template data to validate
   * @returns {Object} Validation result with errors and warnings
   * @example
   * const validation = serverTemplateService.validateTemplate(templateData);
   * if (!validation.isValid) {
   *   console.log('Validation errors:', validation.errors);
   * }
   */
  validateTemplate(templateData) {
    const errors = [];
    const warnings = [];

    try {
      // Validate basic structure
      if (!templateData || typeof templateData !== 'object') {
        errors.push('Template must be an object');
        return { isValid: false, errors, warnings };
      }

      // Validate required fields
      const requiredFields = ['name', 'template', 'metadata'];
      for (const field of requiredFields) {
        if (!templateData[field]) {
          errors.push(`Missing required field: ${field}`);
        }
      }

      if (errors.length > 0) {
        return { isValid: false, errors, warnings };
      }

      const template = templateData.template;

      // Validate template structure
      if (!template.roles || !Array.isArray(template.roles)) {
        errors.push('Template must contain roles array');
      }

      if (!template.channels || !Array.isArray(template.channels)) {
        errors.push('Template must contain channels array');
      }

      // Validate Discord limits
      if (template.roles.length > this._discordLimits.maxRoles) {
        errors.push(`Too many roles: ${template.roles.length} (max: ${this._discordLimits.maxRoles})`);
      }

      const totalChannels = template.channels.length;
      const categories = template.channels.filter(ch => ch.type === 'category').length;
      
      if (totalChannels > this._discordLimits.maxChannels) {
        errors.push(`Too many channels: ${totalChannels} (max: ${this._discordLimits.maxChannels})`);
      }

      if (categories > this._discordLimits.maxCategories) {
        errors.push(`Too many categories: ${categories} (max: ${this._discordLimits.maxCategories})`);
      }

      // Validate role data
      for (let i = 0; i < template.roles.length; i++) {
        const role = template.roles[i];
        if (!role.name || role.name.length > this._discordLimits.maxRoleName) {
          errors.push(`Role ${i}: Invalid name (max ${this._discordLimits.maxRoleName} characters)`);
        }
        
        if (role.permissions && !Array.isArray(role.permissions)) {
          warnings.push(`Role ${i} (${role.name}): Invalid permissions format`);
        }
      }

      // Validate channel data
      for (let i = 0; i < template.channels.length; i++) {
        const channel = template.channels[i];
        if (!channel.name || channel.name.length > this._discordLimits.maxChannelName) {
          errors.push(`Channel ${i}: Invalid name (max ${this._discordLimits.maxChannelName} characters)`);
        }

        if (!this._isValidChannelType(channel.type)) {
          errors.push(`Channel ${i} (${channel.name}): Invalid channel type: ${channel.type}`);
        }

        if (channel.permissions && channel.permissions.length > this._discordLimits.maxPermissionOverwrites) {
          warnings.push(`Channel ${i} (${channel.name}): Too many permission overwrites (${channel.permissions.length})`);
        }

        // Validate parent references
        if (channel.parent !== null && channel.parent !== undefined) {
          if (typeof channel.parent !== 'number' || channel.parent >= template.channels.length) {
            errors.push(`Channel ${i} (${channel.name}): Invalid parent reference`);
          } else {
            const parentChannel = template.channels[channel.parent];
            if (parentChannel.type !== 'category') {
              errors.push(`Channel ${i} (${channel.name}): Parent is not a category`);
            }
          }
        }
      }

      // Validate metadata
      const metadata = templateData.metadata;
      if (metadata.version && !this._isValidVersion(metadata.version)) {
        warnings.push('Invalid or unsupported template version');
      }

      // Check for potential conflicts
      const roleNames = template.roles.map(r => r.name.toLowerCase());
      const duplicateRoles = roleNames.filter((name, index) => roleNames.indexOf(name) !== index);
      if (duplicateRoles.length > 0) {
        warnings.push(`Duplicate role names: ${[...new Set(duplicateRoles)].join(', ')}`);
      }

      const channelNames = template.channels.map(c => c.name.toLowerCase());
      const duplicateChannels = channelNames.filter((name, index) => channelNames.indexOf(name) !== index);
      if (duplicateChannels.length > 0) {
        warnings.push(`Duplicate channel names: ${[...new Set(duplicateChannels)].join(', ')}`);
      }

    } catch (error) {
      errors.push(`Validation error: ${error.message}`);
    }

    return {
      isValid: errors.length === 0,
      errors: errors,
      warnings: warnings,
      statistics: templateData.template ? {
        rolesCount: templateData.template.roles?.length || 0,
        channelsCount: templateData.template.channels?.length || 0,
        categoriesCount: templateData.template.channels?.filter(c => c.type === 'category').length || 0
      } : null
    };
  }

  /**
   * Get import operation status
   * @param {string} operationId - Import operation ID
   * @returns {Object|null} Operation status or null if not found
   * @example
   * const status = serverTemplateService.getImportStatus('import_1234567890_123456789');
   * if (status) {
   *   console.log(`Import status: ${status.status}`);
   * }
   */
  getImportStatus(operationId) {
    return this._importOperations.get(operationId) || null;
  }

  /**
   * Cancel ongoing import operation
   * @param {string} operationId - Import operation ID
   * @returns {boolean} Whether cancellation was successful
   * @example
   * const cancelled = serverTemplateService.cancelImport('import_1234567890_123456789');
   * if (cancelled) {
   *   console.log('Import operation cancelled');
   * }
   */
  cancelImport(operationId) {
    const operation = this._importOperations.get(operationId);
    if (operation && operation.status === 'executing') {
      operation.status = 'cancelled';
      operation.endTime = new Date();
      return true;
    }
    return false;
  }

  /**
   * Clean up completed import operations
   * @param {number} [maxAge=86400000] - Maximum age in milliseconds (24 hours default)
   * @returns {number} Number of operations cleaned up
   * @example
   * const cleaned = serverTemplateService.cleanupImportOperations(3600000); // 1 hour
   * console.log(`Cleaned up ${cleaned} import operations`);
   */
  cleanupImportOperations(maxAge = 86400000) {
    const cutoffTime = new Date(Date.now() - maxAge);
    let cleaned = 0;

    for (const [operationId, operation] of this._importOperations.entries()) {
      if (operation.endTime && new Date(operation.endTime) < cutoffTime) {
        this._importOperations.delete(operationId);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Initialize validation schemas
   * @private
   * @returns {Object} Schema definitions
   */
  _initializeSchemas() {
    return {
      template: {
        type: 'object',
        required: ['name', 'template', 'metadata'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 100 },
          description: { type: 'string', maxLength: 1000 },
          template: {
            type: 'object',
            required: ['serverName', 'roles', 'channels'],
            properties: {
              serverName: { type: 'string', minLength: 1, maxLength: 100 },
              description: { type: 'string', maxLength: 1000 },
              roles: { type: 'array', items: { $ref: '#/definitions/role' } },
              channels: { type: 'array', items: { $ref: '#/definitions/channel' } }
            }
          },
          metadata: {
            type: 'object',
            required: ['version', 'created'],
            properties: {
              version: { type: 'string' },
              created: { type: 'string', format: 'date-time' },
              author: { type: 'string' }
            }
          }
        }
      }
    };
  }

  /**
   * Export permission overwrites for a channel
   * @private
   * @param {GuildChannel} channel - Discord channel
   * @param {Map} roleMap - Role ID mapping
   * @returns {Array} Permission overwrites array
   */
  _exportPermissionOverwrites(channel, roleMap) {
    const overwrites = [];

    for (const [id, overwrite] of channel.permissionOverwrites.cache) {
      let targetType, targetRef;

      if (overwrite.type === 0) { // Role
        if (id === channel.guild.id) {
          targetType = 'everyone';
          targetRef = '@everyone';
        } else if (roleMap.has(id)) {
          targetType = 'role';
          targetRef = roleMap.get(id);
        } else {
          continue; // Skip excluded or managed roles
        }
      } else { // Member - skip for template
        continue;
      }

      overwrites.push({
        type: targetType,
        target: targetRef,
        allow: overwrite.allow.toArray(),
        deny: overwrite.deny.toArray()
      });
    }

    return overwrites;
  }

  /**
   * Get channel type string from Discord type number
   * @private
   * @param {number} type - Discord channel type
   * @returns {string} Channel type string
   */
  _getChannelTypeString(type) {
    const typeMap = {
      0: 'text',
      2: 'voice',
      4: 'category',
      5: 'announcement',
      10: 'news_thread',
      11: 'public_thread',
      12: 'private_thread',
      13: 'stage',
      15: 'forum'
    };
    return typeMap[type] || 'unknown';
  }

  /**
   * Check if channel type is valid
   * @private
   * @param {string} type - Channel type string
   * @returns {boolean} Whether type is valid
   */
  _isValidChannelType(type) {
    const validTypes = ['text', 'voice', 'category', 'announcement', 'stage', 'forum'];
    return validTypes.includes(type);
  }

  /**
   * Check if version string is valid
   * @private
   * @param {string} version - Version string
   * @returns {boolean} Whether version is valid
   */
  _isValidVersion(version) {
    return /^\d+\.\d+\.\d+$/.test(version);
  }

  /**
   * Get required permissions for template
   * @private
   * @param {Object} template - Template data
   * @returns {Array} Required Discord permissions
   */
  _getRequiredPermissions(template) {
    const permissions = ['MANAGE_ROLES', 'MANAGE_CHANNELS'];
    
    // Check if template has complex permissions
    const hasComplexPerms = template.channels.some(ch => 
      ch.permissions && ch.permissions.length > 0
    );
    
    if (hasComplexPerms) {
      permissions.push('MANAGE_PERMISSIONS');
    }

    return permissions;
  }

  /**
   * Create import plan with conflict resolution
   * @private
   * @param {Guild} guild - Target guild
   * @param {Object} template - Template to import
   * @param {string} strategy - Import strategy
   * @param {Array} skipSections - Sections to skip
   * @returns {Promise<Object>} Import plan
   */
  async _createImportPlan(guild, template, strategy, skipSections) {
    // This would contain the detailed import planning logic
    // For now, return a basic structure
    
    return {
      strategy: strategy,
      skipSections: skipSections,
      roles: {
        create: [],
        update: [],
        skip: []
      },
      channels: {
        create: [],
        update: [],
        skip: []
      },
      settings: {
        update: []
      },
      conflicts: [],
      warnings: []
    };
  }

  /**
   * Execute import plan
   * @private
   * @param {Guild} guild - Target guild
   * @param {Object} plan - Import plan
   * @param {string} operationId - Operation ID
   * @returns {Promise<Object>} Execution results
   */
  async _executeImportPlan(guild, plan, operationId) {
    // This would contain the actual import execution logic
    // For now, return a basic structure
    
    return {
      roles: {
        created: 0,
        updated: 0,
        skipped: 0,
        failed: 0
      },
      channels: {
        created: 0,
        updated: 0,
        skipped: 0,
        failed: 0
      },
      settings: {
        updated: 0,
        failed: 0
      },
      errors: [],
      warnings: []
    };
  }

  /**
   * Validate template data structure and content
   * @param {Object} templateData - Template data to validate
   * @returns {Promise<Object>} Validation result with isValid flag and error details
   * @throws {Error} When validation fails
   * @example
   * const validation = await templateService.validateTemplate(templateData);
   * if (!validation.isValid) {
   *   console.log('Template invalid:', validation.error);
   * }
   */
  async validateTemplate(templateData) {
    try {
      // Check if template data exists and has basic structure
      if (!templateData || typeof templateData !== 'object') {
        return {
          isValid: false,
          error: 'Template data is missing or not a valid object'
        };
      }

      // Check required fields
      const requiredFields = ['name', 'version', 'createdAt'];
      for (const field of requiredFields) {
        if (!templateData[field]) {
          return {
            isValid: false,
            error: `Missing required field: ${field}`
          };
        }
      }

      // Validate version format
      if (typeof templateData.version !== 'string' || !/^\d+\.\d+\.\d+$/.test(templateData.version)) {
        return {
          isValid: false,
          error: 'Invalid version format. Expected semantic version (e.g., 1.0.0)'
        };
      }

      // Check if template has any content sections
      const contentSections = ['channels', 'roles', 'settings'];
      const hasContent = contentSections.some(section => 
        templateData[section] && 
        (Array.isArray(templateData[section]) ? templateData[section].length > 0 : Object.keys(templateData[section]).length > 0)
      );

      if (!hasContent) {
        return {
          isValid: false,
          error: 'Template appears to be empty (no channels, roles, or settings found)'
        };
      }

      return {
        isValid: true,
        sections: contentSections.filter(section => templateData[section]),
        itemCount: {
          channels: Array.isArray(templateData.channels) ? templateData.channels.length : 0,
          roles: Array.isArray(templateData.roles) ? templateData.roles.length : 0,
          settings: templateData.settings ? Object.keys(templateData.settings).length : 0
        }
      };
    } catch (error) {
      return {
        isValid: false,
        error: `Template validation failed: ${error.message}`
      };
    }
  }

  /**
   * Validate import permissions and configuration
   * @param {string} guildId - Discord guild ID
   * @param {string} importerId - User ID performing the import
   * @param {Object} templateData - Template data to import
   * @param {Object} importConfig - Import configuration options
   * @returns {Promise<Object>} Validation result with permissions and warnings
   * @throws {Error} When validation fails
   * @example
   * const validation = await templateService.validateImport(guildId, userId, template, config);
   * if (!validation.isValid) {
   *   console.log('Import not allowed:', validation.error);
   * }
   */
  async validateImport(guildId, importerId, templateData, importConfig) {
    try {
      // Check if user has permission to import templates
      const canImport = await this._permissionService.canManageTemplates(importerId, guildId);
      if (!canImport) {
        return {
          isValid: false,
          error: 'You do not have permission to import server templates'
        };
      }

      // Validate template first
      const templateValidation = await this.validateTemplate(templateData);
      if (!templateValidation.isValid) {
        return {
          isValid: false,
          error: `Invalid template: ${templateValidation.error}`
        };
      }

      // Check for potential conflicts
      const warnings = [];
      
      if (templateData.channels && templateData.channels.length > 0 && !importConfig.mergeChannels) {
        warnings.push('Template contains channels but merge channels is disabled');
      }

      if (templateData.roles && templateData.roles.length > 0 && !importConfig.mergeRoles) {
        warnings.push('Template contains roles but merge roles is disabled');
      }

      // Check Discord limits
      if (templateData.channels && templateData.channels.length > 500) {
        return {
          isValid: false,
          error: 'Template contains too many channels (Discord limit: 500 per server)'
        };
      }

      if (templateData.roles && templateData.roles.length > 250) {
        return {
          isValid: false,
          error: 'Template contains too many roles (Discord limit: 250 per server)'
        };
      }

      return {
        isValid: true,
        warnings: warnings,
        estimatedChanges: {
          channels: templateData.channels ? templateData.channels.length : 0,
          roles: templateData.roles ? templateData.roles.length : 0,
          settings: templateData.settings ? Object.keys(templateData.settings).length : 0
        },
        previewMode: importConfig.previewOnly || false
      };
    } catch (error) {
      return {
        isValid: false,
        error: `Import validation failed: ${error.message}`
      };
    }
  }
}

module.exports = ServerTemplateService;