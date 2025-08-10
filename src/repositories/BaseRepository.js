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
class BaseRepository {
  /**
   * Initialize repository with database connection
   * @param {DatabaseManager} dbManager - Database connection manager
   * @param {string} collectionName - NeDB collection name
   * @throws {Error} When dbManager is null or collectionName is invalid
   */
  constructor(dbManager, collectionName) {
    if (this.constructor === BaseRepository) {
      throw new Error('Cannot instantiate abstract class BaseRepository');
    }
    
    if (!dbManager) {
      throw new Error('DatabaseManager is required');
    }
    
    if (!collectionName || typeof collectionName !== 'string') {
      throw new Error('Collection name must be a non-empty string');
    }

    /**
     * Database manager instance
     * @type {DatabaseManager}
     * @protected
     */
    this._dbManager = dbManager;
    
    /**
     * Collection name for this repository
     * @type {string}
     * @protected
     */
    this._collectionName = collectionName;
    
    /**
     * Database connection (lazy-loaded)
     * @type {Datastore|null}
     * @private
     */
    this._database = null;
  }

  /**
   * Get database connection (lazy initialization)
   * @protected
   * @returns {Datastore} Database connection
   * @throws {Error} When database manager not initialized
   */
  _getDatabase() {
    if (!this._database) {
      this._database = this._dbManager.getDatabase(this._collectionName);
    }
    return this._database;
  }

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
  async findById(id) {
    try {
      if (!id || typeof id !== 'string') {
        throw new Error('ID must be a non-empty string');
      }

      const database = this._getDatabase();
      const document = await database.findOne({ _id: id });
      
      return document;
    } catch (error) {
      throw new Error(`Failed to find document by ID '${id}': ${error.message}`);
    }
  }

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
  async findMany(query = {}, options = {}) {
    try {
      const database = this._getDatabase();
      let cursor = database.find(query);
      
      // Apply options
      if (options.sort) {
        cursor = cursor.sort(options.sort);
      }
      if (options.limit) {
        cursor = cursor.limit(options.limit);
      }
      if (options.skip) {
        cursor = cursor.skip(options.skip);
      }
      
      const documents = await cursor.exec();
      return documents || [];
    } catch (error) {
      throw new Error(`Failed to find documents: ${error.message}`);
    }
  }

  /**
   * Find single document by query
   * @param {Object} query - Query object for filtering
   * @returns {Promise<Object|null>} First matching document or null
   * @throws {Error} When database operation fails
   * @example
   * const user = await userRepo.findOne({ username: 'john_doe' });
   */
  async findOne(query) {
    try {
      const database = this._getDatabase();
      const document = await database.findOne(query);
      
      return document;
    } catch (error) {
      throw new Error(`Failed to find document: ${error.message}`);
    }
  }

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
  async create(data) {
    try {
      if (!data || typeof data !== 'object') {
        throw new Error('Data must be a valid object');
      }

      // Validate document against schema
      this._dbManager.validateDocument(this._collectionName, data);
      
      // Add timestamp if not present
      if (!data.createdAt) {
        data.createdAt = new Date();
      }
      
      const database = this._getDatabase();
      const document = await database.insert(data);
      
      return document;
    } catch (error) {
      throw new Error(`Failed to create document: ${error.message}`);
    }
  }

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
  async updateById(id, updates, options = {}) {
    try {
      if (!id || typeof id !== 'string') {
        throw new Error('ID must be a non-empty string');
      }
      
      if (!updates || typeof updates !== 'object') {
        throw new Error('Updates must be a valid object');
      }

      // Add update timestamp
      updates.updatedAt = new Date();
      
      const database = this._getDatabase();
      const numUpdated = await database.update(
        { _id: id },
        { $set: updates },
        { ...options, returnUpdatedDocs: false }
      );
      
      if (numUpdated === 0) {
        return null; // Document not found
      }
      
      // Return updated document if requested
      if (options.returnUpdatedDocs !== false) {
        return await this.findById(id);
      }
      
      return { _id: id, ...updates };
    } catch (error) {
      throw new Error(`Failed to update document '${id}': ${error.message}`);
    }
  }

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
  async updateMany(query, updates, options = {}) {
    try {
      if (!updates || typeof updates !== 'object') {
        throw new Error('Updates must be a valid object');
      }

      // Add update timestamp
      updates.updatedAt = new Date();
      
      const database = this._getDatabase();
      const numUpdated = await database.update(
        query,
        { $set: updates },
        { ...options, multi: true }
      );
      
      return numUpdated;
    } catch (error) {
      throw new Error(`Failed to update documents: ${error.message}`);
    }
  }

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
  async deleteById(id) {
    try {
      if (!id || typeof id !== 'string') {
        throw new Error('ID must be a non-empty string');
      }

      const database = this._getDatabase();
      const numDeleted = await database.remove({ _id: id }, {});
      
      return numDeleted > 0;
    } catch (error) {
      throw new Error(`Failed to delete document '${id}': ${error.message}`);
    }
  }

  /**
   * Delete multiple documents by query
   * @param {Object} query - Query to match documents for deletion
   * @returns {Promise<number>} Number of documents deleted
   * @throws {Error} When delete operation fails
   * @example
   * const count = await userRepo.deleteMany({ status: 'inactive' });
   */
  async deleteMany(query) {
    try {
      const database = this._getDatabase();
      const numDeleted = await database.remove(query, { multi: true });
      
      return numDeleted;
    } catch (error) {
      throw new Error(`Failed to delete documents: ${error.message}`);
    }
  }

  /**
   * Count documents matching query
   * @param {Object} [query={}] - Query to match documents
   * @returns {Promise<number>} Number of matching documents
   * @throws {Error} When count operation fails
   * @example
   * const activeUserCount = await userRepo.count({ status: 'active' });
   */
  async count(query = {}) {
    try {
      const database = this._getDatabase();
      const count = await database.count(query);
      
      return count;
    } catch (error) {
      throw new Error(`Failed to count documents: ${error.message}`);
    }
  }

  /**
   * Check if document exists by ID
   * @param {string} id - Document ID to check
   * @returns {Promise<boolean>} True if document exists
   * @throws {Error} When existence check fails
   * @example
   * const exists = await userRepo.exists('123456789');
   */
  async exists(id) {
    try {
      const document = await this.findById(id);
      return document !== null;
    } catch (error) {
      throw new Error(`Failed to check document existence '${id}': ${error.message}`);
    }
  }

  /**
   * Get repository collection name
   * @returns {string} Collection name
   */
  get collectionName() {
    return this._collectionName;
  }

  /**
   * Get database manager instance
   * @protected
   * @returns {DatabaseManager} Database manager
   */
  get dbManager() {
    return this._dbManager;
  }
}

module.exports = BaseRepository;