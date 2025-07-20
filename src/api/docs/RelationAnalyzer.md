# RelationAnalyzer Documentation

## Overview

The RelationAnalyzer is a service that analyzes Directus relations to determine all possible locations where items from a specific collection can be used. It provides a comprehensive view of how collections are interconnected through various relation types (M2A, M2O, O2M).

## Purpose

When working with complex Directus schemas, it's often necessary to understand:
- Where are items from a specific collection being referenced?
- Which fields in other collections point to our collection?
- What are the junction tables involved in M2A relations?
- How are translation tables connected?

The RelationAnalyzer answers these questions by examining the `directus_relations` table and building a complete usage map.

## Architecture

```
┌─────────────────────┐
│ items-with-relations│
│     endpoint        │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  RelationAnalyzer   │
│      Service        │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ directus_relations  │
│ directus_collections│
│ directus_fields     │
└─────────────────────┘
```

## Core Concepts

### 1. **PossibleUsageLocation**
Represents a location where items from the target collection can be used:
```typescript
{
  collection: string;         // The collection that references our target
  collection_name: string;    // Human-readable name
  collection_icon: string;    // Icon from directus_collections
  fields: string[];          // Field names that reference our target
  relation_details: RelationDetail[]; // Detailed relation information
}
```

### 2. **Relation Types**
- **M2A (Many-to-Any)**: Items can belong to multiple different collections via a junction table
- **M2O (Many-to-One)**: Multiple items reference a single item (foreign key)
- **O2M (One-to-Many)**: One item has multiple related items (reverse of M2O)
- **M2M (Many-to-Many)**: Represented as two separate relations in Directus

### 3. **Special Cases**
- **Translation Tables**: Tables ending with `_translations` are automatically detected and a synthetic O2M relation is created
- **System Collections**: Directus system tables (prefixed with `directus_`) can be filtered out

## API Reference

### Constructor
```typescript
const analyzer = new RelationAnalyzer({
  database: knex  // Knex database connection
});
```

### Main Method
```typescript
async getPossibleUsageLocations(
  targetCollection: string,
  options?: GetUsageLocationsOptions
): Promise<PossibleUsageLocation[]>
```

#### Parameters:
- `targetCollection`: The collection to analyze
- `options`: Optional configuration
  - `includeSystem`: Include system collections (default: false)
  - `includeHidden`: Include hidden collections (default: false)
  - `forceRefresh`: Reserved for future caching (not implemented)

#### Returns:
Array of `PossibleUsageLocation` objects showing where the collection is used.

### Example Usage
```typescript
const analyzer = new RelationAnalyzer({ database });
const locations = await analyzer.getPossibleUsageLocations('content_blocks');

// Example response:
[
  {
    collection: 'pages',
    collection_name: 'Pages',
    collection_icon: 'article',
    fields: ['blocks'],
    relation_details: [{
      field: 'blocks',
      field_name: 'Content Blocks',
      relation_type: 'M2A',
      junction_table: 'pages_blocks',
      junction_field: 'pages_id',
      item_field: 'item',
      collection_field: 'collection',
      relation_id: 42
    }]
  }
]
```

## Implementation Details

### 1. **Relation Loading Process**
1. Validates that the target collection exists
2. Loads all relations where the collection is referenced
3. Loads reverse relations for better field name detection
4. Builds a usage map from the relations
5. Filters based on options (system/hidden collections)
6. Loads metadata for collections and fields
7. Formats the final output

### 2. **M2A Relation Detection**
M2A relations are identified by:
- `one_collection` is null
- `one_allowed_collections` contains the target collection
- A junction table exists (`many_collection`)

The main collection is extracted from the `junction_field` (e.g., `pages_id` → `pages`).

### 3. **Translation Table Handling**
For tables ending with `_translations`, a synthetic relation is created:
- ID: -1 (indicates synthetic)
- Creates an O2M relation from the main collection
- Field name: 'translations'

### 4. **Performance Optimizations**
- **Batch Loading**: Field metadata is loaded in a single query instead of one per collection
- **Early Filtering**: System collections are filtered before metadata loading
- **Set Operations**: Uses Sets for efficient field deduplication

## Error Handling

### Custom Error Types
- `InvalidCollectionError`: Thrown when the target collection doesn't exist
- `DatabaseQueryError`: Wraps database errors with context

### SQL Injection Prevention
- Table names are validated against a regex pattern: `/^[a-zA-Z0-9_-]+$/`
- Maximum table name length: 64 characters (PostgreSQL limit)
- Parameterized queries for all user input

## Extending the Service

### Adding Cache Support
The interface already includes cache-related options:
```typescript
enableCache?: boolean;
cacheTTL?: number;
```

To implement caching:
1. Add a cache storage mechanism (Redis, in-memory)
2. Check cache before loading relations
3. Invalidate on schema changes

### Adding New Relation Types
1. Update `RelationType` in `RelationTypes.ts`
2. Add detection logic in `buildUsageMap()`
3. Update documentation

### Custom Filters
The `excludeCollections` option is commented out but can be implemented:
```typescript
if (config.excludeCollections?.includes(collection)) {
  return; // Skip this collection
}
```

## Common Use Cases

### 1. **Find All References to a Collection**
```typescript
const locations = await analyzer.getPossibleUsageLocations('products');
// Shows all collections that reference products
```

### 2. **Include System Collections**
```typescript
const locations = await analyzer.getPossibleUsageLocations('directus_files', {
  includeSystem: true
});
// Shows usage of files including in system collections
```

### 3. **Check If Collection Is Used**
```typescript
const locations = await analyzer.getPossibleUsageLocations('old_collection');
if (locations.length === 0) {
  console.log('Safe to delete - collection not referenced');
}
```

## Debugging Tips

1. **Enable SQL Logging**: Add `DEBUG=knex:query` to see actual queries
2. **Check Relations Table**: `SELECT * FROM directus_relations WHERE ...`
3. **Synthetic Relations**: Look for `relation_id: -1` to identify synthetic relations
4. **Console Warnings**: Invalid table names are logged to console

## Future Improvements

1. **Caching**: Implement result caching to improve performance
2. **Webhook Integration**: Invalidate cache on relation changes
3. **GraphQL Support**: Expose through GraphQL API
4. **Circular Reference Detection**: Warn about circular dependencies
5. **Impact Analysis**: Show what would break if a collection is deleted

## Related Files

- `/src/api/types/RelationTypes.ts` - Type definitions
- `/src/api/types/errors.ts` - Error classes
- `/src/api/utils/relation-utils.ts` - Utility functions
- `/src/api/items-with-relations.ts` - HTTP endpoint