export = BaseCommand;
/**
 * Abstract base class for all Discord slash commands
 * Enforces consistent command structure, permission checking, and error handling
 * @abstract
 * @class BaseCommand
 * @example
 * class KickCommand extends BaseCommand {
 *   constructor(moderationService) {
 *     super();
 *     this.moderationService = moderationService;
 *   }
 *
 *   get data() {
 *     return new SlashCommandBuilder()
 *       .setName('kick')
 *       .setDescription('Kick a user from the server');
 *   }
 *
 *   async execute(interaction) {
 *     // Implementation
 *   }
 * }
 */
declare class BaseCommand {
    /**
     * Command category for organization
     * @type {string}
     * @protected
     */
    protected _category: string;
    /**
     * Required permissions for command execution
     * @type {Array<string>}
     * @protected
     */
    protected _requiredPermissions: Array<string>;
    /**
     * Required roles for command execution (role IDs or names)
     * @type {Array<string>}
     * @protected
     */
    protected _requiredRoles: Array<string>;
    /**
     * Whether command requires guild context (not available in DMs)
     * @type {boolean}
     * @protected
     */
    protected _guildOnly: boolean;
    /**
     * Command cooldown in milliseconds
     * @type {number}
     * @protected
     */
    protected _cooldown: number;
    /**
     * User cooldown tracking
     * @type {Map<string, number>}
     * @private
     */
    private _cooldowns;
    /**
     * Command metadata for Discord registration
     * Must be implemented by subclasses
     * @abstract
     * @returns {SlashCommandBuilder} Discord slash command data
     * @throws {Error} When not implemented by subclass
     * @example
     * get data() {
     *   return new SlashCommandBuilder()
     *     .setName('example')
     *     .setDescription('Example command');
     * }
     */
    get data(): SlashCommandBuilder;
    /**
     * Execute command with comprehensive validation and error handling
     * Must be implemented by subclasses
     * @abstract
     * @param {CommandInteraction} interaction - Discord slash command interaction
     * @returns {Promise<void>}
     * @throws {Error} When not implemented by subclass
     * @example
     * async execute(interaction) {
     *   await interaction.reply('Command executed!');
     * }
     */
    execute(interaction: CommandInteraction): Promise<void>;
    /**
     * Validate and execute command with full error handling pipeline
     * This method handles all common validation before calling execute()
     * @param {CommandInteraction} interaction - Discord slash command interaction
     * @returns {Promise<void>}
     * @throws {Error} When validation or execution fails
     */
    run(interaction: CommandInteraction): Promise<void>;
    /**
     * Validate user permissions before command execution
     * Can be overridden by subclasses for custom permission logic
     * @protected
     * @param {CommandInteraction} interaction - Discord interaction
     * @returns {Promise<boolean>} Permission validation result
     * @example
     * async validatePermissions(interaction) {
     *   return interaction.member.permissions.has('MANAGE_MESSAGES');
     * }
     */
    protected validatePermissions(interaction: CommandInteraction): Promise<boolean>;
    /**
     * Check if user is on cooldown
     * @private
     * @param {string} userId - Discord user ID
     * @returns {boolean} Whether user is on cooldown
     */
    private _isOnCooldown;
    /**
     * Get remaining cooldown time in milliseconds
     * @private
     * @param {string} userId - Discord user ID
     * @returns {number} Remaining cooldown time
     */
    private _getRemainingCooldown;
    /**
     * Set cooldown for user
     * @private
     * @param {string} userId - Discord user ID
     */
    private _setCooldown;
    /**
     * Clean up expired cooldowns
     * @private
     */
    private _cleanupCooldowns;
    /**
     * Get user-friendly error message
     * @private
     * @param {Error} error - Error object
     * @returns {string} User-friendly error message
     */
    private _getErrorMessage;
    /**
     * Set command category
     * @protected
     * @param {string} category - Command category
     */
    set category(category: string);
    /**
     * Get command category
     * @returns {string} Command category
     */
    get category(): string;
    /**
     * Set required permissions
     * @protected
     * @param {Array<string>} permissions - Required Discord permissions
     */
    set requiredPermissions(permissions: string[]);
    /**
     * Get required permissions
     * @returns {Array<string>} Required Discord permissions
     */
    get requiredPermissions(): string[];
    /**
     * Set required roles
     * @protected
     * @param {Array<string>} roles - Required role IDs or names
     */
    set requiredRoles(roles: string[]);
    /**
     * Get required roles
     * @returns {Array<string>} Required role IDs or names
     */
    get requiredRoles(): string[];
    /**
     * Set guild-only setting
     * @protected
     * @param {boolean} guildOnly - Whether command is guild-only
     */
    set guildOnly(guildOnly: boolean);
    /**
     * Get guild-only setting
     * @returns {boolean} Whether command is guild-only
     */
    get guildOnly(): boolean;
    /**
     * Set command cooldown
     * @protected
     * @param {number} cooldown - Cooldown duration in milliseconds
     */
    set cooldown(cooldown: number);
    /**
     * Get command cooldown in milliseconds
     * @returns {number} Cooldown duration
     */
    get cooldown(): number;
}
import { SlashCommandBuilder } from "@discordjs/builders";
//# sourceMappingURL=BaseCommand.d.ts.map