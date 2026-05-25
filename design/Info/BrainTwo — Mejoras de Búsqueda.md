# BrainTwo — Plan de mejoras de búsqueda

Dos features independientes que se potencian entre sí. Orden recomendado: primero Hybrid Search (sin dependencias externas, beneficio inmediato), luego Contextual Retrieval (requiere AI config).

---

## Feature 1 — Hybrid Search + Reciprocal Rank Fusion

### Problema actual
`search.ts` solo usa la búsqueda vectorial (vec0). Falla con nombres propios, fechas exactas y frases literales, porque el embedding no captura igualdad léxica. Ya existe FTS5 en la BD pero no se usa en las búsquedas del usuario.

### Qué es RRF
Cada buscador produce un ranking. RRF combina todos los rankings con la fórmula:

```
rrf_score(d) = Σ  1 / (k + rank_i(d))
```

donde `k = 60` (constante estándar), `rank_i` es la posición del documento en el ranking `i` (desde 1). Si un documento no aparece en una lista, su contribución es 0. Documentos que aparecen en ambas listas reciben score más alto que los que aparecen solo en una.

### Archivos a modificar

**`electron/services/db.ts`**
- `searchKeyword` actualmente devuelve `{ id, text, timestamp }`. Agregar `source`, `kind`, `wa_msg_id` para que el resultado sea compatible con `SimilarResult`.
- Agregar interfaz `KeywordResult` actualizada.

**`electron/services/search.ts`**
- `query()` actualmente: embed query → `searchSimilar()` → filtrar. 
- Nuevo flujo:
  1. En paralelo: `embeddings.embed(clean, 'query')` + `db.searchKeyword(clean, k * 2)`
  2. `db.searchSimilar(queryVec, k * 2)` con los vectores listos
  3. Construir ranking vectorial y ranking keyword (posición 1-based)
  4. Aplicar RRF sobre la unión de IDs
  5. Cortar al top-k, devolver resultados con campo `source: 'semantic' | 'keyword' | 'both'`
- Conservar `filterByRelevance` solo sobre los candidatos que vienen de la búsqueda vectorial antes de fusionar, para no penalizar a los que solo matchean por keyword.

**`shared/types.ts`**
- Agregar campo opcional `matchSource?: 'semantic' | 'keyword' | 'both'` a `SearchResult`.

**`src/views/Search.tsx`** (opcional, mejora UX)
- Mostrar un badge pequeño en cada resultado indicando si vino de búsqueda semántica, exacta, o ambas.

### Pseudocódigo del merger RRF

```typescript
function rrf(vecResults: SearchResult[], kwResults: KeywordResult[], k = 60): FusedResult[] {
  const scores = new Map<number, number>()
  const data = new Map<number, SourceData>()

  vecResults.forEach((r, idx) => {
    scores.set(r.id, (scores.get(r.id) ?? 0) + 1 / (k + idx + 1))
    data.set(r.id, { ...r, matchSource: 'semantic' })
  })

  kwResults.forEach((r, idx) => {
    const prev = scores.get(r.id) ?? 0
    scores.set(r.id, prev + 1 / (k + idx + 1))
    if (data.has(r.id)) {
      data.get(r.id)!.matchSource = 'both'
    } else {
      data.set(r.id, { ...r, matchSource: 'keyword' })
    }
  })

  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id, score]) => ({ ...data.get(id)!, rrfScore: score }))
}
```

---

## Feature 2 — Contextual Retrieval (auto-generado por IA)

### Problema actual
Los embeddings se generan solo sobre el texto del mensaje. Mensajes cortos o ambiguos ("jaja sí re", un audio de 45s) producen vectores pobres que no se recuperan en búsquedas temáticas.

### Qué es Contextual Retrieval
Antes de embeddear, un LLM genera una nota de contexto de 1-2 oraciones que sitúa el mensaje: qué tipo de contenido es, sobre qué trata, en qué situación fue enviado. El embedding se genera sobre `contexto + "\n" + texto`, no solo el texto.

Anthropic reportó mejoras de hasta un 49% en recall con este enfoque.

### Nuevo campo en BD

