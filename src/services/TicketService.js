/**
 * Service for managing ticket system operations
 * Handles ticket creation, management, staff assignment, and transcripts
 * @class TicketService
 * @example
 * const ticketService = new TicketService(ticketRepo, configRepo, permissionService);
 * const ticket = await ticketService.createTicket(interaction, 'Bug Report', 'technical');
 */
class TicketService {
  /**
   * Initialize ticket service
   * @param {TicketRepository} ticketRepository - Ticket data repository
   * @param {ConfigRepository} configRepository - Server configuration repository
   * @param {PermissionService} permissionService - Permission validation service
   */
  constructor(ticketRepository, configRepository, permissionService) {
    if (!ticketRepository) {
      throw new Error('TicketRepository is required');
    }
    if (!configRepository) {
      throw new Error('ConfigRepository is required');
    }
    if (!permissionService) {
      throw new Error('PermissionService is required');
    }

    /**
     * Ticket repository for data persistence
     * @type {TicketRepository}
     * @private
     */
    this._ticketRepo = ticketRepository;

    /**
     * Configuration repository for server settings
     * @type {ConfigRepository}
     * @private
     */
    this._configRepo = configRepository;

    /**
     * Permission service for validation
     * @type {PermissionService}
     * @private
     */
    this._permissionService = permissionService;

    /**
     * Cache for active ticket channels
     * @type {Map<string, Object>}
     * @private
     */
    this._channelCache = new Map();

    /**
     * Rate limiting for ticket creation
     * @type {Map<string, number>}
     * @private
     */
    this._creationLimits = new Map();

    /**
     * Transcript generation queue
     * @type {Set<string>}
     * @private
     */
    this._transcriptQueue = new Set();
  }

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
  async createTicket(interaction, subject, category = 'general', description = null) {
    try {
      // Check rate limiting
      const userId = interaction.user.id;
      const now = Date.now();
      const lastCreation = this._creationLimits.get(userId) || 0;
      const cooldownMs = 5 * 60 * 1000; // 5 minutes

      if (now - lastCreation < cooldownMs) {
        const remainingTime = Math.ceil((cooldownMs - (now - lastCreation)) / 1000);
        return {
          success: false,
          error: `Please wait ${remainingTime} seconds before creating another ticket.`,
          type: 'rate_limited'
        };
      }

      // Check if user already has an open ticket
      const existingTickets = await this._ticketRepo.findTicketsByCreator(userId, 'open');
      if (existingTickets.length >= 3) {
        return {
          success: false,
          error: 'You already have the maximum number of open tickets (3). Please close an existing ticket first.',
          type: 'ticket_limit_exceeded'
        };
      }

      // Get server configuration
      const server = await this._configRepo.findServerById(interaction.guild.id);
      if (!server) {
        return {
          success: false,
          error: 'Server configuration not found. Please run setup first.',
          type: 'config_missing'
        };
      }

      // Generate ticket ID
      const ticketId = await this._ticketRepo.generateNextTicketId();

      // Create ticket channel
      const channelName = `ticket-${ticketId}`;
      let ticketChannel;

      try {
        ticketChannel = await interaction.guild.channels.create({
          name: channelName,
          type: 0, // Text channel
          topic: `Support ticket ${ticketId} - ${subject}`,
          parent: server.getTicketsCategory() || null,
          permissionOverwrites: [
            {
              id: interaction.guild.id,
              deny: ['VIEW_CHANNEL']
            },
            {
              id: interaction.user.id,
              allow: ['VIEW_CHANNEL', 'SEND_MESSAGES', 'READ_MESSAGE_HISTORY']
            },
            {
              id: interaction.guild.members.me.id,
              allow: ['VIEW_CHANNEL', 'SEND_MESSAGES', 'MANAGE_MESSAGES', 'MANAGE_CHANNELS']
            }
          ]
        });
      } catch (error) {
        return {
          success: false,
          error: `Failed to create ticket channel: ${error.message}`,
          type: 'channel_creation_failed'
        };
      }

      // Add moderator role permissions if configured
      const moderatorRoleId = server.getModeratorRole();
      if (moderatorRoleId) {
        try {
          await ticketChannel.permissionOverwrites.create(moderatorRoleId, {
            VIEW_CHANNEL: true,
            SEND_MESSAGES: true,
            READ_MESSAGE_HISTORY: true,
            MANAGE_MESSAGES: true
          });
        } catch (error) {
          console.warn(`Failed to add moderator permissions to ticket channel: ${error.message}`);
        }
      }

      // Create ticket entity
      const Ticket = require('../entities/Ticket');
      const ticket = new Ticket(ticketId, userId, ticketChannel.id);
      ticket.setSubject(subject);
      ticket.setCategory(category);

      if (description) {
        ticket.addMessage(userId, description, 'user', [], new Date());
      }

      // Save ticket to database
      await this._ticketRepo.saveTicket(ticket);

      // Update rate limiting
      this._creationLimits.set(userId, now);

      // Cache channel information
      this._channelCache.set(ticketChannel.id, {
        ticketId: ticketId,
        creatorId: userId,
        category: category,
        status: 'open',
        createdAt: new Date()
      });

      // Send initial ticket message with controls
      const ticketEmbed = {
        color: 0x0099ff,
        title: `🎫 Ticket ${ticketId}`,
        description: subject,
        fields: [
          {
            name: 'Category',
            value: category,
            inline: true
          },
          {
            name: 'Status',
            value: 'Open',
            inline: true
          },
          {
            name: 'Created by',
            value: `<@${userId}>`,
            inline: true
          }
        ],
        timestamp: new Date(),
        footer: {
          text: 'Support Ticket System'
        }
      };

      if (description) {
        ticketEmbed.fields.push({
          name: 'Description',
          value: description.length > 1024 ? description.substring(0, 1021) + '...' : description,
          inline: false
        });
      }

      const ticketButtons = {
        type: 1,
        components: [
          {
            type: 2,
            style: 1,
            label: 'Assign Staff',
            custom_id: `ticket_assign_${ticketId}`,
            emoji: { name: '👥' }
          },
          {
            type: 2,
            style: 2,
            label: 'Set Priority',
            custom_id: `ticket_priority_${ticketId}`,
            emoji: { name: '⚠️' }
          },
          {
            type: 2,
            style: 4,
            label: 'Close Ticket',
            custom_id: `ticket_close_${ticketId}`,
            emoji: { name: '🔒' }
          }
        ]
      };

      await ticketChannel.send({
        embeds: [ticketEmbed],
        components: [ticketButtons]
      });

      return {
        success: true,
        ticket: {
          id: ticketId,
          subject: subject,
          category: category,
          status: 'open',
          creatorId: userId,
          channelId: ticketChannel.id
        },
        channel: {
          id: ticketChannel.id,
          name: channelName,
          url: `https://discord.com/channels/${interaction.guild.id}/${ticketChannel.id}`
        },
        creator: {
          id: userId,
          tag: interaction.user.tag
        },
        createdAt: new Date()
      };
    } catch (error) {
      throw new Error(`Failed to create ticket: ${error.message}`);
    }
  }

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
  async closeTicket(interaction, ticketId, reason = 'Ticket resolved', archiveChannel = true) {
    try {
      // Find ticket
      const ticket = await this._ticketRepo.findTicketById(ticketId);
      if (!ticket) {
        return {
          success: false,
          error: 'Ticket not found.',
          type: 'ticket_not_found'
        };
      }

      // Check if ticket is already closed
      if (ticket.isClosed()) {
        return {
          success: false,
          error: 'Ticket is already closed.',
          type: 'already_closed'
        };
      }

      // Check permissions
      const canAccess = await this._permissionService.canAccessTicket(
        interaction.guild.members.cache.get(interaction.user.id),
        ticket
      );

      if (!canAccess) {
        return {
          success: false,
          error: 'You do not have permission to close this ticket.',
          type: 'permission_denied'
        };
      }

      // Get ticket channel
      const channel = interaction.guild.channels.cache.get(ticket.channelId);
      if (!channel) {
        return {
          success: false,
          error: 'Ticket channel not found.',
          type: 'channel_not_found'
        };
      }

      // Generate transcript before closing
      let transcriptData = null;
      try {
        transcriptData = await this.generateTranscript(ticket.id);
      } catch (error) {
        console.warn(`Failed to generate transcript for ticket ${ticket.id}: ${error.message}`);
      }

      // Close the ticket
      ticket.close(interaction.user.id, reason);

      // Add closure message to ticket
      ticket.addMessage(
        interaction.user.id,
        `Ticket closed by <@${interaction.user.id}>: ${reason}`,
        'staff',
        [],
        new Date()
      );

      // Save ticket
      await this._ticketRepo.saveTicket(ticket);

      // Update cache
      if (this._channelCache.has(channel.id)) {
        const cached = this._channelCache.get(channel.id);
        cached.status = 'closed';
        cached.closedAt = new Date();
        cached.closedBy = interaction.user.id;
      }

      // Send closure notification
      const closureEmbed = {
        color: 0xff9900,
        title: `🔒 Ticket ${ticketId} Closed`,
        description: reason,
        fields: [
          {
            name: 'Closed by',
            value: `<@${interaction.user.id}>`,
            inline: true
          },
          {
            name: 'Status',
            value: 'Closed',
            inline: true
          }
        ],
        timestamp: new Date()
      };

      if (transcriptData && transcriptData.success) {
        closureEmbed.fields.push({
          name: 'Transcript',
          value: `Generated (${transcriptData.messageCount} messages)`,
          inline: true
        });
      }

      await channel.send({ embeds: [closureEmbed] });

      // Archive or delete channel
      if (archiveChannel) {
        try {
          // Move to archive category if configured
          const server = await this._configRepo.findServerById(interaction.guild.id);
          const archiveCategory = server?.getArchiveCategory();
          
          if (archiveCategory) {
            await channel.setParent(archiveCategory);
          }

          // Lock channel
          await channel.permissionOverwrites.edit(ticket.creatorId, {
            SEND_MESSAGES: false
          });

          // Update channel name
          await channel.setName(`closed-${ticketId}`);
        } catch (error) {
          console.warn(`Failed to archive ticket channel: ${error.message}`);
        }
      }

      // Clean up cache after delay
      setTimeout(() => {
        this._channelCache.delete(channel.id);
      }, 24 * 60 * 60 * 1000); // 24 hours

      return {
        success: true,
        ticket: {
          id: ticketId,
          status: 'closed',
          closedBy: interaction.user.id,
          closedAt: ticket.getClosedAt(),
          reason: reason
        },
        channel: {
          id: channel.id,
          archived: archiveChannel
        },
        transcript: transcriptData,
        closedBy: {
          id: interaction.user.id,
          tag: interaction.user.tag
        }
      };
    } catch (error) {
      throw new Error(`Failed to close ticket: ${error.message}`);
    }
  }

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
  async assignStaff(interaction, ticketId, staffId) {
    try {
      // Find ticket
      const ticket = await this._ticketRepo.findTicketById(ticketId);
      if (!ticket) {
        return {
          success: false,
          error: 'Ticket not found.',
          type: 'ticket_not_found'
        };
      }

      // Check if ticket is closed
      if (ticket.isClosed()) {
        return {
          success: false,
          error: 'Cannot assign staff to a closed ticket.',
          type: 'ticket_closed'
        };
      }

      // Check permissions (only staff can assign other staff)
      const hasPermission = await this._permissionService.hasModeratorRole(
        interaction.guild.members.cache.get(interaction.user.id)
      );

      if (!hasPermission) {
        return {
          success: false,
          error: 'You need moderator permissions to assign staff to tickets.',
          type: 'permission_denied'
        };
      }

      // Validate staff member exists and has permissions
      const staffMember = interaction.guild.members.cache.get(staffId);
      if (!staffMember) {
        return {
          success: false,
          error: 'Staff member not found in this server.',
          type: 'staff_not_found'
        };
      }

      const staffHasPermission = await this._permissionService.hasModeratorRole(staffMember);
      if (!staffHasPermission) {
        return {
          success: false,
          error: 'Selected user does not have staff permissions.',
          type: 'invalid_staff'
        };
      }

      // Check if staff is already assigned
      if (ticket.isStaffAssigned(staffId)) {
        return {
          success: false,
          error: 'Staff member is already assigned to this ticket.',
          type: 'already_assigned'
        };
      }

      // Assign staff to ticket
      ticket.assignStaff(staffId);

      // Add system message
      ticket.addMessage(
        'system',
        `<@${staffId}> has been assigned to this ticket by <@${interaction.user.id}>`,
        'system',
        [],
        new Date()
      );

      // Save ticket
      await this._ticketRepo.saveTicket(ticket);

      // Get ticket channel and add permissions
      const channel = interaction.guild.channels.cache.get(ticket.channelId);
      if (channel) {
        try {
          await channel.permissionOverwrites.create(staffId, {
            VIEW_CHANNEL: true,
            SEND_MESSAGES: true,
            READ_MESSAGE_HISTORY: true,
            MANAGE_MESSAGES: true
          });
        } catch (error) {
          console.warn(`Failed to add channel permissions for assigned staff: ${error.message}`);
        }

        // Send assignment notification
        const assignmentEmbed = {
          color: 0x00ff00,
          title: `👥 Staff Assigned`,
          description: `<@${staffId}> has been assigned to ticket ${ticketId}`,
          fields: [
            {
              name: 'Assigned by',
              value: `<@${interaction.user.id}>`,
              inline: true
            },
            {
              name: 'Ticket Status',
              value: 'Open - Assigned',
              inline: true
            }
          ],
          timestamp: new Date()
        };

        await channel.send({ embeds: [assignmentEmbed] });
      }

      return {
        success: true,
        ticket: {
          id: ticketId,
          assignedStaff: ticket.getAssignedStaff(),
          status: 'open'
        },
        assignment: {
          staffId: staffId,
          staffTag: staffMember.user.tag,
          assignedBy: interaction.user.id,
          assignedAt: new Date()
        }
      };
    } catch (error) {
      throw new Error(`Failed to assign staff to ticket: ${error.message}`);
    }
  }

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
  async generateTranscript(ticketId, format = 'json') {
    try {
      if (this._transcriptQueue.has(ticketId)) {
        return {
          success: false,
          error: 'Transcript generation already in progress for this ticket.',
          type: 'generation_in_progress'
        };
      }

      this._transcriptQueue.add(ticketId);

      try {
        // Find ticket
        const ticket = await this._ticketRepo.findTicketById(ticketId);
        if (!ticket) {
          return {
            success: false,
            error: 'Ticket not found.',
            type: 'ticket_not_found'
          };
        }

        // Generate transcript using ticket entity
        const transcriptData = ticket.generateTranscript();
        const messages = ticket.getMessages();

        let formattedContent;
        let mimeType;
        let fileExtension;

        switch (format.toLowerCase()) {
          case 'text':
            formattedContent = this._formatTranscriptAsText(transcriptData, messages);
            mimeType = 'text/plain';
            fileExtension = 'txt';
            break;
          
          case 'html':
            formattedContent = this._formatTranscriptAsHTML(transcriptData, messages);
            mimeType = 'text/html';
            fileExtension = 'html';
            break;
          
          case 'json':
          default:
            formattedContent = JSON.stringify({
              ...transcriptData,
              messages: messages
            }, null, 2);
            mimeType = 'application/json';
            fileExtension = 'json';
            break;
        }

        return {
          success: true,
          ticketId: ticketId,
          format: format,
          messageCount: messages.length,
          generatedAt: new Date(),
          content: formattedContent,
          metadata: {
            mimeType: mimeType,
            fileExtension: fileExtension,
            size: formattedContent.length,
            transcript: transcriptData
          }
        };
      } finally {
        this._transcriptQueue.delete(ticketId);
      }
    } catch (error) {
      this._transcriptQueue.delete(ticketId);
      throw new Error(`Failed to generate transcript: ${error.message}`);
    }
  }

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
  async searchTickets(guildId, query, filters = {}, limit = 20) {
    try {
      // Add guild-specific filtering if tickets are guild-specific
      const guildFilters = { ...filters };
      
      const results = await this._ticketRepo.searchTickets(query, guildFilters, limit);
      
      // Filter results to only include tickets from the specified guild
      // This assumes tickets store guild information
      const guildResults = results.filter(result => {
        const messages = result.ticket.getMessages();
        return messages.some(msg => msg.guildId === guildId) || 
               result.ticket.metadata?.guildId === guildId;
      });

      return guildResults;
    } catch (error) {
      throw new Error(`Failed to search tickets: ${error.message}`);
    }
  }

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
  async getTicketStatistics(guildId, days = 30) {
    try {
      const stats = await this._ticketRepo.getTicketStatistics(days);
      
      // Add service-specific statistics
      const serviceStats = {
        ...stats,
        guildId: guildId,
        cached: {
          activeChannels: Array.from(this._channelCache.values()).length,
          transcriptQueue: this._transcriptQueue.size,
          rateLimits: this._creationLimits.size
        },
        period: `${days} days`,
        lastUpdated: new Date()
      };

      return serviceStats;
    } catch (error) {
      throw new Error(`Failed to get ticket statistics: ${error.message}`);
    }
  }

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
  async getTicketsNeedingAttention(guildId, hours = 24) {
    try {
      const staleTickets = await this._ticketRepo.findTicketsNeedingAttention(hours);
      
      // Filter by guild if tickets contain guild information
      const guildStaleTickets = staleTickets.filter(item => {
        const messages = item.ticket.getMessages();
        return messages.some(msg => msg.guildId === guildId) || 
               item.ticket.metadata?.guildId === guildId;
      });

      return guildStaleTickets;
    } catch (error) {
      throw new Error(`Failed to get tickets needing attention: ${error.message}`);
    }
  }

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
  clearUserRateLimit(userId) {
    return this._creationLimits.delete(userId);
  }

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
  getCachedChannelInfo(channelId) {
    return this._channelCache.get(channelId) || null;
  }

