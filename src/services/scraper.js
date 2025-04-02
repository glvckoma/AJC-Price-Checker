// src/services/scraper.js
const axios = require('axios');
const cheerio = require('cheerio');
const url = require('url');

// Constants
const BASE_URL = "https://aj-item-worth.fandom.com";
const SEARCH_PATH = "/wiki/Special:Search";
const HEADERS = {
    // Use a realistic User-Agent
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
    'Accept-Language': 'en-US,en;q=0.9',
};
const REQUEST_TIMEOUT = 25000; // Milliseconds

// --- Public API ---

/**
 * Searches the wiki for a given term.
 * @param {string} searchTerm - The term to search for.
 * @returns {Promise<Array<{title: string, url: string}>>} - A promise resolving to an array of search results.
 */
async function searchForItems(searchTerm) {
  console.log(`Scraper: Searching for "${searchTerm}"`);
  const searchUrl = `${BASE_URL}${SEARCH_PATH}?query=${encodeURIComponent(searchTerm)}&scope=internal&navigationSearch=true`;
  const htmlContent = await fetchPageContent(searchUrl);
  return parseSearchResults(htmlContent);
}

/**
 * Fetches and parses the details for a specific item page URL.
 * @param {string} pageUrl - The URL of the item page.
 * @returns {Promise<{sections: Array<object>, source_url: string}>} - A promise resolving to the parsed sections and source URL.
 */
async function getItemDetails(pageUrl) {
  console.log(`Scraper: Getting details for "${pageUrl}"`);
  // Basic validation
  if (!pageUrl || !pageUrl.startsWith(BASE_URL)) {
       console.error(`Scraper Error: Invalid page URL received: ${pageUrl}`);
       throw new Error(`Invalid page URL provided.`);
  }

  const htmlContent = await fetchPageContent(pageUrl);
  const sections = extractWorthDetails(htmlContent, pageUrl);

  // Add an extra check here: if extractWorthDetails somehow returned non-array, force error
  if (!Array.isArray(sections)) {
      console.error(`Parser function extractWorthDetails did not return an array for ${pageUrl}!`);
      throw new Error("Internal parser error: Invalid data format returned.");
  }

  return { sections: sections, source_url: pageUrl };
}

// --- Internal Helper Functions ---

/**
 * Fetches the HTML content of a given URL.
 * @param {string} targetUrl - The URL to fetch.
 * @returns {Promise<string>} - A promise resolving to the HTML content.
 * @throws {Error} - Throws an error if the network request fails.
 */
