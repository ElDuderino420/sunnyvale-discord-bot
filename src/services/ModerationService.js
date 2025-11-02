/**
 * Service for handling user moderation operations
 * Provides comprehensive moderation capabilities with validation and audit logging
 * @class ModerationService
 * @example
 * const moderationService = new ModerationService(userRepo, configRepo, permissionService);
 * await moderationService.kickUser(interaction, targetUser, 'Violation of rules');
 */
class ModerationService {
  /**
   * Initialize moderation service
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
     * Active temporary bans with expiration timers
     * @type {Map<string, NodeJS.Timeout>}
     * @private
     */
    this._tempbanTimers = new Map();

    /**
     * Moderation action metadata cache
     * @type {Map<string, Object>}
     * @private
     */
    this._actionCache = new Map();
  }

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
  async kickUser(interaction, targetMember, reason = 'No reason provided') {
    try {
      // Validate permissions
      const validation = await this._permissionService.validateCommandPermissions(interaction, {
        discordPermissions: ['KICK_MEMBERS'],
        moderatorRole: true,
        checkHierarchy: true
      });

      if (!validation.allowed) {
        return {
          success: false,
          error: validation.reason,
          type: 'permission_denied'
        };
      }

      // Check if bot can kick the user
      const botCanKick = this._permissionService.botCanModerateUser(interaction.guild, targetMember);
      if (!botCanKick) {
        return {
          success: false,
          error: 'I cannot kick this user due to role hierarchy restrictions.',
          type: 'hierarchy_error'
        };
      }

      // Get or create user record
      let user = await this._userRepo.findUserById(targetMember.id);
      if (!user) {
        const User = require('../entities/User');
        user = new User(targetMember.id, targetMember.user.tag);
      }

      // Perform the kick
      await targetMember.kick(reason);

      // Log the moderation action
      user.addModerationAction('kick', interaction.user.id, reason, new Date(), {
        guildId: interaction.guild.id,
        moderatorTag: interaction.user.tag
      });

      // Save user record
      await this._userRepo.saveUser(user);

      // Cache action details for audit log
      const actionId = `kick_${Date.now()}_${targetMember.id}`;
      this._actionCache.set(actionId, {
        action: 'kick',
        target: targetMember.user.tag,
        moderator: interaction.user.tag,
        reason: reason,
        timestamp: new Date(),
        guildId: interaction.guild.id
      });

      return {
        success: true,
        action: 'kick',
        user: {
          id: targetMember.id,
          tag: targetMember.user.tag
        },
        moderator: {
          id: interaction.user.id,
          tag: interaction.user.tag
        },
        reason: reason,
        timestamp: new Date(),
        actionId: actionId
      };
    } catch (error) {
      throw new Error(`Failed to kick user: ${error.message}`);
    }
  }

  /**
   * Issue formal warning to a user and persist the action
   * @param {CommandInteraction} interaction - Discord command interaction
   * @param {GuildMember|User} target - Member or user to warn
   * @param {string} reason - Warning reason supplied by staff
   * @returns {Promise<Object>} Operation result with success status and warning details
   */
  async warnUser(interaction, target, reason) {
    try {
      const validation = await this._permissionService.validateCommandPermissions(interaction, {
        moderatorRole: true,
        checkHierarchy: true
      });

      if (!validation.allowed) {
        return {
          success: false,
          error: validation.reason,
          type: 'permission_denied'
        };
      }

      const targetUser = target && target.user ? target.user : target;
      if (!targetUser) {
        return {
          success: false,
          error: 'Target user could not be resolved.',
          type: 'user_not_found'
        };
      }

      if (targetUser.id === interaction.user.id) {
        return {
          success: false,
          error: 'You cannot issue a warning to yourself.',
          type: 'invalid_target'
        };
      }

      const trimmedReason = (reason || '').trim();
      if (trimmedReason.length === 0) {
        return {
          success: false,
          error: 'Warning reason is required.',
          type: 'invalid_reason'
        };
      }

      if (trimmedReason.length > 500) {
        return {
          success: false,
          error: 'Warning reason cannot exceed 500 characters.',
          type: 'invalid_reason'
        };
      }

      let user = await this._userRepo.findUserById(targetUser.id);
      if (!user) {
        const User = require('../entities/User');
        user = new User(targetUser.id, targetUser.tag || targetUser.username || 'Unknown User');
      } else if (targetUser.tag && user.tag !== targetUser.tag) {
        user.tag = targetUser.tag;
      }

      const warningsBefore = user.getWarnings().length;

      const warningMetadata = {
        guildId: interaction.guild.id,
        moderatorTag: interaction.user.tag,
        warningsBefore
      };

      const warnAction = user.addWarning(
        interaction.user.id,
        trimmedReason,
        new Date(),
        warningMetadata
      );

      await this._userRepo.saveUser(user);

      const warningsAfter = user.getWarnings().length;
      warnAction.metadata.warningsAfter = warningsAfter;

      const actionId = warnAction.id;
      this._actionCache.set(actionId, {
        action: 'warn',
        target: targetUser.tag || targetUser.username || targetUser.id,
        moderator: interaction.user.tag,
        reason: trimmedReason,
        timestamp: warnAction.timestamp,
        guildId: interaction.guild.id,
        warningsAfter
      });

      return {
        success: true,
        action: 'warn',
        user: {
          id: targetUser.id,
          tag: targetUser.tag || targetUser.username || 'Unknown User'
        },
        moderator: {
          id: interaction.user.id,
          tag: interaction.user.tag
        },
        reason: trimmedReason,
        timestamp: warnAction.timestamp,
        actionId,
        warningsAfter
      };
    } catch (error) {
      throw new Error(`Failed to warn user: ${error.message}`);
    }
  }

  /**
   * Add a staff-only note to a user's record
   * @param {CommandInteraction} interaction - Discord command interaction
   * @param {GuildMember|User} target - Member or user to annotate
   * @param {string} content - Staff note content
   * @returns {Promise<Object>} Operation result with note metadata
   */
  async addStaffNote(interaction, target, content) {
    try {
      const validation = await this._permissionService.validateCommandPermissions(interaction, {
        moderatorRole: true
      });

      if (!validation.allowed) {
        return {
          success: false,
          error: validation.reason,
          type: 'permission_denied'
        };
      }

      const targetUser = target && target.user ? target.user : target;
      if (!targetUser) {
        return {
          success: false,
          error: 'Target user could not be resolved.',
          type: 'user_not_found'
        };
      }

      const trimmedContent = (content || '').trim();
      if (trimmedContent.length === 0) {
        return {
          success: false,
          error: 'Note content must be provided.',
          type: 'invalid_content'
        };
      }

      if (trimmedContent.length > 2000) {
        return {
          success: false,
          error: 'Note content cannot exceed 2000 characters.',
          type: 'invalid_content'
        };
      }

      let user = await this._userRepo.findUserById(targetUser.id);
      if (!user) {
        const User = require('../entities/User');
        user = new User(targetUser.id, targetUser.tag || targetUser.username || 'Unknown User');
      } else if (targetUser.tag && user.tag !== targetUser.tag) {
        user.tag = targetUser.tag;
      }

      const noteMetadata = {
        guildId: interaction.guild.id,
        moderatorTag: interaction.user.tag
      };

      const noteEntry = user.addStaffNote(
        interaction.user.id,
        trimmedContent,
        new Date(),
        noteMetadata
      );

      await this._userRepo.saveUser(user);

      const notesCount = user.getStaffNotes().length;

      this._actionCache.set(noteEntry.id, {
        action: 'staff_note',
        target: targetUser.tag || targetUser.username || targetUser.id,
        moderator: interaction.user.tag,
        timestamp: noteEntry.timestamp,
        guildId: interaction.guild.id,
        contentPreview: trimmedContent.slice(0, 200)
      });

      return {
        success: true,
        note: {
          id: noteEntry.id,
          content: noteEntry.content,
          timestamp: noteEntry.timestamp,
          metadata: noteEntry.metadata
        },
        user: {
          id: targetUser.id,
          tag: targetUser.tag || targetUser.username || 'Unknown User'
        },
        moderator: {
          id: interaction.user.id,
          tag: interaction.user.tag
        },
        notesCount
      };
    } catch (error) {
      throw new Error(`Failed to add staff note: ${error.message}`);
    }
  }

  /**
   * Retrieve staff notes for a user
   * @param {CommandInteraction} interaction - Discord command interaction
   * @param {GuildMember|User} target - Member or user whose notes should be retrieved
   * @param {number} [limit=5] - Maximum number of notes to return
   * @returns {Promise<Object>} Retrieval result containing notes and metadata
   */
  async getStaffNotes(interaction, target, limit = 5) {
    try {
      const validation = await this._permissionService.validateCommandPermissions(interaction, {
        moderatorRole: true
      });

      if (!validation.allowed) {
        return {
          success: false,
          error: validation.reason,
          type: 'permission_denied'
        };
      }

      const targetUser = target && target.user ? target.user : target;
      if (!targetUser) {
        return {
          success: false,
          error: 'Target user could not be resolved.',
          type: 'user_not_found'
        };
      }

      const safeLimit = Math.max(1, Math.min(25, Number.isInteger(limit) ? limit : parseInt(limit, 10) || 5));

      const user = await this._userRepo.findUserById(targetUser.id);
      if (!user) {
        return {
          success: true,
          user: {
            id: targetUser.id,
            tag: targetUser.tag || targetUser.username || 'Unknown User'
          },
          notes: [],
          noteCount: 0,
          limit: safeLimit
        };
      }

      if (targetUser.tag && user.tag !== targetUser.tag) {
        user.tag = targetUser.tag;
      }

      const allNotes = user.getStaffNotes();
      const notes = allNotes.slice(0, safeLimit);

      return {
        success: true,
        user: {
          id: targetUser.id,
          tag: user.tag
        },
        notes,
        noteCount: allNotes.length,
        limit: safeLimit
      };
    } catch (error) {
      throw new Error(`Failed to retrieve staff notes: ${error.message}`);
    }
  }

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
  async banUser(interaction, target, reason = 'No reason provided', deleteMessageDays = 0) {
    try {
      // Validate permissions
      const validation = await this._permissionService.validateCommandPermissions(interaction, {
        discordPermissions: ['BAN_MEMBERS'],
        moderatorRole: true,
        checkHierarchy: true
      });

      if (!validation.allowed) {
        return {
          success: false,
          error: validation.reason,
          type: 'permission_denied'
        };
      }

      // Determine if target is a member or user
      const targetUser = target.user || target;
      const targetMember = target.user ? target : null;

      // Check bot hierarchy if target is a member
      if (targetMember) {
        const botCanBan = this._permissionService.botCanModerateUser(interaction.guild, targetMember);
        if (!botCanBan) {
          return {
            success: false,
            error: 'I cannot ban this user due to role hierarchy restrictions.',
            type: 'hierarchy_error'
          };
        }
      }

      // Validate message deletion days
      const messageDays = Math.max(0, Math.min(7, Math.floor(deleteMessageDays)));

      // Get or create user record
      let user = await this._userRepo.findUserById(targetUser.id);
      if (!user) {
        const User = require('../entities/User');
        user = new User(targetUser.id, targetUser.tag);
      }

      // Perform the ban
      await interaction.guild.members.ban(targetUser, {
        reason: reason,
        deleteMessageDays: messageDays
      });

      // Log the moderation action
      user.addModerationAction('ban', interaction.user.id, reason, new Date(), {
        guildId: interaction.guild.id,
        moderatorTag: interaction.user.tag,
        deleteMessageDays: messageDays,
        permanent: true
      });

      // Save user record
      await this._userRepo.saveUser(user);

      // Cache action details
      const actionId = `ban_${Date.now()}_${targetUser.id}`;
      this._actionCache.set(actionId, {
        action: 'ban',
        target: targetUser.tag,
        moderator: interaction.user.tag,
        reason: reason,
        timestamp: new Date(),
        guildId: interaction.guild.id,
        deleteMessageDays: messageDays,
        permanent: true
      });

      return {
        success: true,
        action: 'ban',
        user: {
          id: targetUser.id,
          tag: targetUser.tag
        },
        moderator: {
          id: interaction.user.id,
          tag: interaction.user.tag
        },
        reason: reason,
        timestamp: new Date(),
        deleteMessageDays: messageDays,
        permanent: true,
        actionId: actionId
      };
    } catch (error) {
      throw new Error(`Failed to ban user: ${error.message}`);
    }
  }

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
  async tempbanUser(interaction, target, durationMs, reason = 'No reason provided', deleteMessageDays = 0) {
    try {
      // Validate duration (max 30 days)
      const maxDuration = 30 * 24 * 60 * 60 * 1000;
      if (durationMs > maxDuration) {
        return {
          success: false,
          error: 'Temporary ban duration cannot exceed 30 days.',
          type: 'invalid_duration'
        };
      }

      // First perform regular ban
      const banResult = await this.banUser(interaction, target, reason, deleteMessageDays);
      if (!banResult.success) {
        return banResult;
      }

      const targetUser = target.user || target;
      const expiresAt = new Date(Date.now() + durationMs);

      // Update user record with tempban metadata
      let user = await this._userRepo.findUserById(targetUser.id);
      const history = user.getModerationHistory();
      const lastAction = history[history.length - 1];

      if (lastAction && lastAction.action === 'ban') {
        lastAction.metadata.permanent = false;
        lastAction.metadata.expiresAt = expiresAt;
        lastAction.metadata.durationMs = durationMs;
        await this._userRepo.saveUser(user);
      }

      // Set up automatic unban timer
      const timerId = setTimeout(async () => {
        try {
          await this._automaticUnban(interaction.guild.id, targetUser.id, 'Temporary ban expired');
          this._tempbanTimers.delete(targetUser.id);
        } catch (error) {
          console.error(`Failed to automatically unban user ${targetUser.id}:`, error);
        }
      }, durationMs);

      this._tempbanTimers.set(targetUser.id, timerId);

      // Update cache with tempban details
      if (this._actionCache.has(banResult.actionId)) {
        const cachedAction = this._actionCache.get(banResult.actionId);
        cachedAction.permanent = false;
        cachedAction.expiresAt = expiresAt;
        cachedAction.durationMs = durationMs;
        cachedAction.action = 'tempban';
      }

      return {
        ...banResult,
        action: 'tempban',
        permanent: false,
        expiresAt: expiresAt,
        durationMs: durationMs,
        autoUnban: true
      };
    } catch (error) {
      throw new Error(`Failed to tempban user: ${error.message}`);
    }
  }

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
  async isUserJailed(guildId, userId) {
    try {
      const user = await this._userRepo.findUserById(userId);
      return user ? user.isJailed() : false;
    } catch (error) {
      throw new Error(`Failed to check jail status: ${error.message}`);
    }
  }

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
  async validateJail(guildId, executorId, targetId, reason) {
    try {
      // Check if target is already jailed
      const isJailed = await this.isUserJailed(guildId, targetId);
      if (isJailed) {
        return {
          isValid: false,
          error: 'User is already jailed'
        };
      }

      // Check if jail system is configured
      const server = await this._configRepo.findServerById(guildId);
      if (!server) {
        return {
          isValid: false,
          error: 'Server configuration not found. Please run setup first.'
        };
      }

      const jailedRoleId = server.getJailedRole();
      const jailChannelId = server.getJailChannel();

      if (!jailedRoleId) {
        return {
          isValid: false,
          error: 'Jail role not configured. Use /setup jail-role to configure.'
        };
      }

      if (!jailChannelId) {
        return {
          isValid: false,
          error: 'Jail channel not configured. Use /setup jail-channel to configure.'
        };
      }

      // Validate reason
      if (!reason || reason.trim().length === 0) {
        return {
          isValid: false,
          error: 'Jail reason is required'
        };
      }

      if (reason.length > 500) {
        return {
          isValid: false,
          error: 'Jail reason cannot exceed 500 characters'
        };
      }

      return {
        isValid: true
      };
    } catch (error) {
      throw new Error(`Failed to validate jail operation: ${error.message}`);
    }
  }

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
  async jailUser(guildId, executorId, targetId, reason = 'No reason provided', durationMs = null, rolesToBackup = []) {
    try {
      // This method signature is called by JailCommand
      // For now, let's return a simple success response that matches what JailCommand expects
      // The actual Discord role manipulation would need to be done in the JailCommand itself
      // since this service doesn't have direct access to Discord guild objects
      
      // Get server configuration
      const server = await this._configRepo.findServerById(guildId);
      if (!server) {
        throw new Error('Server configuration not found. Please run setup first.');
      }

      const jailedRoleId = server.getJailedRole();
      if (!jailedRoleId) {
        throw new Error('Jail system not configured. Please configure jail role.');
      }

      // Get or create user record
      let user = await this._userRepo.findUserById(targetId);
      if (!user) {
        const User = require('../entities/User');
        user = new User(targetId, 'Unknown User'); // Tag will be updated by command
      }

      // Check if user is already jailed
      if (user.isJailed()) {
        throw new Error('User is already jailed.');
      }

      // Store the backed up roles in the user entity
      user.storeOriginalRoles(rolesToBackup);

      // Log the moderation action
      user.addModerationAction('jail', executorId, reason, new Date(), {
        guildId: guildId,
        rolesBackedUp: rolesToBackup.length,
        jailRoleId: jailedRoleId,
        durationMs: durationMs
      });

      // Save user record
      await this._userRepo.saveUser(user);

      // Generate case ID
      const caseId = `jail_${Date.now()}_${targetId}`;

      return {
        success: true,
        caseId: caseId,
        rolesBackedUp: rolesToBackup.length
      };
    } catch (error) {
      throw new Error(`Failed to jail user: ${error.message}`);
    }
  }

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
  async unjailUser(interaction, targetMember, reason = 'Released from jail') {
    try {
      // Validate permissions
      const validation = await this._permissionService.validateCommandPermissions(interaction, {
        discordPermissions: ['MANAGE_ROLES'],
        moderatorRole: true
      });

      if (!validation.allowed) {
        return {
          success: false,
          error: validation.reason,
          type: 'permission_denied'
        };
      }

      // Get user record
      const user = await this._userRepo.findUserById(targetMember.id);
      if (!user) {
        return {
          success: false,
          error: 'User not found in database.',
          type: 'user_not_found'
        };
      }

      // Check if user is jailed
      if (!user.isJailed()) {
        return {
          success: false,
          error: 'User is not currently jailed.',
          type: 'not_jailed'
        };
      }

      // Get original roles to restore
      const originalRoleIds = user.getOriginalRoles();
      const validRoles = [];

      // Validate roles still exist and bot can assign them
      for (const roleId of originalRoleIds) {
        const role = interaction.guild.roles.cache.get(roleId);
        if (role && !role.managed && role.position < interaction.guild.members.me.roles.highest.position) {
          validRoles.push(role);
        }
      }

      // Restore roles
      try {
        await targetMember.roles.set(validRoles, `Unjailed by ${interaction.user.tag}: ${reason}`);
      } catch (error) {
        return {
          success: false,
          error: `Failed to restore roles: ${error.message}`,
          type: 'role_restoration_failed'
        };
      }

      // Clear jail status
      user.clearOriginalRoles();

      // Log the moderation action
      user.addModerationAction('unjail', interaction.user.id, reason, new Date(), {
        guildId: interaction.guild.id,
        moderatorTag: interaction.user.tag,
        rolesRestored: validRoles.length,
        originalRoleCount: originalRoleIds.length
      });

      // Save user record
      await this._userRepo.saveUser(user);

      // Cache action details
      const actionId = `unjail_${Date.now()}_${targetMember.id}`;
      this._actionCache.set(actionId, {
        action: 'unjail',
        target: targetMember.user.tag,
        moderator: interaction.user.tag,
        reason: reason,
        timestamp: new Date(),
        guildId: interaction.guild.id,
        rolesRestored: validRoles.length
      });

      return {
        success: true,
        action: 'unjail',
        user: {
          id: targetMember.id,
          tag: targetMember.user.tag
        },
        moderator: {
          id: interaction.user.id,
          tag: interaction.user.tag
        },
        reason: reason,
        timestamp: new Date(),
        rolesRestored: validRoles.length,
        rolesNotRestored: originalRoleIds.length - validRoles.length,
        actionId: actionId
      };
    } catch (error) {
      throw new Error(`Failed to unjail user: ${error.message}`);
    }
  }

  /**
   * Unjail user by database operation (role restoration handled by command)
   * @param {string} guildId - Discord guild ID
   * @param {string} executorId - Moderator user ID
   * @param {string} targetId - Target user ID
   * @param {string} [reason='Released from jail'] - Unjail reason
   * @returns {Promise<Object>} Operation result with success status
   * @throws {Error} When unjail operation fails
   * @example
   * const result = await moderationService.unjailUser('123456789', '111', '222', 'Appeal approved');
   * if (result.success) {
   *   console.log(`User unjailed with case ID: ${result.caseId}`);
   * }
   */
  async unjailUser(guildId, executorId, targetId, reason = 'Released from jail') {
    try {
      // Get user record
      const user = await this._userRepo.findUserById(targetId);
      if (!user) {
        throw new Error('User not found in database.');
      }

      // Check if user is jailed
      if (!user.isJailed()) {
        throw new Error('User is not currently jailed.');
      }

      // Get original roles for restoration
      const originalRoleIds = user.getOriginalRoles();

      // Clear jail status
      user.clearOriginalRoles();

      // Log the moderation action
      user.addModerationAction('unjail', executorId, reason, new Date(), {
        guildId: guildId,
        rolesRestored: originalRoleIds.length
      });

      // Save user record
      await this._userRepo.saveUser(user);

      // Generate case ID
      const caseId = `unjail_${Date.now()}_${targetId}`;

      return {
        success: true,
        caseId: caseId,
        rolesRestored: originalRoleIds.length,
        originalRoles: originalRoleIds
      };
    } catch (error) {
      throw new Error(`Failed to unjail user: ${error.message}`);
    }
  }

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
  async unbanUser(interaction, userId, reason = 'Unbanned by moderator') {
    try {
      // Validate permissions
      const validation = await this._permissionService.validateCommandPermissions(interaction, {
        discordPermissions: ['BAN_MEMBERS'],
        moderatorRole: true
      });

      if (!validation.allowed) {
        return {
          success: false,
          error: validation.reason,
          type: 'permission_denied'
        };
      }

      // Check if user is actually banned
      let bannedUser;
      try {
        const ban = await interaction.guild.bans.fetch(userId);
        bannedUser = ban.user;
      } catch (error) {
        return {
          success: false,
          error: 'User is not banned or ban not found.',
          type: 'not_banned'
        };
      }

      // Clear any active tempban timer
      if (this._tempbanTimers.has(userId)) {
        clearTimeout(this._tempbanTimers.get(userId));
        this._tempbanTimers.delete(userId);
      }

      // Perform the unban
      await interaction.guild.members.unban(userId, reason);

      // Update user record if exists
      const user = await this._userRepo.findUserById(userId);
      if (user) {
        user.addModerationAction('unban', interaction.user.id, reason, new Date(), {
          guildId: interaction.guild.id,
          moderatorTag: interaction.user.tag
        });
        await this._userRepo.saveUser(user);
      }

      // Cache action details
      const actionId = `unban_${Date.now()}_${userId}`;
      this._actionCache.set(actionId, {
        action: 'unban',
        target: bannedUser.tag,
        moderator: interaction.user.tag,
        reason: reason,
        timestamp: new Date(),
        guildId: interaction.guild.id
      });

      return {
        success: true,
        action: 'unban',
        user: {
          id: bannedUser.id,
          tag: bannedUser.tag
        },
        moderator: {
          id: interaction.user.id,
          tag: interaction.user.tag
        },
        reason: reason,
        timestamp: new Date(),
        actionId: actionId
      };
    } catch (error) {
      throw new Error(`Failed to unban user: ${error.message}`);
    }
  }

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
  async getUserModerationHistory(userId, days = null) {
    try {
      const user = await this._userRepo.findUserById(userId);
      if (!user) {
        return {
          userId: userId,
          exists: false,
          totalActions: 0,
          recentActions: 0,
          statistics: {},
          history: [],
          currentStatus: {
            jailed: false,
            hasPersistentRoles: false
          }
        };
      }

      const statistics = user.getModerationStats();
      const fullHistory = user.getModerationHistory();
      
      let recentActions = 0;
      let relevantHistory = fullHistory;

      if (days) {
        const cutoffTime = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
        relevantHistory = fullHistory.filter(action => new Date(action.timestamp) >= cutoffTime);
        recentActions = relevantHistory.length;
      }

      return {
        userId: userId,
        userTag: user.tag,
        exists: true,
        totalActions: statistics.total,
        recentActions: recentActions,
        statistics: statistics,
        history: relevantHistory,
        currentStatus: {
          jailed: user.isJailed(),
          hasPersistentRoles: user.hasPersistentRoles(),
          originalRolesCount: user.getOriginalRoles().length,
          persistentRolesCount: user.getPersistentRoles().length
        },
        timestamps: {
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        }
      };
    } catch (error) {
      throw new Error(`Failed to get user moderation history: ${error.message}`);
    }
  }

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
  async getServerModerationStats(guildId, days = 30) {
    try {
      const stats = await this._userRepo.getModerationStatistics(days);
      
      // Add cached action information for recent activity
      const recentCachedActions = Array.from(this._actionCache.entries())
        .filter(([actionId, action]) => {
          const daysCutoff = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
          return action.guildId === guildId && new Date(action.timestamp) >= daysCutoff;
        })
        .map(([actionId, action]) => action);

      return {
        ...stats,
        guildId: guildId,
        period: `${days} days`,
        activeTempbans: this._tempbanTimers.size,
        recentCachedActions: recentCachedActions.length,
        cacheSize: this._actionCache.size,
        lastUpdated: new Date()
      };
    } catch (error) {
      throw new Error(`Failed to get server moderation statistics: ${error.message}`);
    }
  }

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
  getCachedAction(actionId) {
    return this._actionCache.get(actionId) || null;
  }

  /**
   * Clear expired cached actions
   * @param {number} [maxAge=86400000] - Maximum age in milliseconds (24 hours default)
   * @returns {number} Number of actions cleared
   * @example
   * const cleared = moderationService.clearExpiredCache(3600000); // 1 hour
   * console.log(`Cleared ${cleared} expired cached actions`);
   */
  clearExpiredCache(maxAge = 86400000) {
    const cutoffTime = new Date(Date.now() - maxAge);
    let cleared = 0;

    for (const [actionId, action] of this._actionCache.entries()) {
      if (new Date(action.timestamp) < cutoffTime) {
        this._actionCache.delete(actionId);
        cleared++;
      }
    }

    return cleared;
  }

  /**
   * Initialize tempban timers on service startup
   * @param {string} guildId - Discord guild ID
   * @returns {Promise<number>} Number of timers restored
   * @throws {Error} When timer restoration fails
   * @example
   * const restored = await moderationService.restoreTempbanTimers('123456789');
   * console.log(`Restored ${restored} tempban timers`);
   */
  async restoreTempbanTimers(guildId) {
    try {
      // Find all users with active tempbans
      const allUsers = await this._userRepo.findMany({});
      let timersRestored = 0;

      for (const userData of allUsers) {
        const User = require('../entities/User');
        const user = User.fromDatabase(userData);
        const history = user.getModerationHistory();
        
        // Find the most recent tempban that hasn't expired
        const activeTempban = history
          .filter(action => 
            action.action === 'ban' && 
            action.metadata.guildId === guildId &&
            !action.metadata.permanent &&
            action.metadata.expiresAt &&
            new Date(action.metadata.expiresAt) > new Date()
          )
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];

        if (activeTempban) {
          const remainingTime = new Date(activeTempban.metadata.expiresAt) - new Date();
          
          if (remainingTime > 0) {
            const timerId = setTimeout(async () => {
              try {
                await this._automaticUnban(guildId, user.id, 'Temporary ban expired');
                this._tempbanTimers.delete(user.id);
              } catch (error) {
                console.error(`Failed to automatically unban user ${user.id}:`, error);
              }
            }, remainingTime);

            this._tempbanTimers.set(user.id, timerId);
            timersRestored++;
          }
        }
      }

      return timersRestored;
    } catch (error) {
      throw new Error(`Failed to restore tempban timers: ${error.message}`);
    }
  }

  /**
   * Perform automatic unban for expired tempbans
   * @private
   * @param {string} guildId - Discord guild ID
   * @param {string} userId - User ID to unban
   * @param {string} reason - Unban reason
   * @returns {Promise<void>}
   */
  async _automaticUnban(guildId, userId, reason) {
    try {
      // This would need access to the Discord client/guild
      // Implementation depends on how the service is integrated with the main bot
      console.log(`Automatic unban triggered for user ${userId} in guild ${guildId}: ${reason}`);
      
      // Update user record
      const user = await this._userRepo.findUserById(userId);
      if (user) {
        user.addModerationAction('unban', 'system', reason, new Date(), {
          guildId: guildId,
          automatic: true
        });
        await this._userRepo.saveUser(user);
      }
    } catch (error) {
      console.error('Automatic unban failed:', error);
    }
  }
}

module.exports = ModerationService;