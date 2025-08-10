/**
 * Service for managing permission validation and role-based access control
 * Centralizes permission checking logic for bot commands and operations
 * @class PermissionService
 * @example
 * const permissionService = new PermissionService(configRepo);
 * const canModerate = await permissionService.canModerateUser(member, target);
 */
class PermissionService {
  /**
   * Initialize permission service
   * @param {ConfigRepository} configRepository - Server configuration repository
   */
  constructor(configRepository) {
    if (!configRepository) {
      throw new Error('ConfigRepository is required');
    }

    /**
     * Configuration repository for server-specific settings
     * @type {ConfigRepository}
     * @private
     */
    this._configRepo = configRepository;

    /**
     * Cache for permission lookups to improve performance
     * @type {Map<string, Object>}
     * @private
     */
    this._permissionCache = new Map();

    /**
     * Cache TTL in milliseconds (5 minutes)
     * @type {number}
     * @private
     */
    this._cacheTTL = 5 * 60 * 1000;
  }

  /**
   * Check if user has Discord permission
   * @param {GuildMember} member - Discord guild member
   * @param {string|Array<string>} permissions - Permission(s) to check
   * @returns {boolean} Whether user has the permission(s)
   * @example
   * const canKick = permissionService.hasDiscordPermission(member, 'KICK_MEMBERS');
   * const canModerate = permissionService.hasDiscordPermission(member, ['KICK_MEMBERS', 'BAN_MEMBERS']);
   */
  hasDiscordPermission(member, permissions) {
    try {
      if (!member || !member.permissions) {
        return false;
      }

      const permissionsArray = Array.isArray(permissions) ? permissions : [permissions];
      
      // Check if user has all required permissions
      return permissionsArray.every(permission => 
        member.permissions.has(permission)
      );
    } catch (error) {
      console.error('Error checking Discord permission:', error);
      return false;
    }
  }

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
  async hasModeratorRole(member) {
    try {
      if (!member || !member.guild) {
        return false;
      }

      const cacheKey = `mod_role_${member.guild.id}_${member.id}`;
      const cached = this._getFromCache(cacheKey);
      if (cached !== null) {
        return cached;
      }

      const server = await this._configRepo.findServerById(member.guild.id);
      if (!server) {
        return false;
      }

      const moderatorRoleId = server.getModeratorRole();
      if (!moderatorRoleId) {
        return false;
      }

      const hasModerator = member.roles.cache.has(moderatorRoleId);
      
      // Cache the result
      this._setCache(cacheKey, hasModerator);
      
      return hasModerator;
    } catch (error) {
      throw new Error(`Failed to check moderator role: ${error.message}`);
    }
  }

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
  canModerateUser(moderator, target) {
    try {
      if (!moderator || !target || !moderator.guild || !target.guild) {
        return false;
      }

      // Cannot moderate yourself
      if (moderator.id === target.id) {
        return false;
      }

      // Cannot moderate the server owner
      if (target.id === target.guild.ownerId) {
        return false;
      }

      // Server owner can moderate anyone
      if (moderator.id === moderator.guild.ownerId) {
        return true;
      }

      // Check role hierarchy
      const moderatorHighestRole = moderator.roles.highest;
      const targetHighestRole = target.roles.highest;

      return moderatorHighestRole.position > targetHighestRole.position;
    } catch (error) {
      console.error('Error checking user moderation hierarchy:', error);
      return false;
    }
  }

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
  botCanModerateUser(guild, target) {
    try {
      if (!guild || !target || !guild.members) {
        return false;
      }

      const botMember = guild.members.cache.get(guild.client.user.id);
      if (!botMember) {
        return false;
      }

      // Cannot moderate the server owner
      if (target.id === guild.ownerId) {
        return false;
      }

      // Check role hierarchy
      const botHighestRole = botMember.roles.highest;
      const targetHighestRole = target.roles.highest;

      return botHighestRole.position > targetHighestRole.position;
    } catch (error) {
      console.error('Error checking bot moderation hierarchy:', error);
      return false;
    }
  }

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
  async validateCommandPermissions(interaction, requirements = {}) {
    try {
      const {
        discordPermissions = [],
        moderatorRole = false,
        checkHierarchy = false
      } = requirements;

      const member = interaction.guild?.members.cache.get(interaction.user.id);
      if (!member) {
        return {
          allowed: false,
          reason: 'This command can only be used in a server.'
        };
      }

      // Check Discord permissions
      if (discordPermissions.length > 0) {
        const hasPermissions = this.hasDiscordPermission(member, discordPermissions);
        if (!hasPermissions) {
          const permissionList = discordPermissions.join(', ');
          return {
            allowed: false,
            reason: `You need the following permissions: ${permissionList}`
          };
        }
      }

      // Check moderator role
      if (moderatorRole) {
        const hasModerator = await this.hasModeratorRole(member);
        if (!hasModerator) {
          return {
            allowed: false,
            reason: 'You need the moderator role to use this command.'
          };
        }
      }

      // Check hierarchy if target user is specified
      if (checkHierarchy) {
        const targetOption = interaction.options.getUser('user') || interaction.options.getUser('target');
        if (targetOption) {
          const targetMember = interaction.guild.members.cache.get(targetOption.id);
          if (targetMember) {
            const canModerate = this.canModerateUser(member, targetMember);
            if (!canModerate) {
              return {
                allowed: false,
                reason: 'You cannot moderate this user due to role hierarchy.'
              };
            }

            const botCanModerate = this.botCanModerateUser(interaction.guild, targetMember);
            if (!botCanModerate) {
              return {
                allowed: false,
                reason: 'I cannot moderate this user due to role hierarchy.'
              };
            }
          }
        }
      }

      return {
        allowed: true,
        reason: null
      };
    } catch (error) {
      throw new Error(`Failed to validate command permissions: ${error.message}`);
    }
  }

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
  async canAccessTicket(member, ticket) {
    try {
      if (!member || !ticket) {
        return false;
      }

      // Ticket creator can always access
      if (member.id === ticket.creatorId) {
        return true;
      }

      // Check if user is assigned staff
      if (ticket.isStaffAssigned(member.id)) {
        return true;
      }

      // Check if user has moderator role
      const hasModerator = await this.hasModeratorRole(member);
      if (hasModerator) {
        return true;
      }

      // Check if user has manage messages permission (staff override)
      return this.hasDiscordPermission(member, 'MANAGE_MESSAGES');
    } catch (error) {
      throw new Error(`Failed to check ticket access: ${error.message}`);
    }
  }

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
  canManageServerConfig(member) {
    try {
      if (!member) {
        return false;
      }

      // Server owner can always manage configuration
      if (member.id === member.guild.ownerId) {
        return true;
      }

      // Check for administrator permission
      if (this.hasDiscordPermission(member, 'ADMINISTRATOR')) {
        return true;
      }

      // Check for manage guild permission
      return this.hasDiscordPermission(member, 'MANAGE_GUILD');
    } catch (error) {
      console.error('Error checking server config permission:', error);
      return false;
    }
  }

