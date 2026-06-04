import type { AiConfig, AiChatResponse, ChatMessage, RetrievedContext } from '@shared/types'
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

      // Get recent memories for query expansion context
      const recentMemories = deps.db.listMemories(20)

      // ── Step 1: Query planning ──────────────────────────────────────────
      // Ask the model to expand the query into specific search terms.
      // This runs BEFORE retrieval so that entity-aware terms (e.g. "Boca
      // Juniors" from "club de fútbol") are searched in the DB.
      const queries = await planQueries(config, question, today, recentMemories)

      // ── Step 2: Multi-query hybrid retrieval ───────────────────────────
      const [allVectorHits, allKwHits, allMemHits] = await Promise.all([
        Promise.all(queries.map((q) => deps.search.query(q, VEC_K_PER_QUERY).catch((): [] => []))),
        Promise.all(queries.map((q) => Promise.resolve(deps.db.searchKeyword(q, KW_PER_QUERY)))),
        // Memory: vector search on first query, keyword on all
        (async () => {
          try {
            const queryVec = await deps.embed(question)
            return deps.db.searchMemorySimilar(queryVec, MEM_K, chatId)
          } catch {
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

      // ── Step 3: Build system prompt ────────────────────────────────────
      const stats = deps.db.stats()
      const surroundingContext = goodSourceId !== undefined
        ? deps.db.getSurroundingMessages(goodSourceId, 5)
        : undefined
      const systemPrompt = buildSystemPrompt(stats, merged, memories, queries, today, surroundingContext)

      // ── Step 4: Call LLM ───────────────────────────────────────────────
      const rawContent = await callProvider({ config, systemPrompt, messages: history })

      // ── Step 5: Parse action + remember blocks ─────────────────────────
      const { content, action, remember, sources: relevantIndices } = parseBlocks(rawContent)

      // ── Step 6: Filter sources based on what the LLM found pertinent ─────
      let filteredSources: RetrievedContext[] = merged
      if (relevantIndices !== undefined) {
        filteredSources = relevantIndices
          .map((idx): RetrievedContext | undefined => {
            const src = merged[idx - 1]
            return src ? { ...src, index: idx } : undefined
          })
          .filter((s): s is RetrievedContext => s !== undefined)
      }

      // ── Step 7: Persist memory async (non-blocking) ────────────────────
      if (remember) {
        try {
          const memId = deps.db.insertMemory(remember, chatId)
          void deps.embed(remember).then((vec) => {
            try { deps.db.insertMemoryEmbedding(memId, vec) } catch { /* ignore duplicate */ }
          })
        } catch { /* non-fatal */ }
      }

      // ── Step 8: Enrich context of the selected message (Option A) ──────
      if (goodSourceId !== undefined) {
        try {
          void enrichSourceMessageContext(config, goodSourceId, question, history, deps)
        } catch { /* non-fatal */ }
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
  } catch { /* fall through to original query */ }

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
BrainTwo captura los mensajes que el usuario se envía a sí mismo en WhatsApp.

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
{"action":"navigate","view":"search"}
Vistas disponibles: search, timeline, settings, chat`
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
    } catch { /* not parseable — keep the line */ }
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
    console.error('Failed to enrich source message context:', err)
  }
}
