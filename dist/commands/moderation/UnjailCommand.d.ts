export = UnjailCommand;
/**
 * Unjail command for releasing users from jail and restoring their roles
 * Implements role restoration with comprehensive error handling
 * @class UnjailCommand
 * @extends BaseCommand
 */
declare class UnjailCommand extends BaseCommand {
    /**
     * Initialize unjail command with moderation service dependency
     * @param {ModerationService} moderationService - Service for moderation operations
     * @param {ConfigRepository} configRepository - Repository for server configuration
     */
    constructor(moderationService: ModerationService, configRepository: ConfigRepository);
    moderationService: ModerationService;
    configRepository: ConfigRepository;
}
import BaseCommand = require("../BaseCommand");
//# sourceMappingURL=UnjailCommand.d.ts.map