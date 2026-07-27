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
  const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'UTC' });
  let text = `🏆 Sports Daily — ${date} (${time} UTC)\n\n`;
  items.forEach((item, i) => {
    text += `${i + 1}. ${item.title}\n${item.link}\n\n`;
  });
  return text.trim();
}

async function postDaily() {
  try {
    const headlines = await fetchHeadlines();
    if (headlines.length === 0) {
      console.log('No headlines fetched — skipping post.');
      return;
    }
    const message = formatPost(headlines);
    await bot.telegram.sendMessage(CHANNEL_ID, message, { disable_web_page_preview: false });
    console.log(`[${new Date().toISOString()}] Posted sports digest`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Error posting digest:`, err.message);
  }
}

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
    console.log(`[${new Date().toISOString()}] Starting Sports Daily bot...`);
    
    // Set up graceful error handling for polling
    bot.catch((err, ctx) => {
      console.error(`[${new Date().toISOString()}] Bot error:`, err);
    });
    
    // Launch with polling, but stop gracefully on error
    await bot.launch();
    console.log(`[${new Date().toISOString()}] Bot is running. Setting up posting schedule...`);
    
    // Post immediately on startup
    console.log(`[${new Date().toISOString()}] Posting first digest now...`);
    await postDaily();
    
    // Then schedule posts every 25 minutes
    console.log(`[${new Date().toISOString()}] Scheduling posts every 25 minutes...`);
    cron.schedule('*/25 * * * *', postDaily);
    
    console.log(`[${new Date().toISOString()}] ✅ Bot fully initialized and posting`);
    
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Failed to start bot:`, err.message);
    console.error('Check your BOT_TOKEN and CHANNEL_ID.');
    
    // Wait 5 seconds before retrying
    console.log('Retrying in 5 seconds...');
    setTimeout(() => {
      process.exit(1);
    }, 5000);
  }
}

startBot();

// Graceful shutdown
process.once('SIGINT', () => {
  console.log(`[${new Date().toISOString()}] SIGINT received, shutting down...`);
  bot.stop('SIGINT');
  process.exit(0);
});

process.once('SIGTERM', () => {
  console.log(`[${new Date().toISOString()}] SIGTERM received, shutting down...`);
  bot.stop('SIGTERM');
  process.exit(0);
});

