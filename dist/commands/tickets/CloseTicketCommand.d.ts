export = CloseTicketCommand;
/**
 * Close ticket command for closing and archiving support tickets
 * Implements transcript generation and proper cleanup
 * @class CloseTicketCommand
 * @extends BaseCommand
 */
declare class CloseTicketCommand extends BaseCommand {
    /**
     * Initialize close ticket command with ticket service dependency
     * @param {TicketService} ticketService - Service for ticket operations
     * @param {ConfigRepository} configRepository - Repository for server configuration
     */
    constructor(ticketService: TicketService, configRepository: ConfigRepository);
    ticketService: TicketService;
    configRepository: ConfigRepository;
}
import BaseCommand = require("../BaseCommand");
//# sourceMappingURL=CloseTicketCommand.d.ts.map