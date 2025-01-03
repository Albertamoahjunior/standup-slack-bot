const app = require("./appInstance");
const dotenv = require("dotenv");
const databaseConnection = require("./db");
const {
  scheduleDailyReminder,
  fetchStandupUpdates,
  insertStandupUpdate,
  fetchNextPage,
  fetchIndividualUpdates,
  deleteIndividualUpdates,
} = require("./helpers");
const { WebClient } = require("@slack/web-api");

dotenv.config();
if (
  !process.env.SLACK_BOT_TOKEN ||
  !process.env.SLACK_SIGNING_SECRET ||
  !process.env.SLACK_CHANNEL_ID
) {
  throw new Error(
    "Missing required environment variables: SLACK_BOT_TOKEN, SLACK_SIGNING_SECRET, or SLACK_CHANNEL_ID"
  );
}

//configure the webclient
const slackClient = new WebClient(process.env.SLACK_BOT_TOKEN);

let user_list = {};

// Fetch all user IDs and usernames at startup
const fetchUserList = async () => {
  try {
    console.log("Fetching Slack user list...");
    const response = await slackClient.users.list();
    if (response.ok) {
      user_list = response;
      console.log("Slack user list fetched successfully.");
    } else {
      console.error("Failed to fetch user list:", response.error);
    }
  } catch (error) {
    console.error("Error fetching user list:", error.message);
  }
};

// Handle standup updates
app.message(/standup:.+/i, async ({ message, say }) => {
  const userId = message.user;
  const messageText = message.text.split("standup:")[1]?.trim();

  // checking if the message contains the '-m' flag
  const isMultiLine = messageText.startsWith("-m");

  let userUpdate = isMultiLine
    ? `[${messageText.slice(2).trim()}]`
    : messageText;

  if (!userUpdate) {
    console.log('"Please use the format: `standup: <your update>`."');
    await say("Please use the format: `standup: <your update>`.");
    return;
  }

  try {
    // fetching user profile to get name
    const result = await app.client.users.profile.get({
      token: process.env.SLACK_BOT_TOKEN,
      user: userId,
    });

    const userName =
      result.profile.display_name || result.profile.real_name || userId;

    console.log("userName:", userName);

    await insertStandupUpdate(userId, userName, userUpdate);
    await say(`<@${userId}>, your standup update has been recorded!`);
  } catch (error) {
    console.error("Error saving standup update:", error.message);
    await say("Failed to record your standup update. Please try again.");
  }
});

app.message("continue", async ({ message, say }) => {
  try {
    const { updates, hasMore } = await fetchNextPage();
    if (updates.length === 0) {
      await say("No more updates available.");
      return;
    }

    let continuationMessage = "*More Updates:*";
    updates.forEach(({ userId, update }) => {
      continuationMessage += `\n- <@${userId}>: ${update}`;
    });

    if (hasMore) {
      continuationMessage += "\nType 'continue' for more.";
    } else {
      continuationMessage += "\nEnd of Summary...";
    }

    await say(continuationMessage);
  } catch (error) {
    console.error("Error fetching more updates:", error.message);
    await say("Failed to fetch more updates. Please try again.");
  }
});

// Command: Show standup summary
app.command("/standup-summary", async ({ command, ack, say }) => {
  await ack();

  try {
    const limitNo = command.text.includes("--lm");

    let limit = 5;

    if (limitNo) {
      limit = Number(command.text.split("--lm")[1]?.trim());
      console.log("limitVal:", limit);
      if (typeof limit !== "number") {
        await say("The limit has to be a number");
        return;
      }
    }

    const { updates, hasMore } = await fetchStandupUpdates(limit);
    if (updates.length === 0) {
      await say("No updates available");
      return;
    }

    let summary = "*Daily Standup Summary:*";
    updates.forEach(({ userId, update }) => {
      summary += `- <@${userId}>: ${update}\n`;
    });

    await say(summary);

    if (hasMore) {
      await say("Type 'continue' for more");
    } else {
      say("End of Summary...");
    }
  } catch (error) {
    console.error("Error fetching standup summary:", error.message);
    await say("Failed to fetch the standup summary. Please try again later.");
  }
});

