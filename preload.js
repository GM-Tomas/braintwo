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

  send: (channel, data) => {
    ipcRenderer.send(channel, data);
  },

  receiveBots: createEvent('receiveBots'),

  downloadStatus: createEvent('downloadStatus'),

  hasPython: createEvent('hasPython'),

  botListError: createEvent('botListError'),

});