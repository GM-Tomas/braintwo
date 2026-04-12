const fs = require('fs')
const path = require('path')
const { insertNote, insertEmbedding, getDB } = require('./db')
const { transcribeAudio, generateEmbedding, describeImage, categorize } = require('./ai')

const processedIds = new Set()

async function processMessage(msg, mediaPath) {
  // Evitar procesar el mismo mensaje dos veces
  if (processedIds.has(msg.id._serialized)) return
  processedIds.add(msg.id._serialized)

  // Verificar si ya está en la DB (por si se reinicia la app)
  try {
    const existing = getDB()
      .prepare(`SELECT id FROM notes WHERE content LIKE ?`)
      .get(`%${msg.id._serialized}%`)
    if (existing) return
  } catch (e) {}

  try {
    if (msg.type === 'chat' && msg.body?.trim()) {
      await processText(msg)
    } else if (msg.type === 'ptt' || msg.type === 'audio') {
      await processAudio(msg, mediaPath)
    } else if (msg.type === 'image') {
      await processImage(msg, mediaPath)
    }
  } catch (e) {
    console.error('Error procesando mensaje:', msg.type, e.message)
  }
}

async function processText(msg) {
  const content = msg.body.trim()
  const tags = await categorize(content)

  const noteId = insertNote({
    type: 'text',
    content,
    tags,
    sourceChat: 'mis notas',
  })

  // Generar embedding para búsqueda semántica
  const embedding = await generateEmbedding(content)
  if (embedding) insertEmbedding(noteId, embedding)

  console.log('Nota de texto guardada:', noteId)
}

async function processAudio(msg, mediaPath) {
  const media = await msg.downloadMedia()
  if (!media) return

  // Guardar el audio en disco
  const filename = `audio_${Date.now()}.ogg`
  const filePath = path.join(mediaPath, filename)
  fs.writeFileSync(filePath, Buffer.from(media.data, 'base64'))

  // Transcribir
  const transcription = await transcribeAudio(filePath)
  if (!transcription) return

  const content = transcription
  const tags = await categorize(content)

  const noteId = insertNote({
    type: 'audio',
    content,
    rawPath: filePath,
    tags,
    sourceChat: 'mis notas',
  })

  const embedding = await generateEmbedding(content)
  if (embedding) insertEmbedding(noteId, embedding)

  console.log('Nota de audio transcripta y guardada:', noteId)
}

async function processImage(msg, mediaPath) {
  const media = await msg.downloadMedia()
  if (!media) return

  const filename = `image_${Date.now()}.jpg`
  const filePath = path.join(mediaPath, filename)
  fs.writeFileSync(filePath, Buffer.from(media.data, 'base64'))

  // Describir imagen con visión de Gemini
  const description = await describeImage(media.data, media.mimetype)
  if (!description) return

  const tags = await categorize(description)

  const noteId = insertNote({
    type: 'image',
    content: description,
    rawPath: filePath,
    tags,
    sourceChat: 'mis notas',
  })

  const embedding = await generateEmbedding(description)
  if (embedding) insertEmbedding(noteId, embedding)

  console.log('Imagen descrita y guardada:', noteId)
}

module.exports = { processMessage }
