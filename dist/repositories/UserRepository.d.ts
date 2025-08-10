export = UserRepository;
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
declare class UserRepository extends BaseRepository {
    /**
     * Initialize user repository
     * @param {DatabaseManager} dbManager - Database connection manager
     */
    constructor(dbManager: DatabaseManager);
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
    findUserById(userId: string): Promise<User | null>;
    /**
     * Create or update user record
     * @param {User} user - User entity to save
     * @returns {Promise<User>} Saved user entity
     * @throws {Error} When save operation fails
     * @example
     * const user = new User('123456789', 'username#1234');
     * const savedUser = await userRepo.saveUser(user);
     */
    saveUser(user: User): Promise<User>;
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
    findUsersWithRecentActions(hours: number, actionType?: string, minCount?: number): Promise<Array<User>>;
    /**
     * Find users currently in jail (have stored original roles)
     * @returns {Promise<Array<User>>} Jailed users
     * @throws {Error} When query fails
     * @example
     * const jailedUsers = await userRepo.findJailedUsers();
     * console.log(`${jailedUsers.length} users currently in jail`);
     */
    findJailedUsers(): Promise<Array<User>>;
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
    findUsersWithPersistentRoles(): Promise<Array<User>>;
    /**
     * Get moderation statistics for all users
     * @param {number} [days=30] - Days to include in statistics
     * @returns {Promise<Object>} Moderation statistics summary
     * @throws {Error} When statistics calculation fails
     * @example
     * const stats = await userRepo.getModerationStatistics(7);
     * console.log(`${stats.totalActions} actions in the last week`);
     */
    getModerationStatistics(days?: number): Promise<any>;
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
    findUsersByActionCount(actionType: string, minCount: number, days?: number): Promise<Array<{
        user: User;
        count: number;
    }>>;
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
    cleanupInactiveUsers(days: number, dryRun?: boolean): Promise<number>;
    /**
     * Backup user data to JSON format
     * @param {Array<string>} [userIds] - Specific user IDs to backup (all if not specified)
     * @returns {Promise<Object>} Backup data object
     * @throws {Error} When backup fails
     * @example
     * const backup = await userRepo.backupUserData(['123456789']);
     * await fs.writeFile('user-backup.json', JSON.stringify(backup, null, 2));
     */
    backupUserData(userIds?: Array<string>): Promise<any>;
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
    restoreUserData(backupData: any, overwrite?: boolean): Promise<{
        imported: number;
        skipped: number;
        errors: any[];
    }>;
}
import BaseRepository = require("./BaseRepository");
import User = require("../entities/User");
//# sourceMappingURL=UserRepository.d.ts.map