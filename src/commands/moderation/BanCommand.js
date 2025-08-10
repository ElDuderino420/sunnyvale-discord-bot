const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const BaseCommand = require('../BaseCommand');

/**
 * Ban command for permanently banning users from the server
 * Implements proper permission checking, role hierarchy validation, and audit logging
 * @class BanCommand
 * @extends BaseCommand
 */
class BanCommand extends BaseCommand {
  /**
   * Initialize ban command with moderation service dependency
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
      .setName('ban')
      .setDescription('Permanently ban a user from the server')
      .addUserOption(option =>
        option.setName('target')
          .setDescription('The user to ban')
          .setRequired(true))
      .addStringOption(option =>
        option.setName('reason')
          .setDescription('Reason for the ban')
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
   * Execute ban command with comprehensive validation
   * @param {CommandInteraction} interaction - Discord slash command interaction
   * @returns {Promise<void>}
   */
  async execute(interaction) {
    try {
      // Get command parameters
      const target = interaction.options.getUser('target');
      const reason = interaction.options.getString('reason');
      const deleteDays = interaction.options.getInteger('delete_days') || 0;
      const executor = interaction.member;

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

      // Execute ban operation
      const banResult = await this.moderationService.banUser(
        interaction,
        target,
        reason,
        deleteDays
      );

      // Send success response
      const memberStatus = targetMember ? 'member' : 'user (not in server)';
      await interaction.editReply({
        content: `✅ Successfully banned ${memberStatus} ${target.tag}\n` +
                `**Reason:** ${reason}\n` +
                `**Case ID:** ${banResult.caseId}\n` +
                `**Moderator:** ${executor.user.tag}\n` +
                `**Messages deleted:** ${deleteDays} day(s)`
      });

      // Log the action (handled by ModerationService)
      console.log(`User ${target.tag} (${target.id}) banned by ${executor.user.tag} (${executor.id}) - Reason: ${reason}`);

    } catch (error) {
      console.error('Error executing ban command:', error);
      
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
          content: '❌ An error occurred while banning the user. Please try again later.'
        });
      }
    }
  }

  /**
   * Custom permission validation for ban command
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

module.exports = BanCommand;