  /**
   * Format transcript as plain text
   * @private
   * @param {Object} transcriptData - Transcript metadata
   * @param {Array} messages - Ticket messages
   * @returns {string} Formatted text transcript
   */
  _formatTranscriptAsText(transcriptData, messages) {
    let content = `TICKET TRANSCRIPT\n`;
    content += `================\n`;
    content += `Ticket ID: ${transcriptData.ticketId}\n`;
    content += `Subject: ${transcriptData.subject}\n`;
    content += `Category: ${transcriptData.category}\n`;
    content += `Status: ${transcriptData.status}\n`;
    content += `Created: ${transcriptData.createdAt}\n`;
    content += `Creator: ${transcriptData.creatorId}\n`;
    
    if (transcriptData.closedAt) {
      content += `Closed: ${transcriptData.closedAt}\n`;
    }
    
    content += `Messages: ${transcriptData.totalMessages}\n`;
    content += `Generated: ${transcriptData.generatedAt}\n`;
    content += `\n`;

    for (const message of messages) {
      const timestamp = new Date(message.timestamp).toLocaleString();
      const authorType = message.authorType === 'staff' ? '[STAFF]' : 
                        message.authorType === 'system' ? '[SYSTEM]' : '[USER]';
      
      content += `[${timestamp}] ${authorType} ${message.authorId}: ${message.content}\n`;
      
      if (message.attachments && message.attachments.length > 0) {
        content += `  Attachments: ${message.attachments.join(', ')}\n`;
      }
    }

    return content;
  }

