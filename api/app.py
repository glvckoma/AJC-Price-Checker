# Python Backend API using Flask
import requests
from bs4 import BeautifulSoup
import time
from urllib.parse import urljoin, quote
import traceback
from flask import Flask, request, jsonify

# --- Configuration ---
BASE_URL = "https://aj-item-worth.fandom.com"
SEARCH_PATH = "/wiki/Special:Search"
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
}
REQUEST_DELAY = 1 # Delay between requests
REQUEST_TIMEOUT = 25 # Seconds

app = Flask(__name__)

# --- Helper Functions (Adapted from aj_search_gui.py Workers) ---

def _fetch_page_content(url):
    """Fetches HTML content, returns text or raises RuntimeError on error."""
    print(f"Fetching: {url}")
    try:
        response = requests.get(url, headers=HEADERS, timeout=REQUEST_TIMEOUT, verify=True)
        response.raise_for_status() # Raises HTTPError for bad responses (4xx or 5xx)
        print(f"Success. Waiting {REQUEST_DELAY}s...")
        time.sleep(REQUEST_DELAY)
        return response.text
    except requests.exceptions.SSLError as ssl_err:
        print(f"SSL Error fetching {url}: {ssl_err}")
        raise RuntimeError(f"SSL Certificate Verification Error. Check internet connection and firewall/antivirus.") from ssl_err
    except requests.exceptions.RequestException as e:
        print(f"Network Error fetching {url}: {e}")
        raise RuntimeError(f"Network Error: {e}") from e

def _parse_search_results(html_content):
    """Parses search results HTML, returns list of {'title': str, 'url': str}."""
    print("Parsing search results...")
    soup = BeautifulSoup(html_content, 'html.parser')
    results = []
    result_list = soup.find('ul', class_='unified-search__results')

    if not result_list:
        print("Could not find search result list (ul.unified-search__results).")
        return []

    list_items = result_list.find_all('li', class_='unified-search__result', limit=15)
    for item in list_items:
        article_tag = item.find('article')
        if article_tag:
            h3_tag = article_tag.find('h3', class_='unified-search__result__header')
            if h3_tag:
                link_tag = h3_tag.find('a', class_='unified-search__result__title')
                if link_tag and link_tag.has_attr('href'):
                    title = link_tag.get_text(strip=True)
                    relative_url = link_tag['href']
                    absolute_url = urljoin(BASE_URL, relative_url)
                    results.append({'title': title, 'url': absolute_url})

    if not results and list_items:
         print("Warning: Found search items but couldn't extract links/titles. Selectors might need update.")

    print(f"Found {len(results)} potential results.")
    return results

