/**
 * Service for managing role operations and persistent role system
 * Handles role assignment, persistent roles, autoroles, and role hierarchy management
 * @class RoleService
 * @example
 * const roleService = new RoleService(userRepo, configRepo, permissionService);
 * await roleService.assignPersistentRole(member, roleId);
 */
class RoleService {
  /**
   * Initialize role service
   * @param {UserRepository} userRepository - User data repository
   * @param {ConfigRepository} configRepository - Server configuration repository
   * @param {PermissionService} permissionService - Permission validation service
   */
  constructor(userRepository, configRepository, permissionService) {
    if (!userRepository) {
      throw new Error('UserRepository is required');
    }
    if (!configRepository) {
      throw new Error('ConfigRepository is required');
    }
    if (!permissionService) {
      throw new Error('PermissionService is required');
    }

    /**
     * User repository for data persistence
     * @type {UserRepository}
     * @private
     */
    this._userRepo = userRepository;

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
     * Cache for role hierarchy and permissions
     * @type {Map<string, Object>}
     * @private
     */
    this._roleCache = new Map();

    /**
     * Active autorole message tracking
     * @type {Map<string, Object>}
     * @private
     */
    this._autoroleMessages = new Map();

    /**
     * Rate limiting for role operations
     * @type {Map<string, number>}
     * @private
     */
    this._operationLimits = new Map();
  }

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
  async assignPersistentRole(member, roleId, reason = 'Persistent role assigned') {
    try {
      // Validate role exists and bot can assign it
      const role = member.guild.roles.cache.get(roleId);
      if (!role) {
        return {
          success: false,
          error: 'Role not found.',
          type: 'role_not_found'
        };
      }

      // Check if bot can assign role (hierarchy check)
      const botMember = member.guild.members.me;
      if (role.position >= botMember.roles.highest.position) {
        return {
          success: false,
          error: 'Cannot assign role due to hierarchy restrictions.',
          type: 'hierarchy_error'
        };
      }

      // Check if role is managed (bot roles, integrations)
      if (role.managed) {
        return {
          success: false,
          error: 'Cannot assign managed roles.',
          type: 'managed_role'
        };
      }

      // Get or create user record
      let user = await this._userRepo.findUserById(member.id);
      if (!user) {
        const User = require('../entities/User');
        user = new User(member.id, member.user.tag);
      }

      // Check if role is already persistent
      if (user.hasPersistentRole(roleId)) {
        return {
          success: false,
          error: 'Role is already marked as persistent for this user.',
          type: 'already_persistent'
        };
      }

      // Assign role to member if they don't have it
      if (!member.roles.cache.has(roleId)) {
        try {
          await member.roles.add(role, reason);
        } catch (error) {
          return {
            success: false,
            error: `Failed to assign role: ${error.message}`,
            type: 'assignment_failed'
          };
        }
      }

      // Add to persistent roles
      user.addPersistentRole(roleId);
      await this._userRepo.saveUser(user);

      return {
        success: true,
        user: {
          id: member.id,
          tag: member.user.tag
        },
        role: {
          id: roleId,
          name: role.name,
          color: role.hexColor
        },
        action: 'persistent_role_assigned',
        reason: reason,
        timestamp: new Date()
      };
    } catch (error) {
      throw new Error(`Failed to assign persistent role: ${error.message}`);
    }
  }

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
  async removePersistentRole(member, roleId, removeFromMember = false, reason = 'Persistent role removed') {
    try {
      // Get user record
      const user = await this._userRepo.findUserById(member.id);
      if (!user) {
        return {
          success: false,
          error: 'User not found in database.',
          type: 'user_not_found'
        };
      }

      // Check if role is persistent
      if (!user.hasPersistentRole(roleId)) {
        return {
          success: false,
          error: 'Role is not marked as persistent for this user.',
          type: 'not_persistent'
        };
      }

      // Get role information
      const role = member.guild.roles.cache.get(roleId);
      const roleName = role ? role.name : 'Unknown Role';

      // Remove from persistent roles
      user.removePersistentRole(roleId);
      await this._userRepo.saveUser(user);

      // Optionally remove from member
      if (removeFromMember && role && member.roles.cache.has(roleId)) {
        try {
          await member.roles.remove(role, reason);
        } catch (error) {
          // Continue even if role removal fails
          console.warn(`Failed to remove role from member: ${error.message}`);
        }
      }

      return {
        success: true,
        user: {
          id: member.id,
          tag: member.user.tag
        },
        role: {
          id: roleId,
          name: roleName
        },
        action: 'persistent_role_removed',
        removedFromMember: removeFromMember,
        reason: reason,
        timestamp: new Date()
      };
    } catch (error) {
      throw new Error(`Failed to remove persistent role: ${error.message}`);
    }
  }

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
  async restorePersistentRoles(member) {
    try {
      // Get user record
      const user = await this._userRepo.findUserById(member.id);
      if (!user || !user.hasPersistentRoles()) {
        return {
          success: true,
          user: {
            id: member.id,
            tag: member.user.tag
          },
          rolesRestored: 0,
          rolesNotRestored: 0,
          restoredRoles: [],
          failedRoles: [],
          message: 'No persistent roles to restore.'
        };
      }

      const persistentRoleIds = user.getPersistentRoles();
      const restoredRoles = [];
      const failedRoles = [];

      // Restore each persistent role
      for (const roleId of persistentRoleIds) {
        try {
          const role = member.guild.roles.cache.get(roleId);
          
          if (!role) {
            failedRoles.push({
              id: roleId,
              reason: 'Role no longer exists'
            });
            continue;
          }

          // Check if role can be assigned
          const botMember = member.guild.members.me;
          if (role.position >= botMember.roles.highest.position) {
            failedRoles.push({
              id: roleId,
              name: role.name,
              reason: 'Bot hierarchy too low'
            });
            continue;
          }

          if (role.managed) {
            failedRoles.push({
              id: roleId,
              name: role.name,
              reason: 'Managed role cannot be assigned'
            });
            continue;
          }

          // Skip if user already has the role
          if (member.roles.cache.has(roleId)) {
            restoredRoles.push({
              id: roleId,
              name: role.name,
              action: 'already_had'
            });
            continue;
          }

          // Assign the role
          await member.roles.add(role, 'Persistent role restoration');
          restoredRoles.push({
            id: roleId,
            name: role.name,
            action: 'restored'
          });
        } catch (error) {
          failedRoles.push({
            id: roleId,
            reason: error.message
          });
        }
      }

      return {
        success: true,
        user: {
          id: member.id,
          tag: member.user.tag
        },
        rolesRestored: restoredRoles.length,
        rolesNotRestored: failedRoles.length,
        restoredRoles: restoredRoles,
        failedRoles: failedRoles,
        timestamp: new Date()
      };
    } catch (error) {
      throw new Error(`Failed to restore persistent roles: ${error.message}`);
    }
  }

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
  async storeRolesOnLeave(userId, guildId, roleIds) {
    try {
      // Filter out @everyone and managed roles
      const validRoleIds = roleIds.filter(roleId => roleId !== guildId);

      if (validRoleIds.length === 0) {
        return {
          success: true,
          user: { id: userId },
          rolesStored: 0,
          message: 'No valid roles to store as persistent.'
        };
      }

      // Get or create user record
      let user = await this._userRepo.findUserById(userId);
      if (!user) {
        const User = require('../entities/User');
        user = new User(userId, 'Unknown User'); // Tag will be updated when they return
      }

      // Add roles to persistent storage (avoiding duplicates)
      let newRolesAdded = 0;
      for (const roleId of validRoleIds) {
        if (!user.hasPersistentRole(roleId)) {
          user.addPersistentRole(roleId);
          newRolesAdded++;
        }
      }

      // Save user record
      await this._userRepo.saveUser(user);

      return {
        success: true,
        user: {
          id: userId
        },
        rolesStored: newRolesAdded,
        totalPersistentRoles: user.getPersistentRoles().length,
        timestamp: new Date()
      };
    } catch (error) {
      throw new Error(`Failed to store roles on leave: ${error.message}`);
    }
  }

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
  async setupAutoroleMessage(interaction, channelId, title, description, roleMappings) {
    try {
      // Validate permissions
      const canManage = await this._permissionService.canManageAutoroles(
        interaction.guild.members.cache.get(interaction.user.id)
      );

      if (!canManage) {
        return {
          success: false,
          error: 'You do not have permission to manage autoroles.',
          type: 'permission_denied'
        };
      }

      // Validate channel
      const channel = interaction.guild.channels.cache.get(channelId);
      if (!channel) {
        return {
          success: false,
          error: 'Channel not found.',
          type: 'channel_not_found'
        };
      }

      // Validate role mappings
      const validMappings = [];
      const invalidMappings = [];

      for (const mapping of roleMappings) {
        const role = interaction.guild.roles.cache.get(mapping.roleId);
        if (!role) {
          invalidMappings.push({
            ...mapping,
            reason: 'Role not found'
          });
          continue;
        }

        // Check bot can assign role
        const botMember = interaction.guild.members.me;
        if (role.position >= botMember.roles.highest.position) {
          invalidMappings.push({
            ...mapping,
            reason: 'Bot hierarchy too low'
          });
          continue;
        }

        if (role.managed) {
          invalidMappings.push({
            ...mapping,
            reason: 'Managed role'
          });
          continue;
        }

        validMappings.push({
          ...mapping,
          roleName: role.name
        });
      }

      if (validMappings.length === 0) {
        return {
          success: false,
          error: 'No valid role mappings provided.',
          type: 'no_valid_mappings',
          invalidMappings: invalidMappings
        };
      }

      // Create embed for autorole message
      const embed = {
        color: 0x0099ff,
        title: title,
        description: description,
        fields: validMappings.map(mapping => ({
          name: `${mapping.emoji} ${mapping.roleName}`,
          value: mapping.description || 'No description',
          inline: true
        })),
        footer: {
          text: 'React to this message to get/remove roles'
        },
        timestamp: new Date()
      };

      // Send autorole message
      const message = await channel.send({ embeds: [embed] });

      // Add reactions
      for (const mapping of validMappings) {
        try {
          await message.react(mapping.emoji);
        } catch (error) {
          console.warn(`Failed to add reaction ${mapping.emoji}: ${error.message}`);
        }
      }

      // Save autorole configuration
      const server = await this._configRepo.getOrCreateServer(interaction.guild.id, interaction.guild.name);
      
      // Create autorole mapping for server config
      const autoroleMap = {};
      for (const mapping of validMappings) {
        autoroleMap[mapping.emoji] = mapping.roleId;
      }

      server.addAutorole(message.id, autoroleMap);
      await this._configRepo.saveServer(server);

      // Cache autorole message
      this._autoroleMessages.set(message.id, {
        channelId: channelId,
        guildId: interaction.guild.id,
        mappings: autoroleMap,
        createdAt: new Date()
      });

      return {
        success: true,
        message: {
          id: message.id,
          channelId: channelId,
          url: `https://discord.com/channels/${interaction.guild.id}/${channelId}/${message.id}`
        },
        title: title,
        validMappings: validMappings,
        invalidMappings: invalidMappings,
        totalReactions: validMappings.length,
        createdBy: {
          id: interaction.user.id,
          tag: interaction.user.tag
        },
        timestamp: new Date()
      };
    } catch (error) {
      throw new Error(`Failed to setup autorole message: ${error.message}`);
    }
  }

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
  async handleAutoroleReaction(reaction, user, added) {
    try {
      // Skip if user is a bot
      if (user.bot) {
        return { success: false, type: 'bot_user' };
      }

      // Get autorole configuration
      const messageId = reaction.message.id;
      const guildId = reaction.message.guild.id;

      let autoroleConfig = this._autoroleMessages.get(messageId);
      
      // If not cached, try to load from database
      if (!autoroleConfig) {
        const server = await this._configRepo.findServerById(guildId);
        const autoroles = server?.getAllAutoroles() || {};
        
        if (autoroles[messageId]) {
          autoroleConfig = {
            channelId: reaction.message.channel.id,
            guildId: guildId,
            mappings: autoroles[messageId],
            createdAt: new Date()
          };
          this._autoroleMessages.set(messageId, autoroleConfig);
        }
      }

      if (!autoroleConfig) {
        return {
          success: false,
          error: 'Autorole configuration not found for this message.',
          type: 'config_not_found'
        };
      }

      // Get role ID for emoji
      const emoji = reaction.emoji.name;
      const roleId = autoroleConfig.mappings[emoji];
      
      if (!roleId) {
        return {
          success: false,
          error: 'No role configured for this emoji.',
          type: 'role_not_configured'
        };
      }

      // Get role and member
      const guild = reaction.message.guild;
      const role = guild.roles.cache.get(roleId);
      const member = guild.members.cache.get(user.id);

      if (!role) {
        return {
          success: false,
          error: 'Configured role no longer exists.',
          type: 'role_not_found'
        };
      }

      if (!member) {
        return {
          success: false,
          error: 'User not found in guild.',
          type: 'member_not_found'
        };
      }

      // Check bot permissions
      const botMember = guild.members.me;
      if (role.position >= botMember.roles.highest.position) {
        return {
          success: false,
          error: 'Cannot assign role due to hierarchy restrictions.',
          type: 'hierarchy_error'
        };
      }

      // Assign or remove role
      const action = added ? 'add' : 'remove';
      const hadRole = member.roles.cache.has(roleId);

      try {
        if (added && !hadRole) {
          await member.roles.add(role, 'Autorole reaction');
        } else if (!added && hadRole) {
          await member.roles.remove(role, 'Autorole reaction removed');
        } else {
          // No change needed
          return {
            success: true,
            action: 'no_change',
            user: { id: user.id, tag: user.tag },
            role: { id: roleId, name: role.name },
            reason: added ? 'User already has role' : 'User does not have role'
          };
        }
      } catch (error) {
        return {
          success: false,
          error: `Failed to ${action} role: ${error.message}`,
          type: 'role_operation_failed'
        };
      }

      return {
        success: true,
        action: added ? 'role_added' : 'role_removed',
        user: {
          id: user.id,
          tag: user.tag
        },
        role: {
          id: roleId,
          name: role.name,
          color: role.hexColor
        },
        emoji: emoji,
        messageId: messageId,
        timestamp: new Date()
      };
    } catch (error) {
      throw new Error(`Failed to handle autorole reaction: ${error.message}`);
    }
  }

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
  async getRoleHierarchy(guildId, useCache = true) {
    try {
      const cacheKey = `hierarchy_${guildId}`;
      
      // Check cache first
      if (useCache && this._roleCache.has(cacheKey)) {
        const cached = this._roleCache.get(cacheKey);
        const cacheAge = Date.now() - cached.timestamp;
        
        // Cache for 5 minutes
        if (cacheAge < 5 * 60 * 1000) {
          return cached.data;
        }
      }

      // This would need guild access - placeholder implementation
      const hierarchyData = {
        guildId: guildId,
        totalRoles: 0,
        roles: [],
        botPosition: 0,
        permissions: {
          canManageRoles: false,
          highestAssignablePosition: 0
        },
        lastUpdated: new Date()
      };

      // Cache the result
      if (useCache) {
        this._roleCache.set(cacheKey, {
          data: hierarchyData,
          timestamp: Date.now()
        });
      }

      return hierarchyData;
    } catch (error) {
      throw new Error(`Failed to get role hierarchy: ${error.message}`);
    }
  }

