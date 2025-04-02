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
    },
    // Expose a function to safely trigger the update download
    triggerUpdateDownload: () => {
        ipcRenderer.send('trigger-update-download');
    },
    // Expose a function to listen for status updates from the main process
    onUpdateStatus: (callback) => {
        // Define allowed channel
        const channel = 'update-status';
        // Use ipcRenderer.on for listening to messages sent from main
        // Make sure to remove the listener when it's no longer needed to prevent memory leaks
        // (though in this simple case, it might live for the lifetime of the window)
        const listener = (event, ...args) => callback(event, ...args);
        ipcRenderer.on(channel, listener);

        // Return a function to remove the listener
        return () => {
            ipcRenderer.removeListener(channel, listener);
        };
    }
  }
);

console.log('Preload script executed, ipcApi exposed with invoke, openExternalLink, triggerUpdateDownload, and onUpdateStatus.');
