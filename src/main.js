// src/main.js - Main Application Entry Point
const { app } = require('electron');
const windowManager = require('./app/window'); // Manages the application window
const ipcManager = require('./ipc/handlers');    // Manages IPC communication setup
const updater = require('./services/updater'); // Manages application updates

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
// This is now managed within windowManager, but we might need the reference here.
let mainWindow = null;

/**
 * Initializes the application, creates the main window, sets up IPC, and checks for updates.
 */
async function initializeApp() {
  console.log('Application initializing...');

  // Create the main application window
  mainWindow = windowManager.createMainWindow();
  if (!mainWindow) {
      console.error("Failed to create main window. Exiting.");
      app.quit();
      return;
  }

  // Set up all IPC event handlers. Pass the mainWindow instance if needed by handlers.
  // The setup function returns an object containing any necessary callback functions.
  const ipcCallbacks = ipcManager.setupIpcHandlers();

  // Check for application updates after the window is ready and IPC is set up.
  // Pass the specific callback function from ipcCallbacks to notify the renderer.
  await updater.checkForUpdates(ipcCallbacks.notifyRendererUpdateAvailable);

  // Handle macOS activation behavior
  app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (windowManager.getMainWindow() === null) {
      mainWindow = windowManager.createMainWindow();
    } else {
        // If window exists but might be hidden/minimized, focus it
        const existingWindow = windowManager.getMainWindow();
        if (existingWindow) existingWindow.focus();
    }
  });

  console.log('Application initialization complete.');
}

// --- Electron App Lifecycle Events ---

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(initializeApp);

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Optional: Handle app exit cleanly
app.on('will-quit', () => {
    console.log("Application is quitting.");
    // Perform any cleanup if necessary
});
