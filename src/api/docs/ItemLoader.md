# ItemLoader Documentation

## Overview

The ItemLoader is a service that provides a clean interface for loading items from Directus collections with support for pagination, filtering, sorting, and search. It wraps the Directus ItemsService to provide consistent metadata and error handling.

## Purpose

When loading items from a collection, you often need:
- Pagination with limit/offset
- Total and filtered counts
- Consistent error handling
- Proper permission checks
- Field selection
- Sorting and filtering

The ItemLoader provides all of this in a simple, reusable service.

## Architecture

```
┌─────────────────────┐
│   HTTP Endpoint     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│    ItemLoader       │
│     Service         │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Directus           │
│  ItemsService       │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│    PostgreSQL       │
└─────────────────────┘
```

## Core Concepts

### 1. **ItemQuery**
Defines what items to load and how:
```typescript
{
  limit?: number;      // Max items to return (default: 10)
  offset?: number;     // Items to skip (default: 0)
  fields?: string[];   // Fields to include (default: ['*'])
  filter?: any;        // Directus filter object
  search?: string;     // Full-text search
  sort?: string[];     // Sort fields (e.g. ['-date_created'])
}
```

### 2. **ItemResult**
The response structure:
```typescript
{
  data: T[];           // Array of items
  meta: {
    total_count: number;    // Total items in collection
    filter_count: number;   // Items matching filters
    limit: number;          // Applied limit
    offset: number;         // Applied offset
    page?: number;          // Current page number
    page_count?: number;    // Total pages
  }
}
```

### 3. **Default Behavior**
- Limit: 10 items
- Offset: 0
- Fields: All fields (`['*']`)
- No filters or search
- No sorting

## API Reference

### Constructor
```typescript
const loader = new ItemLoader({
  database: knex,
  schema: directusSchema,
  services: directusServices,
  accountability: req.accountability // optional
});
```

### Main Method
```typescript
async loadItems<T = any>(
  collection: string,
  query?: ItemQuery
): Promise<ItemResult<T>>
```

#### Parameters:
- `collection`: The collection name to load items from
- `query`: Optional query parameters

#### Returns:
`ItemResult` object with items and metadata

#### Throws:
- `InvalidCollectionError`: If collection doesn't exist
- `DatabaseQueryError`: If query fails

### Example Usage

#### Basic Usage
```typescript
const loader = new ItemLoader({
  database,
  schema,
  services,
  accountability
});

const result = await loader.loadItems('products');
// Returns first 10 products with all fields
```

#### With Pagination
```typescript
const result = await loader.loadItems('products', {
  limit: 20,
  offset: 40  // Page 3 with 20 items per page
});
```

#### With Field Selection
```typescript
const result = await loader.loadItems('products', {
  fields: ['id', 'name', 'price', 'status']
});
```

#### With Filtering
```typescript
const result = await loader.loadItems('products', {
  filter: {
    status: {
      _eq: 'published'
    },
    price: {
      _gte: 100
    }
  }
});
```

#### With Search
```typescript
const result = await loader.loadItems('products', {
  search: 'laptop',
  fields: ['id', 'name', 'description']
});
```

#### With Sorting
```typescript
const result = await loader.loadItems('products', {
  sort: ['-date_created', 'name']  // Newest first, then by name
});
```

#### Complete Example
```typescript
const result = await loader.loadItems('products', {
  limit: 25,
  offset: 0,
  fields: ['id', 'name', 'price', 'category', 'status'],
  filter: {
    status: { _eq: 'published' },
    category: { _in: ['electronics', 'computers'] }
  },
  search: 'gaming',
  sort: ['-price']  // Most expensive first
});

console.log(`Found ${result.meta.filter_count} products`);
console.log(`Page ${result.meta.page} of ${result.meta.page_count}`);
```

## Implementation Details

### 1. **Collection Validation**
Before loading items, the service validates that the collection exists by:
1. Checking `directus_collections` table
2. Verifying the actual table exists in the database
3. Validating table name format (alphanumeric, underscore, hyphen)

### 2. **Count Optimization**
- **Total Count**: Direct SQL count on the table
- **Filtered Count**: Uses ItemsService with aggregate for complex filters
- If no filters applied, uses total count to avoid duplicate queries

### 3. **Error Handling**
- Validates collection existence before querying
- Wraps all errors in appropriate error types
- Provides meaningful error messages
- Falls back gracefully for counts

### 4. **Security**
- Respects Directus permissions through ItemsService
- Uses accountability context when provided
- Validates table names to prevent SQL injection
- Limits maximum items to prevent memory issues

## Performance Considerations

### 1. **Parallel Queries**
Counts are fetched in parallel with items:
```typescript
const [totalCount, filterCount] = await Promise.all([
  this.getTotalCount(collection),
  this.getFilteredCount(options)
]);
```

### 2. **Query Limits**
- Default limit: 10 items
- Maximum limit: 1000 items (configurable via MAX_LIMIT)
- Prevents accidental large queries

### 3. **Field Selection**
Always specify only needed fields to reduce payload:
```typescript
fields: ['id', 'title', 'status']  // Don't use ['*'] if not needed
```

## Common Patterns

### 1. **Pagination Helper**
```typescript
function getPaginationQuery(page: number, perPage: number): ItemQuery {
  return {
    limit: perPage,
    offset: (page - 1) * perPage
  };
}

// Usage
const result = await loader.loadItems('posts', getPaginationQuery(3, 20));
```

### 2. **Search with Highlights**
```typescript
const result = await loader.loadItems('articles', {
  search: 'directus',
  fields: ['id', 'title', 'content']
});

// Post-process to add highlights (not built-in)
```

### 3. **Dynamic Filtering**
```typescript
function buildFilter(params: any) {
  const filter: any = {};
  
  if (params.status) {
    filter.status = { _eq: params.status };
  }
  
  if (params.minPrice) {
    filter.price = { _gte: params.minPrice };
  }
  
  return filter;
}
```

## Integration with Other Services

### With RelationAnalyzer
```typescript
// 1. Find where collection is used
const locations = await relationAnalyzer.getPossibleUsageLocations('products');

// 2. Load the products
const products = await itemLoader.loadItems('products', { limit: 20 });

// 3. Enrich with usage (future service)
const enrichedProducts = await usageEnricher.enrichItemsWithUsage(
  products.data,
  locations,
  'products'
);
```

## Error Examples

### Collection Not Found
```typescript
try {
  await loader.loadItems('non_existent_collection');
} catch (error) {
  if (error instanceof InvalidCollectionError) {
    console.log('Collection does not exist');
  }
}
```

### Invalid Query
```typescript
try {
  await loader.loadItems('products', {
    limit: -5  // Invalid
  });
} catch (error) {
  // Limit will be normalized to default (10)
}
```

## Future Enhancements

1. **Caching Support**
   - Cache results based on query hash
   - Invalidate on collection changes

2. **Aggregation Support**
   - Count by field values
   - Sum, average calculations

3. **Export Formats**
   - CSV export option
   - JSON Lines format

4. **Streaming Support**
   - For very large result sets
   - Cursor-based pagination

## Related Documentation

- [RelationAnalyzer](./RelationAnalyzer.md) - Find collection relationships
- [Directus Filter Reference](https://docs.directus.io/reference/filter-rules.html)
- [Directus API](https://docs.directus.io/reference/items.html)