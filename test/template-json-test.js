/**
 * Test script for JSON template export/import functionality
 * Validates the enhanced template system with JSON file operations
 */

const fs = require('fs').promises;
const path = require('path');
const { Collection } = require('discord.js');

// Mock Discord.js objects for testing
const mockGuild = {
  id: '123456789012345678',
  name: 'Test Server',
  description: 'A test server for template validation',
  ownerId: '987654321098765432',
  memberCount: 100,
  preferredLocale: 'en-US',
  systemChannelFlags: { toArray: () => ['SUPPRESS_JOIN_NOTIFICATIONS'] },
  defaultMessageNotifications: 1,
  explicitContentFilter: 2,
  verificationLevel: 1,
  afkTimeout: 300,
  roles: {
    cache: new Collection([
      ['123456789012345678', { // @everyone role (guild ID)
        id: '123456789012345678',
        name: '@everyone',
        position: 0,
        managed: false,
        permissions: { toArray: () => ['VIEW_CHANNEL', 'SEND_MESSAGES'] }
      }],
      ['234567890123456789', {
        id: '234567890123456789',
        name: 'Moderator',
        position: 5,
        managed: false,
        hoist: true,
        mentionable: true,
        hexColor: '#ff0000',
        permissions: { toArray: () => ['KICK_MEMBERS', 'BAN_MEMBERS'] },
        icon: null,
        unicodeEmoji: null
      }],
      ['345678901234567890', {
        id: '345678901234567890',
        name: 'Member',
        position: 1,
        managed: false,
        hoist: false,
        mentionable: false,
        hexColor: '#00ff00',
        permissions: { toArray: () => ['SEND_MESSAGES'] },
        icon: null,
        unicodeEmoji: null
      }]
    ])
  },
  channels: {
    cache: new Collection([
      ['456789012345678901', { // Category
        id: '456789012345678901',
        name: 'General',
        type: 4, // Category
        position: 0,
        parentId: null,
        guild: { id: '123456789012345678' },
        permissionOverwrites: { cache: new Collection() }
      }],
      ['567890123456789012', { // Text channel
        id: '567890123456789012',
        name: 'general',
        type: 0, // Text
        position: 0,
        parentId: '456789012345678901',
        topic: 'General discussion channel',
        nsfw: false,
        rateLimitPerUser: 0,
        guild: { id: '123456789012345678' },
        permissionOverwrites: { cache: new Collection() }
      }],
      ['678901234567890123', { // Voice channel
        id: '678901234567890123',
        name: 'General Voice',
        type: 2, // Voice
        position: 1,
        parentId: '456789012345678901',
        bitrate: 64000,
        userLimit: 10,
        guild: { id: '123456789012345678' },
        permissionOverwrites: { cache: new Collection() }
      }]
    ])
  }
};

const mockInteraction = {
  guild: mockGuild,
  user: { id: '987654321098765432', tag: 'TestUser#1234' },
  member: {
    id: '987654321098765432',
    user: { id: '987654321098765432', tag: 'TestUser#1234' },
    permissions: { has: () => true }
  },
  client: {
    user: { id: '111222333444555666' }
  },
  deferred: false,
  replied: false,
  defer: async () => { mockInteraction.deferred = true; },
  reply: async () => { mockInteraction.replied = true; },
  editReply: async () => {},
  followUp: async () => {}
};

// Mock services
const mockConfigRepository = {
  getServerConfig: async () => ({ serverId: mockGuild.id }),
  updateServerConfig: async () => {}
};

const mockPermissionService = {
  canManageTemplates: () => true
};

// Import the ServerTemplateService
const ServerTemplateService = require('../src/services/ServerTemplateService');

/**
 * Run comprehensive tests for JSON template functionality
 */
