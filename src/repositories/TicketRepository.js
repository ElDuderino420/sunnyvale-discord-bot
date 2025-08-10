const BaseRepository = require('./BaseRepository');
const Ticket = require('../entities/Ticket');

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
class TicketRepository extends BaseRepository {
  /**
   * Initialize ticket repository
   * @param {DatabaseManager} dbManager - Database connection manager
   */
  constructor(dbManager) {
    super(dbManager, 'tickets');
  }

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
  async findTicketById(ticketId) {
    try {
      const ticketData = await this.findById(ticketId);
      return ticketData ? Ticket.fromDatabase(ticketData) : null;
    } catch (error) {
      throw new Error(`Failed to find ticket by ID: ${error.message}`);
    }
  }

  /**
   * Create or update ticket record
   * @param {Ticket} ticket - Ticket entity to save
   * @returns {Promise<Ticket>} Saved ticket entity
   * @throws {Error} When save operation fails
   * @example
   * const ticket = new Ticket('0001', '123456789', '987654321');
   * const savedTicket = await ticketRepo.saveTicket(ticket);
   */
  async saveTicket(ticket) {
    try {
      if (!(ticket instanceof Ticket)) {
        throw new Error('Parameter must be a Ticket entity');
      }

      const ticketData = ticket.toDatabase();
      const exists = await this.exists(ticket.id);

      if (exists) {
        await this.updateById(ticket.id, ticketData);
      } else {
        await this.create(ticketData);
      }

      return ticket;
    } catch (error) {
      throw new Error(`Failed to save ticket: ${error.message}`);
    }
  }

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
  async findTicketByChannelId(channelId) {
    try {
      const ticketData = await this.findOne({ channelId: channelId });
      return ticketData ? Ticket.fromDatabase(ticketData) : null;
    } catch (error) {
      throw new Error(`Failed to find ticket by channel ID: ${error.message}`);
    }
  }

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
  async findTicketsByCreator(creatorId, status = null, limit = null) {
    try {
      let query = { creatorId: creatorId };
      if (status) {
        query.status = status;
      }

      const options = {};
      if (limit && typeof limit === 'number' && limit > 0) {
        options.limit = limit;
      }
      
      // Sort by creation date (newest first)
      options.sort = { createdAt: -1 };

      const ticketData = await this.findMany(query, options);
      return ticketData.map(data => Ticket.fromDatabase(data));
    } catch (error) {
      throw new Error(`Failed to find tickets by creator: ${error.message}`);
    }
  }

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
  async findTicketsByStatus(status, limit = null) {
    try {
      const options = {};
      if (limit && typeof limit === 'number' && limit > 0) {
        options.limit = limit;
      }
      
      // Sort by creation date (newest first)
      options.sort = { createdAt: -1 };

      const ticketData = await this.findMany({ status: status }, options);
      return ticketData.map(data => Ticket.fromDatabase(data));
    } catch (error) {
      throw new Error(`Failed to find tickets by status: ${error.message}`);
    }
  }

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
  async findTicketsByStaff(staffId, status = null) {
    try {
      let query = { assignedStaff: staffId };
      if (status) {
        query.status = status;
      }

      // Sort by creation date (newest first)
      const options = { sort: { createdAt: -1 } };

      const ticketData = await this.findMany(query, options);
      return ticketData.map(data => Ticket.fromDatabase(data));
    } catch (error) {
      throw new Error(`Failed to find tickets by staff: ${error.message}`);
    }
  }

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
  async findTicketsByCategory(category, status = null, limit = null) {
    try {
      let query = { category: category };
      if (status) {
        query.status = status;
      }

      const options = { sort: { createdAt: -1 } };
      if (limit && typeof limit === 'number' && limit > 0) {
        options.limit = limit;
      }

      const ticketData = await this.findMany(query, options);
      return ticketData.map(data => Ticket.fromDatabase(data));
    } catch (error) {
      throw new Error(`Failed to find tickets by category: ${error.message}`);
    }
  }

