# Project Brief: AJ Item Price Checker

## Original Goal (from project-scope.md)

To create a simple, standalone Windows desktop application allowing non-technical users to search for Animal Jam items by name and view their estimated worth by scraping data from the AJ Item Worth Wiki (aj-item-worth.fandom.com).

## Current Objective (Updated 2025-04-02)

Refactor the existing application into a **single, standalone Electron application** with integrated backend logic, eliminating the need for a separate Python process. This involves:

1.  **Rewriting Backend Logic:** Port the Python web scraping logic (searching the wiki, fetching pages, parsing worth/images) to Node.js using libraries like `axios` and `cheerio`.
2.  **Integrating Logic:** Run the Node.js scraping logic within the Electron main process and communicate results to the renderer process using Electron's IPC mechanisms.
3.  **Frontend:** Utilize the existing Electron frontend (UI built with HTML/Tailwind CSS, logic in `renderer.js`).
4.  **Packaging:** Configure `electron-builder` to produce a single, portable `.exe` file that requires no separate setup or installation.
5.  **Documentation:** Maintain the Memory Bank to reflect the integrated architecture and progress.
