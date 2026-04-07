import pino from 'pino'
import { processMessage } from './processor.js'

const logger = pino()
const queue = []
let processing = false

export function pushToQueue(payload) {
  queue.push(payload)
  logger.info(`[QUEUE] Pushed to queue, length: ${queue.length}`)
}

export function startWorker() {
  logger.info('[QUEUE] Starting queue worker...')
  
  setInterval(async () => {
    if (processing || queue.length === 0) return
    
    processing = true
    const payload = queue.shift()
    
    try {
      logger.info(`[QUEUE] Processing message from ${payload.phone}`)
      await processMessage(payload)
    } catch (err) {
      logger.error(`[QUEUE] Worker error: ${err.message}`)
    }
    
    processing = false
  }, 4000)
  
  logger.info('[QUEUE] Queue worker started with 4s interval')
}
