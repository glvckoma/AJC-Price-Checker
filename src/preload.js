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
    },
    // Expose a function to safely open external links
    openExternalLink: (url) => {
      // Basic validation for URL format (optional but recommended)
      if (typeof url === 'string' && (url.startsWith('http:') || url.startsWith('https:'))) {
        ipcRenderer.send('open-external-link', url); // Use send for one-way trigger
      } else {
        console.error(`Invalid URL attempted to open: ${url}`);
      }
    }
  }
);

console.log('Preload script executed, ipcApi exposed.');
