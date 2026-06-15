import type { AiConfig } from '@shared/types'
import { callProvider, DEFAULT_VISION_MODELS } from './ai-provider'
import { logError } from './logger'

const VISION_SYSTEM_PROMPT =
  'Sos un asistente que extrae el contenido de imágenes de WhatsApp para indexarlas y poder ' +
  'responder preguntas sobre ellas más adelante. Tu prioridad es NO perder información.\n' +
  '\n' +
  '1. TEXTO (lo más importante): transcribí TODO el texto visible de forma literal y completa — ' +
  'cada palabra, número, nombre, fecha, hora, etiqueta, precio o valor. No resumas ni omitas datos.\n' +
  '   - Si hay una tabla, lista, planilla, horario o marcador, preservá la estructura fila por fila ' +
  'asociando cada dato con su valor (por ejemplo: "Suecia vs Túnez — 23:00", "Australia 2 - 0 Turquía").\n' +
  '   - Incluí encabezados, totales, estados ("Final", "Vivo") y cualquier dato chico o secundario.\n' +
  '\n' +
  '2. DESCRIPCIÓN (después del texto): en 1 o 2 oraciones, describí qué es la imagen y los elementos ' +
  'visuales no textuales relevantes (objetos, personas, lugares, logos, gráficos).\n' +
  '\n' +
  'No inventes información que no puedas ver. Si hay un pie de foto, usalo solo como contexto, no lo repitas. ' +
  'Respondé solo con el contenido, sin comillas ni explicaciones sobre tu tarea.'

function resolveVisionModel(config: AiConfig): string {
  const configured = config.provider === 'ollama' ? config.ollama?.visionModel : config.visionModel
  return configured?.trim() || DEFAULT_VISION_MODELS[config.provider]
}

export async function describeImage(
  config: AiConfig,
  buffer: Buffer,
  mimetype: string | undefined,
  caption: string
): Promise<string | null> {
  try {
    const configCopy: AiConfig = { ...config, model: resolveVisionModel(config) }
    const userText = caption ? `Pie de foto / mensaje adjunto: "${caption}"` : 'Sin pie de foto.'

    const raw = await callProvider({
      config: configCopy,
      systemPrompt: VISION_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: userText,
          images: [{ mimetype: mimetype || 'image/jpeg', data: buffer.toString('base64') }]
        }
      ]
    })

    // Allow long transcriptions (tables/schedules can carry a lot of text).
    const description = raw.trim().slice(0, 4000)
    return description || null
  } catch (err) {
    logError('vision:describeImage', err, 'Failed to describe image')
    return null
  }
}
