# Active Context: AJ Item Price Checker - Post-Refactor (2025-04-02)

## Current Focus

Finalizing documentation and preparing for potential further enhancements after implementing key fixes.

## Recent Changes (Post-Refactor)

*   **Backend Rewrite:** Completed porting Python scraping logic to Node.js (`axios`, `cheerio`) within the Electron main process (`src/main.js`).
*   **IPC Implementation:** Replaced HTTP API calls with Electron's IPC mechanism (`ipcMain`, `ipcRenderer`, `contextBridge`) for communication between main and renderer processes.
*   **Python Backend Removal:** Deleted the `api/` directory and old Python scripts.
*   **Build Configuration:** Updated `electron-builder` settings in `package.json` to target a `portable` Windows executable.
*   **Git:** Initialized local repository, connected to GitHub remote (`https://github.com/glvckoma/AJC-Price-Checker`), committed refactoring changes, and pushed to remote.
*   **Documentation:** Created `README.md`.
*   **Multi-Section Handling:** Updated backend (`main.js`) and frontend (`renderer.js`) to parse and display multiple tables/sections from wiki pages (e.g., "Other Variants").
*   **Image Modal:** Implemented clickable images in tables that open a larger view in a modal.
*   **Source Link:** Fixed display of source URL link (including "Source: " text) and implemented opening via IPC/shell.
*   **Update Check:** Logic moved to `services/updater.js`. Checks GitHub on startup, uses `dialog` and `shell`.
*   **Main Process Modularization:** Refactored `src/main.js` into `app/window.js`, `services/scraper.js`, `services/updater.js`, and `ipc/handlers.js`.
*   **Dynamic Status Bar:** Implemented state-based styling for the status bar in `renderer.js`. Uses Tailwind classes defined in JS and applies them dynamically. Added IPC listeners/triggers via `preload.js` for update notifications and actions. Manually added CSS transition and missing color rules to `style.css`. Addressed specificity issues. Styling is now functional.
*   **Scraper Fix (Link Text):** Modified `services/scraper.js` to correctly extract text content from table cells that include links (e.g., "A Few RIMs"), preventing loss of information like "RIMs". Removed the code that was stripping `<a>` tags.

## Next Steps

1.  **Update Memory Bank:** Update `progress.md` to reflect the scraper fix. (`activeContext.md`, `systemPatterns.md`, `techContext.md` are updated for status bar).
2.  **Commit Changes:** Stage and commit the scraper fix (`services/scraper.js`) and Memory Bank updates. Push to GitHub.
3.  **Testing:** Run the application (`npm start`) and specifically test items whose worth values contain links (like "RIMs", "Den Betas") to ensure the full text is displayed correctly in the details table. Also re-verify status bar colors.
4.  **Tagging & Release (Crucial for Testing Update Status):** To fully test the "Update Available" status color/click behavior, a new release needs to be tagged and created on GitHub with a version number higher than the current `package.json` version (e.g., `v1.0.1` or `v1.1.0`).
5.  **Further Enhancements (Optional):** Consider implementing suggestions like loading indicators, clear button, result highlighting, fixing CSS build issues, or refactoring the renderer process into modules.
6.  **Final Build & Test:** Perform a final build (`npm run build` as admin) and test the portable `.exe`.

## Development Nuances & Run Commands

*   **Running for Development:** Use `npm start`. This launches the Electron app directly.
*   **CSS Generation:** The project uses Tailwind CSS, but automatic building via `npm run build:css --watch` or as part of `npm start` failed due to environment issues. The `src/renderer/style.css` file contains manually generated CSS. **To update styles:**
    1.  Modify Tailwind classes in `.html`/`.js` files or edit `tailwind.config.js`.
    2.  Manually run `npx postcss ./src/styles/input.css -o ./src/renderer/style.css`.
    3.  Alternatively, troubleshoot the MINGW64/npm environment to fix the `build:css` script execution.
*   **Building Executable:** Use `npm run build`. **Requires running the command as Administrator** on Windows due to `electron-builder` needing permissions to create symbolic links for its dependencies during the build process. The output is a portable `.exe` in the `dist/` folder.