  /**
   * Get persistent roles statistics for server
   * @param {string} guildId - Discord guild ID
   * @returns {Promise<Object>} Persistent roles statistics
   * @throws {Error} When statistics calculation fails
   * @example
   * const stats = await roleService.getPersistentRoleStats('123456789');
   * console.log(`${stats.usersWithPersistentRoles} users have persistent roles`);
   */
  async getPersistentRoleStats(guildId) {
    try {
      const usersWithPersistentRoles = await this._userRepo.findUsersWithPersistentRoles();
      
      const stats = {
        guildId: guildId,
        usersWithPersistentRoles: usersWithPersistentRoles.length,
        totalPersistentRoleAssignments: 0,
        roleDistribution: {},
        averageRolesPerUser: 0,
        lastUpdated: new Date()
      };

      // Calculate detailed statistics
      for (const user of usersWithPersistentRoles) {
        const persistentRoles = user.getPersistentRoles();
        stats.totalPersistentRoleAssignments += persistentRoles.length;
        
        for (const roleId of persistentRoles) {
          stats.roleDistribution[roleId] = (stats.roleDistribution[roleId] || 0) + 1;
        }
      }

      if (usersWithPersistentRoles.length > 0) {
        stats.averageRolesPerUser = Math.round(
          (stats.totalPersistentRoleAssignments / usersWithPersistentRoles.length) * 10
        ) / 10;
      }

      return stats;
    } catch (error) {
      throw new Error(`Failed to get persistent role statistics: ${error.message}`);
    }
  }

