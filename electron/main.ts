import {
  app,
  BrowserWindow,
  Notification,
  Menu,
  Tray,
  nativeImage,
  session,
  shell
} from 'electron'
import pino from 'pino'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { createWhatsAppService } from './services/whatsapp'
import { openDatabase } from './services/db'
import { createEmbeddingService, type EmbeddingService } from './services/embeddings'
import { createSearchService } from './services/search'
import { createSyncStatusTracker } from './services/sync-status'
import { readAiConfig } from './services/ai-config'
import { createAiChatService } from './services/ai-chat'
import { createContextService } from './services/context'
import {
  createIngestPipeline,
  extractKind,
  extractMediaMeta,
  extractText,
  extractTimestampMs,
  type RecentMessage
} from './services/ingest'
import {
  statusLabel,
  buildResourcePath,
  pickTrayIconName,
  buildTrayMenuTemplate,
  createMessageBatcher
} from './main-helpers'
import { registerAllHandlers } from './ipc/register'
import type { AppContext } from './app-context'

const __dirname = dirname(fileURLToPath(import.meta.url))

const isDev = !app.isPackaged
const startedHidden = process.argv.includes('--hidden')
const LOG_CAP_BYTES = 1_000_000

let embeddings: EmbeddingService | null = null
let catchupTimer: ReturnType<typeof setTimeout> | null = null
let catchupInserted = 0

const context: AppContext = {
  app,
  mainWindow: { value: null },
  tray: { value: null },
  whatsapp: { value: null },
  db: { value: null },
  ingest: { value: null },
  search: { value: null },
  aiChat: { value: null },
  contextSvc: { value: null },
  syncStatus: createSyncStatusTracker(),
  messageBatcher: { value: null },
  dbPath: { value: null },
  isQuitting: { value: false },
  lastConnectionState: { value: 'disconnected' },
  lastQr: { value: null },
  showWindow,
  broadcast,
  reportError
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
  process.exit(0)
}

app.on('second-instance', () => {
  showWindow()
})

app.on('before-quit', () => {
  context.isQuitting.value = true
  void context.whatsapp.value?.stop()
  context.messageBatcher.value?.flush()
  context.db.value?.close()
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
        context.isQuitting.value = true
        app.quit()
      }
    })
  )
}

function createTray(): void {
  const iconName = pickTrayIconName(process.platform)
  const icon = nativeImage.createFromPath(buildResourcePath(resourceOpts(), iconName))
  context.tray.value = new Tray(icon)
  context.tray.value.setToolTip('BrainTwo')
  context.tray.value.setContextMenu(buildTrayMenu('Iniciando…'))
  context.tray.value.on('click', () => showWindow())
  context.tray.value.on('double-click', () => showWindow())
}

function updateTrayStatus(status: string): void {
  if (!context.tray.value) return
  context.tray.value.setContextMenu(buildTrayMenu(status))
  context.tray.value.setToolTip(`BrainTwo — ${status}`)
}

function broadcast(channel: string, payload: unknown): void {
  if (!context.mainWindow.value || context.mainWindow.value.isDestroyed()) return
  context.mainWindow.value.webContents.send(channel, payload)
}

function reportError(code: string, message: string, recoverable = true): void {
  broadcast('app:error', { code, message, recoverable })
}

function publishSyncStatus(): void {
  const status = context.syncStatus.get()
  broadcast('sync:state-changed', status)
  updateTrayStatus(status.label)
}

