const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const BaseCommand = require('../BaseCommand');

/**
 * Configure ticket system command for admins to set up ticketing functionality
 * Allows setting ticket channels, categories, staff roles, and system settings
 * @class ConfigureTicketCommand
 * @extends BaseCommand
 */
class ConfigureTicketCommand extends BaseCommand {
  /**
   * Initialize configure ticket command with required services
   * @param {ConfigRepository} configRepository - Server configuration repository
   * @param {PermissionService} permissionService - Permission validation service
   */
  constructor(configRepository, permissionService) {
    super();
    this.configRepository = configRepository;
    this.permissionService = permissionService;
    this._category = 'tickets';
    this._requiredPermissions = ['Administrator'];
    this._cooldown = 5000;
    this._guildOnly = true;
  }

  /**
   * Command metadata for Discord registration
   * @returns {SlashCommandBuilder} Discord slash command data
   */
  get data() {
    return new SlashCommandBuilder()
      .setName('configure-tickets')
      .setDescription('Configure the server ticket system')
      .addSubcommand(subcommand =>
        subcommand
          .setName('channel')
          .setDescription('Set the ticket category/channel')
          .addChannelOption(option =>
            option.setName('category')
              .setDescription('Category where ticket channels will be created')
              .setRequired(true)
              .addChannelTypes(ChannelType.GuildCategory)))
      .addSubcommand(subcommand =>
        subcommand
          .setName('staff-role')
          .setDescription('Set the staff role for ticket management')
          .addRoleOption(option =>
            option.setName('role')
              .setDescription('Role that can manage tickets')
              .setRequired(true)))
      .addSubcommand(subcommand =>
        subcommand
          .setName('log-channel')
          .setDescription('Set channel for ticket logs and transcripts')
          .addChannelOption(option =>
            option.setName('channel')
              .setDescription('Channel for ticket logs')
              .setRequired(true)
              .addChannelTypes(ChannelType.GuildText)))
      .addSubcommand(subcommand =>
        subcommand
          .setName('settings')
          .setDescription('Configure ticket system settings')
          .addBooleanOption(option =>
            option.setName('auto-close')
              .setDescription('Auto-close tickets after inactivity')
              .setRequired(false))
          .addIntegerOption(option =>
            option.setName('max-tickets')
              .setDescription('Maximum open tickets per user (default: 3)')
              .setRequired(false)
              .setMinValue(1)
              .setMaxValue(10))
          .addIntegerOption(option =>
            option.setName('close-after-hours')
              .setDescription('Hours of inactivity before auto-close (default: 168 = 7 days)')
              .setRequired(false)
              .setMinValue(1)
              .setMaxValue(720)))
      .addSubcommand(subcommand =>
        subcommand
          .setName('view')
          .setDescription('View current ticket system configuration'))
      .addSubcommand(subcommand =>
        subcommand
          .setName('reset')
          .setDescription('Reset all ticket configurations to defaults')
          .addBooleanOption(option =>
            option.setName('confirm')
              .setDescription('Confirm you want to reset all ticket settings')
              .setRequired(true)));
  }

  /**
   * Execute configure ticket command
   * @param {CommandInteraction} interaction - Discord slash command interaction
   * @returns {Promise<void>}
   */
  async execute(interaction) {
    try {
      const subcommand = interaction.options.getSubcommand();
      
      switch (subcommand) {
        case 'channel':
          await this._configureChannel(interaction);
          break;
        case 'staff-role':
          await this._configureStaffRole(interaction);
          break;
        case 'log-channel':
          await this._configureLogChannel(interaction);
          break;
        case 'settings':
          await this._configureSettings(interaction);
          break;
        case 'view':
          await this._viewConfiguration(interaction);
          break;
        case 'reset':
          await this._resetConfiguration(interaction);
          break;
        default:
          await interaction.editReply({
            content: '❌ Unknown subcommand. Please use one of the available options.'
          });
      }
    } catch (error) {
      console.error('Error in configure-tickets command:', error);
      const errorMessage = error.message || 'An unexpected error occurred while configuring tickets.';
      await interaction.editReply({
        content: `❌ **Error:** ${errorMessage}`
      });
    }
  }

  /**
   * Configure ticket category channel
   * @param {CommandInteraction} interaction - Discord interaction
   * @private
   */
  async _configureChannel(interaction) {
    const category = interaction.options.getChannel('category');
    
    // Validate category permissions
    const botMember = interaction.guild.members.me;
    const permissions = category.permissionsFor(botMember);
    
    if (!permissions.has(['ManageChannels', 'ViewChannel'])) {
      await interaction.editReply({
        content: `❌ **Missing Permissions**\n\nI need the following permissions in the <#${category.id}> category:\n• Manage Channels\n• View Channel\n\nPlease adjust the category permissions and try again.`
      });
      return;
    }

    // Get or create server configuration
    let server = await this.configRepository.findServerById(interaction.guild.id);
    if (!server) {
      const { Server } = require('../../entities/Server');
      server = new Server(interaction.guild.id, interaction.guild.name);
    }

    // Update ticket channel configuration
    server.setTicketsChannel(category.id);
    await this.configRepository.saveServer(server);

    await interaction.editReply({
      content: `✅ **Ticket Category Configured**\n\n` +
              `**Category:** <#${category.id}>\n` +
              `**Name:** ${category.name}\n\n` +
              `New tickets will now be created in this category. Make sure I have proper permissions to:\n` +
              `• Create channels\n` +
              `• Manage permissions\n` +
              `• Send messages`
    });
  }

