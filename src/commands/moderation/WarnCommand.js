const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const BaseCommand = require('../BaseCommand');

/**
 * Warn command for issuing formal warnings to users
 * Ensures staff-only usage with moderation logging
 * @class WarnCommand
 * @extends BaseCommand
 */
class WarnCommand extends BaseCommand {
  /**
   * Initialize warn command with moderation service dependency
   * @param {ModerationService} moderationService - Service for moderation operations
   */
  constructor(moderationService) {
    super();
    this.moderationService = moderationService;
    this._category = 'moderation';
    this._requiredPermissions = ['ModerateMembers'];
    this._cooldown = 5000; // 5 seconds
  }

  /**
   * Command metadata for Discord registration
   * @returns {SlashCommandBuilder} Discord slash command data
   */
  get data() {
    return new SlashCommandBuilder()
      .setName('warn')
      .setDescription('Issue a formal warning to a user')
      .addUserOption(option =>
        option.setName('target')
          .setDescription('The user to warn')
          .setRequired(true))
      .addStringOption(option =>
        option.setName('reason')
          .setDescription('Reason for the warning')
          .setRequired(true)
          .setMaxLength(500))
      .addStringOption(option =>
        option.setName('note')
          .setDescription('Optional staff note to attach to the user')
          .setRequired(false)
          .setMaxLength(2000))
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers);
  }

  /**
   * Execute warn command with validation and persistence
   * @param {CommandInteraction} interaction - Discord slash command interaction
   * @returns {Promise<void>}
   */
  async execute(interaction) {
    try {
      if (!interaction.deferred) {
        await interaction.deferReply({ ephemeral: true });
      }

      const targetUser = interaction.options.getUser('target');
      const reason = interaction.options.getString('reason');

      if (!targetUser) {
        await interaction.editReply({
          content: '❌ Target user could not be resolved.'
        });
        return;
      }

      const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
      const warnResult = await this.moderationService.warnUser(
        interaction,
        targetMember || targetUser,
        reason
      );

      if (!warnResult.success) {
        await interaction.editReply({
          content: `❌ ${warnResult.error}`
        });
        return;
      }

      const noteContent = interaction.options.getString('note');
      let noteResult = null;

      if (noteContent && noteContent.trim().length > 0) {
        noteResult = await this.moderationService.addStaffNote(
          interaction,
          targetMember || targetUser,
          noteContent
        );

        if (!noteResult.success) {
          await interaction.followUp({
            content: `⚠️ Warning issued, but staff note failed: ${noteResult.error}`,
            ephemeral: true
          });
        }
      }

      const warningsAfter = warnResult.warningsAfter ?? 'unknown';
      const responseLines = [
        `✅ **Warning Issued**`,
        `**User:** ${warnResult.user.tag} (<@${warnResult.user.id}>)`,
        `**Moderator:** ${warnResult.moderator.tag}`,
        `**Reason:** ${reason}`,
        `**Total Warnings:** ${warningsAfter}`,
        `**Case ID:** ${warnResult.actionId}`
      ];

      if (noteResult && noteResult.success) {
        responseLines.push(`**Staff Note ID:** ${noteResult.note.id}`);
      }

      await interaction.editReply({
        content: responseLines.join('\n')
      });

      console.log(`Warned user ${warnResult.user.tag} (${warnResult.user.id}) by ${warnResult.moderator.tag} (${warnResult.moderator.id}) - Reason: ${reason}`);
    } catch (error) {
      console.error('Error executing warn command:', error);

      await interaction.editReply({
        content: '❌ An error occurred while issuing the warning. Please try again later.'
      });
    }
  }

  /**
   * Custom permission validation for warn command
   * @param {CommandInteraction} interaction - Discord interaction
   * @returns {Promise<boolean>} Permission validation result
   */
  async validatePermissions(interaction) {
    const hasBasePermissions = await super.validatePermissions(interaction);
    if (!hasBasePermissions) {
      return false;
    }

    const member = interaction.guild.members.cache.get(interaction.user.id);
    if (!member) {
      return false;
    }

    const requiredPermissions = [
      PermissionFlagsBits.ModerateMembers,
      PermissionFlagsBits.KickMembers,
      PermissionFlagsBits.ManageMessages
    ];

    return requiredPermissions.some(permission => member.permissions.has(permission));
  }
}

module.exports = WarnCommand;