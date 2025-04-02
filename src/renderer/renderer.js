// Electron renderer process JavaScript
console.log('Renderer process started.');

const searchInput = document.getElementById('searchInput');
const searchButton = document.getElementById('searchButton');
const statusBar = document.getElementById('statusBar');
const resultsList = document.getElementById('resultsList');
const detailsArea = document.getElementById('detailsArea');
const imageModal = document.getElementById('imageModal');
const modalImage = document.getElementById('modalImage');
const closeModalButton = document.getElementById('closeModalButton');

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

// Event listener for closing the modal
closeModalButton.addEventListener('click', () => {
    imageModal.classList.add('hidden');
    modalImage.src = ''; // Clear image src
});
// Also close modal if clicking the background overlay
imageModal.addEventListener('click', (event) => {
    if (event.target === imageModal) { // Check if click was directly on the overlay
        imageModal.classList.add('hidden');
        modalImage.src = '';
    }
});

// Add listener for status bar click (for update notification)
statusBar.addEventListener('click', () => {
    if (currentStatusState === 'update_available') {
        console.log('Update available status clicked, triggering download...');
        // Ask main process to trigger the download (open releases page)
        window.ipcApi.triggerUpdateDownload();
        // Optionally reset status after click, or leave it until next action
        // updateStatus('Update download page opened.', 'info'); // Example reset
    }
});

// Listen for status updates pushed from the main process (e.g., update available)
window.ipcApi.onUpdateStatus((_event, data) => {
    console.log('Received status update from main:', data);
    if (data.statusType === 'update_available') {
        updateStatus(data.message, 'update_available');
    }
    // Add more status types here if needed
});


// --- Handler Functions ---

