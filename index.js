const app = require("./appInstance");
const dotenv = require("dotenv");
const databaseConnection = require("./db");
const {
  scheduleDailyReminder,
  fetchStandupUpdates,
  insertStandupUpdate,
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

// Handle standup updates
app.message(/standup:.+/i, async ({ message, say }) => {
  const userId = message.user;
  const userUpdate = message.text.split('standup:')[1]?.trim();
 

  if (!userUpdate) {
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

// Command: Show standup summary
app.command("/standup-summary", async ({ command, ack, say }) => {
  await ack();

  try {
    const updates = await fetchStandupUpdates();
    if (updates.length === 0) {
      await say("No updates have been recorded yet.");
      return;
    }

    let summary = "*Daily Standup Summary:*";
    updates.forEach(({ userId, update }) => {
      summary += `- <@${userId}>: ${update}
`;
    });

    await say(summary);
  } catch (error) {
    console.error("Error fetching standup summary:", error.message);
    await say("Failed to fetch the standup summary. Please try again later.");
  }
});

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

// starting the app
(async () => {
  try {
    await databaseConnection();
    await app.start(process.env.PORT || 3000);
    console.log("⚡️ Slack bot is running!");
    scheduleDailyReminder();
  } catch (error) {
    console.error("Failed to start the app:", error.message);
  }
})();

module.exports = { app };
