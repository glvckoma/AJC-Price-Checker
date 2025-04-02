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

// const API_BASE_URL = 'http://localhost:5000'; // No longer needed

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
        // Use IPC invoke to call the main process handler
        const results = await window.ipcApi.invoke('search-wiki', searchTerm);
        displayResults(results);
        updateStatus(results.length > 0 ? `Found ${results.length} results.` : 'No results found.');

    } catch (error) {
        // Errors from invoke (including rejections from main process) land here
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
         // Use IPC invoke to call the main process handler
        const details = await window.ipcApi.invoke('get-page-details', pageUrl);
        displayDetails(details);
        updateStatus('Details loaded.');

    } catch (error) {
        // Errors from invoke (including rejections from main process) land here
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

function displayDetails(sections) { // Expecting an array of sections now
    detailsArea.innerHTML = ''; // Clear previous content

    if (!Array.isArray(sections) || sections.length === 0) {
        detailsArea.textContent = 'Error: Received no details data or invalid format.';
        return;
    }

    let sourceUrl = null; // Keep track of the source URL

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

        // Keep track of the source URL from the last section processed
        if (section.source_url) {
            sourceUrl = section.source_url;
        }
    }); // End loop through sections

    // Add the source URL hyperlink at the very end
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
        sourceP.appendChild(document.createTextNode('Source: ')); // Add the text node first
        sourceP.appendChild(sourceLink); // Then append the link
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
