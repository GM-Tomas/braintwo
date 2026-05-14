# BrainTwo — Brief técnico para desarrollo

> Documento autocontenido para que Claude Code arranque a desarrollar BrainTwo de cero, etapa por etapa, sin necesidad de preguntar decisiones técnicas ya tomadas.

---

## 📋 Contexto del proyecto

**BrainTwo** es una app de escritorio que convierte el chat de WhatsApp consigo mismo en una base de conocimiento personal con búsqueda semántica e IA local. La idea: usar el lugar donde la gente YA guarda sus pensamientos sin fricción (su WhatsApp) y agregarle una capa de inteligencia que los recupera, organiza y conecta.

**Equipo:** Syntropy (proyecto de Seminario de Integración 2026, universidad).

**Principio rector:** privacidad total. Todo procesamiento corre local. Los datos del usuario no salen de su máquina.

---

## 🛠 Stack técnico definido

```
Runtime:        Electron (app de escritorio multiplataforma)
Lenguaje:       TypeScript (strict mode)
UI:             React + Tailwind
Bundler:        Vite (electron-vite)
WhatsApp:       @whiskeysockets/baileys (NO whatsapp-web.js)
Base de datos:  better-sqlite3 + sqlite-vec
Embeddings:     @xenova/transformers
                Modelo: Xenova/multilingual-e5-small (384 dims, ~120MB)
Clasificación:  Zero-shot con Xenova/mDeBERTa-v3-base-mnli-xnli (en v1.1)
Logger:         pino
Packaging:      electron-builder
```

---

## ✅ Decisiones técnicas tomadas (NO revisitar)

- **Baileys, no whatsapp-web.js**: whatsapp-web.js usa Puppeteer (Chrome headless), suma 200MB de overhead y es ineficiente para Electron. Baileys conecta directo vía WebSocket al protocolo de WhatsApp Web.
- **sqlite-vec, no sqlite-vss**: vss está deprecated. vec es del mismo autor (Alex Garcia), C puro, sin dependencias.
- **transformers.js, no Ollama**: Ollama requiere instalación separada por parte del usuario. transformers.js corre embebido en Node y mantiene la app standalone.
- **App siempre corriendo en tray, no cron job**: la app vive en background con autostart al iniciar el SO. La conexión Baileys se mantiene persistente. El catch-up offline cubre los gaps cuando la PC está apagada.
- **TypeScript strict + ESM modules**: nada de CommonJS, nada de `any` salvo donde Baileys lo requiera explícitamente.

---

## 🧠 Limitación arquitectónica de WhatsApp que impacta el diseño

Las librerías que se conectan como "Linked Device" (Baileys, whatsapp-web.js) **no pueden bajar el histórico completo** del chat. Esto es un constraint de la arquitectura de WhatsApp, no de la librería: el primary phone solo envía un bundle de mensajes recientes al device recién vinculado.

**Solución adoptada:** doble fuente de datos.

1. **Histórico previo al pairing**: el usuario hace una vez "Configuración → Chat → Exportar chat → Sin medios" en WhatsApp y la app importa ese `.txt` durante el onboarding. Cubre el 100% del pasado.
2. **Mensajes nuevos**: Baileys los captura en tiempo real con la app corriendo, y vía offline catch-up cuando reconecta tras un drop o tras prender la PC.

---

## 👤 Patrón de uso esperado del usuario

PC encendida cada 2-3 días, app corriendo en background con autostart. La app se sincroniza automáticamente al boot (catch-up offline) y mantiene la conexión activa mientras la PC esté prendida. **Cobertura esperada: 95-98% en este patrón de uso, con chat de volumen normal.**

---

## 🎯 Alcance de la v1 (mantener mínimo viable)

### Capacidades NO negociables de v1

