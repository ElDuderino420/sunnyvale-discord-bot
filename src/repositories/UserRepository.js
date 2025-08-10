const BaseRepository = require('./BaseRepository');
const User = require('../entities/User');

/**
 * Repository for User entity data persistence
 * Handles user-specific database operations with User entity integration
 * @class UserRepository
 * @extends {BaseRepository}
 * @example
 * const userRepo = new UserRepository(dbManager);
 * const user = await userRepo.findById('123456789');
 * await userRepo.updateUser(user);
 */
class UserRepository extends BaseRepository {
  /**
   * Initialize user repository
   * @param {DatabaseManager} dbManager - Database connection manager
   */
  constructor(dbManager) {
    super(dbManager, 'users');
  }

  /**
   * Find user by Discord ID and return User entity
   * @param {string} userId - Discord user ID
   * @returns {Promise<User|null>} User entity or null if not found
   * @throws {Error} When database operation fails
   * @example
   * const user = await userRepo.findUserById('123456789');
   * if (user) {
   *   console.log(`Found user: ${user.tag}`);
   * }
   */
  async findUserById(userId) {
    try {
      const userData = await this.findById(userId);
      return userData ? User.fromDatabase(userData) : null;
    } catch (error) {
      throw new Error(`Failed to find user by ID: ${error.message}`);
    }
  }

  /**
   * Create or update user record
   * @param {User} user - User entity to save
   * @returns {Promise<User>} Saved user entity
   * @throws {Error} When save operation fails
   * @example
   * const user = new User('123456789', 'username#1234');
   * const savedUser = await userRepo.saveUser(user);
   */
  async saveUser(user) {
    try {
      if (!(user instanceof User)) {
        throw new Error('Parameter must be a User entity');
      }

      const userData = user.toDatabase();
      const exists = await this.exists(user.id);

      if (exists) {
        await this.updateById(user.id, userData);
      } else {
        await this.create(userData);
      }

      return user;
    } catch (error) {
      throw new Error(`Failed to save user: ${error.message}`);
    }
  }

  /**
   * Find users with recent moderation actions
   * @param {number} hours - Hours to look back
   * @param {string} [actionType] - Specific action type to filter
   * @param {number} [minCount=1] - Minimum action count
   * @returns {Promise<Array<User>>} Users with recent actions
   * @throws {Error} When query fails
   * @example
   * const recentWarnings = await userRepo.findUsersWithRecentActions(24, 'warn', 2);
   * console.log(`${recentWarnings.length} users with multiple recent warnings`);
   */
  async findUsersWithRecentActions(hours, actionType = null, minCount = 1) {
    try {
      const cutoffTime = new Date(Date.now() - (hours * 60 * 60 * 1000));
      
      // Get all users (we'll filter in memory due to NeDB limitations)
      const allUsers = await this.findMany({});
      const matchingUsers = [];

      for (const userData of allUsers) {
        const user = User.fromDatabase(userData);
        const recentCount = user.getRecentActionsCount(hours, actionType);
        
        if (recentCount >= minCount) {
          matchingUsers.push(user);
        }
      }

      return matchingUsers;
    } catch (error) {
      throw new Error(`Failed to find users with recent actions: ${error.message}`);
    }
  }

  /**
   * Find users currently in jail (have stored original roles)
   * @returns {Promise<Array<User>>} Jailed users
   * @throws {Error} When query fails
   * @example
   * const jailedUsers = await userRepo.findJailedUsers();
   * console.log(`${jailedUsers.length} users currently in jail`);
   */
  async findJailedUsers() {
    try {
      // Find users with non-empty originalRoles array
      const userData = await this.findMany({
        'originalRoles.0': { '$exists': true }
      });

      return userData.map(data => User.fromDatabase(data));
    } catch (error) {
      throw new Error(`Failed to find jailed users: ${error.message}`);
    }
  }

  /**
   * Find users with persistent roles to restore
   * @returns {Promise<Array<User>>} Users with persistent roles
   * @throws {Error} When query fails
   * @example
   * const usersToRestore = await userRepo.findUsersWithPersistentRoles();
   * for (const user of usersToRestore) {
   *   console.log(`User ${user.tag} has roles to restore`);
   * }
   */
  async findUsersWithPersistentRoles() {
    try {
      // Find users with non-empty persistentRoles array
      const userData = await this.findMany({
        'persistentRoles.0': { '$exists': true }
      });

      return userData.map(data => User.fromDatabase(data));
    } catch (error) {
      throw new Error(`Failed to find users with persistent roles: ${error.message}`);
    }
  }

  /**
   * Get moderation statistics for all users
   * @param {number} [days=30] - Days to include in statistics
   * @returns {Promise<Object>} Moderation statistics summary
   * @throws {Error} When statistics calculation fails
   * @example
   * const stats = await userRepo.getModerationStatistics(7);
   * console.log(`${stats.totalActions} actions in the last week`);
   */
  async getModerationStatistics(days = 30) {
    try {
      const cutoffTime = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
      const allUsers = await this.findMany({});
      
      const stats = {
        totalUsers: allUsers.length,
        usersWithActions: 0,
        totalActions: 0,
        actionsByType: {
          warn: 0,
          kick: 0,
          ban: 0,
          tempban: 0,
          jail: 0,
          mute: 0
        },
        recentActions: 0,
        jailedUsers: 0,
        usersWithPersistentRoles: 0
      };

      for (const userData of allUsers) {
        const user = User.fromDatabase(userData);
        const userStats = user.getModerationStats();
        
        if (userStats.total > 0) {
          stats.usersWithActions++;
          stats.totalActions += userStats.total;
          
          // Add to action type counts
          for (const [actionType, count] of Object.entries(userStats)) {
            if (actionType !== 'total' && stats.actionsByType.hasOwnProperty(actionType)) {
              stats.actionsByType[actionType] += count;
            }
          }
        }

        // Count recent actions
        const recentActions = user.getModerationHistory().filter(action => 
          new Date(action.timestamp) >= cutoffTime
        );
        stats.recentActions += recentActions.length;

        // Count special states
        if (user.isJailed()) {
          stats.jailedUsers++;
        }
        
        if (user.hasPersistentRoles()) {
          stats.usersWithPersistentRoles++;
        }
      }

      return stats;
    } catch (error) {
      throw new Error(`Failed to calculate moderation statistics: ${error.message}`);
    }
  }

