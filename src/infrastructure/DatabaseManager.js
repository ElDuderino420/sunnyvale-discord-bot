const Datastore = require('nedb-promises');
const path = require('path');
const fs = require('fs').promises;

/**
 * Database manager for NeDB operations with OOP support
 * Handles database connections, schema validation, and class serialization
 * @class DatabaseManager
 * @example
 * const dbManager = new DatabaseManager('./data');
 * await dbManager.initialize();
 * const usersDb = dbManager.getDatabase('users');
 */
class DatabaseManager {
  /**
   * Initialize database manager with data directory
   * @param {string} dataPath - Path to database directory
   */
  constructor(dataPath = './data') {
    /**
     * Path to database files
     * @type {string}
     * @private
     */
    this._dataPath = dataPath;
    
    /**
     * Database connections storage
     * @type {Map<string, Datastore>}
     * @private
     */
    this._databases = new Map();
    
    /**
     * Database schemas for validation
     * @type {Map<string, Object>}
     * @private
     */
    this._schemas = new Map();
    
    /**
     * Initialization status
     * @type {boolean}
     * @private
     */
    this._initialized = false;
  }

  /**
   * Initialize database manager and create required databases
   * @returns {Promise<void>}
   * @throws {Error} When database initialization fails
   */
  async initialize() {
    try {
      // Ensure data directory exists
      await fs.mkdir(this._dataPath, { recursive: true });
      
      // Initialize core databases
      await this._createDatabase('config', this._getConfigSchema());
      await this._createDatabase('servers', this._getServerSchema());
      await this._createDatabase('users', this._getUserSchema());
      await this._createDatabase('tickets', this._getTicketSchema());
      await this._createDatabase('templates', this._getTemplateSchema());
      
      this._initialized = true;
      console.log(`DatabaseManager initialized with ${this._databases.size} databases`);
    } catch (error) {
      throw new Error(`Failed to initialize DatabaseManager: ${error.message}`);
    }
  }

  /**
   * Get database connection by name
   * @param {string} name - Database name
   * @returns {Datastore} Database connection
   * @throws {Error} When database not found or not initialized
   */
  getDatabase(name) {
    if (!this._initialized) {
      throw new Error('DatabaseManager not initialized. Call initialize() first.');
    }
    
    const database = this._databases.get(name);
    if (!database) {
      throw new Error(`Database '${name}' not found. Available: ${Array.from(this._databases.keys()).join(', ')}`);
    }
    
    return database;
  }

  /**
   * Create database connection with schema
   * @private
   * @param {string} name - Database name
   * @param {Object} schema - Database schema definition
   * @returns {Promise<void>}
   */
  async _createDatabase(name, schema) {
    const dbPath = path.join(this._dataPath, `${name}.db`);
    const database = Datastore.create(dbPath);
    
    // Store database and schema
    this._databases.set(name, database);
    this._schemas.set(name, schema);
    
    // Create indexes if specified in schema
    if (schema.indexes) {
      for (const index of schema.indexes) {
        await database.ensureIndex(index);
      }
    }
  }

  /**
   * Validate document against database schema
   * @param {string} databaseName - Target database name
   * @param {Object} document - Document to validate
   * @returns {boolean} Validation result
   * @throws {ValidationError} When validation fails
   */
  validateDocument(databaseName, document) {
    const schema = this._schemas.get(databaseName);
    if (!schema) {
      throw new Error(`Schema not found for database: ${databaseName}`);
    }

    // Basic validation - can be extended with more sophisticated validation
    const requiredFields = schema.required || [];
    for (const field of requiredFields) {
      if (!(field in document)) {
        throw new Error(`Required field '${field}' missing from document`);
      }
    }

    return true;
  }

  /**
   * Serialize class instance for database storage
   * @param {Object} instance - Class instance to serialize
   * @returns {Object} Serialized data suitable for database storage
   */
  serializeInstance(instance) {
    if (!instance || typeof instance !== 'object') {
      return instance;
    }

    const serialized = {
      _className: instance.constructor.name,
      _data: {}
    };

    // Serialize all enumerable properties
    for (const [key, value] of Object.entries(instance)) {
      if (!key.startsWith('_')) { // Skip private properties
        serialized._data[key] = this._serializeValue(value);
      }
    }

    return serialized;
  }