  /**
   * Get permission level for user
   * @param {GuildMember} member - Discord guild member
   * @returns {Promise<string>} Permission level (owner, admin, moderator, member)
   * @throws {Error} When permission check fails
   * @example
   * const level = await permissionService.getPermissionLevel(member);
   * console.log(`User permission level: ${level}`);
   */
  async getPermissionLevel(member) {
    try {
      if (!member) {
        return 'none';
      }

      // Server owner
      if (member.id === member.guild.ownerId) {
        return 'owner';
      }

      // Administrator
      if (this.hasDiscordPermission(member, 'ADMINISTRATOR')) {
        return 'admin';
      }

      // Moderator
      const hasModerator = await this.hasModeratorRole(member);
      if (hasModerator) {
        return 'moderator';
      }

      // Regular member
      return 'member';
    } catch (error) {
      throw new Error(`Failed to get permission level: ${error.message}`);
    }
  }

  /**
   * Check if user can use autorole system
   * @param {GuildMember} member - Discord guild member
   * @returns {Promise<boolean>} Whether user can manage autoroles
   * @throws {Error} When permission check fails
   * @example
   * const canManageAutoroles = await permissionService.canManageAutoroles(member);
   */
  async canManageAutoroles(member) {
    try {
      if (!member) {
        return false;
      }

      // Check if user can manage server configuration
      if (this.canManageServerConfig(member)) {
        return true;
      }

      // Check if user has manage roles permission
      return this.hasDiscordPermission(member, 'MANAGE_ROLES');
    } catch (error) {
      throw new Error(`Failed to check autorole permission: ${error.message}`);
    }
  }

  /**
   * Check if user can manage templates
   * @param {GuildMember} member - Discord guild member
   * @returns {boolean} Whether user can manage templates
   * @example
   * const canManageTemplates = permissionService.canManageTemplates(member);
   */
  canManageTemplates(member) {
    try {
      if (!member) {
        return false;
      }

      // Only server administrators can manage templates due to destructive nature
      return this.canManageServerConfig(member);
    } catch (error) {
      console.error('Error checking template permission:', error);
      return false;
    }
  }

  /**
   * Get cached permission result
   * @private
   * @param {string} key - Cache key
   * @returns {*|null} Cached value or null if expired/not found
   */
  _getFromCache(key) {
    const cached = this._permissionCache.get(key);
    if (!cached) {
      return null;
    }

    if (Date.now() > cached.expires) {
      this._permissionCache.delete(key);
      return null;
    }

    return cached.value;
  }

  /**
   * Set permission result in cache
   * @private
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   */
  _setCache(key, value) {
    this._permissionCache.set(key, {
      value: value,
      expires: Date.now() + this._cacheTTL
    });

    // Clean up old cache entries periodically
    if (this._permissionCache.size > 1000) {
      this._cleanupCache();
    }
  }

  /**
   * Clean up expired cache entries
   * @private
   */
  _cleanupCache() {
    const now = Date.now();
    for (const [key, cached] of this._permissionCache.entries()) {
      if (now > cached.expires) {
        this._permissionCache.delete(key);
      }
    }
  }

  /**
   * Clear permission cache
   * @param {string} [guildId] - Specific guild to clear (all if not specified)
   * @example
   * permissionService.clearCache('123456789'); // Clear cache for specific guild
   * permissionService.clearCache(); // Clear all cache
   */
  clearCache(guildId = null) {
    if (guildId) {
      // Clear cache entries for specific guild
      for (const key of this._permissionCache.keys()) {
        if (key.includes(guildId)) {
          this._permissionCache.delete(key);
        }
      }
    } else {
      // Clear entire cache
      this._permissionCache.clear();
    }
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   * @example
   * const stats = permissionService.getCacheStats();
   * console.log(`Cache hit rate: ${stats.hitRate}%`);
   */
  getCacheStats() {
    const now = Date.now();
    let validEntries = 0;
    let expiredEntries = 0;

    for (const cached of this._permissionCache.values()) {
      if (now > cached.expires) {
        expiredEntries++;
      } else {
        validEntries++;
      }
    }

    return {
      totalEntries: this._permissionCache.size,
      validEntries: validEntries,
      expiredEntries: expiredEntries,
      cacheEfficiency: validEntries / Math.max(1, this._permissionCache.size),
      cacheTTL: this._cacheTTL
    };
  }
}

module.exports = PermissionService;