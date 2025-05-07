const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'electronAPI', {
    selectFolder: () => ipcRenderer.invoke('select-folder'),
    saveImage: (data) => ipcRenderer.invoke('save-image', data),
    saveMetadata: (data) => ipcRenderer.invoke('save-metadata', data),
    getLocation: () => ipcRenderer.invoke('get-location')
  }
);
