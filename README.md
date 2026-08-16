# Bushbot

Telegram bot on Cloudflare Workers + TypeScript.

Commands:

- /start
- /help
- /links
- /ping
- /issue
- /cancel
- /stats
- /uptime

Features: latency measurement, feedback system, daily stats, uptime, inline keyboards.  
Stack: Cloudflare Workers, KV, TypeScript, Telegram API.

## Setup

1. Clone & npm install.
2. Add BOT_TOKEN to .dev.vars.
3. Create KV namespaces: ISSUE_STATE, STATS, UPTIME and add IDs to wrangler.jsonc.
4. Deploy: npx wrangler deploy.
5. Set webhook:  
   https://api.telegram.org/bot<TOKEN>/setWebhook?url=<WORKER_URL>/webhook
