// Electron main process
const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron'); // Added shell, dialog
const path = require('path');
const axios = require('axios'); // For HTTP requests
const cheerio = require('cheerio'); // For HTML parsing
const url = require('url'); // For joining URLs
const semver = require('semver'); // For version comparison

// --- GitHub Update Check Configuration ---
const GITHUB_OWNER = 'glvckoma';
const GITHUB_REPO = 'AJC-Price-Checker';
const GITHUB_RELEASES_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases`;
const GITHUB_API_LATEST_RELEASE_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;

// --- Configuration ---
const BASE_URL = "https://aj-item-worth.fandom.com";
const SEARCH_PATH = "/wiki/Special:Search";
const HEADERS = {
    // Use a realistic User-Agent
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
    'Accept-Language': 'en-US,en;q=0.9',
};
const REQUEST_TIMEOUT = 25000; // Milliseconds
// No artificial delay needed like in Python script

// --- Helper: Fetch Page Content ---
async function fetchPageContent(targetUrl) {
    console.log(`Fetching: ${targetUrl}`);
    try {
        const response = await axios.get(targetUrl, {
            headers: HEADERS,
            timeout: REQUEST_TIMEOUT,
            // Important for handling potential redirects correctly
            maxRedirects: 5,
            // Validate status code to ensure success (2xx)
            validateStatus: function (status) {
                return status >= 200 && status < 300;
            },
        });
        return response.data; // Returns the HTML string
    } catch (error) {
        console.error(`Error fetching ${targetUrl}:`, error.message);
        if (error.response) {
            console.error(`Status: ${error.response.status}`);
        }
        // Rethrow a simpler error for IPC
        throw new Error(`Network Error fetching page: ${error.message}`);
    }
}

// --- Helper: Parse Search Results ---
function parseSearchResults(htmlContent) {
    console.log("Parsing search results...");
    const $ = cheerio.load(htmlContent);
    const results = [];
    // Use Cheerio selectors similar to BeautifulSoup
    $('ul.unified-search__results li.unified-search__result').slice(0, 15).each((index, element) => {
        const linkTag = $(element).find('article h3.unified-search__result__header a.unified-search__result__title');
        const title = linkTag.text().trim();
        const relativeUrl = linkTag.attr('href');

        if (title && relativeUrl) {
            // Use Node.js url.resolve for joining URLs
            const absoluteUrl = url.resolve(BASE_URL, relativeUrl);
            results.push({ title: title, url: absoluteUrl });
        }
    });
     if (results.length === 0 && $('ul.unified-search__results li.unified-search__result').length > 0) {
         console.warn("Warning: Found search items but couldn't extract links/titles. Selectors might need update.");
     }
    console.log(`Found ${results.length} potential results.`);
    return results;
}

// --- Helper: Extract Worth Details (Handles Multiple Sections) ---
function extractWorthDetails(htmlContent, pageUrl) { // Added pageUrl for logging context
    console.log(`Parsing item details for multiple sections on page: ${pageUrl}`);
    const $ = cheerio.load(htmlContent);
    const sections = []; // Array to hold section objects

    // Find main content area
    const contentArea = $('div.mw-parser-output');
    if (contentArea.length === 0) {
        console.warn("Warning: Could not find main content area (div.mw-parser-output).");
        sections.push({ type: "text", title: "Error", content: "Could not find main content area to parse." });
        return sections; // Return early with error section
    }

    // Iterate through potential section headers (h2) and the tables/content following them
    contentArea.find('h2').each((index, h2Element) => {
        const sectionTitle = $(h2Element).find('.mw-headline').text().trim();
        if (!sectionTitle) return; // Skip if no title found

        console.log(`Found section header: ${sectionTitle}`);

        // Find the next relevant table *after* this h2 but *before* the next h2
        let worthTable = null;
        let currentNode = $(h2Element).next(); // Start with the element right after h2
        while (currentNode.length > 0 && !currentNode.is('h2')) {
            // Check if the current node *is* the table or *contains* the table
            if (currentNode.is('table.wikitable, table.article-table')) {
                worthTable = currentNode;
                break;
            }
            const foundTable = currentNode.find('table.wikitable, table.article-table').first();
            if (foundTable.length > 0) {
                worthTable = foundTable;
                break;
            }
            currentNode = currentNode.next(); // Move to the next sibling
        }


        if (worthTable && worthTable.length > 0) {
             console.log(`Processing table under section: ${sectionTitle}`);
            const rows = worthTable.find('tr');
            let headers = [];
            let tableRowsData = [];
            let tableImageUrls = [];

            if (rows.length > 0) {
                const headerRow = rows.first();
                headers = headerRow.find('th, td').map((i, el) => $(el).text().trim()).get();

                const dataRowsTr = rows.slice(1); // Get all rows except the header
                let imageRowIndex = -1; // Track which row contains images

                // Find the image row and extract image URLs
                dataRowsTr.each((rowIndex, rowElement) => {
                    const $row = $(rowElement);
                    // Check if this row contains images
                    if ($row.find('img').length > 0) {
                        imageRowIndex = rowIndex; // Mark this as the image row
                        const numColumns = headers.length > 0 ? headers.length : $row.find('td, th').length;
                        const imageCells = $row.find('td, th');

                        for (let i = 0; i < numColumns; i++) {
                            let cellImageUrl = null;
                            if (i < imageCells.length) {
                                const imgTag = $(imageCells[i]).find('img').first();
                                if (imgTag.length > 0) {
                                    cellImageUrl = imgTag.attr('data-src') || imgTag.attr('src');
                                    if (cellImageUrl && cellImageUrl.includes('/scale-to-width-down/')) {
                                        cellImageUrl = cellImageUrl.split('/scale-to-width-down/')[0];
                                    }
                                }
                            }
                            tableImageUrls.push(cellImageUrl);
                        }
                        return false; // Stop searching for image row once found
                    }
                });

                // Extract text data from rows that are NOT the image row
                dataRowsTr.each((rowIndex, rowElement) => {
                    if (rowIndex === imageRowIndex) {
                        return; // Skip the image row
                    }
                    let rowCellsText = [];
                    $(rowElement).find('td, th').each((cellIndex, cellElement) => {
                        // Clone the cell, remove 'a' tags (which might contain images or just be links), then get text
                        const $cellClone = $(cellElement).clone();
                        $cellClone.find('a').remove();
                        let cellText = $cellClone.text().replace(/\s+/g, ' ').trim();
                        rowCellsText.push(cellText);
                    });
                    if (rowCellsText.some(text => text)) {
                        tableRowsData.push(rowCellsText);
                    }
                });
            }

            // Add table section if valid data found
            if (headers.length > 0 || tableRowsData.length > 0) {
                 sections.push({
                     type: "table",
                     title: sectionTitle,
                     headers: headers,
                     rows: tableRowsData,
                     imageUrls: tableImageUrls
                 });
            } else {
                 console.log(`Skipping table under ${sectionTitle} - no valid headers or rows found.`);
            }
        } else {
             console.log(`No table found directly under section: ${sectionTitle}`);
             // Optionally, we could try extracting paragraph text associated with this header here
        }
    });

    // If no sections were found via h2, try finding the first table globally as fallback
    if (sections.length === 0) {
         console.log("No sections found via H2, trying global table search...");
         const worthTable = contentArea.find('table.wikitable, table.article-table').first();
         if (worthTable.length > 0) {
             console.log("Found global fallback table.");
             // (Repeat similar table parsing logic as above, but without a section title)
             const rows = worthTable.find('tr');
             let headers = []; let tableRowsData = []; let tableImageUrls = [];
             if (rows.length > 0) {
                 const headerRow = rows.first();
                 headers = headerRow.find('th, td').map((i, el) => $(el).text().trim()).get();
                 const dataRowsTr = rows.slice(1);
                 let imageRowIndex = -1; // Track image row

                 // Find image row
                 dataRowsTr.each((rowIndex, rowElement) => {
                     if ($(rowElement).find('img').length > 0) {
                         imageRowIndex = rowIndex;
                         const numColumns = headers.length > 0 ? headers.length : $(rowElement).find('td, th').length;
                         const imageCells = $(rowElement).find('td, th');
                         for (let i = 0; i < numColumns; i++) {
                             let cellImageUrl = null;
                             if (i < imageCells.length) { const imgTag = $(imageCells[i]).find('img').first(); if (imgTag.length > 0) { cellImageUrl = imgTag.attr('data-src') || imgTag.attr('src'); if (cellImageUrl && cellImageUrl.includes('/scale-to-width-down/')) { cellImageUrl = cellImageUrl.split('/scale-to-width-down/')[0]; } } }
                             tableImageUrls.push(cellImageUrl);
                         }
                         return false; // Stop after finding image row
                     }
                 });

                 // Extract text from non-image rows
                 dataRowsTr.each((rowIndex, rowElement) => {
                     if (rowIndex === imageRowIndex) return; // Skip image row
                     let rowCellsText = [];
                     $(rowElement).find('td, th').each((cellIndex, cellElement) => {
                         // Clone the cell, remove 'a' tags, then get text
                         const $cellClone = $(cellElement).clone();
                         $cellClone.find('a').remove();
                         let cellText = $cellClone.text().replace(/\s+/g, ' ').trim();
                         rowCellsText.push(cellText);
                     });
                     if (rowCellsText.some(text => text)) {
                         tableRowsData.push(rowCellsText);
                     }
                 });
             }
             if (headers.length > 0 || tableRowsData.length > 0) {
                 sections.push({ type: "table", title: "Worth Details", headers: headers, rows: tableRowsData, imageUrls: tableImageUrls });
             }
         }
    }

     // Fallback: If still no sections found (neither H2 sections nor global table), grab relevant paragraphs
     if (sections.length === 0) {
         console.log("No tables found, searching relevant paragraphs...");
         let paragraphText = [];
         contentArea.find('p').slice(0, 10).each((i, el) => { // Limit to first 10 paragraphs
             const pText = $(el).text().replace(/\s+/g, ' ').trim(); // Gets TEXT content of paragraphs
             const pTextLower = pText.toLowerCase();
             // Added more keywords relevant to item worth
             if (pText && (pTextLower.includes("worth") || pTextLower.includes("value") || pTextLower.includes("den beta") || pTextLower.includes("diamond") || pTextLower.includes("collar") || pTextLower.includes("wrist") || pTextLower.includes("spike") || pTextLower.includes("headdress") || pTextLower.includes("party hat"))) {
                 console.log(`Found relevant paragraph: ${pText.substring(0, 50)}...`);
                 paragraphText.push(pText);
             }
         });
         // If no keyword paragraphs found, grab the very first paragraph as general info
         if (paragraphText.length === 0) {
             console.log("No keyword paragraphs found, grabbing first paragraph.");
             const firstP = contentArea.find('p').first().text().replace(/\s+/g, ' ').trim(); // Gets TEXT of first <p>
             if (firstP) {
                 paragraphText.push(`[General Info:] ${firstP}`);
             } else {
                 console.log("Could not find even the first paragraph.");
             }
         }
         // If any paragraphs were found (keyword or first), create a 'text' section
         if (paragraphText.length > 0) {
             console.log("Adding extracted paragraphs as a text section.");
             sections.push({ type: "text", title: "Worth Information", content: paragraphText.join('\n\n') });
         } else {
             console.log("No relevant paragraphs found to add as fallback.");
         }
         // Removed duplicate else block here
     }

    // Final check: If absolutely no sections were added, return the "Not Found" message.
    if (sections.length === 0) {
        console.warn(`Parser found no structured content (tables or paragraphs) on ${pageUrl}. Returning 'Not Found'.`);
        sections.push({ type: "text", title: "Not Found", content: "Could not extract specific worth details from the page structure." });
    }

    console.log(`Returning ${sections.length} sections from parser for ${pageUrl}.`);
    return sections; // Return the array of section objects
}

// --- Helper: Check for Updates ---
async function checkForUpdates() {
    console.log('Checking for updates...');
    try {
        const currentVersion = app.getVersion();
        console.log(`Current version: ${currentVersion}`);

        const response = await axios.get(GITHUB_API_LATEST_RELEASE_URL, {
            headers: { 'Accept': 'application/vnd.github.v3+json' }, // Recommended by GitHub API docs
            timeout: 15000 // Shorter timeout for update check
        });

        if (response.status === 200 && response.data && response.data.tag_name) {
            const latestVersionTag = response.data.tag_name;
            // Strip 'v' prefix if present for semver comparison
            const latestVersion = latestVersionTag.startsWith('v') ? latestVersionTag.substring(1) : latestVersionTag;
            console.log(`Latest version tag: ${latestVersionTag}, Parsed: ${latestVersion}`);

            if (semver.valid(latestVersion) && semver.gt(latestVersion, currentVersion)) {
                console.log(`New version available: ${latestVersion}`);
                const { response: buttonIndex } = await dialog.showMessageBox({
                    type: 'info',
                    title: 'Update Available',
                    message: `A new version (${latestVersion}) is available. You have ${currentVersion}.`,
                    buttons: ['OK', 'Download'],
                    defaultId: 1, // Default to 'Download'
                    cancelId: 0 // 'OK' is cancel
                });

                if (buttonIndex === 1) { // User clicked 'Download'
                    console.log('User clicked Download, opening releases page...');
                    await shell.openExternal(GITHUB_RELEASES_URL);
                }
            } else {
                console.log('Current version is up-to-date or latest version is invalid/not newer.');
            }
        } else {
            console.log('Could not retrieve latest release information or tag_name missing.');
        }
    } catch (error) {
        console.error('Error checking for updates:', error.message);
        // Don't bother the user with an error dialog for update checks
    }
}


// --- IPC Handlers ---
async function handleSearchWiki(event, searchTerm) {
  console.log(`IPC: Received search request for: ${searchTerm}`);
  const searchUrl = `${BASE_URL}${SEARCH_PATH}?query=${encodeURIComponent(searchTerm)}&scope=internal&navigationSearch=true`;
  try {
    const htmlContent = await fetchPageContent(searchUrl);
    const results = parseSearchResults(htmlContent);
    return results; // Send results back to renderer
  } catch (error) {
    console.error(`IPC Error during search for "${searchTerm}":`, error);
    // Rethrow the simplified error message for the renderer
    throw new Error(error.message || "Failed to search wiki.");
  }
}

async function handleGetPageDetails(event, pageUrl) {
  console.log(`IPC: Received details request for: ${pageUrl}`);
   // Basic validation
   if (!pageUrl || !pageUrl.startsWith(BASE_URL)) {
        console.error(`IPC Error: Invalid page URL received: ${pageUrl}`);
        throw new Error(`Invalid page URL provided.`);
   }
  let htmlContent;
  try {
    htmlContent = await fetchPageContent(pageUrl);
    // Removed temporary logging
  } catch (fetchError) {
    // Handle fetch errors separately
    console.error(`IPC Error during FETCH for "${pageUrl}":`, fetchError);
    throw new Error(`Failed to fetch page details for ${pageUrl}. Reason: ${fetchError.message || "Unknown network error"}`);
  }

  // Now, try parsing the fetched content
  let sections;
  try {
      sections = extractWorthDetails(htmlContent, pageUrl);
      // Add an extra check here: if extractWorthDetails somehow returned non-array, force error
      if (!Array.isArray(sections)) {
          console.error(`Parser function extractWorthDetails did not return an array for ${pageUrl}!`);
          throw new Error("Internal parser error: Invalid data format returned.");
      }
  } catch (parseError) {
      console.error(`Error PARSING details for "${pageUrl}":`, parseError);
      // If parsing fails, create a specific error section
      sections = [{ type: "text", title: "Parsing Error", content: `Failed to parse page content. Error: ${parseError.message}` }];
  }

  // Return the result (either parsed sections or the parsing error section)
  return { sections: sections, source_url: pageUrl };
}


function createWindow () {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    icon: path.join(__dirname, '../assets/icon.ico'), // Point back to assets directory
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      // Consider setting contextIsolation: true (default) and nodeIntegration: false for security
      // If preload script needs node modules, enable nodeIntegrationInWorker: true or use contextBridge
    }
  });

  // Load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, 'renderer/index.html'));

  // Open the DevTools automatically if needed (useful for debugging)
  // mainWindow.webContents.openDevTools();
}

// --- IPC Setup ---
function setupIpcHandlers() {
  // Use ipcMain.handle for async request/response pattern
  ipcMain.handle('search-wiki', handleSearchWiki);
  ipcMain.handle('get-page-details', handleGetPageDetails);

  // Listener for opening external links
  ipcMain.on('open-external-link', (event, url) => {
    console.log(`IPC: Received request to open external link: ${url}`);
    // Basic validation again for safety on main process side
    if (typeof url === 'string' && (url.startsWith('http:') || url.startsWith('https:'))) {
      shell.openExternal(url); // Use Electron's shell module
    } else {
       console.error(`Attempted to open invalid external URL from main process: ${url}`);
    }
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => { // Make the callback async
  setupIpcHandlers(); // Set up IPC listeners
  createWindow();
  await checkForUpdates(); // Check for updates after window creation

  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
