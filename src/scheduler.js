import cron from 'node-cron'
import pino from 'pino'
import { sendMessage } from './whatsapp.js'
import { getAllPendingReminders, updateReminderStatus, saveReminder } from './database.js'

const logger = pino()
const activeJobs = new Map()

export async function registerReminder(reminder) {
  const { id, user_phone: phone, text, trigger_time: triggerTime, recurrence } = reminder
  logger.info(`[SCHEDULER] Registering reminder ${id} for ${phone}`)
  
  try {
    const triggerDate = new Date(triggerTime)
    const now = new Date()
    const delay = triggerDate.getTime() - now.getTime()
    
    if (recurrence === 'none') {
      if (delay > 0) {
        const timeout = setTimeout(async () => {
          await fireReminder(id, phone, text)
        }, delay)
        activeJobs.set(id, { stop: () => clearTimeout(timeout) })
        logger.info(`[SCHEDULER] Scheduled one-time reminder ${id} in ${delay}ms`)
      } else {
        logger.warn(`[SCHEDULER] One-time reminder ${id} already past, firing immediately`)
        await fireReminder(id, phone, text)
      }
    } else if (recurrence === 'daily') {
      const hours = triggerDate.getHours()
      const minutes = triggerDate.getMinutes()
      const cronExpr = `${minutes} ${hours} * * *`
      
      const job = cron.schedule(cronExpr, async () => {
        await fireReminder(id, phone, text)
      })
      activeJobs.set(id, job)
      logger.info(`[SCHEDULER] Registered daily reminder ${id} with cron: ${cronExpr}`)
    } else if (recurrence === 'weekly') {
      const hours = triggerDate.getHours()
      const minutes = triggerDate.getMinutes()
      const dayOfWeek = triggerDate.getDay()
      const cronExpr = `${minutes} ${hours} * * ${dayOfWeek}`
      
      const job = cron.schedule(cronExpr, async () => {
        await fireReminder(id, phone, text)
      })
      activeJobs.set(id, job)
      logger.info(`[SCHEDULER] Registered weekly reminder ${id} with cron: ${cronExpr}`)
    }
  } catch (err) {
    logger.error(`[SCHEDULER] Error registering reminder ${id}: ${err.message}`)
  }
}

export async function fireReminder(id, phone, text) {
  logger.info(`[SCHEDULER] Firing reminder ${id} for ${phone}: ${text.substring(0, 50)}...`)
  
  try {
    await sendMessage(phone, '⏰ Reminder: ' + text)
    
    const reminders = await getAllPendingReminders()
    const reminder = reminders.find(r => r.id === id)
    
    if (reminder && reminder.recurrence === 'none') {
      await updateReminderStatus(id, 'sent')
    }
    
    if (reminder && reminder.recurrence !== 'none') {
      const nextTrigger = new Date()
      if (reminder.recurrence === 'daily') {
        nextTrigger.setDate(nextTrigger.getDate() + 1)
      } else if (reminder.recurrence === 'weekly') {
        nextTrigger.setDate(nextTrigger.getDate() + 7)
      }
      await saveReminder(
        id,
        phone,
        text,
        nextTrigger.toISOString(),
        reminder.recurrence,
        null
      )
    }
    
    if (activeJobs.has(id)) {
      const job = activeJobs.get(id)
      if (reminder?.recurrence === 'none') {
        job.stop()
        activeJobs.delete(id)
      }
    }
    
    logger.info(`[SCHEDULER] Reminder ${id} fired successfully`)
  } catch (err) {
    logger.error(`[SCHEDULER] Error firing reminder ${id}: ${err.message}`)
  }
}

export async function cancelReminder(id) {
  logger.info(`[SCHEDULER] Cancelling reminder ${id}`)
  
  if (activeJobs.has(id)) {
    const job = activeJobs.get(id)
    job.stop()
    activeJobs.delete(id)
  }
  
  await updateReminderStatus(id, 'cancelled')
  logger.info(`[SCHEDULER] Reminder ${id} cancelled`)
}

export async function reloadReminders() {
  logger.info('[SCHEDULER] Reloading pending reminders...')
  
  const pending = await getAllPendingReminders()
  logger.info(`[SCHEDULER] Found ${pending.length} pending reminders`)
  
  for (const reminder of pending) {
    await registerReminder(reminder)
  }
  
  logger.info('[SCHEDULER] Reload complete')
}
