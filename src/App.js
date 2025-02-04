import React, { useState, useCallback, useEffect, useRef } from "react";
import Result from "./components/Result";
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

  const getFormattedImageUrl = useCallback(
    (url, size = "600x600") => {
      // Remove any existing size parameters and get base URL
      const baseUrl = url.split("/")[0];
      const pathParts = url.split("/").slice(1, -1); // Get all parts except last one
      return `${baseUrl}/${pathParts.join("/")}/${size}bb.${
        useJPG ? "jpg" : "png"
      }`;
    },
    [useJPG]
  );

  const searchMusicBrainz = useCallback(async (term) => {
    try {
      const response = await fetch(
        `https://musicbrainz.org/ws/2/release/?query=${encodeURIComponent(
          term
        )}&fmt=json&limit=20`,
        {
          headers: {
            "User-Agent": "curroscube (karanrajsinghgera@gmail.com)", // Replace with your contact
          },
        }
      );

      if (!response.ok) {
        throw new Error("MusicBrainz API error");
      }

      const data = await response.json();

      // Map MusicBrainz results to our format
      const formattedAlbums = await Promise.all(
        data.releases.map(async (release) => {
          // Get cover art if available
          let coverArtUrl = null;
          try {
            const artResponse = await fetch(
              `https://coverartarchive.org/release/${release.id}`,
              {
                headers: {
                  "User-Agent": "big.pictures/1.0.0 (your@email.com)", // Replace with your contact
                },
              }
            );
            if (artResponse.ok) {
              const artData = await artResponse.json();
              coverArtUrl = artData.images[0]?.image;
            }
          } catch (error) {
            console.error("Cover art fetch error:", error);
          }

          return {
            id: release.id,
            title: release.title,
            artist: release["artist-credit"]?.[0]?.name || "Unknown Artist",
            year: release.date
              ? new Date(release.date).getFullYear()
              : "Unknown",
            imageUrl: coverArtUrl || "placeholder-image-url.jpg",
            originalImageUrl: coverArtUrl || "placeholder-image-url.jpg",
          };
        })
      );

      return formattedAlbums.filter(
        (album) => album.imageUrl !== "placeholder-image-url.jpg"
      );
    } catch (error) {
      console.error("MusicBrainz search error:", error);
      throw error;
    }
  }, []);

  const searchItunes = useCallback(
    async (term) => {
      try {
        const response = await fetch(
          `https://itunes.apple.com/search?term=${encodeURIComponent(
            term
          )}&entity=album&limit=20`
        );

        if (!response.ok) {
          throw new Error("iTunes API error");
        }

        const data = await response.json();

        return data.results.map((album) => ({
          id: album.collectionId,
          title: album.collectionName,
          artist: album.artistName,
          year: new Date(album.releaseDate).getFullYear(),
          imageUrl: getFormattedImageUrl(album.artworkUrl100),
          originalImageUrl: album.artworkUrl100,
        }));
      } catch (error) {
        console.error("iTunes search error:", error);
        throw error;
      }
    },
    [getFormattedImageUrl]
  );

  const searchDiscogs = useCallback(async (term) => {
    try {
      const response = await fetch(
        `https://api.discogs.com/database/search?q=${encodeURIComponent(
          term
        )}&type=release&per_page=20`,
        {
          headers: {
            Authorization:
              "Discogs key=jHfarpEmBSFYbIXSJlEd, secret=MKHAyOJLtiJjKZBwdzdhcZcnQvvKoQTG",
            "User-Agent": "curroscube",
          },
        }
      );

      if (!response.ok) {
        throw new Error("Discogs API error");
      }

      const data = await response.json();

      return data.results
        .map((release) => ({
          id: release.id,
          title: release.title.split(" - ")[1] || release.title,
          artist: release.title.split(" - ")[0] || "Unknown Artist",
          year: release.year || "Unknown",
          imageUrl: release.thumb,
          originalImageUrl: release.cover_image,
        }))
        .filter((album) => album.imageUrl);
    } catch (error) {
      console.error("Discogs search error:", error);
      throw error;
    }
  }, []);

  const searchLastFm = useCallback(async (term) => {
    try {
      const API_KEY = "e4b5091e198eeec04d25bd50cadfd01e"; // You'll need to replace this with your API key
      const response = await fetch(
        `https://ws.audioscrobbler.com/2.0/?method=album.search&album=${encodeURIComponent(
          term
        )}&api_key=${API_KEY}&format=json&limit=20`
      );

      if (!response.ok) {
        throw new Error("Last.fm API error");
      }

      const data = await response.json();
      const albums = data.results?.albummatches?.album || [];

      return albums
        .map((album) => ({
          id: `lastfm-${album.mbid || album.url.split("/").pop()}`,
          title: album.name,
          artist: album.artist,
          year: "N/A", // Last.fm doesn't provide year in search results
          imageUrl: album.image[3]?.["#text"] || album.image[2]?.["#text"], // Get largest available image
          originalImageUrl:
            album.image[3]?.["#text"] || album.image[2]?.["#text"],
        }))
        .filter((album) => album.imageUrl);
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
            searchCache.set(cacheKey, results);
          } catch (error) {
            console.log("Switching to MusicBrainz due to iTunes error");
            setCurrentAPI("musicbrainz");
            try {
              results = await searchMusicBrainz(debouncedSearchTerm);
              searchCache.set(`musicbrainz:${debouncedSearchTerm}`, results);
            } catch (error) {
              console.log("Switching to Last.fm due to MusicBrainz error");
              setCurrentAPI("lastfm");
              try {
                results = await searchLastFm(debouncedSearchTerm);
                searchCache.set(`lastfm:${debouncedSearchTerm}`, results);
              } catch (error) {
                console.log("Switching to Discogs due to Last.fm error");
                setCurrentAPI("discogs");
                results = await searchDiscogs(debouncedSearchTerm);
                searchCache.set(`discogs:${debouncedSearchTerm}`, results);
              }
            }
          }
        } else if (currentAPI === "musicbrainz") {
          try {
            results = await searchMusicBrainz(debouncedSearchTerm);
            searchCache.set(cacheKey, results);
          } catch (error) {
            console.log("Switching to Last.fm due to MusicBrainz error");
            setCurrentAPI("lastfm");
            try {
              results = await searchLastFm(debouncedSearchTerm);
              searchCache.set(`lastfm:${debouncedSearchTerm}`, results);
            } catch (error) {
              console.log("Switching to Discogs due to Last.fm error");
              setCurrentAPI("discogs");
              try {
                results = await searchDiscogs(debouncedSearchTerm);
                searchCache.set(`discogs:${debouncedSearchTerm}`, results);
              } catch (error) {
                console.log("Switching back to iTunes");
                setCurrentAPI("itunes");
                results = await searchItunes(debouncedSearchTerm);
                searchCache.set(`itunes:${debouncedSearchTerm}`, results);
              }
            }
          }
        } else if (currentAPI === "lastfm") {
          try {
            results = await searchLastFm(debouncedSearchTerm);
            searchCache.set(cacheKey, results);
          } catch (error) {
            console.log("Switching to Discogs due to Last.fm error");
            setCurrentAPI("discogs");
            try {
              results = await searchDiscogs(debouncedSearchTerm);
              searchCache.set(`discogs:${debouncedSearchTerm}`, results);
            } catch (error) {
              console.log("Switching back to iTunes");
              setCurrentAPI("itunes");
              results = await searchItunes(debouncedSearchTerm);
              searchCache.set(`itunes:${debouncedSearchTerm}`, results);
            }
          }
        } else {
          try {
            results = await searchDiscogs(debouncedSearchTerm);
            searchCache.set(cacheKey, results);
          } catch (error) {
            console.log("Switching back to iTunes");
            setCurrentAPI("itunes");
            results = await searchItunes(debouncedSearchTerm);
            searchCache.set(`itunes:${debouncedSearchTerm}`, results);
          }
        }

        // Add a slight delay before showing results
        setTimeout(() => {
          setDebouncedResults(results);
          setIsLoading(false);
        }, 300);
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
    </div>
  );
}

export default App;
