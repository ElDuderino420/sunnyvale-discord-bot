export = JailCommand;
/**
 * Jail command for confining users to a specific channel
 * Implements complex role management with backup and restore functionality
 * @class JailCommand
 * @extends BaseCommand
 */
declare class JailCommand extends BaseCommand {
    /**
     * Initialize jail command with moderation service dependency
     * @param {ModerationService} moderationService - Service for moderation operations
     * @param {ConfigRepository} configRepository - Repository for server configuration
     */
    constructor(moderationService: ModerationService, configRepository: ConfigRepository);
    moderationService: ModerationService;
    configRepository: ConfigRepository;
    /**
     * Parse duration string into milliseconds
     * @private
     * @param {string} durationStr - Duration string (e.g., "1h", "30m", "2d")
     * @returns {number|null} Duration in milliseconds or null if invalid
     */
    private _parseDuration;
}
import BaseCommand = require("../BaseCommand");
//# sourceMappingURL=JailCommand.d.ts.map