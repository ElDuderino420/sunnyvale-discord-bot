export = KickCommand;
/**
 * Kick command for removing users from the server
 * Implements proper permission checking and moderation logging
 * @class KickCommand
 * @extends BaseCommand
 */
declare class KickCommand extends BaseCommand {
    /**
     * Initialize kick command with moderation service dependency
     * @param {ModerationService} moderationService - Service for moderation operations
     */
    constructor(moderationService: ModerationService);
    moderationService: ModerationService;
}
import BaseCommand = require("../BaseCommand");
//# sourceMappingURL=KickCommand.d.ts.map