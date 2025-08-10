const { SlashCommandBuilder } = require('discord.js');

/**
 * Abstract base class for all Discord slash commands
 * Enforces consistent command structure, permission checking, and error handling
 * @abstract
 * @class BaseCommand
 * @example
 * class KickCommand extends BaseCommand {
 *   constructor(moderationService) {
 *     super();
 *     this.moderationService = moderationService;
 *   }
 *   
 *   get data() {
 *     return new SlashCommandBuilder()
 *       .setName('kick')
 *       .setDescription('Kick a user from the server');
 *   }
 *   
 *   async execute(interaction) {
 *     // Implementation
 *   }
 * }
 */
class BaseCommand {
  /**
   * Initialize base command
   * @throws {Error} When attempting to instantiate abstract class
   */
  constructor() {
    if (this.constructor === BaseCommand) {
      throw new Error('Cannot instantiate abstract class BaseCommand');
    }

    /**
     * Command category for organization
     * @type {string}
     * @protected
     */
    this._category = 'general';
    
    /**
     * Required permissions for command execution
     * @type {Array<string>}
     * @protected
     */
    this._requiredPermissions = [];
    
    /**
     * Required roles for command execution (role IDs or names)
     * @type {Array<string>}
     * @protected
     */
    this._requiredRoles = [];
    
    /**
     * Whether command requires guild context (not available in DMs)
     * @type {boolean}
     * @protected
     */
    this._guildOnly = true;
    
    /**
     * Command cooldown in milliseconds
     * @type {number}
     * @protected
     */
    this._cooldown = 3000;
    
    /**
     * User cooldown tracking
     * @type {Map<string, number>}
     * @private
     */
    this._cooldowns = new Map();
  }

  /**
   * Command metadata for Discord registration
   * Must be implemented by subclasses
   * @abstract
   * @returns {SlashCommandBuilder} Discord slash command data
   * @throws {Error} When not implemented by subclass
   * @example
   * get data() {
   *   return new SlashCommandBuilder()
   *     .setName('example')
   *     .setDescription('Example command');
   * }
   */
  get data() {
    throw new Error('Command data must be implemented by subclass');
  }

  /**
   * Execute command with comprehensive validation and error handling
   * Must be implemented by subclasses
   * @abstract
   * @param {CommandInteraction} interaction - Discord slash command interaction
   * @returns {Promise<void>}
   * @throws {Error} When not implemented by subclass
   * @example
   * async execute(interaction) {
   *   await interaction.reply('Command executed!');
   * }
   */
  async execute(interaction) {
    throw new Error('Command execute method must be implemented by subclass');
  }

