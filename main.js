// Import required libraries
const { App } = require('@slack/bolt');
const dotenv = require('dotenv');
const schedule = require('node-schedule');

// Load environment variables
dotenv.config();
if (!process.env.SLACK_BOT_TOKEN || !process.env.SLACK_SIGNING_SECRET || !process.env.SLACK_CHANNEL_ID) {
  throw new Error('Missing required environment variables: SLACK_BOT_TOKEN, SLACK_SIGNING_SECRET, or SLACK_CHANNEL_ID');
}

// Initialize the Slack app
const app = new App({
  token: process.env.SLACK_BOT_TOKEN, // Bot User OAuth Token
  signingSecret: process.env.SLACK_SIGNING_SECRET // Signing Secret
});

// Storage for standup updates (in-memory; consider replacing with a database)
const standupUpdates = {};

// Fetch members of a specific channel
const fetchChannelMembers = async (channelId) => {
  try {
    const result = await app.client.conversations.members({
      token: process.env.SLACK_BOT_TOKEN,
      channel: channelId, // ID of the specific channel
    });
    return result.members; // Returns an array of user IDs
  } catch (error) {
    console.error(`Error fetching members for channel ${channelId}:`, error.message);
    return [];
  }
};

// Fetch users dynamically for a specific channel
const fetchTargetUsersFromChannel = async () => {
  const specificChannelId = process.env.SLACK_CHANNEL_ID; // Use a .env variable for the channel ID
  const channelMembers = await fetchChannelMembers(specificChannelId);

  // Filter out bots and the Slack system bot
  return channelMembers.filter(userId => userId !== 'USLACKBOT');
};

// Schedule daily reminders
const scheduleDailyReminder = async () => {
  const targetUsers = await fetchTargetUsersFromChannel(); // Fetch members from the specific channel

  schedule.scheduleJob('0 9 * * *', async () => { // Run daily at 9:00 AM
    for (const userId of targetUsers) {
      try {
        await app.client.chat.postMessage({
          token: process.env.SLACK_BOT_TOKEN,
          channel: userId,
          text: 'Good morning! Please share your daily standup update:\n1. What did you do yesterday?\n2. What are you working on today?\n3. Any blockers?'
        });
      } catch (error) {
        console.error(`Failed to send message to ${userId}:`, error.message);
      }
    }
  });
};

// Collect standup updates
app.message(/standup:.+/i, async ({ message, say }) => {
  if (!message.text.includes('standup:')) {
    await say('Please use the format: `standup: <your update>`.');
    return;
  }

  const userId = message.user;
  const userUpdate = message.text.split('standup:')[1].trim();

  standupUpdates[userId] = {
    update: userUpdate,
    timestamp: new Date().toISOString()
  };

  await say(`<@${userId}>, your standup update has been recorded!`);
});

// Show a summary of all updates
app.command('/standup-summary', async ({ command, ack, say }) => {
  await ack();

  if (Object.keys(standupUpdates).length === 0) {
    await say('No updates have been recorded yet.');
    return;
  }

  let summary = '*Daily Standup Summary:*\n';
  for (const [userId, { update }] of Object.entries(standupUpdates)) {
    summary += `- <@${userId}>: ${update}\n`;
  }

  await say(summary);
});

// Aggregate and report blockers
app.command('/standup-blockers', async ({ command, ack, say }) => {
  await ack();

  const blockers = Object.entries(standupUpdates)
    .filter(([_, { update }]) => update.toLowerCase().includes('blocker'))
    .map(([userId, { update }]) => `- <@${userId}>: ${update}`);

  if (blockers.length === 0) {
    await say('No blockers have been reported.');
    return;
  }

  await say(`*Blockers Reported:*\n${blockers.join('\n')}`);
});

// Start the app
(async () => {
  try {
    await app.start(process.env.PORT || 3000);
    console.log('⚡️ Slack bot is running!');
    scheduleDailyReminder();
  } catch (error) {
    console.error('Failed to start the app:', error.message);
  }
})();
