import { createClient } from '@libsql/client'
import { config } from './config.js'
import pino from 'pino'

const logger = pino()

let client

function getClient() {
  if (!client) {
    const url = config.tursoUrl.replace('libsql://', 'https://')
    client = createClient({
      url,
      authToken: config.tursoToken
    })
  }
  return client
}

export async function initDb() {
  logger.info('[DB] Initializing database...')
  const c = getClient()
  
  await c.execute({
    sql: `CREATE TABLE IF NOT EXISTS users (
      phone TEXT PRIMARY KEY,
      name TEXT,
      timezone TEXT DEFAULT 'Asia/Kolkata',
      created_at TEXT
    )`,
    args: []
  })
  
  await c.execute({
    sql: `CREATE TABLE IF NOT EXISTS reminders (
      id TEXT PRIMARY KEY,
      user_phone TEXT,
      text TEXT,
      trigger_time TEXT,
      cron_expr TEXT,
      recurrence TEXT DEFAULT 'none',
      status TEXT DEFAULT 'pending'
    )`,
    args: []
  })
  
  await c.execute({
    sql: `CREATE TABLE IF NOT EXISTS messages (
      id INTEGER,
      user_phone TEXT,
      role TEXT,
      content TEXT,
      timestamp TEXT
    )`,
    args: []
  })
  
  logger.info('[DB] Database initialized')
}

export async function upsertUser(phone, name = null) {
  try {
    const c = getClient()
    await c.execute({
      sql: `INSERT INTO users (phone, name, timezone, created_at)
            VALUES (?, ?, 'Asia/Kolkata', datetime('now'))
            ON CONFLICT(phone) DO UPDATE SET name = excluded.name`,
      args: [phone, name]
    })
    logger.info(`[DB] Upserted user: ${phone}`)
  } catch (err) {
    logger.error(`[DB] Error upserting user: ${err.message}`)
  }
}

export async function getUser(phone) {
  try {
    const c = getClient()
    const result = await c.execute({
      sql: 'SELECT * FROM users WHERE phone = ?',
      args: [phone]
    })
    return result.rows[0] || null
  } catch (err) {
    logger.error(`[DB] Error getting user: ${err.message}`)
    return null
  }
}

export async function saveMessage(phone, role, content) {
  try {
    const c = getClient()
    await c.execute({
      sql: `INSERT INTO messages (user_phone, role, content, timestamp)
            VALUES (?, ?, ?, datetime('now'))`,
      args: [phone, role, content]
    })
  } catch (err) {
    logger.error(`[DB] Error saving message: ${err.message}`)
  }
}

export async function getLastMessages(phone, limit = 5) {
  try {
    const c = getClient()
    const result = await c.execute({
      sql: `SELECT role, content FROM messages
            WHERE user_phone = ?
            ORDER BY timestamp DESC LIMIT ?`,
      args: [phone, limit]
    })
    return result.rows ? [...result.rows].reverse() : []
  } catch (err) {
    logger.error(`[DB] Error getting last messages: ${err.message}`)
    return []
  }
}

export async function saveReminder(id, phone, text, triggerTime, recurrence, cronExpr = null) {
  try {
    const c = getClient()
    await c.execute({
      sql: `INSERT INTO reminders 
            (id, user_phone, text, trigger_time, recurrence, cron_expr, status)
            VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
      args: [id, phone, text, triggerTime, recurrence, cronExpr]
    })
    logger.info(`[DB] Saved reminder: ${id}`)
  } catch (err) {
    logger.error(`[DB] Error saving reminder: ${err.message}`)
  }
}

export async function getPendingReminders(phone) {
  try {
    const c = getClient()
    const result = await c.execute({
      sql: `SELECT * FROM reminders 
            WHERE user_phone = ? AND status = 'pending'`,
      args: [phone]
    })
    return result.rows || []
  } catch (err) {
    logger.error(`[DB] Error getting pending reminders: ${err.message}`)
    return []
  }
}

export async function getAllPendingReminders() {
  try {
    const c = getClient()
    const result = await c.execute({
      sql: `SELECT * FROM reminders WHERE status = 'pending'`
    })
    return result.rows || []
  } catch (err) {
    logger.error(`[DB] Error getting all pending reminders: ${err.message}`)
    return []
  }
}

export async function updateReminderStatus(id, status) {
  try {
    const c = getClient()
    await c.execute({
      sql: `UPDATE reminders SET status = ? WHERE id = ?`,
      args: [status, id]
    })
    logger.info(`[DB] Updated reminder ${id} status to ${status}`)
  } catch (err) {
    logger.error(`[DB] Error updating reminder status: ${err.message}`)
  }
}
