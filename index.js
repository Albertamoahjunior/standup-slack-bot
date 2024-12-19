// Import required libraries
const { App } = require('@slack/bolt');
const dotenv = require('dotenv');
const schedule = require('node-schedule');
const databaseConnection = require('./db');

// Load environment variables
dotenv.config();
if (!process.env.SLACK_BOT_TOKEN || !process.env.SLACK_SIGNING_SECRET || !process.env.SLACK_CHANNEL_ID) {
  throw new Error('Missing required environment variables: SLACK_BOT_TOKEN, SLACK_SIGNING_SECRET, or SLACK_CHANNEL_ID');
}

// Initialize the Slack app
const app = new App({
  token: process.env.SLACK_BOT_TOKEN, // Bot User OAuth Token
  signingSecret: process.env.SLACK_SIGNING_SECRET, // Signing Secret
  socketMode: true, // Socket Mode
  appToken: process.env.SLACK_APP_TOKEN, // App OAuth Token
});

// Fetch MongoDB collection
const getStandupCollection = async () => {
  const db = await databaseConnection();
  return db.collection('standupUpdates');
};

// Insert a new standup report
const insertStandupUpdate = async (userId, update) => {
  try {
    const collection = await getStandupCollection();
    const timestamp = new Date().toISOString();

    await collection.insertOne({
      userId,
      update,
      timestamp
    });
    console.log(`Standup update for user ${userId} saved successfully.`);
  } catch (error) {
    console.error(`Error saving standup update for user ${userId}:`, error.message);
  }
};

// Fetch all standup updates
const fetchStandupUpdates = async () => {
  try {
    const collection = await getStandupCollection();
    return await collection.find({}).toArray();
  } catch (error) {
    console.error('Error fetching standup updates:', error.message);
    return [];
  }
};

// Fetch members of a specific channel
const fetchChannelMembers = async (channelId) => {
  try {
    const result = await app.client.conversations.members({
      token: process.env.SLACK_BOT_TOKEN,
      channel: channelId,
    });
    return result.members.filter(userId => userId !== 'USLACKBOT'); // Exclude bots
  } catch (error) {
    console.error(`Error fetching members for channel ${channelId}:`, error.message);
    return [];
  }
};

// Schedule daily reminders
const scheduleDailyReminder = async () => {
  const targetUsers = await fetchChannelMembers(process.env.SLACK_CHANNEL_ID);

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

// Handle standup updates
app.message(/standup:.+/i, async ({ message, say }) => {
  const userId = message.user;
  const userUpdate = message.text.split('standup:')[1]?.trim();

  if (!userUpdate) {
    await say('Please use the format: `standup: <your update>`.');
    return;
  }

  try {
    await insertStandupUpdate(userId, userUpdate);
    await say(`<@${userId}>, your standup update has been recorded!`);
  } catch (error) {
    console.error('Error saving standup update:', error.message);
    await say('Failed to record your standup update. Please try again.');
  }
});

// Command: Show standup summary
app.command('/standup-summary', async ({ command, ack, say }) => {
  await ack();

  try {
    const updates = await fetchStandupUpdates();
    if (updates.length === 0) {
      await say('No updates have been recorded yet.');
      return;
    }

    let summary = '*Daily Standup Summary:*';
    updates.forEach(({ userId, update }) => {
      summary += `- <@${userId}>: ${update}
`;
    });

    await say(summary);
  } catch (error) {
    console.error('Error fetching standup summary:', error.message);
    await say('Failed to fetch the standup summary. Please try again later.');
  }
});

// Command: Show blockers
app.command('/standup-blockers', async ({ command, ack, say }) => {
  await ack();

  try {
    const updates = await fetchStandupUpdates();
    const blockers = updates
      .filter(({ update }) => update.toLowerCase().includes('blocker'))
      .map(({ userId, update }) => `- <@${userId}>: ${update}`);

    if (blockers.length === 0) {
      await say('No blockers have been reported.');
      return;
    }

    await say(`*Blockers Reported:*
${blockers.join('\n')}`);
  } catch (error) {
    console.error('Error fetching blockers:', error.message);
    await say('Failed to fetch blockers. Please try again later.');
  }
});

// Start the app
(async () => {
  try {
    await databaseConnection();
    await app.start(process.env.PORT || 3000);
    console.log('⚡️ Slack bot is running!');
    scheduleDailyReminder();
  } catch (error) {
    console.error('Failed to start the app:', error.message);
  }
})();
