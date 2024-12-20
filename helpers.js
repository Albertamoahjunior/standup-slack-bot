const schedule = require("node-schedule");
const app = require("./appInstance");
const databaseConnection = require("./db");

//ser the page number
let current_page = 0;

// Fetch MongoDB collection
const getStandupCollection = async () => {
  const db = await databaseConnection();
  return db.collection("standupUpdates");
};

// Insert a new standup report
const insertStandupUpdate = async (userId, userName, update) => {
  try {
    const collection = await getStandupCollection();
    const timestamp = new Date().toISOString();

    await collection.insertOne({
      userId,
      userName,
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

// Fetch standup updates with pagination
const fetchStandupUpdates = async (limit = 5, page = 0) => {
  try {
    if (limit <= 0 || page < 0)
      throw new Error("Invalid limit or page values.");
    const maxLimit = 100;
    limit = Math.min(limit, maxLimit);

    const collection = await getStandupCollection();
    const totalCount = await collection.countDocuments({});
    const skip = page * limit;

    const updates = await collection.find({}).skip(skip).limit(limit).toArray();

    const hasMore = totalCount > skip + limit;

    return { updates, hasMore };
  } catch (error) {
    console.error(
      `Error fetching updates (page: ${page}, limit: ${limit}):`,
      error.message
    );
    return { updates: [], hasMore: false };
  }
};

//fetch individual updates
const fetchIndividualUpdates = async (userId) => {
  try {
    const collection = await getStandupCollection();
    const updates = await collection.find({ userId: userId }).toArray();

    return updates ? updates : null;
  } catch (e) {
    console.log(`fetching user updates: ${e}`);
    return [];
  }
};

const deleteIndividualUpdates = async (userId, appendedNumber = null) => {
  try {
    const collection = await getStandupCollection();

    if (appendedNumber === null) {
      // Delete all updates for the user
      const deleteResult = await collection.deleteMany({ userId });
      console.log(
        `Deleted ${deleteResult.deletedCount} updates for user: ${userId}`
      );
      return deleteResult;
    }

    // Validate appendedNumber
    if (
      typeof appendedNumber !== "number" ||
      Number.isNaN(appendedNumber) ||
      appendedNumber < 1
    ) {
      console.log(
        `Invalid appended number: ${appendedNumber}. Must be a positive integer.`
      );
      return { deletedCount: 0 };
    }

    // Fetch updates to identify specific one
    const updates = await collection.find({ userId }).toArray();
    if (appendedNumber > updates.length) {
      console.log(
        `Invalid appended number: ${appendedNumber}. User has only ${updates.length} updates.`
      );
      return { deletedCount: 0 };
    }

    // Delete the specific update
    const updateToDelete = updates[appendedNumber - 1];
    if (!updateToDelete || !updateToDelete._id) {
      console.log(`Update not found for appended number: ${appendedNumber}`);
      return { deletedCount: 0 };
    }

    const deleteResult = await collection.deleteOne({
      _id: updateToDelete._id,
    });
    console.log(
      `Deleted update with _id: ${updateToDelete._id} for user: ${userId}`
    );
    return deleteResult;
  } catch (e) {
    console.error(`Error deleting updates for user ${userId}:`, e);
    return null;
  }
};

// Fetch the next page of updates (stateless)
const fetchNextPage = async (limit = 5) => {
  current_page += 1;
  try {
    return await fetchStandupUpdates(limit, current_page);
  } catch (error) {
    console.error(
      `Error fetching next page (currentPage: ${current_page}, limit: ${limit}):`,
      error.message
    );
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

//

module.exports = {
  scheduleDailyReminder,
  fetchStandupUpdates,
  fetchChannelMembers,
  insertStandupUpdate,
  getStandupCollection,
  fetchNextPage,
  fetchIndividualUpdates,
  deleteIndividualUpdates,
};
