const { Collection, REST, Routes } = require('discord.js');

// Import all command classes
const KickCommand = require('../commands/moderation/KickCommand');
const BanCommand = require('../commands/moderation/BanCommand');
const TempbanCommand = require('../commands/moderation/TempbanCommand');
const JailCommand = require('../commands/moderation/JailCommand');
const UnjailCommand = require('../commands/moderation/UnjailCommand');
const ClearCommand = require('../commands/moderation/ClearCommand');
const WarnCommand = require('../commands/moderation/WarnCommand');
const NoteCommand = require('../commands/moderation/NoteCommand');

const CreateTicketCommand = require('../commands/tickets/CreateTicketCommand');
const CloseTicketCommand = require('../commands/tickets/CloseTicketCommand');
const ConfigureTicketCommand = require('../commands/tickets/ConfigureTicketCommand');
const TicketPanelCommand = require('../commands/tickets/TicketPanelCommand');

const AutorolesCommand = require('../commands/roles/AutorolesCommand');

const ExportTemplateCommand = require('../commands/templates/ExportTemplateCommand');
const ImportTemplateCommand = require('../commands/templates/ImportTemplateCommand');
const ExportTemplateFileCommand = require('../commands/templates/ExportTemplateFileCommand');
const ImportTemplateFileCommand = require('../commands/templates/ImportTemplateFileCommand');
const BatchTemplateCommand = require('../commands/templates/BatchTemplateCommand');

const SetupCommand = require('../commands/admin/SetupCommand');

/**
 * Central command handler for managing Discord slash commands
 * Implements dependency injection, command registration, and interaction routing
 * @class CommandHandler
 */
class CommandHandler {
  /**
   * Initialize command handler with Discord client and service dependencies
   * @param {Client} client - Discord.js client instance
   * @param {Object} services - Service layer dependencies
   * @param {ModerationService} services.moderationService - Moderation operations service
   * @param {TicketService} services.ticketService - Ticket system service
   * @param {RoleService} services.roleService - Role management service
   * @param {ServerTemplateService} services.templateService - Server template service
   */
  constructor(client, services) {
    this.client = client;
    this.services = services;
    
    /**
     * Collection of registered commands
     * @type {Collection<string, BaseCommand>}
     */
    this.commands = new Collection();
    
    /**
     * Collection of command cooldowns per user
     * @type {Collection<string, Collection<string, number>>}
     */
    this.cooldowns = new Collection();

    // Initialize commands and register event listeners
    this._initializeCommands();
    this._registerEventListeners();
  }

  /**
   * Initialize all command instances with dependency injection
   * @private
   */
  _initializeCommands() {
    try {
      // Moderation commands
      const moderationCommands = [
        new KickCommand(this.services.moderationService),
        new BanCommand(this.services.moderationService),
        new TempbanCommand(this.services.moderationService),
        new JailCommand(this.services.moderationService, this.services.configRepository),
        new UnjailCommand(this.services.moderationService, this.services.configRepository),
        new WarnCommand(this.services.moderationService),
        new NoteCommand(this.services.moderationService),
        new ClearCommand()
      ];

      // Ticket commands
      const ticketCommands = [
        new CreateTicketCommand(this.services.ticketService),
        new CloseTicketCommand(this.services.ticketService, this.services.configRepository),
        new ConfigureTicketCommand(this.services.configRepository, this.services.permissionService),
        new TicketPanelCommand(this.services.configRepository)
      ];

      // Role commands
      const roleCommands = [
        new AutorolesCommand(this.services.roleService)
      ];

      // Template commands
      const templateCommands = [
        new ExportTemplateCommand(this.services.templateService),
        new ImportTemplateCommand(this.services.templateService),
        new ExportTemplateFileCommand(this.services.templateService),
        new ImportTemplateFileCommand(this.services.templateService),
        new BatchTemplateCommand(this.services.templateService)
      ];

      // Admin commands
      const adminCommands = [
        new SetupCommand(this.services.permissionService, this.services.configRepository)
      ];

      // Combine all commands
      const allCommands = [
        ...moderationCommands,
        ...ticketCommands,
        ...roleCommands,
        ...templateCommands,
        ...adminCommands
      ];

      // Register commands in collection
      for (const command of allCommands) {
        if (!command.data || !command.data.name) {
          console.error('Command missing required data property:', command.constructor.name);
          continue;
        }

        this.commands.set(command.data.name, command);
        console.log(`Registered command: ${command.data.name} (${command.constructor.name})`);
      }

      console.log(`Successfully initialized ${this.commands.size} commands`);

    } catch (error) {
      console.error('Error initializing commands:', error);
      throw error;
    }
  }

