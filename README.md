# BrainTwo

App de escritorio que convierte el chat de WhatsApp consigo mismo en una base de conocimiento personal con búsqueda semántica e IA local. Todo el procesamiento corre local — los datos no salen de la máquina.

**Proyecto:** Syntropy — Seminario de Integración 2026.

---

## Stack

| Capa | Tecnología |
|---|---|
| Runtime | Electron (multiplataforma) |
| Lenguaje | TypeScript strict + ESM |
| UI | React 18 + Tailwind |
| Bundler | Vite (electron-vite) |
| WhatsApp | @whiskeysockets/baileys (WebSocket directo, sin Puppeteer) |
| Base de datos | better-sqlite3 + sqlite-vec |
| Embeddings | @xenova/transformers — `Xenova/multilingual-e5-small` (384 dims, ~120 MB) |
| Logger | pino |
| Packaging | electron-builder |

**Por qué Baileys y no whatsapp-web.js**: whatsapp-web.js usa Puppeteer (Chrome headless, ~200 MB de overhead ineficiente en Electron). Baileys conecta directo al protocolo de WhatsApp Web vía WebSocket.

**Por qué sqlite-vec y no sqlite-vss**: vss está deprecated. vec es del mismo autor (Alex Garcia), C puro, sin dependencias.

**Por qué transformers.js y no Ollama**: Ollama requiere instalación separada. transformers.js corre embebido en Node y mantiene la app standalone.

---

## Desarrollo

```bash
npm install        # instala deps + rebuild de native modules para Electron
npm run dev        # arranca Electron + React con hot reload
npm test           # suite (vitest)
npm run test:coverage
npm run typecheck
npm run package    # genera instalador
```

> **Importante:** la variable de entorno `ELECTRON_RUN_AS_NODE` no debe estar seteada globalmente. Los scripts de npm la neutralizan automáticamente via `scripts/run-evite.mjs`. Si el `.exe` empaquetado crashea con `Cannot read properties of undefined (reading 'whenReady')`, esa variable es la causa.

### `GROQ_API_KEY`

La app transcribe audios de WhatsApp usando Whisper a través de Groq. En **desarrollo**, cargá la key desde `.env` o exportala como variable de entorno:

```bash
# .env (copiar .env.example)
GROQ_API_KEY=gsk_tu_key
```

Al generar el **instalador** (`npm run package`), la key se inyecta automáticamente en el bundle si la variable `GROQ_API_KEY` está seteada en el entorno de build. Una vez empaquetada, la app funciona sin necesidad de la variable.

### ABI de native modules

`better-sqlite3` y `onnxruntime-node` se precompilan contra una ABI específica. `postinstall` hace el rebuild automáticamente, pero si cambiás la versión de Electron o Node global:

```bash
npm run rebuild:electron   # para npm run dev / package
npm run rebuild:node       # para npm test
```

Si aparece `NODE_MODULE_VERSION mismatch`, borrar `.abi/` y relanzar.

Los tests usan la ABI de Node (no de Electron) — por eso `pretest` corre `rebuild:node` separado del `predev` que corre `rebuild:electron`.

El autostart está deshabilitado en modo `npm run dev` a propósito. Solo activa en builds empaquetados.

---

## Arquitectura

```
┌──────────────────────────────────────────────┐
│  Electron renderer (React UI)                │
│  - Onboarding (QR + import export)           │
│  - Search view                               │
│  - Timeline view                             │
│  - SyncStatusBadge (🟢🟡🔴)                  │
└──────────────────┬───────────────────────────┘
                   │ IPC (preload bridge)
┌──────────────────┴───────────────────────────┐
│  Electron main process                       │
│  ┌─────────────────────────────────────────┐ │
│  │ Tray + autostart + single instance lock │ │
│  └─────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────┐ │
│  │ Baileys service (conexión persistente)  │ │
│  │ QR · reconnect backoff · upsert handler │ │
│  └─────────────────┬───────────────────────┘ │
│                    ▼                         │
│  ┌─────────────────────────────────────────┐ │
│  │ Ingest pipeline                         │ │
│  │ extract text → embed → INSERT OR IGNORE │ │
│  └─────────────────┬───────────────────────┘ │
│                    ▼                         │
│  ┌─────────────────────────────────────────┐ │
│  │ better-sqlite3 + sqlite-vec             │ │
│  │ messages + message_embeddings (vec0)    │ │
│  └─────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────┐ │
│  │ Export parser (.txt → ParsedMessage[])  │ │
│  └─────────────────────────────────────────┘ │
└──────────────────────────────────────────────┘
```

### Base de datos

```sql
CREATE TABLE messages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  wa_msg_id   TEXT UNIQUE NOT NULL,   -- clave de dedup
  timestamp   INTEGER NOT NULL,        -- unix ms
  text        TEXT NOT NULL,
  source      TEXT NOT NULL,           -- 'export' | 'history-sync' | 'realtime' | 'offline-sync'
  raw_json    TEXT,
  created_at  INTEGER DEFAULT (unixepoch())
);

CREATE VIRTUAL TABLE message_embeddings USING vec0(
  msg_id    INTEGER PRIMARY KEY,
  embedding FLOAT[384]
);
```

