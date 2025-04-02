# System Patterns: AJ Item Price Checker

## Architecture Overview (Updated 2025-04-02 - Modular Main Process)

The application follows an integrated Electron architecture. The main process logic has been modularized for better organization and maintainability.

```mermaid
graph TD
    subgraph Electron App
        subgraph Main Process
            MP_Entry[main.js Entry Point] --> MP_Win[app/window.js]
            MP_Entry --> MP_IPC[ipc/handlers.js]
            MP_Entry --> MP_Scraper[services/scraper.js]
            MP_Entry --> MP_Updater[services/updater.js]
        end
        MP_IPC -- Uses --> MP_Scraper
        MP_IPC -- Uses --> MP_Updater
        MP_IPC -- Uses --> MP_Win

        R[Renderer Process UI<br>(renderer.js)]
    end

    User -- Interacts --> R;
    R -- IPC Request --> MP_IPC;
    MP_IPC -- IPC Response --> R;

    MP_Scraper -- HTTP Request --> Wiki[AJ Item Worth Wiki];
    Wiki -- HTML Response --> MP_Scraper;

    MP_Updater -- HTTP Request --> GitHub[GitHub API];
    GitHub -- JSON Response --> MP_Updater;

    MP_Updater -- Show Dialog --> User;
    MP_IPC -- Open External --> Browser;

```

*   **Electron App:** The single packaged application (`.exe`).
*   **Main Process (Modular):** Runs Node.js. Orchestrated by `src/main.js`.
    *   `src/app/window.js`: Handles main browser window creation and management.
    *   `src/services/scraper.js`: Contains all logic for fetching and parsing data from the AJ Item Worth Wiki (using `axios`, `cheerio`).
    *   `src/services/updater.js`: Handles checking for application updates via the GitHub API (using `axios`, `semver`, `dialog`, `shell`).
    *   `src/ipc/handlers.js`: Sets up and manages all `ipcMain` listeners, delegating tasks to the appropriate services (`scraper`, `updater`).
*   **Renderer Process (`src/renderer/renderer.js`):** Runs the user interface (HTML/CSS/JS) within a Chromium window. Handles user input, displays results, and communicates with the main process via the `preload.js` bridge.
*   **Inter-Process Communication (IPC):** The Renderer process sends requests via the `contextBridge` API exposed in `src/preload.js`. These requests are handled by listeners set up in `src/ipc/handlers.js` in the Main process, which then calls the relevant service modules. Results or errors are returned to the Renderer.
*   **External Services:**
    *   The Animal Jam Item Worth Wiki (`aj-item-worth.fandom.com`), accessed by `scraper.js`.
    *   GitHub API (`api.github.com`), accessed by `updater.js`.

## Key Patterns & Decisions

1.  **Modular Main Process:** The main process logic is broken down into distinct modules based on responsibility (windowing, scraping, updates, IPC handling) to improve code organization, testability, and maintainability. `main.js` acts as the central orchestrator.
2.  **Service Layer:** Business logic (scraping, update checking) is encapsulated within dedicated service modules (`services/scraper.js`, `services/updater.js`).
3.  **IPC Abstraction:** IPC handler setup is centralized in `ipc/handlers.js`, decoupling it from the core application logic and specific services.
4.  **Integrated Backend:** The Node.js backend logic runs directly within the Electron main process structure.
5.  **IPC for Communication:** Electron's `ipcMain`/`ipcRenderer` with `contextBridge` is used for secure communication between processes.
6.  **Asynchronous Operations:** `async/await` is used extensively in the main process for non-blocking I/O (network requests, file system access if added later).
7.  **Web Scraping (Node.js):** Standard libraries (`axios`, `cheerio`) are used within `scraper.js`.
8.  **Single Process Deployment:** Packaged into a single executable using `electron-builder`.
9.  **Update Check:** Logic is now encapsulated in `updater.js`, triggered by `main.js` on startup. Uses `semver` for comparison and `dialog`/`shell` for user interaction. Renderer is notified via IPC for status updates.
10. **Error Handling:** Errors during scraping or updates are generally handled within the respective services and propagated via Promises/rejections through IPC handlers to the renderer.

## Comparison to Previous Architectures

*   **Original (Python/PyQt5):** Monolithic application combining UI and logic.
*   **Intermediate (Electron + Python API):** Decoupled UI and backend, but required running two separate processes and used HTTP for local communication.
*   **Previous (Integrated Electron - Monolithic Main):** Combined UI and backend logic within Electron's process model, but `main.js` handled too many responsibilities.
*   **Current (Integrated Electron - Modular Main):** Main process logic is now separated into distinct modules for better structure and maintainability.