app.command("/standup-update", async ({ command, ack, say }) => {
  await ack();

  let username = command.text.trim().replace(/<@|>/g, "");
  username = username.split("@")[1];
  console.log(username);

  if (!username) {
    await say(
      "Please mention a user to get their standup update, e.g., `/standup-update @username`."
    );
    return;
  }

  try {
    const user = user_list.members.find((member) => member.name === username);

    if (!user) {
      await say(`Could not find a user with the username: @${username}`);
      return;
    }

    const userId = user.id;
    console.log(userId);
    const update = await fetchIndividualUpdates(userId);

    if (update) {
      if (update.length < 1) {
        await say(`*No Standup update for* <@${username}>`);
        return;
      }
      // If `update` is an array, map over it to extract the `update` field.
      const formattedUpdate = Array.isArray(update)
        ? update.map((item, index) => ` ${item.update}`).join("\n")
        : `Update: ${update.update}`; // If it's a single object, extract `update` field.

      await say(`*Standup update for* <@${username}>:\n${formattedUpdate}`);
    } else {
      await say(`No standup update found for <@${username}>.`);
    }
  } catch (e) {
    console.error("Error handling standup update command:", e);
    await say("Failed to fetch the standup update. Please try again later.");
  }
});

// Command: Show blockers
app.command("/standup-blockers", async ({ command, ack, say }) => {
  await ack();

  try {
    const {updates} = await fetchStandupUpdates();
  
    // Ensure updates is an array
    if (!Array.isArray(updates)) {
      throw new Error('Expected updates to be an array');
    }
  
    const blockers = updates
      .filter(({ update }) => update.toLowerCase().includes("blocker"))
      .map(({ userId, update }) => `- <@${userId}>: ${update}`);
  
    if (blockers.length === 0) {
      await say("No blockers have been reported.");
      return;
    }
  
    await say(`*Blockers Reported:*
  ${blockers.join("\n")}`);
  } catch (error) {
    console.error("Error fetching blockers:", error.message);
    await say("Failed to fetch blockers. Please try again later.");
  }
});

//reset ones update
app.command("/standup-reset", async ({ command, ack, say }) => {
  await ack();

  try {
    const userId = command.user_id; // Get the user ID of the person who issued the command
    console.log(userId);

    // Get the number from the appended command text
    const commandText = command.text.trim(); 
    let appendedNumber = parseInt(commandText, 10); 

    if(isNaN(appendedNumber)) {
      appendedNumber = null;
    }

    console.log("Appended number:", appendedNumber);

    const deleted = await deleteIndividualUpdates(userId, appendedNumber); 

    if (deleted.deletedCount > 0) {
      await say(`*Standup reset for*: - <@${userId}> with updates up to ${appendedNumber? appendedNumber: 'all'}`);
    } else {
      await say(`*No standup updates to be reset for*: - <@${userId}>.`);
    }

  } catch (e) {
    console.error("Error handling standup reset command:", e);
    await say("Failed to reset the standup update. Please try again later.");
  }
});


// starting the app
(async () => {
  try {
    await fetchUserList();
    await databaseConnection();
    await app.start(process.env.PORT || 3000);
    console.log("⚡️ Slack bot is running!");
    scheduleDailyReminder();
  } catch (error) {
    console.error("Failed to start the app:", error.message);
  }
})();

//for the vercel hosting
module.exports = async (req, res) => {
  if (req.method === "GET") {
    res.status(200).json({message: 'slackbot running', data: process.env.SLACK_APP_TOKEN});
  } else {
    res.status(405).send("Method Not Allowed");
  }
};
