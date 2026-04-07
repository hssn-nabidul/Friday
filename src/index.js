import pino from 'pino'
import { initDb } from './database.js'
import { startWhatsApp } from './whatsapp.js'
import { reloadReminders } from './scheduler.js'
import { startWorker } from './queue.js'

const logger = pino()

async function main() {
  logger.info('Starting Friday...')
  
  await initDb()
  logger.info('Database ready ✓')
  
  await reloadReminders()
  logger.info('Reminders reloaded ✓')
  
  startWorker()
  logger.info('Queue worker started ✓')
  
  await startWhatsApp()
}

main().catch(err => {
  logger.error(`Fatal error: ${err.message}`)
  process.exit(1)
})
