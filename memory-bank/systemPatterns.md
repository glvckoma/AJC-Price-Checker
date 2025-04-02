# System Patterns: AJ Item Price Checker

## Architecture Overview (Updated 2025-04-02)

The application now follows an **integrated Electron architecture**, where both the frontend UI and the backend scraping logic reside within the same Electron application process structure.

```mermaid
graph TD
    subgraph Electron App
        B(Main Process)
        C(Renderer Process - UI)
    end
    A[User] -- Interacts --> C;
    C -- IPC Request (Search/Details) --> B;
    B -- IPC Response (Results/Details) --> C;
    B -- HTTP Request (axios - Scraping) --> D{{AJ Item Worth Wiki}};
    D -- HTML Response --> B;
    B -- HTTP Request (axios - Update Check) --> E{{GitHub API}};
    E -- JSON Response --> B;
    B -- Show Dialog (dialog.showMessageBox) --> A;
    A -- Click Download --> B;
    B -- Open External (shell.openExternal) --> F[Browser];

```

*   **Electron App:** The single packaged application (`.exe`).
*   **Main Process (`main.js`):** Runs Node.js. Handles window creation, application lifecycle, and contains the backend web scraping logic (using `axios` and `cheerio`). Performs network requests to the external wiki.
*   **Renderer Process (`renderer.js`):** Runs the user interface (HTML/CSS/JS) within a Chromium window. Handles user input and displays results.
*   **Inter-Process Communication (IPC):** The Renderer process sends requests (e.g., search term, page URL) to the Main process via Electron's IPC channels. The Main process performs the scraping and sends the results (or errors) back to the Renderer process via IPC.
 *   **External Services:**
     *   The Animal Jam Item Worth Wiki (`aj-item-worth.fandom.com`), the primary data source for item worth.
     *   GitHub API (`api.github.com`), used for checking for application updates via the `/releases/latest` endpoint.

## Key Patterns & Decisions

1.  **Integrated Backend:** The scraping logic is ported to Node.js and runs directly within the Electron main process, eliminating the need for a separate server process (like Python/Flask).
2.  **IPC for Communication:** Electron's built-in `ipcMain` and `ipcRenderer` modules are used for secure and efficient communication between the frontend (Renderer) and the backend logic (Main). This replaces the previous HTTP API calls.
3.  **Asynchronous Operations (Main Process):** The main process uses `async/await` with `axios` for network requests and potentially for parsing with `cheerio` to avoid blocking the main thread while scraping.
4.  **Web Scraping (Node.js):** Standard Node.js libraries (`axios`, `cheerio`) are used for fetching and parsing HTML from the target wiki. This pattern remains dependent on the wiki's structure.
5.  **Single Process Deployment:** The entire application (UI and backend logic) is packaged into a single executable using `electron-builder`.
6.  **Update Check:** On application startup, the main process asynchronously checks the GitHub API for the latest release tag. It compares this with the current application version using `semver`. If a newer version exists, it prompts the user with a native dialog offering to open the GitHub releases page. Errors during the update check are logged silently.
7.  **Error Handling:** Errors during wiki scraping (network, parsing) are handled within the main process logic and communicated back to the renderer process via IPC for display. Update check errors are handled silently in the main process.

## Comparison to Previous Architectures

*   **Original (Python/PyQt5):** Monolithic application combining UI and logic.
*   **Intermediate (Electron + Python API):** Decoupled UI and backend, but required running two separate processes and used HTTP for local communication.
*   **Current (Integrated Electron):** Combines UI and backend logic within Electron's process model, using IPC for internal communication. Simplifies deployment to a single executable but requires rewriting the backend logic in Node.js.