Mensajes del export `.txt` usan un ID sintético determinista: `'export:' + sha1(timestamp + '|' + text).slice(0, 24)`. Esto permite re-importar el mismo archivo sin duplicados.

---

## Limitación de WhatsApp y doble fuente de datos

Los linked devices (Baileys, whatsapp-web.js) **no pueden descargar el histórico completo** — es un constraint del protocolo de WhatsApp, no de la librería. El primary phone solo envía un bundle de mensajes recientes al device recién vinculado.

Solución adoptada:

1. **Histórico previo al pairing**: el usuario exporta su chat ("Configuración → Chat → Exportar chat → Sin medios") y la app importa el `.txt` durante el onboarding.
2. **Mensajes nuevos**: Baileys los captura en tiempo real y via offline catch-up al reconectar.

Cobertura esperada con PC encendida cada 2-3 días: **95-98%**.

---

## Trampas conocidas

- **No descartar `type === 'append'`** en `messages.upsert`: es donde llegan los offline catch-ups. Error silencioso frecuente.
- **`getMessage` debe estar definido** aunque devuelva `undefined`. Sin esto los retries de cifrado de Baileys fallan en silencio.
- **JID del "yo"**: el chat consigo mismo tiene `remoteJid === sock.user.id`. El sufijo `:N` del linked device se normaliza (`549...:42@s.whatsapp.net` → `549...@s.whatsapp.net`).
- **Timestamps de Baileys**: `messageTimestamp` viene en segundos (Long). Multiplicar por 1000 para ms. Objetos Long tienen `.low` en lugar de ser números planos.
- **`vec0` exige `BigInt` para el PK**: aunque la columna sea `INTEGER`, sqlite-vec rechaza JS numbers. `db.insertEmbedding` castea `BigInt(msgId)` automáticamente.
- **Sesiones de 14 días**: si el primary phone pasa más de 14 días sin abrir WhatsApp, todos los linked devices se desloguean. La app muestra warning a los 7 días.
- **Embeddings y event loop**: cada `embed()` toma ~50-200 ms. La cola usa `setImmediate` entre items para no congelar la UI durante history sync.
- **Batcher flush en quit**: `before-quit` llama `messageBatcher?.flush()` para drenar pendientes antes de cerrar la DB. Si la app crashea, el batch en vuelo se pierde — aceptable porque Baileys reentrega en el próximo connect.

---

## IPC channels

```
# Renderer → Main
'wa:request-qr'          pedir QR para iniciar pairing
'wa:logout'              desvincular sesión
'export:import'          importar .txt del export
'search:query'           string → ranked results
'app:get-sync-status'    estado actual
'app:open-window'        desde el tray

# Main → Renderer
'wa:qr'                  string del QR a renderizar
'wa:connection-state'    'connecting' | 'open' | 'close' | 'logged-out'
'wa:caught-up'           offline catch-up completado
'sync:progress'          { processed, total } durante import o sync
'message:ingested'       nuevo mensaje en DB
'app:error'              { code, message, recoverable }
```

---

## Estado de implementación

| Etapa | Estado |
|---|---|
| 0 — Reset estructural y bootstrap | ✅ |
| 1 — Tray + autostart + single instance | ✅ |
| 2 — SQLite + sqlite-vec | ✅ |
| 3 — Baileys + QR + persistencia de sesión | ✅ |
| 4 — Captura realtime + offline catch-up | ✅ |
| 5 — Embeddings + búsqueda semántica | ✅ |
| 6 — Import export `.txt` + Timeline avanzada | En progreso |
| 7 — Sync Status Badge + notificaciones | Pendiente |
| 8 — Settings + observability | Pendiente |
| 9 — Packaging y distribución | Pendiente |

Cobertura de tests: >95% lines / >90% branches.

---

## Roadmap post-v1

- **Hybrid Search + RRF**: correr búsqueda vectorial y FTS5 en paralelo, fusionar rankings con `score = Σ 1/(k+rank)` (k=60). Mejora búsquedas exactas (nombres propios, fechas) que el embedding no captura bien.
- **Contextual Retrieval**: antes de embeddear, generar una nota de contexto de 1-2 oraciones con un LLM para enriquecer mensajes cortos/ambiguos. Re-embeddear con `contexto + "\n" + texto`. Anthropic reporta hasta 49% mejora en recall.
- **Clasificación zero-shot**: idea / tarea / link / recordatorio con `Xenova/mDeBERTa-v3-base-mnli-xnli`.
- **Detección y resolución de links** (open-graph preview).
- **Tags manuales**.
- **Transcripción de audios local** con Whisper.
- **Reconciliación periódica** con export `.txt` mensual.
- **Watchdog de conexiones zombi** + power monitor (suspend/resume del SO).
- **Multi-cuenta**.

---

## Branding

Paleta: `#060a12` (fondo) / `#1a8fe3` (azul) / `#2ec4a5` (teal)  
Tipografía: Bebas Neue (headings) + Outfit (body)
