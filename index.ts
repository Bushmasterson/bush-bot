export interface Env {
  BOT_TOKEN: string;
  ISSUE_STATE: KVNamespace;
  STATS: KVNamespace;
  UPTIME: KVNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/') {
      return new Response('Bushbot is live!', { status: 200 });
    }

    if (request.method === 'POST' && url.pathname === '/webhook') {
      try {
        const update = (await request.json()) as any;
        if (update.message) {
          await handleMessage(update.message, env);
        }
        return new Response('OK', { status: 200 });
      } catch (error) {
        console.error('Webhook error:', error);
        return new Response('Error', { status: 500 });
      }
    }

    return new Response('Not found', { status: 404 });
  },
};

let START_TIME: number | null = null;

async function handleMessage(message: any, env: Env) {
  const ADMIN_CHAT_ID = 5999490352;
  const chatId = message.chat.id;
  const BOT_VERSION = '1.0.0';
  const text = message.text || '';
  const cleanText = text.split('@')[0];
  const BOT_TOKEN = env.BOT_TOKEN;

  await incrementStat(env, 'messages');

  if (!START_TIME) {
    const storedStart = await env.UPTIME.get('start');
    if (storedStart) {
      START_TIME = parseInt(storedStart, 10);
    } else {
      START_TIME = Date.now();
      await env.UPTIME.put('start', String(START_TIME));
    }
  }

  if (text.startsWith('/')) {
    await incrementStat(env, 'requests');

    if (cleanText === '/start') {
      await sendMessage(chatId, 'Привет! Я бот Bushbot. Команды: /help', BOT_TOKEN, env);
    } else if (cleanText === '/help') {
      await sendMessage(
        chatId,
          '/links — ссылки на соцсети\n' +
          '/ping — задержка бота\n' +
          '/issue — отправить пожелание или баг-репорт\n' +
          '/cancel — отменить создание запроса\n' +
          '/stats — статистика бота\n' +
          '/uptime — время работы',
        BOT_TOKEN,
        env
      );
    } else if (cleanText === '/links') {
      const keyboard = {
        inline_keyboard: [
          [{ text: 'Сайт', url: 'https://bushmasterson.github.io' }],
          [
            { text: 'GitHub', url: 'https://github.com/Bushmasterson' },
            {
              text: 'Bluesky', url: 'https://bsky.app/profile/bushmasterson.bsky.social',
            }
          ],
        ],
      };
      await sendMessageWithKeyboard(chatId, 'Мои площадки:', BOT_TOKEN, env, keyboard);
    } else if (cleanText === '/ping') {
      const pingStart = Date.now();

      const sent = await sendMessageWithResult(chatId, 'Измеряю...', BOT_TOKEN, env);
      if (!sent || !sent.message_id) {
        await sendMessage(chatId, 'Pong! (ошибка измерения)', BOT_TOKEN, env);
        return;
      }

      const ping = Date.now() - pingStart;

      await editMessage(
        chatId,
        sent.message_id,
        'Pong!\n\nЗадержка: ' +
          ping +
          ' мс\n\n' +
          'Версия: ' +
          BOT_VERSION +
          '\n' +
          'Серверное время: ' +
          new Date().toLocaleTimeString(),
        BOT_TOKEN
      );
    } else if (cleanText === '/issue') {
      const state = await env.ISSUE_STATE.get('issue_' + message.from.id);
      if (state === 'awaiting_issue') {
        await sendMessage(
          chatId,
          'Вы уже начали создавать запрос. Напишите текст или отправьте /cancel.',
          BOT_TOKEN,
          env
        );
        return;
      }
      await env.ISSUE_STATE.put('issue_' + message.from.id, 'awaiting_issue', {
        expirationTtl: 600,
      });
      await sendMessage(
        chatId,
        'Отправьте текст вашего запроса (пожелание, баг, идея).\nЕсли передумали, отправьте /cancel.',
        BOT_TOKEN,
        env
      );
    } else if (cleanText === '/cancel') {
      const state = await env.ISSUE_STATE.get('issue_' + message.from.id);
      if (state === 'awaiting_issue') {
        await env.ISSUE_STATE.delete('issue_' + message.from.id);
        await sendMessage(chatId, 'Запрос отменён.', BOT_TOKEN, env);
      } else {
        await sendMessage(chatId, 'Нет активного запроса для отмены.', BOT_TOKEN, env);
      }
    } else if (cleanText === '/stats') {
      const stats = await getStats(env);
      const today = new Date().toISOString().slice(0, 10);
      await sendMessage(
        chatId,
        'Статистика за ' +
          today +
          '\n\n' +
          'Сообщений: ' +
          stats.messages +
          '\n' +
          'Запросов: ' +
          stats.requests +
          '\n' +
          'Ответов: ' +
          stats.answers,
        BOT_TOKEN,
        env
      );
    } else if (cleanText === '/uptime') {
      const uptimeMs = Date.now() - START_TIME!;
      const uptimeSeconds = Math.floor(uptimeMs / 1000);
      const days = Math.floor(uptimeSeconds / 86400);
      const hours = Math.floor((uptimeSeconds % 86400) / 3600);
      const minutes = Math.floor((uptimeSeconds % 3600) / 60);
      const seconds = uptimeSeconds % 60;

      let uptimeStr = '';
      if (days > 0) uptimeStr += days + 'д ';
      if (hours > 0) uptimeStr += hours + 'ч ';
      if (minutes > 0) uptimeStr += minutes + 'мин ';
      uptimeStr += seconds + 'сек';

      await sendMessage(chatId, 'Бот работает: ' + uptimeStr, BOT_TOKEN, env);
    }
  } else {
    const state = await env.ISSUE_STATE.get('issue_' + message.from.id);
    if (state === 'awaiting_issue') {
      await env.ISSUE_STATE.delete('issue_' + message.from.id);
      const userName = message.from.first_name || 'Неизвестный';
      await sendMessage(
        ADMIN_CHAT_ID,
        'Новый запрос /issue\n\n' + 'От: ' + userName + ' (ID: ' + message.from.id + ')\n' + 'Текст: ' + text,
        BOT_TOKEN,
        env
      );
      await sendMessage(chatId, 'Ваш запрос отправлен автору. Спасибо за обратную связь!', BOT_TOKEN, env);
    }
  }
}