async function fetchPageContent(targetUrl) {
    console.log(`Fetching: ${targetUrl}`);
    try {
        const response = await axios.get(targetUrl, {
            headers: HEADERS,
            timeout: REQUEST_TIMEOUT,
            maxRedirects: 5,
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
        // Rethrow a simpler error
        throw new Error(`Network Error fetching page: ${error.message}`);
    }
}

/**
 * Parses search result links from the search results page HTML.
 * @param {string} htmlContent - The HTML content of the search results page.
 * @returns {Array<{title: string, url: string}>} - An array of search result objects.
 */
function parseSearchResults(htmlContent) {
    console.log("Parsing search results...");
    const $ = cheerio.load(htmlContent);
    const results = [];
    $('ul.unified-search__results li.unified-search__result').slice(0, 15).each((index, element) => {
        const linkTag = $(element).find('article h3.unified-search__result__header a.unified-search__result__title');
        const title = linkTag.text().trim();
        const relativeUrl = linkTag.attr('href');

        if (title && relativeUrl) {
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

/**
 * Extracts worth details (tables, images, text) from item page HTML, handling multiple sections.
 * @param {string} htmlContent - The HTML content of the item page.
 * @param {string} pageUrl - The URL of the page being parsed (for logging).
 * @returns {Array<object>} - An array of section objects (type: 'table' or 'text').
 */
function extractWorthDetails(htmlContent, pageUrl) {
    console.log(`Parsing item details for multiple sections on page: ${pageUrl}`);
    const $ = cheerio.load(htmlContent);
    const sections = [];

    const contentArea = $('div.mw-parser-output');
    if (contentArea.length === 0) {
        console.warn("Warning: Could not find main content area (div.mw-parser-output).");
        sections.push({ type: "text", title: "Error", content: "Could not find main content area to parse." });
        return sections;
    }

    contentArea.find('h2').each((index, h2Element) => {
        const sectionTitle = $(h2Element).find('.mw-headline').text().trim();
        if (!sectionTitle) return;

        console.log(`Found section header: ${sectionTitle}`);
        let worthTable = null;
        let currentNode = $(h2Element).next();
        while (currentNode.length > 0 && !currentNode.is('h2')) {
            if (currentNode.is('table.wikitable, table.article-table')) {
                worthTable = currentNode;
                break;
            }
            const foundTable = currentNode.find('table.wikitable, table.article-table').first();
            if (foundTable.length > 0) {
                worthTable = foundTable;
                break;
            }
            currentNode = currentNode.next();
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
                const dataRowsTr = rows.slice(1);
                let imageRowIndex = -1;

                dataRowsTr.each((rowIndex, rowElement) => {
                    if ($(rowElement).find('img').length > 0) {
                        imageRowIndex = rowIndex;
                        const numColumns = headers.length > 0 ? headers.length : $(rowElement).find('td, th').length;
                        const imageCells = $(rowElement).find('td, th');
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
                        return false;
                    }
                });

                dataRowsTr.each((rowIndex, rowElement) => {
                    if (rowIndex === imageRowIndex) return;
                    let rowCellsText = [];
                    $(rowElement).find('td, th').each((cellIndex, cellElement) => {
                        // Get text content directly, preserving text within links
                        let cellText = $(cellElement).text().replace(/\s+/g, ' ').trim();
                        rowCellsText.push(cellText);
                    });
                    if (rowCellsText.some(text => text)) {
                        tableRowsData.push(rowCellsText);
                    }
                });
            }

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
        }
    });

    if (sections.length === 0) {
         console.log("No sections found via H2, trying global table search...");
         const worthTable = contentArea.find('table.wikitable, table.article-table').first();
         if (worthTable.length > 0) {
             console.log("Found global fallback table.");
             const rows = worthTable.find('tr');
             let headers = []; let tableRowsData = []; let tableImageUrls = [];
             if (rows.length > 0) {
                 const headerRow = rows.first();
                 headers = headerRow.find('th, td').map((i, el) => $(el).text().trim()).get();
                 const dataRowsTr = rows.slice(1);
                 let imageRowIndex = -1;
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
                         return false;
                     }
                 });
                 dataRowsTr.each((rowIndex, rowElement) => {
                     if (rowIndex === imageRowIndex) return;
                     let rowCellsText = [];
                     $(rowElement).find('td, th').each((cellIndex, cellElement) => {
                         // Get text content directly, preserving text within links
                         let cellText = $(cellElement).text().replace(/\s+/g, ' ').trim();
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

     if (sections.length === 0) {
         console.log("No tables found, searching relevant paragraphs...");
         let paragraphText = [];
         contentArea.find('p').slice(0, 10).each((i, el) => {
             const pText = $(el).text().replace(/\s+/g, ' ').trim();
             const pTextLower = pText.toLowerCase();
             if (pText && (pTextLower.includes("worth") || pTextLower.includes("value") || pTextLower.includes("den beta") || pTextLower.includes("diamond") || pTextLower.includes("collar") || pTextLower.includes("wrist") || pTextLower.includes("spike") || pTextLower.includes("headdress") || pTextLower.includes("party hat"))) {
                 console.log(`Found relevant paragraph: ${pText.substring(0, 50)}...`);
                 paragraphText.push(pText);
             }
         });
         if (paragraphText.length === 0) {
             console.log("No keyword paragraphs found, grabbing first paragraph.");
             const firstP = contentArea.find('p').first().text().replace(/\s+/g, ' ').trim();
             if (firstP) {
                 paragraphText.push(`[General Info:] ${firstP}`);
             } else {
                 console.log("Could not find even the first paragraph.");
             }
         }
         if (paragraphText.length > 0) {
             console.log("Adding extracted paragraphs as a text section.");
             sections.push({ type: "text", title: "Worth Information", content: paragraphText.join('\n\n') });
         } else {
             console.log("No relevant paragraphs found to add as fallback.");
         }
     }

    if (sections.length === 0) {
        console.warn(`Parser found no structured content (tables or paragraphs) on ${pageUrl}. Returning 'Not Found'.`);
        sections.push({ type: "text", title: "Not Found", content: "Could not extract specific worth details from the page structure." });
    }

    console.log(`Returning ${sections.length} sections from parser for ${pageUrl}.`);
    return sections;
}

// Export the public functions
module.exports = {
  searchForItems,
  getItemDetails
};
