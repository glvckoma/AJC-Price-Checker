// src/services/updater.js
const { app, dialog, shell } = require('electron');
const axios = require('axios');
const semver = require('semver');

// Constants
const GITHUB_OWNER = 'glvckoma';
const GITHUB_REPO = 'AJC-Price-Checker';
const GITHUB_RELEASES_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases`;
const GITHUB_API_LATEST_RELEASE_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;

/**
 * Checks GitHub for the latest release and notifies the renderer if an update is available.
 * Optionally shows a dialog to the user.
 * @param {function|null} notifyRendererCallback - A function to call with the latest version string if an update is found.
 */
async function checkForUpdates(notifyRendererCallback = null) {
  console.log('Checking for updates...');
  try {
    const currentVersion = app.getVersion();
    console.log(`Current version: ${currentVersion}`);

    const response = await axios.get(GITHUB_API_LATEST_RELEASE_URL, {
      headers: { 'Accept': 'application/vnd.github.v3+json' },
      timeout: 15000 // Shorter timeout for update check
    });

    if (response.status === 200 && response.data && response.data.tag_name) {
      const latestVersionTag = response.data.tag_name;
      // Strip 'v' prefix if present for semver comparison
      const latestVersion = latestVersionTag.startsWith('v') ? latestVersionTag.substring(1) : latestVersionTag;
      console.log(`Latest version tag: ${latestVersionTag}, Parsed: ${latestVersion}`);

      if (semver.valid(latestVersion) && semver.gt(latestVersion, currentVersion)) {
        console.log(`New version available: ${latestVersion}`);

        // Notify the renderer process via callback if provided
        if (notifyRendererCallback && typeof notifyRendererCallback === 'function') {
          notifyRendererCallback(latestVersion);
        }

        // Show the dialog to the user
        await showUpdateDialog(latestVersion, currentVersion);

      } else {
        console.log('Current version is up-to-date or latest version is invalid/not newer.');
      }
    } else {
      console.log('Could not retrieve latest release information or tag_name missing.');
    }
  } catch (error) {
    console.error('Error checking for updates:', error.message);
    // Don't bother the user with an error dialog for update checks
  }
}

/**
 * Shows the update available dialog to the user.
 * @param {string} latestVersion
 * @param {string} currentVersion
 */
async function showUpdateDialog(latestVersion, currentVersion) {
  // Ensure dialog is only shown if the app is focused, prevent potential issues during startup/shutdown
  // This requires access to the main window, might need adjustment if called before window is ready
  // For simplicity now, we assume it's called when appropriate.
  const { response: buttonIndex } = await dialog.showMessageBox({
    type: 'info',
    title: 'Update Available',
    message: `A new version (${latestVersion}) is available. You have ${currentVersion}.`,
    buttons: ['OK', 'Download'],
    defaultId: 1, // Default to 'Download'
    cancelId: 0 // 'OK' is cancel
  });

  if (buttonIndex === 1) { // User clicked 'Download'
    console.log('User clicked Download, opening releases page...');
    await triggerDownload();
  }
}

/**
 * Opens the GitHub releases page in the default browser.
 */
async function triggerDownload() {
  console.log(`Opening external URL: ${GITHUB_RELEASES_URL}`);
  return shell.openExternal(GITHUB_RELEASES_URL);
}

module.exports = {
  checkForUpdates,
  triggerDownload
};
