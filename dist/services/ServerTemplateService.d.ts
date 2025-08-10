export = ServerTemplateService;
/**
 * Service for managing server template import/export operations
 * Handles server structure capture, validation, and restoration with conflict resolution
 * @class ServerTemplateService
 * @example
 * const templateService = new ServerTemplateService(configRepo, permissionService);
 * const template = await templateService.exportServerTemplate(guild, 'My Server Template');
 */
declare class ServerTemplateService {
    /**
     * Initialize server template service
     * @param {ConfigRepository} configRepository - Server configuration repository
     * @param {PermissionService} permissionService - Permission validation service
     */
    constructor(configRepository: ConfigRepository, permissionService: PermissionService);
    /**
     * Configuration repository for server settings
     * @type {ConfigRepository}
     * @private
     */
    private _configRepo;
    /**
     * Permission service for validation
     * @type {PermissionService}
     * @private
     */
    private _permissionService;
    /**
     * Template validation schemas
     * @type {Object}
     * @private
     */
    private _schemas;
    /**
     * Import operation tracking
     * @type {Map<string, Object>}
     * @private
     */
    private _importOperations;
    /**
     * Discord API limits and constraints
     * @type {Object}
     * @private
     */
    private _discordLimits;
    /**
     * Export server structure to template format
     * @param {Guild} guild - Discord guild to export
     * @param {string} templateName - Name for the template
     * @param {string} [description='Exported server template'] - Template description
     * @param {Object} [options={}] - Export options
     * @param {boolean} [options.includePermissions=true] - Include channel permissions
     * @param {boolean} [options.includeChannelData=true] - Include channel topics/slowmode
     * @param {boolean} [options.includeRoleData=true] - Include role colors/permissions
     * @param {Array<string>} [options.excludedChannels=[]] - Channel IDs to exclude
     * @param {Array<string>} [options.excludedRoles=[]] - Role IDs to exclude
     * @returns {Promise<Object>} Exported template with metadata
     * @throws {Error} When template export fails
     * @example
     * const template = await serverTemplateService.exportServerTemplate(guild, 'Gaming Server', 'Template for gaming communities', {
     *   includePermissions: true,
     *   excludedChannels: ['123456789']
     * });
     */
    exportServerTemplate(guild: Guild, templateName: string, description?: string, options?: {
        includePermissions?: boolean;
        includeChannelData?: boolean;
        includeRoleData?: boolean;
        excludedChannels?: Array<string>;
        excludedRoles?: Array<string>;
    }): Promise<any>;
    /**
     * Import server template with conflict resolution
     * @param {CommandInteraction} interaction - Discord command interaction
     * @param {Object} templateData - Template data to import
     * @param {string} [strategy='merge'] - Import strategy (merge, overwrite, skip)
     * @param {Object} [options={}] - Import options
     * @param {boolean} [options.dryRun=false] - Preview changes without applying
     * @param {boolean} [options.backupFirst=true] - Create backup before import
     * @param {Array<string>} [options.skipSections=[]] - Sections to skip (roles, channels, settings)
     * @returns {Promise<Object>} Import result with created/modified items
     * @throws {Error} When template import fails
     * @example
     * const result = await serverTemplateService.importServerTemplate(interaction, templateData, 'merge', {
     *   dryRun: false,
     *   backupFirst: true,
     *   skipSections: ['settings']
     * });
     */
    importServerTemplate(interaction: CommandInteraction, templateData: any, strategy?: string, options?: {
        dryRun?: boolean;
        backupFirst?: boolean;
        skipSections?: Array<string>;
    }): Promise<any>;
    /**
     * Validate template against schema and Discord limits
     * @param {Object} templateData - Template data to validate
     * @returns {Object} Validation result with errors and warnings
     * @example
     * const validation = serverTemplateService.validateTemplate(templateData);
     * if (!validation.isValid) {
     *   console.log('Validation errors:', validation.errors);
     * }
     */
    validateTemplate(templateData: any): any;
    /**
     * Validate template data structure and content
     * @param {Object} templateData - Template data to validate
     * @returns {Promise<Object>} Validation result with isValid flag and error details
     * @throws {Error} When validation fails
     * @example
     * const validation = await templateService.validateTemplate(templateData);
     * if (!validation.isValid) {
     *   console.log('Template invalid:', validation.error);
     * }
     */
    validateTemplate(templateData: any): Promise<any>;
    /**
     * Get import operation status
     * @param {string} operationId - Import operation ID
     * @returns {Object|null} Operation status or null if not found
     * @example
     * const status = serverTemplateService.getImportStatus('import_1234567890_123456789');
     * if (status) {
     *   console.log(`Import status: ${status.status}`);
     * }
     */
    getImportStatus(operationId: string): any | null;
    /**
     * Cancel ongoing import operation
     * @param {string} operationId - Import operation ID
     * @returns {boolean} Whether cancellation was successful
     * @example
     * const cancelled = serverTemplateService.cancelImport('import_1234567890_123456789');
     * if (cancelled) {
     *   console.log('Import operation cancelled');
     * }
     */
    cancelImport(operationId: string): boolean;
    /**
     * Clean up completed import operations
     * @param {number} [maxAge=86400000] - Maximum age in milliseconds (24 hours default)
     * @returns {number} Number of operations cleaned up
     * @example
     * const cleaned = serverTemplateService.cleanupImportOperations(3600000); // 1 hour
     * console.log(`Cleaned up ${cleaned} import operations`);
     */
    cleanupImportOperations(maxAge?: number): number;
    /**
     * Initialize validation schemas
     * @private
     * @returns {Object} Schema definitions
     */
    private _initializeSchemas;
    /**
     * Export permission overwrites for a channel
     * @private
     * @param {GuildChannel} channel - Discord channel
     * @param {Map} roleMap - Role ID mapping
     * @returns {Array} Permission overwrites array
     */
    private _exportPermissionOverwrites;
    /**
     * Get channel type string from Discord type number
     * @private
     * @param {number} type - Discord channel type
     * @returns {string} Channel type string
     */
    private _getChannelTypeString;
    /**
     * Check if channel type is valid
     * @private
     * @param {string} type - Channel type string
     * @returns {boolean} Whether type is valid
     */
    private _isValidChannelType;
    /**
     * Check if version string is valid
     * @private
     * @param {string} version - Version string
     * @returns {boolean} Whether version is valid
     */
    private _isValidVersion;
    /**
     * Get required permissions for template
     * @private
     * @param {Object} template - Template data
     * @returns {Array} Required Discord permissions
     */
    private _getRequiredPermissions;
    /**
     * Create import plan with conflict resolution
     * @private
     * @param {Guild} guild - Target guild
     * @param {Object} template - Template to import
     * @param {string} strategy - Import strategy
     * @param {Array} skipSections - Sections to skip
     * @returns {Promise<Object>} Import plan
     */
    private _createImportPlan;
    /**
     * Execute import plan
     * @private
     * @param {Guild} guild - Target guild
     * @param {Object} plan - Import plan
     * @param {string} operationId - Operation ID
     * @returns {Promise<Object>} Execution results
     */
    private _executeImportPlan;
    /**
     * Validate import permissions and configuration
     * @param {string} guildId - Discord guild ID
     * @param {string} importerId - User ID performing the import
     * @param {Object} templateData - Template data to import
     * @param {Object} importConfig - Import configuration options
     * @returns {Promise<Object>} Validation result with permissions and warnings
     * @throws {Error} When validation fails
     * @example
     * const validation = await templateService.validateImport(guildId, userId, template, config);
     * if (!validation.isValid) {
     *   console.log('Import not allowed:', validation.error);
     * }
     */
    validateImport(guildId: string, importerId: string, templateData: any, importConfig: any): Promise<any>;
}
//# sourceMappingURL=ServerTemplateService.d.ts.map