  /**
   * Get autorole statistics for server
   * @param {string} guildId - Discord guild ID
   * @returns {Promise<Object>} Autorole statistics and configuration
   * @throws {Error} When statistics calculation fails
   * @example
   * const stats = await roleService.getAutoroleStats('123456789');
   * console.log(`${stats.totalAutoroleMessages} autorole messages configured`);
   */
  async getAutoroleStats(guildId) {
    try {
      const server = await this._configRepo.findServerById(guildId);
      const autoroles = server?.getAllAutoroles() || {};
      
      const stats = {
        guildId: guildId,
        totalAutoroleMessages: Object.keys(autoroles).length,
        totalEmojiMappings: 0,
        roleDistribution: {},
        cachedMessages: Array.from(this._autoroleMessages.keys()).length,
        lastUpdated: new Date()
      };

      // Calculate detailed statistics
      for (const [messageId, mappings] of Object.entries(autoroles)) {
        const emojiCount = Object.keys(mappings).length;
        stats.totalEmojiMappings += emojiCount;
        
        for (const roleId of Object.values(mappings)) {
          stats.roleDistribution[roleId] = (stats.roleDistribution[roleId] || 0) + 1;
        }
      }

      return stats;
    } catch (error) {
      throw new Error(`Failed to get autorole statistics: ${error.message}`);
    }
  }

