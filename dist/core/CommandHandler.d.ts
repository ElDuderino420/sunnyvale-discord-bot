export = CommandHandler;
/**
 * Central command handler for managing Discord slash commands
 * Implements dependency injection, command registration, and interaction routing
 * @class CommandHandler
 */
declare class CommandHandler {
    /**
     * Initialize command handler with Discord client and service dependencies
     * @param {Client} client - Discord.js client instance
     * @param {Object} services - Service layer dependencies
     * @param {ModerationService} services.moderationService - Moderation operations service
     * @param {TicketService} services.ticketService - Ticket system service
     * @param {RoleService} services.roleService - Role management service
     * @param {ServerTemplateService} services.templateService - Server template service
     */
    constructor(client: Client, services: {
        moderationService: ModerationService;
        ticketService: TicketService;
        roleService: RoleService;
        templateService: ServerTemplateService;
    });
    client: Client;
    services: {
        moderationService: ModerationService;
        ticketService: TicketService;
        roleService: RoleService;
        templateService: ServerTemplateService;
    };
    /**
     * Collection of registered commands
     * @type {Collection<string, BaseCommand>}
     */
    commands: Collection<string, BaseCommand>;
    /**
     * Collection of command cooldowns per user
     * @type {Collection<string, Collection<string, number>>}
     */
    cooldowns: Collection<string, Collection<string, number>>;
    /**
     * Initialize all command instances with dependency injection
     * @private
     */
    private _initializeCommands;
    /**
     * Register Discord event listeners for command handling
     * @private
     */
    private _registerEventListeners;
    /**
     * Handle slash command interactions
     * @private
     * @param {CommandInteraction} interaction - Discord command interaction
     */
    private _handleSlashCommand;
    /**
     * Handle button interactions (primarily for ticket system)
     * @private
     * @param {ButtonInteraction} interaction - Discord button interaction
     */
    private _handleButtonInteraction;
    /**
     * Handle reaction add events for autoroles
     * @private
     * @param {MessageReaction} reaction - Discord message reaction
     * @param {User} user - User who added the reaction
     */
    private _handleReactionAdd;
    /**
     * Handle reaction remove events for autoroles
     * @private
     * @param {MessageReaction} reaction - Discord message reaction
     * @param {User} user - User who removed the reaction
     */
    private _handleReactionRemove;
    /**
     * Handle member join events for persistent roles
     * @private
     * @param {GuildMember} member - Member who joined
     */
    private _handleMemberJoin;
    /**
     * Handle member leave events for persistent roles
     * @private
     * @param {GuildMember} member - Member who left
     */
    private _handleMemberLeave;
    /**
     * Register slash commands with Discord API
     * @param {string} clientId - Discord application client ID
     * @param {string} guildId - Guild ID for testing (optional, omit for global commands)
     * @returns {Promise<void>}
     */
    registerCommands(clientId: string, guildId?: string): Promise<void>;
    /**
     * Get command statistics
     * @returns {Object} Command usage statistics
     */
    getCommandStats(): any;
    /**
     * Shutdown command handler and cleanup resources
     */
    shutdown(): Promise<void>;
}
import { Collection } from "discord.js";
//# sourceMappingURL=CommandHandler.d.ts.map