  /**
   * Register Discord event listeners for command handling
   * @private
   */
  _registerEventListeners() {
    // Handle slash command interactions
    this.client.on('interactionCreate', async (interaction) => {
      if (!interaction.isChatInputCommand()) return;

      await this._handleSlashCommand(interaction);
    });

    // Handle button interactions (for tickets, etc.)
    this.client.on('interactionCreate', async (interaction) => {
      if (!interaction.isButton()) return;

      await this._handleButtonInteraction(interaction);
    });

    // Handle message reactions for autoroles
    this.client.on('messageReactionAdd', async (reaction, user) => {
      await this._handleReactionAdd(reaction, user);
    });

    this.client.on('messageReactionRemove', async (reaction, user) => {
      await this._handleReactionRemove(reaction, user);
    });

    // Handle member join/leave for persistent roles
    this.client.on('guildMemberAdd', async (member) => {
      await this._handleMemberJoin(member);
    });

    this.client.on('guildMemberRemove', async (member) => {
      await this._handleMemberLeave(member);
    });

    console.log('Command handler event listeners registered');
  }

  /**
   * Handle slash command interactions
   * @private
   * @param {CommandInteraction} interaction - Discord command interaction
   */
  async _handleSlashCommand(interaction) {
    const command = this.commands.get(interaction.commandName);

    if (!command) {
      console.error(`No command matching ${interaction.commandName} was found.`);
      await interaction.reply({
        content: 'Command not found. This command may be outdated or disabled.',
        flags: [4] // MessageFlags.Ephemeral
      });
      return;
    }

    try {
      // Use BaseCommand's run method which handles validation, cooldowns, etc.
      await command.run(interaction);
      
    } catch (error) {
      console.error(`Error executing command ${interaction.commandName}:`, error);
      
      // Generic fallback error reply
      const errorMessage = 'There was an error while executing this command!';
      
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: errorMessage,
            flags: [4] // MessageFlags.Ephemeral
          });
        } else if (interaction.deferred) {
          await interaction.editReply({
            content: errorMessage
          });
        } else {
          await interaction.followUp({
            content: errorMessage,
            flags: [4] // MessageFlags.Ephemeral
          });
        }
      } catch (followUpError) {
        console.error('Error sending error message:', followUpError);
      }
    }
  }

  /**
   * Handle button interactions (primarily for ticket system)
   * @private
   * @param {ButtonInteraction} interaction - Discord button interaction
   */
  async _handleButtonInteraction(interaction) {
    try {
      const [action, ...params] = interaction.customId.split('_');

      switch (action) {
        case 'create-ticket':
          await this.services.ticketService.handleCreateTicketButton(interaction);
          break;
        case 'close-ticket':
          await this.services.ticketService.handleCloseTicketButton(interaction);
          break;
        default:
          console.warn(`Unknown button interaction: ${interaction.customId}`);
          await interaction.reply({
            content: 'Unknown button interaction.',
            flags: [4] // MessageFlags.Ephemeral
          });
      }

    } catch (error) {
      console.error('Error handling button interaction:', error);
      
      if (!interaction.replied) {
        await interaction.reply({
          content: 'An error occurred while processing your request.',
          flags: [4] // MessageFlags.Ephemeral
        });
      }
    }
  }

  /**
   * Handle reaction add events for autoroles
   * @private
   * @param {MessageReaction} reaction - Discord message reaction
   * @param {User} user - User who added the reaction
   */
  async _handleReactionAdd(reaction, user) {
    // Ignore bot reactions
    if (user.bot) return;

    try {
      // Handle partial reactions
      if (reaction.partial) {
        await reaction.fetch();
      }

      await this.services.roleService.handleReactionAdd(reaction, user);

    } catch (error) {
      console.error('Error handling reaction add:', error);
    }
  }

  /**
   * Handle reaction remove events for autoroles
   * @private
   * @param {MessageReaction} reaction - Discord message reaction
   * @param {User} user - User who removed the reaction
   */
  async _handleReactionRemove(reaction, user) {
    // Ignore bot reactions
    if (user.bot) return;

    try {
      // Handle partial reactions
      if (reaction.partial) {
        await reaction.fetch();
      }

      await this.services.roleService.handleReactionRemove(reaction, user);

    } catch (error) {
      console.error('Error handling reaction remove:', error);
    }
  }

  /**
   * Handle member join events for persistent roles
   * @private
   * @param {GuildMember} member - Member who joined
   */
  async _handleMemberJoin(member) {
    try {
      await this.services.roleService.restorePersistentRoles(member);
      
    } catch (error) {
      console.error('Error handling member join:', error);
    }
  }

  /**
   * Handle member leave events for persistent roles
   * @private
   * @param {GuildMember} member - Member who left
   */
  async _handleMemberLeave(member) {
    try {
      await this.services.roleService.savePersistentRoles(member.guild.id, member.id, member.roles.cache);
      
    } catch (error) {
      console.error('Error handling member leave:', error);
    }
  }

  /**
   * Register slash commands with Discord API
   * @param {string} clientId - Discord application client ID
   * @param {string} guildId - Guild ID for testing (optional, omit for global commands)
   * @returns {Promise<void>}
   */
  async registerCommands(clientId, guildId = null) {
    try {
      const commandData = Array.from(this.commands.values()).map(command => command.data.toJSON());
      
      const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

      const scope = guildId ? `for guild ${guildId}` : 'globally';
      console.log(`Started refreshing ${commandData.length} application (/) commands ${scope}.`);

      let data;
      if (guildId) {
        // Register commands for specific guild (faster for testing)
        data = await rest.put(
          Routes.applicationGuildCommands(clientId, guildId),
          { body: commandData }
        );
      } else {
        // Register commands globally (takes up to 1 hour to propagate)
        data = await rest.put(
          Routes.applicationCommands(clientId),
          { body: commandData }
        );
      }

      console.log(`Successfully reloaded ${data.length} application (/) commands${guildId ? ` for guild ${guildId}` : ' globally'}.`);

    } catch (error) {
      console.error('Error registering commands:', error);
      throw error;
    }
  }

  /**
   * Get command statistics
   * @returns {Object} Command usage statistics
   */
  getCommandStats() {
    const stats = {
      totalCommands: this.commands.size,
      commandsByCategory: {},
      commandsList: []
    };

    for (const [name, command] of this.commands) {
      const category = command.category || 'uncategorized';
      
      if (!stats.commandsByCategory[category]) {
        stats.commandsByCategory[category] = 0;
      }
      stats.commandsByCategory[category]++;

      stats.commandsList.push({
        name,
        category,
        description: command.data.description,
        permissions: command.requiredPermissions,
        roles: command.requiredRoles,
        guildOnly: command.guildOnly,
        cooldown: command.cooldown
      });
    }

    return stats;
  }

  /**
   * Shutdown command handler and cleanup resources
   */
  async shutdown() {
    try {
      // Clear collections
      this.commands.clear();
      this.cooldowns.clear();

      console.log('Command handler shutdown complete');

    } catch (error) {
      console.error('Error during command handler shutdown:', error);
    }
  }
}

module.exports = CommandHandler;