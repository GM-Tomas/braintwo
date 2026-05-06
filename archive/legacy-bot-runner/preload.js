// preload.js

const {
  contextBridge,
  ipcRenderer
} = require('electron');

const createEvent = eventName => (callback) => {
  ipcRenderer.on(eventName, callback);
  return () => ipcRenderer.off(eventName, callback);
};


// Exponer métodos para enviar y recibir mensajes IPC al proceso de renderizado

contextBridge.exposeInMainWorld('ipc', {

  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getBots: () => ipcRenderer.invoke('askForBots'),
  deleteBot: (botName) => ipcRenderer.invoke('deleteBot', botName),

  send: (channel, data) => {
    ipcRenderer.send(channel, data);
  },

  receiveBots: createEvent('receiveBots'),
  downloadStatus: createEvent('downloadStatus'),

});