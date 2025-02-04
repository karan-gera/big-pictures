import React, { useState, useCallback, useEffect } from "react";
import Result from "./components/Result";
import "./App.css";

function App() {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [debouncedResults, setDebouncedResults] = useState([]);
  const [currentAPI, setCurrentAPI] = useState("itunes"); // Track which API we're using

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

        // Try iTunes first
        if (currentAPI === "itunes") {
          try {
            results = await searchItunes(debouncedSearchTerm);
          } catch (error) {
            console.log("Switching to MusicBrainz due to iTunes error");
            setCurrentAPI("musicbrainz");
            results = await searchMusicBrainz(debouncedSearchTerm);
          }
        } else {
          // Try MusicBrainz
          try {
            results = await searchMusicBrainz(debouncedSearchTerm);
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
  }, [debouncedSearchTerm, currentAPI, searchItunes, searchMusicBrainz]);

  const handleSearch = useCallback((event) => {
    const term = event.target.value;
    setSearchTerm(term);
    setDebouncedResults([]); // Clear results immediately when typing
  }, []);

  return (
    <div className="App">
      <h1 className="site-title">big.pictures</h1>
      <div className="search-container">
        <input
          type="text"
          className="search-input"
          placeholder="Enter Album/Single Name"
          value={searchTerm}
          onChange={handleSearch}
        />
      </div>

      <div className="results-grid">
        {isLoading ? (
          <div className="loading">Searching...</div>
        ) : (
          debouncedResults.map((album) => (
            <Result key={album.id} album={album} />
          ))
        )}
      </div>
    </div>
  );
}

export default App;
