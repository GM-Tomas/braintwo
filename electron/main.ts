import {
  app,
  BrowserWindow,
  Notification,
  Menu,
  Tray,
  dialog,
  ipcMain,
  nativeImage,
  session,
  shell
} from 'electron'
import pino from 'pino'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { createWhatsAppService, type WhatsAppService } from './services/whatsapp'
import type { WAConnectionState } from './services/whatsapp-state'
import { openDatabase, type DbInstance } from './services/db'
import { createEmbeddingService, type EmbeddingService } from './services/embeddings'
import { createSearchService, type SearchService } from './services/search'
import { importExportFile, type ImportProgress } from './services/export-parser'
import { createSyncStatusTracker, type SyncStatusTracker } from './services/sync-status'
import { readSettings, writeSettings } from './services/settings'
import { readAiConfig, writeAiConfig } from './services/ai-config'
import { createAiChatService, type AiChatService } from './services/ai-chat'
import { createContextService, type ContextService } from './services/context'
import type { AiConfig, ChatMessage } from '@shared/types'
import {
  createIngestPipeline,
  extractKind,
  extractMediaMeta,
  extractText,
  extractTimestampMs,
  type IngestPipeline,
  type RecentMessage
} from './services/ingest'
import {
  statusLabel,
  buildResourcePath,
  pickTrayIconName,
  buildTrayMenuTemplate,
  createMessageBatcher,
  type MessageBatcher
} from './main-helpers'

const __dirname = dirname(fileURLToPath(import.meta.url))

const isDev = !app.isPackaged
const startedHidden = process.argv.includes('--hidden')
const LOG_CAP_BYTES = 1_000_000

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false
let whatsapp: WhatsAppService | null = null
let lastConnectionState: WAConnectionState = 'disconnected'
let lastQr: string | null = null
let db: DbInstance | null = null
let ingest: IngestPipeline | null = null
let dbPath: string | null = null
let embeddings: EmbeddingService | null = null
let search: SearchService | null = null
let aiChat: AiChatService | null = null
let contextSvc: ContextService | null = null
let syncStatus: SyncStatusTracker = createSyncStatusTracker()
let messageBatcher: MessageBatcher<RecentMessage> | null = null
let catchupTimer: ReturnType<typeof setTimeout> | null = null
let catchupInserted = 0

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
  process.exit(0)
}

app.on('second-instance', () => {
  showWindow()
})

app.on('before-quit', () => {
  isQuitting = true
  void whatsapp?.stop()
  messageBatcher?.flush()
  db?.close()
})

const resourceOpts = () => ({
  isPackaged: app.isPackaged,
  resourcesPath: process.resourcesPath,
  dirname: __dirname
})

function configureAutostart(): void {
  if (isDev) return
  app.setLoginItemSettings({
    openAtLogin: true,
    openAsHidden: true,
    args: ['--hidden']
  })
}

function buildTrayMenu(status: string): Menu {
  return Menu.buildFromTemplate(
    buildTrayMenuTemplate(status, {
      onOpen: showWindow,
      onQuit: () => {
        isQuitting = true
        app.quit()
      }
    })
  )
}

function createTray(): void {
  const iconName = pickTrayIconName(process.platform)
  const icon = nativeImage.createFromPath(buildResourcePath(resourceOpts(), iconName))
  tray = new Tray(icon)
  tray.setToolTip('BrainTwo')
  tray.setContextMenu(buildTrayMenu('Iniciando…'))
  tray.on('click', () => showWindow())
  tray.on('double-click', () => showWindow())
}

function updateTrayStatus(status: string): void {
  if (!tray) return
  tray.setContextMenu(buildTrayMenu(status))
  tray.setToolTip(`BrainTwo — ${status}`)
}

function broadcast(channel: string, payload: unknown): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.webContents.send(channel, payload)
}

function reportError(code: string, message: string, recoverable = true): void {
  broadcast('app:error', { code, message, recoverable })
}

