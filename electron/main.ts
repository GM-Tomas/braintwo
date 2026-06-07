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
import { initLogger, logInfo, logError, getCentralLogger } from './services/logger'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createWhatsAppService } from './services/whatsapp'
import { openDatabase, type DbInstance } from './services/db'
import { createEmbeddingService, type EmbeddingService } from './services/embeddings'
import { createSearchService, type SearchService } from './services/search'
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
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#070c14',
      symbolColor: '#7a90b8',
      height: 36
    },
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

function checkAndClearFallbackEmbeddings(db: DbInstance, search: SearchService): void {
  try {
    const sample = db.raw.prepare('SELECT embedding FROM message_embeddings LIMIT 1').get() as { embedding: Buffer } | undefined
    if (sample && sample.embedding) {
      const floatArr = new Float32Array(
        sample.embedding.buffer,
        sample.embedding.byteOffset,
        sample.embedding.byteLength / Float32Array.BYTES_PER_ELEMENT
      )
      let nonZero = 0
      for (let i = 0; i < floatArr.length; i++) {
        if (floatArr[i] !== 0) nonZero++
      }
      if (nonZero < 500) {
        db.clearEmbeddings()
        void search.backfillMissing(50_000).catch((err) => {
          logError('main:fallback_backfill', err, 'Failed during fallback check backfill')
        })
      }
    }
  } catch (err) {
    logError('main:checkAndClearFallbackEmbeddings', err, 'Ignore database errors during fallback check')
  }
}

function openStorage(): void {
  initLogger(app.getPath('userData'))
  logInfo('main:storage', 'Opening storage')
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
  try {
    storedVersion = readFileSync(versionFile, 'utf8').trim()
  } catch (err) {
    logInfo('main:storage', 'Embedding version file read failed or first run')
  }
  if (storedVersion !== EMBEDDING_VERSION) {
    if (context.db.value.countEmbeddings() > 0) {
      context.db.value.clearEmbeddings()
    }
    try {
      context.db.value.raw.exec('UPDATE messages SET context_note = NULL')
    } catch (err) {
      logError('main:storage', err, 'Failed to update context_note on DB')
    }
  }
  writeFileSync(versionFile, EMBEDDING_VERSION)
  embeddings = createEmbeddingService({
    cacheDir: modelsDir,
    onProgress: (progress) => {
      broadcast('search:model-progress', progress)
      if (progress.status === 'ready' && context.db.value && context.search.value) {
        checkAndClearFallbackEmbeddings(context.db.value, context.search.value)
      }
    }
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
    onError: (msg) => {
      logError('main:contextSvc', msg)
      reportError('context.generation_failed', msg)
    }
  })
  void context.contextSvc.value.backfill()
  void (async () => {
    const unembedded = context.db.value!.listUnembeddedMemories(200)
    for (const m of unembedded) {
      try {
        const vec = await embeddings!.embed(m.content, 'passage')
        context.db.value!.insertMemoryEmbedding(m.id, vec)
      } catch (err) {
        logError('main:storage', err, 'Best-effort startup memory embedding failed')
      }
    }
  })()

  // If local model is already downloaded, check and heal on startup
  const modelPath = join(modelsDir, 'Xenova', 'multilingual-e5-base', 'onnx', 'model_quantized.onnx')
  if (existsSync(modelPath)) {
    checkAndClearFallbackEmbeddings(context.db.value, context.search.value)
  }

  // Warm up embedding service / trigger background download on startup
  void embeddings.embed('warmup', 'query').catch((err) => {
    logError('main:storage', err, 'Warmup embedding failed (ignored)')
  })

  void context.search.value.backfillMissing(50_000).catch((err: unknown) => {
    logError('main:storage', err, 'Backfill missing failed')
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
      logError('main:queueEmbedding', err, 'Embed failed during queueEmbedding')
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
  return getCentralLogger().child({ name })
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

process.on('uncaughtException', (error) => {
  logError('main:uncaughtException', error, 'Uncaught Exception in main process')
})

process.on('unhandledRejection', (reason) => {
  logError('main:unhandledRejection', reason, 'Unhandled Rejection in main process')
})