1. **Onboarding con QR**: la app muestra QR para vincularse a WhatsApp como Linked Device. Sesión persistida con `useMultiFileAuthState`.
2. **Bootstrap con Export Chat**: la app guía al usuario a exportar su chat consigo mismo desde WhatsApp y le permite importar el `.txt`. Parser que maneje formato Android e iOS, mensajes multilínea.
3. **Captura en tiempo real con Baileys**: el chat conmigo mismo (filtrado por `remoteJid === sock.user.id`) se ingesta automáticamente.
4. **Offline catch-up funcional**: el handler de `messages.upsert` procesa **ambos** types (`notify` y `append`). Crítico — sin esto se pierden los catch-ups.
5. **App vive en tray**: autostart al SO con `openAsHidden: true`, single instance lock, cerrar window oculta al tray pero no mata el proceso.
6. **Reconexión robusta**: backoff exponencial al perder conexión, manejo correcto de `DisconnectReason.loggedOut`, `getMessage` definido (aunque devuelva undefined) para evitar pérdida silenciosa por reintentos de cifrado fallidos.
7. **Dedup por `wa_msg_id` UNIQUE**: `INSERT OR IGNORE` en SQLite. Permite que las capas (history-sync, append, notify, export) se solapen sin generar basura.
8. **Embeddings + sqlite-vec**: cada mensaje ingestado se embebe con transformers.js y se inserta en una virtual table `vec0` de 384 dims.
9. **Búsqueda semántica**: query del usuario → embed → KNN search → top-k mensajes ordenados por distancia.
10. **Indicador visual de estado de sync** en la UI: 🟢 al día / 🟡 sincronizando / 🔴 desconectado. No es feature opcional — es transparencia para el usuario y demo del seminario.

### Lo que NO va en v1 (deferido conscientemente)

- Watchdog interno por conexiones zombi
- Power monitor para suspend/resume del SO
- Reconciliación periódica con export
- Doble device redundante
- Tabla de events para observability completa
- Clasificación zero-shot (puede ir en v1.1, no es bloqueante)
- Manejo de medios (imágenes, audios, documentos) — solo texto y captions en v1
- Multi-usuario / multi-cuenta

---

## 🏗 Arquitectura de la app

```
┌──────────────────────────────────────────────┐
│  Electron renderer (React UI)                │
│  - Onboarding (QR + import export)           │
│  - Search view                               │
│  - Timeline view                             │
│  - Status indicator (🟢🟡🔴)                  │
└──────────────────┬───────────────────────────┘
                   │ IPC (preload bridge)
┌──────────────────┴───────────────────────────┐
│  Electron main process                       │
│  ┌────────────────────────────────────────┐  │
│  │ Tray icon + autostart + single instance│  │
│  └────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────┐  │
│  │ Baileys service (siempre conectado)    │  │
│  │ - QR emission                          │  │
│  │ - reconnect con backoff exponencial    │  │
│  │ - messages.upsert (notify + append)    │  │
│  │ - messaging-history.set                │  │
│  └────────────────┬───────────────────────┘  │
│                   ▼                          │
│  ┌────────────────────────────────────────┐  │
│  │ Ingest pipeline                        │  │
│  │ extract text → embed → INSERT OR IGNORE│  │
│  └────────────────┬───────────────────────┘  │
│                   ▼                          │
│  ┌────────────────────────────────────────┐  │
│  │ better-sqlite3 + sqlite-vec            │  │
│  │ messages + message_embeddings (vec0)   │  │
│  └────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────┐  │
│  │ Export parser (.txt → ParsedMessage[]) │  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
```

---

## 📁 Estructura de carpetas propuesta

