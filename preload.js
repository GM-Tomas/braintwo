const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // Notas
  getNotes:    ()      => ipcRenderer.invoke('get-notes'),
  getNote:     (id)    => ipcRenderer.invoke('get-note', id),
  search:      (query) => ipcRenderer.invoke('search', query),

  // Configuración
  getConfig:   ()       => ipcRenderer.invoke('get-config'),
  saveConfig:  (config) => ipcRenderer.invoke('save-config', config),

  // Navegación
  navigate:    (page)  => ipcRenderer.invoke('navigate', page),

  // Eventos del proceso principal → renderer
  onQR:           (cb) => ipcRenderer.on('qr-received',   (_, qr) => cb(qr)),
  onWhatsAppReady:(cb) => ipcRenderer.on('whatsapp-ready', cb),
  onNotesUpdated: (cb) => ipcRenderer.on('notes-updated',  cb),
})
