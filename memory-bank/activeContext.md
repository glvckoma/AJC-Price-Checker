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
*   **Icon Fixes:** Attempted various fixes for `.exe` icon display, eventually aligning config with 'Jam' project and using `electron-builder.json`. Build requires admin privileges and Developer Mode enabled on Windows. Icon cache clearing may be needed for File Explorer to update.
*   **Update Check:** Implemented a feature in `main.js` to check `https://api.github.com/repos/glvckoma/AJC-Price-Checker/releases/latest` on startup. Uses `axios` and `semver` to compare versions. If a newer version is found, uses `dialog.showMessageBox` to notify the user and `shell.openExternal` to offer opening the releases page. Added `semver` dependency.

## Next Steps

1.  **Update Memory Bank:** Completed updates for the update check feature (`activeContext.md`, `progress.md`, `systemPatterns.md`, `techContext.md`).
2.  **Commit Changes:** Stage and commit the `semver` installation, `main.js` modifications, and Memory Bank updates. Push to GitHub.
3.  **Testing:** Run the application (`npm start`) to ensure the update check functions correctly (or fails silently if no newer release exists/network error). Test the "Download" button functionality.
4.  **Tagging & Release (Crucial for Testing):** To fully test the update notification, a new release needs to be tagged and created on GitHub with a version number higher than the current `package.json` version (e.g., `v1.0.1` or `v1.1.0`).
5.  **Further Enhancements (Optional):** Consider implementing suggestions like loading indicators, clear button, result highlighting, etc.
6.  **Final Build & Test:** Perform a final build (`npm run build` as admin) and test the portable `.exe`.

## Development Nuances & Run Commands

*   **Running for Development:** Use `npm start`. This launches the Electron app directly.
*   **CSS Generation:** The project uses Tailwind CSS, but automatic building via `npm run build:css --watch` or as part of `npm start` failed due to environment issues. The `src/renderer/style.css` file contains manually generated CSS. **To update styles:**
    1.  Modify Tailwind classes in `.html`/`.js` files or edit `tailwind.config.js`.
    2.  Manually run `npx postcss ./src/styles/input.css -o ./src/renderer/style.css`.
    3.  Alternatively, troubleshoot the MINGW64/npm environment to fix the `build:css` script execution.
*   **Building Executable:** Use `npm run build`. **Requires running the command as Administrator** on Windows due to `electron-builder` needing permissions to create symbolic links for its dependencies during the build process. The output is a portable `.exe` in the `dist/` folder.