```
braintwo/
├── electron/
│   ├── main.ts                  # entry point: tray, autostart, single instance, IPC
│   ├── preload.ts               # bridge IPC seguro (contextBridge)
│   └── services/
│       ├── whatsapp.ts          # Baileys connect + handlers
│       ├── ingest.ts            # text extraction + dedup + dispatch
│       ├── embeddings.ts        # transformers.js singleton
│       ├── search.ts            # sqlite-vec queries
│       ├── db.ts                # better-sqlite3 init + migrations
│       └── export-parser.ts     # WhatsApp .txt → ParsedMessage[]
├── src/                         # React app (renderer)
│   ├── App.tsx
│   ├── views/
│   │   ├── Onboarding.tsx       # QR + import export flow
│   │   ├── Search.tsx
│   │   └── Timeline.tsx
│   ├── components/
│   │   └── SyncStatusBadge.tsx  # 🟢🟡🔴
│   └── ipc.ts                   # window.electron wrappers
├── shared/
│   └── types.ts                 # tipos compartidos main/renderer
├── userData/                    # NO en repo, en app.getPath('userData')
│   ├── auth/                    # Baileys session
│   ├── braintwo.db              # SQLite + vec
│   └── models/                  # cache de transformers.js
├── package.json
├── tsconfig.json
├── electron.vite.config.ts
└── electron-builder.yml
```

---

## 🗄 Esquema de base de datos

```sql
CREATE TABLE messages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  wa_msg_id   TEXT UNIQUE NOT NULL,      -- clave de dedup
  timestamp   INTEGER NOT NULL,           -- unix ms
  text        TEXT NOT NULL,
  source      TEXT NOT NULL,              -- 'export' | 'history-sync' | 'realtime' | 'offline-sync'
  raw_json    TEXT,
  created_at  INTEGER DEFAULT (unixepoch())
);

CREATE INDEX idx_msg_ts ON messages(timestamp);

-- Virtual table de sqlite-vec para búsqueda KNN
CREATE VIRTUAL TABLE message_embeddings USING vec0(
  msg_id      INTEGER PRIMARY KEY,
  embedding   FLOAT[384]
);
```

Para mensajes que vienen del export (sin `wa_msg_id` real), generar ID sintético determinista:

```typescript
import crypto from 'crypto'
function syntheticId(timestamp: number, text: string): string {
  return 'export:' + crypto.createHash('sha1')
    .update(`${timestamp}|${text}`)
    .digest('hex').slice(0, 24)
}
```

---

## ⚙️ Configuración crítica de Baileys

```typescript
import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  Browsers,
  makeCacheableSignalKeyStore,
} from '@whiskeysockets/baileys'

const sock = makeWASocket({
  version,
  auth: {
    creds: state.creds,
    keys: makeCacheableSignalKeyStore(state.keys, logger),  // CRÍTICO
  },
  browser: Browsers.macOS('Desktop'),     // más histórico al sync inicial
  syncFullHistory: true,                   // pedir todo lo posible
  markOnlineOnConnect: false,              // no interferir con push del primary
  keepAliveIntervalMs: 25_000,
  connectTimeoutMs: 60_000,
  defaultQueryTimeoutMs: 60_000,
  retryRequestDelayMs: 1_000,
  maxMsgRetryCount: 5,
  getMessage: async (key) => undefined,    // CRÍTICO: sin esto fallan retries de cifrado
  logger,
})
```

---

## 🎧 Handlers críticos

```typescript
// Procesar AMBOS types — append es offline catch-up
sock.ev.on('messages.upsert', async ({ type, messages }) => {
  for (const msg of messages) {
    const myJid = sock.user?.id
    if (msg.key.remoteJid !== myJid) continue  // solo "yo a yo"

    await ingestMessage(msg, {
      source: type === 'append' ? 'offline-sync' : 'realtime'
    })
  }
})

// Histórico inicial post-pairing
sock.ev.on('messaging-history.set', async ({ messages, isLatest }) => {
  for (const msg of messages) {
    const myJid = sock.user?.id
    if (msg.key.remoteJid !== myJid) continue
    await ingestMessage(msg, { source: 'history-sync' })
  }
})

// Reconexión con backoff
let backoff = 1000
sock.ev.on('connection.update', ({ connection, qr, lastDisconnect }) => {
  if (qr) mainWindow?.webContents.send('wa:qr', qr)
  if (connection === 'open') backoff = 1000
  if (connection === 'close') {
    const code = lastDisconnect?.error?.output?.statusCode
    if (code === DisconnectReason.loggedOut) {
      mainWindow?.webContents.send('wa:logged-out')
      return
    }
    backoff = Math.min(backoff * 2, 30_000)
    setTimeout(connect, backoff)
  }
})
```

