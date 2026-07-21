const BOT_TOKEN = 'AAEFY_M3ptUrrGhcc7-tlNS11EC4cKYLee0';
let lastUpdateId = 0;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/') {
      return new Response('✅ Bot is running (Long Polling)', { status: 200 });
    }

    if (url.pathname === '/poll') {
      // Запускаем бесконечный опрос
      await startPolling();
      return new Response('✅ Polling started', { status: 200 });
    }

    return new Response('❌ Not found', { status: 404 });
  }
};

async function startPolling() {
  while (true) {
    try {
      const offset = lastUpdateId + 1;
      const apiUrl = `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=${offset}&timeout=3`;
      const response = await fetch(apiUrl);
      const data = await response.json();

      if (data.ok && data.result.length > 0) {
        for (const update of data.result) {
          if (update.message) {
            await handleMessage(update.message);
          }
          if (update.update_id > lastUpdateId) {
            lastUpdateId = update.update_id;
          }
        }
      }
    } catch (error) {
      console.error('Polling error:', error);
    }

    // Ждём 3 секунды перед следующим запросом
    await sleep(3000);
  }
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function handleMessage(message) {
  const chatId = message.chat.id;
  const text = message.text;

  if (text === '/start') {
    await sendMessage(chatId, '👋 Привет! Я бот Bushbot. Команды: /help');
  } else if (text === '/help') {
    await sendMessage(chatId, '🎶 /github — ссылка на GitHub\n/rules — правила\n/ping — задержка бота');
  } else if (text === '/github') {
    await sendMessage(chatId, '👾 https://github.com/Bushmasterson');
  } else if (text === '/rules') {
    await sendMessage(chatId, '📌 Правила чата: https://t.me/bushnewschat/4556');
  } else if (text === '/ping') {
    const start = Date.now();
    await sendMessage(chatId, '🏓 Измеряю задержку...');
    const ping = Date.now() - start;
    await sendMessage(chatId, '🏓 Pong!\n\nЗадержка: ' + ping + ' мс\nВерсия: 26.7.2.1\nСерверное время: ' + new Date().toLocaleTimeString());
  }
}

async function sendMessage(chatId, text) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
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