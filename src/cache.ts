export interface CacheEntry<T = unknown> {
  data: T;
  expiresAt: number;
}

export interface CacheOptions {
  ttl?: number;
}

export class Cache {
  private readonly store = new Map<string, CacheEntry>();
  private readonly pending = new Map<string, Promise<unknown>>();
  private readonly defaultTTL: number;

  constructor(defaultTTL: number = 300000) {
    this.defaultTTL = defaultTTL;
  }

  /**
   * Get cached data if present and not expired.
   */
  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.data as T;
  }

  /**
   * Set data in cache with optional TTL override.
   */
  set<T>(key: string, data: T, ttl?: number): void {
    const expiresAt = Date.now() + (ttl ?? this.defaultTTL);
    this.store.set(key, { data, expiresAt });
  }

  /**
   * Check if a key exists and is not expired.
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Delete a key from cache.
   */
  delete(key: string): void {
    this.store.delete(key);
  }

  /**
   * Clear all cache entries.
   */
  clear(): void {
    this.store.clear();
    this.pending.clear();
  }

  /**
   * Get cache size.
   */
  size(): number {
    return this.store.size;
  }

  /**
   * Get or set a pending request (deduplication).
   */
  getPending<T>(key: string): Promise<T> | undefined {
    return this.pending.get(key) as Promise<T> | undefined;
  }

  setPending<T>(key: string, promise: Promise<T>): void {
    this.pending.set(key, promise);
    promise.finally(() => {
      this.pending.delete(key);
    });
  }

  deletePending(key: string): void {
    this.pending.delete(key);
  }
}