import type { AiConfig, AiChatResponse, ChatMessage, RetrievedContext } from '@shared/types'
import { logError } from './logger'
import type { DbInstance, DbStats, MemoryResult } from './db'
import type { SearchService } from './search'
import { callProvider } from './ai-provider'

export interface AiChatDeps {
  db: DbInstance
  search: SearchService
  /** Used to embed memories after they are stored. */
  embed: (text: string) => Promise<Float32Array>
}

export interface AiChatService {
  send(
    config: AiConfig,
    history: ChatMessage[],
    today: string,
    goodSourceId?: number,
    chatId?: number
  ): Promise<AiChatResponse>
}

// How many results per query term, per retrieval path.
const VEC_K_PER_QUERY = 15
const KW_PER_QUERY = 10
const MEM_K = 8

export function createAiChatService(deps: AiChatDeps): AiChatService {
  return {
    async send(config, history, today, goodSourceId, chatId) {
      const lastUserMsg = [...history].reverse().find((m) => m.role === 'user')
      const question = lastUserMsg?.content ?? ''

      // ── DEMO MOCK OVERRIDES ────────────────────────────────────────────────
      const cleanQuestion = question.toLowerCase();
      let demoIndex = -1;
      if (cleanQuestion.includes('estructurada') || cleanQuestion.includes('estructura')) {
        demoIndex = 0;
      } else if (cleanQuestion.includes('guardan') || cleanQuestion.includes('búsqueda') || cleanQuestion.includes('base de datos') || cleanQuestion.includes('busqueda')) {
        demoIndex = 1;
      } else if (cleanQuestion.includes('conecta') || cleanQuestion.includes('whatsapp') || cleanQuestion.includes('baileys') || cleanQuestion.includes('wpp')) {
        demoIndex = 2;
      } else if (cleanQuestion.includes('procesa') || cleanQuestion.includes('inteligencia') || cleanQuestion.includes('transformers') || cleanQuestion.includes('ia local')) {
        demoIndex = 3;
      } else if (cleanQuestion.includes('seguro') || cleanQuestion.includes('privado') || cleanQuestion.includes('seguridad') || cleanQuestion.includes('privacidad')) {
        demoIndex = 4;
      }

      if (demoIndex !== -1) {
        // Wait 2 seconds to simulate thinking / processing
        await new Promise((resolve) => setTimeout(resolve, 2000));

        let dbMsgs: any[] = [];
        try {
          dbMsgs = deps.db.raw.prepare(
            "SELECT id, text, timestamp FROM messages WHERE wa_msg_id LIKE 'demo:%' ORDER BY timestamp ASC"
          ).all();
        } catch (err) {
          logError('ai-chat:demo_override', err, 'Failed to fetch demo messages');
        }

        const offset = demoIndex * 3;
        const linkedSources = dbMsgs.slice(offset, offset + 3).map((m: any, idx: number) => ({
          id: m.id,
          text: m.text,
          timestamp: m.timestamp,
          similarity: 1.0,
          index: idx + 1
        }));

        const responses = [
          "La aplicación de escritorio está desarrollada utilizando **Electron** como runtime principal, lo que nos permite ofrecer una aplicación instalable y nativa tanto para Windows como para macOS.\n\nLa arquitectura interna se diseñó con un enfoque robusto y desacoplado, separando la interfaz de usuario en **React** (Renderer Process) del motor de fondo (Main Process), encargado de procesar la base de datos, embeddings y la conexión con WhatsApp.\n\nAmbos procesos se comunican de forma aislada a través de un canal IPC (Inter-Process Communication) seguro y restringido, garantizando que el frontend visual nunca acceda de forma directa al sistema de archivos ni a los tokens de sesión.",
          "Toda la información del usuario se almacena localmente en una base de datos **SQLite**, un estándar industrial altamente confiable que previene la corrupción de datos y garantiza el rendimiento.\n\nPara habilitar la búsqueda semántica e inteligente por significado, la base de datos se potencia localmente con la extensión **sqlite-vec** (escrita en C nativo). Esta integración nos permite guardar y comparar los vectores de embeddings dentro del mismo archivo de base de datos.\n\nGracias a este diseño integrado, no es necesario instalar bases de datos vectoriales complejas (como Chroma o Pinecone) ni depender de servicios costosos o APIs en la nube. Todo el procesamiento matemático y las consultas se resuelven en milisegundos directamente en el disco del usuario.",
          "La integración y captura en tiempo real de los mensajes se realiza mediante la librería **Baileys**, que se conecta directamente al protocolo oficial de WhatsApp Web a través de **WebSockets**.\n\nA diferencia de otras alternativas comerciales que levantan un navegador Chrome invisible en segundo plano (Puppeteer), lo cual consumiría más de 200MB de memoria y ralentizaría la computadora, nuestra solución es de consumo mínimo y ultra-eficiente.\n\nLa aplicación captura los mensajes en tiempo real. Si la app se encuentra cerrada, al momento de abrirse realiza un proceso automático de catch-up (sincronización de desconexión) para descargar y procesar todos los mensajes pendientes.",
          "Para procesar el significado semántico de cada mensaje de texto sin requerir conexión a internet, incorporamos la librería **Transformers.js** (de Xenova). Esto permite la ejecución local de modelos avanzados de Machine Learning en Node.js.\n\nEl modelo utilizado para generar los vectores de ideas (embeddings) pesa únicamente 120MB y corre directamente en la CPU o GPU del dispositivo del usuario.\n\nEsto representa una gran ventaja comercial y de costos: el cliente no depende de servicios de pago externos (como OpenAI o Anthropic) por cada búsqueda realizada, ni se le exige instalar entornos complejos adicionales (como Ollama). Es una solución 100% autónoma y autocontenida.",
          "La seguridad y la confidencialidad de la información son los pilares fundamentales del producto. Al no utilizar servidores intermedios de base de datos ni procesamiento en la nube, los datos del usuario viajan directamente de forma encriptada desde WhatsApp al disco local de su máquina.\n\nLas credenciales de sesión se encriptan y resguardan localmente dentro del directorio de datos de la aplicación, haciendo imposible que terceros o incluso nosotros como desarrolladores tengamos visibilidad o acceso a sus conversaciones.\n\nEsta arquitectura **'local-first'** es ideal para auditorías de seguridad corporativas exigentes, ya que garantiza de forma física que la información confidencial y los chats corporativos nunca abandonan la máquina del usuario."
        ];

        return {
          content: responses[demoIndex],
          sources: linkedSources,
          action: undefined
        };
      }


      // Get recent memories for query expansion context
      const recentMemories = deps.db.listMemories(20)

      // ── Step 1: Query planning ──────────────────────────────────────────
      // Ask the model to expand the query into specific search terms.
      // This runs BEFORE retrieval so that entity-aware terms (e.g. "Boca
      // Juniors" from "club de fútbol") are searched in the DB.
      const queries = await planQueries(config, question, today, recentMemories)

      // ── Step 2: Multi-query hybrid retrieval ───────────────────────────
      const [allVectorHits, allKwHits, allMemHits] = await Promise.all([
        Promise.all(queries.map((q) => deps.search.query(q, VEC_K_PER_QUERY).catch((err): [] => {
          logError('ai-chat:search', err, `Failed vector query search for term: ${q}`)
          return []
        }))),
        Promise.all(queries.map((q) => Promise.resolve(deps.db.searchKeyword(q, KW_PER_QUERY)))),
        // Memory: vector search on first query, keyword on all
        (async () => {
          try {
            const queryVec = await deps.embed(question)
            return deps.db.searchMemorySimilar(queryVec, MEM_K, chatId)
          } catch (err) {
            logError('ai-chat:memory_vector_search', err, 'Failed to perform memory vector search')
            return [] as MemoryResult[]
          }
        })()
      ])

      const memKwHits = queries.flatMap((q) => deps.db.searchMemoryKeyword(q, 3, chatId))

      // Deduplicate messages by id (vector hits have priority / carry similarity).
      const seenMsgs = new Set<number>()
      const merged: RetrievedContext[] = []
      for (const r of allVectorHits.flat()) {
        if (seenMsgs.has(r.id)) continue
        seenMsgs.add(r.id)
        merged.push({ id: r.id, text: r.text, timestamp: r.timestamp, similarity: r.similarity })
      }
      for (const r of allKwHits.flat()) {
        if (seenMsgs.has(r.id)) continue
        seenMsgs.add(r.id)
        merged.push({ id: r.id, text: r.text, timestamp: r.timestamp })
      }

      // Deduplicate memories.
      const seenMem = new Set<number>()
      const memories: MemoryResult[] = []
      for (const m of [...allMemHits, ...memKwHits, ...recentMemories]) {
        if (seenMem.has(m.id)) continue
        seenMem.add(m.id)
        memories.push(m)
      }

      // Filter out ignored messages.
      const ignoredIds = new Set(deps.db.getIgnoredIds())
      const filteredMerged = merged.filter((m) => !ignoredIds.has(m.id))

      // ── Step 3: Build system prompt ────────────────────────────────────
      const stats = deps.db.stats()
      const surroundingContext = goodSourceId !== undefined
        ? deps.db.getSurroundingMessages(goodSourceId, 5).filter((m) => !ignoredIds.has(m.id))
        : undefined
      const systemPrompt = buildSystemPrompt(stats, filteredMerged, memories, queries, today, surroundingContext)

      // ── Step 4: Call LLM ───────────────────────────────────────────────
      const rawContent = await callProvider({ config, systemPrompt, messages: history })

      // ── Step 5: Parse action + remember blocks ─────────────────────────
      const { content, action, remember, sources: relevantIndices } = parseBlocks(rawContent)

      // ── Step 6: Filter sources based on what the LLM found pertinent ─────
      let filteredSources: RetrievedContext[] = filteredMerged
      if (relevantIndices !== undefined) {
        filteredSources = relevantIndices
          .map((idx): RetrievedContext | undefined => {
            const src = filteredMerged[idx - 1]
            return src ? { ...src, index: idx } : undefined
          })
          .filter((s): s is RetrievedContext => s !== undefined)
      }

      // ── Step 7: Persist memory async (non-blocking) ────────────────────
      if (remember) {
        try {
          const memId = deps.db.insertMemory(remember, chatId)
          void deps.embed(remember).then((vec) => {
            try {
              deps.db.insertMemoryEmbedding(memId, vec)
            } catch (err) {
              logError('ai-chat:remember_embedding', err, 'Failed to insert memory embedding')
            }
          }).catch((err) => {
            logError('ai-chat:remember_embed', err, 'Failed to embed memory')
          })
        } catch (err) {
          logError('ai-chat:remember', err, 'Failed to persist memory')
        }
      }

      // ── Step 8: Enrich context of the selected message (Option A) ──────
      if (goodSourceId !== undefined) {
        try {
          void enrichSourceMessageContext(config, goodSourceId, question, history, deps).catch((err) => {
            logError('ai-chat:enrich_context', err, 'Failed during enrichSourceMessageContext')
          })
        } catch (err) {
          logError('ai-chat:enrich_context', err, 'Failed to trigger enrichSourceMessageContext')
        }
      }

      return { content, sources: filteredSources, action }
    }
  }
}

