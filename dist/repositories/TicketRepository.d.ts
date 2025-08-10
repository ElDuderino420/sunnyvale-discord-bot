export = TicketRepository;
/**
 * Repository for Ticket entity data persistence
 * Handles ticket-specific database operations with Ticket entity integration
 * @class TicketRepository
 * @extends {BaseRepository}
 * @example
 * const ticketRepo = new TicketRepository(dbManager);
 * const ticket = await ticketRepo.findTicketById('0001');
 * await ticketRepo.saveTicket(ticket);
 */
declare class TicketRepository extends BaseRepository {
    /**
     * Initialize ticket repository
     * @param {DatabaseManager} dbManager - Database connection manager
     */
    constructor(dbManager: DatabaseManager);
    /**
     * Find ticket by ID and return Ticket entity
     * @param {string} ticketId - Unique ticket identifier
     * @returns {Promise<Ticket|null>} Ticket entity or null if not found
     * @throws {Error} When database operation fails
     * @example
     * const ticket = await ticketRepo.findTicketById('0001');
     * if (ticket) {
     *   console.log(`Found ticket: ${ticket.getSubject()}`);
     * }
     */
    findTicketById(ticketId: string): Promise<Ticket | null>;
    /**
     * Create or update ticket record
     * @param {Ticket} ticket - Ticket entity to save
     * @returns {Promise<Ticket>} Saved ticket entity
     * @throws {Error} When save operation fails
     * @example
     * const ticket = new Ticket('0001', '123456789', '987654321');
     * const savedTicket = await ticketRepo.saveTicket(ticket);
     */
    saveTicket(ticket: Ticket): Promise<Ticket>;
    /**
     * Find ticket by Discord channel ID
     * @param {string} channelId - Discord channel ID
     * @returns {Promise<Ticket|null>} Ticket entity or null if not found
     * @throws {Error} When database operation fails
     * @example
     * const ticket = await ticketRepo.findTicketByChannelId('987654321');
     * if (ticket) {
     *   console.log(`Channel belongs to ticket ${ticket.id}`);
     * }
     */
    findTicketByChannelId(channelId: string): Promise<Ticket | null>;
    /**
     * Find tickets by creator user ID
     * @param {string} creatorId - Discord user ID of ticket creator
     * @param {string} [status] - Filter by ticket status
     * @param {number} [limit] - Maximum number of tickets to return
     * @returns {Promise<Array<Ticket>>} Array of ticket entities
     * @throws {Error} When database operation fails
     * @example
     * const userTickets = await ticketRepo.findTicketsByCreator('123456789', 'open');
     * console.log(`User has ${userTickets.length} open tickets`);
     */
    findTicketsByCreator(creatorId: string, status?: string, limit?: number): Promise<Array<Ticket>>;
    /**
     * Find tickets by status
     * @param {string} status - Ticket status (open, closed, archived)
     * @param {number} [limit] - Maximum number of tickets to return
     * @returns {Promise<Array<Ticket>>} Array of ticket entities
     * @throws {Error} When database operation fails
     * @example
     * const openTickets = await ticketRepo.findTicketsByStatus('open');
     * console.log(`${openTickets.length} tickets are currently open`);
     */
    findTicketsByStatus(status: string, limit?: number): Promise<Array<Ticket>>;
    /**
     * Find tickets assigned to specific staff member
     * @param {string} staffId - Discord user ID of staff member
     * @param {string} [status] - Filter by ticket status
     * @returns {Promise<Array<Ticket>>} Array of assigned tickets
     * @throws {Error} When database operation fails
     * @example
     * const assignedTickets = await ticketRepo.findTicketsByStaff('987654321', 'open');
     * console.log(`Staff member has ${assignedTickets.length} open assignments`);
     */
    findTicketsByStaff(staffId: string, status?: string): Promise<Array<Ticket>>;
    /**
     * Find tickets by category
     * @param {string} category - Ticket category
     * @param {string} [status] - Filter by ticket status
     * @param {number} [limit] - Maximum number of tickets to return
     * @returns {Promise<Array<Ticket>>} Array of tickets in category
     * @throws {Error} When database operation fails
     * @example
     * const techSupportTickets = await ticketRepo.findTicketsByCategory('technical-support', 'open');
     */
    findTicketsByCategory(category: string, status?: string, limit?: number): Promise<Array<Ticket>>;
    /**
     * Generate next ticket ID in sequence
     * @returns {Promise<string>} Next ticket ID (padded to 4 digits)
     * @throws {Error} When ID generation fails
     * @example
     * const nextId = await ticketRepo.generateNextTicketId();
     * console.log(`Next ticket ID: ${nextId}`); // e.g., "0042"
     */
    generateNextTicketId(): Promise<string>;
    /**
     * Get ticket statistics summary
     * @param {number} [days=30] - Days to include in statistics
     * @returns {Promise<Object>} Ticket statistics
     * @throws {Error} When statistics calculation fails
     * @example
     * const stats = await ticketRepo.getTicketStatistics(7);
     * console.log(`${stats.openTickets} tickets opened in the last week`);
     */
    getTicketStatistics(days?: number): Promise<any>;
    /**
     * Find tickets that need attention (old open tickets)
     * @param {number} [hours=24] - Hours since last activity
     * @returns {Promise<Array<{ticket: Ticket, hoursSinceActivity: number}>>} Tickets needing attention
     * @throws {Error} When query fails
     * @example
     * const staleTickets = await ticketRepo.findTicketsNeedingAttention(48);
     * for (const {ticket, hoursSinceActivity} of staleTickets) {
     *   console.log(`Ticket ${ticket.id} inactive for ${hoursSinceActivity} hours`);
     * }
     */
    findTicketsNeedingAttention(hours?: number): Promise<Array<{
        ticket: Ticket;
        hoursSinceActivity: number;
    }>>;
    /**
     * Archive old closed tickets
     * @param {number} days - Days since closure before archiving
     * @param {boolean} [dryRun=true] - Whether to actually archive or just return count
     * @returns {Promise<number>} Number of tickets archived
     * @throws {Error} When archiving fails
     * @example
     * const archivedCount = await ticketRepo.archiveOldTickets(30, false);
     * console.log(`Archived ${archivedCount} old tickets`);
     */
    archiveOldTickets(days: number, dryRun?: boolean): Promise<number>;
    /**
     * Backup ticket data to JSON format
     * @param {Array<string>} [ticketIds] - Specific ticket IDs to backup (all if not specified)
     * @param {boolean} [includeMessages=true] - Whether to include message content
     * @returns {Promise<Object>} Backup data object
     * @throws {Error} When backup fails
     * @example
     * const backup = await ticketRepo.backupTicketData(['0001', '0002'], true);
     * await fs.writeFile('ticket-backup.json', JSON.stringify(backup, null, 2));
     */
    backupTicketData(ticketIds?: Array<string>, includeMessages?: boolean): Promise<any>;
    /**
     * Restore ticket data from backup
     * @param {Object} backupData - Backup data object
     * @param {boolean} [overwrite=false] - Whether to overwrite existing tickets
     * @returns {Promise<{imported: number, skipped: number, errors: Array}>} Import results
     * @throws {Error} When restore fails
     * @example
     * const backup = JSON.parse(await fs.readFile('ticket-backup.json'));
     * const result = await ticketRepo.restoreTicketData(backup, true);
     * console.log(`Imported ${result.imported} tickets, skipped ${result.skipped}`);
     */
    restoreTicketData(backupData: any, overwrite?: boolean): Promise<{
        imported: number;
        skipped: number;
        errors: any[];
    }>;
    /**
     * Search tickets by content
     * @param {string} searchTerm - Term to search for in subjects and messages
     * @param {Object} [filters={}] - Additional filters (status, category, creator)
     * @param {number} [limit=50] - Maximum results to return
     * @returns {Promise<Array<{ticket: Ticket, relevance: number}>>} Search results with relevance
     * @throws {Error} When search fails
     * @example
     * const results = await ticketRepo.searchTickets('password reset', { status: 'open' });
     * for (const {ticket, relevance} of results) {
     *   console.log(`${ticket.id}: ${ticket.getSubject()} (${relevance}% match)`);
     * }
     */
    searchTickets(searchTerm: string, filters?: any, limit?: number): Promise<Array<{
        ticket: Ticket;
        relevance: number;
    }>>;
}
import BaseRepository = require("./BaseRepository");
import Ticket = require("../entities/Ticket");
//# sourceMappingURL=TicketRepository.d.ts.map