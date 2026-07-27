const { Telegraf } = require('telegraf');
const Parser = require('rss-parser');
const cron = require('node-cron');
require('dotenv').config();

// Validate required environment variables
if (!process.env.BOT_TOKEN) {
  console.error('ERROR: BOT_TOKEN environment variable is not set');
  process.exit(1);
}

if (!process.env.CHANNEL_ID) {
  console.error('ERROR: CHANNEL_ID environment variable is not set');
  process.exit(1);
}

const bot = new Telegraf(process.env.BOT_TOKEN);
const parser = new Parser();
const CHANNEL_ID = process.env.CHANNEL_ID;

// Free, no-key-needed sports RSS feeds — mix a couple for variety
const FEEDS = [
  'https://www.espn.com/espn/rss/news',
  'https://feeds.bbci.co.uk/sport/rss.xml'
];

async function fetchHeadlines(limit = 5) {
  const items = [];
  for (const url of FEEDS) {
    try {
      const feed = await parser.parseURL(url);
      items.push(...feed.items.slice(0, 3));
    } catch (err) {
      console.error(`Failed to fetch ${url}:`, err.message);
    }
  }
  // Shuffle and trim so it's not always the same source first
  return items.sort(() => Math.random() - 0.5).slice(0, limit);
}

function formatPost(items) {
  const date = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  let text = `🏆 Sports Daily — ${date}\n\n`;
  items.forEach((item, i) => {
    text += `${i + 1}. ${item.title}\n${item.link}\n\n`;
  });
  return text.trim();
}

async function postDaily() {
  try {
    const headlines = await fetchHeadlines();
    if (headlines.length === 0) {
      console.log('No headlines fetched — skipping today.');
      return;
    }
    const message = formatPost(headlines);
    await bot.telegram.sendMessage(CHANNEL_ID, message, { disable_web_page_preview: false });
    console.log('Posted daily sports digest.');
  } catch (err) {
    console.error('Error posting daily digest:', err.message);
  }
}

// Schedule: runs once a day at POST_HOUR_UTC
const hour = process.env.POST_HOUR_UTC || '8';
console.log(`Scheduled daily post at ${hour}:00 UTC`);
cron.schedule(`0 ${hour} * * *`, postDaily);

// Optional: manual trigger command for testing (message the bot directly, not the channel)
bot.command('postnow', async (ctx) => {
  try {
    await postDaily();
    ctx.reply('Posted to channel.');
  } catch (err) {
    ctx.reply(`Error: ${err.message}`);
  }
});

// Start the bot with error handling
async function startBot() {
  try {
    console.log('Starting Sports Daily bot...');
    await bot.launch();
    console.log('Sports Daily bot is running.');
  } catch (err) {
    console.error('Failed to start bot:', err.message);
    console.error('Check your BOT_TOKEN and ensure the bot is valid.');
    process.exit(1);
  }
}

startBot();

process.once('SIGINT', () => {
  console.log('Shutting down...');
  bot.stop('SIGINT');
});
process.once('SIGTERM', () => {
  console.log('Shutting down...');
  bot.stop('SIGTERM');
});

