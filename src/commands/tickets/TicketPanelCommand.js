const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const BaseCommand = require('../BaseCommand');

/**
 * Create ticket panel command for setting up interactive ticket creation interface
 * Creates a persistent message with buttons for easy ticket creation
 * @class TicketPanelCommand
 * @extends BaseCommand
 */
class TicketPanelCommand extends BaseCommand {
  /**
   * Initialize ticket panel command
   * @param {ConfigRepository} configRepository - Server configuration repository
   */
  constructor(configRepository) {
    super();
    this.configRepository = configRepository;
    this._category = 'tickets';
    this._requiredPermissions = ['Administrator'];
    this._cooldown = 10000;
    this._guildOnly = true;
  }

  /**
   * Command metadata for Discord registration
   * @returns {SlashCommandBuilder} Discord slash command data
   */
  get data() {
    return new SlashCommandBuilder()
      .setName('ticket-panel')
      .setDescription('Create or manage ticket panel')
      .addSubcommand(subcommand =>
        subcommand
          .setName('create')
          .setDescription('Create a ticket panel in a channel')
          .addChannelOption(option =>
            option.setName('channel')
              .setDescription('Channel to send the ticket panel to')
              .setRequired(false)
              .addChannelTypes(ChannelType.GuildText))
          .addStringOption(option =>
            option.setName('title')
              .setDescription('Custom title for the ticket panel')
              .setRequired(false)
              .setMaxLength(100))
          .addStringOption(option =>
            option.setName('description')
              .setDescription('Custom description for the ticket panel')
              .setRequired(false)
              .setMaxLength(500))
          .addStringOption(option =>
            option.setName('color')
              .setDescription('Embed color (hex code without #)')
              .setRequired(false)
              .setMinLength(6)
              .setMaxLength(6)))
      .addSubcommand(subcommand =>
        subcommand
          .setName('update')
          .setDescription('Update an existing ticket panel')
          .addStringOption(option =>
            option.setName('message-id')
              .setDescription('ID of the ticket panel message to update')
              .setRequired(true))
          .addChannelOption(option =>
            option.setName('channel')
              .setDescription('Channel containing the message (defaults to current)')
              .setRequired(false)
              .addChannelTypes(ChannelType.GuildText))
          .addStringOption(option =>
            option.setName('title')
              .setDescription('New title for the ticket panel')
              .setRequired(false)
              .setMaxLength(100))
          .addStringOption(option =>
            option.setName('description')
              .setDescription('New description for the ticket panel')
              .setRequired(false)
              .setMaxLength(500)));
  }

  /**
   * Execute ticket panel command
   * @param {CommandInteraction} interaction - Discord slash command interaction
   * @returns {Promise<void>}
   */
  async execute(interaction) {
    try {
      const subcommand = interaction.options.getSubcommand();
      
      switch (subcommand) {
        case 'create':
          await this._createPanel(interaction);
          break;
        case 'update':
          await this._updatePanel(interaction);
          break;
        default:
          await interaction.editReply({
            content: '❌ Unknown subcommand. Please use `create` or `update`.'
          });
      }
    } catch (error) {
      console.error('Error in ticket-panel command:', error);
      const errorMessage = error.message || 'An unexpected error occurred while managing the ticket panel.';
      await interaction.editReply({
        content: `❌ **Error:** ${errorMessage}`
      });
    }
  }

  /**
   * Create a new ticket panel
   * @param {CommandInteraction} interaction - Discord interaction
   * @private
   */
  async _createPanel(interaction) {
    // Check if ticket system is configured
    const server = await this.configRepository.findServerById(interaction.guild.id);
    const ticketCategoryId = server?.getTicketsChannel();
    
    if (!ticketCategoryId) {
      await interaction.editReply({
        content: '❌ **Ticket System Not Configured**\n\n' +
                'Please configure the ticket system first using `/configure-tickets channel` to set a category for tickets.\n\n' +
                'For full functionality, also configure:\n' +
                '• Staff role with `/configure-tickets staff-role`\n' +
                '• Log channel with `/configure-tickets log-channel`'
      });
      return;
    }

    const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
    const title = interaction.options.getString('title') || '🎫 Support Tickets';
    const description = interaction.options.getString('description') || 
      'Need help? Create a support ticket and our staff will assist you!\n\n' +
      '**Available Categories:**\n' +
      '🔧 **General Support** - General questions and assistance\n' +
      '⚙️ **Technical Issue** - Bug reports and technical problems\n' +
      '⚖️ **Moderation Appeal** - Appeal moderation actions\n' +
      '🚨 **Report User/Content** - Report violations or inappropriate content\n' +
      '❓ **Other** - Anything else that doesn\'t fit the above categories\n\n' +
      '*Click the button below to create a private ticket.*';
    
    const colorInput = interaction.options.getString('color');
    let color = 0x5865F2; // Discord blurple default
    
    if (colorInput) {
      // Validate hex color
      if (/^[0-9A-Fa-f]{6}$/.test(colorInput)) {
        color = parseInt(colorInput, 16);
      } else {
        await interaction.editReply({
          content: '❌ Invalid color format. Please use a 6-digit hex code (e.g., `FF5733` for orange).'
        });
        return;
      }
    }

    // Check permissions in target channel
    const botMember = interaction.guild.members.me;
    const permissions = targetChannel.permissionsFor(botMember);
    
    if (!permissions.has(['SendMessages', 'EmbedLinks', 'UseExternalEmojis'])) {
      await interaction.editReply({
        content: `❌ **Missing Permissions**\n\nI need the following permissions in <#${targetChannel.id}>:\n• Send Messages\n• Embed Links\n• Use External Emojis\n\nPlease adjust the channel permissions and try again.`
      });
      return;
    }

    // Create embed
    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .setColor(color)
      .setFooter({ 
        text: `${interaction.guild.name} Support System`,
        iconURL: interaction.guild.iconURL() 
      })
      .setTimestamp();

    // Create buttons
    const buttons = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('create_ticket_general')
          .setLabel('General Support')
          .setEmoji('🔧')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('create_ticket_technical')
          .setLabel('Technical Issue')
          .setEmoji('⚙️')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('create_ticket_appeal')
          .setLabel('Moderation Appeal')
          .setEmoji('⚖️')
          .setStyle(ButtonStyle.Secondary)
      );

