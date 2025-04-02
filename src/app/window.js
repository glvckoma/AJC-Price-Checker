// src/app/window.js
const { BrowserWindow } = require('electron');
const path = require('path');

let mainWindowInstance = null; // Keep track of the window instance

function createMainWindow() {
  // If window already exists, focus it
  if (mainWindowInstance && !mainWindowInstance.isDestroyed()) {
    mainWindowInstance.focus();
    return mainWindowInstance;
  }

  // Create the browser window.
  mainWindowInstance = new BrowserWindow({
    width: 800,
    height: 600,
    icon: path.join(__dirname, '../../assets/icon.ico'), // Adjusted path relative to this file
    webPreferences: {
      preload: path.join(__dirname, '../preload.js'), // Adjusted path relative to this file
      // contextIsolation: true, // Recommended default
      // nodeIntegration: false, // Recommended default
    }
  });

  // Load the index.html of the app.
  mainWindowInstance.loadFile(path.join(__dirname, '../renderer/index.html')); // Adjusted path

  // Clear the instance when the window is closed
  mainWindowInstance.on('closed', () => {
    mainWindowInstance = null;
  });

  // Open the DevTools automatically if needed (useful for debugging)
  // mainWindowInstance.webContents.openDevTools();

  return mainWindowInstance;
}

function getMainWindow() {
    return mainWindowInstance;
}

module.exports = {
  createMainWindow,
  getMainWindow
};
