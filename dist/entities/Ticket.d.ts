export = Ticket;
/**
 * Ticket entity representing support ticket with lifecycle management
 * Encapsulates ticket data, status tracking, and transcript generation
 * @class Ticket
 * @example
 * const ticket = new Ticket('0001', '123456789', '987654321');
 * ticket.addMessage('user', 'I need help with moderation');
 * const transcript = ticket.generateTranscript();
 */
declare class Ticket {
    /**
     * Create Ticket instance from database data
     * @static
     * @param {Object} data - Database document
     * @returns {Ticket} Ticket instance
     * @throws {Error} When data is invalid
     * @example
     * const ticketData = await ticketRepository.findById('0001');
     * const ticket = Ticket.fromDatabase(ticketData);
     */
    static fromDatabase(data: any): Ticket;
    /**
     * Create ticket instance
     * @param {string} id - Unique ticket identifier
     * @param {string} creatorId - Discord user ID who created ticket
     * @param {string} channelId - Discord channel ID for ticket
     * @param {Object} [data={}] - Additional ticket data
     * @param {string} [data.status='open'] - Ticket status (open, closed, archived)
     * @param {string} [data.subject] - Ticket subject/title
     * @param {string} [data.category] - Ticket category
     * @param {Array<string>} [data.assignedStaff=[]] - Assigned staff member IDs
     * @param {Array<Object>} [data.messages=[]] - Ticket conversation messages
     * @param {Object} [data.metadata={}] - Additional metadata
     * @param {Date} [data.createdAt] - When ticket was created
     * @param {Date} [data.closedAt] - When ticket was closed
     * @param {Date} [data.updatedAt] - When ticket was last updated
     */
    constructor(id: string, creatorId: string, channelId: string, data?: {
        status?: string;
        subject?: string;
        category?: string;
        assignedStaff?: Array<string>;
        messages?: Array<any>;
        metadata?: any;
        createdAt?: Date;
        closedAt?: Date;
        updatedAt?: Date;
    });
    /**
     * Unique ticket identifier
     * @type {string}
     * @readonly
     */
    readonly id: string;
    /**
     * Discord user ID who created the ticket
     * @type {string}
     * @readonly
     */
    readonly creatorId: string;
    /**
     * Discord channel ID for this ticket
     * @type {string}
     */
    channelId: string;
    /**
     * Current ticket status
     * @type {string}
     * @private
     */
    private _status;
    /**
     * Ticket subject or title
     * @type {string}
     * @private
     */
    private _subject;
    /**
     * Ticket category for organization
     * @type {string}
     * @private
     */
    private _category;
    /**
     * IDs of staff members assigned to this ticket
     * @type {Array<string>}
     * @private
     */
    private _assignedStaff;
    /**
     * Conversation messages in this ticket
     * @type {Array<TicketMessage>}
     * @private
     */
    private _messages;
    /**
     * Additional ticket metadata
     * @type {Object}
     * @private
     */
    private _metadata;
    /**
     * When ticket was created
     * @type {Date}
     * @readonly
     */
    readonly createdAt: Date;
    /**
     * When ticket was closed (null if open)
     * @type {Date|null}
     * @private
     */
    private _closedAt;
    /**
     * When ticket was last updated
     * @type {Date}
     */
    updatedAt: Date;
    /**
     * Add message to ticket conversation
     * @param {string} authorId - Discord user ID of message author
     * @param {string} content - Message content
     * @param {string} [authorType='user'] - Type of author (user, staff, system)
     * @param {Object} [attachments=[]] - Message attachments
     * @param {Date} [timestamp=new Date()] - When message was sent
     * @returns {TicketMessage} Created message object
     * @throws {Error} When required parameters are missing
     * @example
     * const message = ticket.addMessage('123456789', 'Hello, I need help');
     * console.log(`Message ${message.id} added to ticket`);
     */
    addMessage(authorId: string, content: string, authorType?: string, attachments?: any, timestamp?: Date): TicketMessage;
    /**
     * Edit existing message in ticket
     * @param {string} messageId - Message ID to edit
     * @param {string} newContent - New message content
     * @returns {boolean} Whether message was found and edited
     * @throws {Error} When new content is invalid
     * @example
     * const edited = ticket.editMessage('msg123', 'Updated message content');
     * if (edited) {
     *   console.log('Message updated successfully');
     * }
     */
    editMessage(messageId: string, newContent: string): boolean;
    /**
     * Set ticket subject
     * @param {string} subject - Ticket subject or title
     * @throws {Error} When subject is invalid
     * @example
     * ticket.setSubject('Need help with bot configuration');
     */
    setSubject(subject: string): void;
    /**
     * Get ticket subject
     * @returns {string|null} Ticket subject or null if not set
     * @example
     * const subject = ticket.getSubject();
     * if (subject) {
     *   console.log('Ticket subject:', subject);
     * }
     */
    getSubject(): string | null;
    /**
     * Set ticket category
     * @param {string} category - Ticket category
     * @throws {Error} When category is invalid
     * @example
     * ticket.setCategory('technical-support');
     */
    setCategory(category: string): void;
    /**
     * Get ticket category
     * @returns {string|null} Ticket category or null if not set
     * @example
     * const category = ticket.getCategory();
     */
    getCategory(): string | null;
    /**
     * Assign staff member to ticket
     * @param {string} staffId - Discord user ID of staff member
     * @throws {Error} When staff ID is invalid
     * @example
     * ticket.assignStaff('987654321');
     */
    assignStaff(staffId: string): void;
    /**
     * Unassign staff member from ticket
     * @param {string} staffId - Discord user ID of staff member
     * @returns {boolean} Whether staff was found and removed
     * @example
     * const removed = ticket.unassignStaff('987654321');
     */
    unassignStaff(staffId: string): boolean;
    /**
     * Get list of assigned staff
     * @returns {Array<string>} Array of staff member IDs
     * @example
     * const staff = ticket.getAssignedStaff();
     * console.log(`${staff.length} staff members assigned`);
     */
    getAssignedStaff(): Array<string>;
    /**
     * Check if staff member is assigned to ticket
     * @param {string} staffId - Discord user ID to check
     * @returns {boolean} Whether staff member is assigned
     * @example
     * if (ticket.isStaffAssigned('987654321')) {
     *   console.log('Staff member is assigned to this ticket');
     * }
     */
    isStaffAssigned(staffId: string): boolean;
    /**
     * Close ticket with reason
     * @param {string} closedById - Discord user ID who closed ticket
     * @param {string} [reason] - Reason for closing ticket
     * @throws {Error} When ticket is already closed
     * @example
     * ticket.close('987654321', 'Issue resolved');
     */
    close(closedById: string, reason?: string): void;
    /**
     * Reopen closed ticket
     * @param {string} reopenedById - Discord user ID who reopened ticket
     * @param {string} [reason] - Reason for reopening ticket
     * @throws {Error} When ticket is not closed
     * @example
     * ticket.reopen('987654321', 'Additional help needed');
     */
    reopen(reopenedById: string, reason?: string): void;
    /**
     * Archive ticket (final state)
     * @param {string} archivedById - Discord user ID who archived ticket
     * @throws {Error} When ticket is not closed
     * @example
     * ticket.archive('987654321');
     */
    archive(archivedById: string): void;
    /**
     * Get current ticket status
     * @returns {string} Current status (open, closed, archived)
     * @example
     * const status = ticket.getStatus();
     * console.log(`Ticket is ${status}`);
     */
    getStatus(): string;
    /**
     * Check if ticket is open
     * @returns {boolean} Whether ticket is open
     * @example
     * if (ticket.isOpen()) {
     *   console.log('Ticket is available for responses');
     * }
     */
    isOpen(): boolean;
    /**
     * Check if ticket is closed
     * @returns {boolean} Whether ticket is closed
     * @example
     * if (ticket.isClosed()) {
     *   console.log('Ticket has been resolved');
     * }
     */
    isClosed(): boolean;
    /**
     * Get when ticket was closed
     * @returns {Date|null} Close date or null if not closed
     * @example
     * const closedAt = ticket.getClosedAt();
     * if (closedAt) {
     *   console.log('Ticket closed at:', closedAt.toISOString());
     * }
     */
    getClosedAt(): Date | null;
    /**
     * Get all messages in ticket
     * @param {string} [authorType] - Filter by author type
     * @param {number} [limit] - Limit number of messages
     * @returns {Array<TicketMessage>} Array of messages (chronological order)
     * @example
     * const allMessages = ticket.getMessages();
     * const userMessages = ticket.getMessages('user');
     * const recent = ticket.getMessages(null, 10);
     */
    getMessages(authorType?: string, limit?: number): Array<TicketMessage>;
    /**
     * Get message count by type
     * @returns {Object} Message count statistics
     * @example
     * const stats = ticket.getMessageStats();
     * console.log(`${stats.user} user messages, ${stats.staff} staff responses`);
     */
    getMessageStats(): any;
    /**
     * Generate ticket transcript
     * @param {boolean} [includeSystem=false] - Whether to include system messages
     * @returns {string} Formatted transcript
     * @example
     * const transcript = ticket.generateTranscript();
     * await fs.writeFile(`ticket-${ticket.id}.txt`, transcript);
     */
    generateTranscript(includeSystem?: boolean): string;
    /**
     * Set metadata value
     * @param {string} key - Metadata key
     * @param {*} value - Metadata value
     * @example
     * ticket.setMetadata('priority', 'high');
     * ticket.setMetadata('tags', ['billing', 'urgent']);
     */
    setMetadata(key: string, value: any): void;
    /**
     * Get metadata value
     * @param {string} key - Metadata key
     * @param {*} [defaultValue] - Default value if key not found
     * @returns {*} Metadata value
     * @example
     * const priority = ticket.getMetadata('priority', 'normal');
     */
    getMetadata(key: string, defaultValue?: any): any;
    /**
     * Get all metadata
     * @returns {Object} Complete metadata object
     * @example
     * const metadata = ticket.getAllMetadata();
     */
    getAllMetadata(): any;
    /**
     * Calculate ticket duration
     * @private
     * @returns {string} Human-readable duration
     */
    private _calculateDuration;
    /**
     * Generate unique message ID
     * @private
     * @returns {string} Unique message ID
     */
    private _generateMessageId;
    /**
     * Export ticket data for database storage
     * @returns {Object} Ticket data suitable for database storage
     * @example
     * const ticketData = ticket.toDatabase();
     * await ticketRepository.create(ticketData);
     */
    toDatabase(): any;
    /**
     * Get ticket summary information
     * @returns {Object} Ticket summary
     * @example
     * const summary = ticket.getSummary();
     * console.log(`Ticket ${summary.id}: ${summary.status} (${summary.messageCount} messages)`);
     */
    getSummary(): any;
}
declare namespace Ticket {
    export { TicketMessage };
}
type TicketMessage = {
    /**
     * - Unique message identifier
     */
    id: string;
    /**
     * - Discord user ID of message author
     */
    authorId: string;
    /**
     * - Type of author (user, staff, system)
     */
    authorType: string;
    /**
     * - Message content
     */
    content: string;
    /**
     * - Message attachments
     */
    attachments: Array<string>;
    /**
     * - When message was sent
     */
    timestamp: Date;
    /**
     * - Whether message was edited
     */
    edited: boolean;
    /**
     * - When message was edited (if applicable)
     */
    editedAt: Date | null;
};
//# sourceMappingURL=Ticket.d.ts.map