const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const BaseCommand = require('../BaseCommand');

/**
 * Kick command for removing users from the server
 * Implements proper permission checking and moderation logging
 * @class KickCommand
 * @extends BaseCommand
 */
class KickCommand extends BaseCommand {
  /**
   * Initialize kick command with moderation service dependency
   * @param {ModerationService} moderationService - Service for moderation operations
   */
  constructor(moderationService) {
    super();
    this.moderationService = moderationService;
    this._category = 'moderation';
    this._requiredPermissions = ['KickMembers'];
    this._cooldown = 5000; // 5 second cooldown
  }

  /**
   * Command metadata for Discord registration
   * @returns {SlashCommandBuilder} Discord slash command data
   */
  get data() {
    return new SlashCommandBuilder()
      .setName('kick')
      .setDescription('Kick a user from the server')
      .addUserOption(option =>
        option.setName('target')
          .setDescription('The user to kick')
          .setRequired(true))
      .addStringOption(option =>
        option.setName('reason')
          .setDescription('Reason for the kick')
          .setRequired(true)
          .setMaxLength(500))
      .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers);
  }

  /**
   * Execute kick command with comprehensive validation
   * @param {CommandInteraction} interaction - Discord slash command interaction
   * @returns {Promise<void>}
   */
  async execute(interaction) {
    try {
      // Get command parameters
      const target = interaction.options.getUser('target');
      const reason = interaction.options.getString('reason');
      const executor = interaction.member;

      // Get target member object
      const targetMember = await interaction.guild.members.fetch(target.id).catch(() => null);
      
      if (!targetMember) {
        await interaction.editReply({
          content: `❌ User ${target.tag} is not a member of this server.`
        });
        return;
      }

      // Execute kick operation
      const kickResult = await this.moderationService.kickUser(
        interaction,
        targetMember,
        reason
      );

      // Send success response
      await interaction.editReply({
        content: `✅ Successfully kicked ${target.tag}\n` +
                `**Reason:** ${reason}\n` +
                `**Case ID:** ${kickResult.caseId}\n` +
                `**Moderator:** ${executor.user.tag}`
      });

      // Log the action (handled by ModerationService)
      console.log(`User ${target.tag} (${target.id}) kicked by ${executor.user.tag} (${executor.id}) - Reason: ${reason}`);

    } catch (error) {
      console.error('Error executing kick command:', error);
      
      // Handle specific error types
      if (error.name === 'PermissionError') {
        await interaction.editReply({
          content: '❌ I don\'t have permission to kick this user. Please check my role hierarchy and permissions.'
        });
      } else if (error.name === 'ValidationError') {
        await interaction.editReply({
          content: `❌ ${error.message}`
        });
      } else {
        await interaction.editReply({
          content: '❌ An error occurred while kicking the user. Please try again later.'
        });
      }
    }
  }

  /**
   * Custom permission validation for kick command
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
    if (!botMember.permissions.has(PermissionFlagsBits.KickMembers)) {
      return false;
    }

    return true;
  }
}

module.exports = KickCommand;