```sql
ALTER TABLE messages ADD COLUMN context_note TEXT
```

Se agrega como POST_MIGRATION idempotente en `db.ts`.

### Pipeline de generación de contexto

El flujo ocurre en background, similar al queue de embeddings que ya existe:

```
Mensaje ingresado
  → ingest() → rowId
  → queueEmbedding(rowId, text)         ← ya existe
  → queueContext(rowId)                  ← nuevo (solo si AI config disponible)

Worker de contexto:
  → SELECT messages sin context_note
  → callProvider() con prompt de contexto
  → UPDATE messages SET context_note = ? WHERE id = ?
  → DELETE FROM message_embeddings WHERE msg_id = ?  (invalida embedding viejo)
  → queueEmbedding(rowId, context_note + "\n" + text)  (re-embeddea enriquecido)
```

### Prompt de generación de contexto

```
Sos un asistente que ayuda a indexar mensajes de WhatsApp para búsqueda futura.
Dado el siguiente mensaje, escribí UNA oración de contexto que describa de qué trata 
y en qué situación fue enviado. Sé específico pero conciso. No uses comillas ni repitas 
el texto original.

Tipo: {kind}
{si kind != text: "Duración/tamaño: {media summary}"}
Texto: {text o "(sin texto)"}

Responde solo con la oración de contexto, sin explicaciones.
```

### Archivos nuevos y modificados

**`electron/services/context.ts`** ← nuevo
- `createContextService(deps: { db, aiConfig, embeddings })`: `ContextService`
- Métodos: `queueMessage(id)`, `backfillMissing(limit)`, `processNext()`
- El worker llama a `callProvider()` con el prompt y guarda el resultado
- Después de guardar, invalida el embedding y encola el re-embedding con texto enriquecido

**`electron/services/db.ts`**
- Agregar `context_note TEXT` a POST_MIGRATIONS
- Agregar a `DbInstance`:
  - `updateContextNote(id: number, note: string): void`
  - `listMessagesWithoutContext(limit: number): EmbeddableMessage[]`
- Modificar `listMessagesWithoutEmbeddings` para que priorice mensajes que sí tienen `context_note` (así el re-embedding ocurre primero que el embedding inicial de mensajes sin contexto)

**`electron/services/ingest.ts`**
- `createIngestPipeline` recibe opcionalmente `contextService`
- Después de hacer `queueEmbedding`, llama a `contextService?.queueMessage(rowId)`
- En `backfillMissing`, también llamar `contextService?.backfillMissing()`

**`electron/main.ts`**
- Instanciar `contextService` si hay `aiConfig` guardada
- Re-instanciar cuando el usuario cambia la AI config en Settings
- Iniciar `backfillMissing()` al arrancar (igual que el backfill de embeddings)

**`electron/services/search.ts`** (ajuste menor)
- `backfillMissing` ya re-embeddea mensajes sin embedding — no necesita cambios, ya va a capturar los re-embeddings que genera el context worker

### Consideraciones

- **Costo**: contexto solo se genera una vez por mensaje. Con Haiku (~$0.25/1M tokens), 10.000 mensajes ≈ $0.02.
- **Latencia**: el context worker corre en background, no bloquea ingestión ni UI. Los mensajes nuevos se embeddean primero con texto solo, luego se re-embeddean cuando el contexto llega.
- **Sin AI config**: el sistema funciona exactamente igual que hoy. El campo `context_note` queda NULL y el embedding usa solo el texto.
- **Privacidad**: los textos de los mensajes salen a la API del proveedor configurado. Mismo caso de uso que el AI Chat ya existente.

---

## Orden de implementación sugerido

| Paso | Qué | Por qué primero |
|------|-----|-----------------|
| 1 | Hybrid Search + RRF | Sin dependencias externas, mejora inmediata para búsquedas exactas |
| 2 | Schema + DB helpers para `context_note` | Base necesaria para el context worker |
| 3 | `context.ts` — generación de contexto | El núcleo del feature |
| 4 | Wire en `main.ts` + backfill | Activación del pipeline completo |
| 5 | Badge de fuente en Search view | Mejora de UX, opcional |
