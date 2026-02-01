# Telegram News Scrapper

Telegram bot for weekly music news digests powered by OpenAI and Exa.ai.

## Setup

1. Copy `.env.example` to `.env` and fill in your API keys
2. `npm install`
3. `npm start`

## Commands

- `/start` — Welcome message
- `/news` — Get top 10 music news of the week
- Any text message — AI-powered music expert response

## Environment Variables

- `TELEGRAM_BOT_TOKEN` — Telegram Bot API token
- `OPENAI_API_KEY` — OpenAI API key
- `EXA_API_KEY` — Exa.ai API key