---

## 🪟 Patrón de Electron main

```typescript
// Single instance lock
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) { app.quit(); process.exit(0) }

// Autostart con SO
app.setLoginItemSettings({
  openAtLogin: true,
  openAsHidden: true,
  args: ['--hidden'],
})

// Window-all-closed NO mata la app
app.on('window-all-closed', (e) => {
  if (!app.isQuitting) e.preventDefault()
})

// Tray con menu contextual (Abrir / Estado / Salir)
// La conexión Baileys arranca ANTES de mostrar window
```

---

## 📝 Parser de Export Chat (formato a soportar)

```
Android: "16/3/2024 14:32 - Vos: mensaje"
iOS:     "[16/3/2024, 14:32:15] Vos: mensaje"
```

Manejar mensajes multilínea (las líneas que no matchean el patrón pertenecen al mensaje anterior). Detectar y descartar líneas de sistema ("Los mensajes y las llamadas están cifrados de extremo a extremo", "X cambió su número", "<Multimedia omitido>", etc.).

---

## 🔁 Pipeline de ingesta (función central)

```typescript
async function ingestMessage(waMsg, meta: { source: string }) {
  const text = extractText(waMsg)  // text || caption || ''
  if (!text || text.trim().length === 0) return

  const result = db.prepare(`
    INSERT OR IGNORE INTO messages (wa_msg_id, timestamp, text, source, raw_json)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    waMsg.key.id,
    Number(waMsg.messageTimestamp) * 1000,
    text,
    meta.source,
    JSON.stringify(waMsg)
  )

  if (result.changes === 0) return  // duplicado

  const vec = await embed(text)
  db.prepare(`
    INSERT INTO message_embeddings(msg_id, embedding) VALUES (?, ?)
  `).run(result.lastInsertRowid, vec)
}
```

---

## 🔍 Búsqueda semántica

```typescript
async function search(query: string, k = 10) {
  const queryVec = await embed(query)
  return db.prepare(`
    SELECT m.*, e.distance
    FROM message_embeddings e
    JOIN messages m ON m.id = e.msg_id
    WHERE e.embedding MATCH ? AND k = ?
    ORDER BY e.distance
  `).all(queryVec, k)
}
```

---

## 📡 IPC Channels mínimos

```typescript
// Renderer → Main
'wa:request-qr'             // pedir QR para iniciar pairing
'wa:logout'                 // desvincular sesión
'export:import'             // path al .txt para importar
'search:query'              // string → ranked results
'app:get-sync-status'       // poll del estado actual
'app:open-window'           // desde el tray

