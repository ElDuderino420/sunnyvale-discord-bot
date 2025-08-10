export = BaseRepository;
/**
 * Abstract base class for all database repositories
 * Provides common database operations with error handling and validation
 * @abstract
 * @class BaseRepository
 * @example
 * class UserRepository extends BaseRepository {
 *   constructor(dbManager) {
 *     super(dbManager, 'users');
 *   }
 * }
 */
declare class BaseRepository {
    /**
     * Initialize repository with database connection
     * @param {DatabaseManager} dbManager - Database connection manager
     * @param {string} collectionName - NeDB collection name
     * @throws {Error} When dbManager is null or collectionName is invalid
     */
    constructor(dbManager: DatabaseManager, collectionName: string);
    /**
     * Database manager instance
     * @type {DatabaseManager}
     * @protected
     */
    protected _dbManager: DatabaseManager;
    /**
     * Collection name for this repository
     * @type {string}
     * @protected
     */
    protected _collectionName: string;
    /**
     * Database connection (lazy-loaded)
     * @type {Datastore|null}
     * @private
     */
    private _database;
    /**
     * Get database connection (lazy initialization)
     * @protected
     * @returns {Datastore} Database connection
     * @throws {Error} When database manager not initialized
     */
    protected _getDatabase(): Datastore;
    /**
     * Find document by ID with comprehensive error handling
     * @param {string} id - Document identifier
     * @returns {Promise<Object|null>} Found document or null
     * @throws {Error} When database operation fails
     * @example
     * const user = await userRepo.findById('123456789');
     * if (user) {
     *   console.log('User found:', user.username);
     * }
     */
    findById(id: string): Promise<any | null>;
    /**
     * Find multiple documents by query
     * @param {Object} query - Query object for filtering
     * @param {Object} [options={}] - Query options (sort, limit, skip)
     * @returns {Promise<Array<Object>>} Array of matching documents
     * @throws {Error} When database operation fails
     * @example
     * const activeUsers = await userRepo.findMany(
     *   { status: 'active' },
     *   { sort: { lastLogin: -1 }, limit: 10 }
     * );
     */
    findMany(query?: any, options?: any): Promise<Array<any>>;
    /**
     * Find single document by query
     * @param {Object} query - Query object for filtering
     * @returns {Promise<Object|null>} First matching document or null
     * @throws {Error} When database operation fails
     * @example
     * const user = await userRepo.findOne({ username: 'john_doe' });
     */
    findOne(query: any): Promise<any | null>;
    /**
     * Create new document with validation
     * @param {Object} data - Document data to create
     * @returns {Promise<Object>} Created document with generated ID
     * @throws {Error} When data validation fails or creation fails
     * @example
     * const newUser = await userRepo.create({
     *   username: 'jane_doe',
     *   email: 'jane@example.com',
     *   createdAt: new Date()
     * });
     */
    create(data: any): Promise<any>;
    /**
     * Update document by ID
     * @param {string} id - Document ID to update
     * @param {Object} updates - Fields to update
     * @param {Object} [options={}] - Update options
     * @returns {Promise<Object|null>} Updated document or null if not found
     * @throws {Error} When update operation fails
     * @example
     * const updatedUser = await userRepo.updateById('123', {
     *   lastLogin: new Date(),
     *   status: 'active'
     * });
     */
    updateById(id: string, updates: any, options?: any): Promise<any | null>;
    /**
     * Update multiple documents by query
     * @param {Object} query - Query to match documents
     * @param {Object} updates - Fields to update
     * @param {Object} [options={}] - Update options
     * @returns {Promise<number>} Number of documents updated
     * @throws {Error} When update operation fails
     * @example
     * const count = await userRepo.updateMany(
     *   { status: 'inactive' },
     *   { lastNotification: new Date() }
     * );
     */
    updateMany(query: any, updates: any, options?: any): Promise<number>;
    /**
     * Delete document by ID
     * @param {string} id - Document ID to delete
     * @returns {Promise<boolean>} True if document was deleted, false if not found
     * @throws {Error} When delete operation fails
     * @example
     * const deleted = await userRepo.deleteById('123456789');
     * if (deleted) {
     *   console.log('User deleted successfully');
     * }
     */
    deleteById(id: string): Promise<boolean>;
    /**
     * Delete multiple documents by query
     * @param {Object} query - Query to match documents for deletion
     * @returns {Promise<number>} Number of documents deleted
     * @throws {Error} When delete operation fails
     * @example
     * const count = await userRepo.deleteMany({ status: 'inactive' });
     */
    deleteMany(query: any): Promise<number>;
    /**
     * Count documents matching query
     * @param {Object} [query={}] - Query to match documents
     * @returns {Promise<number>} Number of matching documents
     * @throws {Error} When count operation fails
     * @example
     * const activeUserCount = await userRepo.count({ status: 'active' });
     */
    count(query?: any): Promise<number>;
    /**
     * Check if document exists by ID
     * @param {string} id - Document ID to check
     * @returns {Promise<boolean>} True if document exists
     * @throws {Error} When existence check fails
     * @example
     * const exists = await userRepo.exists('123456789');
     */
    exists(id: string): Promise<boolean>;
    /**
     * Get repository collection name
     * @returns {string} Collection name
     */
    get collectionName(): string;
    /**
     * Get database manager instance
     * @protected
     * @returns {DatabaseManager} Database manager
     */
    protected get dbManager(): DatabaseManager;
}
//# sourceMappingURL=BaseRepository.d.ts.map