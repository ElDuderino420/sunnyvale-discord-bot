export = DatabaseManager;
/**
 * Database manager for NeDB operations with OOP support
 * Handles database connections, schema validation, and class serialization
 * @class DatabaseManager
 * @example
 * const dbManager = new DatabaseManager('./data');
 * await dbManager.initialize();
 * const usersDb = dbManager.getDatabase('users');
 */
declare class DatabaseManager {
    /**
     * Initialize database manager with data directory
     * @param {string} dataPath - Path to database directory
     */
    constructor(dataPath?: string);
    /**
     * Path to database files
     * @type {string}
     * @private
     */
    private _dataPath;
    /**
     * Database connections storage
     * @type {Map<string, Datastore>}
     * @private
     */
    private _databases;
    /**
     * Database schemas for validation
     * @type {Map<string, Object>}
     * @private
     */
    private _schemas;
    /**
     * Initialization status
     * @type {boolean}
     * @private
     */
    private _initialized;
    /**
     * Initialize database manager and create required databases
     * @returns {Promise<void>}
     * @throws {Error} When database initialization fails
     */
    initialize(): Promise<void>;
    /**
     * Get database connection by name
     * @param {string} name - Database name
     * @returns {Datastore} Database connection
     * @throws {Error} When database not found or not initialized
     */
    getDatabase(name: string): Datastore<any>;
    /**
     * Create database connection with schema
     * @private
     * @param {string} name - Database name
     * @param {Object} schema - Database schema definition
     * @returns {Promise<void>}
     */
    private _createDatabase;
    /**
     * Validate document against database schema
     * @param {string} databaseName - Target database name
     * @param {Object} document - Document to validate
     * @returns {boolean} Validation result
     * @throws {ValidationError} When validation fails
     */
    validateDocument(databaseName: string, document: any): boolean;
    /**
     * Serialize class instance for database storage
     * @param {Object} instance - Class instance to serialize
     * @returns {Object} Serialized data suitable for database storage
     */
    serializeInstance(instance: any): any;
    /**
     * Deserialize database document back to class instance
     * @param {Object} document - Database document to deserialize
     * @param {Map<string, Function>} classRegistry - Available class constructors
     * @returns {Object} Deserialized class instance or plain object
     */
    deserializeInstance(document: any, classRegistry?: Map<string, Function>): any;
    /**
     * Recursively serialize nested values
     * @private
     * @param {*} value - Value to serialize
     * @returns {*} Serialized value
     */
    private _serializeValue;
    /**
     * Recursively deserialize nested values
     * @private
     * @param {*} value - Value to deserialize
     * @param {Map<string, Function>} classRegistry - Available class constructors
     * @returns {*} Deserialized value
     */
    private _deserializeValue;
    /**
     * Get configuration database schema
     * @private
     * @returns {Object} Schema definition
     */
    private _getConfigSchema;
    /**
     * Get server database schema
     * @private
     * @returns {Object} Schema definition
     */
    private _getServerSchema;
    /**
     * Get users database schema
     * @private
     * @returns {Object} Schema definition
     */
    private _getUserSchema;
    /**
     * Get tickets database schema
     * @private
     * @returns {Object} Schema definition
     */
    private _getTicketSchema;
    /**
     * Get templates database schema
     * @private
     * @returns {Object} Schema definition
     */
    private _getTemplateSchema;
    /**
     * Close all database connections
     * @returns {Promise<void>}
     */
    close(): Promise<void>;
    /**
     * Get initialization status
     * @returns {boolean} Whether database manager is initialized
     */
    get isInitialized(): boolean;
    /**
     * Get list of available database names
     * @returns {Array<string>} Database names
     */
    get databaseNames(): string[];
}
import Datastore = require("nedb-promises");
//# sourceMappingURL=DatabaseManager.d.ts.map