// Main → Renderer
'wa:qr'                     // string del QR a renderizar
'wa:connection-state'       // 'connecting' | 'open' | 'close' | 'logged-out'
'wa:caught-up'              // offline catch-up completado
'sync:progress'             // { processed, total } durante import o sync
'message:ingested'          // notificación de mensaje nuevo en DB
```

---

## ⚠️ Trampas conocidas a evitar

1. **No descartar `type === 'append'`**: es donde llegan los offline catch-ups. Bug clásico.
2. **`getMessage` debe estar definido** aunque devuelva `undefined`. Sin esto los retries de cifrado fallan en silencio.
3. **Native modules + Electron**: `better-sqlite3` y `onnxruntime-node` (dep de transformers.js) requieren rebuild contra la versión de Node de Electron. Usar `electron-builder install-app-deps` en `postinstall`.
4. **Tamaño del modelo**: el modelo de embeddings (~120MB) idealmente se descarga al primer arranque, no se empaca en el instalador.
5. **El JID del "yo"**: en WhatsApp el chat consigo mismo tiene `remoteJid === sock.user.id`. Filtrar por eso para ingestar solo el chat propio.
6. **Timestamps**: `messageTimestamp` de Baileys viene en segundos (Long), multiplicar por 1000 para ms.
7. **Sesiones de 14 días**: si el primary phone está más de 14 días sin actividad, todos los linked devices se desloguean. Mostrar warning en la UI si hace más de 7 días desde la última conexión exitosa.
8. **Evitar bloquear el event loop con embeddings**: cada `embed()` toma ~50-200ms. Si entran muchos mensajes juntos (ej: history sync), procesarlos en batch o con `setImmediate` entre cada uno para no congelar la UI.

---

## 🧭 Convenciones de código

- **TypeScript strict mode** — sin `any` excepto donde Baileys lo fuerza. Documentar el motivo cuando ocurra.
- **ESM modules** (`"type": "module"` en package.json).
- **Funciones puras** donde sea posible, especialmente en `ingest.ts` y `search.ts`.
- **Logger estructurado** (pino) con contexto: `{ service: 'whatsapp', event: 'message-ingested', wa_msg_id: '...' }`.
- **Errores manejados explícitamente** — nada de `try/catch` que silencia.
- **IPC channels documentados** con tipos compartidos en `shared/types.ts` entre main y renderer.
- **No commitear** `userData/`, `node_modules/`, ni archivos `.env`.

---

# 🚀 Roadmap de implementación por etapas

> **Instrucciones para Claude Code**: Implementá una etapa por vez. Al terminar cada etapa, parar y esperar feedback antes de continuar. Cada etapa termina con un criterio de aceptación verificable manualmente.

---

## Etapa 1 — Skeleton de Electron + Tray + Autostart

**Objetivo:** tener una app Electron que arranca, se queda en el tray, sobrevive al cierre de ventana, y se autostartea con el SO.

### Tareas

- [ ] Inicializar proyecto con `npm init` + TypeScript strict + ESM.
- [ ] Instalar deps base: `electron`, `electron-builder`, `electron-vite`, `react`, `react-dom`, `tailwindcss`.
- [ ] Configurar `electron.vite.config.ts` con entries para `main`, `preload` y `renderer`.
- [ ] Crear `electron/main.ts` con:
  - Single instance lock.
  - `app.setLoginItemSettings({ openAtLogin: true, openAsHidden: true })`.
  - Tray con menú contextual: "Abrir BrainTwo", "Estado: Iniciando...", "Salir".
  - `window-all-closed` con `e.preventDefault()` salvo `app.isQuitting`.
  - BrowserWindow básica que se oculta al tray al cerrar (no se destruye).
- [ ] Crear `electron/preload.ts` con `contextBridge.exposeInMainWorld('electron', {...})` (vacío por ahora).
- [ ] Crear `src/App.tsx` mínimo: "Hola BrainTwo".
- [ ] Configurar `package.json` scripts: `dev`, `build`, `start`, `package`.
- [ ] Configurar `electron-builder.yml` básico (al menos para la plataforma del dev).

### Criterio de aceptación

- `npm run dev` levanta la app con la ventana visible.
- Cerrar la ventana oculta al tray; clic en tray reabre.
- Click derecho en tray → "Salir" cierra realmente.
- Reiniciar el SO → la app aparece en el tray sola (autostart).
- Solo una instancia: abrir el ejecutable dos veces, la segunda se cierra.

---

## Etapa 2 — Base de datos: better-sqlite3 + sqlite-vec

**Objetivo:** tener la DB inicializada, con el esquema, y un test de inserción + dedup funcionando.

### Tareas

- [ ] Instalar `better-sqlite3` y `sqlite-vec`.
- [ ] Configurar `postinstall` con `electron-builder install-app-deps` para rebuild de native modules.
- [ ] Crear `electron/services/db.ts`:
  - Inicializar DB en `app.getPath('userData') + '/braintwo.db'`.
  - `db.pragma('journal_mode = WAL')`.
  - Cargar extensión sqlite-vec.
  - Aplicar migrations (esquema completo del documento).
- [ ] Exponer helper `getDb()` singleton.
- [ ] Crear archivo de test rápido (`scripts/test-db.ts`) que:
  - Inserta 3 mensajes con `INSERT OR IGNORE`.
  - Inserta el mismo mensaje de nuevo y verifica que `changes === 0`.
  - Inserta un vector de prueba en `message_embeddings`.
  - Hace una query KNN dummy y la imprime.

### Criterio de aceptación

- `npx tsx scripts/test-db.ts` corre sin errores.
- La DB se crea en el path correcto.
- Dedup funciona: insertar el mismo `wa_msg_id` dos veces no duplica.
- Insert + query en `message_embeddings` funciona.

---

## Etapa 3 — Conexión Baileys + QR en UI

**Objetivo:** el usuario puede vincular su WhatsApp escaneando un QR, y la sesión se persiste para futuros arranques.

### Tareas

- [ ] Instalar `@whiskeysockets/baileys`, `@hapi/boom`, `pino`, `qrcode` (para renderizar el QR como dataURL en UI).
- [ ] Crear `electron/services/whatsapp.ts`:
  - `connect()` con todos los flags críticos del documento.
  - `useMultiFileAuthState` apuntando a `app.getPath('userData') + '/auth'`.
  - Handler de `connection.update` con backoff exponencial (cap 30s).
  - Manejo de `DisconnectReason.loggedOut`: borrar carpeta auth, emitir `wa:logged-out`.
  - Emitir QR via IPC `wa:qr` cuando esté disponible.
  - Emitir `wa:connection-state` en cada cambio.
- [ ] En `electron/main.ts`: arrancar `connect()` después de `app.whenReady()` y antes de mostrar window.
- [ ] En `electron/preload.ts`: exponer `onQR(callback)`, `onConnectionState(callback)`, `requestQR()`.
- [ ] En `src/views/Onboarding.tsx`: pantalla que renderiza el QR (usar `qrcode` para convertir el string a dataURL e mostrarlo como `<img>`).
- [ ] Lógica de routing en `App.tsx`: si no hay sesión, mostrar Onboarding; si hay, mostrar placeholder de Search.
- [ ] Actualizar el menú del tray con el estado de conexión real.

### Criterio de aceptación

- Primer arranque: aparece el QR en la UI.
- Escanearlo desde WhatsApp del celular vincula la sesión.
- Cerrar la app y reabrir: ya no pide QR, conecta solo.
- Tray muestra "Conectado" cuando la conexión está abierta.
- Cortar Wi-Fi → estado pasa a "Reconectando..."; restaurar → vuelve a "Conectado" sin reescanear.

---

## Etapa 4 — Captura de mensajes + Pipeline de ingesta (sin embeddings)

**Objetivo:** los mensajes del chat conmigo mismo se guardan en SQLite con dedup. Sin embeddings todavía.

### Tareas

- [ ] Crear `electron/services/ingest.ts`:
  - `extractText(waMsg)`: extrae texto de `message.conversation`, `message.extendedTextMessage.text`, `message.imageMessage.caption`, etc.
  - `ingestMessage(waMsg, meta)`: el INSERT OR IGNORE descrito en el doc, sin la parte de embeddings (TODO comment).
- [ ] En `whatsapp.ts`, registrar handlers:
  - `messages.upsert` procesando AMBOS types (`notify` y `append`).
  - `messaging-history.set` con `source: 'history-sync'`.
  - Filtrar por `msg.key.remoteJid === sock.user?.id` (chat conmigo mismo).
- [ ] Logueo estructurado con pino: cada mensaje ingestado loguea `{ wa_msg_id, source, timestamp, text_preview }`.
- [ ] Helper IPC `app:get-message-count` → `SELECT COUNT(*) FROM messages` para que la UI lo muestre.

### Criterio de aceptación

- Mandarse un mensaje a uno mismo desde el celular → aparece en la DB en menos de 5 segundos.
- Reiniciar la app → no se duplican los mensajes ya guardados.
- Apagar la PC, mandarse 3 mensajes desde el cel, prender la PC → los 3 mensajes aparecen en la DB tras la reconexión (catch-up).
- Logs de pino muestran `source: 'realtime'` para mensajes nuevos y `source: 'offline-sync'` para los del catch-up.

---

## Etapa 5 — Embeddings + Búsqueda semántica

**Objetivo:** cada mensaje se embebe y se inserta en `message_embeddings`. La búsqueda semántica funciona.

### Tareas

- [ ] Instalar `@xenova/transformers`.
- [ ] Crear `electron/services/embeddings.ts`:
  - Singleton del pipeline `feature-extraction` con `Xenova/multilingual-e5-small`.
  - `embed(text)` que devuelve `Float32Array` de 384 dims, normalizado.
  - Configurar `env.cacheDir` apuntando a `app.getPath('userData') + '/models'`.
  - Lazy init: el modelo se carga la primera vez que se usa, mostrando progreso vía IPC `sync:progress`.
- [ ] Modificar `ingestMessage` para insertar el embedding después del INSERT OR IGNORE exitoso.
- [ ] Crear `electron/services/search.ts`:
  - `search(query, k)` con la query KNN del documento.
  - Devolver `{ id, text, timestamp, distance }[]`.
- [ ] Exponer IPC `search:query`.
- [ ] Crear `src/views/Search.tsx`:
  - Input de búsqueda con debounce de 300ms.
  - Lista de resultados con texto, fecha formateada y % de similitud (`(1 - distance) * 100`).
- [ ] Backfill: al detectar mensajes en `messages` sin entrada en `message_embeddings`, embebrlos en background al arrancar la app.

### Criterio de aceptación

- El modelo se descarga la primera vez (mostrando progreso) y queda cacheado.
- Buscar "ideas para el TP" devuelve mensajes relacionados aunque no contengan esas palabras exactas.
- La búsqueda responde en menos de 500ms con DB de hasta 10k mensajes.
- El backfill procesa los mensajes de etapas anteriores que no tenían embedding.

---

## Etapa 6 — Parser y flow de import del Export Chat

**Objetivo:** el usuario puede importar el `.txt` exportado desde WhatsApp y se ingestan todos los mensajes históricos.

### Tareas

- [ ] Crear `electron/services/export-parser.ts`:
  - Patrones regex para Android e iOS.
  - Parser que maneja mensajes multilínea (líneas sin patrón pertenecen al mensaje anterior).
  - Filtrar líneas de sistema (cifrado, multimedia omitido, cambios de número).
  - Devolver `ParsedMessage[]` con `{ timestamp, sender, text }`.
- [ ] Función `ingestFromExport(parsed)`:
  - Generar `wa_msg_id` sintético determinista con SHA-1.
  - Llamar a `ingestMessage` con `source: 'export'`.
  - Procesar en batch con yield (`setImmediate`) cada 50 mensajes para no congelar el proceso.
  - Emitir `sync:progress` con `{ processed, total }` durante el proceso.
- [ ] Exponer IPC `export:import` que abre un `dialog.showOpenDialog` para seleccionar el `.txt`.
- [ ] En `Onboarding.tsx`, después del QR escaneado, mostrar paso "Importar histórico" con instrucciones claras de cómo exportar el chat desde WhatsApp + botón de import.
- [ ] Mostrar barra de progreso durante el import.

### Criterio de aceptación

- Exportar el chat conmigo mismo desde WhatsApp Android e iOS y ambos parsean OK.
- Mensajes multilínea se concatenan correctamente.
- Re-importar el mismo `.txt` no genera duplicados (gracias a IDs deterministas).
- 10.000 mensajes se importan en menos de 2 minutos sin congelar la UI.
- Los mensajes importados son buscables semánticamente.

---

## Etapa 7 — Sync Status Badge + Polish de UX

**Objetivo:** la UI comunica claramente el estado del sistema en todo momento.

### Tareas

- [ ] Crear `src/components/SyncStatusBadge.tsx`:
  - 🟢 "Al día — última sincronización hace X minutos"
  - 🟡 "Sincronizando… (X mensajes procesados)"
  - 🔴 "Desconectado — reintentando en Xs"
  - ⚠️ "El primary phone lleva X días sin actividad" (warning a partir de 7 días).
- [ ] Lógica de derivación del estado en main process basada en último `connection.update` y último `messages.upsert`.
- [ ] Mostrar el badge en el header de cualquier vista (excepto Onboarding).
- [ ] En el tray: actualizar el menú contextual con el estado actual.
- [ ] Notificación nativa de Electron cuando termina el catch-up offline ("BrainTwo: 12 mensajes nuevos sincronizados").
- [ ] Theme dark consistente con el branding (paleta del pitch deck: `#060a12` / `#1a8fe3` / `#2ec4a5`).

