export = AutorolesCommand;
/**
 * Autoroles command for setting up reaction-based role assignment
 * Implements emoji-to-role mapping with persistent storage
 * @class AutorolesCommand
 * @extends BaseCommand
 */
declare class AutorolesCommand extends BaseCommand {
    /**
     * Initialize autoroles command with role service dependency
     * @param {RoleService} roleService - Service for role operations
     */
    constructor(roleService: RoleService);
    roleService: RoleService;
    /**
     * Handle create subcommand - create new autorole message
     * @private
     * @param {CommandInteraction} interaction - Discord interaction
     */
    private _handleCreate;
    /**
     * Handle add-role subcommand - add role to existing autorole message
     * @private
     * @param {CommandInteraction} interaction - Discord interaction
     */
    private _handleAddRole;
    /**
     * Handle remove-role subcommand
     * @private
     * @param {CommandInteraction} interaction - Discord interaction
     */
    private _handleRemoveRole;
    /**
     * Handle list subcommand - show all autorole messages
     * @private
     * @param {CommandInteraction} interaction - Discord interaction
     */
    private _handleList;
}
import BaseCommand = require("../BaseCommand");
//# sourceMappingURL=AutorolesCommand.d.ts.map