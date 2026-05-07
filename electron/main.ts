import {
  app,
  BrowserWindow,
  Menu,
  Tray,
  ipcMain,
  nativeImage,
  shell
} from 'electron'
import { join } from 'node:path'

const isDev = !app.isPackaged
const startedHidden = process.argv.includes('--hidden')

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false

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
})

function buildResourcePath(...segments: string[]): string {
  if (app.isPackaged) return join(process.resourcesPath, 'build', ...segments)
  return join(__dirname, '..', '..', 'build', ...segments)
}

function configureAutostart(): void {
  if (isDev) return
  app.setLoginItemSettings({
    openAtLogin: true,
    openAsHidden: true,
    args: ['--hidden']
  })
}

function buildTrayMenu(status: string): Menu {
  return Menu.buildFromTemplate([
    { label: 'Abrir BrainTwo', click: () => showWindow() },
    { label: `Estado: ${status}`, enabled: false },
    { type: 'separator' },
    {
      label: 'Salir',
      click: () => {
        isQuitting = true
        app.quit()
      }
    }
  ])
}

function createTray(): void {
  const iconName = process.platform === 'darwin' ? 'tray-icon.png' : 'tray-icon@2x.png'
  const icon = nativeImage.createFromPath(buildResourcePath(iconName))
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

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#060a12',
    icon: nativeImage.createFromPath(buildResourcePath('icon-256.png')),
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
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

ipcMain.handle('app:open-window', () => {
  showWindow()
})

ipcMain.handle('app:quit', () => {
  isQuitting = true
  app.quit()
})

ipcMain.handle('app:get-version', () => app.getVersion())

ipcMain.handle('app:get-platform', () => process.platform)

void app.whenReady().then(() => {
  configureAutostart()
  createTray()
  createWindow()
  updateTrayStatus('Listo')
})

// Keep the app alive in tray on Windows/Linux. Default behavior would be to
// quit when the last window closes; attaching this handler suppresses that.
app.on('window-all-closed', () => {
  // Intentionally empty: tray keeps the process alive.
})
