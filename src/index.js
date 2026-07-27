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

// Free, no-key-needed sports RSS feeds
const FEEDS = [
  'https://www.espn.com/espn/rss/news',
  'https://feeds.bbci.co.uk/sport/rss.xml'
];

async function fetchHeadlines(limit = 5) {\n  const items = [];
  for (const url of FEEDS) {
    try {
      const feed = await parser.parseURL(url);
      items.push(...feed.items.slice(0, 3));
    } catch (err) {
      console.error(`Failed to fetch ${url}:`, err.message);
    }
  }
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
      console.log(`[${new Date().toISOString()}] No headlines fetched — skipping post.`);
      return;
    }
    const message = formatPost(headlines);
    await bot.telegram.sendMessage(CHANNEL_ID, message, { disable_web_page_preview: false });
    console.log(`[${new Date().toISOString()}] ✅ Posted sports digest to channel`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] ❌ Error posting digest:`, err.message);
  }
}

async function startBot() {
  console.log(`[${new Date().toISOString()}] 🤖 SportsPulseBot starting...`);
  
  try {
    // Test the bot token by calling getMe
    const me = await bot.telegram.getMe();
    console.log(`[${new Date().toISOString()}] ✅ Bot authenticated as @${me.username}`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] ❌ Bot authentication failed:`, err.message);
    process.exit(1);
  }

  // Post immediately on startup
  console.log(`[${new Date().toISOString()}] 📤 Posting first digest now...`);
  await postDaily();

  // Schedule posts every 25 minutes
  console.log(`[${new Date().toISOString()}] ⏰ Scheduling posts every 25 minutes...`);
  cron.schedule('*/25 * * * *', postDaily);

  // Optional: handle /postnow command if someone messages the bot
  bot.command('postnow', async (ctx) => {
    console.log(`[${new Date().toISOString()}] 📱 /postnow command received`);
    try {
      await postDaily();
      ctx.reply('✅ Posted to channel.');
    } catch (err) {
      ctx.reply(`❌ Error: ${err.message}`);
    }
  });

  console.log(`[${new Date().toISOString()}] ✅ Bot is ready and running!\n`);
}

startBot();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log(`\n[${new Date().toISOString()}] 🛑 Shutting down...`);
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log(`\n[${new Date().toISOString()}] 🛑 Shutting down...`);
  process.exit(0);
});

