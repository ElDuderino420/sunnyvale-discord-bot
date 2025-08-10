export = CreateTicketCommand;
/**
 * Create ticket command for users to create support tickets
 * Implements dynamic channel creation with proper permissions
 * @class CreateTicketCommand
 * @extends BaseCommand
 */
declare class CreateTicketCommand extends BaseCommand {
    /**
     * Initialize create ticket command with ticket service dependency
     * @param {TicketService} ticketService - Service for ticket operations
     */
    constructor(ticketService: TicketService);
    ticketService: TicketService;
}
import BaseCommand = require("../BaseCommand");
//# sourceMappingURL=CreateTicketCommand.d.ts.map