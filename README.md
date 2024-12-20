# Slack Standup Bot

An automated Slack bot that helps teams manage their daily standups by sending reminders, collecting updates, and providing summaries.

## Features

- Automated daily standup reminders at 9:00 AM
- Collects standup updates from team members
- Provides summary of all updates using slash commands
- Tracks and reports blockers
- Dynamic channel member fetching
- In-memory storage for updates

## Prerequisites

- Node.js (v12 or higher)
- Slack workspace with admin privileges
- Slack Bot Token
- Slack Signing Secret
- Channel ID where the bot will operate

## Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file in the root directory with the following variables:

```env
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_SIGNING_SECRET=your-signing-secret
SLACK_CHANNEL_ID=your-channel-id
PORT=3000 # Optional, defaults to 3000
```

## Usage

### Starting the Bot

Run the following command to start the bot:

```bash
npm start
or
npm run start
```

### Commands

The bot responds to the following commands and interactions:

1. **Daily Reminders**

   - Bot automatically sends reminders at 9:00 AM to all channel members
   - Prompts users to share updates about:
     - Yesterday's work
     - Today's plans
     - Any blockers

2. **Sharing Updates**

   - Users can share their standup update using the format:

   ```
   standup: Your update message here
   ```

3. **Viewing Summaries**
   - Use `/standup-summary` to see all updates for the day
   - Use `/standup-blockers` to see all reported blockers
   - Use `/standup-update <@userName>` to see updates for a particular user
   - Use `/standup-reset` to reset only your updates

## Technical Details

1. Use flags for more efficiency, eg.the '-m' flag

```bash
- standup:-m 1.Create multiline updates \n using the '-m' flag

- /standup-summary --sort to sort the updates
```

2. Using pagingation:

- By default the limit on the fetch for updates is 5
- You can add your desired limit to return updates
```bash
`/standup-summary --lm <value>`
```

### Dependencies

- `@slack/bolt`: Slack Bot framework
- `dotenv`: Environment variable management
- `node-schedule`: Task scheduling
- `mongodb`: creating database instance

### Key Components

1. **Channel Member Fetching**

   - Dynamically fetches members from specified channel
   - Filters out system bot users

2. **Scheduling**

   - Uses node-schedule for daily 9 AM reminders
   - Configurable timing through code modification

3. **Data Storage**
   - Uses Mongodb to store updates

## Error Handling

The bot includes error handling for:

- Missing environment variables
- Failed message delivery
- Channel member fetching errors
- Application startup issues

## Future Improvements

1. Add configurable reminder times
2. Support for multiple channels
3. Custom reminder messages
4. Weekly/monthly summary reports

## Contributing

Feel free to submit issues and pull requests for new features or improvements.

## License

ISC License
