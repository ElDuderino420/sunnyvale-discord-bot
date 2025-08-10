# Product Requirements Document: Sunnyvale Bot

  * **Version:** 1.0
  * **Date:** July 29, 2025
  * **Author:** Gemini (PRD Creation Assistant)

## 1\. App Overview and Objectives

**Sunnyvale Bot** is a multi-function, themed Discord bot for the "Sunnyvale Trailer Park" server. Its primary objective is to provide a powerful and configurable suite of moderation and server management tools that enhance the server's theme while being easy for administrators to manage.

The bot is designed with a **modular architecture** to allow for seamless future expansion with new features (e.g., economy, games, etc.) beyond the initial scope.

## 2\. Target Audience

  * **Server Admins:** Users with full permissions who will configure the bot, set channel IDs, and manage moderator roles.
  * **Server Moderators:** Users granted permissions (via Discord permissions or a specific role) to use the bot's moderation commands (`/jail`, `/kick`, `/warn`, etc.) to manage the community.
  * **Server Members:** Regular users of the server who will interact with bot features like the ticketing and autorole systems.

## 3\. Core Features & Functionality (v1.0)

All commands will be implemented as Discord Slash (`/`) commands.

| Feature | Command(s) | Description & Acceptance Criteria |
| :--- | :--- | :--- |
| **User Kicking** | `/kick @user [reason]` | **Description:** Removes a user from the server. \<br/\> **Acceptance Criteria:** \<br/\>- Can only be used by members with Discord "Kick Members" permission. \<br/\>- A reason is required. \<br/\>- The bot logs the kick, the target user, the moderator, and the reason. |
| **User Banning**| `/ban @user [reason]` | **Description:** Permanently bans a user from the server. \<br/\> **Acceptance Criteria:** \<br/\>- Can only be used by members with Discord "Ban Members" permission. \<br/\>- A reason is required. \<br/\>- The bot logs the ban. |
| **User Temp Ban** | `/tempban @user [duration] [reason]` | **Description:** Bans a user for a specified duration (e.g., 1d, 3h). \<br/\> **Acceptance Criteria:** \<br/\>- Can only be used by members with Discord "Ban Members" permission. \<br/\>- The bot automatically unbans the user after the duration expires. \<br/\>- The bot logs the temp ban. |
| **Jail System** | `/jail @user [reason]` \<br/\> `/unjail @user` | **Description:** Confines a user to a specific channel. \<br/\> **Acceptance Criteria:** \<br/\>- Can only be used by members with the configured "Moderator" role. \<br/\>- On `/jail`, the bot removes all of the user's roles, stores them in the DB, and assigns the 'Jailed' role. \<br/\>- The 'Jailed' role only has permission to view the pre-configured jail channel. \<br/\>- On `/unjail`, the bot removes the 'Jailed' role and restores the original roles from the DB. |
| **User Stats** | `/userstats @user` | **Description:** Displays a summary of a user's server history. \<br/\> **Acceptance Criteria:** \<br/\>- Command displays an embed with: Discord account creation date, server join date, list of current roles, moderation history (warnings, jails, kicks), and ticket history. |
| **Ticketing System** | (Button Interaction) | **Description:** Allows users to create private support tickets. \<br/\> **Acceptance Criteria:** \<br/\>- Admins can create a permanent embed message with a "Create Ticket" button in a configured channel (`#park-tickets`). \<br/\>- Clicking the button creates a new private text channel visible only to that user and the "Moderator" role. \<br/\>- The bot logs the ticket creation. \<br/\>- A `/close-ticket` command archives the ticket channel. |
| **Autorole System** | (Reaction Interaction) | **Description:** Allows users to self-assign roles by reacting to a message. \<br/\> **Acceptance Criteria:** \<br/\>- An admin can create a bot-managed embed post. \<br/\>- The admin can link specific emoji reactions to specific roles. \<br/\>- When a user adds/removes a reaction, the bot grants/revokes the corresponding role. |
| **Persistent Roles**| (Passive) | **Description:** Restores a user's roles if they leave and rejoin the server. \<br/\> **Acceptance Criteria:** \<br/\>- When a user leaves, the bot logs their roles against their user ID in the database. \<br/\>- When a user rejoins, the bot checks the database and automatically re-assigns their saved roles. |

