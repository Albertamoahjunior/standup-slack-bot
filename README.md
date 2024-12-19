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
node index.js
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

## Technical Details

### Dependencies

- `@slack/bolt`: Slack Bot framework
- `dotenv`: Environment variable management
- `node-schedule`: Task scheduling

### Key Components

1. **Channel Member Fetching**
   - Dynamically fetches members from specified channel
   - Filters out system bot users

2. **Scheduling**
   - Uses node-schedule for daily 9 AM reminders
   - Configurable timing through code modification

3. **Data Storage**
   - Currently uses in-memory storage
   - Can be extended to use a database

## Error Handling

The bot includes error handling for:
- Missing environment variables
- Failed message delivery
- Channel member fetching errors
- Application startup issues

## Future Improvements

1. Implement persistent storage using a database
2. Add configurable reminder times
3. Support for multiple channels
4. Custom reminder messages
5. Weekly/monthly summary reports

## Contributing

Feel free to submit issues and pull requests for new features or improvements.

## License

MIT License