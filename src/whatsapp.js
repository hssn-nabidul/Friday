import makeWASocket, { useMultiFileAuthState, downloadMediaMessage } from '@whiskeysockets/baileys'
import pino from 'pino'
import qrcodeTerminal from 'qrcode-terminal'
import { config } from './config.js'
import { pushToQueue } from './queue.js'

const logger = pino()
let sock

export async function startWhatsApp() {
  logger.info('[WA] Starting WhatsApp client...')
  
  const { state, saveCreds } = await useMultiFileAuthState('./auth_info')
  
  sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'info' }),
    printQRInTerminal: false
  })
  
  sock.ev.on('creds.update', saveCreds)
  
  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update
    
    if (qr) {
      logger.info('[WA] QR code received, scan with WhatsApp:')
      qrcodeTerminal.generate(qr, { small: true })
    }
    
    if (connection === 'open') {
      logger.info('[WA] Friday is online ✓')
    }
    
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401
      if (shouldReconnect) {
        logger.warn('[WA] Connection closed, reconnecting...')
      }
    }
  })
  
  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      try {
        if (msg.key.fromMe) continue
        if (msg.key.remoteJid === 'status@broadcast') continue
        
        const phone = msg.key.remoteJid.replace('@s.whatsapp.net', '')
        
        if (!config.allowedPhones.includes(phone) && phone !== config.ownerPhone) {
          logger.info(`[WA] Ignoring message from unauthorized phone: ${phone}`)
          continue
        }
        
        let name = null
        if (msg.pushName) {
          name = msg.pushName
        }
        
        const msgType = msg.message?.conversation ? 'conversation' : 
                       msg.message?.extendedTextMessage ? 'extendedTextMessage' :
                       msg.message?.audioMessage ? 'audioMessage' : null
        
        if (!msgType) continue
        
        if (msgType === 'conversation' || msgType === 'extendedTextMessage') {
          const content = msg.message.conversation || msg.message.extendedTextMessage.text
          logger.info(`[WA] Text message from ${phone}: ${content.substring(0, 50)}...`)
          pushToQueue({ phone, type: 'text', content, name })
        } else if (msgType === 'audioMessage') {
          logger.info(`[WA] Audio message from ${phone}`)
          pushToQueue({ phone, type: 'audio', message: msg, name })
        }
      } catch (err) {
        logger.error(`[WA] Error processing message: ${err.message}`)
      }
    }
  })
  
  return sock
}

export async function sendMessage(phone, text) {
  if (!sock) {
    logger.error('[WA] Socket not initialized')
    return
  }
  
  try {
    await sock.sendMessage(phone + '@s.whatsapp.net', { text })
    logger.info(`[WA] Sent message to ${phone}`)
  } catch (err) {
    logger.error(`[WA] Error sending message: ${err.message}`)
    throw err
  }
}

export async function downloadAudio(msg) {
  try {
    const buffer = await downloadMediaMessage(msg, 'buffer')
    return buffer
  } catch (err) {
    logger.error(`[WA] Error downloading audio: ${err.message}`)
    throw err
  }
}

export function getSock() {
  return sock
}
