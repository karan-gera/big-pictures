// MusicBrainz asks for contact info in the User-Agent
const USER_AGENT = "bigpictures/1.0.0 ( https://bigpictures.xyz )";

// Last.fm returns this grey star image when an album has no artwork
const LASTFM_PLACEHOLDER = "2a96cbd8b46e442fc41c2b86b821562f";

// Only these sites may call the worker from a browser, so other sites can't
// use it as a proxy and spend our API quota
const ALLOWED_ORIGINS = [
  /^https:\/\/(www\.)?bigpictures\.xyz$/,
  /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
];

// Search results barely change, so cache them at the edge. Every cached hit is
// a request that doesn't count against the APIs' per-IP rate limits.
const CACHE_TTL_SECONDS = 6 * 60 * 60;

function isAllowedOrigin(origin) {
  return ALLOWED_ORIGINS.some((pattern) => pattern.test(origin));
}

// Whether a request is allowed depends on Origin and Sec-Fetch-Site (see
// isAllowedRequest), so every response says so, or a downstream cache could
// serve an allowed response to a request that should be rejected
const VARY = "Origin, Sec-Fetch-Site";

function corsHeaders(origin) {
  if (!origin) return { Vary: VARY };
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: VARY,
  };
}

// Browsers send Origin on CORS requests, but not on no-cors ones (e.g. an
// <img> or fetch(..., { mode: "no-cors" }) on another site). Those still carry
// Sec-Fetch-Site, so use it to reject cross-site requests without an Origin.
// Clients that send neither header (curl, scripts) are allowed for testing;
// they can fake any header anyway.
function isAllowedRequest(request) {
  const origin = request.headers.get("Origin");
  if (origin) return isAllowedOrigin(origin);
  const fetchSite = request.headers.get("Sec-Fetch-Site");
  return fetchSite !== "cross-site" && fetchSite !== "same-site";
}

function jsonResponse(body, status, origin, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(origin),
      ...extraHeaders,
    },
  });
}

// Search Last.fm API
async function searchLastFm(term, env) {
  const response = await fetch(
    `https://ws.audioscrobbler.com/2.0/?method=album.search&album=${encodeURIComponent(
      term
    )}&api_key=${env.LASTFM_API_KEY}&format=json&limit=20`
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
async function searchDiscogs(term, env) {
  const response = await fetch(
    `https://api.discogs.com/database/search?q=${encodeURIComponent(
      term
    )}&type=release&per_page=20`,
    {
      headers: {
        Authorization: `Discogs key=${env.DISCOGS_KEY}, secret=${env.DISCOGS_SECRET}`,
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

// Absolute URL a redirect points to, or the fallback if it has no usable Location
function redirectTarget(response, requestUrl) {
  try {
    const location = response.headers.get("Location");
    return location ? new URL(location, requestUrl).href : requestUrl;
  } catch {
    return requestUrl;
  }
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
      // The redirect target is the thumbnail itself, so the browser can load it
      // without the extra hop.
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
          imageUrl = redirectTarget(coverArtResponse, `${coverArtBase}/front-250`);
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

const SEARCHERS = {
  // iTunes is queried directly from the browser - Apple blocks Worker IPs
  lastfm: searchLastFm,
  discogs: searchDiscogs,
  musicbrainz: searchMusicBrainz,
};

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get("Origin");

    if (!isAllowedRequest(request)) {
      return new Response("Origin not allowed", {
        status: 403,
        headers: { Vary: VARY },
      });
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (request.method !== "GET") {
      return new Response("Method not allowed", {
        status: 405,
        headers: corsHeaders(origin),
      });
    }

    const url = new URL(request.url);
    const searchTerm = url.searchParams.get("q")?.trim();
    const api = url.searchParams.get("api");

    if (!searchTerm) {
      return new Response("Search term is required", {
        status: 400,
        headers: corsHeaders(origin),
      });
    }

    // Object.hasOwn so names like "constructor" don't resolve to Object methods
    const search = Object.hasOwn(SEARCHERS, api) ? SEARCHERS[api] : null;
    if (!search) {
      return new Response("Invalid API specified", {
        status: 400,
        headers: corsHeaders(origin),
      });
    }

    // Cache by API and trimmed term. Case is kept: MusicBrainz treats
    // uppercase OR/AND as operators, so "a OR b" and "a or b" differ. CORS
    // headers are added per request, so the cached copy has none.
    const cache = caches.default;
    const cacheKey = new Request(
      `${url.origin}/?api=${api}&q=${encodeURIComponent(searchTerm)}`
    );

    const cached = await cache.match(cacheKey);
    if (cached) {
      return jsonResponse(await cached.json(), 200, origin, { "X-Cache": "HIT" });
    }

    let results;
    try {
      results = await search(searchTerm, env);
    } catch (error) {
      return jsonResponse({ error: error.message }, 502, origin);
    }

    // Don't cache empty results: they may come from an upstream hiccup
    if (results.length > 0) {
      const cacheable = new Response(JSON.stringify(results), {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": `public, max-age=${CACHE_TTL_SECONDS}`,
        },
      });
      ctx.waitUntil(cache.put(cacheKey, cacheable));
    }

    return jsonResponse(results, 200, origin, { "X-Cache": "MISS" });
  },
};
