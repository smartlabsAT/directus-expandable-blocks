import {
  CacheService,
  CacheServiceConfig,
  CacheOptions,
  CacheStats,
  CacheTTL
} from '../types/CacheTypes';
import { getLogger } from '../utils/logger-utils';

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
  private ttlOverrides: CacheServiceConfig['ttlOverrides'];

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
    this.ttlOverrides = config.ttlOverrides;
    this.logger = getLogger(config.services);

    // Note: In production, you might want to use Redis through Directus' cache service
    // For now, we use a simple in-memory implementation
    this.logger.debug(
        `[DirectusCacheWrapper] Initialized with in-memory cache (max ${this.maxKeys} keys, default TTL: ${this.defaultTTL}ms)`
    );
    
    if (this.ttlOverrides) {
      this.logger.debug(`[DirectusCacheWrapper] TTL overrides configured:`, this.ttlOverrides);
    }

    // Start cleanup interval for expired entries
    this.startCleanupInterval();

    // Ensure cleanup on process exit to prevent memory leaks
    this.setupProcessHandlers();
  }

  /**
   * Get a value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    const prefixedKey = this.getPrefixedKey(key);
    const entry = this.cache.get(prefixedKey);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if entry has expired
    if (this.isExpired(entry)) {
      this.deleteEntry(prefixedKey);
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    return entry.value as T;
  }

  /**
   * Set a value in cache
   */
  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    const prefixedKey = this.getPrefixedKey(key);
    // TTL should be in milliseconds
    const ttl = options?.ttl !== undefined ? options.ttl : this.defaultTTL;

    // Enforce max keys limit (simple LRU)
    if (this.cache.size >= this.maxKeys && !this.cache.has(prefixedKey)) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.deleteEntry(firstKey);
      }
    }

    const expiresAt = ttl > 0 ? Date.now() + ttl : null;
    this.cache.set(prefixedKey, { value, expiresAt });

    // Update next expiration check time
    if (expiresAt && expiresAt < this.nextExpirationCheck) {
      this.nextExpirationCheck = expiresAt;
    }

    this.updateStats();
  }

  /**
   * Delete a value from cache
   */
  async delete(key: string): Promise<void> {
    const prefixedKey = this.getPrefixedKey(key);
    this.deleteEntry(prefixedKey);
  }

  /**
   * Get multiple values from cache
   */
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    return Promise.all(keys.map(key => this.get<T>(key)));
  }

  /**
   * Set multiple values in cache
   */
  async mset(items: { key: string; value: any; options?: CacheOptions }[]): Promise<void> {
    await Promise.all(
      items.map(item => this.set(item.key, item.value, item.options))
    );
  }

  /**
   * Delete all keys matching a pattern
   */
  async deletePattern(pattern: string): Promise<number> {
    let deletedCount = 0;
    
    // Convert pattern to regex (support * wildcard)
    const regex = new RegExp(
      '^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$'
    );

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.deleteEntry(key);
        deletedCount++;
      }
    }

    return deletedCount;
  }

  /**
   * Delete all keys with specific tags
   */
  async deleteTags(_tags: string[]): Promise<number> {
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
    if (this.isExpired(entry)) {
      this.deleteEntry(prefixedKey);
      return false;
    }

    return true;
  }

  /**
   * Clear entire cache
   */
  async flush(): Promise<void> {
    this.cache.clear();
    this.stats.hits = 0;
    this.stats.misses = 0;
    this.stats.size = 0;
    this.nextExpirationCheck = Infinity;
    this.logger.debug('[DirectusCacheWrapper] Cache flushed');
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
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      hitRate: total > 0 ? this.stats.hits / total : 0
    };
  }

  /**
   * Utility method to add prefix to keys
   */
  private getPrefixedKey(key: string): string {
    return `${this.prefix}:${key}`;
  }

  /**
   * Check if a cache entry has expired
   */
  private isExpired(entry: CacheEntry<any>): boolean {
    return entry.expiresAt !== null && entry.expiresAt < Date.now();
  }

  /**
   * Update cache statistics
   */
  private updateStats(): void {
    this.stats.size = this.cache.size;
  }

  /**
   * Delete an entry and update stats
   */
  private deleteEntry(key: string): void {
    this.cache.delete(key);
    this.updateStats();
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
            this.deleteEntry(key);
            deletedCount++;
          } else if (entry.expiresAt < this.nextExpirationCheck) {
            this.nextExpirationCheck = entry.expiresAt;
          }
        }
      }

      if (deletedCount > 0) {
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
   * Get TTL for a specific data type
   * @param dataType The type of data being cached
   * @returns TTL in milliseconds
   */
  getTTLForDataType(dataType: string): number {
    if (this.ttlOverrides && this.ttlOverrides[dataType] !== undefined) {
      return this.ttlOverrides[dataType];
    }
    return this.defaultTTL;
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

}