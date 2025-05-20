class LRUCache {
  constructor(capacity = 20) {
    this.capacity = capacity;
    this.cache = new Map();
    this.expiryTime = 1000 * 60 * 60; // 1 hour
    this.STORAGE_KEY = "bigpictures_search_cache";
    this.loadFromStorage();
  }

  loadFromStorage() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const { cache } = JSON.parse(stored);

        // Convert the plain object back to a Map
        this.cache = new Map(Object.entries(cache));

        // Clean expired entries
        const now = Date.now();
        for (const [key, item] of this.cache.entries()) {
          if (now - item.timestamp > this.expiryTime) {
            this.cache.delete(key);
          }
        }

        // Ensure we don't exceed capacity
        while (this.cache.size > this.capacity) {
          this.cache.delete(this.cache.keys().next().value);
        }

        this.saveToStorage();
      }
    } catch (error) {
      console.warn("Failed to load cache from localStorage:", error);
      this.cache.clear();
    }
  }

  saveToStorage() {
    try {
      // Convert Map to plain object for storage
      const cacheObj = Object.fromEntries(this.cache.entries());
      localStorage.setItem(
        this.STORAGE_KEY,
        JSON.stringify({
          cache: cacheObj,
          timestamp: Date.now(),
        })
      );
    } catch (error) {
      console.warn("Failed to save cache to localStorage:", error);
    }
  }

  get(key) {
    if (!this.cache.has(key)) return null;

    const item = this.cache.get(key);

    // Check if cache entry has expired
    if (Date.now() - item.timestamp > this.expiryTime) {
      this.cache.delete(key);
      this.saveToStorage();
      return null;
    }

    // Remove and re-add to put it at the end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, item);
    this.saveToStorage();

    return item.value;
  }

  set(key, value) {
    // If key exists, remove it first
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    // If we're at capacity, remove the least recently used item (first item)
    else if (this.cache.size >= this.capacity) {
      this.cache.delete(this.cache.keys().next().value);
    }

    // Add new item
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
    });

    this.saveToStorage();
  }

  clear() {
    this.cache.clear();
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      console.warn("Failed to clear localStorage cache:", error);
    }
  }
}

// Create a singleton instance
const searchCache = new LRUCache();

export default searchCache;
