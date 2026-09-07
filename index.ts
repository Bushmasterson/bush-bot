export interface Env {
  BOT_TOKEN: string;
  ISSUE_STATE: KVNamespace;
  STATS: KVNamespace;
  UPTIME: KVNamespace;
  USERS: KVNamespace; // NEW: username -> user_id кэш для /ban
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
  const BOT_TOKEN = env.BOT_TOKEN;

  await incrementStat(env, 'messages');

  // NEW: запоминаем username -> id каждого написавшего, чтобы /ban мог его найти
  if (message.from && message.from.username) {
    await env.USERS.put('username_' + message.from.username.toLowerCase(), String(message.from.id));
  }

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

    // NEW: аккуратный разбор команды и аргументов
    // (старый split('@')[0] по всему тексту ломал бы "/ban @username")
    const parts = text.trim().split(/\s+/);
    const cleanCommand = parts[0].split('@')[0]; // срезаем "@BushBot" если команда вида /ban@BushBot
    const args = parts.slice(1).join(' ');

    if (cleanCommand === '/start') {
      await sendMessage(chatId, 'Привет! Я бот Bushbot. Команды: /help', BOT_TOKEN, env);
    } else if (cleanCommand === '/help') {
      await sendMessage(
        chatId,
          '/links — ссылки на соцсети\n' +
          '/ping — задержка бота\n' +
          '/issue — отправить пожелание или баг-репорт\n' +
          '/cancel — отменить создание запроса\n' +
          '/rules — правила чата\n' +
          '/ban — забанить пользователя (только для админа)\n' +
          '/stats — статистика бота\n' +
          '/uptime — время работы',
        BOT_TOKEN,
        env
      );
    } else if (cleanCommand === '/links') {
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
    } else if (cleanCommand === '/ping') {
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
    } else if (cleanCommand === '/issue') {
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
    } else if (cleanCommand === '/cancel') {
      const state = await env.ISSUE_STATE.get('issue_' + message.from.id);
      if (state === 'awaiting_issue') {
        await env.ISSUE_STATE.delete('issue_' + message.from.id);
        await sendMessage(chatId, 'Запрос отменён.', BOT_TOKEN, env);
      } else {
        await sendMessage(chatId, 'Нет активного запроса для отмены.', BOT_TOKEN, env);
      }
    } else if (cleanCommand === '/rules') {
      // NEW
      await sendMessage(chatId, '📌 Правила чата: https://t.me/bushnewschat/4556', BOT_TOKEN, env);
    } else if (cleanCommand === '/ban') {
      // NEW
      if (message.from.id !== ADMIN_CHAT_ID) {
        await sendMessage(chatId, 'У вас нет прав для этой команды.', BOT_TOKEN, env);
        return;
      }
      if (!args) {
        await sendMessage(chatId, 'Использование: /ban @username', BOT_TOKEN, env);
        return;
      }
      const usernameArg = args.trim().replace(/^@/, '').toLowerCase();
      const targetId = await env.USERS.get('username_' + usernameArg);
      if (!targetId) {
        await sendMessage(
          chatId,
          'Не нашёл @' + usernameArg + ' — он должен был хотя бы раз написать в этот чат, чтобы бот его запомнил.',
          BOT_TOKEN,
          env
        );
        return;
      }
      const success = await banChatMember(chatId, parseInt(targetId, 10), BOT_TOKEN);
      await sendMessage(
        chatId,
        success
          ? 'Пользователь @' + usernameArg + ' забанен.'
          : 'Не удалось забанить — проверь, что у бота есть права администратора в этом чате.',
        BOT_TOKEN,
        env
      );
    } else if (cleanCommand === '/stats') {
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
    } else if (cleanCommand === '/uptime') {
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

// NEW: реальный бан через Telegram Bot API
async function banChatMember(chatId: number, userId: number, token: string): Promise<boolean> {
  const url = 'https://api.telegram.org/bot' + token + '/banChatMember';
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, user_id: userId }),
    });
    const data = (await response.json()) as any;
    return !!data.ok;
  } catch (error) {
    console.error('Ошибка бана:', error);
    return false;
  }
}
