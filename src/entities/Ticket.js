/**
 * Ticket entity representing support ticket with lifecycle management
 * Encapsulates ticket data, status tracking, and transcript generation
 * @class Ticket
 * @example
 * const ticket = new Ticket('0001', '123456789', '987654321');
 * ticket.addMessage('user', 'I need help with moderation');
 * const transcript = ticket.generateTranscript();
 */
class Ticket {
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
  constructor(id, creatorId, channelId, data = {}) {
    if (!id || typeof id !== 'string') {
      throw new Error('Ticket ID must be a non-empty string');
    }
    
    if (!creatorId || typeof creatorId !== 'string') {
      throw new Error('Creator ID must be a non-empty string');
    }
    
    if (!channelId || typeof channelId !== 'string') {
      throw new Error('Channel ID must be a non-empty string');
    }

    /**
     * Unique ticket identifier
     * @type {string}
     * @readonly
     */
    this.id = id;
    
    /**
     * Discord user ID who created the ticket
     * @type {string}
     * @readonly
     */
    this.creatorId = creatorId;
    
    /**
     * Discord channel ID for this ticket
     * @type {string}
     */
    this.channelId = channelId;
    
    /**
     * Current ticket status
     * @type {string}
     * @private
     */
    this._status = data.status || 'open';
    
    /**
     * Ticket subject or title
     * @type {string}
     * @private
     */
    this._subject = data.subject || null;
    
    /**
     * Ticket category for organization
     * @type {string}
     * @private
     */
    this._category = data.category || null;
    
    /**
     * IDs of staff members assigned to this ticket
     * @type {Array<string>}
     * @private
     */
    this._assignedStaff = data.assignedStaff || [];
    
    /**
     * Conversation messages in this ticket
     * @type {Array<TicketMessage>}
     * @private
     */
    this._messages = data.messages || [];
    
    /**
     * Additional ticket metadata
     * @type {Object}
     * @private
     */
    this._metadata = data.metadata || {};
    
    /**
     * When ticket was created
     * @type {Date}
     * @readonly
     */
    this.createdAt = data.createdAt || new Date();
    
    /**
     * When ticket was closed (null if open)
     * @type {Date|null}
     * @private
     */
    this._closedAt = data.closedAt || null;
    
    /**
     * When ticket was last updated
     * @type {Date}
     */
    this.updatedAt = data.updatedAt || new Date();
  }

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
  addMessage(authorId, content, authorType = 'user', attachments = [], timestamp = new Date()) {
    if (!authorId || typeof authorId !== 'string') {
      throw new Error('Author ID must be a non-empty string');
    }
    
    if (!content || typeof content !== 'string') {
      throw new Error('Message content must be a non-empty string');
    }

    const validAuthorTypes = ['user', 'staff', 'system'];
    if (!validAuthorTypes.includes(authorType)) {
      throw new Error(`Invalid author type: ${authorType}. Valid types: ${validAuthorTypes.join(', ')}`);
    }

    const message = {
      id: this._generateMessageId(),
      authorId: authorId,
      authorType: authorType,
      content: content.trim(),
      attachments: Array.isArray(attachments) ? attachments : [],
      timestamp: timestamp,
      edited: false,
      editedAt: null
    };

    this._messages.push(message);
    this.updatedAt = new Date();

    return message;
  }

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
  editMessage(messageId, newContent) {
    if (!newContent || typeof newContent !== 'string') {
      throw new Error('New content must be a non-empty string');
    }

    const message = this._messages.find(msg => msg.id === messageId);
    if (!message) {
      return false;
    }

    message.content = newContent.trim();
    message.edited = true;
    message.editedAt = new Date();
    this.updatedAt = new Date();

    return true;
  }

  /**
   * Set ticket subject
   * @param {string} subject - Ticket subject or title
   * @throws {Error} When subject is invalid
   * @example
   * ticket.setSubject('Need help with bot configuration');
   */
  setSubject(subject) {
    if (!subject || typeof subject !== 'string') {
      throw new Error('Subject must be a non-empty string');
    }

    this._subject = subject.trim();
    this.updatedAt = new Date();
  }