async function handleSearch() {
    const searchTerm = searchInput.value.trim();
    if (!searchTerm) {
        updateStatus('Please enter an item name.', 'error'); // Use 'error' state
        return;
    }

    updateStatus(`Searching for "${searchTerm}"...`, 'searching'); // Use 'searching' state
    clearResultsAndDetails();
    setControlsEnabled(false);

    try {
        // Use IPC invoke to call the main process handler
        const results = await window.ipcApi.invoke('search-wiki', searchTerm);
        displayResults(results);
        // Determine state based on results
        const statusState = results.length > 0 ? 'success' : 'no_results';
        const statusMessage = results.length > 0 ? `Found ${results.length} results.` : 'No results found.';
        updateStatus(statusMessage, statusState);

    } catch (error) {
        // Errors from invoke (including rejections from main process) land here
        console.error('Search Error:', error);
        updateStatus(`Search failed: ${error.message}`, 'error'); // Use 'error' state
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

    updateStatus(`Fetching details for "${pageTitle}"...`, 'fetching'); // Use 'fetching' state
    detailsArea.textContent = ''; // Clear previous details
    setControlsEnabled(false);

    try {
         // Use IPC invoke to call the main process handler
        const response = await window.ipcApi.invoke('get-page-details', pageUrl); // Get the whole response object

        // --- DETAILED LOGGING ---
        console.log('Received response from main process:', response);
        if (response && response.sections) {
            console.log(`Received ${response.sections.length} sections. First section type: ${response.sections[0]?.type}, title: ${response.sections[0]?.title}`);
        } else {
            console.warn('Received invalid or empty response structure:', response);
        }
        // --- END LOGGING ---

        // Check for specific error section returned by main process
        if (response && Array.isArray(response.sections) && response.sections[0]?.title === "Error") {
             throw new Error(response.sections[0].content || "Failed to get details.");
        }

        if (response && Array.isArray(response.sections)) { // Check if sections is an array
            displayDetails(response.sections, response.source_url); // Pass sections and source_url separately
            updateStatus('Details loaded.', 'success'); // Use 'success' state
        } else {
             // Throw a more specific error if the structure is wrong
             throw new Error(`Invalid data structure received from main process. Expected { sections: [], ... }, got: ${JSON.stringify(response)}`);
        }

    } catch (error) {
        // Errors from invoke (including rejections from main process) land here
        console.error('Details Fetch Error:', error);
        const errorMessage = `Failed to fetch details: ${error.message}`;
        updateStatus(errorMessage, 'error'); // Use 'error' state
        // Ensure error message is displayed using textContent to prevent HTML injection
        detailsArea.textContent = errorMessage;
    } finally {
        setControlsEnabled(true);
    }
}


// --- UI Update Functions ---

// Define status styles using Tailwind classes
const STATUS_STYLES = {
  ready: 'text-gray-600 dark:text-gray-400',
  searching: 'text-yellow-600 dark:text-yellow-400',
  fetching: 'text-blue-600 dark:text-blue-400',
  success: 'text-green-600 dark:text-green-400',
  no_results: 'text-gray-500 dark:text-gray-500',
  error: 'text-red-600 dark:text-red-400',
  update_available: 'text-purple-600 dark:text-purple-400 cursor-pointer hover:underline',
};

// Keep track of the current status state
let currentStatusState = 'ready';

/**
 * Updates the status bar text and applies styling based on the state.
 * @param {string} message - The message to display.
 * @param {keyof STATUS_STYLES} state - The state key ('ready', 'searching', 'error', etc.).
 */
function updateStatus(message, state = 'ready') {
    // Ensure state is valid, default to 'ready' if not
    if (!STATUS_STYLES[state]) {
        console.warn(`Invalid status state provided: ${state}. Defaulting to 'ready'.`);
        state = 'ready';
    }

    currentStatusState = state; // Update global state tracker

    statusBar.textContent = `Status: ${message}`;
    console.log(`Status Update (${state}): ${message}`);

    // Remove previous state classes before adding the new one
    Object.values(STATUS_STYLES).forEach(className => {
        // Split potentially multiple classes in the string
        className.split(' ').forEach(cls => {
            if (cls) statusBar.classList.remove(cls);
        });
    });

    // Add the classes for the new state
    STATUS_STYLES[state].split(' ').forEach(cls => {
        if (cls) statusBar.classList.add(cls);
    });
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

// Updated function signature to accept sourceUrl
function displayDetails(sections, sourceUrl) {
    detailsArea.innerHTML = ''; // Clear previous content

    if (!Array.isArray(sections) || sections.length === 0) {
        detailsArea.textContent = 'Error: Received no details data or invalid format.';
        return;
    }

    // No longer need to track sourceUrl within the loop

    sections.forEach(section => {
        // Add Section Title
        if (section.title && section.title !== "Worth Details") { // Avoid redundant default title
            const titleEl = document.createElement('h3');
            // Added margin-top, skip first title's top margin
            titleEl.className = "text-md font-semibold mt-4 mb-2 dark:text-gray-300 first:mt-0";
            titleEl.textContent = section.title;
            detailsArea.appendChild(titleEl);
        }

        // Render Table Section
        if (section.type === 'table' && section.headers && section.rows) {
            const table = document.createElement('table');
            table.className = "w-full border-collapse border border-gray-300 dark:border-gray-600 text-xs mb-2"; // Added mb-2
            const thead = document.createElement('thead');
            const tbody = document.createElement('tbody');

            // --- Create Image Row ---
            if (section.imageUrls && section.imageUrls.length > 0 && section.imageUrls.some(url => url !== null)) {
                 const imageRow = document.createElement('tr');
                 imageRow.className = "bg-white dark:bg-gray-700";
                 const imageCellsToAdd = section.headers.length > 0 ? section.headers.length : section.imageUrls.length;
                 for (let i = 0; i < imageCellsToAdd; i++) {
                     const td = document.createElement('td');
                     td.className = "p-1 border border-gray-300 dark:border-gray-600 text-center align-middle";
                     const imageUrl = section.imageUrls[i];
                     if (imageUrl) {
                         const img = document.createElement('img');
                         img.src = imageUrl;
                         img.alt = section.headers[i] || "Item Variant"; // Use header as alt text if available
                         img.className = "inline-block max-h-16 object-contain cursor-pointer hover:opacity-80 transition-opacity"; // Added hover effect
                         img.addEventListener('click', () => {
                             modalImage.src = imageUrl; // Set modal image source
                             imageModal.classList.remove('hidden'); // Show modal
                         });
                         td.appendChild(img);
                     } else {
                         td.innerHTML = '&nbsp;'; // Keep empty cell for alignment
                     }
                     imageRow.appendChild(td);
                 }
                 tbody.appendChild(imageRow);
            }

            // --- Create Header Row ---
            if (section.headers.length > 0) {
                thead.className = "bg-gray-100 dark:bg-gray-600"; // Dark mode header bg
                const headerRow = document.createElement('tr');
                section.headers.forEach(headerText => {
                    const th = document.createElement('th');
                    th.textContent = headerText;
                    th.className = "border border-gray-300 dark:border-gray-600 p-2 text-left font-semibold";
                    headerRow.appendChild(th);
                });
                thead.appendChild(headerRow);
                table.appendChild(thead);
            }

            // --- Create Data Rows ---
            section.rows.forEach(rowData => {
                const dataRow = document.createElement('tr');
                dataRow.className = "even:bg-white odd:bg-gray-50 dark:even:bg-gray-700 dark:odd:bg-gray-600";
                rowData.forEach(cellText => {
                    const td = document.createElement('td');
                    td.textContent = cellText;
                    td.className = "border border-gray-300 dark:border-gray-600 p-2 align-top";
                    dataRow.appendChild(td);
                });
                tbody.appendChild(dataRow);
            });
            table.appendChild(tbody);
            detailsArea.appendChild(table);

        // Render Text Section
        } else if (section.type === 'text' && section.content) {
            const pre = document.createElement('pre');
            pre.className = "whitespace-pre-wrap break-words text-sm"; // Added text-sm
            pre.textContent = section.content;
            detailsArea.appendChild(pre);
        }

        // No longer need to track source_url here
        // if (section.source_url) {
        //     sourceUrl = section.source_url;
        // }
    }); // End loop through sections

    // Add the source URL hyperlink at the very end (using the passed argument)
    if (sourceUrl) {
        const sourceP = document.createElement('p');
        sourceP.className = 'source-url mt-4'; // Added margin-top
        const sourceLink = document.createElement('a');
        sourceLink.href = '#'; // Prevent default link behavior
        sourceLink.textContent = sourceUrl;
        sourceLink.className = "text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"; // Added cursor-pointer
        // sourceLink.target = "_blank"; // No longer needed
        sourceLink.addEventListener('click', (event) => {
            event.preventDefault(); // Prevent navigating to '#'
            window.ipcApi.openExternalLink(sourceUrl); // Use exposed API
        });
        sourceP.appendChild(document.createTextNode('Source: ')); // Add the text node
        sourceP.appendChild(sourceLink); // Append the link after the text
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
updateStatus('Ready. Enter an item name.', 'ready'); // Use 'ready' state
