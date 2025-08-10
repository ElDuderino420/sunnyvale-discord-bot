export = BanCommand;
/**
 * Ban command for permanently banning users from the server
 * Implements proper permission checking, role hierarchy validation, and audit logging
 * @class BanCommand
 * @extends BaseCommand
 */
declare class BanCommand extends BaseCommand {
    /**
     * Initialize ban command with moderation service dependency
     * @param {ModerationService} moderationService - Service for moderation operations
     */
    constructor(moderationService: ModerationService);
    moderationService: ModerationService;
}
import BaseCommand = require("../BaseCommand");
//# sourceMappingURL=BanCommand.d.ts.map