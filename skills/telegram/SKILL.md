---
name: telegram
description: "Send messages and manage Telegram bots via the Bot API."
metadata: {"moltbot":{"emoji":"✈️","requires":{"bins":["curl","jq"],"env":["TELEGRAM_BOT_TOKEN"]}}}
---

# Telegram Bot

Send messages and manage bots via the Telegram Bot API.

## Environment Variables

- `TELEGRAM_BOT_TOKEN` - Bot token from @BotFather

## Send message

```bash
curl -s -X POST \
  "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
  -H "Content-Type: application/json" \
  -d '{"chat_id":"CHAT_ID","text":"Hello from Clawdbot!"}' | jq '{ok, result: {message_id, chat: .result.chat.title}}'
```

## Get updates

```bash
curl -s "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getUpdates?limit=10" | jq '.result[] | {update_id, message: {from: .message.from.username, text: .message.text}}'
```

## Get bot info

```bash
curl -s "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getMe" | jq '.result'
```

## Send photo

```bash
curl -s -X POST \
  "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendPhoto" \
  -F "chat_id=CHAT_ID" -F "photo=@/path/to/photo.jpg" -F "caption=Photo caption" | jq '{ok}'
```

## Notes

- Always confirm before sending messages.
- Get chat_id from getUpdates after sending a message to the bot.
