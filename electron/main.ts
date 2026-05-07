import {
  app,
  BrowserWindow,
  Menu,
  Tray,
  ipcMain,
  nativeImage,
  shell
} from 'electron'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createWhatsAppService, type WhatsAppService } from './services/whatsapp'
import type { WAConnectionState } from './services/whatsapp-state'
import {
  statusLabel,
  buildResourcePath,
  pickTrayIconName,
  buildTrayMenuTemplate
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
      preload: join(__dirname, '../preload/preload.mjs'),
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

  if (process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
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
  configureAutostart()
  createTray()
  startWhatsApp()
  createWindow()
})

app.on('window-all-closed', () => {
  // Intentionally empty: tray keeps the process alive.
})
