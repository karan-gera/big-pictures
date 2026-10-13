import searchCache from "./searchCache";

const WORKER_URL =
  process.env.REACT_APP_WORKER_URL ||
  "https://album-search-api.karanrajsinghgera.workers.dev";

export const API_ORDER = ["itunes", "lastfm", "discogs", "musicbrainz"];

const API_NAMES = {
  itunes: "iTunes",
  lastfm: "Last.fm",
  discogs: "Discogs",
  musicbrainz: "MusicBrainz",
};

// Fetch and parse JSON with an abort timeout so one slow API can't stall the
// fallback chain. The timeout covers reading the body, not just the headers.
async function fetchJsonWithTimeout(url, timeoutMs, signal) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort);

  try {
    const response = await fetch(url, { signal: controller.signal });
    const data = await response.json();
    return { ok: response.ok, status: response.status, data };
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener("abort", abort);
  }
}

// iTunes is called straight from the browser: it needs no API key, allows
// CORS, and rate-limits/blocks requests coming from Cloudflare Worker IPs
async function searchItunes(term, signal) {
  const { ok, status, data } = await fetchJsonWithTimeout(
    `https://itunes.apple.com/search?term=${encodeURIComponent(
      term
    )}&entity=album&limit=20`,
    8000,
    signal
  );

  if (!ok) {
    throw new Error(`iTunes API returned ${status}`);
  }

  if (!Array.isArray(data.results)) {
    throw new Error("Invalid iTunes API response");
  }

  return data.results
    .filter((album) => album.artworkUrl100)
    .map((album) => ({
      id: album.collectionId,
      title: album.collectionName,
      artist: album.artistName,
      year: new Date(album.releaseDate).getFullYear(),
      imageUrl: album.artworkUrl100.replace("100x100", "600x600"),
      originalImageUrl: album.artworkUrl100,
    }));
}

// Last.fm, Discogs and MusicBrainz go through the worker, which holds the keys
async function searchViaWorker(api, term, signal) {
  const { ok, data } = await fetchJsonWithTimeout(
    `${WORKER_URL}/?q=${encodeURIComponent(term)}&api=${api}`,
    10000,
    signal
  );

  if (!ok || !Array.isArray(data)) {
    throw new Error(data?.error || `Invalid ${API_NAMES[api]} API response`);
  }

  return data;
}

export const searchers = {
  itunes: searchItunes,
  lastfm: (term, signal) => searchViaWorker("lastfm", term, signal),
  discogs: (term, signal) => searchViaWorker("discogs", term, signal),
  musicbrainz: (term, signal) => searchViaWorker("musicbrainz", term, signal),
};

// Try the preferred API first, then the rest in order. The fallback only
// applies to this search - the next search starts from the preferred API again.
export async function searchWithFallback(
  term,
  preferredAPI = "itunes",
  { signal, cache = searchCache, apis = searchers } = {}
) {
  const order = [
    preferredAPI,
    ...API_ORDER.filter((api) => api !== preferredAPI),
  ];
  let lastError = null;

  for (const api of order) {
    if (signal?.aborted) break;

    const cacheKey = `${api}:${term}`;
    const cachedResults = cache.get(cacheKey);
    if (cachedResults) {
      return { api, results: cachedResults };
    }

    try {
      const results = await apis[api](term, signal);
      // The search may have been cancelled while this API was responding
      if (signal?.aborted) break;
      if (results.length > 0) {
        cache.set(cacheKey, results);
        return { api, results };
      }
      console.log(`No results from ${API_NAMES[api]}, trying next API`);
    } catch (error) {
      if (signal?.aborted) break;
      console.log(`${API_NAMES[api]} failed (${error.message}), trying next API`);
      lastError = error;
    }
  }

  if (signal?.aborted) {
    return { api: null, results: [], aborted: true };
  }
  if (lastError) {
    console.error("All APIs failed:", lastError);
  }
  return { api: null, results: [] };
}
