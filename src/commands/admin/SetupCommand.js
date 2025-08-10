const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const BaseCommand = require('../BaseCommand');

/**
 * Setup command for configuring bot settings per server
 * Allows administrators to configure moderator roles and other settings
 * @class SetupCommand
 * @extends BaseCommand
 */
class SetupCommand extends BaseCommand {
  /**
   * Initialize setup command with permission service dependency
   * @param {PermissionService} permissionService - Service for permission operations
   * @param {ConfigRepository} configRepository - Repository for server configuration
   */
  constructor(permissionService, configRepository) {
    super();
    this.permissionService = permissionService;
    this.configRepository = configRepository;
    this._category = 'admin';
    this._requiredPermissions = []; // Remove automatic permission check
    this._cooldown = 5000;
    this._guildOnly = true;
  }

  /**
   * Command metadata for Discord registration
   * @returns {SlashCommandBuilder} Discord slash command data
   */
  get data() {
    return new SlashCommandBuilder()
      .setName('setup')
      .setDescription('Configure bot settings for this server')
      .addSubcommand(subcommand =>
        subcommand
          .setName('moderator-role')
          .setDescription('Set the moderator role for this server')
          .addRoleOption(option =>
            option.setName('role')
              .setDescription('The role that should have moderator permissions')
              .setRequired(true)))
      .addSubcommand(subcommand =>
        subcommand
          .setName('jail-channel')
          .setDescription('Set the jail channel for this server')
          .addChannelOption(option =>
            option.setName('channel')
              .setDescription('The channel where jailed users will be confined')
              .setRequired(true)))
      .addSubcommand(subcommand =>
        subcommand
          .setName('jail-role')
          .setDescription('Set the role assigned to jailed users')
          .addRoleOption(option =>
            option.setName('role')
              .setDescription('The role that jailed users will receive (replaces other roles)')
              .setRequired(true)))
      .addSubcommand(subcommand =>
        subcommand
          .setName('status')
          .setDescription('Show current bot configuration for this server'))
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);
  }

  /**
   * Execute setup command with subcommand routing
   * @param {CommandInteraction} interaction - Discord slash command interaction
   * @returns {Promise<void>}
   */
  async execute(interaction) {
    // Manual permission check - require Administrator permission
    if (!interaction.member.permissions.has('Administrator')) {
      await interaction.reply({
        content: '❌ You need Administrator permission to use setup commands.',
        flags: [4] // MessageFlags.Ephemeral
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'moderator-role':
        await this._handleModeratorRole(interaction);
        break;
      case 'jail-channel':
        await this._handleJailChannel(interaction);
        break;
      case 'jail-role':
        await this._handleJailRole(interaction);
        break;
      case 'status':
        await this._handleStatus(interaction);
        break;
      default:
        await interaction.editReply({
          content: '❌ Unknown subcommand.'
        });
    }
  }

  /**
   * Handle moderator role setup
   * @private
   * @param {CommandInteraction} interaction - Discord interaction
   */
  async _handleModeratorRole(interaction) {
    // Defer reply for potentially long-running database operations
    await interaction.deferReply();

    try {
      const role = interaction.options.getRole('role');

      // Validate role
      if (role.managed) {
        await interaction.editReply({
          content: '❌ Cannot use a managed role (bot role) as moderator role.'
        });
        return;
      }

      if (role.id === interaction.guild.id) {
        await interaction.editReply({
          content: '❌ Cannot use @everyone as moderator role.'
        });
        return;
      }

      // Get or create server configuration
      let server = await this.configRepository.findServerById(interaction.guild.id);
      if (!server) {
        const Server = require('../../entities/Server');
        server = new Server(interaction.guild.id, interaction.guild.name);
      }

      // Set moderator role
      server.setModeratorRole(role.id);
      await this.configRepository.saveServer(server);

      await interaction.editReply({
        content: `✅ **Moderator Role Updated!**\n\n` +
                `**Role:** ${role.name}\n` +
                `**Members with this role can now use moderation commands.**\n\n` +
                `Use \`/setup status\` to view all bot settings.`
      });

      console.log(`Moderator role set to '${role.name}' (${role.id}) for server ${interaction.guild.name} (${interaction.guild.id}) by ${interaction.user.tag} (${interaction.user.id})`);

    } catch (error) {
      console.error('Error setting moderator role:', error);
      await interaction.editReply({
        content: '❌ An error occurred while setting the moderator role.'
      });
    }
  }

  /**
   * Handle jail channel setup
   * @private
   * @param {CommandInteraction} interaction - Discord interaction
   */
  async _handleJailChannel(interaction) {
    // Defer reply for potentially long-running database operations
    await interaction.deferReply();

    try {
      const channel = interaction.options.getChannel('channel');

      // Validate channel
      if (!channel.isTextBased()) {
        await interaction.editReply({
          content: '❌ Jail channel must be a text-based channel.'
        });
        return;
      }

      // Check bot permissions in the channel
      const botMember = interaction.guild.members.cache.get(interaction.client.user.id);
      const permissions = channel.permissionsFor(botMember);
      
      if (!permissions.has(['ViewChannel', 'SendMessages', 'ManageRoles', 'ManageChannels'])) {
        await interaction.editReply({
          content: '❌ I need View Channel, Send Messages, Manage Roles, and Manage Channels permissions in that channel.'
        });
        return;
      }

      // Get or create server configuration
      let server = await this.configRepository.findServerById(interaction.guild.id);
      if (!server) {
        const Server = require('../../entities/Server');
        server = new Server(interaction.guild.id, interaction.guild.name);
      }

      // Set jail channel
      server.setJailChannel(channel.id);
      await this.configRepository.saveServer(server);

      let statusMessage = `✅ **Jail Channel Updated!**\n\n` +
                         `**Channel:** <#${channel.id}>\n` +
                         `**Jailed users will be confined to this channel.**\n\n`;

      // Auto-configure permissions if jail role is also set
      const jailRoleId = server.getJailedRole();
      if (jailRoleId) {
        const jailRole = interaction.guild.roles.cache.get(jailRoleId);
        if (jailRole) {
          await this._configureJailPermissions(interaction.guild, channel, jailRole);
          statusMessage += `🔒 **Auto-configured permissions for jail role ${jailRole.name}**\n\n`;
        }
      } else {
        statusMessage += `⚠️ **Set up jail role with \`/setup jail-role\` for automatic permission configuration**\n\n`;
      }

      statusMessage += `Use \`/setup status\` to view all bot settings.`;

      await interaction.editReply({
        content: statusMessage
      });

      console.log(`Jail channel set to '${channel.name}' (${channel.id}) for server ${interaction.guild.name} (${interaction.guild.id}) by ${interaction.user.tag} (${interaction.user.id})`);

    } catch (error) {
      console.error('Error setting jail channel:', error);
      await interaction.editReply({
        content: '❌ An error occurred while setting the jail channel.'
      });
    }
  }

  /**
   * Handle jail role setup
   * @private
   * @param {CommandInteraction} interaction - Discord interaction
   */
  async _handleJailRole(interaction) {
    // Defer reply for potentially long-running database operations
    await interaction.deferReply();

    try {
      const role = interaction.options.getRole('role');

      // Validate role
      if (role.managed) {
        await interaction.editReply({
          content: '❌ Cannot use a managed role (bot role) as jail role.'
        });
        return;
      }

      if (role.id === interaction.guild.id) {
        await interaction.editReply({
          content: '❌ Cannot use @everyone as jail role.'
        });
        return;
      }

      // Check bot permissions - bot must be able to assign this role
      const botMember = interaction.guild.members.cache.get(interaction.client.user.id);
      if (role.position >= botMember.roles.highest.position) {
        await interaction.editReply({
          content: '❌ I cannot assign that role because it\'s higher than or equal to my highest role. Please move my role above the jail role in Server Settings > Roles.'
        });
        return;
      }

      // Check bot has Manage Channels permission
      if (!interaction.guild.members.me.permissions.has('ManageChannels')) {
        await interaction.editReply({
          content: '❌ I need the "Manage Channels" permission to automatically configure jail role permissions.'
        });
        return;
      }

      // Get or create server configuration
      let server = await this.configRepository.findServerById(interaction.guild.id);
      if (!server) {
        const Server = require('../../entities/Server');
        server = new Server(interaction.guild.id, interaction.guild.name);
      }

      // Set jail role
      server.setJailedRole(role.id);
      await this.configRepository.saveServer(server);

      let statusMessage = `✅ **Jail Role Updated!**\n\n` +
                         `**Role:** ${role.name}\n` +
                         `**Jailed users will receive this role and have their other roles temporarily removed.**\n\n`;

      // Auto-configure permissions if jail channel is also set
      const jailChannelId = server.getJailChannel();
      if (jailChannelId) {
        const jailChannel = interaction.guild.channels.cache.get(jailChannelId);
        if (jailChannel) {
          await this._configureJailPermissions(interaction.guild, jailChannel, role);
          statusMessage += `🔒 **Auto-configured permissions for jail channel <#${jailChannelId}>**\n\n`;
        }
      } else {
        statusMessage += `⚠️ **Set up jail channel with \`/setup jail-channel\` for automatic permission configuration**\n\n`;
      }

      statusMessage += `Use \`/setup status\` to view all bot settings.`;

      await interaction.editReply({
        content: statusMessage
      });

      console.log(`Jail role set to '${role.name}' (${role.id}) for server ${interaction.guild.name} (${interaction.guild.id}) by ${interaction.user.tag} (${interaction.user.id})`);

    } catch (error) {
      console.error('Error setting jail role:', error);
      await interaction.editReply({
        content: '❌ An error occurred while setting the jail role.'
      });
    }
  }

  /**
   * Configure jail permissions automatically
   * @private
   * @param {Guild} guild - Discord guild
   * @param {Channel} jailChannel - Jail channel
   * @param {Role} jailRole - Jail role
   */
  async _configureJailPermissions(guild, jailChannel, jailRole) {
    try {
      console.log(`Configuring jail permissions for role ${jailRole.name} in guild ${guild.name}`);

      // Step 1: Deny jail role access to all channels and categories
      const channels = guild.channels.cache.filter(channel => 
        channel.type !== 'DM' && 
        channel.id !== jailChannel.id && 
        channel.permissionsFor(guild.members.me).has('ManageRoles')
      );

      for (const [channelId, channel] of channels) {
        try {
          await channel.permissionOverwrites.edit(jailRole, {
            ViewChannel: false,
            SendMessages: false,
            Connect: false,
            Speak: false
          });
        } catch (error) {
          console.warn(`Failed to set permissions for ${channel.name}:`, error.message);
        }
      }

      // Step 2: Allow jail role access ONLY to the jail channel
      await jailChannel.permissionOverwrites.edit(jailRole, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
        Connect: false,
        Speak: false,
        UseVAD: false,
        Stream: false,
        UseEmbeddedActivities: false,
        UseExternalEmojis: false,
        UseExternalStickers: false,
        AddReactions: false,
        AttachFiles: false,
        EmbedLinks: false,
        MentionEveryone: false,
        CreatePublicThreads: false,
        CreatePrivateThreads: false,
        SendMessagesInThreads: false,
        ManageMessages: false,
        ManageThreads: false
      });

      console.log(`Successfully configured jail permissions for role ${jailRole.name}`);
    } catch (error) {
      console.error('Error configuring jail permissions:', error);
      throw error;
    }
  }

  /**
   * Handle status display
   * @private
   * @param {CommandInteraction} interaction - Discord interaction
   */
  async _handleStatus(interaction) {
    // Defer reply for database operations
    await interaction.deferReply();

    try {
      const server = await this.configRepository.findServerById(interaction.guild.id);

      if (!server) {
        await interaction.editReply({
          content: `📋 **Bot Configuration Status**\n\n` +
                  `**Server:** ${interaction.guild.name}\n` +
                  `**Status:** Not configured\n\n` +
                  `Use \`/setup moderator-role\` to set up moderation commands.\n` +
                  `Use \`/setup jail-channel\` to set up the jail system.`
        });
        return;
      }

      // Get role and channel information
      const moderatorRoleId = server.getModeratorRole();
      const jailChannelId = server.getJailChannel();
      const jailRoleId = server.getJailedRole();

      const moderatorRole = moderatorRoleId ? interaction.guild.roles.cache.get(moderatorRoleId) : null;
      const jailChannel = jailChannelId ? interaction.guild.channels.cache.get(jailChannelId) : null;
      const jailRole = jailRoleId ? interaction.guild.roles.cache.get(jailRoleId) : null;

      let status = `📋 **Bot Configuration Status**\n\n`;
      status += `**Server:** ${interaction.guild.name}\n\n`;
      
      // Moderator role status
      if (moderatorRole) {
        status += `**Moderator Role:** ${moderatorRole.name} ✅\n`;
        const memberCount = moderatorRole.members.size;
        status += `**Moderators:** ${memberCount} member${memberCount !== 1 ? 's' : ''}\n`;
      } else {
        status += `**Moderator Role:** Not set ❌\n`;
      }
      
      // Jail channel status
      if (jailChannel) {
        status += `**Jail Channel:** <#${jailChannel.id}> ✅\n`;
      } else {
        status += `**Jail Channel:** Not set ❌\n`;
      }
      
      // Jail role status
      if (jailRole) {
        status += `**Jail Role:** ${jailRole.name} ✅\n`;
      } else {
        status += `**Jail Role:** Not set ❌\n`;
      }

      status += `\n**Configuration Updated:** <t:${Math.floor(server._config.updatedAt.getTime() / 1000)}:R>\n\n`;

      // Show setup instructions for missing configurations  
      if (!moderatorRole || !jailChannel || !jailRole) {
        status += `**Setup Instructions:**\n`;
        if (!moderatorRole) {
          status += `• Use \`/setup moderator-role\` to enable moderation commands\n`;
        }
        if (!jailChannel) {
          status += `• Use \`/setup jail-channel\` to set jail channel\n`;
        }
        if (!jailRole) {
          status += `• Use \`/setup jail-role\` to set jail role\n`;
        }
      }

      await interaction.editReply({
        content: status
      });

    } catch (error) {
      console.error('Error showing setup status:', error);
      await interaction.editReply({
        content: '❌ An error occurred while fetching the bot configuration.'
      });
    }
  }
}

module.exports = SetupCommand;