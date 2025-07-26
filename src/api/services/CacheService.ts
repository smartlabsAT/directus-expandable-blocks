import { Knex } from 'knex';
import {
  CacheService,
  CacheServiceConfig,
  CacheOptions,
  CacheEntry,
  CacheStats,
  CacheTTL
} from '../types/CacheTypes';

// Global memory cache shared across all instances
const globalMemoryCache = new Map<string, CacheEntry>();
const globalTagIndex = new Map<string, Set<string>>();

// Global cleanup interval
let globalCleanupInterval: NodeJS.Timer | null = null;

/**
 * Cache service implementation with Redis/Memory fallback
 */
export class CacheServiceImpl implements CacheService {
  private database: Knex;
  private services: any;
  private defaultTTL: number;
  private prefix: string;
  private redisClient?: any;
  private memoryCache: Map<string, CacheEntry>;
  private tagIndex: Map<string, Set<string>>; // tag -> keys mapping
  private useRedis: boolean = false;
  private cleanupInterval?: NodeJS.Timer;
  
  // Statistics
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    size: 0,
    type: 'memory'
  };

  constructor(config: CacheServiceConfig) {
    this.database = config.database;
    this.services = config.services;
    this.defaultTTL = config.defaultTTL || CacheTTL.SHORT;
    this.prefix = config.prefix || 'directus_api';
    
    // Use global memory cache
    this.memoryCache = globalMemoryCache;
    this.tagIndex = globalTagIndex;
    
    // Check for Redis availability
    this.checkRedisAvailability(config);
    
    // Start cleanup timer for memory cache (only once globally)
    if (!this.useRedis && !globalCleanupInterval) {
      this.startCleanupTimer();
    }
  }

  /**
   * Get a value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    const prefixedKey = this.getPrefixedKey(key);
    
    if (this.useRedis) {
      return this.getFromRedis<T>(prefixedKey);
    } else {
      return this.getFromMemory<T>(prefixedKey);
    }
  }

  /**
   * Set a value in cache
   */
  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    const prefixedKey = this.getPrefixedKey(key);
    const ttl = options?.ttl || this.defaultTTL;
    
    if (this.useRedis) {
      await this.setInRedis(prefixedKey, value, ttl, options?.tags);
    } else {
      await this.setInMemory(prefixedKey, value, ttl, options?.tags);
    }
  }

  /**
   * Delete a value from cache
   */
  async delete(key: string): Promise<void> {
    const prefixedKey = this.getPrefixedKey(key);
    
    if (this.useRedis) {
      await this.deleteFromRedis(prefixedKey);
    } else {
      await this.deleteFromMemory(prefixedKey);
    }
  }

  /**
   * Get multiple values from cache
   */
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    if (this.useRedis) {
      return this.mgetFromRedis<T>(keys.map(k => this.getPrefixedKey(k)));
    } else {
      return Promise.all(keys.map(key => this.get<T>(key)));
    }
  }

  /**
   * Set multiple values in cache
   */
  async mset(items: { key: string; value: any; options?: CacheOptions }[]): Promise<void> {
    if (this.useRedis) {
      // Redis MSET doesn't support individual TTLs, so we use pipeline
      const pipeline = this.redisClient.pipeline();
      
      for (const item of items) {
        const prefixedKey = this.getPrefixedKey(item.key);
        const ttl = item.options?.ttl || this.defaultTTL;
        const serialized = JSON.stringify(item.value);
        
        pipeline.setex(prefixedKey, ttl, serialized);
        
        // Handle tags
        if (item.options?.tags) {
          await this.addTagsToRedis(prefixedKey, item.options.tags);
        }
      }
      
      await pipeline.exec();
    } else {
      // Memory cache - set each item
      await Promise.all(
        items.map(item => this.set(item.key, item.value, item.options))
      );
    }
  }

  /**
   * Delete all keys matching a pattern
   */
  async deletePattern(pattern: string): Promise<number> {
    const prefixedPattern = this.getPrefixedKey(pattern);
    let deletedCount = 0;
    
    if (this.useRedis) {
      // Redis pattern delete
      const keys = await this.redisClient.keys(prefixedPattern);
      if (keys.length > 0) {
        await this.redisClient.del(...keys);
        deletedCount = keys.length;
      }
    } else {
      // Memory cache pattern delete
      const regex = this.patternToRegex(prefixedPattern);
      const keysToDelete: string[] = [];
      
      for (const key of this.memoryCache.keys()) {
        if (regex.test(key)) {
          keysToDelete.push(key);
        }
      }
      
      for (const key of keysToDelete) {
        await this.deleteFromMemory(key);
        deletedCount++;
      }
    }
    
    return deletedCount;
  }

  /**
   * Delete all keys with specific tags
   */
  async deleteTags(tags: string[]): Promise<number> {
    let deletedCount = 0;
    
    if (this.useRedis) {
      // Redis tag-based delete
      for (const tag of tags) {
        const tagKey = `${this.prefix}:tag:${tag}`;
        const keys = await this.redisClient.smembers(tagKey);
        
        if (keys.length > 0) {
          await this.redisClient.del(...keys);
          await this.redisClient.del(tagKey);
          deletedCount += keys.length;
        }
      }
    } else {
      // Memory cache tag-based delete
      const keysToDelete = new Set<string>();
      
      for (const tag of tags) {
        const taggedKeys = this.tagIndex.get(tag);
        if (taggedKeys) {
          taggedKeys.forEach(key => keysToDelete.add(key));
          this.tagIndex.delete(tag);
        }
      }
      
      for (const key of keysToDelete) {
        this.memoryCache.delete(key);
        deletedCount++;
      }
      
      this.stats.size = this.memoryCache.size;
    }
    
    return deletedCount;
  }

  /**
   * Check if a key exists in cache
   */
  async exists(key: string): Promise<boolean> {
    const prefixedKey = this.getPrefixedKey(key);
    
    if (this.useRedis) {
      return (await this.redisClient.exists(prefixedKey)) === 1;
    } else {
      const entry = this.memoryCache.get(prefixedKey);
      return entry !== undefined && !this.isExpired(entry);
    }
  }

  /**
   * Clear entire cache
   */
  async flush(): Promise<void> {
    if (this.useRedis) {
      // Clear all keys with our prefix
      const keys = await this.redisClient.keys(`${this.prefix}:*`);
      if (keys.length > 0) {
        await this.redisClient.del(...keys);
      }
    } else {
      this.memoryCache.clear();
      this.tagIndex.clear();
      this.stats.size = 0;
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
      console.log(`[CacheService] Cache HIT for key: ${key}`);
      return cached;
    }
    
    console.log(`[CacheService] Cache MISS for key: ${key} - generating new value`);
    
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
    return { ...this.stats };
  }

  /**
   * Cleanup expired entries (for memory cache)
   */
  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    for (const [key, entry] of this.memoryCache.entries()) {
      if (this.isExpired(entry)) {
        keysToDelete.push(key);
      }
    }
    
    for (const key of keysToDelete) {
      this.deleteFromMemory(key);
    }
  }

  /**
   * Check Redis availability
   */
  private async checkRedisAvailability(config: CacheServiceConfig): Promise<void> {
    try {
      // Check if Redis client was provided
      if (config.redisClient) {
        this.redisClient = config.redisClient;
        this.useRedis = true;
        this.stats.type = 'redis';
        console.log('[CacheService] Using provided Redis client');
        return;
      }

      // Check if Directus has Redis configured
      const env = process.env;
      if (env.CACHE_STORE === 'redis' || env.REDIS_HOST) {
        // Try to get Redis from Directus services
        if (this.services.cache?.client) {
          this.redisClient = this.services.cache.client;
          this.useRedis = true;
          this.stats.type = 'redis';
          console.log('[CacheService] Using Directus Redis cache');
        }
      }
    } catch (error) {
      console.log('[CacheService] Redis not available, using in-memory cache');
    }
  }

  /**
   * Memory cache operations
   */
  private async getFromMemory<T>(key: string): Promise<T | null> {
    const entry = this.memoryCache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }
    
    if (this.isExpired(entry)) {
      this.deleteFromMemory(key);
      this.stats.misses++;
      return null;
    }
    
    this.stats.hits++;
    return entry.value as T;
  }

  private async setInMemory(
    key: string,
    value: any,
    ttl: number,
    tags?: string[]
  ): Promise<void> {
    const entry: CacheEntry = {
      value,
      expires: Date.now() + (ttl * 1000),
      created: Date.now(),
      tags
    };
    
    this.memoryCache.set(key, entry);
    this.stats.size = this.memoryCache.size;
    
    // Update tag index
    if (tags) {
      for (const tag of tags) {
        if (!this.tagIndex.has(tag)) {
          this.tagIndex.set(tag, new Set());
        }
        this.tagIndex.get(tag)!.add(key);
      }
    }
  }

  private async deleteFromMemory(key: string): Promise<void> {
    const entry = this.memoryCache.get(key);
    if (entry) {
      // Remove from tag index
      if (entry.tags) {
        for (const tag of entry.tags) {
          const taggedKeys = this.tagIndex.get(tag);
          if (taggedKeys) {
            taggedKeys.delete(key);
            if (taggedKeys.size === 0) {
              this.tagIndex.delete(tag);
            }
          }
        }
      }
      
      this.memoryCache.delete(key);
      this.stats.size = this.memoryCache.size;
    }
  }

  /**
   * Redis operations
   */
  private async getFromRedis<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redisClient.get(key);
      
      if (!value) {
        this.stats.misses++;
        return null;
      }
      
      this.stats.hits++;
      return JSON.parse(value) as T;
    } catch (error) {
      console.error('[CacheService] Redis get error:', error);
      this.stats.misses++;
      return null;
    }
  }

  private async setInRedis(
    key: string,
    value: any,
    ttl: number,
    tags?: string[]
  ): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      await this.redisClient.setex(key, ttl, serialized);
      
      // Handle tags
      if (tags) {
        await this.addTagsToRedis(key, tags);
      }
    } catch (error) {
      console.error('[CacheService] Redis set error:', error);
    }
  }

  private async deleteFromRedis(key: string): Promise<void> {
    try {
      // Get tags before deletion
      const tags = await this.getTagsFromRedis(key);
      
      // Delete the key
      await this.redisClient.del(key);
      
      // Remove from tag sets
      if (tags.length > 0) {
        for (const tag of tags) {
          const tagKey = `${this.prefix}:tag:${tag}`;
          await this.redisClient.srem(tagKey, key);
        }
      }
    } catch (error) {
      console.error('[CacheService] Redis delete error:', error);
    }
  }

  private async mgetFromRedis<T>(keys: string[]): Promise<(T | null)[]> {
    try {
      const values = await this.redisClient.mget(keys);
      
      return values.map((value: string | null) => {
        if (!value) {
          this.stats.misses++;
          return null;
        }
        
        this.stats.hits++;
        return JSON.parse(value) as T;
      });
    } catch (error) {
      console.error('[CacheService] Redis mget error:', error);
      return keys.map(() => null);
    }
  }

  private async addTagsToRedis(key: string, tags: string[]): Promise<void> {
    // Store tags with the key
    const tagSetKey = `${key}:tags`;
    await this.redisClient.sadd(tagSetKey, ...tags);
    await this.redisClient.expire(tagSetKey, this.defaultTTL);
    
    // Add key to tag sets
    for (const tag of tags) {
      const tagKey = `${this.prefix}:tag:${tag}`;
      await this.redisClient.sadd(tagKey, key);
      await this.redisClient.expire(tagKey, 86400); // 24 hours
    }
  }

  private async getTagsFromRedis(key: string): Promise<string[]> {
    try {
      const tagSetKey = `${key}:tags`;
      return await this.redisClient.smembers(tagSetKey) || [];
    } catch {
      return [];
    }
  }

  /**
   * Utility methods
   */
  private getPrefixedKey(key: string): string {
    return `${this.prefix}:${key}`;
  }

  private isExpired(entry: CacheEntry): boolean {
    return Date.now() > entry.expires;
  }

  private patternToRegex(pattern: string): RegExp {
    // Convert Redis-style pattern to RegExp
    const escaped = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    return new RegExp(`^${escaped}$`);
  }

  private startCleanupTimer(): void {
    // Run cleanup every minute
    globalCleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
    this.cleanupInterval = globalCleanupInterval;
  }

  /**
   * Destroy the service (cleanup resources)
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval as any);
    }
  }
}