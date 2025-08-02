import { Knex } from 'knex';

/**
 * Configuration for CacheService
 */
export interface CacheServiceConfig {
  /** Database connection */
  database: Knex;
  
  /** Directus services object */
  services: any;
  
  /** Default TTL in milliseconds (default: 5 minutes) */
  defaultTTL?: number;
  
  /** Prefix for all cache keys (default: 'directus_api') */
  prefix?: string;
  
  /** Optional Redis client if available */
  redisClient?: any;
  
  /** Maximum number of keys to store (default: 10000) */
  maxKeys?: number;
  
  /** TTL overrides for specific data types (in milliseconds) */
  ttlOverrides?: {
    metadata?: number;
    search?: number;
    detail?: number;
    paths?: number;
    [key: string]: number | undefined;
  };
}

/**
 * Options for cache operations
 */
export interface CacheOptions {
  /** Time to live in milliseconds */
  ttl?: number;
  
  /** Tags for grouped invalidation */
  tags?: string[];
}

/**
 * Internal cache entry structure
 */
export interface CacheEntry {
  /** The cached value */
  value: any;
  
  /** Expiration timestamp */
  expires: number;
  
  /** Associated tags */
  tags?: string[];
  
  /** Creation timestamp */
  created: number;
}

/**
 * Cache service interface
 */
export interface CacheService {
  /**
   * Get a value from cache
   * @param key Cache key
   * @returns Cached value or null if not found/expired
   */
  get<T>(key: string): Promise<T | null>;
  
  /**
   * Set a value in cache
   * @param key Cache key
   * @param value Value to cache
   * @param options Cache options
   */
  set<T>(key: string, value: T, options?: CacheOptions): Promise<void>;
  
  /**
   * Delete a value from cache
   * @param key Cache key
   */
  delete(key: string): Promise<void>;
  
  /**
   * Get multiple values from cache
   * @param keys Array of cache keys
   * @returns Array of values (null for missing/expired)
   */
  multiGet<T>(keys: string[]): Promise<(T | null)[]>;
  
  /**
   * Set multiple values in cache
   * @param items Array of cache items
   */
  multiSet(items: { key: string; value: any; options?: CacheOptions }[]): Promise<void>;
  
  /**
   * Delete all keys matching a pattern
   * @param pattern Pattern to match (e.g., "collection:*")
   * @returns Number of deleted keys
   */
  deletePattern(pattern: string): Promise<number>;
  
  /**
   * Delete all keys with specific tags
   * @param tags Tags to match
   * @returns Number of deleted keys
   */
  deleteTags(tags: string[]): Promise<number>;
  
  /**
   * Check if a key exists in cache
   * @param key Cache key
   * @returns True if key exists and is not expired
   */
  exists(key: string): Promise<boolean>;
  
  /**
   * Clear entire cache
   */
  flush(): Promise<void>;
  
  /**
   * Get value from cache or set it using factory function
   * @param key Cache key
   * @param factory Function to generate value if not in cache
   * @param options Cache options
   * @returns Cached or newly generated value
   */
  getOrSet<T>(
    key: string, 
    factory: () => Promise<T>, 
    options?: CacheOptions
  ): Promise<T>;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  /** Total number of cache hits */
  hits: number;
  
  /** Total number of cache misses */
  misses: number;
  
  /** Current number of cached items */
  size: number;
  
  /** Cache type (redis or memory) */
  type: 'redis' | 'memory';
  
  /** Hit rate percentage */
  hitRate?: number;
}

/**
 * Standard cache key patterns
 */
export const CacheKeys = {
  // Collection-level keys (long TTL)
  collectionPossibleLocations: (collection: string) => 
    `collection:${collection}:possible_locations`,
  
  collectionSearchableFields: (collection: string) => 
    `collection:${collection}:searchable_fields`,
  
  collectionTranslationInfo: (collection: string) => 
    `collection:${collection}:translation_info`,
  
  collectionIncomingRelations: (collection: string) => 
    `collection:${collection}:incoming_relations`,
  
  // Item-level keys (medium TTL)
  itemUsage: (collection: string, itemId: string | number) => 
    `item:${collection}:${itemId}:usage`,
  
  itemPaths: (collection: string, itemId: string | number) => 
    `item:${collection}:${itemId}:paths`,
    
  itemUsageStats: (collection: string, itemId: string | number) =>
    `item:${collection}:${itemId}:usage_stats`,
    
  itemUsagePaths: (collection: string, itemId: string | number) =>
    `item:${collection}:${itemId}:usage_paths`,
    
  itemDetail: (collection: string, itemId: string | number, fields: string) =>
    `item:${collection}:${itemId}:detail:${fields}`,
  
  // Query-level keys (short TTL)
  queryResult: (collection: string, queryHash: string) => 
    `query:${collection}:${queryHash}`
};

/**
 * Standard TTL values in milliseconds
 */
export const CacheTTL = {
  /** 30 minutes - for rarely changing data like collection metadata */
  LONG: 30 * 60 * 1000,
  
  /** 10 minutes - for moderately changing data */
  MEDIUM: 10 * 60 * 1000,
  
  /** 5 minutes - for frequently changing data */
  SHORT: 5 * 60 * 1000,
  
  /** 1 minute - for very dynamic data */
  VERY_SHORT: 60 * 1000,
  
  /** No expiration */
  NONE: 0
};