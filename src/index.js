const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { config } = require('dotenv');

// Load environment variables
config();

// Import core components
const DatabaseManager = require('./infrastructure/DatabaseManager');
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
   * Initialize Discord client with proper intents and partials
   * @private
   */
  _initializeClient() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
      ],
      partials: [
        Partials.Message,
        Partials.Channel,
        Partials.Reaction,
        Partials.User,
        Partials.GuildMember
      ]
    });

    console.log('✅ Discord client initialized');
  }

  /**
   * Initialize database manager and create collections
   * @private
   * @returns {Promise<void>}
   */
  async _initializeDatabase() {
    this.database = new DatabaseManager();
    await this.database.initialize();

    console.log('✅ Database initialized');
  }

  /**
   * Initialize all service layer components
   * @private
   * @returns {Promise<void>}
   */
  async _initializeServices() {
    // Initialize repositories
    const UserRepository = require('./repositories/UserRepository');
    const ConfigRepository = require('./repositories/ConfigRepository');
    const TicketRepository = require('./repositories/TicketRepository');
    
    const userRepository = new UserRepository(this.database);
    const configRepository = new ConfigRepository(this.database);
    const ticketRepository = new TicketRepository(this.database);
    
    // Store repositories in services for command access
    this.services.configRepository = configRepository;
    
    // Initialize services with proper dependencies
    this.services.permissionService = new PermissionService(configRepository);
    this.services.moderationService = new ModerationService(userRepository, configRepository, this.services.permissionService);
    this.services.ticketService = new TicketService(ticketRepository, configRepository, this.services.permissionService);
    this.services.roleService = new RoleService(userRepository, configRepository, this.services.permissionService);
    this.services.templateService = new ServerTemplateService(configRepository, this.services.permissionService);

    // Services are now initialized (no initialize methods needed)

    console.log('✅ Services initialized');
  }

  /**
   * Initialize command handler with service dependencies
   * @private
   */
  _initializeCommandHandler() {
    this.commandHandler = new CommandHandler(this.client, this.services);
    console.log('✅ Command handler initialized');
  }

  /**
   * Register Discord client event listeners
   * @private
   */
  _registerEventListeners() {
    // Bot ready event
    this.client.once('ready', async () => {
      console.log(`🟢 Bot is online as ${this.client.user.tag}!`);
      console.log(`📊 Serving ${this.client.guilds.cache.size} guild(s)`);
      console.log(`⏱️ Startup time: ${Date.now() - this.startTime.getTime()}ms`);

      // Set bot status
      this.client.user.setActivity('Sunnyvale Trailer Park', { type: 'WATCHING' });

      // Register slash commands
      try {
        if (process.env.GUILD_ID) {
          // Try to register for specific guild (development)
          try {
            await this.commandHandler.registerCommands(process.env.CLIENT_ID, process.env.GUILD_ID);
          } catch (guildError) {
            console.warn('⚠️ Guild command registration failed, falling back to global registration:', guildError.message);
            // Fallback to global registration
            await this.commandHandler.registerCommands(process.env.CLIENT_ID);
          }
        } else {
          // Register globally (production)
          await this.commandHandler.registerCommands(process.env.CLIENT_ID);
        }
      } catch (error) {
        console.error('❌ Error registering commands:', error);
      }
    });

    // Error handling
    this.client.on('error', (error) => {
      console.error('Discord client error:', error);
    });

    this.client.on('warn', (warning) => {
      console.warn('Discord client warning:', warning);
    });

    // Debug logging (only in development)
    if (process.env.NODE_ENV === 'development') {
      this.client.on('debug', (info) => {
        if (info.includes('heartbeat')) return; // Skip noisy heartbeat logs
        console.debug('Discord debug:', info);
      });
    }

    // Guild join/leave events
    this.client.on('guildCreate', (guild) => {
      console.log(`➕ Joined guild: ${guild.name} (${guild.id}) - ${guild.memberCount} members`);
    });

    this.client.on('guildDelete', (guild) => {
      console.log(`➖ Left guild: ${guild.name} (${guild.id})`);
    });

    console.log('✅ Event listeners registered');
  }

  /**
   * Get bot status and statistics
   * @returns {Object} Bot status information
   */
  getStatus() {
    if (!this.client || !this.client.user) {
      return { status: 'offline', uptime: 0 };
    }

    return {
      status: 'online',
      username: this.client.user.tag,
      userId: this.client.user.id,
      guilds: this.client.guilds.cache.size,
      users: this.client.users.cache.size,
      uptime: Date.now() - this.startTime.getTime(),
      startTime: this.startTime.toISOString(),
      memory: process.memoryUsage(),
      commands: this.commandHandler ? this.commandHandler.getCommandStats() : null
    };
  }

  /**
   * Gracefully shutdown the bot
   * @returns {Promise<void>}
   */
  async shutdown() {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    console.log('🔄 Shutting down Sunnyvale Discord Bot...');

    try {
      // Shutdown command handler
      if (this.commandHandler) {
        await this.commandHandler.shutdown();
      }

      // Close database connections
      if (this.database) {
        await this.database.close();
      }

      // Destroy Discord client
      if (this.client) {
        this.client.destroy();
      }

      console.log('✅ Bot shutdown complete');

    } catch (error) {
      console.error('❌ Error during shutdown:', error);
    }
  }
}

// Create and start bot instance
const bot = new SunnyvaleBot();

// Handle process signals for graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n📋 Received SIGINT, shutting down gracefully...');
  await bot.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n📋 Received SIGTERM, shutting down gracefully...');
  await bot.shutdown();
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Promise Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Start the bot
bot.start().catch(console.error);

module.exports = SunnyvaleBot;