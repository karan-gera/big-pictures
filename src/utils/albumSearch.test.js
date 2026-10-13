import { searchWithFallback } from "./albumSearch";

const album = (id) => ({ id, title: "t", artist: "a", imageUrl: "u" });

function makeCache() {
  const store = new Map();
  return {
    get: (key) => store.get(key) ?? null,
    set: (key, value) => store.set(key, value),
    store,
  };
}

function makeApis(overrides = {}) {
  return {
    itunes: jest.fn().mockResolvedValue([album("itunes")]),
    lastfm: jest.fn().mockResolvedValue([album("lastfm")]),
    discogs: jest.fn().mockResolvedValue([album("discogs")]),
    musicbrainz: jest.fn().mockResolvedValue([album("musicbrainz")]),
    ...overrides,
  };
}

beforeEach(() => {
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

test("uses the preferred API when it succeeds", async () => {
  const apis = makeApis();
  const result = await searchWithFallback("kid a", "itunes", {
    cache: makeCache(),
    apis,
  });

  expect(result.api).toBe("itunes");
  expect(apis.lastfm).not.toHaveBeenCalled();
});

test("falls back in order when APIs fail or return nothing", async () => {
  const apis = makeApis({
    itunes: jest.fn().mockRejectedValue(new Error("403")),
    lastfm: jest.fn().mockResolvedValue([]),
  });
  const cache = makeCache();
  const result = await searchWithFallback("kid a", "itunes", { cache, apis });

  expect(result.api).toBe("discogs");
  expect(cache.store.has("discogs:kid a")).toBe(true);
  expect(apis.musicbrainz).not.toHaveBeenCalled();
});

test("a fallback does not stick: the next search starts from the preferred API", async () => {
  const itunes = jest
    .fn()
    .mockRejectedValueOnce(new Error("429"))
    .mockResolvedValue([album("itunes")]);
  const apis = makeApis({ itunes });
  const cache = makeCache();

  const first = await searchWithFallback("kid a", "itunes", { cache, apis });
  const second = await searchWithFallback("ok computer", "itunes", {
    cache,
    apis,
  });

  expect(first.api).toBe("lastfm");
  expect(second.api).toBe("itunes");
});

test("returns cached results without calling the API", async () => {
  const apis = makeApis();
  const cache = makeCache();
  cache.set("itunes:kid a", [album("cached")]);

  const result = await searchWithFallback("kid a", "itunes", { cache, apis });

  expect(result.results[0].id).toBe("cached");
  expect(apis.itunes).not.toHaveBeenCalled();
});

test("returns empty results when every API fails", async () => {
  const fail = () => jest.fn().mockRejectedValue(new Error("down"));
  const apis = makeApis({
    itunes: fail(),
    lastfm: fail(),
    discogs: fail(),
    musicbrainz: fail(),
  });

  const result = await searchWithFallback("kid a", "itunes", {
    cache: makeCache(),
    apis,
  });

  expect(result).toEqual({ api: null, results: [] });
});

test("stops trying APIs once the search is aborted", async () => {
  const controller = new AbortController();
  const apis = makeApis({
    itunes: jest.fn().mockImplementation(async () => {
      controller.abort();
      throw new Error("aborted");
    }),
  });

  const result = await searchWithFallback("kid a", "itunes", {
    signal: controller.signal,
    cache: makeCache(),
    apis,
  });

  expect(result.aborted).toBe(true);
  expect(apis.lastfm).not.toHaveBeenCalled();
});
