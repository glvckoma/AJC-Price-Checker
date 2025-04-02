import sys
import requests
from bs4 import BeautifulSoup
import time
import datetime
from urllib.parse import urljoin, quote
import traceback # Import traceback module

# Import PyQt5 components
from PyQt5.QtWidgets import (QApplication, QWidget, QVBoxLayout, QHBoxLayout,
                             QLineEdit, QPushButton, QListWidget, QTextEdit,
                             QLabel, QMessageBox, QProgressDialog, QListWidgetItem)
from PyQt5.QtCore import Qt, QThread, pyqtSignal, QObject

# --- Configuration (Keep from original script) ---
BASE_URL = "https://aj-item-worth.fandom.com"
SEARCH_PATH = "/wiki/Special:Search"
HEADERS = {
    # Using a more generic user agent can sometimes avoid issues
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    # 'User-Agent': 'MyAnimalJamItemSearcherGUI/1.1 (Contact: your_email@example.com)' # GUI Version
}
REQUEST_DELAY = 1 # Can be slightly lower for GUI as user interaction adds delay

# --- Worker Class for Threading ---
class WorkerSignals(QObject):
    '''
    Defines signals available from a running worker thread.
    Supported signals are:
    finished: No data
    error: tuple (exctype, value, traceback_str )
    results_ready: list of dictionaries [{'title': str, 'url': str}]
    details_ready: str containing the extracted worth details
    progress_update: str status message
    '''
    finished = pyqtSignal()
    error = pyqtSignal(tuple)
    results_ready = pyqtSignal(list)
    details_ready = pyqtSignal(str)
    progress_update = pyqtSignal(str)

class SearchWorker(QObject):
    '''Worker thread for searching the wiki'''
    def __init__(self, query):
        super().__init__()
        self.signals = WorkerSignals()
        self.query = query
        self._is_running = True # Optional flag if you need finer stop control later

    def run(self):
        try: # <-- Wrap entire operation
            self.signals.progress_update.emit(f"Searching for '{self.query}'...")
            search_url = f"{BASE_URL}{SEARCH_PATH}?query={quote(self.query)}&scope=internal&navigationSearch=true"

            # --- Fetch Page ---
            html_content = None
            self.signals.progress_update.emit(f"Fetching search page...")
            try:
                # Increased timeout slightly
                response = requests.get(search_url, headers=HEADERS, timeout=25, verify=True) # verify=True is default, explicitly state
                response.raise_for_status()
                time.sleep(REQUEST_DELAY)
                html_content = response.text
            except requests.exceptions.SSLError as ssl_err:
                 # Catch SSL errors specifically if they occur
                 print(f"SSL Error during search fetch: {ssl_err}")
                 print("Consider checking system certificates or installing 'python-certifi-win32' if on Windows.")
                 raise RuntimeError(f"SSL Certificate Verification Error during search. Check internet connection and firewall/antivirus. Details: {ssl_err}") from ssl_err
            except requests.exceptions.RequestException as e:
                raise RuntimeError(f"Network Error searching: {e}") from e

            if not html_content:
                 raise RuntimeError("Failed to fetch search page content (empty response).")

            # --- Parse Search Results ---
            self.signals.progress_update.emit("Parsing search results...")
            soup = BeautifulSoup(html_content, 'html.parser')
            results = []
            result_list = soup.find('ul', class_='unified-search__results')

            if result_list:
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

            if not results and result_list and list_items:
                 self.signals.progress_update.emit("Warning: Found search list but couldn't extract items. Selectors might need update.")

            self.signals.results_ready.emit(results)

        except Exception as e:
            # Catch ANY exception that occurred above
            self.signals.error.emit((type(e), e, traceback.format_exc()))
        finally:
            # Ensure finished is ALWAYS emitted
            self.signals.finished.emit()