function createWindow(): void {
  context.mainWindow.value = new BrowserWindow({
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

  context.mainWindow.value.on('ready-to-show', () => {
    if (!startedHidden) context.mainWindow.value?.show()
  })

  context.mainWindow.value.on('close', (event) => {
    if (!context.isQuitting.value) {
      event.preventDefault()
      context.mainWindow.value?.hide()
    }
  })

  context.mainWindow.value.on('closed', () => {
    context.mainWindow.value = null
  })

  context.mainWindow.value.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url)
    return { action: 'deny' }
  })

  context.mainWindow.value.webContents.on('did-finish-load', () => {
    broadcast('wa:connection-state', context.lastConnectionState.value)
    if (context.lastQr.value) broadcast('wa:qr', context.lastQr.value)
  })

  if (isDev) {
    context.mainWindow.value.webContents.on('console-message', (_event, level, message, line, sourceId) => {
      const tag = ['[V]', '[I]', '[W]', '[E]'][level] ?? '[?]'
      // eslint-disable-next-line no-console
      console.log(`[renderer]${tag} ${message}  (${sourceId}:${line})`)
    })
    context.mainWindow.value.webContents.on('did-fail-load', (_e, code, desc, url) => {
      // eslint-disable-next-line no-console
      console.error(`[renderer:fail-load] ${code} ${desc} ${url}`)
    })
    context.mainWindow.value.webContents.on('render-process-gone', (_e, details) => {
      // eslint-disable-next-line no-console
      console.error(`[renderer:gone] ${JSON.stringify(details)}`)
    })
    context.mainWindow.value.webContents.on('preload-error', (_e, preloadPath, error) => {
      // eslint-disable-next-line no-console
      console.error(`[preload:error] ${preloadPath}\n${error.stack ?? error.message}`)
    })
  }

  if (process.env['ELECTRON_RENDERER_URL']) {
    void context.mainWindow.value.loadURL(process.env['ELECTRON_RENDERER_URL'])
    // if (isDev) context.mainWindow.value.webContents.openDevTools({ mode: 'detach' })
  } else {
    void context.mainWindow.value.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function showWindow(): void {
  if (!context.mainWindow.value) {
    createWindow()
    return
  }
  if (context.mainWindow.value.isMinimized()) context.mainWindow.value.restore()
  if (!context.mainWindow.value.isVisible()) context.mainWindow.value.show()
  context.mainWindow.value.focus()
}

function openStorage(): void {
  context.dbPath.value = join(app.getPath('userData'), 'braintwo.db')
  context.db.value = openDatabase(context.dbPath.value)
  const ingestLogger = isDev
    ? pino({ level: 'info', name: 'ingest' })
    : createFileLogger('ingest')
  context.ingest.value = createIngestPipeline(context.db.value, ingestLogger)
  ingestLogger?.info({ dbPath: context.dbPath.value, count: context.ingest.value.count() }, 'storage opened')
  const modelsDir = join(app.getPath('userData'), 'models')
  const EMBEDDING_VERSION = 'multilingual-e5-base:passage:v4'
  const versionFile = join(app.getPath('userData'), 'embedding_version.txt')
  let storedVersion = ''
  try { storedVersion = readFileSync(versionFile, 'utf8').trim() } catch { /* first run */ }
  if (storedVersion !== EMBEDDING_VERSION) {
    if (context.db.value.countEmbeddings() > 0) {
      context.db.value.clearEmbeddings()
    }
    try {
      context.db.value.raw.exec('UPDATE messages SET context_note = NULL')
    } catch { /* ignore */ }
  }
  writeFileSync(versionFile, EMBEDDING_VERSION)
  embeddings = createEmbeddingService({
    cacheDir: modelsDir,
    onProgress: (progress) => broadcast('search:model-progress', progress)
  })
  context.search.value = createSearchService({ db: context.db.value, embeddings })
  context.aiChat.value = createAiChatService({
    db: context.db.value,
    search: context.search.value,
    embed: (text) => embeddings!.embed(text, 'passage')
  })
  context.contextSvc.value = createContextService({
    db: context.db.value,
    embeddings,
    getAiConfig: () => readAiConfig(app.getPath('userData')),
    onError: (msg) => reportError('context.generation_failed', msg)
  })
  void context.contextSvc.value.backfill()
  void (async () => {
    const unembedded = context.db.value!.listUnembeddedMemories(200)
    for (const m of unembedded) {
      try {
        const vec = await embeddings!.embed(m.content, 'passage')
        context.db.value!.insertMemoryEmbedding(m.id, vec)
      } catch { /* best-effort */ }
    }
  })()
  void context.search.value.backfillMissing(50_000).catch((err: unknown) => {
    reportError('search.backfill_failed', err instanceof Error ? err.message : String(err))
  })
  context.messageBatcher.value = createMessageBatcher<RecentMessage>({
    broadcast: (batch) => broadcast('app:messages-batch', batch)
  })
}

function queueEmbedding(rowId: number, text: string): void {
  if (!context.db.value || !embeddings || !text.trim()) return
  void embeddings
    .embed(text)
    .then((vec) => context.db.value?.insertEmbedding(rowId, vec))
    .catch((err: unknown) => {
      reportError('search.embed_failed', err instanceof Error ? err.message : String(err))
    })
}

function noteCatchupMessage(): void {
  catchupInserted++
  context.syncStatus.startCatchup()
  publishSyncStatus()
  if (catchupTimer) clearTimeout(catchupTimer)
  catchupTimer = setTimeout(() => {
    const count = catchupInserted
    catchupInserted = 0
    catchupTimer = null
    context.syncStatus.finishCatchup(count)
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
  const waLogger = isDev
    ? pino({ level: 'info', name: 'wa' })
    : createFileLogger('wa')
  context.whatsapp.value = createWhatsAppService({ authPath, logger: waLogger })

  context.whatsapp.value.on('connection-state', (state) => {
    context.lastConnectionState.value = state
    if (state === 'open') context.lastQr.value = null
    context.syncStatus.setConnection(state)
    updateTrayStatus(statusLabel(state))
    broadcast('wa:connection-state', state)
    publishSyncStatus()
  })

  context.whatsapp.value.on('qr', (qr) => {
    context.lastQr.value = qr
    broadcast('wa:qr', qr)
  })

  context.whatsapp.value.on('logged-out', () => {
    context.lastQr.value = null
    broadcast('wa:logged-out', undefined)
  })

  context.whatsapp.value.on('message', ({ raw, source }) => {
    if (!context.ingest.value || !context.messageBatcher.value) return
    const result = context.ingest.value.ingest(raw, source)
    if (!result.inserted || result.rowId === null) return
    const id = raw.key?.id
    if (!id) return
    context.messageBatcher.value.push({
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
    context.contextSvc.value?.queue(result.rowId, extractKind(raw), extractText(raw), extractMediaMeta(raw), extractTimestampMs(raw))
    if (source === 'offline-sync' || source === 'history-sync') {
      noteCatchupMessage()
    }
  })

  void context.whatsapp.value.start()
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

void app.whenReady().then(() => {
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
  registerAllHandlers(context)
  createTray()
  startWhatsApp()
  createWindow()
})

app.on('window-all-closed', () => {
  // Intentionally empty: tray keeps the process alive.
})