async function getStats(env: Env): Promise<{ messages: number; requests: number; answers: number; date: string }> {
  const key = 'stats';
  const raw = await env.STATS.get(key);
  if (!raw) {
    return {
      messages: 0,
      requests: 0,
      answers: 0,
      date: new Date().toISOString().slice(0, 10),
    };
  }
  return JSON.parse(raw);
}

async function saveStats(env: Env, stats: { messages: number; requests: number; answers: number; date: string }) {
  await env.STATS.put('stats', JSON.stringify(stats));
}

async function incrementStat(env: Env, field: 'messages' | 'requests' | 'answers') {
  const stats = await getStats(env);
  const today = new Date().toISOString().slice(0, 10);
  if (stats.date !== today) {
    stats.messages = 0;
    stats.requests = 0;
    stats.answers = 0;
    stats.date = today;
  }
  stats[field] += 1;
  await saveStats(env, stats);
}

async function sendMessage(chatId: number, text: string, token: string, env: Env): Promise<void> {
  const url = 'https://api.telegram.org/bot' + token + '/sendMessage';
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: text }),
    });
    await incrementStat(env, 'answers');
  } catch (error) {
    console.error('Ошибка отправки:', error);
  }
}

async function sendMessageWithKeyboard(
  chatId: number,
  text: string,
  token: string,
  env: Env,
  keyboard: any
): Promise<void> {
  const url = 'https://api.telegram.org/bot' + token + '/sendMessage';
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: text, reply_markup: keyboard }),
    });
    await incrementStat(env, 'answers');
  } catch (error) {
    console.error('Ошибка отправки с клавиатурой:', error);
  }
}

async function sendMessageWithResult(chatId: number, text: string, token: string, env: Env): Promise<any> {
  const url = 'https://api.telegram.org/bot' + token + '/sendMessage';
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: text }),
    });
    const data = (await response.json()) as any;
    if (data.ok) {
      await incrementStat(env, 'answers');
    }
    return data.result || null;
  } catch (error) {
    console.error('Ошибка отправки с результатом:', error);
    return null;
  }
}
async function editMessage(chatId: number, messageId: number, text: string, token: string): Promise<void> {
  const url = 'https://api.telegram.org/bot' + token + '/editMessageText';
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId, text: text }),
    });
  } catch (error) {
    console.error('Ошибка редактирования:', error);
  }
}
