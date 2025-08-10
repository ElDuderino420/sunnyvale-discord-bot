export = SetupCommand;
/**
 * Setup command for configuring bot settings per server
 * Allows administrators to configure moderator roles and other settings
 * @class SetupCommand
 * @extends BaseCommand
 */
declare class SetupCommand extends BaseCommand {
    /**
     * Initialize setup command with permission service dependency
     * @param {PermissionService} permissionService - Service for permission operations
     * @param {ConfigRepository} configRepository - Repository for server configuration
     */
    constructor(permissionService: PermissionService, configRepository: ConfigRepository);
    permissionService: PermissionService;
    configRepository: ConfigRepository;
    _requiredPermissions: any[];
    /**
     * Handle moderator role setup
     * @private
     * @param {CommandInteraction} interaction - Discord interaction
     */
    private _handleModeratorRole;
    /**
     * Handle jail channel setup
     * @private
     * @param {CommandInteraction} interaction - Discord interaction
     */
    private _handleJailChannel;
    /**
     * Handle jail role setup
     * @private
     * @param {CommandInteraction} interaction - Discord interaction
     */
    private _handleJailRole;
    /**
     * Configure jail permissions automatically
     * @private
     * @param {Guild} guild - Discord guild
     * @param {Channel} jailChannel - Jail channel
     * @param {Role} jailRole - Jail role
     */
    private _configureJailPermissions;
    /**
     * Handle status display
     * @private
     * @param {CommandInteraction} interaction - Discord interaction
     */
    private _handleStatus;
}
import BaseCommand = require("../BaseCommand");
//# sourceMappingURL=SetupCommand.d.ts.map