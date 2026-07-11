require('dotenv').config();
const { Telegraf } = require('telegraf');

const bot = new Telegraf(process.env.BOT_TOKEN);

bot.start((ctx) => {
    ctx.reply('Привет! Я бот BushCode.');
});

bot.help((ctx) => {
    ctx.reply('/github — ссылка на GitHub\n/rules — правила');
});

bot.command('github', (ctx) => {
    ctx.reply('https://github.com/Bushmasterson');
});

bot.command('rules', (ctx) => {
    ctx.reply('📌 Правила чата: https://telegra.ph/Zapovedi-setki-chatov-02-17');
});

bot.launch();
console.log('Бот запущен...');
