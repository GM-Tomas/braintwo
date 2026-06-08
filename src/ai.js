const { GoogleGenerativeAI } = require('@google/generative-ai')
const fs = require('fs')
const { getConfig, searchByText } = require('./db')

function getClient() {
  const config = getConfig()
  const apiKey = config.gemini_api_key
  if (!apiKey) throw new Error('Gemini API key no configurada. Ir a Configuración.')
  return new GoogleGenerativeAI(apiKey)
}

async function transcribeAudio(filePath) {
  try {
    const genAI = getClient()
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
    const audioData = fs.readFileSync(filePath)
    const base64Audio = audioData.toString('base64')
    const result = await model.generateContent([
      { inlineData: { mimeType: 'audio/ogg', data: base64Audio } },
      'Transcribí este audio de forma literal y precisa. Solo devolvé el texto transcripto, sin comentarios.',
    ])
    return result.response.text().trim()
  } catch (e) {
    console.error('Error transcribiendo audio:', e.message)
    return null
  }
}

async function describeImage(base64Data, mimeType) {
  try {
    const genAI = getClient()
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
    const result = await model.generateContent([
      { inlineData: { mimeType, data: base64Data } },
      'Describí esta imagen de forma concisa. Si tiene texto, transcribilo primero. Máximo 3 oraciones.',
    ])
    return result.response.text().trim()
  } catch (e) {
    console.error('Error describiendo imagen:', e.message)
    return null
  }
}

async function categorize(content) {
  try {
    const genAI = getClient()
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
    const result = await model.generateContent(
      `Categorizá este texto con 1 a 3 etiquetas cortas en español (idea, tarea, referencia, técnico, negocio, personal, recordatorio).
      Respondé SOLO con un array JSON de strings. Ejemplo: ["idea", "técnico"]
      Texto: "${content.substring(0, 500)}"`
    )
    const text = result.response.text().trim()
    const match = text.match(/\[.*?\]/)
    if (match) return JSON.parse(match[0])
    return []
  } catch (e) {
    return []
  }
}

async function searchNotes(query) {
  // Búsqueda por texto (sin embeddings vectoriales en esta versión)
  const relevantNotes = searchByText(query, 5)

  if (relevantNotes.length === 0) {
    return { answer: 'No encontré notas que coincidan con tu búsqueda.', sources: [] }
  }

  try {
    const genAI = getClient()
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
    const context = relevantNotes
      .map((n, i) => `[${i + 1}] (${n.created_at}) ${n.content}`)
      .join('\n\n')

    const result = await model.generateContent(
      `Sos el asistente personal de BrainTwo. Respondé la pregunta basándote ÚNICAMENTE en estas notas del usuario.
      Respondé en español, de forma concisa y natural.
      
      NOTAS:
      ${context}
      
      PREGUNTA: ${query}`
    )
    return { answer: result.response.text().trim(), sources: relevantNotes }
  } catch (e) {
    console.error('Error RAG:', e.message)
    return {
      answer: 'Encontré notas relacionadas, pero no pude generar una respuesta. Verificá tu API key en Configuración.',
      sources: relevantNotes,
    }
  }
}

module.exports = { transcribeAudio, describeImage, categorize, searchNotes }
