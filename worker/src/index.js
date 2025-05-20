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

// Search iTunes API
async function searchItunes(term) {
  const response = await fetch(
    `https://itunes.apple.com/search?term=${encodeURIComponent(
      term
    )}&entity=album&limit=20`
  );
  const data = await response.json();
  return data.results.map((album) => ({
    id: album.collectionId,
    title: album.collectionName,
    artist: album.artistName,
    year: new Date(album.releaseDate).getFullYear(),
    imageUrl: album.artworkUrl100.replace("100x100", "600x600"),
    originalImageUrl: album.artworkUrl100,
  }));
}

// Search Last.fm API
async function searchLastFm(term) {
  const API_KEY = LASTFM_API_KEY;
  const response = await fetch(
    `https://ws.audioscrobbler.com/2.0/?method=album.search&album=${encodeURIComponent(
      term
    )}&api_key=${API_KEY}&format=json&limit=20`
  );
  const data = await response.json();
  const albums = data.results?.albummatches?.album || [];

  return albums
    .map((album) => ({
      id: `lastfm-${album.mbid || album.url.split("/").pop()}`,
      title: album.name,
      artist: album.artist,
      year: "N/A",
      imageUrl: album.image[3]?.["#text"] || album.image[2]?.["#text"],
      originalImageUrl: album.image[3]?.["#text"] || album.image[2]?.["#text"],
    }))
    .filter((album) => album.imageUrl);
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
        "User-Agent": "bigpictures/1.0.0",
      },
    }
  );
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
    const api = url.searchParams.get("api") || "itunes";

    if (!searchTerm) {
      return new Response("Search term is required", {
        status: 400,
        headers: corsHeaders,
      });
    }

    let results;
    switch (api) {
      case "itunes":
        results = await searchItunes(searchTerm);
        break;
      case "lastfm":
        results = await searchLastFm(searchTerm);
        break;
      case "discogs":
        results = await searchDiscogs(searchTerm);
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
