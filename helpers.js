const schedule = require("node-schedule");
const app = require("./appInstance");
const databaseConnection = require("./db");

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
const fetchStandupUpdates = async (limit = 5, message) => {
  try {
    const collection = await getStandupCollection();

    // counting the total documents in the collection
    const totalCount = await collection.countDocuments({});

    // fetched updates limited to 5 documents per call
    const updates = await collection.find({}).limit(limit).toArray();

    // checking if there are more documents in the collection
    const hasMore = totalCount > limit;

    // let remainder = totalCount;
    // for (let i = 0; i <= totalCount; i++) {
    //   if (message === "continue" && i < remainder) {
    //     remainder -= limit;
    //   }
    //   return remainder;
    // }

    return { updates, hasMore };

    // return await collection.find({}).limit(limit).toArray();
  } catch (error) {
    console.error("Error fetching standup updates:", error.message);
    return { updates: [], hasMore: false };
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