### Criterio de aceptación

- En todo momento, el usuario sabe si la app está al día, sincronizando, o desconectada.
- Tras un catch-up offline, aparece notificación nativa con el conteo.
- Cortar Wi-Fi → badge cambia a 🔴 con countdown del backoff.
- Diseño visual consistente con el pitch deck.

---

## Etapa 8 — Packaging y distribución

**Objetivo:** generar el instalador para la plataforma del dev (al menos) y verificar que la app empaquetada funciona end-to-end.

### Tareas

- [ ] Configurar `electron-builder.yml` completo:
  - `appId`, `productName: 'BrainTwo'`, `copyright`.
  - Targets: `nsis` (Windows), `dmg` (macOS), `AppImage` (Linux) — al menos el del dev.
  - Iconos en `build/icon.png` (512x512), `build/icon.ico` (Windows), `build/icon.icns` (macOS).
  - `extraResources` si hace falta empacar algo de `node_modules` que no se incluye automáticamente.
- [ ] `package.json` script `package` corre `electron-builder build`.
- [ ] Verificar que la app empaquetada:
  - Arranca standalone sin Node.js instalado.
  - Persiste sesión Baileys.
  - Persiste DB.
  - Autostart funciona desde el instalador.
- [ ] README del repo con instrucciones de instalación, uso y desarrollo.

