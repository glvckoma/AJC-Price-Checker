// src/ipc/handlers.js
const { ipcMain, shell } = require('electron');
const scraper = require('../services/scraper'); // Adjust path as needed
const updater = require('../services/updater'); // Adjust path as needed
const windowManager = require('../app/window'); // To get main window instance

/**
 * Sets up all IPC handlers for the main process.
 * @returns {object} - An object containing functions that might be needed by other parts of the main process (e.g., for sending notifications).
 */
function setupIpcHandlers() {
  console.log("Setting up IPC handlers...");

  // --- Request/Response Handlers (using ipcMain.handle) ---

  ipcMain.handle('search-wiki', async (event, searchTerm) => {
    console.log(`IPC: Received search request for: ${searchTerm}`);
    try {
      // Delegate the actual work to the scraper service
      const results = await scraper.searchForItems(searchTerm);
      return results;
    } catch (error) {
      console.error(`IPC Error during search for "${searchTerm}":`, error);
      // Rethrow the error so the renderer's catch block handles it
      throw new Error(error.message || "Failed to search wiki.");
    }
  });

  ipcMain.handle('get-page-details', async (event, pageUrl) => {
    console.log(`IPC: Received details request for: ${pageUrl}`);
    try {
      // Delegate the actual work to the scraper service
      const details = await scraper.getItemDetails(pageUrl);
      return details; // Includes { sections: [], source_url: ... }
    } catch (error) {
      console.error(`IPC Error getting details for "${pageUrl}":`, error);
      // Rethrow the error so the renderer's catch block handles it
      // Alternatively, return a structured error object if preferred
      throw new Error(error.message || `Failed to get details for ${pageUrl}.`);
      /* Example structured error return:
      return {
          error: true,
          message: error.message || `Failed to get details for ${pageUrl}.`,
          sections: [{ type: "text", title: "Error", content: `Failed to get details: ${error.message}` }],
          source_url: pageUrl
      };
      */
    }
  });

  // --- One-Way Event Listeners (using ipcMain.on) ---

  ipcMain.on('open-external-link', (event, url) => {
    console.log(`IPC: Received request to open external link: ${url}`);
    // Basic validation again for safety on main process side
    if (typeof url === 'string' && (url.startsWith('http:') || url.startsWith('https:'))) {
      shell.openExternal(url); // Use Electron's shell module
    } else {
       console.error(`Attempted to open invalid external URL from main process: ${url}`);
    }
  });

  ipcMain.on('trigger-update-download', () => {
    console.log('IPC: Received trigger-update-download request.');
    // Delegate to the updater service
    updater.triggerDownload();
  });

  // --- Function to be called by other main process modules (e.g., updater) ---

  /**
   * Sends a status update message to the renderer process, specifically for update availability.
   * @param {string} latestVersion - The latest version string.
   */
  function notifyRendererUpdateAvailable(latestVersion) {
    const mainWindow = windowManager.getMainWindow(); // Get current window instance
    if (mainWindow && !mainWindow.isDestroyed()) {
        console.log(`IPC: Notifying renderer about available update ${latestVersion}`);
        mainWindow.webContents.send('update-status', {
            statusType: 'update_available',
            message: `Update ${latestVersion} available! Click here to download.`
        });
    } else {
        console.warn("IPC: Cannot notify renderer, main window not available.");
    }
  }

  // Return any functions needed by the main orchestrator (main.js)
  return {
    notifyRendererUpdateAvailable
  };
}

module.exports = {
  setupIpcHandlers
};
