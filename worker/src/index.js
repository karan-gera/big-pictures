// MusicBrainz asks for contact info in the User-Agent
const USER_AGENT = "bigpictures/1.0.0 ( https://bigpictures.xyz )";

// Last.fm returns this grey star image when an album has no artwork
const LASTFM_PLACEHOLDER = "2a96cbd8b46e442fc41c2b86b821562f";

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Handle OPTIONS request for CORS
async function handleOptions(request) {
  return new Response(null, {
    headers: corsHeaders,
  });
}

// Search Last.fm API
async function searchLastFm(term) {
  const API_KEY = LASTFM_API_KEY;
  const response = await fetch(
    `https://ws.audioscrobbler.com/2.0/?method=album.search&album=${encodeURIComponent(
      term
    )}&api_key=${API_KEY}&format=json&limit=20`
  );
  
  if (!response.ok) {
    throw new Error(`Last.fm API returned ${response.status}`);
  }
  
  const data = await response.json();
  const albums = data.results?.albummatches?.album || [];

  return albums
    .map((album, index) => {
      // Create unique ID: use MBID if available, otherwise combine album name and artist
      let uniqueId;
      if (album.mbid) {
        uniqueId = album.mbid;
      } else {
        // Create a unique identifier from album name and artist
        const albumSlug = album.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const artistSlug = album.artist.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        uniqueId = `${albumSlug}-${artistSlug}-${index}`;
      }
      return {
        id: `lastfm-${uniqueId}`,
        title: album.name,
        artist: album.artist,
        year: "N/A",
        imageUrl: album.image[3]?.["#text"] || album.image[2]?.["#text"],
        originalImageUrl: album.image[3]?.["#text"] || album.image[2]?.["#text"],
      };
    })
    .filter(
      (album) => album.imageUrl && !album.imageUrl.includes(LASTFM_PLACEHOLDER)
    );
}

// Search Discogs API
async function searchDiscogs(term) {
  const response = await fetch(
    `https://api.discogs.com/database/search?q=${encodeURIComponent(
      term
    )}&type=release&per_page=20`,
    {
      headers: {
        Authorization: `Discogs key=${DISCOGS_KEY}, secret=${DISCOGS_SECRET}`,
        "User-Agent": USER_AGENT,
      },
    }
  );
  
  if (!response.ok) {
    throw new Error(`Discogs API returned ${response.status}`);
  }
  
  const data = await response.json();
  
  if (!data.results || !Array.isArray(data.results)) {
    throw new Error("Invalid Discogs API response");
  }

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
}

// Search MusicBrainz API
async function searchMusicBrainz(term) {
  // Search for releases
  const response = await fetch(
    `https://musicbrainz.org/ws/2/release/?query=${encodeURIComponent(
      term
    )}&limit=20&fmt=json`,
    {
      headers: {
        "User-Agent": USER_AGENT,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`MusicBrainz API returned ${response.status}`);
  }

  const data = await response.json();
  const releases = data.releases || [];

  // Process releases and get cover art
  const results = await Promise.all(
    releases.map(async (release) => {
      // Extract artist name from artist-credit array
      const artistNames = release["artist-credit"]
        ? release["artist-credit"].map((ac) => {
            // Handle both formats: {artist: {name: ...}} and {name: ...}
            if (ac.artist && ac.artist.name) {
              return ac.artist.name;
            }
            return ac.name || "";
          })
        : [];
      const artist = artistNames.filter((name) => name).join(", ") || "Unknown Artist";

      // Extract year from date
      const dateStr = release.date || "";
      const year = dateStr ? new Date(dateStr).getFullYear() : "Unknown";

      // Check Cover Art Archive without following the redirect: 307 means the
      // art exists, 404 means it doesn't. Following it would download the image.
      const mbid = release.id;
      const coverArtBase = `https://coverartarchive.org/release/${mbid}`;
      let imageUrl = null;
      let originalImageUrl = null;

      try {
        const coverArtResponse = await fetch(`${coverArtBase}/front-250`, {
          method: "HEAD",
          redirect: "manual",
          headers: { "User-Agent": USER_AGENT },
        });
        if (coverArtResponse.status >= 300 && coverArtResponse.status < 400) {
          imageUrl = `${coverArtBase}/front-250`;
          originalImageUrl = `${coverArtBase}/front`;
        }
      } catch (error) {
        // Cover art not available, skip this release
      }

      return {
        id: mbid,
        title: release.title,
        artist: artist,
        year: year,
        imageUrl: imageUrl,
        originalImageUrl: originalImageUrl || imageUrl,
      };
    })
  );

  // Filter out releases without cover art
  return results.filter((album) => album.imageUrl);
}

// Main request handler
async function handleRequest(request) {
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return handleOptions(request);
  }

  // Only allow GET requests
  if (request.method !== "GET") {
    return new Response("Method not allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const url = new URL(request.url);
    const searchTerm = url.searchParams.get("q");
    // iTunes is queried directly from the browser - Apple blocks Worker IPs
    const api = url.searchParams.get("api");

    if (!searchTerm) {
      return new Response("Search term is required", {
        status: 400,
        headers: corsHeaders,
      });
    }

    let results;
    switch (api) {
      case "lastfm":
        results = await searchLastFm(searchTerm);
        break;
      case "discogs":
        results = await searchDiscogs(searchTerm);
        break;
      case "musicbrainz":
        results = await searchMusicBrainz(searchTerm);
        break;
      default:
        return new Response("Invalid API specified", {
          status: 400,
          headers: corsHeaders,
        });
    }

    return new Response(JSON.stringify(results), {
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  }
}

// Register the main request handler
addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event.request));
});