  /**
   * Get ticket subject
   * @returns {string|null} Ticket subject or null if not set
   * @example
   * const subject = ticket.getSubject();
   * if (subject) {
   *   console.log('Ticket subject:', subject);
   * }
   */
  getSubject() {
    return this._subject;
  }

  /**
   * Set ticket category
   * @param {string} category - Ticket category
   * @throws {Error} When category is invalid
   * @example
   * ticket.setCategory('technical-support');
   */
  setCategory(category) {
    if (!category || typeof category !== 'string') {
      throw new Error('Category must be a non-empty string');
    }

    this._category = category.trim().toLowerCase();
    this.updatedAt = new Date();
  }

  /**
   * Get ticket category
   * @returns {string|null} Ticket category or null if not set
   * @example
   * const category = ticket.getCategory();
   */
  getCategory() {
    return this._category;
  }

  /**
   * Assign staff member to ticket
   * @param {string} staffId - Discord user ID of staff member
   * @throws {Error} When staff ID is invalid
   * @example
   * ticket.assignStaff('987654321');
   */
  assignStaff(staffId) {
    if (!staffId || typeof staffId !== 'string') {
      throw new Error('Staff ID must be a non-empty string');
    }

    if (!this._assignedStaff.includes(staffId)) {
      this._assignedStaff.push(staffId);
      this.updatedAt = new Date();
      
      // Add system message about assignment
      this.addMessage('system', `Staff member <@${staffId}> assigned to ticket`, 'system');
    }
  }

  /**
   * Unassign staff member from ticket
   * @param {string} staffId - Discord user ID of staff member
   * @returns {boolean} Whether staff was found and removed
   * @example
   * const removed = ticket.unassignStaff('987654321');
   */
  unassignStaff(staffId) {
    const index = this._assignedStaff.indexOf(staffId);
    if (index === -1) {
      return false;
    }

    this._assignedStaff.splice(index, 1);
    this.updatedAt = new Date();
    
    // Add system message about unassignment
    this.addMessage('system', `Staff member <@${staffId}> unassigned from ticket`, 'system');
    
    return true;
  }

  /**
   * Get list of assigned staff
   * @returns {Array<string>} Array of staff member IDs
   * @example
   * const staff = ticket.getAssignedStaff();
   * console.log(`${staff.length} staff members assigned`);
   */
  getAssignedStaff() {
    return [...this._assignedStaff];
  }

  /**
   * Check if staff member is assigned to ticket
   * @param {string} staffId - Discord user ID to check
   * @returns {boolean} Whether staff member is assigned
   * @example
   * if (ticket.isStaffAssigned('987654321')) {
   *   console.log('Staff member is assigned to this ticket');
   * }
   */
  isStaffAssigned(staffId) {
    return this._assignedStaff.includes(staffId);
  }

  /**
   * Close ticket with reason
   * @param {string} closedById - Discord user ID who closed ticket
   * @param {string} [reason] - Reason for closing ticket
   * @throws {Error} When ticket is already closed
   * @example
   * ticket.close('987654321', 'Issue resolved');
   */
  close(closedById, reason = null) {
    if (this._status === 'closed') {
      throw new Error('Ticket is already closed');
    }

    this._status = 'closed';
    this._closedAt = new Date();
    this.updatedAt = new Date();

    // Add system message about closure
    const reasonText = reason ? ` Reason: ${reason}` : '';
    this.addMessage('system', `Ticket closed by <@${closedById}>.${reasonText}`, 'system');
  }

  /**
   * Reopen closed ticket
   * @param {string} reopenedById - Discord user ID who reopened ticket
   * @param {string} [reason] - Reason for reopening ticket
   * @throws {Error} When ticket is not closed
   * @example
   * ticket.reopen('987654321', 'Additional help needed');
   */
  reopen(reopenedById, reason = null) {
    if (this._status !== 'closed') {
      throw new Error('Only closed tickets can be reopened');
    }

    this._status = 'open';
    this._closedAt = null;
    this.updatedAt = new Date();

    // Add system message about reopening
    const reasonText = reason ? ` Reason: ${reason}` : '';
    this.addMessage('system', `Ticket reopened by <@${reopenedById}>.${reasonText}`, 'system');
  }

