const schedule = require("node-schedule");
const app = require("./appInstance");

// Fetch MongoDB collection
const getStandupCollection = async () => {
  const db = await databaseConnection();
  return db.collection("standupUpdates");
};

// Insert a new standup report
const insertStandupUpdate = async (userId, update) => {
  try {
    const collection = await getStandupCollection();
    const timestamp = new Date().toISOString();

    await collection.insertOne({
      userId,
      update,
      timestamp,
    });
    console.log(`Standup update for user ${userId} saved successfully.`);
  } catch (error) {
    console.error(
      `Error saving standup update for user ${userId}:`,
      error.message
    );
  }
};

// Fetch all standup updates
const fetchStandupUpdates = async () => {
  try {
    const collection = await getStandupCollection();
    return await collection.find({}).toArray();
  } catch (error) {
    console.error("Error fetching standup updates:", error.message);
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
    return result.members.filter((userId) => userId !== "USLACKBOT"); // Exclude bots
  } catch (error) {
    console.error(
      `Error fetching members for channel ${channelId}:`,
      error.message
    );
    return [];
  }
};

// Schedule daily reminders
const scheduleDailyReminder = async () => {
  const targetUsers = await fetchChannelMembers(process.env.SLACK_CHANNEL_ID);

  schedule.scheduleJob("0 9 * * *", async () => {
    
    for (const userId of targetUsers) {
      try {
        await app.client.chat.postMessage({
          token: process.env.SLACK_BOT_TOKEN,
          channel: userId,
          text: "Good morning! Please share your daily standup update:\n1. What did you do yesterday?\n2. What are you working on today?\n3. Any blockers?",
        });
      } catch (error) {
        console.error(`Failed to send message to ${userId}:`, error.message);
      }
    }
  });
};

module.exports = {
  scheduleDailyReminder,
  fetchStandupUpdates,
  fetchChannelMembers,
  insertStandupUpdate,
  getStandupCollection,
};