class DetailsWorker(QObject):
    '''Worker thread for fetching item details'''
    def __init__(self, item_url, item_title):
        super().__init__()
        self.signals = WorkerSignals()
        self.item_url = item_url
        self.item_title = item_title
        self._is_running = True

    def run(self):
        try: # <-- Wrap entire operation
            self.signals.progress_update.emit(f"Fetching details for '{self.item_title}'...")

             # --- Fetch Page ---
            html_content = None
            try:
                response = requests.get(self.item_url, headers=HEADERS, timeout=25, verify=True)
                response.raise_for_status()
                time.sleep(REQUEST_DELAY)
                html_content = response.text
            except requests.exceptions.SSLError as ssl_err:
                 print(f"SSL Error during details fetch: {ssl_err}")
                 print("Consider checking system certificates or installing 'python-certifi-win32' if on Windows.")
                 raise RuntimeError(f"SSL Certificate Verification Error fetching details. Check internet connection and firewall/antivirus. Details: {ssl_err}") from ssl_err
            except requests.exceptions.RequestException as e:
                raise RuntimeError(f"Network Error fetching details: {e}") from e

            if not html_content:
                 raise RuntimeError("Failed to fetch item page content (empty response).")

            # --- Extract Worth Info ---
            self.signals.progress_update.emit("Parsing details...")
            soup = BeautifulSoup(html_content, 'html.parser')
            worth_info_lines = []
            content_area = soup.find('div', class_='mw-parser-output')
            if not content_area:
                print("Warning: Could not find main content area (div.mw-parser-output). Parsing whole page.")
                content_area = soup # Fallback

            worth_tables = content_area.find_all('table', class_=['wikitable', 'article-table'])

            if worth_tables:
                # print(f"Found {len(worth_tables)} table(s) with class 'wikitable' or 'article-table'. Analyzing...")
                for table in worth_tables:
                    rows = table.find_all('tr')
                    if not rows: continue
                    data_rows = rows[1:] # Simple header skip
                    found_row_worth = False
                    for row in data_rows:
                        row_text = row.get_text(" ", strip=True).lower()
                        cells = row.find_all(['td', 'th'])
                        # Check for common worth indicators
                        if "den beta" in row_text or "diamond" in row_text or "collar" in row_text or "wrist" in row_text or "bad" in row_text or "good" in row_text or "best" in row_text or "decent" in row_text:
                            cell_texts = [cell.get_text(" ", strip=True).replace('\n', ' ').replace('\r', '').strip() for cell in cells if cell.get_text(strip=True)]
                            if cell_texts:
                                worth_info_lines.append(f"- {' | '.join(cell_texts)}")
                                found_row_worth = True
                    # Removed the generic table dump to keep output cleaner if specific rows are found
                    # if found_row_worth:
                    #    extracted_from_table = True

            # --- Fallback - Paragraphs (Only if no specific table rows found) ---
            if not worth_info_lines:
                # print("No specific worth found in tables. Searching paragraphs...")
                paragraphs = content_area.find_all('p', limit=10)
                found_para_worth = False
                for p in paragraphs:
                    p_text = p.get_text(" ", strip=True)
                    p_text_lower = p_text.lower()
                    # Check for keywords in paragraphs
                    if "worth" in p_text_lower or "value" in p_text_lower or "den beta" in p_text_lower or "diamond" in p_text_lower or "collar" in p_text_lower or "wrist" in p_text_lower:
                       worth_info_lines.append(f"\n[Info from Paragraph:]\n{p_text}\n")
                       found_para_worth = True
                       if len(worth_info_lines) > 5: break # Limit paragraphs grabbed if many match

                # --- Last resort - First paragraph (Only if NOTHING else found) ---
                if not found_para_worth:
                    # print("No specific worth indicators found. Grabbing first paragraph as context.")
                    first_p = content_area.find('p')
                    if first_p:
                        worth_info_lines.append(f"\n[General Info:]\n{first_p.get_text(' ', strip=True)}")

            details_text = "\n".join(worth_info_lines).strip() # Use strip() to remove leading/trailing whitespace
            if not details_text:
                 details_text = "Could not extract specific worth details from the page structure. Check the page manually."

            self.signals.details_ready.emit(details_text)

        except Exception as e:
             # Catch ANY exception that occurred above
            self.signals.error.emit((type(e), e, traceback.format_exc()))
        finally:
            # Ensure finished is ALWAYS emitted
            self.signals.finished.emit()


