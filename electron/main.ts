import {
  app,
  BrowserWindow,
  Menu,
  Tray,
  ipcMain,
  nativeImage,
  session,
  shell
} from 'electron'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createWhatsAppService, type WhatsAppService } from './services/whatsapp'
import type { WAConnectionState } from './services/whatsapp-state'
import { openDatabase, type DbInstance } from './services/db'
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

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false
let whatsapp: WhatsAppService | null = null
let lastConnectionState: WAConnectionState = 'disconnected'
let lastQr: string | null = null
let db: DbInstance | null = null
let ingest: IngestPipeline | null = null
let messageBatcher: MessageBatcher<RecentMessage> | null = null

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
  const dbPath = join(app.getPath('userData'), 'braintwo.db')
  db = openDatabase(dbPath)
  ingest = createIngestPipeline(db)
  messageBatcher = createMessageBatcher<RecentMessage>({
    broadcast: (batch) => broadcast('app:messages-batch', batch)
  })
}

function startWhatsApp(): void {
  const authPath = join(app.getPath('userData'), 'auth')
  whatsapp = createWhatsAppService({ authPath })

  whatsapp.on('connection-state', (state) => {
    lastConnectionState = state
    if (state === 'open') lastQr = null
    updateTrayStatus(statusLabel(state))
    broadcast('wa:connection-state', state)
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
  })

  void whatsapp.start()
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
