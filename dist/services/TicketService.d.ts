export = TicketService;
/**
 * Service for managing ticket system operations
 * Handles ticket creation, management, staff assignment, and transcripts
 * @class TicketService
 * @example
 * const ticketService = new TicketService(ticketRepo, configRepo, permissionService);
 * const ticket = await ticketService.createTicket(interaction, 'Bug Report', 'technical');
 */
declare class TicketService {
    /**
     * Initialize ticket service
     * @param {TicketRepository} ticketRepository - Ticket data repository
     * @param {ConfigRepository} configRepository - Server configuration repository
     * @param {PermissionService} permissionService - Permission validation service
     */
    constructor(ticketRepository: TicketRepository, configRepository: ConfigRepository, permissionService: PermissionService);
    /**
     * Ticket repository for data persistence
     * @type {TicketRepository}
     * @private
     */
    private _ticketRepo;
    /**
     * Configuration repository for server settings
     * @type {ConfigRepository}
     * @private
     */
    private _configRepo;
    /**
     * Permission service for validation
     * @type {PermissionService}
     * @private
     */
    private _permissionService;
    /**
     * Cache for active ticket channels
     * @type {Map<string, Object>}
     * @private
     */
    private _channelCache;
    /**
     * Rate limiting for ticket creation
     * @type {Map<string, number>}
     * @private
     */
    private _creationLimits;
    /**
     * Transcript generation queue
     * @type {Set<string>}
     * @private
     */
    private _transcriptQueue;
    /**
     * Create new support ticket with dedicated channel
     * @param {CommandInteraction} interaction - Discord command interaction
     * @param {string} subject - Ticket subject/title
     * @param {string} [category='general'] - Ticket category
     * @param {string} [description] - Initial ticket description
     * @returns {Promise<Object>} Created ticket details with channel information
     * @throws {Error} When ticket creation fails
     * @example
     * const result = await ticketService.createTicket(
     *   interaction,
     *   'Account Issue',
     *   'account',
     *   'I cannot access my account'
     * );
     * if (result.success) {
     *   console.log(`Ticket created: ${result.ticket.id} in channel ${result.channel.name}`);
     * }
     */
    createTicket(interaction: CommandInteraction, subject: string, category?: string, description?: string): Promise<any>;
    /**
     * Close ticket and optionally archive channel
     * @param {CommandInteraction} interaction - Discord command interaction
     * @param {string} ticketId - Ticket ID to close
     * @param {string} [reason='Ticket resolved'] - Closure reason
     * @param {boolean} [archiveChannel=true] - Whether to archive the channel
     * @returns {Promise<Object>} Closure result with transcript information
     * @throws {Error} When ticket closure fails
     * @example
     * const result = await ticketService.closeTicket(interaction, '0042', 'Issue resolved', true);
     * if (result.success) {
     *   console.log(`Ticket closed with transcript: ${result.transcriptId}`);
     * }
     */
    closeTicket(interaction: CommandInteraction, ticketId: string, reason?: string, archiveChannel?: boolean): Promise<any>;
    /**
     * Assign staff member to ticket for support
     * @param {CommandInteraction} interaction - Discord command interaction
     * @param {string} ticketId - Ticket ID
     * @param {string} staffId - Staff member Discord ID to assign
     * @returns {Promise<Object>} Assignment result with updated ticket information
     * @throws {Error} When staff assignment fails
     * @example
     * const result = await ticketService.assignStaff(interaction, '0042', '987654321');
     * if (result.success) {
     *   console.log(`Staff assigned to ticket ${result.ticket.id}`);
     * }
     */
    assignStaff(interaction: CommandInteraction, ticketId: string, staffId: string): Promise<any>;
    /**
     * Generate transcript of ticket conversation
     * @param {string} ticketId - Ticket ID
     * @param {string} [format='json'] - Output format (json, text, html)
     * @returns {Promise<Object>} Transcript data with messages and metadata
     * @throws {Error} When transcript generation fails
     * @example
     * const transcript = await ticketService.generateTranscript('0042', 'html');
     * if (transcript.success) {
     *   console.log(`Generated ${transcript.format} transcript with ${transcript.messageCount} messages`);
     * }
     */
    generateTranscript(ticketId: string, format?: string): Promise<any>;
    /**
     * Search tickets by content or metadata
     * @param {string} guildId - Discord guild ID
     * @param {string} query - Search query
     * @param {Object} [filters={}] - Additional search filters
     * @param {number} [limit=20] - Maximum results to return
     * @returns {Promise<Array>} Search results with relevance scores
     * @throws {Error} When search fails
     * @example
     * const results = await ticketService.searchTickets('123456789', 'password reset', {
     *   status: 'closed',
     *   category: 'account'
     * });
     */
    searchTickets(guildId: string, query: string, filters?: any, limit?: number): Promise<any[]>;
    /**
     * Get ticket statistics for server
     * @param {string} guildId - Discord guild ID
     * @param {number} [days=30] - Days to include in statistics
     * @returns {Promise<Object>} Ticket statistics summary
     * @throws {Error} When statistics calculation fails
     * @example
     * const stats = await ticketService.getTicketStatistics('123456789', 7);
     * console.log(`${stats.openTickets} tickets currently open`);
     */
    getTicketStatistics(guildId: string, days?: number): Promise<any>;
    /**
     * Get tickets that need staff attention
     * @param {string} guildId - Discord guild ID
     * @param {number} [hours=24] - Hours of inactivity threshold
     * @returns {Promise<Array>} Tickets requiring attention
     * @throws {Error} When query fails
     * @example
     * const staleTickets = await ticketService.getTicketsNeedingAttention('123456789', 48);
     * for (const {ticket, hoursSinceActivity} of staleTickets) {
     *   console.log(`Ticket ${ticket.id} needs attention (${hoursSinceActivity}h inactive)`);
     * }
     */
    getTicketsNeedingAttention(guildId: string, hours?: number): Promise<any[]>;
    /**
     * Clear rate limiting for user (admin function)
     * @param {string} userId - Discord user ID
     * @returns {boolean} Whether limit was cleared
     * @example
     * const cleared = ticketService.clearUserRateLimit('123456789');
     * if (cleared) {
     *   console.log('Rate limit cleared for user');
     * }
     */
    clearUserRateLimit(userId: string): boolean;
    /**
     * Get cached channel information
     * @param {string} channelId - Discord channel ID
     * @returns {Object|null} Cached channel data or null if not found
     * @example
     * const channelInfo = ticketService.getCachedChannelInfo('987654321');
     * if (channelInfo) {
     *   console.log(`Channel is for ticket ${channelInfo.ticketId}`);
     * }
     */
    getCachedChannelInfo(channelId: string): any | null;
    /**
     * Format transcript as plain text
     * @private
     * @param {Object} transcriptData - Transcript metadata
     * @param {Array} messages - Ticket messages
     * @returns {string} Formatted text transcript
     */
    private _formatTranscriptAsText;
    /**
     * Format transcript as HTML
     * @private
     * @param {Object} transcriptData - Transcript metadata
     * @param {Array} messages - Ticket messages
     * @returns {string} Formatted HTML transcript
     */
    private _formatTranscriptAsHTML;
}
//# sourceMappingURL=TicketService.d.ts.map