  /**
   * Archive ticket (final state)
   * @param {string} archivedById - Discord user ID who archived ticket
   * @throws {Error} When ticket is not closed
   * @example
   * ticket.archive('987654321');
   */
  archive(archivedById) {
    if (this._status !== 'closed') {
      throw new Error('Only closed tickets can be archived');
    }

    this._status = 'archived';
    this.updatedAt = new Date();

    // Add system message about archiving
    this.addMessage('system', `Ticket archived by <@${archivedById}>`, 'system');
  }

  /**
   * Get current ticket status
   * @returns {string} Current status (open, closed, archived)
   * @example
   * const status = ticket.getStatus();
   * console.log(`Ticket is ${status}`);
   */
  getStatus() {
    return this._status;
  }

  /**
   * Check if ticket is open
   * @returns {boolean} Whether ticket is open
   * @example
   * if (ticket.isOpen()) {
   *   console.log('Ticket is available for responses');
   * }
   */
  isOpen() {
    return this._status === 'open';
  }

  /**
   * Check if ticket is closed
   * @returns {boolean} Whether ticket is closed
   * @example
   * if (ticket.isClosed()) {
   *   console.log('Ticket has been resolved');
   * }
   */
  isClosed() {
    return this._status === 'closed';
  }

  /**
   * Get when ticket was closed
   * @returns {Date|null} Close date or null if not closed
   * @example
   * const closedAt = ticket.getClosedAt();
   * if (closedAt) {
   *   console.log('Ticket closed at:', closedAt.toISOString());
   * }
   */
  getClosedAt() {
    return this._closedAt;
  }

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
  getMessages(authorType = null, limit = null) {
    let messages = [...this._messages];

    // Filter by author type if specified
    if (authorType) {
      messages = messages.filter(msg => msg.authorType === authorType);
    }

    // Apply limit if specified
    if (limit && typeof limit === 'number' && limit > 0) {
      messages = messages.slice(-limit); // Get last N messages
    }

    return messages;
  }

  /**
   * Get message count by type
   * @returns {Object} Message count statistics
   * @example
   * const stats = ticket.getMessageStats();
   * console.log(`${stats.user} user messages, ${stats.staff} staff responses`);
   */
  getMessageStats() {
    const stats = {
      user: 0,
      staff: 0,
      system: 0,
      total: this._messages.length
    };

    for (const message of this._messages) {
      if (stats.hasOwnProperty(message.authorType)) {
        stats[message.authorType]++;
      }
    }

    return stats;
  }

  /**
   * Generate ticket transcript
   * @param {boolean} [includeSystem=false] - Whether to include system messages
   * @returns {string} Formatted transcript
   * @example
   * const transcript = ticket.generateTranscript();
   * await fs.writeFile(`ticket-${ticket.id}.txt`, transcript);
   */
  generateTranscript(includeSystem = false) {
    const header = [
      `TICKET TRANSCRIPT - ${this.id}`,
      `Creator: ${this.creatorId}`,
      `Created: ${this.createdAt.toISOString()}`,
      `Status: ${this._status}`,
      `Subject: ${this._subject || 'Not set'}`,
      `Category: ${this._category || 'Not set'}`,
      this._closedAt ? `Closed: ${this._closedAt.toISOString()}` : null,
      '=' + '='.repeat(50),
      ''
    ].filter(Boolean).join('\n');

    const messages = this._messages
      .filter(msg => includeSystem || msg.authorType !== 'system')
      .map(msg => {
        const timestamp = new Date(msg.timestamp).toISOString();
        const editedMark = msg.edited ? ' (edited)' : '';
        const typeIndicator = msg.authorType === 'staff' ? '[STAFF] ' : 
                            msg.authorType === 'system' ? '[SYSTEM] ' : '';
        
        let messageText = `[${timestamp}] ${typeIndicator}${msg.authorId}: ${msg.content}${editedMark}`;
        
        if (msg.attachments.length > 0) {
          messageText += `\n  Attachments: ${msg.attachments.join(', ')}`;
        }
        
        return messageText;
      })
      .join('\n');

    const footer = [
      '',
      '=' + '='.repeat(50),
      `Transcript generated: ${new Date().toISOString()}`,
      `Total messages: ${this._messages.length}`,
      `Duration: ${this._calculateDuration()}`
    ].join('\n');

    return [header, messages, footer].join('\n');
  }

