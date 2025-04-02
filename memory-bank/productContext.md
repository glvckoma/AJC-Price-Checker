# Product Context: AJ Item Price Checker

## Problem Solved

Navigating the Animal Jam Item Worth Wiki (aj-item-worth.fandom.com) directly can be cumbersome for users who simply want a quick estimate of an item's value. They might need to perform searches, click through multiple pages, and manually scan for relevant worth information.

This application aims to streamline this process by providing a dedicated tool that directly queries the wiki and presents potential worth information in a clear, accessible format.

## Target User

The primary target user is a non-technical individual (specifically mentioned as the user's girlfriend in `project-scope.md`) running Windows. They are familiar with Animal Jam but may not be comfortable with complex web navigation or command-line tools.

## Desired User Experience

*   **Simplicity:** The interface should be intuitive and straightforward, requiring minimal learning. A simple search bar, results list, and details display area are key.
*   **Responsiveness:** The application should feel responsive, even during network operations (searching, fetching data). Background threading (or asynchronous operations in the new architecture) is crucial to prevent the UI from freezing.
*   **Clarity:** Search results and extracted worth information should be presented clearly. Status updates should inform the user about what the application is doing (e.g., "Searching...", "Fetching details...").
*   **Ease of Use:** The application should be a standalone executable, requiring no separate installations (like Python) or complex setup.
*   **Focus:** The tool should focus solely on the core task of searching for item worth on the specified wiki. It avoids extraneous features.

## Limitations (from project-scope.md)

It's important to remember the application's limitations:
*   Worth data accuracy depends entirely on the wiki content.
*   Relies on web scraping, which can break if the wiki structure changes.
*   Parsing logic might not work for all wiki page layouts.
*   No automatic updates.
*   Currently Windows-only (though Electron opens possibilities).
*   Requires an internet connection.
