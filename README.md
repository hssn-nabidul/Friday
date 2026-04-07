# Friday - WhatsApp AI Assistant Bot

A WhatsApp AI assistant bot powered by Gemini, built with Node.js.

## Features

- AI-powered intent parsing using Gemini
- Set, list, and cancel reminders
- Voice note transcription and intent extraction
- Persistent user and message storage with Turso (libSQL)
- Scheduled reminders with node-cron

## Tech Stack

- Node.js 20+
- @whiskeysockets/baileys - WhatsApp Web client
- @google/generative-ai - Gemini SDK
- @libsql/client - Turso database
- node-cron - Scheduler
- pino - Logging

## Setup

1. Install dependencies:
```bash
npm install
```

2. Copy `.env.example` to `.env` and fill in values:
```bash
cp .env.example .env
```

3. Configure your `.env`:
- `GEMINI_API_KEY` - Get from Google AI Studio
- `TURSO_DATABASE_URL` - Your Turso database URL
- `TURSO_AUTH_TOKEN` - Your Turso auth token
- `OWNER_PHONE` - Your WhatsApp number (without +)
- `GROUP_PHONES` - Comma-separated list of allowed numbers

4. Start the bot:
```bash
npm start
```

5. Scan the QR code with WhatsApp (Settings → Linked Devices → Link a Device)

## Usage

- Set a reminder: "Remind me to call mom tomorrow at 9am"
- List reminders: "Show my reminders"
- Cancel reminder: "Cancel reminder to call mom"
- General chat: "Hello Friday"

## Deployment

For deployment (e.g., Render, Railway), ensure:
- Session files in `auth_info/` persist across restarts
- Environment variables are set in the dashboard
- For ephemeral filesystems, re-scan QR on each deploy
