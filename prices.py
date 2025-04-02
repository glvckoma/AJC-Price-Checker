# --- [Keep other imports and configuration the same] ---
import requests
from bs4 import BeautifulSoup
import time
import datetime
from urllib.parse import urljoin, quote # For building URLs

BASE_URL = "https://aj-item-worth.fandom.com"
SEARCH_PATH = "/wiki/Special:Search"
HEADERS = {
    'User-Agent': 'MyAnimalJamItemSearcher/2.1 (Contact: your_email@example.com)' # Updated version
}
REQUEST_DELAY = 2

# --- [Keep fetch_page function the same] ---
def fetch_page(url):
    """Fetches the HTML content of a given URL."""
    print(f"Fetching: {url}...")
    try:
        response = requests.get(url, headers=HEADERS, timeout=15)
        response.raise_for_status()
        print(f"Success. Waiting {REQUEST_DELAY} seconds...")
        time.sleep(REQUEST_DELAY)
        return response.text
    except requests.exceptions.RequestException as e:
        print(f"Error fetching page {url}: {e}")
        return None

# --- [ UPDATED search_wiki function ] ---
def search_wiki(query):
    """Performs a search on the wiki and returns potential page results."""
    search_url = f"{BASE_URL}{SEARCH_PATH}?query={quote(query)}&scope=internal&navigationSearch=true"
    html_content = fetch_page(search_url)

    if not html_content:
        return []

    print("Parsing search results...")
    soup = BeautifulSoup(html_content, 'html.parser')
    results = []

    # Find the list containing search results
    result_list = soup.find('ul', class_='unified-search__results')

    if not result_list:
        print("Could not find search result list (ul.unified-search__results). Page structure might have changed.")
        no_results_msg = soup.find('div', class_='unified-search__no-results')
        if no_results_msg:
            print("Wiki reported no results found for this term.")
        return []

    # Find individual result items within the list
    list_items = result_list.find_all('li', class_='unified-search__result', limit=10) # Limit results shown

    for item in list_items:
        article_tag = item.find('article')
        if article_tag:
            # --- CHANGE HERE: Look for h3 instead of h1 ---
            h3_tag = article_tag.find('h3', class_='unified-search__result__header')
            if h3_tag:
                # --- CHANGE HERE: Find 'a' with specific class inside h3 ---
                link_tag = h3_tag.find('a', class_='unified-search__result__title')
                if link_tag and link_tag.has_attr('href'):
                    title = link_tag.get_text(strip=True)
                    relative_url = link_tag['href']
                    # Fandom links are usually absolute, but urljoin handles both cases
                    absolute_url = urljoin(BASE_URL, relative_url)
                    results.append({'title': title, 'url': absolute_url})

    if not results and list_items:
         print("Warning: Found search result items, but couldn't extract valid links/titles with the current selectors (li > article > h3 > a). Check HTML structure again.")

    print(f"Found {len(results)} potential results.")
    return results