  /**
   * Validate and execute command with full error handling pipeline
   * This method handles all common validation before calling execute()
   * @param {CommandInteraction} interaction - Discord slash command interaction
   * @returns {Promise<void>}
   * @throws {Error} When validation or execution fails
   */
  async run(interaction) {
    try {
      // Defer reply immediately for any command with permissions or roles
      // This prevents Discord's 3-second timeout during validation
      const needsDefer = this._requiredRoles.length > 0 || this._requiredPermissions.length > 0;
      if (needsDefer) {
        await interaction.deferReply();
      }

      // Validate guild context
      if (this._guildOnly && !interaction.guild) {
        const content = 'This command can only be used in a server.';
        if (needsDefer) {
          await interaction.editReply({ content });
        } else {
          await interaction.reply({
            content,
            flags: [4] // MessageFlags.Ephemeral
          });
        }
        return;
      }

      // Check cooldown
      if (this._isOnCooldown(interaction.user.id)) {
        const remainingTime = this._getRemainingCooldown(interaction.user.id);
        const content = `Please wait ${Math.ceil(remainingTime / 1000)} seconds before using this command again.`;
        if (needsDefer) {
          await interaction.editReply({ content });
        } else {
          await interaction.reply({
            content,
            flags: [4] // MessageFlags.Ephemeral
          });
        }
        return;
      }

      // Validate permissions
      const hasPermission = await this.validatePermissions(interaction);
      if (!hasPermission) {
        const content = 'You do not have permission to use this command.';
        if (needsDefer) {
          await interaction.editReply({ content });
        } else {
          await interaction.reply({
            content,
            flags: [4] // MessageFlags.Ephemeral
          });
        }
        return;
      }

      // Set cooldown
      this._setCooldown(interaction.user.id);

      // Mark if interaction was deferred for command execution
      interaction._wasDeferred = needsDefer;

      // Execute command
      await this.execute(interaction);
      
    } catch (error) {
      console.error(`Error executing command ${this.data.name}:`, error);
      
      const errorMessage = this._getErrorMessage(error);
      
      // Handle interaction response
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: errorMessage,
          flags: [4] // MessageFlags.Ephemeral
        });
      } else if (interaction.deferred) {
        await interaction.editReply({
          content: errorMessage
        });
      } else {
        await interaction.followUp({
          content: errorMessage,
          flags: [4] // MessageFlags.Ephemeral
        });
      }
    }
  }

  /**
   * Validate user permissions before command execution
   * Can be overridden by subclasses for custom permission logic
   * @protected
   * @param {CommandInteraction} interaction - Discord interaction
   * @returns {Promise<boolean>} Permission validation result
   * @example
   * async validatePermissions(interaction) {
   *   return interaction.member.permissions.has('MANAGE_MESSAGES');
   * }
   */
  async validatePermissions(interaction) {
    try {
      // Check Discord permissions
      if (this._requiredPermissions.length > 0) {
        const member = interaction.guild.members.cache.get(interaction.user.id);
        if (!member) {
          return false;
        }

        const hasDiscordPermissions = this._requiredPermissions.every(permission => 
          member.permissions.has(permission)
        );
        
        if (!hasDiscordPermissions) {
          return false;
        }
      }

      // Check required roles
      if (this._requiredRoles.length > 0) {
        const member = interaction.guild.members.cache.get(interaction.user.id);
        if (!member) {
          return false;
        }

        const hasRequiredRole = this._requiredRoles.some(roleIdOrName => {
          // Check by role ID
          if (member.roles.cache.has(roleIdOrName)) {
            return true;
          }
          
          // Check by role name
          return member.roles.cache.some(role => 
            role.name.toLowerCase() === roleIdOrName.toLowerCase()
          );
        });

        if (!hasRequiredRole) {
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('Error validating permissions:', error);
      return false;
    }
  }

  /**
   * Check if user is on cooldown
   * @private
   * @param {string} userId - Discord user ID
   * @returns {boolean} Whether user is on cooldown
   */
  _isOnCooldown(userId) {
    const lastUsed = this._cooldowns.get(userId);
    if (!lastUsed) {
      return false;
    }

    return Date.now() - lastUsed < this._cooldown;
  }

  /**
   * Get remaining cooldown time in milliseconds
   * @private
   * @param {string} userId - Discord user ID
   * @returns {number} Remaining cooldown time
   */
  _getRemainingCooldown(userId) {
    const lastUsed = this._cooldowns.get(userId);
    if (!lastUsed) {
      return 0;
    }

    return Math.max(0, this._cooldown - (Date.now() - lastUsed));
  }

  /**
   * Set cooldown for user
   * @private
   * @param {string} userId - Discord user ID
   */
  _setCooldown(userId) {
    this._cooldowns.set(userId, Date.now());
    
    // Clean up old cooldowns periodically
    if (this._cooldowns.size > 100) {
      this._cleanupCooldowns();
    }
  }

  /**
   * Clean up expired cooldowns
   * @private
   */
  _cleanupCooldowns() {
    const now = Date.now();
    for (const [userId, lastUsed] of this._cooldowns.entries()) {
      if (now - lastUsed > this._cooldown) {
        this._cooldowns.delete(userId);
      }
    }
  }

  /**
   * Get user-friendly error message
   * @private
   * @param {Error} error - Error object
   * @returns {string} User-friendly error message
   */
  _getErrorMessage(error) {
    // Custom error types
    if (error.name === 'PermissionError') {
      return 'You do not have permission to perform this action.';
    }
    
    if (error.name === 'ValidationError') {
      return `Invalid input: ${error.message}`;
    }
    
    if (error.name === 'RateLimitError') {
      return 'Rate limit exceeded. Please try again later.';
    }

    // Generic error message for users
    return 'An error occurred while executing this command. Please try again later.';
  }

  /**
   * Get command category
   * @returns {string} Command category
   */
  get category() {
    return this._category;
  }

  /**
   * Set command category
   * @protected
   * @param {string} category - Command category
   */
  set category(category) {
    this._category = category;
  }

  /**
   * Get required permissions
   * @returns {Array<string>} Required Discord permissions
   */
  get requiredPermissions() {
    return [...this._requiredPermissions];
  }

  /**
   * Set required permissions
   * @protected
   * @param {Array<string>} permissions - Required Discord permissions
   */
  set requiredPermissions(permissions) {
    this._requiredPermissions = Array.isArray(permissions) ? permissions : [];
  }

  /**
   * Get required roles
   * @returns {Array<string>} Required role IDs or names
   */
  get requiredRoles() {
    return [...this._requiredRoles];
  }

  /**
   * Set required roles
   * @protected
   * @param {Array<string>} roles - Required role IDs or names
   */
  set requiredRoles(roles) {
    this._requiredRoles = Array.isArray(roles) ? roles : [];
  }

  /**
   * Get guild-only setting
   * @returns {boolean} Whether command is guild-only
   */
  get guildOnly() {
    return this._guildOnly;
  }

  /**
   * Set guild-only setting
   * @protected
   * @param {boolean} guildOnly - Whether command is guild-only
   */
  set guildOnly(guildOnly) {
    this._guildOnly = Boolean(guildOnly);
  }

  /**
   * Get command cooldown in milliseconds
   * @returns {number} Cooldown duration
   */
  get cooldown() {
    return this._cooldown;
  }

  /**
   * Set command cooldown
   * @protected
   * @param {number} cooldown - Cooldown duration in milliseconds
   */
  set cooldown(cooldown) {
    this._cooldown = Math.max(0, Number(cooldown) || 0);
  }
}

module.exports = BaseCommand;