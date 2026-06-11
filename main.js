const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 620,
    minWidth: 700,
    minHeight: 500,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  mainWindow.loadFile('renderer/onboarding.html')
}

app.whenReady().then(async () => {
  const { initDB } = require('./src/db')
  await initDB()

  createWindow()

  const { startWhatsApp } = require('./src/whatsapp')
  startWhatsApp({
    onQR: (qr) => mainWindow.webContents.send('qr-received', qr),
    onReady: () => mainWindow.loadFile('renderer/notes.html'),
    onMessage: () => {
      if (!mainWindow.webContents.getURL().includes('onboarding')) {
        mainWindow.webContents.send('notes-updated')
      }
    },
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

ipcMain.handle('get-notes', () => require('./src/db').getNotes())
ipcMain.handle('get-note', (_, id) => require('./src/db').getNote(id))
ipcMain.handle('search', async (_, query) => require('./src/ai').searchNotes(query))
ipcMain.handle('get-config', () => require('./src/db').getConfig())
ipcMain.handle('save-config', (_, config) => require('./src/db').saveConfig(config))
ipcMain.handle('navigate', (_, page) => mainWindow.loadFile(`renderer/${page}.html`))
