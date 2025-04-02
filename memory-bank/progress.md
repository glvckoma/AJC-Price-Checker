# Progress: AJ Item Price Checker (As of 2025-04-02 - Post-Refactor)

## Current Status

*   **Project Phase:** Integrated Node.js backend complete. Documentation updated.
*   **Decision:** Application uses a fully integrated Electron architecture (Node.js backend).
*   **Memory Bank:** Updated to reflect current state.
*   **Frontend:** Electron UI functional, styled with Tailwind CSS (dark mode default), uses IPC for data requests.
*   **Backend:** Node.js scraping logic implemented in the main process using `axios`/`cheerio`, communicating via IPC. Python backend removed.
*   **Build:** `electron-builder` configured for portable `.exe` output. Build requires admin privileges. Manual CSS generation workaround in place.
*   **Documentation:** `README.md` created.

## What Works

*   Electron application launches and displays UI (`npm start`).
*   Dark mode styling is applied correctly.
*   Searching for items via the UI sends requests to the main process via IPC.
*   Main process performs searches using Node.js scraping logic.
*   Search results are returned via IPC and displayed in the list.
*   Clicking a result sends a request to the main process via IPC.
*   Main process fetches and parses details/images using Node.js scraping logic, **including handling of multiple sections/tables**.
*   Worth details (table or text) and item images are returned via IPC and displayed correctly, including alignment. **Images are clickable and open in a modal. Source URL is displayed as a clickable link.**
*   Application can be packaged into a portable `.exe` using `npm run build` (run as admin). **Icon configuration updated to use `build/icon.ico` via `electron-builder.json`.**

## What's Left to Build (High-Level)

*   **(Optional) Resolve Build Environment Issues:** Investigate and fix the underlying cause of the `npm run build:css` failures in the MINGW64 environment to allow automatic CSS generation and remove the manual CSS workaround.
*   **(Optional) Further UI/UX Refinements:** Add features like loading indicators, more detailed error messages, etc.
*   **(Optional) Code Refinements:** Potentially move scraping logic from `main.js` to a separate module for better organization.

## Known Issues / Challenges

*   **Web Scraping Brittleness:** Still reliant on the wiki's HTML structure. Changes to the wiki may break the application.
*   **Parsing Limitations:** May not correctly parse worth/images from all page layouts on the wiki.
*   **Build Environment:** The inability to reliably run build tools via npm scripts necessitates manual CSS generation, making styling updates cumbersome. Build requires administrator privileges and potentially Developer Mode enabled on Windows. Icon display in File Explorer may require clearing the Windows icon cache.