## 4\. Technical Stack Recommendations

  * **Language:** Node.js
  * **Discord Library:** [discord.js](https://discord.js.org/) (Recommended for its comprehensive features and community support)
  * **Database:** [NeDB (Node embedded Database)](https://github.com/seald/nedb) (File-based, no external dependency)
  * **Hosting:** Self-hosted on a home server running Debian 12.

## 5\. Conceptual Data Model (NeDB)

We'll need three main data files (collections):

1.  `config.db`: A key-value store for server settings.

      * `jailChannelId`: (String)
      * `ticketsChannelId`: (String)
      * `moderatorRoleId`: (String)
      * `jailedRoleId`: (String)

2.  `users.db`: To store data about each user.

    ```json
    {
      "_id": "Discord User ID",
      "originalRoles": ["roleId1", "roleId2"], // Stored during jail
      "persistentRoles": ["roleId1", "roleId2"], // Stored on leave
      "moderationHistory": [
        { "action": "warn", "moderator": "modId", "reason": "...", "timestamp": "..." },
        { "action": "jail", "moderator": "modId", "reason": "...", "timestamp": "..." }
      ]
    }
    ```

3.  `tickets.db`: To track support tickets.

    ```json
    {
      "_id": "Unique Ticket ID (e.g., 0001)",
      "creatorId": "Discord User ID",
      "channelId": "Discord Channel ID of the ticket",
      "status": "open/closed",
      "createdAt": "timestamp",
      "closedAt": "timestamp",
      "transcript": "Full log of the conversation"
    }
    ```

## 6\. UI/UX Design Principles

  * **Command Style:** All user-facing commands must be Discord Slash `/` commands for modern integration.
  * **Interactivity:** Use buttons (for tickets) and reactions (for autoroles) to create intuitive, user-friendly workflows that don't require memorizing commands.
  * **Feedback:** The bot must provide clear, concise confirmation messages for all actions (e.g., "User @X has been jailed.", "Ticket \#0001 has been created.").
  * **Embeds:** Use Discord embeds for rich, well-formatted information displays, especially for `/userstats` and system messages.

## 7\. Security Considerations

  * **Permissions:** Strictly enforce the dual-permission model: check native Discord permissions for built-in actions (`kick`, `ban`) and the configurable `moderatorRoleId` for custom bot actions (`jail`, ticket management).
  * **Input Sanitization:** Though slash commands are safer than legacy prefix commands, ensure all user-provided input (e.g., reasons) is handled safely to prevent injection attacks or formatting issues.
  * **Data Privacy:** The bot will store user IDs and role IDs. Ensure the `nedb` database files on the host machine are properly secured with file permissions.

## 8\. Development Phases/Milestones

1.  **Foundation:** Set up the Node.js project, install `discord.js` and `nedb`, and create the basic bot client with a command handler and a system for loading/reading from `config.db`.
2.  **Core Moderation:** Implement `/kick`, `/ban`, and `/tempban`.
3.  **Jail & Stats:** Implement the full `/jail` and `/unjail` logic, including DB interaction. Implement the `/userstats` command, pulling data from the `users.db`.
4.  **Advanced Systems:** Build the ticketing system (button listener, channel creation) and the autorole system (reaction listener).
5.  **Persistence:** Implement the passive feature for restoring roles on user rejoin.

## 9\. Potential Challenges & Solutions

  * **Challenge:** Discord API Rate Limits.
      * **Solution:** `discord.js` handles rate limits internally. Avoid making manual API calls outside the library's methods.
  * **Challenge:** Data Integrity/Backups.
      * **Solution:** Since `nedb` is file-based, the `*.db` files are a single point of failure. Implement a simple cron job or script on the Debian server to create daily backups of these files.
  * **Challenge:** Home Server Uptime.
      * **Solution:** The bot's availability is tied to the home server's power and internet connection. This is a known trade-off for avoiding hosting costs. Consider using a process manager like `pm2` to automatically restart the bot if it crashes.

## 10\. Future Expansion Possibilities

The modular design allows for future modules to be added easily

