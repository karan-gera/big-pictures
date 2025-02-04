import React, { useState, useCallback, useEffect, useRef } from "react";
import Result from "./components/Result";
import "./App.css";

function App() {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [debouncedResults, setDebouncedResults] = useState([]);
  const [currentAPI, setCurrentAPI] = useState("itunes"); // Track which API we're using
  const [isDarkMode, setIsDarkMode] = useState(true);
  const resultsRef = useRef(null);

  useEffect(() => {
    document.documentElement.setAttribute(
      "data-theme",
      isDarkMode ? "dark" : "light"
    );
  }, [isDarkMode]);

  const toggleTheme = useCallback(() => {
    setIsDarkMode((prev) => !prev);
  }, []);

  // Handle the debounced search term
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  const getFormattedImageUrl = useCallback((url, size = "600x600") => {
    // Extract the base URL up to .jpg
    const baseUrl = url.match(/(.*?\.jpg)/)[0];
    return `${baseUrl}/${size}bb.jpg`;
  }, []);

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

  // Only make API call when debouncedSearchTerm changes
  useEffect(() => {
    const searchAlbums = async () => {
      if (!debouncedSearchTerm) {
        setDebouncedResults([]);
        return;
      }

      setIsLoading(true);
      try {
        let results;

        // Try each API in sequence
        if (currentAPI === "itunes") {
          try {
            results = await searchItunes(debouncedSearchTerm);
          } catch (error) {
            console.log("Switching to MusicBrainz due to iTunes error");
            setCurrentAPI("musicbrainz");
            try {
              results = await searchMusicBrainz(debouncedSearchTerm);
            } catch (error) {
              console.log("Switching to Discogs due to MusicBrainz error");
              setCurrentAPI("discogs");
              results = await searchDiscogs(debouncedSearchTerm);
            }
          }
        } else if (currentAPI === "musicbrainz") {
          try {
            results = await searchMusicBrainz(debouncedSearchTerm);
          } catch (error) {
            console.log("Switching to Discogs due to MusicBrainz error");
            setCurrentAPI("discogs");
            try {
              results = await searchDiscogs(debouncedSearchTerm);
            } catch (error) {
              console.log("Switching back to iTunes");
              setCurrentAPI("itunes");
              results = await searchItunes(debouncedSearchTerm);
            }
          }
        } else {
          try {
            results = await searchDiscogs(debouncedSearchTerm);
          } catch (error) {
            console.log("Switching back to iTunes");
            setCurrentAPI("itunes");
            results = await searchItunes(debouncedSearchTerm);
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

      <div className="header-section">
        <h1
          className="site-title"
          onClick={handleTitleClick}
          role="button"
          tabIndex={0}
        >
          big.pictures
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
      </div>

      <div className="results-section">
        <div className="results-grid" ref={resultsRef}>
          {isLoading ? (
            <div className="loading">
              <div className="loading-dot"></div>
              <div className="loading-dot"></div>
              <div className="loading-dot"></div>
            </div>
          ) : (
            debouncedResults.map((album) => (
              <Result key={album.id} album={album} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
