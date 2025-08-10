const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const BaseCommand = require('../BaseCommand');

/**
 * Clear command for bulk message deletion
 * Implements moderator-only message cleanup with safety limits
 * @class ClearCommand
 * @extends BaseCommand
 */
class ClearCommand extends BaseCommand {
  /**
   * Initialize clear command
   */
  constructor() {
    super();
    this._category = 'moderation';
    this._requiredPermissions = ['ManageMessages'];
    this._cooldown = 5000; // 5 second cooldown
    this._guildOnly = true;
  }

  /**
   * Command metadata for Discord registration
   * @returns {SlashCommandBuilder} Discord slash command data
   */
  get data() {
    return new SlashCommandBuilder()
      .setName('clear')
      .setDescription('Delete a specified number of messages from the channel')
      .addIntegerOption(option =>
        option.setName('amount')
          .setDescription('Number of messages to delete (1-100)')
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(100))
      .addUserOption(option =>
        option.setName('user')
          .setDescription('Only delete messages from this specific user')
          .setRequired(false))
      .addStringOption(option =>
        option.setName('reason')
          .setDescription('Reason for clearing messages')
          .setRequired(false)
          .setMaxLength(200))
      .addBooleanOption(option =>
        option.setName('silent')
          .setDescription('Perform deletion silently without confirmation message')
          .setRequired(false))
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);
  }

  /**
   * Execute clear command with validation and bulk deletion
   * @param {CommandInteraction} interaction - Discord slash command interaction
   * @returns {Promise<void>}
   */
  async execute(interaction) {
    try {
      const amount = interaction.options.getInteger('amount');
      const targetUser = interaction.options.getUser('user');
      const reason = interaction.options.getString('reason') || 'Message cleanup';
      const silent = interaction.options.getBoolean('silent') ?? false;

      // Validate bot permissions
      const botPermissions = interaction.channel.permissionsFor(interaction.client.user);
      if (!botPermissions.has([PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ReadMessageHistory])) {
        await interaction.editReply({
          content: '❌ I need `Manage Messages` and `Read Message History` permissions to clear messages in this channel.'
        });
        return;
      }

      // Show processing status
      await interaction.editReply({
        content: `🔄 **Processing Message Deletion**\n\n` +
                `**Amount:** ${amount} messages\n` +
                `**Target User:** ${targetUser ? targetUser.tag : 'All users'}\n` +
                `**Reason:** ${reason}\n\n` +
                `Fetching messages...`
      });

      // Fetch messages from the channel
      let messagesToDelete = [];
      let fetchedMessages;
      
      try {
        // Fetch messages (Discord limit is 100 per request)
        fetchedMessages = await interaction.channel.messages.fetch({ 
          limit: Math.min(amount + 10, 100) // Get a few extra in case some are filtered
        });
      } catch (error) {
        await interaction.editReply({
          content: '❌ Failed to fetch messages. I may not have permission to read message history in this channel.'
        });
        return;
      }

      // Filter messages based on criteria
      const now = Date.now();
      const twoWeeksAgo = now - (14 * 24 * 60 * 60 * 1000); // Discord's bulk delete limit

      for (const message of fetchedMessages.values()) {
        // Skip if we have enough messages
        if (messagesToDelete.length >= amount) {
          break;
        }

        // Skip the interaction reply
        if (message.id === interaction.id) {
          continue;
        }

        // Skip messages older than 2 weeks (Discord API limitation)
        if (message.createdTimestamp < twoWeeksAgo) {
          continue;
        }

        // Filter by user if specified
        if (targetUser && message.author.id !== targetUser.id) {
          continue;
        }

        messagesToDelete.push(message);
      }

      if (messagesToDelete.length === 0) {
        await interaction.editReply({
          content: '❌ No messages found to delete. Messages older than 2 weeks cannot be bulk deleted due to Discord limitations.'
        });
        return;
      }

      // Update status
      await interaction.editReply({
        content: `🔄 **Deleting Messages**\n\n` +
                `**Found:** ${messagesToDelete.length} messages to delete\n` +
                `**Processing deletion...**`
      });

      // Perform bulk deletion
      let deletedCount = 0;
      const errors = [];

      try {
        if (messagesToDelete.length === 1) {
          // Single message deletion
          await messagesToDelete[0].delete();
          deletedCount = 1;
        } else {
          // Bulk deletion (Discord allows up to 100 messages at once)
          const deleted = await interaction.channel.bulkDelete(messagesToDelete, true);
          deletedCount = deleted.size;
        }
      } catch (error) {
        console.error('Error during message deletion:', error);
        
        if (error.code === 50034) {
          errors.push('Some messages were too old to delete (older than 2 weeks)');
        } else if (error.code === 50013) {
          errors.push('Missing permissions to delete messages');
        } else {
          errors.push(`Deletion failed: ${error.message}`);
        }
      }

      // Create result embed
      const embed = new EmbedBuilder()
        .setTitle('🗑️ Messages Cleared')
        .setColor(deletedCount > 0 ? 0x00ff00 : 0xff0000)
        .setTimestamp()
        .addFields([
          {
            name: 'Deletion Summary',
            value: `**Requested:** ${amount} messages\n` +
                  `**Found:** ${messagesToDelete.length} eligible messages\n` +
                  `**Deleted:** ${deletedCount} messages\n` +
                  `**Target User:** ${targetUser ? targetUser.tag : 'All users'}\n` +
                  `**Reason:** ${reason}`,
            inline: false
          },
          {
            name: 'Executed By',
            value: `${interaction.user.tag} (${interaction.user.id})`,
            inline: true
          },
          {
            name: 'Channel',
            value: `<#${interaction.channel.id}>`,
            inline: true
          }
        ]);

      // Add errors if any
      if (errors.length > 0) {
        embed.addFields([
          {
            name: '⚠️ Warnings',
            value: errors.join('\n'),
            inline: false
          }
        ]);
      }

      // Send result message
      if (silent && deletedCount > 0) {
        // For silent mode, just delete the status message
        try {
          await interaction.deleteReply();
        } catch (error) {
          // If we can't delete the reply, just edit it to a minimal message
          await interaction.editReply({
            content: `✅ Deleted ${deletedCount} messages silently.`,
            embeds: []
          });
        }
      } else {
        // Send detailed result
        await interaction.editReply({
          content: deletedCount > 0 
            ? `✅ **Message Deletion Complete**\nSuccessfully deleted ${deletedCount} message${deletedCount === 1 ? '' : 's'}.`
            : `❌ **Message Deletion Failed**\nNo messages were deleted.`,
          embeds: [embed]
        });

        // Auto-delete the result message after 10 seconds in silent mode
        if (silent && deletedCount > 0) {
          setTimeout(async () => {
            try {
              await interaction.deleteReply();
            } catch (error) {
              // Ignore errors if message was already deleted
            }
          }, 10000);
        }
      }

      // Log the action
      console.log(`Clear command executed by ${interaction.user.tag} (${interaction.user.id}) in ${interaction.guild.name} - Deleted ${deletedCount}/${amount} messages`);

    } catch (error) {
      console.error('Error executing clear command:', error);
      
      await interaction.editReply({
        content: '❌ An error occurred while clearing messages. Please try again or contact an administrator.'
      });
    }
  }

  /**
   * Custom permission validation for clear command
   * @param {CommandInteraction} interaction - Discord interaction
   * @returns {Promise<boolean>} Permission validation result
   */
  async validatePermissions(interaction) {
    // Check base permissions first
    const hasBasePermissions = await super.validatePermissions(interaction);
    if (!hasBasePermissions) {
      return false;
    }

    // Additional validation: ensure bot has required permissions in the channel
    const botPermissions = interaction.channel.permissionsFor(interaction.client.user);
    const requiredPermissions = [
      PermissionFlagsBits.ManageMessages,
      PermissionFlagsBits.ReadMessageHistory
    ];

    const hasPermissions = requiredPermissions.every(permission => 
      botPermissions.has(permission)
    );

    if (!hasPermissions) {
      await interaction.reply({
        content: '❌ I need `Manage Messages` and `Read Message History` permissions in this channel to clear messages.',
        flags: [4] // MessageFlags.Ephemeral
      });
      return false;
    }

    return true;
  }
}

module.exports = ClearCommand;