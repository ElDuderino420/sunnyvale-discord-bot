export = TempbanCommand;
/**
 * Temporary ban command for time-limited bans with automatic unban
 * Implements scheduled task management and comprehensive validation
 * @class TempbanCommand
 * @extends BaseCommand
 */
declare class TempbanCommand extends BaseCommand {
    /**
     * Initialize tempban command with moderation service dependency
     * @param {ModerationService} moderationService - Service for moderation operations
     */
    constructor(moderationService: ModerationService);
    moderationService: ModerationService;
    /**
     * Parse duration string into milliseconds
     * @private
     * @param {string} durationStr - Duration string (e.g., "1h", "30m", "2d")
     * @returns {number|null} Duration in milliseconds or null if invalid
     */
    private _parseDuration;
}
import BaseCommand = require("../BaseCommand");
//# sourceMappingURL=TempbanCommand.d.ts.map