const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const BaseCommand = require('../BaseCommand');

/**
 * Create ticket command for users to create support tickets
 * Implements dynamic channel creation with proper permissions
 * @class CreateTicketCommand
 * @extends BaseCommand
 */
class CreateTicketCommand extends BaseCommand {
  /**
   * Initialize create ticket command with ticket service dependency
   * @param {TicketService} ticketService - Service for ticket operations
   */
  constructor(ticketService) {
    super();
    this.ticketService = ticketService;
    this._category = 'tickets';
    this._cooldown = 60000; // 1 minute cooldown to prevent spam
    this._guildOnly = true;
  }

  /**
   * Command metadata for Discord registration
   * @returns {SlashCommandBuilder} Discord slash command data
   */
  get data() {
    return new SlashCommandBuilder()
      .setName('create-ticket')
      .setDescription('Create a private support ticket')
      .addStringOption(option =>
        option.setName('subject')
          .setDescription('Brief description of your issue')
          .setRequired(true)
          .setMaxLength(100))
      .addStringOption(option =>
        option.setName('category')
          .setDescription('Type of support needed')
          .setRequired(false)
          .addChoices(
            { name: 'General Support', value: 'general' },
            { name: 'Technical Issue', value: 'technical' },
            { name: 'Moderation Appeal', value: 'appeal' },
            { name: 'Report User/Content', value: 'report' },
            { name: 'Other', value: 'other' }
          ))
      .addStringOption(option =>
        option.setName('description')
          .setDescription('Detailed description of your issue')
          .setRequired(false)
          .setMaxLength(1000));
  }

  /**
   * Execute create ticket command with channel creation
   * @param {CommandInteraction} interaction - Discord slash command interaction
   * @returns {Promise<void>}
   */
  async execute(interaction) {
    // Defer reply for potentially long-running operations
    await interaction.deferReply({ flags: [4] }); // MessageFlags.Ephemeral

    try {
      // Get command parameters
      const subject = interaction.options.getString('subject');
      const category = interaction.options.getString('category') || 'general';
      const description = interaction.options.getString('description') || 'No additional details provided.';
      const creator = interaction.user;

      // Check if user already has an open ticket
      const existingTicket = await this.ticketService.getUserActiveTicket(interaction.guild.id, creator.id);
      if (existingTicket) {
        await interaction.editReply({
          content: `❌ You already have an open ticket: <#${existingTicket.channelId}>\n` +
                  'Please close your existing ticket before creating a new one.'
        });
        return;
      }

      // Create the ticket
      const ticketResult = await this.ticketService.createTicket(
        interaction,
        subject,
        category,
        description
      );

      // Send success response with ticket information
      await interaction.editReply({
        content: `✅ **Ticket Created Successfully!**\n\n` +
                `**Ticket ID:** ${ticketResult.ticketId}\n` +
                `**Channel:** <#${ticketResult.channelId}>\n` +
                `**Subject:** ${subject}\n` +
                `**Category:** ${category}\n\n` +
                `Please head to your ticket channel to continue the conversation. ` +
                `Staff members will be with you shortly.`
      });

      // Log the action
      console.log(`Ticket ${ticketResult.ticketId} created by ${creator.tag} (${creator.id}) - Subject: ${subject}`);

    } catch (error) {
      console.error('Error executing create-ticket command:', error);
      
      // Handle specific error types
      if (error.name === 'PermissionError') {
        await interaction.editReply({
          content: '❌ I don\'t have permission to create ticket channels. Please contact an administrator.'
        });
      } else if (error.name === 'ConfigurationError') {
        await interaction.editReply({
          content: '❌ Ticket system is not properly configured. Please contact an administrator to set up the ticket category and staff roles.'
        });
      } else if (error.name === 'RateLimitError') {
        await interaction.editReply({
          content: '❌ Too many tickets are being created. Please wait a moment and try again.'
        });
      } else if (error.name === 'QuotaExceededError') {
        await interaction.editReply({
          content: '❌ Maximum number of open tickets reached. Please wait for some tickets to be closed before creating new ones.'
        });
      } else {
        await interaction.editReply({
          content: '❌ An error occurred while creating your ticket. Please try again later or contact an administrator.'
        });
      }
    }
  }

  /**
   * Custom permission validation for create ticket command
   * Anyone can create tickets, but check bot permissions
   * @param {CommandInteraction} interaction - Discord interaction
   * @returns {Promise<boolean>} Permission validation result
   */
  async validatePermissions(interaction) {
    // Check base permissions first (should pass for everyone)
    const hasBasePermissions = await super.validatePermissions(interaction);
    if (!hasBasePermissions) {
      return false;
    }

    // Additional validation: ensure bot has necessary permissions
    const botMember = interaction.guild.members.cache.get(interaction.client.user.id);
    const requiredPermissions = [
      PermissionFlagsBits.ManageChannels,
      PermissionFlagsBits.ManageRoles,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.ViewChannel
    ];

    const hasPermissions = requiredPermissions.every(permission => 
      botMember.permissions.has(permission)
    );

    return hasPermissions;
  }
}

module.exports = CreateTicketCommand;