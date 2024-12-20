const app = require("./appInstance");
const dotenv = require("dotenv");
const databaseConnection = require("./db");
const {
  scheduleDailyReminder,
  fetchStandupUpdates,
  insertStandupUpdate,
  fetchNextPage,
  fetchIndividualUpdates,
} = require("./helpers");

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

// //keep the page counter
// const userPageTracker = {}

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
    await insertStandupUpdate(userId, userUpdate);
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
    const { updates, hasMore } = await fetchStandupUpdates();
    if (updates.length === 0) {
      await say("No updates available");
      return;
    }

    let summary = "*Daily Standup Summary:*";
    updates.forEach(({ userId, update }) => {
      summary += `- <@${userId}>: ${update}
`;
    });

    if (hasMore) {
      await say(summary);
      await say("type 'continue' for more");
    } else {
      say("End of Summary...");
    }
  } catch (error) {
    console.error("Error fetching standup summary:", error.message);
    await say("Failed to fetch the standup summary. Please try again later.");
  }
});


// command for fetching update of a single user
app.command("/standup-update", async ({ command, ack, say }) => {
  await ack();

  const userId = command.text.trim().replace(/<@|>/g, "");

  if (!userId) {
    await say(
      "Please mention a user to get their standup update, e.g., `/standup-update @username`."
    );
    return;
  }

  try {
    const update = await fetchIndividualUpdates(userId);

    if (update) {
      await say(`Standup update for <@${userId}>: ${update}`);
    } else {
      await say(`No standup update found for <@${userId}>.`);
    }
  } catch (e) {
    console.error("Error handling standup update command:", error);
    await say("Failed to fetch the standup update. Please try again later.");
  }
})

// Command: Show blockers
app.command("/standup-blockers", async ({ command, ack, say }) => {
  await ack();

  try {
    const updates = await fetchStandupUpdates();
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


(

  // starting the app
  async () => {
    try {
      await databaseConnection();
      await app.start(process.env.PORT || 3000);
      console.log("⚡️ Slack bot is running!");
      scheduleDailyReminder();
    } catch (error) {
      console.error("Failed to start the app:", error.message);
    }
  }
)();

//for the vercel hosting
module.exports = async (req, res) => {
  if (req.method === "GET") {
    res.status(200).send("Slack bot is running!");
  } else {
    res.status(405).send("Method Not Allowed");
  }
};