    const buttons2 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('create_ticket_report')
          .setLabel('Report User/Content')
          .setEmoji('🚨')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('create_ticket_other')
          .setLabel('Other')
          .setEmoji('❓')
          .setStyle(ButtonStyle.Secondary)
      );

    // Send panel to target channel
    const panelMessage = await targetChannel.send({
      embeds: [embed],
      components: [buttons, buttons2]
    });

    // Confirm creation
    const confirmationText = targetChannel.id === interaction.channel.id
      ? `✅ **Ticket Panel Created**\n\nThe ticket panel has been created in this channel above.`
      : `✅ **Ticket Panel Created**\n\nThe ticket panel has been created in <#${targetChannel.id}>.`;

    await interaction.editReply({
      content: confirmationText + 
              `\n\n**Panel Message ID:** \`${panelMessage.id}\`\n` +
              `*Save this ID if you want to update the panel later.*\n\n` +
              `**Configuration Status:**\n` +
              `• Ticket Category: ✅ <#${ticketCategoryId}>\n` +
              `• Staff Role: ${server?._config?.ticketConfig?.staffRoleId ? '✅' : '❌ Not configured'}\n` +
              `• Log Channel: ${server?._config?.ticketConfig?.logChannelId ? '✅' : '❌ Not configured'}`
    });
  }

  /**
   * Update an existing ticket panel
   * @param {CommandInteraction} interaction - Discord interaction
   * @private
   */
  async _updatePanel(interaction) {
    const messageId = interaction.options.getString('message-id');
    const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
    const newTitle = interaction.options.getString('title');
    const newDescription = interaction.options.getString('description');

    try {
      // Fetch the message
      const message = await targetChannel.messages.fetch(messageId);
      
      if (!message) {
        await interaction.editReply({
          content: `❌ Could not find a message with ID \`${messageId}\` in <#${targetChannel.id}>.`
        });
        return;
      }

      // Check if it's our message (has embeds and components)
      if (!message.embeds.length || !message.components.length) {
        await interaction.editReply({
          content: `❌ The message with ID \`${messageId}\` doesn't appear to be a ticket panel.`
        });
        return;
      }

      // Check if we can edit it
      if (message.author.id !== interaction.client.user.id) {
        await interaction.editReply({
          content: `❌ I can only update ticket panels that I created.`
        });
        return;
      }

      // Get current embed and update it
      const currentEmbed = message.embeds[0];
      const updatedEmbed = EmbedBuilder.from(currentEmbed);

      if (newTitle) {
        updatedEmbed.setTitle(newTitle);
      }

      if (newDescription) {
        updatedEmbed.setDescription(newDescription);
      }

      // Update timestamp
      updatedEmbed.setTimestamp();

      // Update the message
      await message.edit({
        embeds: [updatedEmbed],
        components: message.components // Keep the same buttons
      });

      let updateInfo = [];
      if (newTitle) updateInfo.push(`• **Title:** ${newTitle}`);
      if (newDescription) updateInfo.push(`• **Description:** Updated`);

      await interaction.editReply({
        content: `✅ **Ticket Panel Updated**\n\n` +
                `**Message:** [Jump to panel](${message.url})\n` +
                `**Channel:** <#${targetChannel.id}>\n\n` +
                `**Changes made:**\n${updateInfo.join('\n') || '• Timestamp refreshed'}`
      });

    } catch (error) {
      if (error.code === 10008) { // Unknown Message
        await interaction.editReply({
          content: `❌ Could not find a message with ID \`${messageId}\` in <#${targetChannel.id}>. Please check the message ID and channel.`
        });
      } else {
        throw error;
      }
    }
  }
}

module.exports = TicketPanelCommand;