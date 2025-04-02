// Electron main process
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const axios = require('axios'); // For HTTP requests
const cheerio = require('cheerio'); // For HTML parsing
const url = require('url'); // For joining URLs

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

// --- Helper: Extract Worth Details ---
function extractWorthDetails(htmlContent) {
    console.log("Parsing item details...");
    const $ = cheerio.load(htmlContent);
    let worthInfoLines = [];
    let imageUrls = []; // Initialize list for image URLs

    // Find main content area
    const contentArea = $('div.mw-parser-output');
    if (contentArea.length === 0) {
        console.warn("Warning: Could not find main content area (div.mw-parser-output). Parsing whole page.");
        // If no content area, parsing the whole body might be too broad, return early?
        // For now, let's try parsing the whole body as fallback
         // contentArea = $('body'); // Less reliable
         return { type: "text", content: "Could not find main content area to parse.", imageUrls: [] };
    }

    // --- Strategy 1: Tables ---
    const worthTable = contentArea.find('table.wikitable, table.article-table').first(); // Process first likely table

    if (worthTable.length > 0) {
        const rows = worthTable.find('tr');
        if (rows.length > 1) { // Need at least header + data row
            const headerRow = rows.first();
            const headers = headerRow.find('th, td').map((i, el) => $(el).text().trim()).get();

            const dataRowsTr = rows.slice(1); // All rows except the first (header)

            // --- Extract images from the first data row ---
            const firstDataRow = dataRowsTr.first();
            const numColumns = headers.length > 0 ? headers.length : firstDataRow.find('td, th').length;
            const imageCells = firstDataRow.find('td, th');

            for (let i = 0; i < numColumns; i++) {
                let cellImageUrl = null;
                if (i < imageCells.length) {
                    const imgTag = $(imageCells[i]).find('img').first(); // Find first img in cell
                    if (imgTag.length > 0) {
                        // Prioritize data-src, fallback to src
                        cellImageUrl = imgTag.attr('data-src') || imgTag.attr('src');
                        // Clean URL
                        if (cellImageUrl && cellImageUrl.includes('/scale-to-width-down/')) {
                            cellImageUrl = cellImageUrl.split('/scale-to-width-down/')[0];
                        }
                    }
                }
                imageUrls.push(cellImageUrl); // Append URL or null
            }
             console.log(`Extracted image URLs (aligned with columns): ${imageUrls}`);

            // --- Extract text data from relevant rows ---
             const textDataRowsTr = (imageUrls.length > 0 && imageUrls.some(url => url !== null)) ? dataRowsTr.slice(1) : dataRowsTr; // Skip first row if it contained images
             let extractedRowsData = [];

             textDataRowsTr.each((rowIndex, rowElement) => {
                 let rowCellsText = [];
                 $(rowElement).find('td, th').each((cellIndex, cellElement) => {
                     // Get text, clean whitespace, handle multiple paragraphs/elements within cell
                     let cellText = $(cellElement).text().replace(/\s+/g, ' ').trim();
                     rowCellsText.push(cellText);
                 });
                 if (rowCellsText.some(text => text)) { // Only add if row has content
                    extractedRowsData.push(rowCellsText);
                 }
             });

             // Check if we actually extracted table data worth returning
             if (headers.length > 0 || extractedRowsData.length > 0) {
                 console.log(`Returning structured table data: Headers=${headers.length}, Rows=${extractedRowsData.length}, Images=${imageUrls.length}`);
                 return { type: "table", headers: headers, rows: extractedRowsData, imageUrls: imageUrls };
             }
        }
    }

     // --- Strategy 2: Paragraphs (Fallback if no table data extracted) ---
     console.log("No table data extracted or table empty, searching paragraphs...");
     contentArea.find('p').slice(0, 10).each((i, el) => {
         const pText = $(el).text().replace(/\s+/g, ' ').trim();
         const pTextLower = pText.toLowerCase();
         if (pText && (pTextLower.includes("worth") || pTextLower.includes("value") || pTextLower.includes("den beta") || pTextLower.includes("diamond") || pTextLower.includes("collar") || pTextLower.includes("wrist"))) {
             worthInfoLines.push(pText);
         }
     });

     // --- Strategy 3: Last resort - First paragraph ---
     if (worthInfoLines.length === 0) {
         console.log("No specific worth indicators found. Grabbing first paragraph.");
         const firstP = contentArea.find('p').first().text().replace(/\s+/g, ' ').trim();
         if (firstP) {
             worthInfoLines.push(`[General Info:] ${firstP}`);
         }
     }

    // Return as text if strategies 2/3 yielded results
    const finalText = worthInfoLines.join('\n\n') || "Could not extract specific worth details from the page structure.";
    console.log("Returning data as simple text.");
    return { type: "text", content: finalText, imageUrls: [] }; // No images associated with paragraph text
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
  try {
    const htmlContent = await fetchPageContent(pageUrl);
    const details = extractWorthDetails(htmlContent);
    details.source_url = pageUrl; // Add source URL back
    return details; // Send details object back to renderer
  } catch (error) {
    console.error(`IPC Error during details fetch for "${pageUrl}":`, error);
    throw new Error(error.message || "Failed to get page details.");
  }
}


function createWindow () {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
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
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  setupIpcHandlers(); // Set up IPC listeners
  createWindow();

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
