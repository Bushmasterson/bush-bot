export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Если кто-то открыл страницу — просто покажи, что бот жив
    if (url.pathname === '/') {
      return new Response('🤖 Bushbot is live!', { status: 200 });
    }

    // Обработка вебхука от Telegram
    if (request.method === 'POST' && url.pathname === '/webhook') {
      try {
        const update = await request.json();
        if (update.message) {
          await handleMessage(update.message, env);
        }
        return new Response('OK', { status: 200 });
      } catch (error) {
        console.error('Webhook error:', error);
        return new Response('Error', { status: 500 });
      }
    }

    // Всё остальное — 404
    return new Response('Not found', { status: 404 });
  }
};

async function handleMessage(message, env) {
  const chatId = message.chat.id;
  const BOT_VERSION = '26.7.2.1'; // Версия бота
  const text = message.text;
  const BOT_TOKEN = env.BOT_TOKEN; // Токен из Cloudflare Environment Variables

  if (text === '/start') {
    await sendMessage(chatId, '👋 Привет! Я бот Bushbot. Команды: /help', BOT_TOKEN);
  } else if (text === '/help') {
    await sendMessage(chatId, '🎶 /github — ссылка на GitHub\n/rules — правила\n/ping — задержка бота', BOT_TOKEN);
  } else if (text === '/github') {
    await sendMessage(chatId, '👾 https://github.com/Bushmasterson', BOT_TOKEN);
  } else if (text === '/rules') {
    await sendMessage(chatId, '📌 Правила чата: https://t.me/bushnewschat/4556', BOT_TOKEN);
  } else if (text === '/ping') {
    const start = Date.now();
    await sendMessage(chatId, '🏓 Измеряю задержку...', BOT_TOKEN);
    const ping = Date.now() - start;
    await sendMessage(chatId, '🏓 Pong!\n\nЗадержка: ' + ping + ' мс\n\nВерсия: ' + BOT_VERSION + '\n\nСерверное время: ' + new Date().toLocaleTimeString(), BOT_TOKEN);
  }
}

async function sendMessage(chatId, text, token) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: text }),
    });
  } catch (error) {
    console.error('Ошибка отправки:', error);
  }
}