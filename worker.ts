import { Telegraf } from 'telegraf';

export default {
  async fetch(request: Request, env: any) {
    // 1. Проверяем, что токен получен из переменных окружения
    const token = env.BOT_TOKEN;
    if (!token) {
      return new Response('BOT_TOKEN is not set', { status: 500 });
    }

    const bot = new Telegraf(token);

    // 2. Обрабатываем команды
    bot.start((ctx) => ctx.reply('Привет! Я бот BushCode.'));
    bot.help((ctx) => ctx.reply('/github — ссылка на GitHub\n/rules — правила'));
    bot.command('github', (ctx) => ctx.reply('https://github.com/Bushmasterson'));
    bot.command('rules', (ctx) => ctx.reply('📌 Правила чата: https://telegra.ph/Zapovedi-setki-chatov-02-17'));

    // 3. Обрабатываем любой текст
    bot.on('text', (ctx) => {
      ctx.reply('Я получил твоё сообщение: ' + ctx.message.text);
    });

    // 4. Обрабатываем входящие запросы
    const url = new URL(request.url);

    if (url.pathname === '/webhook' && request.method === 'POST') {
      try {
        const body = await request.json() as any;
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