const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { config } = require('dotenv');

// Load environment variables
config();

// Import core components
const DatabaseManager = require('./database/DatabaseManager');
const CommandHandler = require('./core/CommandHandler');

// Import services
const ModerationService = require('./services/ModerationService');
const TicketService = require('./services/TicketService');
const RoleService = require('./services/RoleService');
const PermissionService = require('./services/PermissionService');
const ServerTemplateService = require('./services/ServerTemplateService');

/**
 * Main Discord bot application
 * Implements comprehensive OOP architecture with service layer pattern
 * @class SunnyvaleBot
 */
class SunnyvaleBot {
  /**
   * Initialize the Sunnyvale Discord bot
   */
  constructor() {
    /**
     * Discord client instance
     * @type {Client}
     */
    this.client = null;

    /**
     * Database manager instance
     * @type {DatabaseManager}
     */
    this.database = null;

    /**
     * Command handler instance
     * @type {CommandHandler}
     */
    this.commandHandler = null;

    /**
     * Service layer instances
     * @type {Object}
     */
    this.services = {};

    /**
     * Bot startup timestamp
     * @type {Date}
     */
    this.startTime = null;

    /**
     * Shutdown flag
     * @type {boolean}
     */
    this.isShuttingDown = false;
  }

  /**
   * Initialize and start the bot
   * @returns {Promise<void>}
   */
  async start() {
    try {
      console.log('🤖 Starting Sunnyvale Discord Bot...');
      this.startTime = new Date();

      // Validate environment variables
      this._validateEnvironment();

      // Initialize Discord client
      this._initializeClient();

      // Initialize database
      await this._initializeDatabase();

      // Initialize services
      await this._initializeServices();

      // Initialize command handler
      this._initializeCommandHandler();

      // Register event listeners
      this._registerEventListeners();

      // Login to Discord
      await this.client.login(process.env.DISCORD_TOKEN);

      console.log('✅ Sunnyvale Discord Bot started successfully!');

    } catch (error) {
      console.error('❌ Failed to start bot:', error);
      await this.shutdown();
      process.exit(1);
    }
  }

  /**
   * Validate required environment variables
   * @private
   */
  _validateEnvironment() {
    const requiredVars = ['DISCORD_TOKEN', 'CLIENT_ID'];
    const missingVars = requiredVars.filter(varName => !process.env[varName]);

    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }

    console.log('✅ Environment variables validated');
  }

  /**
   * Gracefully shutdown the bot
   * @returns {Promise<void>}
   */
  async shutdown() {
    try {
      console.log('🛑 Shutting down Sunnyvale Bot...');

      // Close database connections
      if (this._dbManager) {
        await this._dbManager.close();
        console.log('📊 Database connections closed');
      }

      // Destroy Discord client
      if (this._client) {
        this._client.destroy();
        console.log('🔌 Discord client destroyed');
      }

      console.log('✅ Shutdown complete');
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
    }
  }

  /**
   * Validate required environment variables
   * @private
   * @throws {Error} When required environment variables are missing
   */
  _validateEnvironment() {
    const required = ['DISCORD_TOKEN', 'CLIENT_ID'];
    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    console.log('✅ Environment variables validated');
  }

  /**
   * Load command files
   * @private
   * @returns {Promise<void>}
   * @throws {Error} When command loading fails
   */
  async _loadCommands() {
    const commandsPath = path.join(__dirname, 'commands');
    
    try {
      // For now, we'll create a simple ping command as a placeholder
      // In the next phase, we'll load actual command files
      this._commands.set('ping', {
        data: {
          name: 'ping',
          description: 'Replies with Pong!'
        },
        async execute(interaction) {
          const started = Date.now();
          await interaction.reply('🏓 Pong!');
          const ping = Date.now() - started;
          await interaction.editReply(`🏓 Pong! \`${ping}ms\``);
        }
      });

      console.log(`✅ Loaded ${this._commands.size} commands`);
    } catch (error) {
      console.error('❌ Error loading commands:', error);
      throw error;
    }
  }

  /**
   * Load event files
   * @private
   * @returns {Promise<void>}
   * @throws {Error} When event loading fails
   */
  async _loadEvents() {
    try {
      // Setup basic events
      this._client.once('ready', () => {
        console.log(`🤖 Logged in as ${this._client.user.tag}`);
        console.log(`📡 Serving ${this._client.guilds.cache.size} guilds`);
        console.log(`👥 Connected to ${this._client.users.cache.size} users`);
      });

      this._client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand()) return;

        const command = this._commands.get(interaction.commandName);
        if (!command) {
          console.error(`❌ Command not found: ${interaction.commandName}`);
          return;
        }

        try {
          await command.execute(interaction);
        } catch (error) {
          console.error(`❌ Error executing command ${interaction.commandName}:`, error);
          
          const errorMessage = 'There was an error while executing this command!';
          
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: errorMessage, ephemeral: true });
          } else {
            await interaction.reply({ content: errorMessage, ephemeral: true });
          }
        }
      });

      console.log('✅ Events loaded');
    } catch (error) {
      console.error('❌ Error loading events:', error);
      throw error;
    }
  }

  /**
   * Setup global error handlers
   * @private
   */
  _setupErrorHandlers() {
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('❌ Uncaught Exception:', error);
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    });

    // Handle Discord client errors
    this._client.on('error', (error) => {
      console.error('❌ Discord Client Error:', error);
    });

    // Graceful shutdown on SIGINT and SIGTERM
    process.on('SIGINT', () => {
      console.log('🛑 Received SIGINT, shutting down gracefully...');
      this.shutdown().then(() => process.exit(0));
    });

    process.on('SIGTERM', () => {
      console.log('🛑 Received SIGTERM, shutting down gracefully...');
      this.shutdown().then(() => process.exit(0));
    });

    console.log('✅ Error handlers setup');
  }

  /**
   * Get bot statistics
   * @returns {Object} Bot statistics
   * @example
   * const stats = bot.getStats();
   * console.log(`Uptime: ${stats.uptime}`);
   */
  getStats() {
    const uptime = this._startTime ? Date.now() - this._startTime.getTime() : 0;
    
    return {
      uptime: uptime,
      guilds: this._client.guilds.cache.size,
      users: this._client.users.cache.size,
      commands: this._commands.size,
      ping: this._client.ws.ping,
      memoryUsage: process.memoryUsage(),
      nodeVersion: process.version,
      discordJsVersion: require('discord.js').version
    };
  }

  /**
   * Get Discord client instance (for external access)
   * @returns {Client} Discord client
   */
  get client() {
    return this._client;
  }

  /**
   * Get database manager instance (for external access)
   * @returns {DatabaseManager} Database manager
   */
  get database() {
    return this._dbManager;
  }

  /**
   * Get commands collection (for external access)
   * @returns {Collection} Commands collection
   */
  get commands() {
    return this._commands;
  }

  /**
   * Check if bot is initialized
   * @returns {boolean} Initialization status
   */
  get isInitialized() {
    return this._initialized;
  }

  /**
   * Get bot start time
   * @returns {Date|null} Start time or null if not started
   */
  get startTime() {
    return this._startTime;
  }
}

// Create and start bot if this file is run directly
if (require.main === module) {
  const bot = new SunnyvaleBot();
  
  bot.initialize()
    .then(() => bot.start())
    .catch((error) => {
      console.error('❌ Failed to start bot:', error);
      process.exit(1);
    });
}

module.exports = SunnyvaleBot;