  /**
   * Configure staff role for ticket management
   * @param {CommandInteraction} interaction - Discord interaction
   * @private
   */
  async _configureStaffRole(interaction) {
    const role = interaction.options.getRole('role');

    // Get or create server configuration
    let server = await this.configRepository.findServerById(interaction.guild.id);
    if (!server) {
      const { Server } = require('../../entities/Server');
      server = new Server(interaction.guild.id, interaction.guild.name);
    }

    // Store ticket staff role (we'll add this to Server entity)
    if (!server._config.ticketConfig) {
      server._config.ticketConfig = {};
    }
    server._config.ticketConfig.staffRoleId = role.id;
    server._config.updatedAt = new Date();
    
    await this.configRepository.saveServer(server);

    await interaction.editReply({
      content: `✅ **Ticket Staff Role Configured**\n\n` +
              `**Role:** ${role}\n` +
              `**Members:** ${role.members.size}\n\n` +
              `Members with this role can now:\n` +
              `• View all ticket channels\n` +
              `• Manage and close tickets\n` +
              `• Access ticket transcripts`
    });
  }

  /**
   * Configure log channel for tickets
   * @param {CommandInteraction} interaction - Discord interaction
   * @private
   */
  async _configureLogChannel(interaction) {
    const channel = interaction.options.getChannel('channel');

    // Validate channel permissions
    const botMember = interaction.guild.members.me;
    const permissions = channel.permissionsFor(botMember);
    
    if (!permissions.has(['SendMessages', 'EmbedLinks', 'AttachFiles'])) {
      await interaction.editReply({
        content: `❌ **Missing Permissions**\n\nI need the following permissions in <#${channel.id}>:\n• Send Messages\n• Embed Links\n• Attach Files\n\nPlease adjust the channel permissions and try again.`
      });
      return;
    }

    // Get or create server configuration
    let server = await this.configRepository.findServerById(interaction.guild.id);
    if (!server) {
      const { Server } = require('../../entities/Server');
      server = new Server(interaction.guild.id, interaction.guild.name);
    }

    // Store ticket log channel
    if (!server._config.ticketConfig) {
      server._config.ticketConfig = {};
    }
    server._config.ticketConfig.logChannelId = channel.id;
    server._config.updatedAt = new Date();
    
    await this.configRepository.saveServer(server);

    await interaction.editReply({
      content: `✅ **Ticket Log Channel Configured**\n\n` +
              `**Channel:** <#${channel.id}>\n\n` +
              `The following will be logged here:\n` +
              `• Ticket creation notifications\n` +
              `• Ticket closure summaries\n` +
              `• Ticket transcripts\n` +
              `• Staff actions and notes`
    });
  }

  /**
   * Configure ticket system settings
   * @param {CommandInteraction} interaction - Discord interaction
   * @private
   */
  async _configureSettings(interaction) {
    const autoClose = interaction.options.getBoolean('auto-close');
    const maxTickets = interaction.options.getInteger('max-tickets');
    const closeAfterHours = interaction.options.getInteger('close-after-hours');

    // Get or create server configuration
    let server = await this.configRepository.findServerById(interaction.guild.id);
    if (!server) {
      const { Server } = require('../../entities/Server');
      server = new Server(interaction.guild.id, interaction.guild.name);
    }

    // Initialize ticket config if not exists
    if (!server._config.ticketConfig) {
      server._config.ticketConfig = {
        autoClose: false,
        maxTicketsPerUser: 3,
        autoCloseHours: 168 // 7 days
      };
    }

    // Update settings
    let updatedSettings = [];
    
    if (autoClose !== null) {
      server._config.ticketConfig.autoClose = autoClose;
      updatedSettings.push(`• **Auto-close:** ${autoClose ? 'Enabled' : 'Disabled'}`);
    }
    
    if (maxTickets !== null) {
      server._config.ticketConfig.maxTicketsPerUser = maxTickets;
      updatedSettings.push(`• **Max tickets per user:** ${maxTickets}`);
    }
    
    if (closeAfterHours !== null) {
      server._config.ticketConfig.autoCloseHours = closeAfterHours;
      updatedSettings.push(`• **Auto-close after:** ${closeAfterHours} hours (${Math.round(closeAfterHours / 24)} days)`);
    }

    if (updatedSettings.length === 0) {
      await interaction.editReply({
        content: '❌ No settings were provided to update. Please specify at least one setting.'
      });
      return;
    }

    server._config.updatedAt = new Date();
    await this.configRepository.saveServer(server);

    await interaction.editReply({
      content: `✅ **Ticket Settings Updated**\n\n${updatedSettings.join('\n')}\n\n` +
              `Use \`/configure-tickets view\` to see all current settings.`
    });
  }

