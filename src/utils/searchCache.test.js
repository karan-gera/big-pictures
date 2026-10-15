import { LRUCache } from "./searchCache";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

test("reading from the cache doesn't write to localStorage", () => {
  const cache = new LRUCache();
  cache.set("itunes:kid a", ["result"]);
  const setItem = vi.spyOn(Storage.prototype, "setItem");

  expect(cache.get("itunes:kid a")).toEqual(["result"]);
  expect(cache.get("itunes:missing")).toBeNull();

  expect(setItem).not.toHaveBeenCalled();
});

test("entries survive a reload", () => {
  new LRUCache().set("itunes:kid a", ["result"]);

  expect(new LRUCache().get("itunes:kid a")).toEqual(["result"]);
});

test("a read still counts as recent use once the cache is next saved", () => {
  const cache = new LRUCache(2);
  cache.set("a", 1);
  cache.set("b", 2);
  cache.get("a");
  cache.set("c", 3); // evicts "b", the least recently used

  const reloaded = new LRUCache(2);
  expect(reloaded.get("a")).toBe(1);
  expect(reloaded.get("b")).toBeNull();
  expect(reloaded.get("c")).toBe(3);
});

test("expired entries are not returned, even after a reload", () => {
  vi.spyOn(Date, "now").mockReturnValue(0);
  new LRUCache().set("a", 1);

  Date.now.mockReturnValue(2 * 60 * 60 * 1000);
  expect(new LRUCache().get("a")).toBeNull();
});
