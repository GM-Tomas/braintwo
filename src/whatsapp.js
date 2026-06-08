const { Client, LocalAuth } = require('whatsapp-web.js')
const path = require('path')
const fs = require('fs')
const { app } = require('electron')
const { processMessage } = require('./sync')

const MEDIA_PATH = path.join(app.getPath('userData'), 'media')
if (!fs.existsSync(MEDIA_PATH)) fs.mkdirSync(MEDIA_PATH, { recursive: true })

let client
let targetChatName = 'mis notas' // nombre del chat personal a escuchar

function startWhatsApp({ onQR, onReady, onMessage }) {
  client = new Client({
    authStrategy: new LocalAuth({
      dataPath: path.join(app.getPath('userData'), 'whatsapp-session'),
    }),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
  })

  client.on('qr', (qr) => {
    console.log('QR generado')
    onQR(qr)
  })

  client.on('ready', () => {
    console.log('WhatsApp conectado')
    onReady()
    syncPendingMessages()
  })

  client.on('message', async (msg) => {
    if (!isTargetChat(msg)) return

    await processMessage(msg, MEDIA_PATH)
    onMessage()
  })

  client.on('auth_failure', (msg) => {
    console.error('Error de autenticación:', msg)
  })

  client.on('disconnected', (reason) => {
    console.warn('WhatsApp desconectado:', reason)
  })

  client.initialize()
  return client
}

// Verifica si el mensaje viene del chat objetivo (el usuario mandándose a sí mismo)
async function isTargetChat(msg) {
  try {
    const chat = await msg.getChat()
    const { getConfig } = require('./db')
    const config = getConfig()
    const chatName = config.target_chat || targetChatName

    // El chat "consigo mismo" en WhatsApp es un chat donde el contacto es el propio usuario
    return chat.isGroup === false && (
      chat.name?.toLowerCase().includes(chatName.toLowerCase()) ||
      msg.fromMe === true
    )
  } catch (e) {
    return false
  }
}

// Sincroniza mensajes que llegaron mientras la app estaba cerrada
async function syncPendingMessages() {
  try {
    const chats = await client.getChats()
    const { getConfig } = require('./db')
    const config = getConfig()
    const chatName = config.target_chat || targetChatName

    const targetChat = chats.find(c =>
      !c.isGroup && c.name?.toLowerCase().includes(chatName.toLowerCase())
    )

    if (!targetChat) {
      console.log('Chat objetivo no encontrado:', chatName)
      return
    }

    const messages = await targetChat.fetchMessages({ limit: 50 })
    for (const msg of messages) {
      if (msg.fromMe) {
        await processMessage(msg, MEDIA_PATH)
      }
    }

    console.log(`Sincronizados ${messages.length} mensajes pendientes`)
  } catch (e) {
    console.error('Error en sync pendiente:', e)
  }
}

module.exports = { startWhatsApp }
