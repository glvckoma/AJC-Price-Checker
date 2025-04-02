// Electron preload script
const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'ipcApi', // Name of the API object in the window scope (window.ipcApi)
  {
    // Expose ipcRenderer.invoke safely
    invoke: (channel, ...args) => {
      // Define allowed channels to prevent invoking arbitrary channels
      const allowedChannels = ['search-wiki', 'get-page-details'];
      if (allowedChannels.includes(channel)) {
        return ipcRenderer.invoke(channel, ...args);
      }
      // Optionally throw an error or return a rejected promise for disallowed channels
      console.error(`IPC channel '${channel}' is not allowed.`);
      return Promise.reject(new Error(`IPC channel '${channel}' is not allowed.`));
    }
    // We can expose other specific IPC functions here if needed (e.g., ipcRenderer.on)
  }
);

console.log('Preload script executed, ipcApi exposed.');
