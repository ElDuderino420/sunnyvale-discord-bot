const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const BaseCommand = require('../BaseCommand');

/**
 * Jail command for confining users to a specific channel
 * Implements complex role management with backup and restore functionality
 * @class JailCommand
 * @extends BaseCommand
 */
class JailCommand extends BaseCommand {
  /**
   * Initialize jail command with moderation service dependency
   * @param {ModerationService} moderationService - Service for moderation operations
   * @param {ConfigRepository} configRepository - Repository for server configuration
   */
  constructor(moderationService, configRepository) {
    super();
    this.moderationService = moderationService;
    this.configRepository = configRepository;
    this._category = 'moderation';
    this._requiredRoles = ['moderation']; // Ensure BaseCommand defers interaction (validated dynamically)
    this._cooldown = 5000;
  }

  /**
   * Command metadata for Discord registration
   * @returns {SlashCommandBuilder} Discord slash command data
   */
  get data() {
    return new SlashCommandBuilder()
      .setName('jail')
      .setDescription('Confine a user to the jail channel')
      .addUserOption(option =>
        option.setName('target')
          .setDescription('The user to jail')
          .setRequired(true))
      .addStringOption(option =>
        option.setName('reason')
          .setDescription('Reason for jailing the user')
          .setRequired(true)
          .setMaxLength(500))
      .addStringOption(option =>
        option.setName('duration')
          .setDescription('Jail duration (e.g., 1h, 2d) - leave empty for indefinite')
          .setRequired(false))
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles);
  }

  /**
   * Execute jail command with role backup and management
   * @param {CommandInteraction} interaction - Discord slash command interaction
   * @returns {Promise<void>}
   */
  async execute(interaction) {
    try {
      // Get command parameters
      const target = interaction.options.getUser('target');
      const reason = interaction.options.getString('reason');
      const durationStr = interaction.options.getString('duration');
      const executor = interaction.member;

      // Parse duration if provided
      let duration = null;
      if (durationStr) {
        duration = this._parseDuration(durationStr);
        if (!duration) {
          await interaction.editReply({
            content: '❌ Invalid duration format. Use formats like: `1h`, `2d`, `1w`, `30m`\n' +
                    'Supported units: m (minutes), h (hours), d (days), w (weeks)'
          });
          return;
        }

        // Validate duration limits (max 7 days for jail)
        const maxDuration = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
        if (duration > maxDuration) {
          await interaction.editReply({
            content: '❌ Maximum jail duration is 7 days. For longer punishments, use ban commands.'
          });
          return;
        }
      }

      // Get target member object
      const targetMember = await interaction.guild.members.fetch(target.id).catch(() => null);
      
      if (!targetMember) {
        await interaction.editReply({
          content: `❌ User ${target.tag} is not a member of this server.`
        });
        return;
      }

      // Check if user is already jailed
      const isJailed = await this.moderationService.isUserJailed(interaction.guild.id, target.id);
      if (isJailed) {
        await interaction.editReply({
          content: `❌ User ${target.tag} is already jailed.`
        });
        return;
      }

      // Validate jail operation
      const validationResult = await this.moderationService.validateJail(
        interaction.guild.id,
        executor.id,
        target.id,
        reason
      );

      if (!validationResult.isValid) {
        await interaction.editReply({
          content: `❌ Cannot jail user: ${validationResult.error}`
        });
        return;
      }

      // Get server configuration for role manipulation
      const server = await this.configRepository.findServerById(interaction.guild.id);
      if (!server) {
        await interaction.editReply({
          content: '❌ Server configuration not found. Please run setup first.'
        });
        return;
      }

      const jailedRoleId = server.getJailedRole();
      if (!jailedRoleId) {
        await interaction.editReply({
          content: '❌ Jail role not configured. Use `/setup jail-role` to configure.'
        });
        return;
      }

      // Get jail role
      const jailRole = interaction.guild.roles.cache.get(jailedRoleId);
      if (!jailRole) {
        await interaction.editReply({
          content: '❌ Jail role not found. Please reconfigure jail system with `/setup jail-role`.'
        });
        return;
      }

      // Backup current roles (excluding @everyone and managed roles)
      const rolesToBackup = targetMember.roles.cache
        .filter(role => role.id !== interaction.guild.id && !role.managed)
        .map(role => role.id);

      // Perform Discord role manipulation
      try {
        await targetMember.roles.set([jailRole.id], `Jailed by ${executor.user.tag}: ${reason}`);
      } catch (error) {
        await interaction.editReply({
          content: `❌ Failed to modify roles: ${error.message}`
        });
        return;
      }

      // Execute jail operation in database
      const jailResult = await this.moderationService.jailUser(
        interaction.guild.id,
        executor.id,
        target.id,
        reason,
        duration,
        rolesToBackup
      );

      // Update the roles backed up count
      jailResult.rolesBackedUp = rolesToBackup.length;

      // Format response based on duration
      let durationText = 'indefinitely';
      let expiresText = '';
      
      if (duration) {
        durationText = `for ${durationStr}`;
        const expiresAt = new Date(Date.now() + duration);
        const expiresTimestamp = Math.floor(expiresAt.getTime() / 1000);
        expiresText = `\n**Expires:** <t:${expiresTimestamp}:F> (<t:${expiresTimestamp}:R>)`;
      }

      // Send success response
      await interaction.editReply({
        content: `🔒 Successfully jailed ${target.tag} ${durationText}\n` +
                `**Reason:** ${reason}\n` +
                `**Case ID:** ${jailResult.caseId}\n` +
                `**Moderator:** ${executor.user.tag}\n` +
                `**Roles backed up:** ${jailResult.rolesBackedUp} role(s)${expiresText}`
      });

      // Log the action (handled by ModerationService)
      console.log(`User ${target.tag} (${target.id}) jailed by ${executor.user.tag} (${executor.id}) - Reason: ${reason}`);

    } catch (error) {
      console.error('Error executing jail command:', error);
      
      // Handle specific error types
      if (error.name === 'PermissionError') {
        await interaction.editReply({
          content: '❌ I don\'t have permission to manage this user\'s roles. Please check my role hierarchy and permissions.'
        });
      } else if (error.name === 'ValidationError') {
        await interaction.editReply({
          content: `❌ ${error.message}`
        });
      } else if (error.name === 'ConfigurationError') {
        await interaction.editReply({
          content: '❌ Jail system is not properly configured. Please contact an administrator to set up the jail channel and role.'
        });
      } else {
        await interaction.editReply({
          content: '❌ An error occurred while jailing the user. Please try again later.'
        });
      }
    }
  }

  /**
   * Parse duration string into milliseconds
   * @private
   * @param {string} durationStr - Duration string (e.g., "1h", "30m", "2d")
   * @returns {number|null} Duration in milliseconds or null if invalid
   */
  _parseDuration(durationStr) {
    const match = durationStr.toLowerCase().match(/^(\d+)([mhdw])$/);
    if (!match) {
      return null;
    }

    const value = parseInt(match[1]);
    const unit = match[2];

    const multipliers = {
      'm': 60 * 1000,        // minutes to milliseconds
      'h': 60 * 60 * 1000,   // hours to milliseconds
      'd': 24 * 60 * 60 * 1000, // days to milliseconds
      'w': 7 * 24 * 60 * 60 * 1000 // weeks to milliseconds
    };

    if (!multipliers[unit] || value <= 0) {
      return null;
    }

    return value * multipliers[unit];
  }

  /**
   * Custom permission validation for jail command
   * Uses dynamic moderator role from database configuration
   * @param {CommandInteraction} interaction - Discord interaction
   * @returns {Promise<boolean>} Permission validation result
   */
  async validatePermissions(interaction) {
    try {
      // Check if user is in a guild
      if (!interaction.guild) {
        return false;
      }

      // Get server configuration to find moderator role
      const server = await this.configRepository.findServerById(interaction.guild.id);
      if (!server) {
        return false; // No server configuration means no moderator role set
      }

      const moderatorRoleId = server.getModeratorRole();
      if (!moderatorRoleId) {
        return false; // No moderator role configured
      }

      // Check if user has the configured moderator role
      const member = interaction.guild.members.cache.get(interaction.user.id);
      if (!member) {
        return false;
      }

      const hasModeratorRole = member.roles.cache.has(moderatorRoleId);
      if (!hasModeratorRole) {
        return false;
      }

      // Additional validation: ensure bot has permissions
      const botMember = interaction.guild.members.cache.get(interaction.client.user.id);
      if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error validating jail command permissions:', error);
      return false;
    }
  }
}

module.exports = JailCommand;