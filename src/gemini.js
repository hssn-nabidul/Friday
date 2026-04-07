import { GoogleGenerativeAI } from '@google/generative-ai'
import { z } from 'zod'
import pino from 'pino'
import { config } from './config.js'
import { getLastMessages } from './database.js'

const logger = pino()

const genAI = new GoogleGenerativeAI(config.geminiApiKey)
const model = genAI.getGenerativeModel({
  model: 'gemini-2.0-flash',
  generationConfig: {
    responseMimeType: 'application/json'
  }
})

const IntentSchema = z.object({
  intent: z.enum([
    'set_reminder',
    'list_reminders',
    'cancel_reminder',
    'general_chat',
    'unknown'
  ]),
  reminder_text: z.string().nullable(),
  trigger_datetime_iso: z.string().nullable(),
  recurrence: z.enum(['none', 'daily', 'weekly']).nullable(),
  reply_to_user: z.string()
})

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function retryWithBackoff(fn, maxAttempts = 3, baseDelay = 4000) {
  let lastError
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      logger.warn(`[GEMINI] Attempt ${attempt} failed: ${err.message}`)
      if (attempt < maxAttempts) {
        const delay = baseDelay * Math.pow(2, attempt - 1)
        await sleep(delay)
      }
    }
  }
  throw lastError
}

export async function parseIntent(text, phone) {
  logger.info(`[GEMINI] Parsing intent for ${phone}: ${text.substring(0, 50)}...`)
  
  const lastMessages = await getLastMessages(phone, 5)
  const historyStr = lastMessages.length > 0
    ? lastMessages.map(m => `${m.role}: ${m.content}`).join('\n')
    : 'No previous messages'
  
  const now = new Date().toISOString()
  const systemPrompt = `You are a WhatsApp AI assistant called ${config.botName}.
Current UTC time: ${now}
User timezone: Asia/Kolkata
Recent conversation:
${historyStr}

Parse the user message and return ONLY valid JSON matching this schema exactly — no markdown, no extra text:
{
  "intent": "set_reminder" | "list_reminders" | "cancel_reminder" | "general_chat" | "unknown",
  "reminder_text": string | null,
  "trigger_datetime_iso": string | null,
  "recurrence": "none" | "daily" | "weekly" | null,
  "reply_to_user": string
}`

  return retryWithBackoff(async () => {
    const result = await model.generateContent([
      { text: systemPrompt },
      { text: text }
    ])
    
    const responseText = result.response.text().trim()
    logger.info(`[GEMINI] Raw response: ${responseText.substring(0, 200)}`)
    
    const parsed = JSON.parse(responseText)
    const intent = IntentSchema.parse(parsed)
    logger.info(`[GEMINI] Parsed intent: ${intent.intent}`)
    return intent
  })
}

export async function transcribeAndParse(audioBuffer, phone) {
  logger.info(`[GEMINI] Transcribing audio for ${phone}`)
  
  const lastMessages = await getLastMessages(phone, 5)
  const historyStr = lastMessages.length > 0
    ? lastMessages.map(m => `${m.role}: ${m.content}`).join('\n')
    : 'No previous messages'
  
  const now = new Date().toISOString()
  const systemPrompt = `You are a WhatsApp AI assistant called ${config.botName}.
Current UTC time: ${now}
User timezone: Asia/Kolkata
Recent conversation:
${historyStr}

Transcribe this voice note then parse intent. Return ONLY valid JSON matching this schema:
{
  "intent": "set_reminder" | "list_reminders" | "cancel_reminder" | "general_chat" | "unknown",
  "reminder_text": string | null,
  "trigger_datetime_iso": string | null,
  "recurrence": "none" | "daily" | "weekly" | null,
  "reply_to_user": string
}`

  return retryWithBackoff(async () => {
    const result = await model.generateContent([
      { text: systemPrompt },
      { text: 'Transcribe this voice note and extract intent from it.' },
      {
        inlineData: {
          mimeType: 'audio/ogg',
          data: audioBuffer.toString('base64')
        }
      }
    ])
    
    const responseText = result.response.text().trim()
    logger.info(`[GEMINI] Raw transcription response: ${responseText.substring(0, 200)}`)
    
    const parsed = JSON.parse(responseText)
    const intent = IntentSchema.parse(parsed)
    logger.info(`[GEMINI] Parsed intent from audio: ${intent.intent}`)
    return intent
  })
}
