import dotenv from 'dotenv'
dotenv.config()

export const config = {
  geminiApiKey: process.env.GEMINI_API_KEY,
  tursoUrl: process.env.TURSO_DATABASE_URL,
  tursoToken: process.env.TURSO_AUTH_TOKEN,
  ownerPhone: process.env.OWNER_PHONE,
  allowedPhones: process.env.GROUP_PHONES?.split(',') || [],
  botName: process.env.BOT_NAME || 'Friday'
}
