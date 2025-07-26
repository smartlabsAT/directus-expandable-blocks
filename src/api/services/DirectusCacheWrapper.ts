import {
  CacheService,
  CacheServiceConfig,
  CacheOptions,
  CacheStats,
  CacheTTL
} from '../types/CacheTypes';

/**
 * Simple in-memory cache with TTL support
 */
interface CacheEntry<T> {
  value: T;
  expiresAt: number | null;
}

/**
 * Cache TTL Helper - all values in milliseconds
 */
export const CacheTTLHelper = {
  // Helper functions
  seconds: (n: number) => n * 1000,
  minutes: (n: number) => n * 60 * 1000,
  hours: (n: number) => n * 60 * 60 * 1000,
  days: (n: number) => n * 24 * 60 * 60 * 1000,

  // Presets (in milliseconds)
  SHORT: 5 * 60 * 1000,      // 5 minutes
  MEDIUM: 60 * 60 * 1000,    // 1 hour
  LONG: 24 * 60 * 60 * 1000, // 24 hours
  NONE: 0                     // No expiration
} as const;

/**
 * Wrapper around Directus Cache Service
 * Provides our cache interface with a built-in memory cache implementation
 */
export class DirectusCacheWrapper implements CacheService {
  private cache: Map<string, CacheEntry<any>>;
  private prefix: string;
  private defaultTTL: number;
  private maxKeys: number;
  private cleanupInterval: NodeJS.Timer | null = null;
  private nextExpirationCheck: number = Infinity;
  private logger: any;

