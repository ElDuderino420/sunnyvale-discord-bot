# Sunnyvale Discord Bot

A comprehensive Discord moderation bot with Object-Oriented Programming architecture, built for the Sunnyvale Trailer Park server. Features advanced moderation tools, server template management, and extensible plugin system.

## Features

### 🛡️ Moderation System
- **User Management**: Kick, ban, temporary ban with automated expiration
- **Jail System**: Role-based restriction with automatic role backup/restoration
- **User Statistics**: Comprehensive moderation history and user analytics
- **Persistent Roles**: Automatic role restoration when users rejoin

### 🎫 Support System
- **Ticket System**: Private support channels with button interactions
- **Staff Assignment**: Assign specific staff members to tickets
- **Transcript Generation**: Complete conversation logs for archival

### 🎭 Role Management
- **Autoroles**: Reaction-based role assignment system
- **Role Hierarchy**: Intelligent role management with permission inheritance
- **Bulk Operations**: Efficient role operations with rate limiting protection

### 🏗️ Server Templates
- **Export Templates**: Capture complete server structure (roles, channels, permissions)
- **Import Templates**: Recreate server layouts with conflict resolution
- **Template Validation**: Verify templates against Discord API limits
- **Template Library**: Save and manage multiple server configurations

## Architecture

### Object-Oriented Design
```
├── Domain Layer (Business Logic)
│   ├── Entities/          # Core business objects (User, Server, Ticket)
│   └── Services/          # Business logic services
├── Data Layer (Persistence)
│   ├── Repositories/      # Data access abstractions
│   └── Infrastructure/    # Database and external services
├── Application Layer (Discord Integration)
│   ├── Commands/          # Discord slash commands
│   └── Events/           # Discord event handlers
└── Presentation Layer (Discord UI)
    ├── Formatters/        # Message and embed formatting
    └── Validators/        # Input validation
```

### Core Principles
- **SOLID Principles**: Single responsibility, open/closed, Liskov substitution
- **Domain-Driven Design**: Clear separation of business logic and infrastructure
- **Command Pattern**: Consistent command structure with validation and error handling
- **Repository Pattern**: Abstracted data access with comprehensive error handling

## Installation

### Prerequisites
- Node.js 18.0.0 or higher
- Discord Bot Token
- Server with appropriate permissions

### Setup Steps

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd sunnyvale-discord-bot
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your bot token and configuration
   ```

4. **Initialize database**:
   ```bash
   npm run setup
   ```

5. **Start the bot**:
   ```bash
   npm start
   ```

### Development Mode
```bash
npm run dev
```

## Configuration

### Environment Variables
```env
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_bot_client_id_here
GUILD_ID=your_server_guild_id_here
DB_PATH=./data/
LOG_LEVEL=info
```

### Bot Permissions
Required Discord permissions:
- Manage Roles
- Manage Channels
- Kick Members
- Ban Members
- Manage Messages
- View Channels
- Send Messages
- Use Slash Commands
- Manage Webhooks

## Commands

### Moderation Commands
- `/kick @user [reason]` - Remove user from server
- `/ban @user [reason]` - Permanently ban user  
- `/tempban @user [duration] [reason]` - Temporary ban with auto-expiration
- `/jail @user [reason]` - Restrict user to jail channel
- `/unjail @user` - Release user from jail
- `/userstats @user` - Display user's server history

### Administrative Commands
- `/setup-jail [channel] [role]` - Configure jail system
- `/setup-tickets [channel]` - Configure ticket system
- `/setup-autoroles [channel]` - Create autorole message

### Template Commands
- `/export-template [name]` - Export server structure
- `/import-template [file] [strategy]` - Import server template
- `/validate-template [file]` - Validate template before import
- `/list-templates` - Show available templates

## Database Schema

### Users Collection
```javascript
{
  _id: "Discord User ID",
  tag: "username#discriminator",
  originalRoles: ["roleId1", "roleId2"],    // Stored during jail
  persistentRoles: ["roleId1", "roleId2"],  // Stored on leave
  moderationHistory: [
    {
      id: "unique_action_id",
      action: "kick|ban|warn|jail",
      moderator: "moderator_user_id",
      reason: "action_reason",
      timestamp: "2023-01-01T00:00:00.000Z",
      metadata: {}
    }
  ],
  createdAt: "2023-01-01T00:00:00.000Z",
  updatedAt: "2023-01-01T00:00:00.000Z"
}
```

### Server Configuration
```javascript
{
  _id: "Discord Guild ID",
  name: "Server Name",
  config: {
    jailChannelId: "channel_id",
    ticketsChannelId: "channel_id", 
    moderatorRoleId: "role_id",
    jailedRoleId: "role_id",
    autoroles: {
      "message_id": {
        "emoji": "role_id"
      }
    },
    templates: {},
    createdAt: "2023-01-01T00:00:00.000Z",
    updatedAt: "2023-01-01T00:00:00.000Z"
  }
}
```

### Server Templates
```javascript
{
  _id: "template_uuid",
  name: "Template Name",
  description: "Template description",
  template: {
    serverName: "Server Name",
    description: "Server description",
    roles: [
      {
        name: "Role Name",
        color: "#FF0000",
        permissions: ["MANAGE_MESSAGES"],
        position: 10,
        hoist: true,
        mentionable: false
      }
    ],
    channels: [
      {
        name: "channel-name",
        type: "text",
        topic: "Channel description",
        permissions: [
          {
            role: "@everyone",
            deny: ["SEND_MESSAGES"],
            allow: ["VIEW_CHANNEL"]
          }
        ]
      }
    ]
  },
  metadata: {
    version: "1.0.0",
    created: "2023-01-01T00:00:00.000Z",
    author: "creator_user_id",
    tags: ["community", "gaming"]
  }
}
```

## API Documentation

### JSDoc Documentation
Generate comprehensive API documentation:
```bash
npm run docs
npm run docs:serve
```

### Core Classes

#### User Entity
```javascript
const user = new User('123456789', 'username#1234');
user.addModerationAction('warn', moderatorId, 'Inappropriate language');
const history = user.getModerationHistory('warn');
```

#### Server Entity  
```javascript
const server = new Server('123456789', 'My Server');
server.setJailChannel('987654321');
server.addAutorole('messageId', '✅', 'roleId');
```

#### Ticket Entity
```javascript
const ticket = new Ticket('0001', creatorId, channelId);
ticket.addMessage(userId, 'I need help');
ticket.assignStaff(staffId);
const transcript = ticket.generateTranscript();
```

## Development

### Code Style
- **ESLint**: Enforces consistent code style and JSDoc requirements
- **JSDoc**: Comprehensive documentation for all classes and methods
- **Error Handling**: Structured error handling with custom error types
- **Testing**: Jest framework with comprehensive test coverage

### Scripts
```bash
npm run dev          # Development mode with auto-reload
npm run lint         # Check code style and JSDoc compliance  
npm run lint:fix     # Auto-fix linting issues
npm run test         # Run test suite
npm run docs         # Generate JSDoc documentation
npm start            # Production mode
```

### Adding New Commands

1. **Create command class**:
   ```javascript
   class MyCommand extends BaseCommand {
     get data() {
       return new SlashCommandBuilder()
         .setName('mycommand')
         .setDescription('My command description');
     }
     
     async execute(interaction) {
       await interaction.reply('Command executed!');
     }
   }
   ```

2. **Register command**: Add to command loader in appropriate category

3. **Add tests**: Create comprehensive test coverage

### Database Operations

```javascript
// Using repositories
const userRepo = new UserRepository(dbManager);
const user = await userRepo.findById('123456789');