  /**
   * Set metadata value
   * @param {string} key - Metadata key
   * @param {*} value - Metadata value
   * @example
   * ticket.setMetadata('priority', 'high');
   * ticket.setMetadata('tags', ['billing', 'urgent']);
   */
  setMetadata(key, value) {
    if (!key || typeof key !== 'string') {
      throw new Error('Metadata key must be a non-empty string');
    }

    this._metadata[key] = value;
    this.updatedAt = new Date();
  }

  /**
   * Get metadata value
   * @param {string} key - Metadata key
   * @param {*} [defaultValue] - Default value if key not found
   * @returns {*} Metadata value
   * @example
   * const priority = ticket.getMetadata('priority', 'normal');
   */
  getMetadata(key, defaultValue = null) {
    return this._metadata.hasOwnProperty(key) ? this._metadata[key] : defaultValue;
  }

  /**
   * Get all metadata
   * @returns {Object} Complete metadata object
   * @example
   * const metadata = ticket.getAllMetadata();
   */
  getAllMetadata() {
    return { ...this._metadata };
  }

  /**
   * Calculate ticket duration
   * @private
   * @returns {string} Human-readable duration
   */
  _calculateDuration() {
    const endTime = this._closedAt || new Date();
    const durationMs = endTime - this.createdAt;
    
    const days = Math.floor(durationMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((durationMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }

  /**
   * Generate unique message ID
   * @private
   * @returns {string} Unique message ID
   */
  _generateMessageId() {
    return `${this.id}-msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Export ticket data for database storage
   * @returns {Object} Ticket data suitable for database storage
   * @example
   * const ticketData = ticket.toDatabase();
   * await ticketRepository.create(ticketData);
   */
  toDatabase() {
    return {
      _id: this.id,
      creatorId: this.creatorId,
      channelId: this.channelId,
      status: this._status,
      subject: this._subject,
      category: this._category,
      assignedStaff: this._assignedStaff,
      messages: this._messages,
      metadata: this._metadata,
      createdAt: this.createdAt,
      closedAt: this._closedAt,
      updatedAt: this.updatedAt
    };
  }

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
  static fromDatabase(data) {
    if (!data || !data._id) {
      throw new Error('Invalid ticket data: missing ID');
    }

    if (!data.creatorId) {
      throw new Error('Invalid ticket data: missing creator ID');
    }

    if (!data.channelId) {
      throw new Error('Invalid ticket data: missing channel ID');
    }

    return new Ticket(data._id, data.creatorId, data.channelId, {
      status: data.status,
      subject: data.subject,
      category: data.category,
      assignedStaff: data.assignedStaff,
      messages: data.messages,
      metadata: data.metadata,
      createdAt: data.createdAt,
      closedAt: data.closedAt,
      updatedAt: data.updatedAt
    });
  }

  /**
   * Get ticket summary information
   * @returns {Object} Ticket summary
   * @example
   * const summary = ticket.getSummary();
   * console.log(`Ticket ${summary.id}: ${summary.status} (${summary.messageCount} messages)`);
   */
  getSummary() {
    const messageStats = this.getMessageStats();
    
    return {
      id: this.id,
      creatorId: this.creatorId,
      channelId: this.channelId,
      status: this._status,
      subject: this._subject,
      category: this._category,
      assignedStaffCount: this._assignedStaff.length,
      messageCount: this._messages.length,
      userMessages: messageStats.user,
      staffMessages: messageStats.staff,
      createdAt: this.createdAt,
      closedAt: this._closedAt,
      duration: this._calculateDuration()
    };
  }
}

/**
 * @typedef {Object} TicketMessage
 * @property {string} id - Unique message identifier
 * @property {string} authorId - Discord user ID of message author
 * @property {string} authorType - Type of author (user, staff, system)
 * @property {string} content - Message content
 * @property {Array<string>} attachments - Message attachments
 * @property {Date} timestamp - When message was sent
 * @property {boolean} edited - Whether message was edited
 * @property {Date|null} editedAt - When message was edited (if applicable)
 */

module.exports = Ticket;