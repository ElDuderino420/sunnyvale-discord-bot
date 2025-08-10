export = SunnyvaleBot;
/**
 * Main Discord bot application
 * Implements comprehensive OOP architecture with service layer pattern
 * @class SunnyvaleBot
 */
declare class SunnyvaleBot {
    /**
     * Get Discord client instance (for external access)
     * @returns {Client} Discord client
     */
    get client(): Client<boolean>;
    /**
     * Get database manager instance (for external access)
     * @returns {DatabaseManager} Database manager
     */
    get database(): DatabaseManager;
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
     * Get bot start time
     * @returns {Date|null} Start time or null if not started
     */
    get startTime(): Date;
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
     * Gracefully shutdown the bot
     * @returns {Promise<void>}
     */
    shutdown(): Promise<void>;
    /**
     * Load command files
     * @private
     * @returns {Promise<void>}
     * @throws {Error} When command loading fails
     */
    private _loadCommands;
    /**
     * Load event files
     * @private
     * @returns {Promise<void>}
     * @throws {Error} When event loading fails
     */
    private _loadEvents;
    /**
     * Setup global error handlers
     * @private
     */
    private _setupErrorHandlers;
    /**
     * Get bot statistics
     * @returns {Object} Bot statistics
     * @example
     * const stats = bot.getStats();
     * console.log(`Uptime: ${stats.uptime}`);
     */
    getStats(): any;
    /**
     * Get commands collection (for external access)
     * @returns {Collection} Commands collection
     */
    get commands(): Collection;
    /**
     * Check if bot is initialized
     * @returns {boolean} Initialization status
     */
    get isInitialized(): boolean;
}
import { Client } from "discord.js";
import CommandHandler = require("./core/CommandHandler");
//# sourceMappingURL=index_old.d.ts.map