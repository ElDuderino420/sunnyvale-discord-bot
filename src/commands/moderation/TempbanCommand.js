const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const BaseCommand = require('../BaseCommand');

/**
 * Temporary ban command for time-limited bans with automatic unban
 * Implements scheduled task management and comprehensive validation
 * @class TempbanCommand
 * @extends BaseCommand
 */
class TempbanCommand extends BaseCommand {
  /**
   * Initialize tempban command with moderation service dependency
   * @param {ModerationService} moderationService - Service for moderation operations
   */
  constructor(moderationService) {
    super();
    this.moderationService = moderationService;
    this._category = 'moderation';
    this._requiredPermissions = ['BanMembers'];
    this._cooldown = 10000; // 10 second cooldown for serious action
  }

  /**
   * Command metadata for Discord registration
   * @returns {SlashCommandBuilder} Discord slash command data
   */
  get data() {
    return new SlashCommandBuilder()
      .setName('tempban')
      .setDescription('Temporarily ban a user from the server')
      .addUserOption(option =>
        option.setName('target')
          .setDescription('The user to temporarily ban')
          .setRequired(true))
      .addStringOption(option =>
        option.setName('duration')
          .setDescription('Ban duration (e.g., 1h, 2d, 1w)')
          .setRequired(true))
      .addStringOption(option =>
        option.setName('reason')
          .setDescription('Reason for the temporary ban')
          .setRequired(true)
          .setMaxLength(500))
      .addIntegerOption(option =>
        option.setName('delete_days')
          .setDescription('Number of days of messages to delete (0-7)')
          .setMinValue(0)
          .setMaxValue(7)
          .setRequired(false))
      .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers);
  }

  /**
   * Execute tempban command with duration parsing and scheduling
   * @param {CommandInteraction} interaction - Discord slash command interaction
   * @returns {Promise<void>}
   */
  async execute(interaction) {
    try {
      // Get command parameters
      const target = interaction.options.getUser('target');
      const durationStr = interaction.options.getString('duration');
      const reason = interaction.options.getString('reason');
      const deleteDays = interaction.options.getInteger('delete_days') || 0;
      const executor = interaction.member;

      // Parse duration string
      const duration = this._parseDuration(durationStr);
      if (!duration) {
        await interaction.editReply({
          content: '❌ Invalid duration format. Use formats like: `1h`, `2d`, `1w`, `30m`\n' +
                  'Supported units: m (minutes), h (hours), d (days), w (weeks)'
        });
        return;
      }

      // Validate duration limits (max 30 days)
      const maxDuration = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
      if (duration > maxDuration) {
        await interaction.editReply({
          content: '❌ Maximum temporary ban duration is 30 days. Use `/ban` for permanent bans.'
        });
        return;
      }

      // Check if user is already banned
      const existingBan = await interaction.guild.bans.fetch(target.id).catch(() => null);
      if (existingBan) {
        await interaction.editReply({
          content: `❌ User ${target.tag} is already banned from this server.`
        });
        return;
      }

      // Get target member object (may be null if user already left)
      const targetMember = await interaction.guild.members.fetch(target.id).catch(() => null);

      // Execute temporary ban operation
      const tempbanResult = await this.moderationService.tempbanUser(
        interaction,
        target,
        duration,
        reason,
        deleteDays
      );

      // Format expiration time
      const expiresAt = new Date(Date.now() + duration);
      const expiresTimestamp = Math.floor(expiresAt.getTime() / 1000);

      // Send success response
      const memberStatus = targetMember ? 'member' : 'user (not in server)';
      await interaction.editReply({
        content: `✅ Successfully temporarily banned ${memberStatus} ${target.tag}\n` +
                `**Reason:** ${reason}\n` +
                `**Duration:** ${durationStr}\n` +
                `**Expires:** <t:${expiresTimestamp}:F> (<t:${expiresTimestamp}:R>)\n` +
                `**Case ID:** ${tempbanResult.caseId}\n` +
                `**Moderator:** ${executor.user.tag}\n` +
                `**Messages deleted:** ${deleteDays} day(s)`
      });

      // Log the action (handled by ModerationService)
      console.log(`User ${target.tag} (${target.id}) temporarily banned by ${executor.user.tag} (${executor.id}) - Duration: ${durationStr}, Reason: ${reason}`);

    } catch (error) {
      console.error('Error executing tempban command:', error);
      
      // Handle specific error types
      if (error.name === 'PermissionError') {
        await interaction.editReply({
          content: '❌ I don\'t have permission to ban this user. Please check my role hierarchy and permissions.'
        });
      } else if (error.name === 'ValidationError') {
        await interaction.editReply({
          content: `❌ ${error.message}`
        });
      } else if (error.code === 10013) { // Unknown User
        await interaction.editReply({
          content: '❌ User not found. They may have already left the server or the user ID is invalid.'
        });
      } else {
        await interaction.editReply({
          content: '❌ An error occurred while temporarily banning the user. Please try again later.'
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
   * Custom permission validation for tempban command
   * @param {CommandInteraction} interaction - Discord interaction
   * @returns {Promise<boolean>} Permission validation result
   */
  async validatePermissions(interaction) {
    // Check base permissions first
    const hasBasePermissions = await super.validatePermissions(interaction);
    if (!hasBasePermissions) {
      return false;
    }

    // Additional validation: ensure bot has permissions
    const botMember = interaction.guild.members.cache.get(interaction.client.user.id);
    if (!botMember.permissions.has(PermissionFlagsBits.BanMembers)) {
      return false;
    }

    return true;
  }
}

module.exports = TempbanCommand;