def _extract_worth_details(html_content):
    """Parses item page HTML, returns dictionary with type, content/table data, and optional image URL."""
    print("Parsing item details...")
    soup = BeautifulSoup(html_content, 'html.parser')
    worth_info_lines = []
    image_url = None # Initialize image URL

    content_area = soup.find('div', class_='mw-parser-output')
    if not content_area:
        print("Warning: Could not find main content area (div.mw-parser-output). Parsing whole page.")
        content_area = soup # Fallback

    # --- Image extraction logic moved inside table parsing ---

    # Strategy 1: Tables
    worth_tables = content_area.find_all('table', class_=['wikitable', 'article-table'])
    if worth_tables:
        for table in worth_tables:
            rows = table.find_all('tr')
            if not rows: continue
            data_rows = rows[1:] # Simple header skip
            for row in data_rows:
                row_text = row.get_text(" ", strip=True).lower()
                cells = row.find_all(['td', 'th'])
                # Check for common worth indicators
                if "den beta" in row_text or "diamond" in row_text or "collar" in row_text or "wrist" in row_text or "bad" in row_text or "good" in row_text or "best" in row_text or "decent" in row_text:
                    cell_texts = [cell.get_text(" ", strip=True).replace('\n', ' ').replace('\r', '').strip() for cell in cells if cell.get_text(strip=True)]
                    if cell_texts:
                        worth_info_lines.append(f"- {' | '.join(cell_texts)}")

    # Strategy 2: Paragraphs (Only if no specific table rows found)
    if not worth_info_lines:
        paragraphs = content_area.find_all('p', limit=10)
        found_para_worth = False
        for p in paragraphs:
            p_text = p.get_text(" ", strip=True)
            p_text_lower = p_text.lower()
            if "worth" in p_text_lower or "value" in p_text_lower or "den beta" in p_text_lower or "diamond" in p_text_lower or "collar" in p_text_lower or "wrist" in p_text_lower:
               worth_info_lines.append(f"\n[Info from Paragraph:]\n{p_text}\n")
               found_para_worth = True
               if len(worth_info_lines) > 5: break # Limit paragraphs

        # Strategy 3: Last resort - First paragraph (Only if NOTHING else found)
        if not found_para_worth:
            first_p = content_area.find('p')
            if first_p:
                worth_info_lines.append(f"\n[General Info:]\n{first_p.get_text(' ', strip=True)}")

    details_text = "\n".join(worth_info_lines).strip()
    # Determine return type based on what was found
    if worth_info_lines and any('|' in line for line in worth_info_lines): # Heuristic: Table rows likely contain '|' from join
        # Attempt to reconstruct table structure (Simplified: assumes first row is header)
        # This is a basic reconstruction and might need refinement based on actual table structures
        try:
            headers = []
            rows_data = []
            # Find the table again (could optimize by passing table object)
            worth_tables = content_area.find_all('table', class_=['wikitable', 'article-table'])
            if worth_tables:
                table = worth_tables[0] # Process the first likely table
                header_row = table.find('tr')
                if header_row:
                    headers = [th.get_text(" ", strip=True) for th in header_row.find_all(['th', 'td'])] # Allow td in header row too

                data_rows_tr = table.find_all('tr')[1:] # Skip header row

                # --- Extract images from the first data row (more robustly) ---
                image_urls = [] # Re-initialize for this table
                if data_rows_tr:
                    first_data_row = data_rows_tr[0]
                    # Iterate through the expected number of columns based on headers, or cells if no headers
                    num_columns = len(headers) if headers else len(first_data_row.find_all(['td', 'th']))
                    image_cells = first_data_row.find_all(['td', 'th'])

                    for i in range(num_columns):
                        cell_image_url = None # Default to None
                        if i < len(image_cells): # Check if cell exists
                            cell = image_cells[i]
                            # Look deeper for img tag, potentially inside figure or a tags
                            img_tag = cell.find('img')
                            if img_tag:
                                # Prioritize data-src for lazy loading, fallback to src
                                cell_image_url = img_tag.get('data-src') or img_tag.get('src')
                                # Clean URL
                                if cell_image_url and '/scale-to-width-down/' in cell_image_url:
                                    cell_image_url = cell_image_url.split('/scale-to-width-down/')[0]
                        image_urls.append(cell_image_url) # Append URL or None for this column index

                    print(f"Extracted image URLs (aligned with columns): {image_urls}")

                # --- Extract text data from all data rows (excluding the first if it was images) ---
                # Decide if the first row was *only* images or also text worth keeping
                # Simple approach: Assume first row is images if we found any, skip its text
                text_data_rows_tr = data_rows_tr[1:] if image_urls and any(image_urls) else data_rows_tr

                for tr in text_data_rows_tr:
                    row_cells = [td.get_text(" ", strip=True).replace('\n', ' ').replace('\r', '').strip() for td in tr.find_all(['td', 'th'])]
                    if any(cell for cell in row_cells): # Only add non-empty rows
                        rows_data.append(row_cells)

                if headers or rows_data: # Only return table if we found something
                     print(f"Returning structured table data: Headers={len(headers)}, Rows={len(rows_data)}, Images={len(image_urls)}")
                     # Use image_urls list now
                     return {"type": "table", "headers": headers, "rows": rows_data, "imageUrls": image_urls}

        except Exception as table_parse_error:
            print(f"Error trying to parse table structure: {table_parse_error}")
            # Fall through to text if table parsing fails

    # Fallback to text if no table structure identified or parsing failed
    print("Returning data as simple text.")
    details_text = "\n".join(worth_info_lines).strip()
    final_text = details_text if details_text else "Could not extract specific worth details from the page structure."
    # Add empty image list for text data
    return {"type": "text", "content": final_text, "imageUrls": []}


# --- API Routes ---

@app.route('/')
def home():
    return "AJ Item Price Checker API"

@app.route('/search', methods=['GET'])
def search_item_route():
    item_name = request.args.get('item')
    if not item_name:
        return jsonify({"error": "Missing 'item' query parameter"}), 400

    print(f"API: Received search request for: {item_name}")
    search_url = f"{BASE_URL}{SEARCH_PATH}?query={quote(item_name)}&scope=internal&navigationSearch=true"

    try:
        html_content = _fetch_page_content(search_url)
        if not html_content:
             # Should have been caught by RuntimeError in _fetch_page_content, but double-check
             return jsonify({"error": "Failed to fetch search page content"}), 500

        results = _parse_search_results(html_content)
        return jsonify(results)

    except RuntimeError as e:
        # Catch errors raised by _fetch_page_content
        print(f"API Error during search: {e}")
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        # Catch any other unexpected errors during parsing etc.
        print(f"API Unexpected Error during search:\n{traceback.format_exc()}")
        return jsonify({"error": "An unexpected server error occurred during search."}), 500


@app.route('/details', methods=['GET'])
def get_details_route():
    page_url = request.args.get('page') # Expecting the full URL now
    if not page_url:
        # Try getting title as fallback? For now, require URL.
        return jsonify({"error": "Missing 'page' query parameter (should be the full URL)"}), 400

    # Basic validation: Check if it looks like a URL from the target site
    if not page_url.startswith(BASE_URL):
         return jsonify({"error": f"Invalid 'page' URL. Must start with {BASE_URL}"}), 400

    print(f"API: Received details request for: {page_url}")

    try:
        html_content = _fetch_page_content(page_url)
        if not html_content:
            return jsonify({"error": "Failed to fetch item page content"}), 500

        # _extract_worth_details now returns a dictionary
        details_data = _extract_worth_details(html_content)
        details_data["source_url"] = page_url # Add source URL to the response dict
        return jsonify(details_data)

    except RuntimeError as e:
        print(f"API Error during details fetch: {e}")
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        print(f"API Unexpected Error during details fetch:\n{traceback.format_exc()}")
        return jsonify({"error": "An unexpected server error occurred fetching details."}), 500


if __name__ == '__main__':
    print("Starting AJ Item Price Checker API Server...")
    # Port 5000 is the default for Flask
    # debug=True automatically reloads on code changes, helpful for development
    # Use host='0.0.0.0' if you need to access it from other devices on your network
    app.run(debug=True, port=5000)
