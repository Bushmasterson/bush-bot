import { Telegraf } from 'telegraf';

export default {
  async fetch(request, env) {
    // 1. Проверяем, что токен получен из переменных окружения
    const token = env.BOT_TOKEN;
    if (!token) {
      return new Response('BOT_TOKEN is not set', { status: 500 });
    }

    const bot = new Telegraf(token);
    const BOT_VERSION = '1.0.1';

    // 2. Обрабатываем команды
    bot.start((ctx) => ctx.reply('Привет! Я бот Bushbot, и я создан для помощи в чатах @bushmasterson. Список команд: /help.'));
    bot.help((ctx) => ctx.reply('/github — ссылка на GitHub\n/rules — правила\n/ping — задержка бота'));
    bot.command('github', (ctx) => ctx.reply('https://github.com/Bushmasterson'));
    bot.command('rules', (ctx) => ctx.reply('📌 Правила чата: https://t.me/bushnewschat/4556'));
    bot.command('ping', async (ctx) => {
      const start = Date.now();
      const msg = await ctx.reply('🏓 Измеряю задержку...');
      const ping = Date.now() - start;
      await ctx.telegram.editMessageText(
        msg.chat.id,
        msg.message_id,
        null,
        '🏓 Pong!\n\nЗадержка: ' + ping + ' мс\nВерсия бота: ' + BOT_VERSION + '\nСерверное время: ' + new Date().toLocaleTimeString()
      );
    });

    // 3. Обрабатываем входящие запросы
    const url = new URL(request.url);

    if (url.pathname === '/webhook' && request.method === 'POST') {
      try {
        const body = await request.json();
        await bot.handleUpdate(body);
        return new Response('OK', { status: 200 });
      } catch (error) {
        console.error('Webhook error:', error);
        return new Response('Error: ' + String(error), { status: 500 });
      }
    }

    if (url.pathname === '/' && request.method === 'GET') {
      return new Response('Bot is running!', { status: 200 });
    }

    return new Response('Not found', { status: 404 });
  }
};
