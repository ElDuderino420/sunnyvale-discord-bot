/**
 * Integration test for Sunnyvale Bot OOP architecture
 * Tests that all components can be instantiated and initialized without errors
 */

const SunnyvaleBot = require('./src/index');

// Mock environment variables for testing
process.env.DISCORD_TOKEN = 'test_token_placeholder';
process.env.CLIENT_ID = 'test_client_id_placeholder';
process.env.NODE_ENV = 'test';

/**
 * Test bot initialization without connecting to Discord
 */
async function testBotInitialization() {
  console.log('🧪 Testing Sunnyvale Bot OOP Architecture...');
  
  try {
    // Create bot instance
    const bot = new SunnyvaleBot();
    console.log('✅ Bot instance created successfully');

    // Test validation
    try {
      bot._validateEnvironment();
      console.log('✅ Environment validation passed');
    } catch (error) {
      console.log('❌ Environment validation failed:', error.message);
      throw error;
    }

    // Test client initialization
    try {
      bot._initializeClient();
      console.log('✅ Discord client initialized');
      console.log(`   - Intents configured: ${bot.client.options.intents}`);
      console.log(`   - Partials configured: ${bot.client.options.partials.length} types`);
    } catch (error) {
      console.log('❌ Client initialization failed:', error.message);
      throw error;
    }

    // Test database initialization
    try {
      await bot._initializeDatabase();
      console.log('✅ Database initialized');
      console.log(`   - Database manager: ${typeof bot.database}`);
    } catch (error) {
      console.log('❌ Database initialization failed:', error.message);
      throw error;
    }

    // Test services initialization
    try {
      await bot._initializeServices();
      console.log('✅ Services initialized');
      console.log(`   - Services available: ${Object.keys(bot.services).join(', ')}`);
    } catch (error) {
      console.log('❌ Services initialization failed:', error.message);
      throw error;
    }

    // Test command handler initialization
    try {
      bot._initializeCommandHandler();
      console.log('✅ Command handler initialized');
      
      const stats = bot.commandHandler.getCommandStats();
      console.log(`   - Total commands: ${stats.totalCommands}`);
      console.log(`   - Command categories: ${Object.keys(stats.commandsByCategory).join(', ')}`);
      
      // List all commands
      console.log('   - Available commands:');
      stats.commandsList.forEach(cmd => {
        console.log(`     • /${cmd.name} (${cmd.category}) - ${cmd.description}`);
      });
      
    } catch (error) {
      console.log('❌ Command handler initialization failed:', error.message);
      throw error;
    }

    // Test event listeners registration
    try {
      bot._registerEventListeners();
      console.log('✅ Event listeners registered');
      console.log(`   - Discord client event names: ${bot.client.eventNames().join(', ')}`);
    } catch (error) {
      console.log('❌ Event listeners registration failed:', error.message);
      throw error;
    }

    // Test status method
    try {
      const status = bot.getStatus();
      console.log('✅ Status method working');
      console.log(`   - Status: ${status.status}`);
      console.log(`   - Uptime: ${status.uptime}ms`);
    } catch (error) {
      console.log('❌ Status method failed:', error.message);
      throw error;
    }

    // Cleanup
    await bot.shutdown();
    console.log('✅ Bot shutdown completed');

    console.log('\n🎉 All integration tests passed! The OOP architecture is working correctly.');
    console.log('\n📊 Architecture Summary:');
    console.log('├── SunnyvaleBot (Main Application)');
    console.log('├── DatabaseManager (Data Layer)');
    console.log('├── Services (Business Logic Layer)');
    console.log('│   ├── ModerationService');
    console.log('│   ├── TicketService'); 
    console.log('│   ├── RoleService');
    console.log('│   ├── PermissionService');
    console.log('│   └── ServerTemplateService');
    console.log('├── CommandHandler (Command Orchestration)');
    console.log('└── Commands (User Interface Layer)');
    console.log('    ├── Moderation Commands (5)');
    console.log('    ├── Ticket Commands (2)');
    console.log('    ├── Role Commands (1)');
    console.log('    └── Template Commands (2)');

  } catch (error) {
    console.error('❌ Integration test failed:', error);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testBotInitialization()
    .then(() => {
      console.log('\n✅ Integration test completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Integration test failed:', error);
      process.exit(1);
    });
}

module.exports = { testBotInitialization };