### Criterio de aceptación

- `npm run package` genera el instalador.
- Instalador se ejecuta limpio en una máquina sin Node.js.
- App instalada se autostartea, conecta, ingiere, busca.
- README cubre desde clone hasta build.

---

## 🔮 Lo que el usuario va a pedir después (mantenerlo en mente al diseñar)

- Timeline cronológico navegable
- Clasificación automática (idea/tarea/link/recordatorio) con zero-shot
- Detección y resolución de links (preview con título y descripción)
- Tags manuales
- Reconciliación con export periódico
- Soporte de imágenes y audios (transcripción local con Whisper)
- Watchdog interno por conexiones zombi
- Power monitor para suspend/resume del SO

**No implementar nada de eso en v1**, pero diseñar el esquema y la arquitectura de forma que estos features no requieran refactor mayor.

---

## 📌 Notas finales para Claude Code

- **No avanzar de etapa sin completar el criterio de aceptación.** Si hay duda, parar y preguntar.
- **Commits por etapa.** Cada etapa termina con un commit claro: `feat(etapa-N): descripción corta`.
- **Tests manuales documentados.** Al cerrar cada etapa, dejar en `docs/testing-stage-N.md` los pasos exactos para reproducir el criterio de aceptación.
- **Si una decisión técnica no está en este brief, preguntar antes de improvisar.** Ejemplos: librería de styling extra, estrategia de manejo de errores específica, formato de fechas en UI.
- **Si Baileys u otra dep cambian su API entre el momento de escribir esto y el desarrollo**, adaptarse a la versión actual y dejar nota en `CHANGELOG.md`.

---

*Documento vivo. Actualizar a medida que el proyecto evolucione.*