  /**
   * Clean up expired operation limits
   * @param {number} [maxAge=300000] - Maximum age in milliseconds (5 minutes default)
   * @returns {number} Number of limits cleared
   * @example
   * const cleared = roleService.clearExpiredLimits();
   * console.log(`Cleared ${cleared} expired operation limits`);
   */
  clearExpiredLimits(maxAge = 300000) {
    const cutoffTime = Date.now() - maxAge;
    let cleared = 0;

    for (const [userId, timestamp] of this._operationLimits.entries()) {
      if (timestamp < cutoffTime) {
        this._operationLimits.delete(userId);
        cleared++;
      }
    }

    return cleared;
  }

  /**
   * Clear role cache for guild
   * @param {string} guildId - Discord guild ID
   * @returns {number} Number of cache entries cleared
   * @example
   * const cleared = roleService.clearRoleCache('123456789');
   * console.log(`Cleared ${cleared} cached role entries`);
   */
  clearRoleCache(guildId) {
    let cleared = 0;
    
    for (const [key, cached] of this._roleCache.entries()) {
      if (key.includes(guildId)) {
        this._roleCache.delete(key);
        cleared++;
      }
    }

    return cleared;
  }

  /**
   * Initialize autorole message cache from database
   * @param {string} guildId - Discord guild ID
   * @returns {Promise<number>} Number of autorole messages cached
   * @throws {Error} When cache initialization fails
   * @example
   * const cached = await roleService.initializeAutoroleCache('123456789');
   * console.log(`Initialized ${cached} autorole messages in cache`);
   */
  async initializeAutoroleCache(guildId) {
    try {
      const server = await this._configRepo.findServerById(guildId);
      if (!server) {
        return 0;
      }

      const autoroles = server.getAllAutoroles();
      let cached = 0;

      for (const [messageId, mappings] of Object.entries(autoroles)) {
        this._autoroleMessages.set(messageId, {
          channelId: null, // Will be updated when reaction is handled
          guildId: guildId,
          mappings: mappings,
          createdAt: new Date()
        });
        cached++;
      }

      return cached;
    } catch (error) {
      throw new Error(`Failed to initialize autorole cache: ${error.message}`);
    }
  }

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
  async createAutoRoleMessage(guildId, channelId, creatorId, title, description) {
    try {
      // Get the Discord client and guild from the channelId
      // Note: This requires the Discord client to be available
      // In a real implementation, the client would be passed to the service or available globally
      
      // For now, create a basic embed message
      const { EmbedBuilder } = require('discord.js');
      
      const embed = new EmbedBuilder()
        .setTitle(title || 'Role Assignment')
        .setDescription(description || 'React with an emoji to get the corresponding role!')
        .setColor(0x00AE86)
        .setFooter({ text: 'React to this message to get roles' })
        .setTimestamp();

      // This would need access to the Discord client to actually send the message
      // For now, create a simulated message ID and store the autorole configuration
      const messageId = `autorole_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Initialize autorole configuration in database
      const server = await this._configRepo.findServerById(guildId);
      if (!server) {
        throw new Error('Server configuration not found. Please run setup first.');
      }

      // Cache the autorole message configuration
      this._autoroleMessages.set(messageId, {
        channelId: channelId,
        guildId: guildId,
        mappings: {}, // Empty mappings, roles will be added later
        title: title,
        description: description,
        createdAt: new Date(),
        createdBy: creatorId
      });

      return {
        success: true,
        messageId: messageId,
        channelId: channelId,
        title: title,
        description: description,
        rolesCount: 0,
        embed: embed.toJSON()
      };
    } catch (error) {
      throw new Error(`Failed to create autorole message: ${error.message}`);
    }
  }

  /**
   * Add role to existing autorole message
   * @param {string} messageId - Discord message ID
   * @param {string} roleId - Role ID to add
   * @param {string} emoji - Emoji for the role
   * @param {string} [description] - Role description
   * @returns {Promise<Object>} Addition result
   * @throws {Error} When addition fails  
   */
  async addRoleToAutoRoleMessage(messageId, roleId, emoji, description = null) {
    try {
      // Get autorole configuration from cache or database
      let autoroleConfig = this._autoroleMessages.get(messageId);
      
      if (!autoroleConfig) {
        // Try to load from database
        const servers = await this._configRepo.findMany({});
        let foundServer = null;
        
        for (const serverData of servers) {
          const Server = require('../entities/Server');
          const server = Server.fromDatabase(serverData);
          const autoroles = server.getAllAutoroles();
          
          if (autoroles[messageId]) {
            foundServer = server;
            autoroleConfig = {
              channelId: null, // Will be updated when reaction is handled
              guildId: server.id,
              mappings: autoroles[messageId],
              createdAt: new Date()
            };
            this._autoroleMessages.set(messageId, autoroleConfig);
            break;
          }
        }
        
        if (!foundServer) {
          throw new Error('Autorole message not found');
        }
      }

      // Validate the role exists and can be assigned
      const guildId = autoroleConfig.guildId;
      
      // Check if emoji is already mapped to a role
      if (autoroleConfig.mappings[emoji]) {
        return {
          success: false,
          error: `Emoji ${emoji} is already mapped to a role`,
          type: 'emoji_already_mapped'
        };
      }

      // Add the role mapping
      autoroleConfig.mappings[emoji] = roleId;

      // Update database
      const server = await this._configRepo.findServerById(guildId);
      if (!server) {
        throw new Error('Server configuration not found');
      }

      server.addAutorole(messageId, emoji, roleId);
      await this._configRepo.saveServer(server);

      // Update cache
      this._autoroleMessages.set(messageId, autoroleConfig);

      return {
        success: true,
        messageId: messageId,
        roleId: roleId,
        emoji: emoji,
        description: description,
        totalRoles: Object.keys(autoroleConfig.mappings).length
      };
    } catch (error) {
      throw new Error(`Failed to add role to autorole message: ${error.message}`);
    }
  }

  /**
   * Remove role from autorole message
   * @param {string} messageId - Discord message ID
   * @param {string} roleId - Role ID to remove
   * @returns {Promise<Object>} Removal result
   * @throws {Error} When removal fails
   */
  async removeRoleFromAutoRoleMessage(messageId, roleId) {
    try {
      // Get autorole configuration from cache or database
      let autoroleConfig = this._autoroleMessages.get(messageId);
      
      if (!autoroleConfig) {
        // Try to load from database
        const servers = await this._configRepo.findMany({});
        let foundServer = null;
        
        for (const serverData of servers) {
          const Server = require('../entities/Server');
          const server = Server.fromDatabase(serverData);
          const autoroles = server.getAllAutoroles();
          
          if (autoroles[messageId]) {
            foundServer = server;
            autoroleConfig = {
              channelId: null,
              guildId: server.id,
              mappings: autoroles[messageId],
              createdAt: new Date()
            };
            this._autoroleMessages.set(messageId, autoroleConfig);
            break;
          }
        }
        
        if (!foundServer) {
          throw new Error('Autorole message not found');
        }
      }

      // Find the emoji that maps to this role
      let emojiToRemove = null;
      for (const [emoji, mappedRoleId] of Object.entries(autoroleConfig.mappings)) {
        if (mappedRoleId === roleId) {
          emojiToRemove = emoji;
          break;
        }
      }

      if (!emojiToRemove) {
        return {
          success: false,
          error: 'Role not found in autorole message',
          type: 'role_not_found'
        };
      }

      // Remove the role mapping
      delete autoroleConfig.mappings[emojiToRemove];

      // Update database
      const server = await this._configRepo.findServerById(autoroleConfig.guildId);
      if (!server) {
        throw new Error('Server configuration not found');
      }

      server.removeAutorole(messageId, emojiToRemove);
      await this._configRepo.saveServer(server);

      // Update cache
      this._autoroleMessages.set(messageId, autoroleConfig);

      return {
        success: true,
        messageId: messageId,
        roleId: roleId,
        emoji: emojiToRemove,
        remainingRoles: Object.keys(autoroleConfig.mappings).length
      };
    } catch (error) {
      throw new Error(`Failed to remove role from autorole message: ${error.message}`);
    }
  }

  /**
   * Get all autorole messages for a guild
   * @param {string} guildId - Discord guild ID
   * @returns {Promise<Array>} List of autorole messages
   * @throws {Error} When retrieval fails
   */
  async getAutoRoleMessages(guildId) {
    try {
      const server = await this._configRepo.findServerById(guildId);
      if (!server) {
        return [];
      }

      const autoroles = server.getAllAutoroles();
      const messages = [];

      for (const [messageId, mappings] of Object.entries(autoroles)) {
        // Get cached info if available
        const cachedInfo = this._autoroleMessages.get(messageId);
        
        const messageInfo = {
          messageId: messageId,
          mappings: mappings,
          roleCount: Object.keys(mappings).length,
          channelId: cachedInfo?.channelId || null,
          title: cachedInfo?.title || 'Autorole Message',
          description: cachedInfo?.description || null,
          createdAt: cachedInfo?.createdAt || null,
          createdBy: cachedInfo?.createdBy || null
        };

        // Add role details
        messageInfo.roles = [];
        for (const [emoji, roleId] of Object.entries(mappings)) {
          messageInfo.roles.push({
            emoji: emoji,
            roleId: roleId
          });
        }

        messages.push(messageInfo);
      }

      return messages;
    } catch (error) {
      throw new Error(`Failed to get autorole messages: ${error.message}`);
    }
  }

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
  async handleReactionAdd(reaction, user) {
    return await this.handleAutoroleReaction(reaction, user, true);
  }

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
  async handleReactionRemove(reaction, user) {
    return await this.handleAutoroleReaction(reaction, user, false);
  }

  /**
   * Save persistent roles when member leaves server
   * @param {string} guildId - Discord guild ID
   * @param {string} userId - User ID who left
   * @param {Collection} roleCollection - Discord role collection
   * @returns {Promise<Object>} Storage result
   * @example
   * const result = await roleService.savePersistentRoles(guildId, userId, member.roles.cache);
   */
  async savePersistentRoles(guildId, userId, roleCollection) {
    try {
      // Convert role collection to array of IDs, excluding @everyone and managed roles
      const roleIds = roleCollection
        .filter(role => role.id !== guildId && !role.managed)
        .map(role => role.id);

      return await this.storeRolesOnLeave(userId, guildId, roleIds);
    } catch (error) {
      throw new Error(`Failed to save persistent roles: ${error.message}`);
    }
  }

  /**
   * Update message ID for autorole configuration (internal helper)
   * @private
   * @param {string} tempMessageId - Temporary message ID
   * @param {string} realMessageId - Real Discord message ID
   * @returns {Promise<void>}
   */
  async _updateMessageId(tempMessageId, realMessageId) {
    try {
      // Get the temporary configuration
      const tempConfig = this._autoroleMessages.get(tempMessageId);
      if (!tempConfig) {
        return;
      }

      // Move the configuration to the real message ID
      this._autoroleMessages.set(realMessageId, tempConfig);
      this._autoroleMessages.delete(tempMessageId);

      // Update database if there are any mappings
      if (Object.keys(tempConfig.mappings).length > 0) {
        const server = await this._configRepo.findServerById(tempConfig.guildId);
        if (server) {
          // Remove old message ID mappings
          server.removeAutorole(tempMessageId);
          
          // Add new message ID mappings
          for (const [emoji, roleId] of Object.entries(tempConfig.mappings)) {
            server.addAutorole(realMessageId, emoji, roleId);
          }
          
          await this._configRepo.saveServer(server);
        }
      }
    } catch (error) {
      console.error('Failed to update message ID:', error);
    }
  }
}

module.exports = RoleService;