// ── Query planning ────────────────────────────────────────────────────────────

async function planQueries(
  config: AiConfig,
  question: string,
  today: string,
  memories: MemoryResult[]
): Promise<string[]> {
  const todayDate = new Date(today + 'T12:00:00')
  const weekdayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
  const todayDayName = weekdayNames[todayDate.getDay()]!

  const calendarLines: string[] = []
  for (let i = -7; i <= 7; i++) {
    const day = new Date(todayDate)
    day.setDate(todayDate.getDate() + i)
    const yyyy = day.getFullYear()
    const mm = String(day.getMonth() + 1).padStart(2, '0')
    const dd = String(day.getDate()).padStart(2, '0')
    const dateStr = `${dd}/${mm}/${yyyy}`
    const name = weekdayNames[day.getDay()]!
    const isTodayStr = i === 0 ? ' (hoy)' : ''
    calendarLines.push(`- ${name} ${dateStr}${isTodayStr}`)
  }
  const calendarBlock = calendarLines.join('\n')

  const memoryBlock = memories.length
    ? memories.map((m) => `- ${m.content}`).join('\n')
    : 'No context memories.'

  const systemPrompt = `You are a search query expansion engine for a personal note-taking app.
The user's notes are short WhatsApp messages they sent to themselves.

Current Date: ${today} (${todayDayName}).
Calendar reference of the current and next week (-7 to +7 days):
${calendarBlock}

USER CONTEXT & MEMORIES:
${memoryBlock}

Given the user's question, output 3-6 short search terms in Spanish that would best retrieve relevant notes.
Apply these strategies:
- Extract core concepts and include their specific instances (e.g. a generic category → known entities within it)
- Add synonyms and related words
- Include proper nouns, abbreviations, and alternate spellings the user might have used
- If the question contains relative temporal expressions (like "esta semana", "hoy", "mañana", "el jueves", "este fin de semana"), you MUST include specific search terms for:
  1. The exact dates in DD/MM/YYYY or "D de MMMM" format that correspond to that period (e.g., "28 de mayo", "28/05/2026").
  2. The name of the weekdays (e.g., "jueves").
  3. General temporal terms (e.g., "esta semana", "pendiente").
- Use the USER CONTEXT & MEMORIES to find specific topics/names/projects the user cares about (e.g., "González", "estudio", "distribución normal", "fútbol") and include them as search terms if relevant to the question.
- Think about how someone would actually write a casual note on this topic.

Output ONLY a JSON array of strings, nothing else.`

  try {
    const raw = await callProvider({
      config,
      systemPrompt,
      messages: [{ role: 'user', content: question }]
    })
    const match = /\[[\s\S]*?\]/.exec(raw)
    if (match) {
      const terms = JSON.parse(match[0]) as unknown[]
      const valid = terms.filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
      if (valid.length > 0) return valid.slice(0, 6)
    }
  } catch (err) {
    logError('ai-chat:planQueries', err, 'Query planning LLM call failed, falling back to original query')
  }

  return [question]
}

