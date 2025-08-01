import {
  CacheService, CacheServiceConfig, CacheOptions, CacheStats
} from '../types/CacheTypes';
import { createServiceLogger } from '../utils/logger-utils';



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
  minutes: (n: number) => n * 60 * 1000,
  hours: (n: number) => n * 60 * 60 * 1000,

  // Presets (in milliseconds)
  SHORT: 5 * 60 * 1000,      // 5 minutes
  MEDIUM: 60 * 60 * 1000,    // 1 hour
  LONG: 24 * 60 * 60 * 1000, // 24 hours
  NONE: 0,                     // No expiration
} as const;


/**
 * Wrapper around Directus Cache Service
 * Provides our cache interface with a built-in memory cache implementation
 */
export class DirectusCacheWrapper implements CacheService {
  private readonly cache: Map<string, CacheEntry<any>>;
  private readonly prefix: string;
  private readonly defaultTTL: number;
  private readonly maxKeys: number;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private nextExpirationCheck: number = Infinity;
  private readonly logger: ReturnType<typeof createServiceLogger>;
  private readonly ttlOverrides: CacheServiceConfig['ttlOverrides'];

  // Statistics
  private stats: CacheStats = {
    hits: 0, misses: 0, size: 0, type: 'memory',
  };

  constructor(config: CacheServiceConfig) {
    // Initialize in-memory cache
    this.cache = new Map();
    this.prefix = config.prefix || 'expandable_blocks';
    // Ensure defaultTTL is in milliseconds
    this.defaultTTL = config.defaultTTL || CacheTTLHelper.SHORT;
    this.maxKeys = config.maxKeys || 50000; // Allow configuration of max keys
    this.ttlOverrides = config.ttlOverrides;
    this.logger = createServiceLogger('DirectusCacheWrapper', config.services);

    // Note: In production, you might want to use Redis through Directus' cache service
    // For now, we use a simple in-memory implementation
    this.logger.debug(`Initialized with in-memory cache (max ${this.maxKeys} keys, default TTL: ${this.defaultTTL}ms)`);

    if (this.ttlOverrides) {
      this.logger.debug(`TTL overrides configured:`, this.ttlOverrides);
    }

    this.setupProcessHandlers();
  }

  /**
   * Get a value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    const prefixedKey = this.getPrefixedKey(key);
    const entry = this.cache.get(prefixedKey);

    if (!entry || this.isExpired(entry)) {
      if (entry) this.deleteEntry(prefixedKey);
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
    const ttl = options?.ttl ?? this.defaultTTL;

    if (this.cache.size >= this.maxKeys && !this.cache.has(prefixedKey)) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.deleteEntry(firstKey);
    }

    const expiresAt = ttl > 0 ? Date.now() + ttl : null;
    this.cache.set(prefixedKey, {value, expiresAt});

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
  async multiGet<T>(keys: string[]): Promise<(T | null)[]> {
    return Promise.all(keys.map(key => this.get<T>(key)));
  }

  /**
   * Set multiple values in cache
   */
  async multiSet(items: { key: string; value: any; options?: CacheOptions }[]): Promise<void> {
    await Promise.all(items.map(item => this.set(item.key, item.value, item.options)));
  }

  /**
   * Delete all keys matching a pattern
   */
  async deletePattern(pattern: string): Promise<number> {
    let deletedCount = 0;

    // Convert pattern to regex (support * wildcard)
    const regex = new RegExp('^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');

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
    const entry = this.cache.get(this.getPrefixedKey(key));
    if (!entry || this.isExpired(entry)) {
      if (entry) this.deleteEntry(this.getPrefixedKey(key));
      return false;
    }
    return true;
  }

  /**
   * Clear entire cache
   */
  async flush(): Promise<void> {
    this.cache.clear();
    this.stats = {hits: 0, misses: 0, size: 0, type: 'memory'};
    this.nextExpirationCheck = Infinity;
    this.logger.debug('[DirectusCacheWrapper] Cache flushed');
  }

  /**
   * Get value from cache or set it using factory function
   */
  async getOrSet<T>(key: string, factory: () => Promise<T>, options?: CacheOptions): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;
    const value = await factory();
    await this.set(key, value, options);
    return value;
  }


  /**
   * Utility method to add prefix to keys
   */
  private getPrefixedKey = (key: string): string => `${this.prefix}:${key}`;

  /**
   * Check if a cache entry has expired
   */
  private isExpired(entry: CacheEntry<any>): boolean {
    return !!entry.expiresAt && entry.expiresAt < Date.now();
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