# --- [Keep extract_worth_info function the same for now, but we might need to adjust it based on item page structure] ---
# --- [Let's add a small tweak to extract_worth_info to look for 'article-table' as well] ---
def extract_worth_info(item_url):
    """Attempts to extract worth information from a specific item page."""
    html_content = fetch_page(item_url)
    if not html_content:
        return "Could not fetch item page."

    print(f"Parsing item page: {item_url}...")
    soup = BeautifulSoup(html_content, 'html.parser')
    worth_info = []

    # Find the main content area first
    content_area = soup.find('div', class_='mw-parser-output') # Common content wrapper
    if not content_area:
        print("Warning: Could not find main content area (div.mw-parser-output). Parsing whole page.")
        content_area = soup # Fallback to whole page

    # --- Strategy 1: Look for tables likely containing worth ---
    # --- CHANGE HERE: Look for 'article-table' OR 'wikitable' ---
    worth_tables = content_area.find_all('table', class_=['wikitable', 'article-table'])

    if worth_tables:
        print(f"Found {len(worth_tables)} table(s) with class 'wikitable' or 'article-table'. Analyzing...")
        for table in worth_tables:
            rows = table.find_all('tr')
            if not rows: continue

            found_specific_worth = False
            # Skip header row(s) - let's try skipping first row simply
            data_rows = rows[1:]

            for row in data_rows:
                row_text = row.get_text(" ", strip=True).lower()
                cells = row.find_all(['td', 'th'])

                # Check for common worth indicators
                if "den beta" in row_text or "diamond" in row_text or "collar" in row_text or "wrist" in row_text or "bad" in row_text or "good" in row_text or "best" in row_text or "decent" in row_text:
                    cell_texts = [cell.get_text(" ", strip=True).replace('\n', ' ').replace('\r', '') for cell in cells if cell.get_text(strip=True)] # Clean up text
                    if cell_texts:
                        worth_info.append(f"Potential Worth (Table Row): {' | '.join(cell_texts)}")
                        found_specific_worth = True

            # Optional: Add generic table content if specific rows weren't identified
            if not found_specific_worth and len(rows) > 1:
                 limit = min(len(rows), 5) # Grab first few rows
                 worth_info.append("--- General Table Content (First few rows) ---")
                 for i in range(1, limit): # Skip header
                     cell_texts = [cell.get_text(" ", strip=True).replace('\n', ' ').replace('\r', '') for cell in rows[i].find_all(['td', 'th']) if cell.get_text(strip=True)]
                     if cell_texts:
                         worth_info.append(f"Row {i}: {' | '.join(cell_texts)}")
                 worth_info.append("--- End General Table Content ---")


    # --- Strategy 2: Fallback - Paragraphs ---
    if not worth_info:
        print("No specific worth found in tables. Searching paragraphs...")
        paragraphs = content_area.find_all('p', limit=10) # Limit paragraphs checked
        for p in paragraphs:
            p_text = p.get_text(" ", strip=True)
            p_text_lower = p_text.lower()
            if "worth" in p_text_lower or "value" in p_text_lower or "den beta" in p_text_lower or "diamond" in p_text_lower or "collar" in p_text_lower or "wrist" in p_text_lower:
                worth_info.append(f"Potential Worth (Paragraph): {p_text}")
                if len(worth_info) > 4: break # Limit paragraphs grabbed

    # --- Strategy 3: Last resort - First paragraph ---
    if not worth_info:
        print("No specific worth indicators found. Grabbing first paragraph as context.")
        first_p = content_area.find('p')
        if first_p:
            worth_info.append(f"General Info (First Paragraph): {first_p.get_text(' ', strip=True)}")

    return "\n".join(worth_info) if worth_info else "Could not extract specific worth information from the page."


# --- [ Main Execution Block - Keep the same ] ---
if __name__ == "__main__":
    print("--- Animal Jam Item Worth Searcher (v2.1) ---") # Version bump
    print("Enter item name to search. Type 'quit' or 'exit' to stop.")

    while True:
        print("-" * 30)
        search_term = input("Search for item: ").strip()

        if search_term.lower() in ['quit', 'exit']:
            break
        if not search_term:
            continue

        # 1. Perform search
        search_results = search_wiki(search_term)

        if not search_results:
            print(f"No relevant pages found for '{search_term}' via wiki search.")
            continue

        # 2. Display results and get user choice
        print("\nSearch Results:")
        for i, result in enumerate(search_results):
            print(f"  {i + 1}: {result['title']}")

        while True:
            try:
                choice_input = input(f"Enter number (1-{len(search_results)}) to view worth, or 's' to skip/search again: ").strip().lower()
                if choice_input == 's':
                     selected_result = None
                     break
                choice = int(choice_input) - 1
                if 0 <= choice < len(search_results):
                    selected_result = search_results[choice]
                    break
                else:
                    print(f"Invalid number. Please enter 1-{len(search_results)} or 's'.")
            except ValueError:
                print("Invalid input. Please enter a number or 's'.")

        if selected_result is None:
            continue

        # 3. Fetch and extract worth from selected page
        print(f"\n--- Worth Info for: {selected_result['title']} ---")
        print(f"Source: {selected_result['url']}")
        worth_details = extract_worth_info(selected_result['url'])
        print("-" * 20)
        print(worth_details)
        print("-" * 20)


    print("\n--- Exiting Searcher ---")