// Using entities
const newUser = new User('987654321', 'newuser#0001');
await userRepo.create(newUser.toDatabase());
```

## Deployment

### Production Setup

1. **Environment Configuration**:
   ```bash
   NODE_ENV=production
   LOG_LEVEL=warn
   DB_PATH=/var/lib/sunnyvale-bot/data
   ```

2. **Process Management**:
   ```bash
   npm install -g pm2
   pm2 start ecosystem.config.js
   pm2 startup
   pm2 save
   ```

3. **Database Backup**:
   ```bash
   # Automated daily backups
   npm run backup
   ```

4. **System Service** (optional):
   ```bash
   sudo systemctl enable sunnyvale-bot
   sudo systemctl start sunnyvale-bot
   ```

### Health Monitoring
- **PM2 Monitoring**: Process health and resource usage
- **Log Aggregation**: Structured logging with rotation
- **Database Backups**: Automated daily backups with retention
- **Error Alerting**: Discord webhook notifications for critical errors

## Contributing

### Development Workflow
1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

### Code Standards
- Follow ESLint configuration
- Write comprehensive JSDoc documentation
- Include unit tests for new features
- Follow OOP principles and patterns
- Ensure backward compatibility

### Testing
```bash
npm test                # Run all tests
npm run test:watch      # Watch mode for development
npm run test:coverage   # Generate coverage report
```

## Troubleshooting

### Common Issues

**Database Connection Errors**:
- Verify `DB_PATH` directory exists and is writable
- Check file permissions on database files

**Command Registration Failures**:
- Ensure `CLIENT_ID` matches your bot application
- Verify bot has necessary permissions in target guild

**Permission Errors**:
- Check bot role hierarchy (bot role must be above managed roles)
- Verify required Discord permissions are granted

**Template Import Failures**:
- Validate template format against schema
- Check Discord API limits (role count, channel count)
- Verify sufficient permissions for channel/role creation

### Debug Mode
```bash
DEBUG=sunnyvale:* npm run dev
```

### Log Analysis
```bash
tail -f logs/bot.log | grep ERROR
```

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

- **Documentation**: [JSDoc API Documentation](./docs/)
- **Issues**: [GitHub Issues](https://github.com/your-org/sunnyvale-discord-bot/issues)
- **Discord**: [Support Server](https://discord.gg/your-support-server)

## Acknowledgments

- Built with [Discord.js](https://discord.js.org/)
- Database powered by [NeDB](https://github.com/seald/nedb)
- Documentation generated with [JSDoc](https://jsdoc.app/)

---

**Sunnyvale Discord Bot** - Professional Discord server management with enterprise-grade architecture and comprehensive feature set.