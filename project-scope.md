Project Goal:

To create a simple, standalone desktop application for Windows that allows a user without technical expertise to easily search for Animal Jam items by name and view their estimated worth by scraping data directly from the Animal Jam Item Worth Wiki (aj-item-worth.fandom.com).

Key Features & Functionality:

Graphical User Interface (GUI): Provides a user-friendly window with input fields, buttons, and display areas, eliminating the need for command-line interaction.

Item Search:

Accepts an item name as text input from the user.

Uses the wiki's built-in search functionality (Special:Search) to find relevant pages matching the query.

Search Results Display:

Presents a list of potential matching wiki page titles found by the search.

Allows the user to select a specific result from the list (via double-click).

Worth Details Fetching & Display:

Upon user selection, fetches the content of the chosen wiki page.

Attempts to parse the page content (specifically looking for tables with classes wikitable or article-table, or paragraphs containing keywords like "worth", "den beta", "diamond", etc.) to extract potential worth information.

Displays the extracted text (or relevant paragraphs/table rows) in a dedicated text area.

Responsiveness: Uses background threads (QThread) for web requests (searching and fetching details) to prevent the GUI from freezing during network operations.

Status Updates: Provides basic feedback to the user via a status bar (e.g., "Searching...", "Fetching details...", "Results loaded.", "Error occurred.").

Basic Error Handling: Displays pop-up messages and details in the output area for common errors (e.g., network connection issues, SSL problems, failure to parse expected content).

Standalone Executable: Packaged as a single .exe file for Windows using PyInstaller, allowing it to run without requiring a separate Python installation or manual library setup on the end-user's machine.

Technical Components:

Language: Python 3(could use something else if it would improve our results)

GUI Library: PyQt5(I want to change this to something better)

Web Scraping: requests (for HTTP requests), BeautifulSoup4 (for HTML parsing)

Packaging: PyInstaller

In Scope:

Implementing the features listed above.

Targeting the specific structure of the AJ Item Worth Fandom wiki as observed during development.

Providing basic usability for a non-technical Windows user.

Out of Scope (Limitations & Exclusions):

Guaranteed Data Accuracy: The application only scrapes and displays data from a community-edited wiki. It does not verify or guarantee the accuracy or timeliness of the worth information presented.

Official API Usage: The application relies entirely on web scraping, as no public API was found for the wiki.

Robust Parsing for All Pages: The worth extraction logic targets common page structures (specific tables, keywords). It may fail to extract data correctly from pages with unusual or significantly different layouts.

Automatic Application Updates: The .exe will not update itself. If the wiki's website structure changes significantly, the application's scraping functions will likely break, requiring manual code updates and rebuilding the .exe.

Cross-Platform Compatibility: The current build process targets Windows (.exe). Creating versions for macOS or Linux would require separate build steps and potentially minor code adjustments.

Offline Functionality: Requires an active internet connection to perform searches and fetch item details.

Advanced Features: Does not include features like saving search history, user accounts, image display, price tracking over time, or direct interaction with the Animal Jam game.

Handling Aggressive Anti-Scraping Measures: If the wiki implements stricter anti-scraping techniques (like complex JavaScript challenges or CAPTCHAs), the current approach may fail.

Target User:

A non-technical user (like the user's girlfriend) running Windows who wants a simple tool to quickly look up estimated item worths from the AJ Item Worth Wiki without navigating the website directly or using a command line.