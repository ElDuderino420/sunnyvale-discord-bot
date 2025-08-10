const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const BaseCommand = require('../BaseCommand');

/**
 * Unjail command for releasing users from jail and restoring their roles
 * Implements role restoration with comprehensive error handling
 * @class UnjailCommand
 * @extends BaseCommand
 */
class UnjailCommand extends BaseCommand {
  /**
   * Initialize unjail command with moderation service dependency
   * @param {ModerationService} moderationService - Service for moderation operations
   * @param {ConfigRepository} configRepository - Repository for server configuration
   */
  constructor(moderationService, configRepository) {
    super();
    this.moderationService = moderationService;
    this.configRepository = configRepository;
    this._category = 'moderation';
    this._requiredRoles = ['moderation']; // Ensure BaseCommand defers interaction (validated dynamically)
    this._cooldown = 3000;
  }

  /**
   * Command metadata for Discord registration
   * @returns {SlashCommandBuilder} Discord slash command data
   */
  get data() {
    return new SlashCommandBuilder()
      .setName('unjail')
      .setDescription('Release a user from jail and restore their roles')
      .addUserOption(option =>
        option.setName('target')
          .setDescription('The user to unjail')
          .setRequired(true))
      .addStringOption(option =>
        option.setName('reason')
          .setDescription('Reason for unjailing the user')
          .setRequired(false)
          .setMaxLength(500))
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles);
  }

  /**
   * Execute unjail command with role restoration
   * @param {CommandInteraction} interaction - Discord slash command interaction
   * @returns {Promise<void>}
   */
  async execute(interaction) {
    try {
      // Get command parameters
      const target = interaction.options.getUser('target');
      const reason = interaction.options.getString('reason') || 'No reason provided';
      const executor = interaction.member;

      // Get target member object
      const targetMember = await interaction.guild.members.fetch(target.id).catch(() => null);
      
      if (!targetMember) {
        await interaction.editReply({
          content: `❌ User ${target.tag} is not a member of this server.`
        });
        return;
      }

      // Check if user is actually jailed
      const isJailed = await this.moderationService.isUserJailed(interaction.guild.id, target.id);
      if (!isJailed) {
        await interaction.editReply({
          content: `❌ User ${target.tag} is not currently jailed.`
        });
        return;
      }

      // Execute unjail operation in database to get original roles
      const unjailResult = await this.moderationService.unjailUser(
        interaction.guild.id,
        executor.id,
        target.id,
        reason
      );

      // Restore original roles in Discord
      const originalRoleIds = unjailResult.originalRoles;
      const validRoles = [];
      const warnings = [];

      // Validate roles still exist and bot can assign them
      for (const roleId of originalRoleIds) {
        const role = interaction.guild.roles.cache.get(roleId);
        if (!role) {
          warnings.push(`Role no longer exists (${roleId})`);
        } else if (role.managed) {
          warnings.push(`Cannot restore managed role: ${role.name}`);
        } else if (role.position >= interaction.guild.members.me.roles.highest.position) {
          warnings.push(`Cannot restore higher role: ${role.name}`);
        } else {
          validRoles.push(role);
        }
      }

      // Perform Discord role restoration
      try {
        if (validRoles.length > 0) {
          await targetMember.roles.set(validRoles, `Unjailed by ${executor.user.tag}: ${reason}`);
        } else {
          // If no roles to restore, just remove jail role
          const server = await this.configRepository.findServerById(interaction.guild.id);
          const jailedRoleId = server?.getJailedRole();
          if (jailedRoleId) {
            const jailRole = interaction.guild.roles.cache.get(jailedRoleId);
            if (jailRole && targetMember.roles.cache.has(jailedRoleId)) {
              await targetMember.roles.remove(jailRole, `Unjailed by ${executor.user.tag}: ${reason}`);
            }
          }
        }
      } catch (error) {
        await interaction.editReply({
          content: `❌ Failed to restore roles: ${error.message}. User has been removed from jail database but roles may need manual restoration.`
        });
        return;
      }

      // Update result with actual restoration details
      unjailResult.rolesRestored = validRoles.length;
      unjailResult.warnings = warnings;

      // Format response based on results
      let roleRestoreText = '';
      if (unjailResult.rolesRestored > 0) {
        roleRestoreText = `\n**Roles restored:** ${unjailResult.rolesRestored} role(s)`;
      } else {
        roleRestoreText = '\n**Note:** No roles were restored (user may have had no roles when jailed)';
      }

      // Handle partial restoration warnings
      let warningText = '';
      if (unjailResult.warnings && unjailResult.warnings.length > 0) {
        warningText = `\n⚠️ **Warnings:** ${unjailResult.warnings.join(', ')}`;
      }

      // Send success response
      await interaction.editReply({
        content: `🔓 Successfully unjailed ${target.tag}\n` +
                `**Reason:** ${reason}\n` +
                `**Case ID:** ${unjailResult.caseId}\n` +
                `**Moderator:** ${executor.user.tag}${roleRestoreText}${warningText}`
      });

      // Log the action (handled by ModerationService)
      console.log(`User ${target.tag} (${target.id}) unjailed by ${executor.user.tag} (${executor.id}) - Reason: ${reason}`);

    } catch (error) {
      console.error('Error executing unjail command:', error);
      
      // Handle specific error types
      if (error.name === 'PermissionError') {
        await interaction.editReply({
          content: '❌ I don\'t have permission to manage this user\'s roles. Please check my role hierarchy and permissions.'
        });
      } else if (error.name === 'ValidationError') {
        await interaction.editReply({
          content: `❌ ${error.message}`
        });
      } else if (error.name === 'ConfigurationError') {
        await interaction.editReply({
          content: '❌ Jail system is not properly configured. Please contact an administrator to set up the jail channel and role.'
        });
      } else if (error.name === 'DataCorruptionError') {
        await interaction.editReply({
          content: '❌ Unable to restore user roles due to data corruption. The user has been removed from jail, but roles must be manually restored.'
        });
      } else {
        await interaction.editReply({
          content: '❌ An error occurred while unjailing the user. Please try again later.'
        });
      }
    }
  }

  /**
   * Custom permission validation for unjail command
   * Uses dynamic moderator role from database configuration
   * @param {CommandInteraction} interaction - Discord interaction
   * @returns {Promise<boolean>} Permission validation result
   */
  async validatePermissions(interaction) {
    try {
      // Check if user is in a guild
      if (!interaction.guild) {
        return false;
      }

      // Get server configuration to find moderator role
      const server = await this.configRepository.findServerById(interaction.guild.id);
      if (!server) {
        return false; // No server configuration means no moderator role set
      }

      const moderatorRoleId = server.getModeratorRole();
      if (!moderatorRoleId) {
        return false; // No moderator role configured
      }

      // Check if user has the configured moderator role
      const member = interaction.guild.members.cache.get(interaction.user.id);
      if (!member) {
        return false;
      }

      const hasModeratorRole = member.roles.cache.has(moderatorRoleId);
      if (!hasModeratorRole) {
        return false;
      }

      // Additional validation: ensure bot has permissions
      const botMember = interaction.guild.members.cache.get(interaction.client.user.id);
      if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error validating unjail command permissions:', error);
      return false;
    }
  }
}

module.exports = UnjailCommand;