export = SunnyvaleBot;
/**
 * Main Discord bot application
 * Implements comprehensive OOP architecture with service layer pattern
 * @class SunnyvaleBot
 */
declare class SunnyvaleBot {
    /**
     * Discord client instance
     * @type {Client}
     */
    client: Client;
    /**
     * Database manager instance
     * @type {DatabaseManager}
     */
    database: DatabaseManager;
    /**
     * Command handler instance
     * @type {CommandHandler}
     */
    commandHandler: CommandHandler;
    /**
     * Service layer instances
     * @type {Object}
     */
    services: any;
    /**
     * Bot startup timestamp
     * @type {Date}
     */
    startTime: Date;
    /**
     * Shutdown flag
     * @type {boolean}
     */
    isShuttingDown: boolean;
    /**
     * Initialize and start the bot
     * @returns {Promise<void>}
     */
    start(): Promise<void>;
    /**
     * Validate required environment variables
     * @private
     */
    private _validateEnvironment;
    /**
     * Initialize Discord client with proper intents and partials
     * @private
     */
    private _initializeClient;
    /**
     * Initialize database manager and create collections
     * @private
     * @returns {Promise<void>}
     */
    private _initializeDatabase;
    /**
     * Initialize all service layer components
     * @private
     * @returns {Promise<void>}
     */
    private _initializeServices;
    /**
     * Initialize command handler with service dependencies
     * @private
     */
    private _initializeCommandHandler;
    /**
     * Register Discord client event listeners
     * @private
     */
    private _registerEventListeners;
    /**
     * Get bot status and statistics
     * @returns {Object} Bot status information
     */
    getStatus(): any;
    /**
     * Gracefully shutdown the bot
     * @returns {Promise<void>}
     */
    shutdown(): Promise<void>;
}
import { Client } from "discord.js";
import DatabaseManager = require("./infrastructure/DatabaseManager");
import CommandHandler = require("./core/CommandHandler");
//# sourceMappingURL=index.d.ts.map