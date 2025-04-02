// Electron renderer process JavaScript
console.log('Renderer process started.');

const searchInput = document.getElementById('searchInput');
const searchButton = document.getElementById('searchButton');
const statusBar = document.getElementById('statusBar');
const resultsList = document.getElementById('resultsList');
const detailsArea = document.getElementById('detailsArea');

const API_BASE_URL = 'http://localhost:5000'; // Assuming Flask runs on default port

// --- Event Listeners ---

searchButton.addEventListener('click', handleSearch);
// Allow searching by pressing Enter in the input field
searchInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        handleSearch();
    }
});

// Use event delegation for clicks on results list items
resultsList.addEventListener('click', handleResultClick);

// --- Handler Functions ---

async function handleSearch() {
    const searchTerm = searchInput.value.trim();
    if (!searchTerm) {
        updateStatus('Please enter an item name.', true);
        return;
    }

    updateStatus(`Searching for "${searchTerm}"...`);
    clearResultsAndDetails();
    setControlsEnabled(false);

    try {
        const response = await fetch(`${API_BASE_URL}/search?item=${encodeURIComponent(searchTerm)}`);

        if (!response.ok) {
            // Try to get error message from API response body
            let errorMsg = `API Error: ${response.status} ${response.statusText}`;
            try {
                const errorData = await response.json();
                errorMsg = `API Error: ${errorData.error || response.statusText}`;
            } catch (jsonError) {
                // Ignore if response body is not JSON
            }
            throw new Error(errorMsg);
        }

        const results = await response.json();
        displayResults(results);
        updateStatus(results.length > 0 ? `Found ${results.length} results.` : 'No results found.');

    } catch (error) {
        console.error('Search Error:', error);
        updateStatus(`Search failed: ${error.message}`, true);
    } finally {
        setControlsEnabled(true);
    }
}

async function handleResultClick(event) {
    // Check if the clicked element is an LI or inside an LI
    const listItem = event.target.closest('li');
    if (!listItem || !listItem.dataset.url) {
        return; // Clicked on the list itself or an item without a URL
    }

    const pageUrl = listItem.dataset.url;
    const pageTitle = listItem.textContent; // Get title from the list item text

    updateStatus(`Fetching details for "${pageTitle}"...`);
    detailsArea.textContent = ''; // Clear previous details
    setControlsEnabled(false);

    try {
        const response = await fetch(`${API_BASE_URL}/details?page=${encodeURIComponent(pageUrl)}`);

        if (!response.ok) {
            let errorMsg = `API Error: ${response.status} ${response.statusText}`;
             try {
                const errorData = await response.json();
                errorMsg = `API Error: ${errorData.error || response.statusText}`;
            } catch (jsonError) { }
            throw new Error(errorMsg);
        }

        const details = await response.json();
        displayDetails(details);
        updateStatus('Details loaded.');

    } catch (error) {
        console.error('Details Fetch Error:', error);
        updateStatus(`Failed to fetch details: ${error.message}`, true);
        detailsArea.textContent = `Error fetching details:\n${error.message}`; // Show error in details area too
    } finally {
        setControlsEnabled(true);
    }
}


// --- UI Update Functions ---

function updateStatus(message, isError = false) {
    statusBar.textContent = `Status: ${message}`;
    statusBar.style.color = isError ? 'red' : '#666'; // Simple error indication
    console.log(`Status Update: ${message}`);
}

function clearResultsAndDetails() {
    resultsList.innerHTML = ''; // Clear previous results
    detailsArea.textContent = ''; // Clear previous details
}

function displayResults(results) {
    resultsList.innerHTML = ''; // Clear previous results
    if (!results || results.length === 0) {
        // Handled by status update, but could add a message here if desired
        return;
    }

    results.forEach(result => {
        const li = document.createElement('li');
        li.textContent = result.title;
        li.dataset.url = result.url; // Store the URL to fetch details later
        li.title = `Click to view details for: ${result.title}\nURL: ${result.url}`; // Tooltip
        resultsList.appendChild(li);
    });
}