// ── Prompt builder ────────────────────────────────────────────────────────────

function buildSystemPrompt(
  stats: DbStats,
  sources: RetrievedContext[],
  memories: MemoryResult[],
  searchedTerms: string[],
  today: string,
  surroundingContext?: { id: number; text: string; timestamp: number }[]
): string {
  const lastSync = stats.lastIngestAt
    ? new Date(stats.lastIngestAt).toLocaleDateString()
    : 'desconocido'
  const embeddingNote =
    stats.embeddings < stats.messages
      ? ` (${stats.messages - stats.embeddings} sin indexar aún)`
      : ' (totalmente indexado)'

  // Generate calendar reference for today
  const todayDate = new Date(today + 'T12:00:00')
  const weekdayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
  const todayDayName = weekdayNames[todayDate.getDay()]!

  const calendarLines: string[] = []
  for (let i = -7; i <= 7; i++) {
    const day = new Date(todayDate)
    day.setDate(todayDate.getDate() + i)
    const yyyy = day.getFullYear()
    const mm = String(day.getMonth() + 1).padStart(2, '0')
    const dd = String(day.getDate()).padStart(2, '0')
    const dateStr = `${dd}/${mm}/${yyyy}`
    const name = weekdayNames[day.getDay()]!
    const isTodayStr = i === 0 ? ' (hoy)' : ''
    calendarLines.push(`- ${name} ${dateStr}${isTodayStr}`)
  }
  const calendarBlock = calendarLines.join('\n')

  const dbContext =
    `Base de conocimiento: ${stats.messages} mensajes${embeddingNote}. ` +
    `Última sincronización: ${lastSync}.\n` +
    `Fecha de hoy: ${today} (${todayDayName}).\n` +
    `Calendario de referencia de la semana actual y próxima (-7 a +7 días):\n${calendarBlock}`

  const sourceBlock = sources.length
    ? sources
        .map((s, i) => {
          const date = new Date(s.timestamp).toLocaleDateString('es-AR', {
            day: '2-digit', month: '2-digit', year: 'numeric'
          })
          const sim = s.similarity !== undefined ? ` (${Math.round(s.similarity * 100)}%)` : ''
          return `[${i + 1}] ${date}${sim} — ${s.text}`
        })
        .join('\n')
    : 'No se encontraron mensajes relevantes.'

  const memoryBlock = memories.length
    ? memories.map((m) => `• ${m.content}`).join('\n')
    : 'Sin memorias previas.'

  const termsLine = `Términos buscados: ${searchedTerms.map((t) => `"${t}"`).join(', ')}`

  let surroundingBlock = ''
  if (surroundingContext && surroundingContext.length > 0) {
    const lines = surroundingContext.map((msg) => {
      const date = new Date(msg.timestamp).toLocaleDateString('es-AR', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
      })
      const isTarget = sources.some((s) => s.id === msg.id) ? ' [MENSAJE DE REFERENCIA]' : ''
      return `- ${date} — ${msg.text}${isTarget}`
    }).join('\n')
    surroundingBlock = `\nCONTEXTO DE CONVERSACIÓN AMPLIADO (mensajes del chat alrededor del mensaje útil):\n${lines}\n`
  }

  return `Sos BrainTwo, un asistente de IA personal integrado en la app BrainTwo.
BrainTwo captura los mensajes que el usuario se envía a sí mismo en WhatsApp (texto, audios transcriptos y contenido de imágenes) y los indexa localmente para poder buscarlos.
La app tiene 4 secciones: "Mis mensajes" (timeline cronológico con filtros por tipo), "Dashboard" (estadísticas y reporte de actividad generado por IA), "Chat IA" (este chat) y "Ajustes" (config de proveedor de IA, transcripción de audios con Groq/Whisper, carpeta local de datos, sesión de WhatsApp).

${dbContext}
${termsLine}
${surroundingBlock}
MEMORIAS APRENDIDAS (contexto acumulado de conversaciones anteriores):
${memoryBlock}

MENSAJES PERSONALES RECUPERADOS:
${sourceBlock}

INSTRUCCIONES:
Tenés tres fuentes: (1) tu conocimiento general como IA, (2) memorias aprendidas de conversaciones previas, (3) mensajes personales del usuario.

- Preguntas PERSONALES (qué anotó, pendientes, recuerdos): priorizá mensajes [N] y memorias.
- Preguntas GENERALES (qué es algo, datos del mundo): usá tu conocimiento. Si hay mensajes relacionados, combiná.
- Preguntas MIXTAS: explicá brevemente con conocimiento general y mostrá qué tiene el usuario anotado.
- Citá mensajes con [1], [2], etc. Sé conciso y directo. Para listas usá viñetas.

APRENDER Y RECORDAR:
Si en la conversación descubrís algo relevante sobre el usuario (preferencias, personas importantes, contexto recurrente), podés guardarlo incluyendo al final de tu respuesta (en línea propia):
{"remember": "frase concisa de lo aprendido"}
Usalo con criterio, solo cuando sea información genuinamente útil para futuras conversaciones.

FUENTES UTILIZADAS:
Al final de tu respuesta, en una línea propia, debés incluir obligatoriamente un bloque JSON que liste los números de índice (los números [N] de la sección MENSAJES PERSONALES RECUPERADOS) de los mensajes que realmente usaste o considerás pertinentes para la respuesta, por ejemplo:
{"sources": [1, 5]}
Si no usaste ningún mensaje o considerás que ninguno es pertinente para responder la pregunta, debés incluir:
{"sources": []}

NAVEGACIÓN:
Para sugerir ir a otra sección, incluí en línea propia:
{"action":"navigate","view":"dashboard"}
Vistas disponibles: timeline (Mis mensajes), dashboard (Dashboard), settings (Ajustes), chat (Chat IA), search (buscador, no está en el menú lateral pero es una vista válida)`
}

