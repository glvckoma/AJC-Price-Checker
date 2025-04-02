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
*   **UI Structure:** Standard Electron setup (`main.js`, `preload.js`, `renderer/index.html`, `renderer/renderer.js`).
*   **Styling:** Tailwind CSS (using PostCSS, manual CSS generation workaround due to build issues). Dark mode enabled by default.
*   **Backend Logic (Integrated):**
    *   Web scraping logic rewritten in Node.js within the Electron main process (`main.js` or separate modules).
    *   Uses libraries like `axios` (for HTTP requests) and `cheerio` (for HTML parsing).
*   **Communication (Internal):** Electron's Inter-Process Communication (IPC - `ipcMain`, `ipcRenderer`) used to send requests from the renderer (UI) to the main process (backend logic) and return results.
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
