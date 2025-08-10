const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const BaseCommand = require('../BaseCommand');

/**
 * Close ticket command for closing and archiving support tickets
 * Implements transcript generation and proper cleanup
 * @class CloseTicketCommand
 * @extends BaseCommand
 */
class CloseTicketCommand extends BaseCommand {
  /**
   * Initialize close ticket command with ticket service dependency
   * @param {TicketService} ticketService - Service for ticket operations
   * @param {ConfigRepository} configRepository - Repository for server configuration
   */
  constructor(ticketService, configRepository) {
    super();
    this.ticketService = ticketService;
    this.configRepository = configRepository;
    this._category = 'tickets';
    this._requiredRoles = ['staff']; // Ensure BaseCommand defers interaction (validated dynamically)
    this._cooldown = 5000;
    this._guildOnly = true;
  }

  /**
   * Command metadata for Discord registration
   * @returns {SlashCommandBuilder} Discord slash command data
   */
  get data() {
    return new SlashCommandBuilder()
      .setName('close-ticket')
      .setDescription('Close and archive a support ticket')
      .addStringOption(option =>
        option.setName('reason')
          .setDescription('Reason for closing the ticket')
          .setRequired(false)
          .setMaxLength(500))
      .addBooleanOption(option =>
        option.setName('send_transcript')
          .setDescription('Send transcript to the ticket creator (default: true)')
          .setRequired(false))
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels);
  }

  /**
   * Execute close ticket command with archiving and cleanup
   * @param {CommandInteraction} interaction - Discord slash command interaction
   * @returns {Promise<void>}
   */
  async execute(interaction) {
    try {
      // Get command parameters
      const reason = interaction.options.getString('reason') || 'No reason provided';
      const sendTranscript = interaction.options.getBoolean('send_transcript') ?? true;
      const closer = interaction.member;

      // Check if command is used in a ticket channel
      const ticketInfo = await this.ticketService.getTicketByChannel(interaction.guild.id, interaction.channel.id);
      if (!ticketInfo) {
        await interaction.editReply({
          content: '❌ This command can only be used in ticket channels.'
        });
        return;
      }

      // Check if ticket is already closed
      if (ticketInfo.status === 'closed') {
        await interaction.editReply({
          content: '❌ This ticket is already closed.'
        });
        return;
      }

      // Validate close operation
      const validationResult = await this.ticketService.validateCloseTicket(
        interaction.guild.id,
        closer.id,
        ticketInfo.ticketId,
        reason
      );

      if (!validationResult.isValid) {
        await interaction.editReply({
          content: `❌ Cannot close ticket: ${validationResult.error}`
        });
        return;
      }

      // Send confirmation before closing
      await interaction.editReply({
        content: `🔄 **Closing Ticket ${ticketInfo.ticketId}**\n\n` +
                `**Closed by:** ${closer.user.tag}\n` +
                `**Reason:** ${reason}\n` +
                `**Transcript:** ${sendTranscript ? 'Will be sent to creator' : 'Will not be sent'}\n\n` +
                `Please wait while I generate the transcript and archive the ticket...`
      });

      // Close the ticket (this handles transcript generation and archiving)
      const closeResult = await this.ticketService.closeTicket(
        interaction,
        ticketInfo.ticketId,
        reason,
        sendTranscript
      );

      // Update the response with final information
      await interaction.editReply({
        content: `✅ **Ticket ${ticketInfo.ticketId} Closed Successfully**\n\n` +
                `**Closed by:** ${closer.user.tag}\n` +
                `**Reason:** ${reason}\n` +
                `**Duration:** ${closeResult.duration}\n` +
                `**Messages archived:** ${closeResult.messageCount}\n` +
                `**Transcript:** ${sendTranscript ? 'Sent to creator' : 'Not sent'}\n\n` +
                `This channel will be deleted in 30 seconds...`
      });

      // Schedule channel deletion after delay
      setTimeout(async () => {
        try {
          await interaction.channel.delete('Ticket closed and archived');
        } catch (error) {
          console.error('Error deleting ticket channel:', error);
        }
      }, 30000);

      // Log the action
      console.log(`Ticket ${ticketInfo.ticketId} closed by ${closer.user.tag} (${closer.id}) - Reason: ${reason}`);

    } catch (error) {
      console.error('Error executing close-ticket command:', error);
      
      // Handle specific error types
      if (error.name === 'PermissionError') {
        await interaction.editReply({
          content: '❌ I don\'t have permission to close this ticket or manage the channel.'
        });
      } else if (error.name === 'ValidationError') {
        await interaction.editReply({
          content: `❌ ${error.message}`
        });
      } else if (error.name === 'TranscriptError') {
        await interaction.editReply({
          content: '⚠️ Ticket was closed but there was an error generating the transcript. The ticket data has been saved.'
        });
      } else {
        await interaction.editReply({
          content: '❌ An error occurred while closing the ticket. Please try again later.'
        });
      }
    }
  }

  /**
   * Custom permission validation for close ticket command
   * Staff members (using database configuration) and ticket creators can close tickets
   * @param {CommandInteraction} interaction - Discord interaction
   * @returns {Promise<boolean>} Permission validation result
   */
  async validatePermissions(interaction) {
    try {
      // Check if user is in a guild
      if (!interaction.guild) {
        return false;
      }

      // First, check if user is the ticket creator
      const ticketInfo = await this.ticketService.getTicketByChannel(interaction.guild.id, interaction.channel.id);
      if (ticketInfo && ticketInfo.creatorId === interaction.user.id) {
        return true; // Ticket creators can always close their own tickets
      }

      // For staff members, check database configuration
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
      if (hasModeratorRole) {
        return true; // Staff members can close any ticket
      }

      // Check bot permissions
      const botMember = interaction.guild.members.cache.get(interaction.client.user.id);
      const requiredPermissions = [
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.SendMessages
      ];

      const hasPermissions = requiredPermissions.every(permission => 
        botMember.permissions.has(permission)
      );

      return hasPermissions;
    } catch (error) {
      console.error('Error validating close-ticket command permissions:', error);
      return false;
    }
  }
}

module.exports = CloseTicketCommand;