# Progress: AJ Item Price Checker (As of 2025-04-02)

## Current Status

*   **Project Phase:** Refactoring backend logic to Node.js.
*   **Decision:** Application architecture changed from Electron+PythonAPI to a fully integrated Electron app with Node.js backend logic. Goal is a single portable executable.
*   **Memory Bank:** Core files created and updated to reflect current architecture and decisions.
*   **Frontend:** Electron UI is functional, styled with Tailwind CSS (dark mode default), displays search results, table-based worth details, and item images (fetched via Python API).
*   **Backend:** Python Flask API (`api/app.py`) is functional and provides data to the current frontend prototype.
*   **Build:** `electron-builder` is configured. Successful `.exe` build achieved (requires admin privileges due to symlink issues during build). Manual CSS generation workaround implemented due to build script execution problems.

## What Works

*   Electron application launches and displays UI.
*   Dark mode styling is applied.
*   Searching for items via the UI successfully calls the Python backend API.
*   Search results are displayed in the list.
*   Clicking a result fetches details from the Python backend API.
*   Worth details are displayed, using an HTML table format when applicable.
*   Item images (variants) are extracted by the Python backend and displayed in a row above the table.
*   Application can be packaged into an installer `.exe` (though it still requires the Python API to be run separately).

## What's Left to Build (High-Level)

1.  **Node.js Backend Rewrite:**
    *   Install `axios` and `cheerio`.
    *   Implement Electron IPC communication (main/renderer/preload).
    *   Rewrite Python scraping functions (`_fetch_page_content`, `_parse_search_results`, `_extract_worth_details`) in Node.js using `axios`/`cheerio`.
    *   Integrate Node.js scraping functions with IPC handlers in the main process.
    *   Update renderer process to use IPC instead of `fetch`.
2.  **Cleanup:** Remove the Python API (`api/` directory) and related dependencies.
3.  **Testing:** Thoroughly test the fully integrated application.
4.  **Packaging Refinement:** Configure `electron-builder` for a portable build target (single `.exe` without installation).
5.  **(Optional) Resolve Build Environment Issues:** Investigate and fix the underlying cause of the `npm run build:css` failures in the MINGW64 environment to allow automatic CSS generation.

## Known Issues / Challenges

*   **Web Scraping Brittleness:** Still reliant on the wiki's HTML structure.
*   **Node.js Parsing:** Adapting Python/BeautifulSoup parsing logic to Node.js/cheerio might require adjustments.
*   **Build Environment:** The inability to reliably run build tools via npm scripts necessitates manual CSS generation, making styling updates cumbersome.