  /**
   * Generate next ticket ID in sequence
   * @returns {Promise<string>} Next ticket ID (padded to 4 digits)
   * @throws {Error} When ID generation fails
   * @example
   * const nextId = await ticketRepo.generateNextTicketId();
   * console.log(`Next ticket ID: ${nextId}`); // e.g., "0042"
   */
  async generateNextTicketId() {
    try {
      // Get the highest ticket ID (assuming numeric IDs)
      const allTickets = await this.findMany({}, { sort: { _id: -1 }, limit: 1 });
      
      let nextNumber = 1;
      if (allTickets.length > 0) {
        const lastId = allTickets[0]._id;
        const lastNumber = parseInt(lastId, 10);
        if (!isNaN(lastNumber)) {
          nextNumber = lastNumber + 1;
        }
      }

      // Pad to 4 digits
      return nextNumber.toString().padStart(4, '0');
    } catch (error) {
      throw new Error(`Failed to generate next ticket ID: ${error.message}`);
    }
  }

  /**
   * Get ticket statistics summary
   * @param {number} [days=30] - Days to include in statistics
   * @returns {Promise<Object>} Ticket statistics
   * @throws {Error} When statistics calculation fails
   * @example
   * const stats = await ticketRepo.getTicketStatistics(7);
   * console.log(`${stats.openTickets} tickets opened in the last week`);
   */
  async getTicketStatistics(days = 30) {
    try {
      const cutoffTime = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
      const allTickets = await this.findMany({});
      
      const stats = {
        totalTickets: allTickets.length,
        byStatus: {
          open: 0,
          closed: 0,
          archived: 0
        },
        recentTickets: 0,
        averageResponseTime: 0,
        ticketsByCategory: {},
        busyStaff: {},
        averageResolutionTime: 0,
        totalMessages: 0,
        averageMessagesPerTicket: 0
      };

      let totalResponseTime = 0;
      let totalResolutionTime = 0;
      let ticketsWithResponse = 0;
      let closedTickets = 0;

      for (const ticketData of allTickets) {
        const ticket = Ticket.fromDatabase(ticketData);
        
        // Count by status
        if (stats.byStatus.hasOwnProperty(ticket.getStatus())) {
          stats.byStatus[ticket.getStatus()]++;
        }

        // Count recent tickets
        if (new Date(ticket.createdAt) >= cutoffTime) {
          stats.recentTickets++;
        }

        // Count by category
        const category = ticket.getCategory() || 'uncategorized';
        stats.ticketsByCategory[category] = (stats.ticketsByCategory[category] || 0) + 1;

        // Count staff assignments
        const assignedStaff = ticket.getAssignedStaff();
        for (const staffId of assignedStaff) {
          stats.busyStaff[staffId] = (stats.busyStaff[staffId] || 0) + 1;
        }

        // Calculate response and resolution times
        const messages = ticket.getMessages();
        stats.totalMessages += messages.length;

        if (messages.length > 0) {
          const firstMessage = messages[0];
          const firstStaffResponse = messages.find(msg => msg.authorType === 'staff');
          
          if (firstStaffResponse) {
            const responseTime = new Date(firstStaffResponse.timestamp) - new Date(firstMessage.timestamp);
            totalResponseTime += responseTime;
            ticketsWithResponse++;
          }
        }

        if (ticket.isClosed() && ticket.getClosedAt()) {
          const resolutionTime = new Date(ticket.getClosedAt()) - new Date(ticket.createdAt);
          totalResolutionTime += resolutionTime;
          closedTickets++;
        }
      }

      // Calculate averages
      if (ticketsWithResponse > 0) {
        stats.averageResponseTime = Math.round(totalResponseTime / ticketsWithResponse / (1000 * 60)); // minutes
      }

      if (closedTickets > 0) {
        stats.averageResolutionTime = Math.round(totalResolutionTime / closedTickets / (1000 * 60 * 60)); // hours
      }

      if (stats.totalTickets > 0) {
        stats.averageMessagesPerTicket = Math.round(stats.totalMessages / stats.totalTickets * 10) / 10;
      }

      return stats;
    } catch (error) {
      throw new Error(`Failed to calculate ticket statistics: ${error.message}`);
    }
  }

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
  async findTicketsNeedingAttention(hours = 24) {
    try {
      const cutoffTime = new Date(Date.now() - (hours * 60 * 60 * 1000));
      const openTickets = await this.findTicketsByStatus('open');
      const needsAttention = [];

      for (const ticket of openTickets) {
        const lastActivity = new Date(ticket.updatedAt);
        
        if (lastActivity < cutoffTime) {
          const hoursSinceActivity = Math.round((Date.now() - lastActivity.getTime()) / (1000 * 60 * 60));
          needsAttention.push({
            ticket,
            hoursSinceActivity
          });
        }
      }

      // Sort by hours since activity (most stale first)
      needsAttention.sort((a, b) => b.hoursSinceActivity - a.hoursSinceActivity);

      return needsAttention;
    } catch (error) {
      throw new Error(`Failed to find tickets needing attention: ${error.message}`);
    }
  }

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
  async archiveOldTickets(days, dryRun = true) {
    try {
      const cutoffTime = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
      const closedTickets = await this.findTicketsByStatus('closed');
      let archivedCount = 0;

      for (const ticket of closedTickets) {
        const closedAt = ticket.getClosedAt();
        
        if (closedAt && new Date(closedAt) < cutoffTime) {
          if (!dryRun) {
            ticket.archive('system');
            await this.saveTicket(ticket);
          }
          archivedCount++;
        }
      }

      return archivedCount;
    } catch (error) {
      throw new Error(`Failed to archive old tickets: ${error.message}`);
    }
  }

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
  async backupTicketData(ticketIds = null, includeMessages = true) {
    try {
      let query = {};
      if (ticketIds && Array.isArray(ticketIds)) {
        query = { _id: { $in: ticketIds } };
      }

      const ticketData = await this.findMany(query);
      
      // Optionally strip messages for smaller backup
      if (!includeMessages) {
        ticketData.forEach(ticket => {
          delete ticket.messages;
        });
      }
      
      return {
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        ticketCount: ticketData.length,
        includeMessages: includeMessages,
        tickets: ticketData
      };
    } catch (error) {
      throw new Error(`Failed to backup ticket data: ${error.message}`);
    }
  }

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
  async restoreTicketData(backupData, overwrite = false) {
    try {
      if (!backupData || !backupData.tickets || !Array.isArray(backupData.tickets)) {
        throw new Error('Invalid backup data format');
      }

      const results = {
        imported: 0,
        skipped: 0,
        errors: []
      };

      for (const ticketData of backupData.tickets) {
        try {
          const exists = await this.exists(ticketData._id);
          
          if (exists && !overwrite) {
            results.skipped++;
            continue;
          }

          // Validate ticket data by creating Ticket entity
          const ticket = Ticket.fromDatabase(ticketData);
          
          if (exists) {
            await this.updateById(ticketData._id, ticketData);
          } else {
            await this.create(ticketData);
          }
          
          results.imported++;
        } catch (error) {
          results.errors.push({
            ticketId: ticketData._id,
            error: error.message
          });
        }
      }

      return results;
    } catch (error) {
      throw new Error(`Failed to restore ticket data: ${error.message}`);
    }
  }

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
  async searchTickets(searchTerm, filters = {}, limit = 50) {
    try {
      if (!searchTerm || typeof searchTerm !== 'string') {
        throw new Error('Search term must be a non-empty string');
      }

      const query = { ...filters };
      const allTickets = await this.findMany(query);
      const results = [];
      const searchLower = searchTerm.toLowerCase();

      for (const ticketData of allTickets) {
        const ticket = Ticket.fromDatabase(ticketData);
        let relevance = 0;
        let matchCount = 0;

        // Search in subject
        const subject = ticket.getSubject();
        if (subject && subject.toLowerCase().includes(searchLower)) {
          relevance += 50;
          matchCount++;
        }

        // Search in messages
        const messages = ticket.getMessages();
        for (const message of messages) {
          if (message.content.toLowerCase().includes(searchLower)) {
            relevance += 10;
            matchCount++;
          }
        }

        // Search in category
        const category = ticket.getCategory();
        if (category && category.toLowerCase().includes(searchLower)) {
          relevance += 20;
          matchCount++;
        }

        if (relevance > 0) {
          // Normalize relevance to percentage
          const normalizedRelevance = Math.min(100, relevance);
          results.push({ ticket, relevance: normalizedRelevance, matches: matchCount });
        }
      }

      // Sort by relevance (highest first) and apply limit
      results.sort((a, b) => b.relevance - a.relevance);
      return results.slice(0, limit);
    } catch (error) {
      throw new Error(`Failed to search tickets: ${error.message}`);
    }
  }
}

module.exports = TicketRepository;