  /**
   * View current ticket configuration
   * @param {CommandInteraction} interaction - Discord interaction
   * @private
   */
  async _viewConfiguration(interaction) {
    const server = await this.configRepository.findServerById(interaction.guild.id);
    
    if (!server) {
      await interaction.editReply({
        content: '📋 **Ticket System Configuration**\n\n' +
                '❌ No ticket configuration found.\n' +
                'Use the other subcommands to configure your ticket system.'
      });
      return;
    }

    const ticketConfig = server._config.ticketConfig || {};
    const ticketCategoryId = server.getTicketsChannel();

    // Build configuration display
    let configText = '📋 **Ticket System Configuration**\n\n';

    // Ticket Category
    if (ticketCategoryId) {
      const category = interaction.guild.channels.cache.get(ticketCategoryId);
      configText += `**🏷️ Ticket Category:** ${category ? `<#${ticketCategoryId}> (${category.name})` : `⚠️ Category not found (ID: ${ticketCategoryId})`}\n`;
    } else {
      configText += `**🏷️ Ticket Category:** ❌ Not configured\n`;
    }

    // Staff Role
    if (ticketConfig.staffRoleId) {
      const role = interaction.guild.roles.cache.get(ticketConfig.staffRoleId);
      configText += `**👥 Staff Role:** ${role ? `${role} (${role.members.size} members)` : `⚠️ Role not found (ID: ${ticketConfig.staffRoleId})`}\n`;
    } else {
      configText += `**👥 Staff Role:** ❌ Not configured\n`;
    }

    // Log Channel
    if (ticketConfig.logChannelId) {
      const channel = interaction.guild.channels.cache.get(ticketConfig.logChannelId);
      configText += `**📝 Log Channel:** ${channel ? `<#${ticketConfig.logChannelId}>` : `⚠️ Channel not found (ID: ${ticketConfig.logChannelId})`}\n`;
    } else {
      configText += `**📝 Log Channel:** ❌ Not configured\n`;
    }

    configText += '\n**⚙️ Settings:**\n';
    configText += `• **Auto-close tickets:** ${ticketConfig.autoClose ? 'Enabled' : 'Disabled'}\n`;
    configText += `• **Max tickets per user:** ${ticketConfig.maxTicketsPerUser || 3}\n`;
    configText += `• **Auto-close after:** ${ticketConfig.autoCloseHours || 168} hours (${Math.round((ticketConfig.autoCloseHours || 168) / 24)} days)\n`;

    // Add setup status
    const isFullyConfigured = ticketCategoryId && ticketConfig.staffRoleId;
    configText += `\n**📊 Status:** ${isFullyConfigured ? '✅ Ready' : '⚠️ Incomplete setup'}`;

    if (!isFullyConfigured) {
      configText += `\n\n**⚠️ Required for full functionality:**`;
      if (!ticketCategoryId) configText += `\n• Set ticket category with \`/configure-tickets channel\``;
      if (!ticketConfig.staffRoleId) configText += `\n• Set staff role with \`/configure-tickets staff-role\``;
    }

    await interaction.editReply({ content: configText });
  }

  /**
   * Reset ticket configuration to defaults
   * @param {CommandInteraction} interaction - Discord interaction
   * @private
   */
  async _resetConfiguration(interaction) {
    const confirm = interaction.options.getBoolean('confirm');
    
    if (!confirm) {
      await interaction.editReply({
        content: '❌ **Reset Cancelled**\n\nTo reset all ticket configurations, you must set the `confirm` option to `True`.\n\n' +
                '⚠️ **Warning:** This will remove all ticket system settings and cannot be undone.'
      });
      return;
    }

    const server = await this.configRepository.findServerById(interaction.guild.id);
    
    if (!server) {
      await interaction.editReply({
        content: '❌ No ticket configuration found to reset.'
      });
      return;
    }

    // Reset ticket configuration
    server._config.ticketsChannelId = null;
    server._config.ticketConfig = {
      autoClose: false,
      maxTicketsPerUser: 3,
      autoCloseHours: 168
    };
    server._config.updatedAt = new Date();

    await this.configRepository.saveServer(server);

    await interaction.editReply({
      content: '✅ **Ticket Configuration Reset**\n\n' +
              'All ticket system settings have been reset to defaults:\n\n' +
              '• **Ticket category:** Removed\n' +
              '• **Staff role:** Removed\n' +
              '• **Log channel:** Removed\n' +
              '• **Auto-close:** Disabled\n' +
              '• **Max tickets per user:** 3\n' +
              '• **Auto-close after:** 168 hours (7 days)\n\n' +
              'Use `/configure-tickets` subcommands to reconfigure your ticket system.'
    });
  }
}

module.exports = ConfigureTicketCommand;