  /**
   * Find users by moderation action count
   * @param {string} actionType - Action type to count
   * @param {number} minCount - Minimum action count
   * @param {number} [days] - Days to look back (all time if not specified)
   * @returns {Promise<Array<{user: User, count: number}>>} Users with action counts
   * @throws {Error} When query fails
   * @example
   * const frequentOffenders = await userRepo.findUsersByActionCount('warn', 5, 30);
   * for (const {user, count} of frequentOffenders) {
   *   console.log(`${user.tag}: ${count} warnings in 30 days`);
   * }
   */
  async findUsersByActionCount(actionType, minCount, days = null) {
    try {
      const allUsers = await this.findMany({});
      const results = [];

      for (const userData of allUsers) {
        const user = User.fromDatabase(userData);
        const count = days 
          ? user.getRecentActionsCount(days * 24, actionType)
          : user.getModerationStats()[actionType] || 0;

        if (count >= minCount) {
          results.push({ user, count });
        }
      }

      // Sort by count descending
      results.sort((a, b) => b.count - a.count);

      return results;
    } catch (error) {
      throw new Error(`Failed to find users by action count: ${error.message}`);
    }
  }

  /**
   * Clean up old user records with no recent activity
   * @param {number} days - Days of inactivity before cleanup
   * @param {boolean} [dryRun=true] - Whether to actually delete or just return count
   * @returns {Promise<number>} Number of records that would be/were cleaned up
   * @throws {Error} When cleanup fails
   * @example
   * const cleanupCount = await userRepo.cleanupInactiveUsers(365, false);
   * console.log(`Cleaned up ${cleanupCount} inactive user records`);
   */
  async cleanupInactiveUsers(days, dryRun = true) {
    try {
      const cutoffTime = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
      const allUsers = await this.findMany({});
      let cleanupCount = 0;

      for (const userData of allUsers) {
        const user = User.fromDatabase(userData);
        
        // Keep users who are jailed, have persistent roles, or have recent activity
        if (user.isJailed() || user.hasPersistentRoles()) {
          continue;
        }

        const hasRecentActivity = user.updatedAt > cutoffTime || 
          user.getModerationHistory().some(action => 
            new Date(action.timestamp) > cutoffTime
          );

        if (!hasRecentActivity) {
          if (!dryRun) {
            await this.deleteById(user.id);
          }
          cleanupCount++;
        }
      }

      return cleanupCount;
    } catch (error) {
      throw new Error(`Failed to cleanup inactive users: ${error.message}`);
    }
  }

  /**
   * Backup user data to JSON format
   * @param {Array<string>} [userIds] - Specific user IDs to backup (all if not specified)
   * @returns {Promise<Object>} Backup data object
   * @throws {Error} When backup fails
   * @example
   * const backup = await userRepo.backupUserData(['123456789']);
   * await fs.writeFile('user-backup.json', JSON.stringify(backup, null, 2));
   */
  async backupUserData(userIds = null) {
    try {
      let query = {};
      if (userIds && Array.isArray(userIds)) {
        query = { _id: { $in: userIds } };
      }

      const userData = await this.findMany(query);
      
      return {
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        userCount: userData.length,
        users: userData
      };
    } catch (error) {
      throw new Error(`Failed to backup user data: ${error.message}`);
    }
  }

  /**
   * Restore user data from backup
   * @param {Object} backupData - Backup data object
   * @param {boolean} [overwrite=false] - Whether to overwrite existing users
   * @returns {Promise<{imported: number, skipped: number, errors: Array}>} Import results
   * @throws {Error} When restore fails
   * @example
   * const backup = JSON.parse(await fs.readFile('user-backup.json'));
   * const result = await userRepo.restoreUserData(backup, true);
   * console.log(`Imported ${result.imported} users, skipped ${result.skipped}`);
   */
  async restoreUserData(backupData, overwrite = false) {
    try {
      if (!backupData || !backupData.users || !Array.isArray(backupData.users)) {
        throw new Error('Invalid backup data format');
      }

      const results = {
        imported: 0,
        skipped: 0,
        errors: []
      };

      for (const userData of backupData.users) {
        try {
          const exists = await this.exists(userData._id);
          
          if (exists && !overwrite) {
            results.skipped++;
            continue;
          }

          // Validate user data by creating User entity
          const user = User.fromDatabase(userData);
          
          if (exists) {
            await this.updateById(userData._id, userData);
          } else {
            await this.create(userData);
          }
          
          results.imported++;
        } catch (error) {
          results.errors.push({
            userId: userData._id,
            error: error.message
          });
        }
      }

      return results;
    } catch (error) {
      throw new Error(`Failed to restore user data: ${error.message}`);
    }
  }
}

module.exports = UserRepository;