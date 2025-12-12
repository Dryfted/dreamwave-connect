/**
 * Preload script - Secure bridge between renderer and main process
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('dreamwave', {
  // Get CLI and auth status
  getStatus: () => ipcRenderer.invoke('get-status'),

  // Install CLI
  installCLI: (provider) => ipcRenderer.invoke('install-cli', provider),

  // Start OAuth flow
  startOAuth: (provider) => ipcRenderer.invoke('start-oauth', provider),

  // Sync credentials to DreamWave
  syncCredentials: (userId, provider) => ipcRenderer.invoke('sync-credentials', { userId, provider }),

  // Read local credentials
  readCredentials: (provider) => ipcRenderer.invoke('read-credentials', provider),

  // Window controls
  minimize: () => ipcRenderer.invoke('minimize-window'),
  close: () => ipcRenderer.invoke('close-window'),

  // Open external URL
  openExternal: (url) => ipcRenderer.invoke('open-external', url),

  // OAuth progress listener
  onOAuthProgress: (callback) => {
    ipcRenderer.on('oauth-progress', (event, data) => callback(data));
  }
});
