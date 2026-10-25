import React, { useState, useCallback, useEffect, useRef } from "react";
import Result from "./components/Result";
import InfoModal from "./components/InfoModal";
import searchCache from "./utils/searchCache";
import { API_ORDER, searchWithFallback } from "./utils/albumSearch";
import { buttonKeyHandlers } from "./utils/keyboard";
import "./App.css";

function App() {
  // Get initial preferences from localStorage or OS
  const getUserPreferences = () => {
    // "themeChoice" rather than "theme": older versions saved "theme" on every
    // visit, so it doesn't mean the user actually chose one
    const storedTheme = localStorage.getItem("themeChoice");
    const storedView = localStorage.getItem("viewType");
    const storedFormat = localStorage.getItem("imageFormat");

    // If user has set a theme, use it. Otherwise, use OS preference
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;
    const defaultTheme =
      storedTheme !== null ? storedTheme === "dark" : prefersDark;

    return {
      theme: defaultTheme,
      view: storedView ? storedView === "grid" : true,
      format: storedFormat === "jpg" ? true : false,
    };
  };

  const prefs = getUserPreferences();
  const [searchTerm, setSearchTerm] = useState("");
  // Each search is its own object: a new object means a new request, even for
  // a term searched before or the same term with a different API
  const [searchRequest, setSearchRequest] = useState({ term: "", api: "itunes" });
  const debouncedSearchTerm = searchRequest.term;
  // Results remember the request that produced them, so loading is derived:
  // it's whenever the current request hasn't produced results yet
  const [searchResults, setSearchResults] = useState({
    request: null,
    results: [],
    failed: false,
  });
  const [isDarkMode, setIsDarkMode] = useState(prefs.theme);
  const [useJPG, setUseJPG] = useState(prefs.format);
  const [isGridView, setIsGridView] = useState(prefs.view);
  const resultsRef = useRef(null);
  const viewTimerRef = useRef(null);
  const searchInputRef = useRef(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Expose cache clearing function globally for testing
  useEffect(() => {
    window.clearSearchCache = () => {
      searchCache.clear();
    };
    // Expose function to test specific API
    window.testAPI = (apiName) => {
      if (API_ORDER.includes(apiName.toLowerCase())) {
        const api = apiName.toLowerCase();
        setSearchRequest((prev) => ({ ...prev, api }));
        console.log(`✅ Switched to ${apiName} API. Try searching now!`);
      } else {
        console.warn(`Invalid API. Valid options: ${API_ORDER.join(", ")}`);
      }
    };
    return () => {
      delete window.clearSearchCache;
      delete window.testAPI;
    };
  }, []);

  // Listen for OS theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e) => {
      // Only update if user hasn't set a preference
      if (localStorage.getItem("themeChoice") === null) {
        setIsDarkMode(e.matches);
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute(
      "data-theme",
      isDarkMode ? "dark" : "light"
    );
  }, [isDarkMode]);

  // Only an explicit toggle saves the theme. Saving it on every load would
  // make the OS theme listener above stop working after the first visit.
  const toggleTheme = useCallback(() => {
    setIsDarkMode((prev) => {
      localStorage.setItem("themeChoice", !prev ? "dark" : "light");
      return !prev;
    });
  }, []);

  const toggleFormat = useCallback(() => {
    setUseJPG((prev) => {
      localStorage.setItem("imageFormat", !prev ? "jpg" : "png");
      return !prev;
    });
  }, []);

  // Clicking the view that's already showing does nothing. A switch still
  // fading out is cancelled first, so the last click always wins.
  const showView = useCallback(
    (grid) => {
      clearTimeout(viewTimerRef.current);
      viewTimerRef.current = null;
      if (grid === isGridView || !resultsRef.current) {
        resultsRef.current?.classList.remove("view-transition");
        return;
      }
      resultsRef.current.classList.add("view-transition");
      viewTimerRef.current = setTimeout(() => {
        viewTimerRef.current = null;
        setIsGridView(grid);
        localStorage.setItem("viewType", grid ? "grid" : "list");
        resultsRef.current?.classList.remove("view-transition");
      }, 200);
    },
    [isGridView]
  );

  useEffect(() => () => clearTimeout(viewTimerRef.current), []);

  // Handle the debounced search term
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      // Keep the same request if the input ended up back where it was, so
      // its results stay instead of being fetched again
      setSearchRequest((prev) =>
        prev.term === searchTerm ? prev : { ...prev, term: searchTerm }
      );
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  // Run the search, falling back through the other APIs for this search only
  useEffect(() => {
    if (!searchRequest.term) return;

    // Abort in-flight requests when the term changes so stale results never land
    const controller = new AbortController();

    searchWithFallback(searchRequest.term, searchRequest.api, {
      signal: controller.signal,
    }).then(({ api, results, failed = false }) => {
      if (controller.signal.aborted) return;
      if (api) console.log(`Showing results from ${api}`);
      setSearchResults({ request: searchRequest, results, failed });
    });

    return () => controller.abort();
  }, [searchRequest]);

  const isLoading =
    debouncedSearchTerm !== "" && searchResults.request !== searchRequest;
  const debouncedResults = debouncedSearchTerm ? searchResults.results : [];

  // Results fade out while the input differs from the term they were fetched
  // for, and fade back in if the input is changed back before the debounce fires
  const resultsAreStale = searchTerm !== debouncedSearchTerm;

  const showEmptyState =
    debouncedSearchTerm !== "" &&
    !isLoading &&
    !resultsAreStale &&
    debouncedResults.length === 0;

  const closeModal = useCallback(() => setIsModalOpen(false), []);

  const handleSearch = useCallback((event) => {
    setSearchTerm(event.target.value);
  }, []);

  const handleTitleClick = useCallback(() => {
    setSearchTerm("");
  }, []);

  // Add global keypress handler
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Ignore if user is typing in an input, a button already handled the key,
      // or it's a special key
      if (
        e.defaultPrevented ||
        isModalOpen ||
        (e.key === " " && e.target.closest("button, [role='button']")) ||
        e.target.tagName === "INPUT" ||
        e.target.tagName === "TEXTAREA" ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        e.key === "Tab" ||
        e.key === "Escape" ||
        e.key === "Enter" ||
        e.key === "Backspace" ||
        e.key === "Delete" ||
        e.key === "ArrowUp" ||
        e.key === "ArrowDown" ||
        e.key === "ArrowLeft" ||
        e.key === "ArrowRight"
      ) {
        return;
      }

      // Focus search input and simulate typing
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    };

    document.addEventListener("keydown", handleKeyPress);
    return () => document.removeEventListener("keydown", handleKeyPress);
  }, [isModalOpen]);

  return (
    <div className="App">
      {/* Everything behind the modal is inert while it's open, so focus and
          clicks can't reach it */}
      <div className="app-content" inert={isModalOpen}>
        <div className="header-controls">
          <div className="format-controls">
            <span>PNG</span>
            <label className="switch">
              <input
                type="checkbox"
                checked={useJPG}
                onChange={toggleFormat}
                aria-label="Use JPG instead of PNG for full-size images"
              />
              <span className="slider"></span>
            </label>
            <span>JPG</span>
          </div>
          <div className="right-controls">
            <button
              className="help-button"
              onClick={() => setIsModalOpen(true)}
              aria-label="Show help"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                width="24"
                height="24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12" y2="17" strokeLinecap="round" />
              </svg>
            </button>
            <button
              className="theme-toggle"
              onClick={toggleTheme}
              aria-label="Toggle dark mode"
            >
              {isDarkMode ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
            </button>
          </div>
        </div>

        <div className="header-section">
          <h1
            className="site-title"
            onClick={handleTitleClick}
            {...buttonKeyHandlers(handleTitleClick)}
            role="button"
            tabIndex={0}
          >
            bigpictures.xyz
          </h1>
          <div className="search-container">
            <input
              ref={searchInputRef}
              type="text"
              className="search-input"
              placeholder="Enter Album/Single Name"
              aria-label="Search for an album or single"
              value={searchTerm}
              onChange={handleSearch}
            />
          </div>
          <div className="view-toggle">
            <button
              className={`view-button ${isGridView ? "active" : ""}`}
              onClick={() => showView(true)}
              aria-label="Grid view"
              aria-pressed={isGridView}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="currentColor"
              >
                <path d="M3 3h7v7H3V3zm11 0h7v7h-7V3zm0 11h7v7h-7v-7zm-11 0h7v7H3v-7z" />
              </svg>
            </button>
            <button
              className={`view-button ${!isGridView ? "active" : ""}`}
              onClick={() => showView(false)}
              aria-label="List view"
              aria-pressed={!isGridView}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="currentColor"
              >
                <path d="M3 4h18v2H3V4zm0 7h18v2H3v-2zm0 7h18v2H3v-2z" />
              </svg>
            </button>
          </div>
        </div>

        <div className="results-section">
          <div
            className={`results-grid ${!isGridView ? "list-view" : ""}`}
            ref={resultsRef}
          >
            {isLoading ? (
              <div className="loading">
                <div className="loading-dot"></div>
                <div className="loading-dot"></div>
                <div className="loading-dot"></div>
              </div>
            ) : showEmptyState ? (
              <p className="empty-state" role="status">
                {searchResults.failed
                  ? "Couldn't reach any of the music databases. Try again in a moment."
                  : `No covers found for "${debouncedSearchTerm}".`}
              </p>
            ) : (
              debouncedResults.map((album) => (
                <Result
                  key={album.id}
                  album={album}
                  useJPG={useJPG}
                  fadingOut={resultsAreStale}
                  listView={!isGridView}
                />
              ))
            )}
          </div>
        </div>
      </div>

      <InfoModal isOpen={isModalOpen} onClose={closeModal} />
    </div>
  );
}

export default App;
