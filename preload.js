const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('switchback', {
  chooseFiles: () => ipcRenderer.invoke('choose-files'),
  chooseFolder: () => ipcRenderer.invoke('choose-folder'),
  chooseOutput: () => ipcRenderer.invoke('choose-output'),
  convert: (payload) => ipcRenderer.invoke('convert', payload),
  onProgress: (callback) => ipcRenderer.on('conversion-progress', (_event, value) => callback(value))
});