  // Statistics
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    size: 0,
    type: 'memory'
  };

  constructor(config: CacheServiceConfig) {
    // Initialize in-memory cache
    this.cache = new Map();
    this.prefix = config.prefix || 'expandable_blocks';
    // Ensure defaultTTL is in milliseconds
    this.defaultTTL = config.defaultTTL || CacheTTLHelper.SHORT;
    this.maxKeys = config.maxKeys || 50000; // Allow configuration of max keys
    this.logger = config.services?.logger || console;

    // Note: In production, you might want to use Redis through Directus' cache service
    // For now, we use a simple in-memory implementation
    this.logger.debug(
        `[DirectusCacheWrapper] Initialized with in-memory cache (max ${this.maxKeys} keys, default TTL: ${this.defaultTTL}ms)`
    );

    // Start cleanup interval for expired entries
    this.startCleanupInterval();

    // Ensure cleanup on process exit to prevent memory leaks
    this.setupProcessHandlers();
  }

  /**
   * Get a value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const prefixedKey = this.getPrefixedKey(key);
      const entry = this.cache.get(prefixedKey);

      if (!entry) {
        this.stats.misses++;
        return null;
      }

      // Check if entry has expired
      if (entry.expiresAt && entry.expiresAt < Date.now()) {
        this.cache.delete(prefixedKey);
        this.stats.misses++;
        this.stats.size = this.cache.size;
        return null;
      }

      this.stats.hits++;
      return entry.value as T;
    } catch (error) {
      this.logger.error('[DirectusCacheWrapper] Get error:', error);
      this.stats.misses++;
      return null;
    }
  }

  /**
   * Set a value in cache
   */
  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    try {
      const prefixedKey = this.getPrefixedKey(key);
      // TTL should be in milliseconds
      const ttl = options?.ttl !== undefined ? options.ttl : this.defaultTTL;

      // Enforce max keys limit (simple LRU)
      if (this.cache.size >= this.maxKeys && !this.cache.has(prefixedKey)) {
        const firstKey = this.cache.keys().next().value;
        if (firstKey) {
          this.cache.delete(firstKey);
        }
      }

      const expiresAt = ttl > 0 ? Date.now() + ttl : null;
      this.cache.set(prefixedKey, { value, expiresAt });

      // Update next expiration check time
      if (expiresAt && expiresAt < this.nextExpirationCheck) {
        this.nextExpirationCheck = expiresAt;
      }

      this.stats.size = this.cache.size;
    } catch (error) {
      this.logger.error('[DirectusCacheWrapper] Set error:', error);
    }
  }

  /**
   * Delete a value from cache
   */
  async delete(key: string): Promise<void> {
    try {
      const prefixedKey = this.getPrefixedKey(key);
      this.cache.delete(prefixedKey);
      this.stats.size = this.cache.size;
    } catch (error) {
      this.logger.error('[DirectusCacheWrapper] Delete error:', error);
    }
  }

  /**
   * Get multiple values from cache
   */
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    // Batch get operations for better performance
    const results: (T | null)[] = [];

    for (const key of keys) {
      const value = await this.get<T>(key);
      results.push(value);
    }

    return results;
  }

  /**
   * Set multiple values in cache
   */
  async mset(items: { key: string; value: any; options?: CacheOptions }[]): Promise<void> {
    // Batch set operations for better performance
    for (const item of items) {
      await this.set(item.key, item.value, item.options);
    }
  }

  /**
   * Delete all keys matching a pattern
   */
  async deletePattern(pattern: string): Promise<number> {
    let deletedCount = 0;

    try {
      // Convert pattern to regex (support * wildcard)
      const regex = new RegExp(
          '^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$'
      );

      for (const key of this.cache.keys()) {
        if (regex.test(key)) {
          this.cache.delete(key);
          deletedCount++;
        }
      }

      this.stats.size = this.cache.size;
    } catch (error) {
      this.logger.error('[DirectusCacheWrapper] DeletePattern error:', error);
    }

    return deletedCount;
  }

  /**
   * Delete all keys with specific tags
   */
  async deleteTags(tags: string[]): Promise<number> {
    // Not supported by default in-memory cache
    this.logger.warn('[DirectusCacheWrapper] Tag-based delete not supported in memory cache');
    return 0;
  }

  /**
   * Check if a key exists in cache
   */
  async exists(key: string): Promise<boolean> {
    const prefixedKey = this.getPrefixedKey(key);
    const entry = this.cache.get(prefixedKey);

    if (!entry) {
      return false;
    }

    // Check if expired
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.cache.delete(prefixedKey);
      this.stats.size = this.cache.size;
      return false;
    }

    return true;
  }

  /**
   * Clear entire cache
   */
  async flush(): Promise<void> {
    try {
      this.cache.clear();
      this.stats.hits = 0;
      this.stats.misses = 0;
      this.stats.size = 0;
      this.nextExpirationCheck = Infinity;
      this.logger.debug('[DirectusCacheWrapper] Cache flushed');
    } catch (error) {
      this.logger.error('[DirectusCacheWrapper] Flush error:', error);
    }
  }

  /**
   * Get value from cache or set it using factory function
   */
  async getOrSet<T>(
      key: string,
      factory: () => Promise<T>,
      options?: CacheOptions
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      this.logger.debug(`[DirectusCacheWrapper] Cache HIT for key: ${key}`);
      return cached;
    }

    this.logger.debug(`[DirectusCacheWrapper] Cache MISS for key: ${key} - generating new value`);

    // Generate new value
    const value = await factory();

    // Store in cache
    await this.set(key, value, options);

    return value;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return {
      ...this.stats,
      hitRate: this.stats.hits + this.stats.misses > 0
          ? this.stats.hits / (this.stats.hits + this.stats.misses)
          : 0
    };
  }

  /**
   * Utility method to add prefix to keys
   */
  private getPrefixedKey(key: string): string {
    return `${this.prefix}:${key}`;
  }

  /**
   * Start cleanup interval for expired entries
   */
  private startCleanupInterval(): void {
    // Clean up expired entries every 30 seconds
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();

      // Skip if nothing should expire yet
      if (now < this.nextExpirationCheck) {
        return;
      }

      let deletedCount = 0;
      this.nextExpirationCheck = Infinity;

      for (const [key, entry] of this.cache.entries()) {
        if (entry.expiresAt) {
          if (entry.expiresAt < now) {
            this.cache.delete(key);
            deletedCount++;
          } else if (entry.expiresAt < this.nextExpirationCheck) {
            this.nextExpirationCheck = entry.expiresAt;
          }
        }
      }

      if (deletedCount > 0) {
        this.stats.size = this.cache.size;
        this.logger.debug(`[DirectusCacheWrapper] Cleaned up ${deletedCount} expired entries`);
      }
    }, 30000); // 30 seconds

    // Ensure the interval doesn't prevent Node.js from exiting
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Setup process handlers for cleanup
   */
  private setupProcessHandlers(): void {
    if (typeof process !== 'undefined' && process.on !== undefined) {
      const cleanup = () => {
        this.destroy();
      };

      // Handle different termination signals
      process.once('exit', cleanup);
      process.once('SIGINT', cleanup);
      process.once('SIGTERM', cleanup);
      process.once('SIGUSR1', cleanup);
      process.once('SIGUSR2', cleanup);
    }
  }

  /**
   * Destroy the service (cleanup resources)
   */
  destroy(): void {
    // Stop the cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval as any);
      this.cleanupInterval = null;
    }

    // Clear the cache
    this.cache.clear();

    this.logger.debug('[DirectusCacheWrapper] Cache service destroyed');
  }

  /**
   * Get the current size of the cache
   */
  getSize(): number {
    return this.cache.size;
  }

  /**
   * Get remaining TTL for a key (in milliseconds)
   */
  async getTTL(key: string): Promise<number | null> {
    const prefixedKey = this.getPrefixedKey(key);
    const entry = this.cache.get(prefixedKey);

    if (!entry || !entry.expiresAt) {
      return null;
    }

    const ttl = entry.expiresAt - Date.now();
    return ttl > 0 ? ttl : null;
  }
}