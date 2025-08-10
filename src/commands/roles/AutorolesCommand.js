const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const BaseCommand = require('../BaseCommand');

/**
 * Autoroles command for setting up reaction-based role assignment
 * Implements emoji-to-role mapping with persistent storage
 * @class AutorolesCommand
 * @extends BaseCommand
 */
class AutorolesCommand extends BaseCommand {
  /**
   * Initialize autoroles command with role service dependency
   * @param {RoleService} roleService - Service for role operations
   */
  constructor(roleService) {
    super();
    this.roleService = roleService;
    this._category = 'roles';
    this._requiredPermissions = ['ManageRoles'];
    this._cooldown = 10000;
    this._guildOnly = true;
  }

  /**
   * Command metadata for Discord registration
   * @returns {SlashCommandBuilder} Discord slash command data
   */
  get data() {
    return new SlashCommandBuilder()
      .setName('autoroles')
      .setDescription('Set up automatic role assignment with reactions')
      .addSubcommand(subcommand =>
        subcommand
          .setName('create')
          .setDescription('Create a new autorole message')
          .addStringOption(option =>
            option.setName('title')
              .setDescription('Title for the autorole embed')
              .setRequired(true)
              .setMaxLength(100))
          .addStringOption(option =>
            option.setName('description')
              .setDescription('Description explaining the roles')
              .setRequired(true)
              .setMaxLength(1000))
          .addChannelOption(option =>
            option.setName('channel')
              .setDescription('Channel to post the autorole message')
              .setRequired(false)))
      .addSubcommand(subcommand =>
        subcommand
          .setName('add-role')
          .setDescription('Add a role to an existing autorole message')
          .addStringOption(option =>
            option.setName('message_id')
              .setDescription('ID of the autorole message')
              .setRequired(true))
          .addRoleOption(option =>
            option.setName('role')
              .setDescription('Role to assign')
              .setRequired(true))
          .addStringOption(option =>
            option.setName('emoji')
              .setDescription('Emoji for this role (unicode or custom)')
              .setRequired(true))
          .addStringOption(option =>
            option.setName('description')
              .setDescription('Description for this role option')
              .setRequired(false)
              .setMaxLength(100)))
      .addSubcommand(subcommand =>
        subcommand
          .setName('remove-role')
          .setDescription('Remove a role from an autorole message')
          .addStringOption(option =>
            option.setName('message_id')
              .setDescription('ID of the autorole message')
              .setRequired(true))
          .addRoleOption(option =>
            option.setName('role')
              .setDescription('Role to remove')
              .setRequired(true)))
      .addSubcommand(subcommand =>
        subcommand
          .setName('list')
          .setDescription('List all autorole messages in this server'))
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles);
  }

  /**
   * Execute autoroles command with subcommand routing
   * @param {CommandInteraction} interaction - Discord slash command interaction
   * @returns {Promise<void>}
   */
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'create':
        await this._handleCreate(interaction);
        break;
      case 'add-role':
        await this._handleAddRole(interaction);
        break;
      case 'remove-role':
        await this._handleRemoveRole(interaction);
        break;
      case 'list':
        await this._handleList(interaction);
        break;
      default:
        await interaction.reply({
          content: '❌ Unknown subcommand.',
          flags: [4] // MessageFlags.Ephemeral
        });
    }
  }

  /**
   * Handle create subcommand - create new autorole message
   * @private
   * @param {CommandInteraction} interaction - Discord interaction
   */
  async _handleCreate(interaction) {
    try {
      const title = interaction.options.getString('title');
      const description = interaction.options.getString('description');
      const channel = interaction.options.getChannel('channel') || interaction.channel;

      // Validate channel permissions
      if (!channel.permissionsFor(interaction.client.user).has(['SendMessages', 'AddReactions', 'ReadMessageHistory'])) {
        await interaction.editReply({
          content: '❌ I don\'t have permission to send messages and add reactions in that channel.'
        });
        return;
      }

      // Create the autorole message
      const autoRoleResult = await this.roleService.createAutoRoleMessage(
        interaction.guild.id,
        channel.id,
        interaction.user.id,
        title,
        description
      );

      // Send the actual Discord message using the embed
      const { EmbedBuilder } = require('discord.js');
      const embed = new EmbedBuilder()
        .setTitle(title || 'Role Assignment')
        .setDescription(description || 'React with an emoji to get the corresponding role!')
        .setColor(0x00AE86)
        .setFooter({ text: 'React to this message to get roles' })
        .setTimestamp();

      const discordMessage = await channel.send({ embeds: [embed] });

      // Update the autorole configuration with the real message ID
      const realMessageId = discordMessage.id;
      
      // Update the role service with the real message ID
      await this.roleService._updateMessageId(autoRoleResult.messageId, realMessageId);

      await interaction.editReply({
        content: `✅ **Autorole Message Created!**\n\n` +
                `**Message ID:** ${realMessageId}\n` +
                `**Channel:** <#${channel.id}>\n\n` +
                `Use \`/autoroles add-role\` with message ID \`${realMessageId}\` to add roles to this message.`
      });

      console.log(`Autorole message ${autoRoleResult.messageId} created by ${interaction.user.tag} (${interaction.user.id})`);

    } catch (error) {
      console.error('Error creating autorole message:', error);
      
      if (error.name === 'PermissionError') {
        await interaction.editReply({
          content: '❌ I don\'t have permission to create autorole messages in that channel.'
        });
      } else {
        await interaction.editReply({
          content: '❌ An error occurred while creating the autorole message.'
        });
      }
    }
  }

  /**
   * Handle add-role subcommand - add role to existing autorole message
   * @private
   * @param {CommandInteraction} interaction - Discord interaction
   */
  async _handleAddRole(interaction) {
    try {
      const messageId = interaction.options.getString('message_id');
      const role = interaction.options.getRole('role');
      const emoji = interaction.options.getString('emoji');
      const roleDescription = interaction.options.getString('description') || role.name;

      // Validate role hierarchy
      const botMember = interaction.guild.members.cache.get(interaction.client.user.id);
      if (role.position >= botMember.roles.highest.position) {
        await interaction.editReply({
          content: '❌ I cannot assign that role because it\'s higher than or equal to my highest role.'
        });
        return;
      }

      // Add role to autorole message
      const addResult = await this.roleService.addRoleToAutoRoleMessage(
        messageId,
        role.id,
        emoji,
        roleDescription
      );

      if (!addResult.success) {
        await interaction.editReply({
          content: `❌ **Failed to add role:** ${addResult.error}`
        });
        return;
      }

      // Find the Discord message and add the emoji reaction
      try {
        const channels = await interaction.guild.channels.fetch();
        let targetMessage = null;
        
        for (const channel of channels.values()) {
          if (channel.isTextBased()) {
            try {
              targetMessage = await channel.messages.fetch(messageId);
              break;
            } catch (error) {
              // Message not in this channel, continue searching
              continue;
            }
          }
        }

        if (targetMessage) {
          await targetMessage.react(emoji);
        }
      } catch (error) {
        console.error('Failed to add reaction to autorole message:', error);
        // Don't fail the command, just log the error
      }

      await interaction.editReply({
        content: `✅ **Role Added to Autorole Message!**\n\n` +
                `**Role:** ${role.name}\n` +
                `**Emoji:** ${emoji}\n` +
                `**Description:** ${roleDescription}\n\n` +
                `Users can now react with ${emoji} to get the ${role.name} role!`
      });

      console.log(`Role ${role.name} added to autorole message ${messageId} by ${interaction.user.tag} (${interaction.user.id})`);

    } catch (error) {
      console.error('Error adding role to autorole message:', error);
      
      if (error.name === 'ValidationError') {
        await interaction.editReply({
          content: `❌ ${error.message}`
        });
      } else if (error.name === 'NotFoundError') {
        await interaction.editReply({
          content: '❌ Autorole message not found. Please check the message ID.'
        });
      } else {
        await interaction.editReply({
          content: '❌ An error occurred while adding the role to the autorole message.'
        });
      }
    }
  }

  /**
   * Handle remove-role subcommand
   * @private
   * @param {CommandInteraction} interaction - Discord interaction
   */
  async _handleRemoveRole(interaction) {
    try {
      const messageId = interaction.options.getString('message_id');
      const role = interaction.options.getRole('role');

      // Remove role from autorole message
      const removeResult = await this.roleService.removeRoleFromAutoRoleMessage(
        messageId,
        role.id
      );

      if (!removeResult.success) {
        await interaction.editReply({
          content: `❌ **Failed to remove role:** ${removeResult.error}`
        });
        return;
      }

      // Find the Discord message and remove the emoji reaction
      try {
        const channels = await interaction.guild.channels.fetch();
        let targetMessage = null;
        
        for (const channel of channels.values()) {
          if (channel.isTextBased()) {
            try {
              targetMessage = await channel.messages.fetch(messageId);
              break;
            } catch (error) {
              // Message not in this channel, continue searching
              continue;
            }
          }
        }

        if (targetMessage && removeResult.emoji) {
          // Remove the bot's reaction for this emoji
          const reaction = targetMessage.reactions.cache.get(removeResult.emoji);
          if (reaction) {
            await reaction.users.remove(interaction.client.user);
          }
        }
      } catch (error) {
        console.error('Failed to remove reaction from autorole message:', error);
        // Don't fail the command, just log the error
      }

      await interaction.editReply({
        content: `✅ **Role Removed from Autorole Message!**\n\n` +
                `**Role:** ${role.name}\n` +
                `**Emoji:** ${removeResult.emoji || 'Unknown'}\n\n` +
                `The role mapping has been removed and the emoji reaction cleaned up.`
      });

      console.log(`Role ${role.name} removed from autorole message ${messageId} by ${interaction.user.tag} (${interaction.user.id})`);

    } catch (error) {
      console.error('Error removing role from autorole message:', error);
      
      if (error.name === 'NotFoundError') {
        await interaction.editReply({
          content: '❌ Autorole message or role mapping not found.'
        });
      } else {
        await interaction.editReply({
          content: '❌ An error occurred while removing the role from the autorole message.'
        });
      }
    }
  }

  /**
   * Handle list subcommand - show all autorole messages
   * @private
   * @param {CommandInteraction} interaction - Discord interaction
   */
  async _handleList(interaction) {
    try {
      const autoRoleMessages = await this.roleService.getAutoRoleMessages(interaction.guild.id);

      if (autoRoleMessages.length === 0) {
        await interaction.editReply({
          content: '📝 No autorole messages have been created in this server.\n\n' +
                  'Use `/autoroles create` to create your first autorole message.'
        });
        return;
      }

      // Create embed with autorole message list
      const embed = new EmbedBuilder()
        .setTitle('📋 Autorole Messages')
        .setColor(0x5865F2)
        .setTimestamp();

      let description = '';
      for (const message of autoRoleMessages) {
        const channel = interaction.guild.channels.cache.get(message.channelId);
        const channelMention = channel ? `<#${channel.id}>` : `Unknown Channel (${message.channelId})`;
        
        description += `**${message.title}**\n`;
        description += `Channel: ${channelMention}\n`;
        description += `Message ID: \`${message.messageId}\`\n`;
        description += `Roles: ${message.roles.length}\n`;
        description += `Created: <t:${Math.floor(new Date(message.createdAt).getTime() / 1000)}:R>\n\n`;
      }

      embed.setDescription(description);

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error listing autorole messages:', error);
      await interaction.editReply({
        content: '❌ An error occurred while fetching the autorole messages.'
      });
    }
  }

  /**
   * Custom permission validation for autoroles command
   * @param {CommandInteraction} interaction - Discord interaction
   * @returns {Promise<boolean>} Permission validation result
   */
  async validatePermissions(interaction) {
    // Check base permissions first
    const hasBasePermissions = await super.validatePermissions(interaction);
    if (!hasBasePermissions) {
      return false;
    }

    // Additional validation: ensure bot has permissions
    const botMember = interaction.guild.members.cache.get(interaction.client.user.id);
    const requiredPermissions = [
      PermissionFlagsBits.ManageRoles,
      PermissionFlagsBits.AddReactions,
      PermissionFlagsBits.ReadMessageHistory
    ];

    const hasPermissions = requiredPermissions.every(permission => 
      botMember.permissions.has(permission)
    );

    return hasPermissions;
  }
}

module.exports = AutorolesCommand;