  /**
   * Format transcript as HTML
   * @private
   * @param {Object} transcriptData - Transcript metadata
   * @param {Array} messages - Ticket messages
   * @returns {string} Formatted HTML transcript
   */
  _formatTranscriptAsHTML(transcriptData, messages) {
    let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ticket ${transcriptData.ticketId} Transcript</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .header { background: #f0f0f0; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
        .message { margin-bottom: 15px; padding: 10px; border-left: 3px solid #ddd; }
        .staff { border-left-color: #e74c3c; }
        .system { border-left-color: #f39c12; }
        .user { border-left-color: #3498db; }
        .timestamp { color: #666; font-size: 0.9em; }
        .author { font-weight: bold; }
        .attachments { font-style: italic; color: #666; margin-top: 5px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Ticket ${transcriptData.ticketId} Transcript</h1>
        <p><strong>Subject:</strong> ${transcriptData.subject}</p>
        <p><strong>Category:</strong> ${transcriptData.category}</p>
        <p><strong>Status:</strong> ${transcriptData.status}</p>
        <p><strong>Created:</strong> ${transcriptData.createdAt}</p>
        <p><strong>Creator:</strong> ${transcriptData.creatorId}</p>
        ${transcriptData.closedAt ? `<p><strong>Closed:</strong> ${transcriptData.closedAt}</p>` : ''}
        <p><strong>Messages:</strong> ${transcriptData.totalMessages}</p>
        <p><strong>Generated:</strong> ${transcriptData.generatedAt}</p>
    </div>
    
    <div class="messages">`;

    for (const message of messages) {
      const timestamp = new Date(message.timestamp).toLocaleString();
      const authorType = message.authorType;
      const escapedContent = message.content
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      html += `
        <div class="message ${authorType}">
            <div class="timestamp">${timestamp}</div>
            <div class="author">[${authorType.toUpperCase()}] ${message.authorId}</div>
            <div class="content">${escapedContent}</div>`;

      if (message.attachments && message.attachments.length > 0) {
        html += `<div class="attachments">Attachments: ${message.attachments.join(', ')}</div>`;
      }

      html += `</div>`;
    }

    html += `
    </div>
</body>
</html>`;

    return html;
  }
}

module.exports = TicketService;