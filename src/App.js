import React, { useState, useCallback, useEffect, useRef } from "react";
import Result from "./components/Result";
import InfoModal from "./components/InfoModal";
import searchCache from "./utils/searchCache";
import "./App.css";

function App() {
  // Get initial preferences from localStorage or OS
  const getUserPreferences = () => {
    const storedTheme = localStorage.getItem("theme");
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
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [debouncedResults, setDebouncedResults] = useState([]);
  const [currentAPI, setCurrentAPI] = useState("itunes");
  const [isDarkMode, setIsDarkMode] = useState(prefs.theme);
  const [useJPG, setUseJPG] = useState(prefs.format);
  const [isGridView, setIsGridView] = useState(prefs.view);
  const resultsRef = useRef(null);
  const searchInputRef = useRef(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Expose cache clearing function globally for testing
  useEffect(() => {
    window.clearSearchCache = () => {
      searchCache.clear();
    };
    // Expose function to test specific API
    window.testAPI = (apiName) => {
      const validAPIs = ["itunes", "lastfm", "discogs", "musicbrainz"];
      if (validAPIs.includes(apiName.toLowerCase())) {
        setCurrentAPI(apiName.toLowerCase());
        console.log(`✅ Switched to ${apiName} API. Try searching now!`);
      } else {
        console.warn(`Invalid API. Valid options: ${validAPIs.join(", ")}`);
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
      if (localStorage.getItem("theme") === null) {
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
    localStorage.setItem("theme", isDarkMode ? "dark" : "light");
  }, [isDarkMode]);

  const toggleTheme = useCallback(() => {
    setIsDarkMode((prev) => !prev);
  }, []);

  const toggleFormat = useCallback(() => {
    setUseJPG((prev) => {
      localStorage.setItem("imageFormat", !prev ? "jpg" : "png");
      return !prev;
    });
  }, []);

  const toggleView = useCallback(() => {
    if (resultsRef.current) {
      resultsRef.current.classList.add("view-transition");
      setTimeout(() => {
        setIsGridView((prev) => {
          const newValue = !prev;
          localStorage.setItem("viewType", newValue ? "grid" : "list");
          return newValue;
        });
        resultsRef.current?.classList.remove("view-transition");
      }, 200);
    }
  }, []);

  // Add effect to ensure view preference is always synced with localStorage
  useEffect(() => {
    localStorage.setItem("viewType", isGridView ? "grid" : "list");
  }, [isGridView]);

  // Handle the debounced search term
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  const searchMusicBrainz = useCallback(async (term) => {
    try {
      // Add timeout to prevent hanging on slow MusicBrainz API
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const response = await fetch(
        `https://album-search-api.karanrajsinghgera.workers.dev/?q=${encodeURIComponent(
          term
        )}&api=musicbrainz`,
        { signal: controller.signal }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error("MusicBrainz API error");
      }

      const data = await response.json();
      return data;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error("MusicBrainz API timeout");
      }
      console.error("MusicBrainz search error:", error);
      throw error;
    }
  }, []);

  const searchItunes = useCallback(async (term) => {
    try {
      const response = await fetch(
        `https://album-search-api.karanrajsinghgera.workers.dev/?q=${encodeURIComponent(
          term
        )}&api=itunes`
      );

      if (!response.ok) {
        throw new Error("iTunes API error");
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("iTunes search error:", error);
      throw error;
    }
  }, []);

  const searchDiscogs = useCallback(async (term) => {
    try {
      const response = await fetch(
        `https://album-search-api.karanrajsinghgera.workers.dev/?q=${encodeURIComponent(
          term
        )}&api=discogs`
      );

      if (!response.ok) {
        throw new Error("Discogs API error");
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Discogs search error:", error);
      throw error;
    }
  }, []);

  const searchLastFm = useCallback(async (term) => {
    try {
      const response = await fetch(
        `https://album-search-api.karanrajsinghgera.workers.dev/?q=${encodeURIComponent(
          term
        )}&api=lastfm`
      );

      if (!response.ok) {
        throw new Error("Last.fm API error");
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Last.fm search error:", error);
      throw error;
    }
  }, []);

  // Update the search effect
  useEffect(() => {
    const searchAlbums = async () => {
      if (!debouncedSearchTerm) {
        setDebouncedResults([]);
        return;
      }

      setIsLoading(true);

      // Check cache first
      const cacheKey = `${currentAPI}:${debouncedSearchTerm}`;
      const cachedResults = searchCache.get(cacheKey);

      if (cachedResults) {
        console.log("Cache hit:", cacheKey);
        setDebouncedResults(cachedResults);
        setIsLoading(false);
        return;
      }

      try {
        let results;

        // Try each API in sequence
        if (currentAPI === "itunes") {
          try {
            results = await searchItunes(debouncedSearchTerm);
            if (!results || results.length === 0) {
              throw new Error("No results from iTunes");
            }
            searchCache.set(cacheKey, results);
          } catch (error) {
            console.log("Switching to Last.fm due to iTunes error");
            setCurrentAPI("lastfm");
            try {
              results = await searchLastFm(debouncedSearchTerm);
              if (!results || results.length === 0) {
                throw new Error("No results from Last.fm");
              }
              searchCache.set(`lastfm:${debouncedSearchTerm}`, results);
            } catch (error) {
              console.log("Switching to Discogs due to Last.fm error");
              setCurrentAPI("discogs");
              try {
                results = await searchDiscogs(debouncedSearchTerm);
                if (!results || results.length === 0) {
                  throw new Error("No results from Discogs");
                }
                searchCache.set(`discogs:${debouncedSearchTerm}`, results);
              } catch (error) {
                console.log("Switching to MusicBrainz due to Discogs error");
                setCurrentAPI("musicbrainz");
                try {
                  results = await searchMusicBrainz(debouncedSearchTerm);
                  if (!results || results.length === 0) {
                    throw new Error("No results from MusicBrainz");
                  }
                  searchCache.set(`musicbrainz:${debouncedSearchTerm}`, results);
                } catch (error) {
                  // All APIs failed
                  throw error;
                }
              }
            }
          }
        } else if (currentAPI === "musicbrainz") {
          try {
            results = await searchMusicBrainz(debouncedSearchTerm);
            if (!results || results.length === 0) {
              throw new Error("No results from MusicBrainz");
            }
            searchCache.set(cacheKey, results);
          } catch (error) {
            console.log("Switching to Last.fm due to MusicBrainz error");
            setCurrentAPI("lastfm");
            try {
              results = await searchLastFm(debouncedSearchTerm);
              if (!results || results.length === 0) {
                throw new Error("No results from Last.fm");
              }
              searchCache.set(`lastfm:${debouncedSearchTerm}`, results);
            } catch (error) {
              console.log("Switching to Discogs due to Last.fm error");
              setCurrentAPI("discogs");
              try {
                results = await searchDiscogs(debouncedSearchTerm);
                if (!results || results.length === 0) {
                  throw new Error("No results from Discogs");
                }
                searchCache.set(`discogs:${debouncedSearchTerm}`, results);
              } catch (error) {
                console.log("Switching back to iTunes");
                setCurrentAPI("itunes");
                results = await searchItunes(debouncedSearchTerm);
                if (!results || results.length === 0) {
                  throw new Error("No results from iTunes");
                }
                searchCache.set(`itunes:${debouncedSearchTerm}`, results);
              }
            }
          }
        } else if (currentAPI === "lastfm") {
          try {
            results = await searchLastFm(debouncedSearchTerm);
            if (!results || results.length === 0) {
              throw new Error("No results from Last.fm");
            }
            searchCache.set(cacheKey, results);
          } catch (error) {
            console.log("Switching to Discogs due to Last.fm error");
            setCurrentAPI("discogs");
            try {
              results = await searchDiscogs(debouncedSearchTerm);
              if (!results || results.length === 0) {
                throw new Error("No results from Discogs");
              }
              searchCache.set(`discogs:${debouncedSearchTerm}`, results);
            } catch (error) {
              console.log("Switching to MusicBrainz due to Discogs error");
              setCurrentAPI("musicbrainz");
              try {
                results = await searchMusicBrainz(debouncedSearchTerm);
                if (!results || results.length === 0) {
                  throw new Error("No results from MusicBrainz");
                }
                searchCache.set(`musicbrainz:${debouncedSearchTerm}`, results);
              } catch (error) {
                console.log("Switching back to iTunes");
                setCurrentAPI("itunes");
                results = await searchItunes(debouncedSearchTerm);
                if (!results || results.length === 0) {
                  throw new Error("No results from iTunes");
                }
                searchCache.set(`itunes:${debouncedSearchTerm}`, results);
              }
            }
          }
        } else {
          try {
            results = await searchDiscogs(debouncedSearchTerm);
            if (!results || results.length === 0) {
              throw new Error("No results from Discogs");
            }
            searchCache.set(cacheKey, results);
          } catch (error) {
            console.log("Switching to MusicBrainz due to Discogs error");
            setCurrentAPI("musicbrainz");
            try {
              results = await searchMusicBrainz(debouncedSearchTerm);
              if (!results || results.length === 0) {
                throw new Error("No results from MusicBrainz");
              }
              searchCache.set(`musicbrainz:${debouncedSearchTerm}`, results);
            } catch (error) {
              console.log("Switching back to iTunes");
              setCurrentAPI("itunes");
              results = await searchItunes(debouncedSearchTerm);
              if (!results || results.length === 0) {
                throw new Error("No results from iTunes");
              }
              searchCache.set(`itunes:${debouncedSearchTerm}`, results);
            }
          }
        }

        setDebouncedResults(results);
        setIsLoading(false);
      } catch (error) {
        console.error("Error fetching albums:", error);
        setDebouncedResults([]);
        setIsLoading(false);
      }
    };

    searchAlbums();
  }, [
    debouncedSearchTerm,
    currentAPI,
    searchItunes,
    searchMusicBrainz,
    searchDiscogs,
    searchLastFm,
  ]);

  const handleSearch = useCallback((event) => {
    const term = event.target.value;
    setSearchTerm(term);

    // Add fade-out class to existing results
    if (resultsRef.current) {
      const cards = resultsRef.current.getElementsByClassName("album-card");
      Array.from(cards).forEach((card) => {
        card.classList.add("fade-out");
      });
    }

    // Clear results after fade-out animation
    setTimeout(() => {
      setDebouncedResults([]);
    }, 300);
  }, []);

  const handleTitleClick = useCallback(() => {
    // Add fade-out class to existing results
    if (resultsRef.current) {
      const cards = resultsRef.current.getElementsByClassName("album-card");
      Array.from(cards).forEach((card) => {
        card.classList.add("fade-out");
      });
    }

    // Clear results after fade-out animation
    setTimeout(() => {
      setSearchTerm("");
      setDebouncedResults([]);
    }, 300);
  }, []);

  // Add global keypress handler
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Ignore if user is typing in an input or if it's a special key
      if (
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
  }, []);

  return (
    <div className="App">
      <div className="header-controls">
        <div className="format-controls">
          <span>PNG</span>
          <label className="switch">
            <input
              type="checkbox"
              checked={useJPG}
              onChange={toggleFormat}
              aria-label="Toggle image format"
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
            value={searchTerm}
            onChange={handleSearch}
          />
        </div>
        <div className="view-toggle">
          <button
            className={`view-button ${isGridView ? "active" : ""}`}
            onClick={toggleView}
            aria-label="Toggle grid view"
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
            onClick={toggleView}
            aria-label="Toggle list view"
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
          ) : (
            debouncedResults.map((album) => (
              <Result key={album.id} album={album} useJPG={useJPG} />
            ))
          )}
        </div>
      </div>

      <InfoModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}

export default App;
