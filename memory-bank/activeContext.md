# Active Context: AJ Item Price Checker - Backend Rewrite (2025-04-02)

## Current Focus

The primary focus is now on **rewriting the backend web scraping logic from Python to Node.js** and integrating it directly into the Electron application's main process. This will eliminate the need for the separate Python API server (`api/app.py`).

## Recent Changes

*   **Decision:** Switched from a separate Python backend API to an integrated Node.js backend within Electron.
*   **UI Improvements:**
    *   Implemented dark mode by default using Tailwind CSS (with manual CSS generation workaround).
    *   Improved image display logic to handle multiple variant images within table rows.
*   **Build Process:** Configured `electron-builder` and resolved build issues (related to permissions and CSS generation) to successfully create a `.exe` installer for the Electron frontend (which still currently relies on the *external* Python API).
*   **Memory Bank:** Updated `projectbrief.md`, `techContext.md`, and `systemPatterns.md` to reflect the new integrated architecture decision.
*   **Git:** Decision made to initialize Git and connect to `https://github.com/glvckoma/AJC-Price-Checker`.

## Next Steps

1.  **Update Memory Bank:** Complete the update of `activeContext.md` (this file) and `progress.md`.
2.  **Initialize Git:** Run `git init`, `git remote add origin ...`, `git add .`, `git commit ...`.
3.  **Install Node.js Dependencies:** Add `axios` and `cheerio` to `package.json`.
4.  **Implement IPC Setup:**
    *   Define IPC channel names (e.g., `search-wiki`, `get-page-details`).
    *   Set up `ipcMain` handlers in `src/main.js` to listen for requests from the renderer.
    *   Modify `src/renderer/renderer.js` to send requests via `ipcRenderer.invoke()` instead of `fetch()`.
    *   Update `src/preload.js` to securely expose `ipcRenderer.invoke` using `contextBridge`.
5.  **Rewrite Scraping Logic (Node.js):**
    *   Create functions in `src/main.js` (or a separate `src/scraper.js` module) equivalent to Python's `_fetch_page_content`, `_parse_search_results`, and `_extract_worth_details` using `axios` and `cheerio`.
    *   Integrate this logic into the `ipcMain` handlers.
6.  **Remove Python Backend:** Delete the `api/` directory and remove Python-related dependencies/scripts if no longer needed.
7.  **Testing:** Thoroughly test the integrated application.
8.  **Refine Build:** Configure `electron-builder` for a portable `.exe` build.

## Open Questions/Decisions

*   None currently; the path forward is to implement the Node.js backend integration.