function displayDetails(details) {
    detailsArea.innerHTML = ''; // Clear previous content

    if (!details) {
        detailsArea.textContent = 'Error: Received no details data.';
        return;
    }

    // Check the type of data received from the API
    if (details.type === 'table' && details.headers && details.rows) {
        // Render as HTML table
        const table = document.createElement('table');
        // Add Tailwind classes for basic table styling
        table.className = "w-full border-collapse border border-gray-300 text-xs"; // Full width, borders, small text
        const thead = document.createElement('thead');
        const tbody = document.createElement('tbody'); // Create tbody first

        // --- Create Image Row (if images exist) ---
        if (details.imageUrls && details.imageUrls.length > 0 && details.imageUrls.some(url => url !== null)) {
             const imageRow = document.createElement('tr');
             imageRow.className = "bg-white dark:bg-gray-700"; // Match background

             // Add empty cell if headers are shorter or align images with headers
             const imageCellsToAdd = details.headers.length > 0 ? details.headers.length : details.imageUrls.length;

             for (let i = 0; i < imageCellsToAdd; i++) {
                 const td = document.createElement('td');
                 td.className = "p-1 border border-gray-300 dark:border-gray-600 text-center align-middle"; // Padding, border, centering

                 const imageUrl = details.imageUrls[i]; // Get corresponding image URL (might be undefined/null)
                 if (imageUrl) {
                     const img = document.createElement('img');
                     img.src = imageUrl;
                     img.alt = "Item Variant";
                     // Smaller image size, centered within the cell
                     img.className = "inline-block max-h-16 object-contain"; // Adjust max-h-XX as needed
                     td.appendChild(img);
                 } else {
                     td.innerHTML = '&nbsp;'; // Add space for empty cells
                 }
                 imageRow.appendChild(td);
             }
             tbody.appendChild(imageRow); // Add image row to the top of tbody
        }


        // Create header row
        if (details.headers.length > 0) {
            // const thead = document.createElement('thead'); // REMOVED duplicate declaration
            thead.className = "bg-gray-100"; // Header background
            const headerRow = document.createElement('tr');
            details.headers.forEach(headerText => {
                const th = document.createElement('th');
                th.textContent = headerText;
                th.className = "border border-gray-300 p-2 text-left font-semibold"; // Borders, padding, alignment
                headerRow.appendChild(th);
            });
            thead.appendChild(headerRow);
            table.appendChild(thead); // Append thead to table
        }

        // Create data rows (these go *after* the potential image row in tbody)
        details.rows.forEach(rowData => {
            const dataRow = document.createElement('tr');
            // Apply dark mode striping directly here
            dataRow.className = "even:bg-white odd:bg-gray-50 dark:even:bg-gray-700 dark:odd:bg-gray-600";
            rowData.forEach(cellText => {
                const td = document.createElement('td');
                td.textContent = cellText;
                td.className = "border border-gray-300 p-2 align-top"; // Borders, padding, vertical alignment
                dataRow.appendChild(td);
            });
            tbody.appendChild(dataRow);
        });
        table.appendChild(tbody); // Append tbody to table
        detailsArea.appendChild(table);

    } else if (details.type === 'text' && details.content) {
        // Render as plain text (preserve formatting)
        const pre = document.createElement('pre');
        pre.className = "whitespace-pre-wrap break-words"; // Ensure text wraps
        pre.textContent = details.content;
        detailsArea.appendChild(pre);
    } else if (details.worth) { // Fallback for old format just in case
         const pre = document.createElement('pre');
         pre.textContent = details.worth;
         detailsArea.appendChild(pre);
    }
     else {
        detailsArea.textContent = 'Could not display details in a known format.';
    }

    // Add the source URL at the end
    if (details.source_url) {
        const sourceP = document.createElement('p');
        sourceP.className = 'source-url'; // Add class for styling
        sourceP.textContent = `Source: ${details.source_url}`;
        detailsArea.appendChild(sourceP);
    }
}


function setControlsEnabled(enabled) {
    searchInput.disabled = !enabled;
    searchButton.disabled = !enabled;
    // Optionally disable results list during fetch? Maybe not necessary.
    // resultsList.style.pointerEvents = enabled ? 'auto' : 'none';
}

// Initial status
updateStatus('Ready. Enter an item name.');
