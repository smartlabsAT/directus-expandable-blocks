# CacheService Documentation

## Overview

The CacheService provides a high-performance caching layer for the Expandable Blocks API with automatic Redis/Memory fallback. It supports key-value storage, TTL management, tagging, and batch operations.

## Purpose

API operations often involve expensive database queries and calculations:
- Relation analysis queries
- Usage tree traversal
- Path building operations
- Collection metadata lookups

The CacheService reduces load and improves response times by caching these results with intelligent invalidation strategies.

## Architecture

```
┌─────────────────────┐
│   API Endpoint      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   CacheService      │
└──────┬──────────────┘
       │
       ├──────────────┐
       ▼              ▼
┌─────────────┐ ┌─────────────┐
│    Redis    │ │   Memory    │
│  (if avail) │ │  (fallback) │
└─────────────┘ └─────────────┘
```

## Core Concepts

### 1. **Cache Storage**
- **Redis Priority**: Uses Redis if available for distributed caching
- **Memory Fallback**: Falls back to in-memory Map for single instances
- **Automatic Detection**: Checks Redis availability on initialization

### 2. **TTL (Time To Live)**
Predefined TTL constants:
```typescript
export const CacheTTL = {
  VERY_SHORT: 60,   // 1 minute (very dynamic data)
  SHORT: 300,       // 5 minutes (frequently changing data)
  MEDIUM: 600,      // 10 minutes (moderately changing data)
  LONG: 1800        // 30 minutes (rarely changing data)
};
```

### 3. **Cache Keys**
Standardized key patterns:
```typescript
export const CacheKeys = {
  // Collection-level keys (long TTL)
  collectionPossibleLocations: (collection) => 
    `collection:${collection}:possible_locations`,
  collectionSearchableFields: (collection) => 
    `collection:${collection}:searchable_fields`,
  collectionTranslationInfo: (collection) => 
    `collection:${collection}:translation_info`,
  collectionIncomingRelations: (collection) => 
    `collection:${collection}:incoming_relations`,
  
  // Item-level keys (medium TTL)
  itemUsage: (collection, itemId) => 
    `item:${collection}:${itemId}:usage`,
  itemPaths: (collection, itemId) => 
    `item:${collection}:${itemId}:paths`,
  
  // Query-level keys (short TTL)
  queryResult: (collection, queryHash) => 
    `query:${collection}:${queryHash}`
};
```

### 4. **Tag-based Invalidation**
Groups related cache entries for bulk invalidation:
```typescript
await cache.set('key1', data, { tags: ['products', 'featured'] });
await cache.set('key2', data, { tags: ['products'] });

// Invalidate all product-related cache
await cache.invalidateByTags(['products']);
```

## API Reference

### Constructor
```typescript
const cache = new CacheServiceImpl({
  database: knex,
  services: directusServices,
  defaultTTL?: number,      // Default: 300 (5 minutes)
  prefix?: string,          // Default: 'directus_api'
  redisClient?: any         // Optional Redis client if available
});
```

### Core Methods

#### `get<T>(key: string): Promise<T | null>`
Retrieves a value from cache.

```typescript
const data = await cache.get<ProductData>('product:123');
if (data) {
  console.log('Cache hit!');
}
```

#### `set<T>(key: string, value: T, options?: CacheOptions): Promise<void>`
Stores a value in cache.

```typescript
await cache.set('product:123', productData, {
  ttl: CacheTTL.MEDIUM,
  tags: ['products', 'catalog']
});
```

#### `getOrSet<T>(key: string, factory: () => Promise<T>, options?: CacheOptions): Promise<T>`
Gets from cache or computes and stores if missing.

```typescript
const data = await cache.getOrSet(
  'expensive:calculation',
  async () => {
    // Expensive operation
    return await complexCalculation();
  },
  { ttl: CacheTTL.LONG }
);
```

#### `delete(key: string): Promise<void>`
Removes a single key from cache.

```typescript
await cache.delete('product:123');
```

#### `mget<T>(keys: string[]): Promise<(T | null)[]>`
Gets multiple values in one operation.

```typescript
const results = await cache.mget<Product>([
  'product:1',
  'product:2',
  'product:3'
]);
```

#### `mset(items: Array<{key: string, value: any, options?: CacheOptions}>): Promise<void>`
Sets multiple values in one operation.

```typescript
await cache.mset([
  { key: 'product:1', value: product1, options: { ttl: CacheTTL.LONG } },
  { key: 'product:2', value: product2, options: { ttl: CacheTTL.LONG } }
]);
```

#### `deleteTags(tags: string[]): Promise<number>`
Deletes all entries with specified tags.

```typescript
// Delete all product and featured caches
const deletedCount = await cache.deleteTags(['products', 'featured']);
console.log(`Deleted ${deletedCount} cache entries`);
```

#### `deletePattern(pattern: string): Promise<number>`
Deletes entries matching a pattern.

```typescript
// Delete all usage caches
const deletedCount = await cache.deletePattern('item:products:*:usage');
console.log(`Deleted ${deletedCount} cache entries`);
```

#### `flush(): Promise<void>`
Clears entire cache.

```typescript
await cache.flush();
```

#### `getStats(): CacheStats`
Returns cache statistics.

```typescript
const stats = cache.getStats();
console.log(`Hit rate: ${(stats.hits / (stats.hits + stats.misses) * 100).toFixed(2)}%`);
```

## Usage Examples

### Basic Caching Pattern
```typescript
async function getProductWithCache(id: number) {
  const cacheKey = `product:${id}`;
  
  // Try cache first
  const cached = await cache.get<Product>(cacheKey);
  if (cached) {
    return cached;
  }
  
  // Load from database
  const product = await database('products').where('id', id).first();
  
  // Cache for future requests
  await cache.set(cacheKey, product, {
    ttl: CacheTTL.MEDIUM,
    tags: ['products', `product:${id}`]
  });
  
  return product;
}
```

