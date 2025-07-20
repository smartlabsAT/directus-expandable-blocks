# RelationAnalyzer Developer Guide

## Project Structure

```
src/api/
├── docs/                    # Documentation
│   ├── RelationAnalyzer.md
│   ├── API-Reference.md
│   └── Developer-Guide.md
├── services/
│   └── RelationAnalyzer.ts  # Main service class
├── types/
│   ├── RelationTypes.ts     # Type definitions & constants
│   └── errors.ts            # Custom error classes
├── utils/
│   └── relation-utils.ts    # Utility functions
└── items-with-relations.ts  # HTTP endpoint
```

## Key Design Decisions

### 1. **No Custom API Calls**
The service works directly with Directus database tables rather than using Directus APIs. This provides:
- Better performance (direct SQL)
- Access to all relation metadata
- Independence from Directus API changes

### 2. **Synthetic Relations**
Translation tables don't have explicit relations in `directus_relations`. We create synthetic relations with ID `-1` to maintain consistency.

### 3. **Batch Loading**
Instead of N queries for N collections, we use complex WHERE clauses to load all data in minimal queries.

## Adding New Features

### 1. Implementing Cache Support

```typescript
// 1. Add cache interface
interface ICache {
  get(key: string): Promise<any>;
  set(key: string, value: any, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
}

// 2. Update constructor
constructor(config: RelationAnalyzerConfig) {
  this.database = config.database;
  this.cache = config.cache;
  this.enableCache = config.enableCache || false;
  this.cacheTTL = config.cacheTTL || 300;
}

// 3. Wrap main method
async getPossibleUsageLocations(
  targetCollection: string,
  options: GetUsageLocationsOptions = {}
): Promise<PossibleUsageLocation[]> {
  const cacheKey = `relations:${targetCollection}:${JSON.stringify(options)}`;
  
  if (this.enableCache && !options.forceRefresh) {
    const cached = await this.cache?.get(cacheKey);
    if (cached) return cached;
  }
  
  // ... existing logic ...
  
  if (this.enableCache) {
    await this.cache?.set(cacheKey, result, this.cacheTTL);
  }
  
  return result;
}
```

### 2. Adding Collection Filters

```typescript
// In filterUsageMap method:
private filterUsageMap(
  usageMap: Map<string, UsageMapEntry>,
  options: GetUsageLocationsOptions
): Map<string, UsageMapEntry> {
  const filtered = new Map<string, UsageMapEntry>();
  
  usageMap.forEach((entry, collection) => {
    // Skip excluded collections
    if (this.excludeCollections?.includes(collection)) {
      return;
    }
    
    // Skip by custom filter function
    if (options.filterFn && !options.filterFn(collection)) {
      return;
    }
    
    // ... rest of logic
  });
}
```

### 3. Adding Webhook Support

```typescript
// Listen for schema changes
async onSchemaChange(collection: string) {
  // Clear cache for affected collections
  const keys = await this.cache?.keys(`relations:*`);
  for (const key of keys) {
    if (key.includes(collection)) {
      await this.cache?.delete(key);
    }
  }
}
```

## Testing Strategy

### Unit Tests
```typescript
describe('RelationAnalyzer', () => {
  it('should detect M2A relations correctly', async () => {
    const mockDb = createMockDatabase();
    const analyzer = new RelationAnalyzer({ database: mockDb });
    
    // Mock directus_relations data
    mockDb.expectQuery('directus_relations')
      .returns([{
        id: 1,
        one_collection: null,
        one_allowed_collections: 'blocks,banners',
        many_collection: 'pages_blocks',
        // ...
      }]);
    
    const result = await analyzer.getPossibleUsageLocations('blocks');
    expect(result).toHaveLength(1);
    expect(result[0].relation_type).toBe('M2A');
  });
});
```

### Integration Tests
```typescript
it('should handle translations correctly', async () => {
  // Create test data
  await db('pages').insert({ id: 1, title: 'Test' });
  await db('pages_translations').insert({ 
    pages_id: 1, 
    languages_code: 'en-US',
    title: 'Test Page'
  });
  
  const analyzer = new RelationAnalyzer({ database: db });
  const result = await analyzer.getPossibleUsageLocations('pages_translations');
  
  expect(result).toContainEqual({
    collection: 'pages',
    fields: ['translations'],
    relation_details: expect.arrayContaining([{
      field: 'translations',
      relation_type: 'O2M',
      relation_id: -1
    }])
  });
});
```

## Performance Considerations

### 1. **Query Optimization**
- Use indexes on `directus_relations` columns
- Limit fields selected (don't use SELECT *)
- Consider pagination for large result sets

### 2. **Memory Management**
- Use streaming for very large collections
- Clear Maps/Sets after use
- Implement result size limits

### 3. **Database Connection**
- Use connection pooling
- Handle connection errors gracefully
- Implement retry logic

## Security Best Practices

### 1. **Input Validation**
```typescript
// Always validate collection names
if (!VALID_TABLE_NAME_PATTERN.test(collection)) {
  throw new InvalidCollectionError(collection);
}
```

### 2. **SQL Injection Prevention**
- Use parameterized queries
- Validate all inputs
- Never concatenate user input into SQL

### 3. **Access Control**
```typescript
// Future: Add permission checks
if (!user.can('read', collection)) {
  throw new ForbiddenError(collection);
}
```

## Common Pitfalls

### 1. **Forgetting O2M Relations**
O2M relations might not be obvious in the relations table. Always check both directions.

### 2. **Junction Table Naming**
Junction tables don't follow a strict pattern. Use `junction_field` to extract the main collection.

### 3. **Metadata Parsing**
Metadata can be string or object. Always use `parseMetadata()` utility.

### 4. **Async Error Handling**
Always use try-catch with proper error types:
```typescript
try {
  // database operation
} catch (error: any) {
  if (error instanceof InvalidCollectionError) {
    throw error; // Re-throw known errors
  }
  throw new DatabaseQueryError(`Context: ${error.message}`);
}
```

## Future Roadmap

1. **GraphQL Integration**
   - Expose as GraphQL resolver
   - Add to Directus schema

2. **Real-time Updates**
   - WebSocket support
   - Live relation tracking

3. **Visual Representation**
   - Generate relation diagrams
   - Export to various formats

4. **Advanced Analytics**
   - Circular dependency detection
   - Orphaned relation finder
   - Impact analysis tools

## Contributing

1. Follow existing code style
2. Add tests for new features
3. Update documentation
4. Use meaningful commit messages
5. Handle errors appropriately

## Resources

- [Directus Relations Docs](https://docs.directus.io/reference/relations.html)
- [Knex.js Query Builder](http://knexjs.org/)
- [TypeScript Best Practices](https://www.typescriptlang.org/docs/handbook/declaration-files/do-s-and-don-ts.html)