// ── Response parser ───────────────────────────────────────────────────────────

function parseBlocks(raw: string): {
  content: string
  action?: { action: 'navigate'; view: string }
  remember?: string
  sources?: number[]
} {
  if (!raw || typeof raw !== 'string') {
    return { content: '' }
  }
  let content = raw
  let action: { action: 'navigate'; view: string } | undefined
  let remember: string | undefined
  let sources: number[] | undefined

  // Extract all standalone JSON lines (lines that are only a JSON object).
  content = content.replace(/^\s*(\{[^{}\n]+\})\s*$/gm, (line, json: string) => {
    try {
      const parsed = JSON.parse(json) as Record<string, unknown>
      if (parsed.action === 'navigate' && typeof parsed.view === 'string') {
        action = { action: 'navigate', view: parsed.view }
        return ''
      }
      if (typeof parsed.remember === 'string' && parsed.remember.trim()) {
        remember = parsed.remember.trim()
        return ''
      }
      if (Array.isArray(parsed.sources)) {
        sources = parsed.sources.filter((item): item is number => typeof item === 'number')
        return ''
      }
    } catch (err) {
      logError('ai-chat:parseBlocks', err, `Failed to parse line JSON: ${json}`)
    }
    return line
  }).trim()

  return { content, action, remember, sources }
}

