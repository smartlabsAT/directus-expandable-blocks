/**
 * Cache utilities for API services
 */

/**
 * Build a cache key from parts
 * Sanitizes parts and joins with colons
 * @param prefix The cache key prefix
 * @param parts Additional key parts
 * @returns Sanitized cache key
 */
export function buildCacheKey(prefix: string, ...parts: (string | number | undefined | null)[]): string {
  const sanitized = parts
    .filter(part => part !== undefined && part !== null)
    .map(part => String(part).replace(/[^a-zA-Z0-9_-]/g, '_'));
  return [prefix, ...sanitized].join(':');
}

/**
 * Create a cache key for collection operations
 * @param operation The operation type
 * @param collection The collection name
 * @param params Additional parameters
 * @returns Cache key
 */
export function collectionCacheKey(operation: string, collection: string, ...params: (string | number)[]): string {
  return buildCacheKey(`collection:${operation}`, collection, ...params);
}

/**
 * Create a cache key for field operations
 * @param operation The operation type
 * @param collection The collection name
 * @param field The field name
 * @param params Additional parameters
 * @returns Cache key
 */
export function fieldCacheKey(operation: string, collection: string, field: string, ...params: (string | number)[]): string {
  return buildCacheKey(`field:${operation}`, collection, field, ...params);
}

/**
 * Create a cache key for item operations
 * @param operation The operation type
 * @param collection The collection name
 * @param itemId The item ID
 * @param params Additional parameters
 * @returns Cache key
 */
export function itemCacheKey(operation: string, collection: string, itemId: string | number, ...params: (string | number)[]): string {
  return buildCacheKey(`item:${operation}`, collection, String(itemId), ...params);
}