# --- Main Application Window ---
class ItemSearchApp(QWidget):
    def __init__(self):
        super().__init__()
        self.search_results_data = []
        self.thread = None
        self.worker = None
        self.initUI()

    def initUI(self):
        self.setWindowTitle('Animal Jam Item Worth Searcher')
        self.setGeometry(100, 100, 700, 550) # Slightly wider/taller

        # Layouts
        main_layout = QVBoxLayout()
        search_layout = QHBoxLayout()

        # --- Search Area ---
        self.search_label = QLabel("Item Name:")
        self.search_input = QLineEdit()
        self.search_input.setPlaceholderText("Enter item name and press Enter or click Search")
        self.search_button = QPushButton("Search")

        search_layout.addWidget(self.search_label)
        search_layout.addWidget(self.search_input)
        search_layout.addWidget(self.search_button)
        main_layout.addLayout(search_layout)

        # --- Results List ---
        self.results_label = QLabel("Search Results (Double-click to get worth):")
        self.results_list = QListWidget()
        main_layout.addWidget(self.results_label)
        main_layout.addWidget(self.results_list)

        # --- Details Area ---
        self.details_label = QLabel("Worth Details:")
        self.details_output = QTextEdit()
        self.details_output.setReadOnly(True)
        # Set a slightly nicer font maybe
        # font = self.details_output.font()
        # font.setPointSize(10)
        # self.details_output.setFont(font)
        main_layout.addWidget(self.details_label)
        main_layout.addWidget(self.details_output)

         # --- Status Bar ---
        self.status_label = QLabel("Status: Ready")
        main_layout.addWidget(self.status_label)

        self.setLayout(main_layout)

        # --- Connect Signals ---
        self.search_button.clicked.connect(self.start_search)
        self.search_input.returnPressed.connect(self.start_search)
        self.results_list.itemDoubleClicked.connect(self.result_selected)

    def start_search(self):
        search_term = self.search_input.text().strip()
        if not search_term:
            QMessageBox.warning(self, "Input Error", "Please enter an item name to search.")
            return

        if self.thread is not None and self.thread.isRunning():
             QMessageBox.warning(self, "Busy", "A search or fetch operation is already in progress.")
             return

        self.results_list.clear()
        self.details_output.clear()
        self.search_results_data = []
        self.status_label.setText(f"Status: Starting search for '{search_term}'...")
        self.set_controls_enabled(False)

        self.thread = QThread()
        self.worker = SearchWorker(search_term)
        self.worker.moveToThread(self.thread)

        self.worker.signals.results_ready.connect(self.display_results)
        self.worker.signals.error.connect(self.on_worker_error)
        self.worker.signals.finished.connect(self.on_worker_finished)
        self.worker.signals.progress_update.connect(self.update_status)

        self.thread.started.connect(self.worker.run)
        self.thread.finished.connect(self.thread.deleteLater)
        self.worker.signals.finished.connect(self.thread.quit) # Ask thread's event loop to quit
        self.worker.signals.finished.connect(self.worker.deleteLater)

        self.thread.start()

    def result_selected(self, item):
        if self.thread is not None and self.thread.isRunning():
             QMessageBox.warning(self, "Busy", "A search or fetch operation is already in progress.")
             return

        index = self.results_list.row(item)
        if 0 <= index < len(self.search_results_data):
            selected_data = self.search_results_data[index]
            item_title = selected_data['title']
            item_url = selected_data['url']

            self.status_label.setText(f"Status: Fetching details for '{item_title}'...")
            self.details_output.clear()
            self.set_controls_enabled(False)

            self.thread = QThread()
            self.worker = DetailsWorker(item_url, item_title)
            self.worker.moveToThread(self.thread)

            self.worker.signals.details_ready.connect(self.display_details)
            self.worker.signals.error.connect(self.on_worker_error)
            self.worker.signals.finished.connect(self.on_worker_finished)
            self.worker.signals.progress_update.connect(self.update_status)

            self.thread.started.connect(self.worker.run)
            self.thread.finished.connect(self.thread.deleteLater)
            self.worker.signals.finished.connect(self.thread.quit)
            self.worker.signals.finished.connect(self.worker.deleteLater)

            self.thread.start()
        else:
             QMessageBox.warning(self, "Selection Error", "Could not retrieve data for the selected item.")


    def display_results(self, results):
        self.search_results_data = results
        if not results:
            self.status_label.setText("Status: No results found.")
        else:
             self.status_label.setText(f"Status: Found {len(results)} results. Double-click an item.")
             for result in results:
                 list_item = QListWidgetItem(result['title'])
                 self.results_list.addItem(list_item)


    def display_details(self, details):
        self.details_output.setText(details)
        # Check if details actually contain info or the error message
        if "Could not extract" in details:
             self.status_label.setText("Status: Details could not be extracted automatically.")
        else:
             self.status_label.setText("Status: Details loaded.")


    def update_status(self, message):
        self.status_label.setText(f"Status: {message}")

    def on_worker_error(self, error_tuple):
         exc_type, exc_value, exc_traceback_str = error_tuple
         error_message_short = f"{exc_type.__name__}: {exc_value}"
         error_message_full = f"--- ERROR ---\nError Type: {exc_type.__name__}\nMessage: {exc_value}\n\nTraceback:\n{exc_traceback_str}"

         print(f"WORKER ERROR:\n{error_message_full}") # Log full error to console if visible

         # Show error in a message box
         msgBox = QMessageBox()
         msgBox.setIcon(QMessageBox.Critical)
         msgBox.setWindowTitle("Background Task Error")
         msgBox.setText("An error occurred:")
         # Show the short error in the main popup text
         msgBox.setInformativeText(error_message_short)
         # Use setDetailedText for the full traceback if needed, but it can be clunky
         # msgBox.setDetailedText(error_message_full)
         msgBox.exec_()

         # Display the full error in the details text area
         self.details_output.setText(error_message_full)

         self.status_label.setText("Status: Error occurred. See details below.")
         self.set_controls_enabled(True) # Re-enable controls


    def on_worker_finished(self):
        # Update status only if no error occurred (error signal handles its own status)
        current_status = self.status_label.text()
        if "Error" not in current_status:
            if self.details_output.toPlainText(): # Details were loaded (or attempted)
                if "Could not extract" not in self.details_output.toPlainText() and "ERROR" not in self.details_output.toPlainText():
                   self.status_label.setText("Status: Details loaded. Ready.")
                elif "ERROR" not in self.details_output.toPlainText():
                    self.status_label.setText("Status: Details could not be extracted. Ready.")
                # If it's an error, the error handler already set the status
            elif self.results_list.count() > 0: # Results are shown, waiting for selection
                self.status_label.setText("Status: Search complete. Double-click an item.")
            else: # No results were found
                self.status_label.setText("Status: No results found. Ready.")

        self.set_controls_enabled(True) # Always re-enable controls
        self.thread = None # Clear thread reference
        self.worker = None # Clear worker reference


    def set_controls_enabled(self, enabled):
        """Enable or disable input controls during processing."""
        self.search_input.setEnabled(enabled)
        self.search_button.setEnabled(enabled)
        self.results_list.setEnabled(enabled)


    def closeEvent(self, event):
        # Attempt graceful shutdown
        if self.thread is not None and self.thread.isRunning():
            print("Window closing: Requesting worker thread to quit...")
            # Disconnect signals to prevent updates after window starts closing
            try: self.worker.signals.finished.disconnect()
            except TypeError: pass # Ignore if already disconnected
            try: self.worker.signals.error.disconnect()
            except TypeError: pass
            try: self.worker.signals.results_ready.disconnect()
            except TypeError: pass
            try: self.worker.signals.details_ready.disconnect()
            except TypeError: pass
            try: self.worker.signals.progress_update.disconnect()
            except TypeError: pass

            self.thread.quit() # Ask thread's event loop to stop
            if not self.thread.wait(1500): # Wait up to 1.5 seconds
                print("Warning: Thread did not quit gracefully. Terminating.")
                self.thread.terminate() # Force terminate if necessary
                self.thread.wait() # Wait for termination process
            print("Thread stopped.")
        event.accept()


# --- Run the Application ---
if __name__ == '__main__':
    # Helps with high-DPI displays if needed
    # QApplication.setAttribute(Qt.AA_EnableHighDpiScaling, True)
    # QApplication.setAttribute(Qt.AA_UseHighDpiPixmaps, True)

    app = QApplication(sys.argv)
    ex = ItemSearchApp()
    ex.show()
    sys.exit(app.exec_())