### Using getOrSet
```typescript
async function getCollectionMetadata(collection: string) {
  return cache.getOrSet(
    CacheKeys.collectionPossibleLocations(collection),
    async () => {
      // Expensive metadata calculation
      const metadata = await analyzeCollection(collection);
      return metadata;
    },
    {
      ttl: CacheTTL.LONG,
      tags: ['metadata', collection]
    }
  );
}
```

### Batch Operations
```typescript
async function warmCache(productIds: number[]) {
  const products = await database('products')
    .whereIn('id', productIds);
  
  const entries = products.map(product => ({
    key: `product:${product.id}`,
    value: product,
    ttl: CacheTTL.MEDIUM
  }));
  
  await cache.mset(entries);
}
```

### Cache Invalidation
```typescript
async function updateProduct(id: number, data: any) {
  // Update database
  await database('products').where('id', id).update(data);
  
  // Invalidate related caches
  await cache.delete(`product:${id}`);
  await cache.deleteTags(['products']);
  
  // Or use pattern
  await cache.deletePattern(`item:products:${id}:*`);
}
```

## Implementation Details

### Memory Cache Management
- **LRU Eviction**: Removes least recently used items when size limit reached
- **TTL Cleanup**: Background timer removes expired entries every 60 seconds
- **Size Tracking**: Monitors memory usage and enforces limits

### Redis Integration
- **Connection Pooling**: Reuses Redis connections
- **Pipeline Support**: Batches operations for performance
- **Lua Scripts**: Atomic operations for complex logic
- **Fallback**: Gracefully falls back to memory on connection failure

### Serialization
- **JSON Serialization**: All values are JSON serialized
- **Type Safety**: Generic types preserved through serialization
- **Special Types**: Handles Date, Set, Map with custom serializers

## Performance Considerations

### 1. **Key Design**
```typescript
// Good: Hierarchical, predictable
'collection:products:item:123'
'usage:products:123:depth:2'

// Bad: Random, unpredictable
'cache_' + Math.random()
'temp_' + Date.now()
```

### 2. **TTL Strategy**
- **Static Data**: Use LONG (30m) for rarely changing data
- **Dynamic Data**: Use SHORT (5m) for frequently changing data
- **Very Dynamic Data**: Use VERY_SHORT (1m) for real-time data
- **Computed Data**: Use MEDIUM (10m) for balanced caching

### 3. **Tag Usage**
```typescript
// Efficient tagging
tags: ['products', 'active']  // Broad to narrow

// Inefficient tagging
tags: [`product:${id}`, `user:${userId}`, `timestamp:${Date.now()}`]  // Too specific
```

### 4. **Batch Operations**
```typescript
// Efficient: Single round trip
const results = await cache.mget(keys);

// Inefficient: Multiple round trips
const results = [];
for (const key of keys) {
  results.push(await cache.get(key));
}
```

## Common Patterns

### 1. **Cache-Aside Pattern**
```typescript
async function getCachedData(key: string, loader: () => Promise<any>) {
  const cached = await cache.get(key);
  if (cached) return cached;
  
  const fresh = await loader();
  await cache.set(key, fresh);
  return fresh;
}
```

### 2. **Check Existence Pattern**
```typescript
async function checkAndLoad(key: string, loader: () => Promise<any>) {
  const exists = await cache.exists(key);
  
  if (!exists) {
    const fresh = await loader();
    await cache.set(key, fresh, { ttl: CacheTTL.MEDIUM });
    return fresh;
  }
  
  return cache.get(key);
}
```

### 3. **Circuit Breaker Pattern**
```typescript
let failures = 0;
const threshold = 5;

async function getWithFallback(key: string) {
  if (failures >= threshold) {
    // Circuit open, skip cache
    return null;
  }
  
  try {
    return await cache.get(key);
  } catch (error) {
    failures++;
    if (failures >= threshold) {
      console.error('Cache circuit breaker opened');
    }
    return null;
  }
}
```

## Error Handling

### Connection Errors
```typescript
try {
  await cache.set('key', value);
} catch (error) {
  if (error.code === 'ECONNREFUSED') {
    console.warn('Redis unavailable, using memory cache');
  }
}
```

### Serialization Errors
```typescript
// Circular reference handling
const data = { id: 1 };
data.self = data; // Circular!

try {
  await cache.set('circular', data);
} catch (error) {
  console.error('Cannot cache circular structure');
}
```

## Monitoring and Debugging

### Cache Statistics
```typescript
const stats = cache.getStats();
console.log({
  hitRate: `${(stats.hits / (stats.hits + stats.misses) * 100).toFixed(2)}%`,
  size: stats.size,
  type: stats.type
});
```

### Debug Logging
```typescript
// Enable debug mode
const cache = new CacheServiceImpl({
  ...config,
  debug: true  // Logs all operations
});
```

## Best Practices

1. **Use Consistent Key Patterns**: Makes debugging and invalidation easier
2. **Set Appropriate TTLs**: Balance freshness vs performance
3. **Tag Strategically**: Use hierarchical tags for flexible invalidation
4. **Monitor Hit Rates**: Aim for >80% hit rate for frequently accessed data
5. **Handle Failures Gracefully**: Always have fallback logic
6. **Avoid Cache Stampede**: Use locks or probabilistic early expiration
7. **Size Your Cache**: Monitor memory usage and set appropriate limits

## Related Documentation

- [ItemLoader](./ItemLoader.md) - Uses cache for query results
- [RelationAnalyzer](./RelationAnalyzer.md) - Caches relation analysis
- [UsageFinderService](./UsageFinderService.md) - Caches usage trees