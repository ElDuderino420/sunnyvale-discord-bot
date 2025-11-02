const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const BaseCommand = require('../BaseCommand');

/**
 * Staff note command for adding and listing moderator notes on users
 * Provides staff-only controls to document context for future reference
 * @class NoteCommand
 * @extends BaseCommand
 */
class NoteCommand extends BaseCommand {
  /**
   * Initialize note command with moderation service dependency
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
      .setName('note')
      .setDescription('Manage staff notes for a user')
      .addSubcommand(subcommand =>
        subcommand
          .setName('add')
          .setDescription('Add a staff-only note to a user')
          .addUserOption(option =>
            option
              .setName('user')
              .setDescription('The user to add the note to')
              .setRequired(true))
          .addStringOption(option =>
            option
              .setName('content')
              .setDescription('The note to attach (max 2000 characters)')
              .setRequired(true)
              .setMaxLength(2000)))
      .addSubcommand(subcommand =>
        subcommand
          .setName('list')
          .setDescription('List staff notes for a user')
          .addUserOption(option =>
            option
              .setName('user')
              .setDescription('The user whose notes to view')
              .setRequired(true))
          .addIntegerOption(option =>
            option
              .setName('limit')
              .setDescription('Maximum number of notes to display (1-25)')
              .setRequired(false)
              .setMinValue(1)
              .setMaxValue(25)))
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers);
  }

  /**
   * Execute note command with support for add/list subcommands
   * @param {CommandInteraction} interaction - Discord slash command interaction
   * @returns {Promise<void>}
   */
  async execute(interaction) {
    try {
      if (!interaction.deferred) {
        await interaction.deferReply({ ephemeral: true });
      }

      const subcommand = interaction.options.getSubcommand();
      const targetUser = interaction.options.getUser('user');

      if (!targetUser) {
        await interaction.editReply({
          content: '❌ Target user could not be resolved.'
        });
        return;
      }

      const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

      if (subcommand === 'add') {
        const content = interaction.options.getString('content', true);
        const addResult = await this.moderationService.addStaffNote(
          interaction,
          targetMember || targetUser,
          content
        );

        if (!addResult.success) {
          await interaction.editReply({
            content: `❌ Failed to add staff note: ${addResult.error}`
          });
          return;
        }

        await interaction.editReply({
          content: [
            '✅ **Staff Note Added**',
            `**User:** ${addResult.user.tag} (<@${addResult.user.id}>)`,
            `**Moderator:** ${addResult.moderator.tag}`,
            `**Note ID:** ${addResult.note.id}`,
            `**Total Notes:** ${addResult.notesCount}`
          ].join('\n')
        });

        console.log(`Staff note added for ${addResult.user.tag} (${addResult.user.id}) by ${addResult.moderator.tag} (${addResult.moderator.id})`);
        return;
      }

      if (subcommand === 'list') {
        const limit = interaction.options.getInteger('limit') || 5;
        const listResult = await this.moderationService.getStaffNotes(
          interaction,
          targetMember || targetUser,
          limit
        );

        if (!listResult.success) {
          await interaction.editReply({
            content: `❌ Failed to retrieve staff notes: ${listResult.error}`
          });
          return;
        }

        if (listResult.noteCount === 0) {
          await interaction.editReply({
            content: `ℹ️ No staff notes found for ${listResult.user.tag}.`
          });
          return;
        }

        const noteLines = listResult.notes.map((note, index) => {
          const timestamp = Math.floor(new Date(note.timestamp).getTime() / 1000);
          const preview = note.content.length > 190
            ? `${note.content.slice(0, 187)}…`
            : note.content;
          const moderatorMention = note.moderator ? `<@${note.moderator}>` : null;
          const moderatorTag = note.metadata?.moderatorTag || (note.moderator ? note.moderator : 'Unknown');
          const moderatorDisplay = moderatorMention
            ? `${moderatorMention} • ${moderatorTag}`
            : moderatorTag;

          return [
            `**#${index + 1} • ID:** \`${note.id}\``,
            `• **When:** <t:${timestamp}:f>`,
            `• **Moderator:** ${moderatorDisplay}`,
            `• **Content:** ${preview}`
          ].join('\n');
        });

        await interaction.editReply({
          content: [
            `🗒️ **Staff Notes for ${listResult.user.tag}**`,
            `**Total Notes:** ${listResult.noteCount}`,
            `**Showing:** ${noteLines.length}`,
            '',
            noteLines.join('\n\n')
          ].join('\n')
        });

        return;
      }

      await interaction.editReply({
        content: '❌ Unknown subcommand.'
      });
    } catch (error) {
      console.error('Error executing note command:', error);

      await interaction.editReply({
        content: '❌ An error occurred while processing the staff note command. Please try again later.'
      });
    }
  }

  /**
   * Custom permission validation for note command
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
      PermissionFlagsBits.ManageGuild,
      PermissionFlagsBits.ManageMessages
    ];

    return requiredPermissions.some(permission => member.permissions.has(permission));
  }
}

module.exports = NoteCommand;