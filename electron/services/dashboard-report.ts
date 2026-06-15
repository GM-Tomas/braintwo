import type { AiConfig } from '@shared/types'
import type { RecentMessage } from '@shared/types/messages'
import { callProvider } from './ai-provider'

const SYSTEM_PROMPT =
  'Sos un asistente que analiza la actividad reciente de WhatsApp de un usuario para ayudarlo a ' +
  'tener presentes los temas importantes, fechas y recordatorios.\n' +
  'Vas a recibir la fecha de hoy, una lista de mensajes (propios y recibidos) de los últimos 3 días ' +
  '(cada uno con fecha, hora, remitente, tipo y contenido), y opcionalmente una segunda lista con ' +
  'mensajes más antiguos que mencionan recordatorios o eventos con una fecha asociada.\n' +
  'Generá un resumen breve en español (entre 3 y 6 oraciones), en formato markdown, que empiece con ' +
  '"**Resumen de Actividad:**" y describa los principales temas sobre los que se habló en los últimos ' +
  '3 días.\n' +
  'Después, agregá siempre una sección aparte "**Fechas importantes:**" con una lista de viñetas, ' +
  'una por cada fecha relevante (recordatorios, citas, turnos, vencimientos o eventos con fecha) que ' +
  'aparezca tanto en la actividad reciente como en los mensajes anteriores. No repitas esas fechas ' +
  'dentro del resumen de arriba: si una fecha va a aparecer en "Fechas importantes", mencioná el tema ' +
  'en el resumen pero dejá la fecha solo para esa lista.\n' +
  'Cada viñeta debe tener el formato "- **<fecha>:** <descripción breve>" (la fecha en negrita, formato ' +
  '"D de mes [de AAAA]"), ordenadas cronológicamente de más próxima a más lejana respecto de hoy. ' +
  'Si no hay ninguna fecha relevante, omití esa sección por completo.\n' +
  'No inventes información que no esté en los mensajes.'

const WEEKDAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

// Caps the prompt size when there's a lot of activity, keeping the most recent messages.
const MAX_MESSAGES = 300
const MAX_REMINDER_CANDIDATES = 100

function formatDate(timestamp: number): { dateStr: string; weekday: string; time: string } {
  const date = new Date(timestamp)
  return {
    dateStr: date.toISOString().split('T')[0],
    weekday: WEEKDAY_NAMES[date.getDay()],
    time: date.toTimeString().slice(0, 5)
  }
}

function formatMessageLine(msg: RecentMessage): string {
  const { dateStr, weekday, time } = formatDate(msg.timestamp)
  const sender = msg.fromMe ? 'yo' : 'contacto'
  const content = msg.contextNote || msg.text || `[${msg.kind} sin descripción]`
  return `[${dateStr} ${weekday} ${time}] (${sender}, ${msg.kind}): ${content}`
}

/**
 * Generates a short markdown summary of recent WhatsApp activity using the
 * configured AI provider. `messages` should already be limited to the desired
 * time window (e.g. last 3 days) and ordered ascending by timestamp.
 * `reminderCandidates` are older messages tagged as recordatorios/eventos that
 * may contain a date falling within the next few days.
 */
export async function generateDashboardReport(
  config: AiConfig,
  messages: RecentMessage[],
  reminderCandidates: RecentMessage[] = []
): Promise<string> {
  const lines = messages
    .filter((m) => !m.ignored)
    .slice(-MAX_MESSAGES)
    .map(formatMessageLine)
    .join('\n')

  const today = formatDate(Date.now())
  let userContent = `Fecha de hoy: ${today.dateStr} (${today.weekday})\n\nActividad de los últimos 3 días:\n${lines}`

  if (reminderCandidates.length > 0) {
    const reminderLines = reminderCandidates
      .filter((m) => !m.ignored)
      .slice(0, MAX_REMINDER_CANDIDATES)
      .map(formatMessageLine)
      .join('\n')
    userContent += `\n\nMensajes anteriores con posibles recordatorios o eventos:\n${reminderLines}`
  }

  const raw = await callProvider({
    config,
    systemPrompt: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userContent }]
  })
  return raw.trim()
}