  /**
   * Deserialize database document back to class instance
   * @param {Object} document - Database document to deserialize
   * @param {Map<string, Function>} classRegistry - Available class constructors
   * @returns {Object} Deserialized class instance or plain object
   */
  deserializeInstance(document, classRegistry = new Map()) {
    if (!document || typeof document !== 'object' || !document._className) {
      return document;
    }

    const Constructor = classRegistry.get(document._className);
    if (!Constructor) {
      console.warn(`Class '${document._className}' not found in registry, returning plain object`);
      return document._data;
    }

    // Create instance and populate data
    const instance = Object.create(Constructor.prototype);
    for (const [key, value] of Object.entries(document._data)) {
      instance[key] = this._deserializeValue(value, classRegistry);
    }

    return instance;
  }

  /**
   * Recursively serialize nested values
   * @private
   * @param {*} value - Value to serialize
   * @returns {*} Serialized value
   */
  _serializeValue(value) {
    if (Array.isArray(value)) {
      return value.map(item => this._serializeValue(item));
    }
    
    if (value && typeof value === 'object' && value.constructor !== Object) {
      return this.serializeInstance(value);
    }
    
    return value;
  }

  /**
   * Recursively deserialize nested values
   * @private
   * @param {*} value - Value to deserialize
   * @param {Map<string, Function>} classRegistry - Available class constructors
   * @returns {*} Deserialized value
   */
  _deserializeValue(value, classRegistry) {
    if (Array.isArray(value)) {
      return value.map(item => this._deserializeValue(item, classRegistry));
    }
    
    if (value && typeof value === 'object' && value._className) {
      return this.deserializeInstance(value, classRegistry);
    }
    
    return value;
  }

  /**
   * Get configuration database schema
   * @private
   * @returns {Object} Schema definition
   */
  _getConfigSchema() {
    return {
      required: ['key', 'value'],
      indexes: [
        { fieldName: 'key', unique: true },
        { fieldName: 'category' }
      ]
    };
  }

  /**
   * Get server database schema
   * @private
   * @returns {Object} Schema definition
   */
  _getServerSchema() {
    return {
      required: ['_id', 'name'],
      indexes: [
        { fieldName: '_id', unique: true }
      ]
    };
  }

  /**
   * Get users database schema
   * @private
   * @returns {Object} Schema definition
   */
  _getUserSchema() {
    return {
      required: ['_id'],
      indexes: [
        { fieldName: '_id', unique: true }
      ]
    };
  }

  /**
   * Get tickets database schema
   * @private
   * @returns {Object} Schema definition
   */
  _getTicketSchema() {
    return {
      required: ['_id', 'creatorId', 'status'],
      indexes: [
        { fieldName: '_id', unique: true },
        { fieldName: 'creatorId' },
        { fieldName: 'status' }
      ]
    };
  }

  /**
   * Get templates database schema
   * @private
   * @returns {Object} Schema definition
   */
  _getTemplateSchema() {
    return {
      required: ['_id', 'name', 'template'],
      indexes: [
        { fieldName: '_id', unique: true },
        { fieldName: 'name', unique: true }
      ]
    };
  }

  /**
   * Close all database connections
   * @returns {Promise<void>}
   */
  async close() {
    // NeDB doesn't require explicit closing, but we'll clear our references
    this._databases.clear();
    this._schemas.clear();
    this._initialized = false;
  }

  /**
   * Get initialization status
   * @returns {boolean} Whether database manager is initialized
   */
  get isInitialized() {
    return this._initialized;
  }

  /**
   * Get list of available database names
   * @returns {Array<string>} Database names
   */
  get databaseNames() {
    return Array.from(this._databases.keys());
  }
}

module.exports = DatabaseManager;