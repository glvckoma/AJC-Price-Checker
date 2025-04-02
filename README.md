# AJ Price Checker (Electron Version)

A simple desktop application built with Electron to quickly search for Animal Jam item worth by scraping data from the [AJ Item Worth Wiki](https://aj-item-worth.fandom.com).

This version uses an integrated Node.js backend for scraping, eliminating the need for a separate Python server.

## Features

*   Search for Animal Jam items by name.
*   Displays a list of potential matching wiki pages.
*   Fetches and displays item worth details upon selection.
*   Attempts to parse and display worth information from tables or relevant paragraphs.
*   Displays item variant images when found in tables.
*   Dark mode UI by default (styled with Tailwind CSS).
*   Built as a single application using Electron.

## Technology Stack

*   **Framework:** Electron
*   **Runtime:** Node.js
*   **Frontend:** HTML, Tailwind CSS, JavaScript (Renderer Process)
*   **Backend Logic:** Node.js (Main Process)
    *   HTTP Requests: `axios`
    *   HTML Parsing: `cheerio`
*   **Packaging:** `electron-builder`

## Setup & Running for Development

1.  **Prerequisites:**
    *   Node.js and npm installed.
    *   Git installed.
2.  **Clone the repository (if you haven't already):**
    ```bash
    git clone https://github.com/glvckoma/AJC-Price-Checker.git
    cd AJC-Price-Checker
    ```
3.  **Install dependencies:**
    ```bash
    npm install
    ```
4.  **Run the application:**
    ```bash
    npm start
    ```
    *   **Note:** The application uses a manually generated `src/renderer/style.css` due to build environment issues encountered during development. If you modify Tailwind classes in the HTML/JS or the Tailwind config, you may need to manually run `npx postcss ./src/styles/input.css -o ./src/renderer/style.css` to update the styles, or troubleshoot the build environment to get the `build:css --watch` script working reliably.

## Building the Executable

1.  **Build the portable `.exe`:**
    ```bash
    npm run build
    ```
    *   **Important:** On Windows, you may need to run this command in a terminal opened **as Administrator** due to potential permission issues with creating symbolic links required by `electron-builder`'s dependencies.
2.  The output (`AJ Price Checker X.Y.Z.exe`) will be located in the `dist/` directory. This is a portable executable and does not require installation.

## Known Issues & Limitations

*   **Scraping Brittleness:** Relies heavily on the AJ Item Worth Wiki's HTML structure. Changes to the wiki may break the application.
*   **Parsing Limitations:** May not correctly parse worth/images from all page layouts on the wiki.
*   **Manual CSS:** Styling updates currently require manual regeneration of `style.css` due to build environment issues.
