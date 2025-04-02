# Technical Context: AJ Item Price Checker

## Original Technology Stack (Pre-Refactor)

*   **Language:** Python 3
*   **GUI Library:** PyQt5
*   **Web Scraping:** `requests` (HTTP), `BeautifulSoup4` (HTML Parsing)
*   **Packaging:** `PyInstaller` (for Windows .exe)
*   **Concurrency:** `QThread` (within PyQt5 for non-blocking network requests)

## Planned Technology Stack (Updated 2025-04-02)

The application is being refactored into a single, integrated Electron application.

### Core Application

*   **Framework:** Electron
*   **Runtime:** Node.js
*   **Languages:** HTML, CSS, JavaScript
*   **UI Structure:** Standard Electron setup (`src/main.js`, `src/preload.js`, `src/renderer/index.html`, `src/renderer/renderer.js`).
*   **Main Process Structure (Modular):**
    *   `src/main.js`: Entry point, orchestrates modules.
    *   `src/app/window.js`: Manages the `BrowserWindow`.
    *   `src/services/scraper.js`: Handles wiki interaction (`axios`, `cheerio`).
    *   `src/services/updater.js`: Handles update checks (`axios`, `semver`, `dialog`, `shell`).
    *   `src/ipc/handlers.js`: Configures `ipcMain` listeners.
*   **Renderer Process (`src/renderer/renderer.js`):** Manages UI updates, handles user input, and implements dynamic status bar styling based on application state.
*   **Styling:** Tailwind CSS (using PostCSS, manual CSS generation workaround due to build issues). Dark mode enabled by default. Dynamic status bar colors applied via JavaScript using predefined Tailwind classes. Manual CSS added for status bar transitions.
*   **Backend Logic (Integrated):** Encapsulated within main process service modules (`scraper.js`, `updater.js`).
*   **Communication (Internal):** Electron's Inter-Process Communication (IPC - `ipcMain`, `ipcRenderer`, `contextBridge`) used between renderer and main process modules via `ipc/handlers.js`. Includes channels for search, details, external links, and update status notifications/triggers.
*   **Packaging:** `electron-builder` configured to produce a portable Windows `.exe`.

## Key Dependencies (Node.js)

*   `electron`
*   `electron-builder`
*   `axios`
*   `cheerio`
*   `semver` (for update version comparison)
*   `tailwindcss`, `@tailwindcss/postcss`, `postcss`, `postcss-cli`, `autoprefixer` (dev dependencies for styling)

## Development Environment

*   **OS:** Windows 11 (primary target)
*   **Editor:** VS Code
*   **Version Control:** Git, connected to `https://github.com/glvckoma/AJC-Price-Checker`.

## Constraints & Considerations

*   The application relies heavily on the structure of the target wiki (`aj-item-worth.fandom.com`). Changes to the wiki will likely break the Node.js scraping logic.
*   **Update Check:** The update notification feature relies on the GitHub API (`/repos/:owner/:repo/releases/latest`) and the presence of tagged releases in the repository. Network errors during the check are handled silently.
*   Robust error handling is needed for network requests (wiki scraping, GitHub API) and HTML parsing within the Node.js code.
*   Asynchronous operations (fetching, parsing, update check) must be handled correctly in the main process to avoid blocking the application.
*   The manual CSS generation process is a workaround; resolving the underlying build tool execution issue would be ideal for easier maintenance.
