import pino from 'pino'
import { upsertUser, saveMessage, getLastMessages, saveReminder, getPendingReminders, updateReminderStatus } from './database.js'
import { parseIntent, transcribeAndParse } from './gemini.js'
import { sendMessage, downloadAudio } from './whatsapp.js'
import { registerReminder, cancelReminder } from './scheduler.js'

const logger = pino()

export async function processMessage(payload) {
  const { phone, type } = payload
  logger.info(`[PROCESSOR] Processing message from ${phone}, type: ${type}`)
  
  try {
    await upsertUser(phone, payload.name || 'Unknown')
    
    let intent
    
    if (type === 'audio') {
      const audioBuffer = await downloadAudio(payload.message)
      intent = await transcribeAndParse(audioBuffer, phone)
      await saveMessage(phone, 'user', '[voice note]')
    } else {
      intent = await parseIntent(payload.content, phone)
      await saveMessage(phone, 'user', payload.content)
    }
    
    await saveMessage(phone, 'assistant', intent.reply_to_user)
    await sendMessage(phone, intent.reply_to_user)
    
    if (intent.intent === 'set_reminder') {
      const id = crypto.randomUUID()
      await saveReminder(
        id,
        phone,
        intent.reminder_text,
        intent.trigger_datetime_iso,
        intent.recurrence || 'none',
        null
      )
      await registerReminder({
        id,
        user_phone: phone,
        text: intent.reminder_text,
        trigger_time: intent.trigger_datetime_iso,
        recurrence: intent.recurrence || 'none'
      })
      logger.info(`[PROCESSOR] Set reminder ${id} for ${phone}`)
    }
    
    if (intent.intent === 'list_reminders') {
      const pending = await getPendingReminders(phone)
      let reply
      if (pending.length > 0) {
        const list = pending.map((r, i) => `${i + 1}. ${r.text} (due: ${r.trigger_time})`).join('\n')
        reply = `Your pending reminders:\n${list}`
      } else {
        reply = 'You have no pending reminders.'
      }
      await sendMessage(phone, reply)
    }
    
    if (intent.intent === 'cancel_reminder') {
      const pending = await getPendingReminders(phone)
      const matched = pending.find(r => 
        r.text.toLowerCase().includes(intent.reminder_text?.toLowerCase() || '')
      )
      if (matched) {
        await cancelReminder(matched.id)
        await sendMessage(phone, `Reminder cancelled: ${matched.text}`)
      } else {
        await sendMessage(phone, 'No matching reminder found to cancel.')
      }
    }
    
    logger.info(`[PROCESSOR] Message processed successfully`)
  } catch (err) {
    logger.error(`[PROCESSOR] Error processing message: ${err.message}`)
    try {
      await sendMessage(phone, 'Sorry, something went wrong. Please try again.')
    } catch (e) {
      logger.error(`[PROCESSOR] Error sending error message: ${e.message}`)
    }
  }
}