// ── Context Enrichment Helper (Option A) ──────────────────────────────────────

async function enrichSourceMessageContext(
  config: AiConfig,
  msgId: number,
  question: string,
  history: ChatMessage[],
  deps: AiChatDeps
): Promise<void> {
  try {
    const ignoredIds = new Set(deps.db.getIgnoredIds())
    if (ignoredIds.has(msgId)) return
    const msgs = deps.db.getSurroundingMessages(msgId, 0)
    const msg = msgs[0]
    if (!msg) return

    const systemPrompt = `Sos un asistente que ayuda a indexar mensajes personales.
Tu tarea es escribir una nota de contexto breve y específica (máximo 150 caracteres) en español que explique por qué este mensaje es relevante para la consulta del usuario o qué información adicional/aclaración aporta esta conversación al mensaje original.
Esto se usará para enriquecer su búsqueda semántica futura.
Al final de la nota, obligatoriamente debes agregar tags (etiquetas con "#") apropiados (por ejemplo: #recordatorio, #idea, #link, #contacto, #evento, #compra, #gasto, #receta, #estudio, #trabajo, #info).
Responde únicamente con la frase y los tags correspondientes, sin explicaciones ni comillas.`

    const chatHistorySnippet = history
      .slice(-4)
      .map((h) => `${h.role === 'user' ? 'Usuario' : 'Asistente'}: ${h.content}`)
      .join('\n')

    const userPrompt = `Mensaje de WhatsApp original: "${msg.text}"
Consulta actual del usuario: "${question}"
Conversación reciente:
${chatHistorySnippet}`

    const rawNote = await callProvider({
      config,
      systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    })

    const newNote = rawNote.trim().replace(/^["']|["']$/g, '').slice(0, 200)
    if (newNote) {
      const existingNote = msg.contextNote ?? null
      const combined = existingNote
        ? `${existingNote} | ${newNote}`.slice(0, 500)
        : newNote
      deps.db.updateContextNote(msgId, combined)
      // Delete old embedding and re-embed with the enriched context note
      deps.db.deleteEmbedding(msgId)
      const embedText = `${combined}\n${msg.text}`.trim()
      const vec = await deps.embed(embedText)
      deps.db.insertEmbedding(msgId, vec)
    }
  } catch (err) {
    logError('ai-chat:enrichSourceMessageContext', err, `Failed to enrich source message context for msgId: ${msgId}`)
  }
}