function publishSyncStatus(): void {
  const status = syncStatus.get()
  broadcast('sync:state-changed', status)
  updateTrayStatus(status.label)
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#060a12',
    icon: nativeImage.createFromPath(buildResourcePath(resourceOpts(), 'icon-256.png')),
    webPreferences: {
      preload: join(__dirname, '../preload/preload.cjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    if (!startedHidden) mainWindow?.show()
  })

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('did-finish-load', () => {
    broadcast('wa:connection-state', lastConnectionState)
    if (lastQr) broadcast('wa:qr', lastQr)
  })

  // Forward renderer console (incl. errors) to the terminal in dev so blank
  // screens have a visible cause. Levels: 0=verbose 1=info 2=warning 3=error.
  if (isDev) {
    mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
      const tag = ['[V]', '[I]', '[W]', '[E]'][level] ?? '[?]'
      // eslint-disable-next-line no-console
      console.log(`[renderer]${tag} ${message}  (${sourceId}:${line})`)
    })
    mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
      // eslint-disable-next-line no-console
      console.error(`[renderer:fail-load] ${code} ${desc} ${url}`)
    })
    mainWindow.webContents.on('render-process-gone', (_e, details) => {
      // eslint-disable-next-line no-console
      console.error(`[renderer:gone] ${JSON.stringify(details)}`)
    })
    mainWindow.webContents.on('preload-error', (_e, preloadPath, error) => {
      // eslint-disable-next-line no-console
      console.error(`[preload:error] ${preloadPath}\n${error.stack ?? error.message}`)
    })
  }

  if (process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    if (isDev) mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function showWindow(): void {
  if (!mainWindow) {
    createWindow()
    return
  }
  if (mainWindow.isMinimized()) mainWindow.restore()
  if (!mainWindow.isVisible()) mainWindow.show()
  mainWindow.focus()
}

function openStorage(): void {
  dbPath = join(app.getPath('userData'), 'braintwo.db')
  db = openDatabase(dbPath)
  const ingestLogger = isDev
    ? pino({ level: 'info', name: 'ingest' })
    : createFileLogger('ingest')
  ingest = createIngestPipeline(db, ingestLogger)
  ingestLogger?.info({ dbPath, count: ingest.count() }, 'storage opened')
  const modelsDir = join(app.getPath('userData'), 'models')
  // Version tag encodes the model AND the embedding prefix convention.
  // Bump this string whenever either changes to trigger a full re-index.
  const EMBEDDING_VERSION = 'multilingual-e5-small:passage:v1'
  const versionFile = join(app.getPath('userData'), 'embedding_version.txt')
  let storedVersion = ''
  try { storedVersion = readFileSync(versionFile, 'utf8').trim() } catch { /* first run */ }
  if (storedVersion !== EMBEDDING_VERSION && db.countEmbeddings() > 0) {
    db.clearEmbeddings()
  }
  writeFileSync(versionFile, EMBEDDING_VERSION)
  embeddings = createEmbeddingService({
    cacheDir: modelsDir,
    onProgress: (progress) => broadcast('search:model-progress', progress)
  })
  search = createSearchService({ db, embeddings })
  aiChat = createAiChatService({
    db,
    search,
    embed: (text) => embeddings!.embed(text, 'passage')
  })
  contextSvc = createContextService({
    db,
    embeddings,
    getAiConfig: () => readAiConfig(app.getPath('userData')),
    onError: (msg) => reportError('context.generation_failed', msg)
  })
  void contextSvc.backfill()
  // Backfill embeddings for any memories stored without one (e.g. from a previous session).
  void (async () => {
    const unembedded = db.listUnembeddedMemories(200)
    for (const m of unembedded) {
      try {
        const vec = await embeddings!.embed(m.content, 'passage')
        db.insertMemoryEmbedding(m.id, vec)
      } catch { /* best-effort */ }
    }
  })()
  void search.backfillMissing(50_000).catch((err: unknown) => {
    reportError('search.backfill_failed', err instanceof Error ? err.message : String(err))
  })
  messageBatcher = createMessageBatcher<RecentMessage>({
    broadcast: (batch) => broadcast('app:messages-batch', batch)
  })
}

function queueEmbedding(rowId: number, text: string): void {
  if (!db || !embeddings || !text.trim()) return
  void embeddings
    .embed(text)
    .then((vec) => db?.insertEmbedding(rowId, vec))
    .catch((err: unknown) => {
      reportError('search.embed_failed', err instanceof Error ? err.message : String(err))
    })
}

function noteCatchupMessage(): void {
  catchupInserted++
  syncStatus.startCatchup()
  publishSyncStatus()
  if (catchupTimer) clearTimeout(catchupTimer)
  catchupTimer = setTimeout(() => {
    const count = catchupInserted
    catchupInserted = 0
    catchupTimer = null
    syncStatus.finishCatchup(count)
    publishSyncStatus()
    if (count > 0 && Notification.isSupported()) {
      new Notification({
        title: 'BrainTwo',
        body: `${count} mensajes nuevos sincronizados`
      }).show()
    }
  }, 900)
}

function startWhatsApp(): void {
  const authPath = join(app.getPath('userData'), 'auth')
  // In dev we surface info-level logs (Baileys handshake, messages.upsert
  // counters, history-set deltas) to the terminal; in prod we stay silent.
  const waLogger = isDev
    ? pino({ level: 'info', name: 'wa' })
    : createFileLogger('wa')
  whatsapp = createWhatsAppService({ authPath, logger: waLogger })

  whatsapp.on('connection-state', (state) => {
    lastConnectionState = state
    if (state === 'open') lastQr = null
    syncStatus.setConnection(state)
    updateTrayStatus(statusLabel(state))
    broadcast('wa:connection-state', state)
    publishSyncStatus()
  })

  whatsapp.on('qr', (qr) => {
    lastQr = qr
    broadcast('wa:qr', qr)
  })

  whatsapp.on('logged-out', () => {
    lastQr = null
    broadcast('wa:logged-out', undefined)
  })

  whatsapp.on('message', ({ raw, source }) => {
    if (!ingest || !messageBatcher) return
    const result = ingest.ingest(raw, source)
    if (!result.inserted || result.rowId === null) return
    const id = raw.key?.id
    if (!id) return
    // Build the renderer-friendly row directly from inputs to avoid an extra
    // SELECT — the values are already validated by ingestMessage.
    messageBatcher.push({
      id: result.rowId,
      wa_msg_id: id,
      timestamp: extractTimestampMs(raw),
      text: extractText(raw),
      source,
      kind: extractKind(raw),
      media: extractMediaMeta(raw),
      fromMe: raw.key?.fromMe === true
    })
    queueEmbedding(result.rowId, extractText(raw))
    contextSvc?.queue(result.rowId, extractKind(raw), extractText(raw), extractMediaMeta(raw))
    if (source === 'offline-sync' || source === 'history-sync') {
      noteCatchupMessage()
    }
  })

  void whatsapp.start()
}

function createFileLogger(name: string): pino.Logger {
  const logDir = join(app.getPath('userData'), 'logs')
  mkdirSync(logDir, { recursive: true })
  const logPath = join(logDir, `${name}.log`)
  try {
    if (statSync(logPath).size > LOG_CAP_BYTES) {
      renameSync(logPath, join(logDir, `${name}.1.log`))
    }
  } catch {
    // No existing log yet.
  }
  return pino({ level: 'info', name }, pino.destination({ dest: logPath, sync: false }))
}

ipcMain.handle('app:open-window', () => {
  showWindow()
})

ipcMain.handle('app:quit', () => {
  isQuitting = true
  app.quit()
})

ipcMain.handle('app:get-version', () => app.getVersion())

ipcMain.handle('app:get-platform', () => process.platform)

ipcMain.handle('app:get-message-count', () => ingest?.count() ?? 0)

ipcMain.handle('app:get-recent-messages', (_e, limit: number) => {
  return ingest?.recent(Math.max(0, Math.min(limit, 500))) ?? []
})

ipcMain.handle('app:get-sync-status', () => syncStatus.get())

ipcMain.handle('settings:get', () => readSettings(app))

ipcMain.handle('settings:set', (_e, patch: Parameters<typeof writeSettings>[1]) => {
  return writeSettings(app, patch)
})

ipcMain.handle('db:stats', () => db?.stats(dbPath ?? undefined) ?? {
  messages: 0,
  embeddings: 0,
  sizeBytes: 0,
  lastIngestAt: null
})

ipcMain.handle('app:open-userdata-folder', async () => {
  await shell.openPath(app.getPath('userData'))
})

ipcMain.handle('search:query', async (_e, text: string, k = 12) => {
  return search?.query(text, k) ?? []
})

ipcMain.handle('ai:get-config', () => readAiConfig(app.getPath('userData')))

ipcMain.handle('ai:set-config', (_e, patch: Partial<AiConfig>) => {
  writeAiConfig(app.getPath('userData'), patch)
})

ipcMain.handle('ai:send', async (_e, messages: ChatMessage[]) => {
  if (!aiChat) throw new Error('Storage not ready')
  const config = readAiConfig(app.getPath('userData'))
  if (!config?.apiKey) throw new Error('IA no configurada. Configurá un proveedor en Settings.')
  const today = new Date().toISOString().split('T')[0]!
  return aiChat.send(config, messages, today)
})

ipcMain.handle('export:import', async () => {
  if (!db) {
    throw new Error('Storage is not ready')
  }
  const selected = await dialog.showOpenDialog({
    title: 'Importar export de WhatsApp',
    properties: ['openFile'],
    filters: [{ name: 'WhatsApp export', extensions: ['txt'] }]
  })
  if (selected.canceled || selected.filePaths.length === 0) {
    return { processed: 0, total: 0, inserted: 0, skipped: 0, done: true } satisfies ImportProgress
  }
  const result = await importExportFile(selected.filePaths[0]!, {
    db,
    onProgress: (progress) => broadcast('sync:progress', progress)
  })
  void search?.backfillMissing(50_000).catch((err: unknown) => {
    reportError('search.backfill_failed', err instanceof Error ? err.message : String(err))
  })
  return result
})

ipcMain.handle('wa:get-connection-state', () => lastConnectionState)

ipcMain.handle('wa:get-current-qr', () => lastQr)

ipcMain.handle('wa:request-qr', async () => {
  if (!whatsapp) return
  await whatsapp.stop()
  await whatsapp.start()
})

ipcMain.handle('wa:logout', async () => {
  await whatsapp?.logout()
})

void app.whenReady().then(() => {
  // CSP is enforced at the network layer in production only; in dev we rely
  // on Vite's normal same-origin loading without a strict policy that would
  // block HMR scripts/styles.
  if (!isDev) {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self'; " +
              "script-src 'self'; " +
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
              "font-src 'self' https://fonts.gstatic.com; " +
              "img-src 'self' data:; " +
              "connect-src 'self' ws: wss:"
          ]
        }
      })
    })
  }

  configureAutostart()
  openStorage()
  createTray()
  startWhatsApp()
  createWindow()
})

app.on('window-all-closed', () => {
  // Intentionally empty: tray keeps the process alive.
})
