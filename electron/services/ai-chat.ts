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
  send(config: AiConfig, history: ChatMessage[], today: string): Promise<AiChatResponse>
}

// How many results per query term, per retrieval path.
const VEC_K_PER_QUERY = 8
const KW_PER_QUERY = 5
const MEM_K = 5

export function createAiChatService(deps: AiChatDeps): AiChatService {
  return {
    async send(config, history, today) {
      const lastUserMsg = [...history].reverse().find((m) => m.role === 'user')
      const question = lastUserMsg?.content ?? ''

      // ── Step 1: Query planning ──────────────────────────────────────────
      // Ask the model to expand the query into specific search terms.
      // This runs BEFORE retrieval so that entity-aware terms (e.g. "Boca
      // Juniors" from "club de fútbol") are searched in the DB.
      const queries = await planQueries(config, question)

      // ── Step 2: Multi-query hybrid retrieval ───────────────────────────
      const [allVectorHits, allKwHits, allMemHits] = await Promise.all([
        Promise.all(queries.map((q) => deps.search.query(q, VEC_K_PER_QUERY).catch((): [] => []))),
        Promise.all(queries.map((q) => Promise.resolve(deps.db.searchKeyword(q, KW_PER_QUERY)))),
        // Memory: vector search on first query, keyword on all
        (async () => {
          try {
            const queryVec = await deps.embed(question)
            return deps.db.searchMemorySimilar(queryVec, MEM_K)
          } catch {
            return [] as MemoryResult[]
          }
        })()
      ])

      const memKwHits = queries.flatMap((q) => deps.db.searchMemoryKeyword(q, 3))

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
      for (const m of [...allMemHits, ...memKwHits]) {
        if (seenMem.has(m.id)) continue
        seenMem.add(m.id)
        memories.push(m)
      }

      // ── Step 3: Build system prompt ────────────────────────────────────
      const stats = deps.db.stats()
      const systemPrompt = buildSystemPrompt(stats, merged, memories, queries, today)

      // ── Step 4: Call LLM ───────────────────────────────────────────────
      const rawContent = await callProvider({ config, systemPrompt, messages: history })

      // ── Step 5: Parse action + remember blocks ─────────────────────────
      const { content, action, remember } = parseBlocks(rawContent)

      // ── Step 6: Persist memory async (non-blocking) ────────────────────
      if (remember) {
        try {
          const memId = deps.db.insertMemory(remember)
          void deps.embed(remember).then((vec) => {
            try { deps.db.insertMemoryEmbedding(memId, vec) } catch { /* ignore duplicate */ }
          })
        } catch { /* non-fatal */ }
      }

      return { content, sources: merged, action }
    }
  }
}

// ── Query planning ────────────────────────────────────────────────────────────

async function planQueries(config: AiConfig, question: string): Promise<string[]> {
  const systemPrompt = `You are a search query expansion engine for a personal note-taking app.
The user's notes are short WhatsApp messages they sent to themselves.

Given the user's question, output 3-6 short search terms that would best retrieve relevant notes.
Apply these strategies:
- Extract core concepts and include their specific instances (e.g. a generic category → known entities within it)
- Add synonyms and related words
- Include proper nouns, abbreviations, and alternate spellings the user might have used
- Think about how someone would actually write a casual note on this topic

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
  today: string
): string {
  const lastSync = stats.lastIngestAt
    ? new Date(stats.lastIngestAt).toLocaleDateString()
    : 'desconocido'
  const embeddingNote =
    stats.embeddings < stats.messages
      ? ` (${stats.messages - stats.embeddings} sin indexar aún)`
      : ' (totalmente indexado)'
  const dbContext =
    `Base de conocimiento: ${stats.messages} mensajes${embeddingNote}. ` +
    `Última sincronización: ${lastSync}. Hoy: ${today}.`

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

  return `Sos BrainTwo, un asistente de IA personal integrado en la app BrainTwo.
BrainTwo captura los mensajes que el usuario se envía a sí mismo en WhatsApp.

${dbContext}
${termsLine}

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
} {
  let content = raw
  let action: { action: 'navigate'; view: string } | undefined
  let remember: string | undefined

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
    } catch { /* not parseable — keep the line */ }
    return line
  }).trim()

  return { content, action, remember }
}