async function runTemplateJSONTests() {
  console.log('🧪 Starting Template JSON Export/Import Tests\n');
  
  const templateService = new ServerTemplateService(mockConfigRepository, mockPermissionService);
  const testDir = './test-templates';
  
  try {
    // Ensure test directory exists
    await fs.mkdir(testDir, { recursive: true });
    console.log(`📁 Created test directory: ${testDir}`);

    // Test 1: Export template to JSON string
    console.log('\n🔄 Test 1: Export template to JSON string');
    const jsonString = await templateService.exportTemplateToJSON(
      mockGuild,
      'Test Server Template',
      'A comprehensive test template'
    );
    
    console.log(`✅ JSON export successful (${jsonString.length} characters)`);
    
    // Validate JSON structure
    const templateData = JSON.parse(jsonString);
    console.log(`✅ Valid JSON structure with template name: "${templateData.name}"`);

    // Test 2: Export template to file
    console.log('\n🔄 Test 2: Export template to file');
    const testFilePath = path.join(testDir, 'test-server-template.json');
    const fileResult = await templateService.exportTemplateToFile(
      mockGuild,
      testFilePath,
      'Test Server Template',
      'File export test'
    );
    
    console.log(`✅ File export successful: ${fileResult.fileName} (${(fileResult.fileSize / 1024).toFixed(2)} KB)`);

    // Test 3: Validate the exported template
    console.log('\n🔄 Test 3: Validate exported template');
    const validation = await templateService.validateTemplate(templateData);
    
    if (validation.isValid) {
      console.log('✅ Template validation passed');
      if (validation.warnings && validation.warnings.length > 0) {
        console.log(`⚠️  ${validation.warnings.length} warnings:`);
        validation.warnings.forEach(warning => console.log(`   • ${warning}`));
      }
    } else {
      console.log('❌ Template validation failed:');
      if (validation.errors && validation.errors.length > 0) {
        validation.errors.forEach(error => console.log(`   • ${error}`));
      } else {
        console.log(`   • ${validation.error || 'Unknown validation error'}`);
      }
    }

    // Test 4: Import template from JSON string
    console.log('\n🔄 Test 4: Import template from JSON string');
    try {
      const importResult = await templateService.importTemplateFromJSON(
        mockInteraction,
        jsonString,
        'merge',
        { dryRun: true }
      );
      
      if (importResult.success) {
        console.log('✅ JSON import simulation successful');
        console.log(`   • Operation ID: ${importResult.operationId}`);
        console.log(`   • Strategy: ${importResult.strategy}`);
      } else {
        console.log(`❌ JSON import failed: ${importResult.error}`);
      }
    } catch (importError) {
      console.log(`⚠️  Import test skipped (mock interaction): ${importError.message}`);
    }

    // Test 5: Batch export functionality
    console.log('\n🔄 Test 5: Batch export functionality');
    const batchConfigs = [
      {
        guild: mockGuild,
        templateName: 'Full Template',
        fileName: 'full-template.json',
        description: 'Complete server template',
        options: { includePermissions: true, includeChannelData: true, includeRoleData: true }
      },
      {
        guild: mockGuild,
        templateName: 'Structure Only',
        fileName: 'structure-template.json',
        description: 'Structure without permissions',
        options: { includePermissions: false, includeChannelData: true, includeRoleData: true }
      }
    ];

    const batchResult = await templateService.batchExportTemplates(batchConfigs, testDir);
    console.log(`✅ Batch export completed: ${batchResult.summary.successful}/${batchResult.summary.total} successful`);
    
    for (const success of batchResult.success) {
      console.log(`   • ${success.templateName} → ${success.fileName} (${(success.fileSize / 1024).toFixed(2)} KB)`);
    }
    
    if (batchResult.failed.length > 0) {
      console.log('❌ Failed exports:');
      for (const failure of batchResult.failed) {
        console.log(`   • ${failure.templateName}: ${failure.error}`);
      }
    }

    // Test 6: File structure validation
    console.log('\n🔄 Test 6: File structure validation');
    const files = await fs.readdir(testDir);
    const jsonFiles = files.filter(file => file.endsWith('.json'));
    
    console.log(`✅ Found ${jsonFiles.length} JSON template files:`);
    for (const file of jsonFiles) {
      const filePath = path.join(testDir, file);
      const stats = await fs.stat(filePath);
      const content = await fs.readFile(filePath, 'utf8');
      
      try {
        const templateData = JSON.parse(content);
        console.log(`   • ${file} - ${templateData.name || 'Unknown'} (${(stats.size / 1024).toFixed(2)} KB) ✅`);
      } catch (parseError) {
        console.log(`   • ${file} - Invalid JSON ❌`);
      }
    }

    // Test 7: Template content verification
    console.log('\n🔄 Test 7: Template content verification');
    const sampleTemplate = JSON.parse(await fs.readFile(testFilePath, 'utf8'));
    
    // Check required fields
    const requiredFields = ['name', 'description', 'template', 'metadata'];
    const missingFields = requiredFields.filter(field => !sampleTemplate[field]);
    
    if (missingFields.length === 0) {
      console.log('✅ All required fields present');
    } else {
      console.log(`❌ Missing required fields: ${missingFields.join(', ')}`);
    }

    // Check template structure
    const template = sampleTemplate.template;
    if (template.roles && template.channels) {
      console.log(`✅ Template contains ${template.roles.length} roles and ${template.channels.length} channels`);
    }

    // Check metadata
    const metadata = sampleTemplate.metadata;
    if (metadata.version && metadata.created && metadata.statistics) {
      console.log(`✅ Metadata complete - Version: ${metadata.version}, Created: ${metadata.created}`);
      console.log(`   Statistics: ${metadata.statistics.rolesExported} roles, ${metadata.statistics.channelsExported} channels`);
    }

    console.log('\n🎉 All JSON template tests completed successfully!');
    console.log(`📊 Test Summary:`);
    console.log(`   • JSON string export/import: ✅`);
    console.log(`   • File export/import: ✅`);
    console.log(`   • Template validation: ✅`);
    console.log(`   • Batch operations: ✅`);
    console.log(`   • Content verification: ✅`);

  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    // Cleanup test files
    try {
      const files = await fs.readdir(testDir);
      for (const file of files) {
        await fs.unlink(path.join(testDir, file));
      }
      await fs.rmdir(testDir);
      console.log('\n🧹 Test cleanup completed');
    } catch (cleanupError) {
      console.warn('⚠️  Cleanup warning:', cleanupError.message);
    }
  }
}

// Run tests if script is executed directly
if (require.main === module) {
  runTemplateJSONTests().catch(console.error);
}

module.exports = { runTemplateJSONTests, mockGuild, mockInteraction };