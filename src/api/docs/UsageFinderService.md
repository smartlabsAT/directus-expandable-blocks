# UsageFinderService Documentation

## Overview

The UsageFinderService discovers where items are used throughout the Directus system by traversing relationships. It builds comprehensive usage trees showing both direct and nested usages with support for all Directus relation types (M2O, O2M, M2A).

## Purpose

Content management requires understanding item dependencies:
- **Before Deletion**: Find all places an item is used to prevent broken references
- **Impact Analysis**: Understand the impact of changes across the system
- **Content Audit**: Discover orphaned or unused content
- **Navigation**: Build relationship graphs for content exploration

The UsageFinderService provides this critical dependency information.

## Architecture

```
┌─────────────────────┐
│   Target Item       │
│ (collection + ID)   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ UsageFinderService  │
└──────────┬──────────┘
           │
    ┌──────┴──────┐
    ▼             ▼
┌─────────┐ ┌─────────┐
│Direct   │ │Nested   │
│Relations│ │Relations│
└─────────┘ └─────────┘
    │             │
    └──────┬──────┘
           ▼
┌─────────────────────┐
│   Usage Tree        │
│ (with statistics)   │
└─────────────────────┘
```

## Core Concepts

### 1. **Usage Location**
Represents where an item is used:
```typescript
interface UsageLocation {
  // Where it's used
  collection: string;
  collection_name: string;
  collection_icon: string;
  item_id: string | number;
  item_name: string;
  
  // How it's used
  field: string;
  field_name: string;
  field_type: string;
  field_interface?: string;
  
  // Relationship details
  relation_type: 'M2O' | 'O2M' | 'M2A';
  junction_table?: string;
  
  // Additional metadata
  status?: string;
  sort?: number;
  usage_count?: number;
}
```

### 2. **Usage Tree**
Hierarchical representation of all usages:
```typescript
interface UsageTree {
  item: {
    collection: string;
    id: string | number;
    display: string;
  };
  direct_usages: UsageLocation[];
  nested_usages: UsageTree[];
  total_usage_count: number;
  max_depth: number;
  has_circular_reference: boolean;
}
```

### 3. **Usage Statistics**
Aggregated usage metrics:
```typescript
interface UsageStatistics {
  by_collection: Record<string, number>;
  by_field: Record<string, number>;
  by_depth: Record<number, number>;
  total_count: number;
  max_depth: number;
  unique_collections: string[];
  unique_fields: string[];
}
```

### 4. **Relation Types**
- **M2O (Many-to-One)**: Foreign key in the using collection
- **O2M (One-to-Many)**: Reverse lookup of M2O
- **M2A (Many-to-Any)**: Junction table with collection + ID

## API Reference

### Constructor
```typescript
const usageFinder = new UsageFinderService({
  database: knex,
  services: directusServices,
  schema: directusSchema,
  accountability: req.accountability,
  incomingRelations: filteredRelations // Pre-loaded relations
});
```

### Main Methods

#### `findDirectUsages(collection: string, itemId: string | number, options?: FindUsageOptions): Promise<UsageLocation[]>`
Finds all direct usages of an item.

```typescript
const directUsages = await usageFinder.findDirectUsages('products', 123, {
  includeInactive: false,
  includeItemDetails: true,
  includeFieldMetadata: true,
  limitPerCollection: 100,
  excludeCollections: ['directus_activity'],
  groupDuplicates: true
});

// Returns array of usage locations
```

#### `findAllUsages(collection: string, itemId: string | number, options?: FindUsageOptions): Promise<UsageTree>`
Builds complete usage tree including nested usages.

```typescript
const usageTree = await usageFinder.findAllUsages('products', 123, {
  maxDepth: 3,
  includeItemDetails: true,
  includeFieldMetadata: true
});

console.log(`Total usages: ${usageTree.total_usage_count}`);
console.log(`Max depth: ${usageTree.max_depth}`);
```

#### `getUsageStatistics(collection: string, itemId: string | number, usageTree?: UsageTree): Promise<UsageStatistics>`
Calculates usage statistics.

```typescript
const stats = await usageFinder.getUsageStatistics('products', 123);

console.log('Usage by collection:', stats.by_collection);
console.log('Usage by field:', stats.by_field);
console.log('Collections using this item:', stats.unique_collections);
```

#### `checkCircularReference(collection: string, itemId: string | number, targetCollection: string, targetId: string | number): Promise<boolean>`
Checks for circular references.

```typescript
const hasCircular = await usageFinder.checkCircularReference(
  'categories', 1,
  'categories', 5
);

if (hasCircular) {
  console.warn('Circular reference detected!');
}
```

## Usage Examples

### Basic Usage Finding
```typescript
// Find where a product is used
const usages = await usageFinder.findDirectUsages('products', 123);

usages.forEach(usage => {
  console.log(`Used in ${usage.collection_name} #${usage.item_id} (${usage.field_name})`);
});
```

### Complete Usage Analysis
```typescript
async function analyzeItemUsage(collection: string, itemId: number) {
  // Get full usage tree
  const tree = await usageFinder.findAllUsages(collection, itemId, {
    maxDepth: 5,
    includeItemDetails: true
  });
  
  // Get statistics
  const stats = await usageFinder.getUsageStatistics(collection, itemId, tree);
  
  // Build report
  return {
    item: tree.item,
    direct_usage_count: tree.direct_usages.length,
    total_usage_count: tree.total_usage_count,
    max_depth: tree.max_depth,
    has_circular_reference: tree.has_circular_reference,
    top_collections: Object.entries(stats.by_collection)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5),
    statistics: stats
  };
}
```

### Pre-Deletion Check
```typescript
async function canSafelyDelete(collection: string, itemId: number): Promise<{
  safe: boolean;
  reasons: string[];
}> {
  const tree = await usageFinder.findAllUsages(collection, itemId);
  
  if (tree.total_usage_count === 0) {
    return { safe: true, reasons: [] };
  }
  
  const reasons = [];
  
  // Check direct usages
  if (tree.direct_usages.length > 0) {
    reasons.push(`Used in ${tree.direct_usages.length} places directly`);
  }
  
  // Check critical collections
  const criticalCollections = ['pages', 'settings'];
  const stats = await usageFinder.getUsageStatistics(collection, itemId, tree);
  
  for (const critical of criticalCollections) {
    if (stats.by_collection[critical] > 0) {
      reasons.push(`Used in critical collection: ${critical}`);
    }
  }
  
  return {
    safe: false,
    reasons
  };
}
```

### Finding Orphaned Content
```typescript
async function findOrphanedItems(collection: string): Promise<any[]> {
  const items = await database(collection).select('id');
  const orphaned = [];
  
  for (const item of items) {
    const tree = await usageFinder.findAllUsages(collection, item.id);
    
    if (tree.total_usage_count === 0) {
      orphaned.push({
        id: item.id,
        collection
      });
    }
  }
  
  return orphaned;
}
```

## Implementation Details

### 1. **Relation Traversal**
The service handles different relation types:

**M2O Relations:**
```typescript
// Find items that reference the target via foreign key
SELECT * FROM using_collection 
WHERE foreign_key_field = target_id
```

**O2M Relations:**
```typescript
// Reverse lookup - find items referenced by target
SELECT * FROM referenced_collection
WHERE id IN (SELECT ref_id FROM target_collection WHERE id = target_id)
```

**M2A Relations:**
```typescript
// Junction table lookup
SELECT * FROM junction_table
WHERE item = target_id 
  AND collection = target_collection
```

### 2. **Circular Reference Detection**
Prevents infinite loops:
1. Track visited items during traversal
2. Stop when encountering already-visited item
3. Mark tree as having circular reference

### 3. **Performance Optimizations**
- **Caching**: Results cached for 5 minutes
- **Batch Loading**: Load related items in batches
- **Depth Limiting**: Configurable max depth prevents runaway queries
- **Selective Loading**: Only load requested metadata

### 4. **Permission Handling**
Respects Directus permissions:
- Filters results based on user accountability
- Excludes items user cannot access
- Handles permission errors gracefully

## Advanced Features

### Custom Relation Handlers
```typescript
// Add custom handler for specific relation types
usageFinder.addRelationHandler('custom_type', async (relation, itemId) => {
  // Custom logic for finding usages
  return customUsages;
});
```

### Usage Path Building
```typescript
// Build paths from item to all usage locations
async function buildUsagePaths(collection: string, itemId: number) {
  const tree = await usageFinder.findAllUsages(collection, itemId);
  const paths = [];
  
  function traverse(node: UsageTree, path: string[] = []) {
    if (node.direct_usages.length === 0 && path.length > 0) {
      paths.push(path);
    }
    
    for (const usage of node.direct_usages) {
      const newPath = [...path, `${usage.collection}:${usage.item_id}`];
      // Continue traversal...
    }
  }
  
  traverse(tree);
  return paths;
}
```

### Bulk Usage Analysis
```typescript
// Analyze usage for multiple items
async function bulkUsageAnalysis(items: Array<{collection: string, id: number}>) {
  const results = await Promise.all(
    items.map(async item => {
      const tree = await usageFinder.findAllUsages(item.collection, item.id);
      const stats = await usageFinder.getUsageStatistics(
        item.collection, 
        item.id, 
        tree
      );
      
      return {
        ...item,
        usage_count: tree.total_usage_count,
        stats
      };
    })
  );
  
  return results.sort((a, b) => b.usage_count - a.usage_count);
}
```

## Performance Considerations

### 1. **Depth Limiting**
```typescript
// Limit depth to prevent performance issues
const tree = await usageFinder.findAllUsages('products', 123, {
  maxDepth: 3  // Stop at 3 levels deep
});
```

### 2. **Collection Filtering**
```typescript
// Exclude heavy or irrelevant collections
const tree = await usageFinder.findAllUsages('products', 123, {
  excludeCollections: ['directus_activity', 'directus_revisions']
});
```

### 3. **Selective Metadata**
```typescript
// Only load essential data
const usages = await usageFinder.findDirectUsages('products', 123, {
  includeItemDetails: false,  // Skip loading full items
  includeFieldMetadata: false  // Skip field metadata
});
```

## Error Handling

### Permission Errors
```typescript
try {
  const tree = await usageFinder.findAllUsages('products', 123);
} catch (error) {
  if (error.code === 'FORBIDDEN') {
    console.log('User lacks permission to view some usages');
  }
}
```

### Missing Relations
```typescript
// Handle missing or deleted relations gracefully
const tree = await usageFinder.findAllUsages('products', 123);
// Service automatically skips invalid relations
```

## Integration Examples

### With PathBuilderService
```typescript
// Find usages and build paths
const tree = await usageFinder.findAllUsages('products', 123);
const paths = await Promise.all(
  tree.direct_usages.map(usage => 
    pathBuilder.buildPath(usage)
  )
);
```

### In API Endpoints
```typescript
router.get('/items/:collection/:id/usage', async (req, res) => {
  const { collection, id } = req.params;
  const { depth = 3 } = req.query;
  
  try {
    const tree = await usageFinder.findAllUsages(collection, id, {
      maxDepth: Number(depth),
      includeItemDetails: true
    });
    
    const stats = await usageFinder.getUsageStatistics(collection, id, tree);
    
    res.json({
      usage_tree: tree,
      statistics: stats,
      can_delete: tree.total_usage_count === 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

## Best Practices

1. **Always Set Max Depth** to prevent runaway queries
2. **Cache Results** for frequently checked items
3. **Exclude System Collections** unless specifically needed
4. **Use Selective Loading** - only load what you need
5. **Handle Circular References** in UI/logic
6. **Batch Operations** when checking multiple items
7. **Monitor Performance** for deep/complex hierarchies

## Related Documentation

- [PathBuilderService](./PathBuilderService.md) - Builds readable paths from usage data
- [RelationAnalyzer](./RelationAnalyzer.md) - Analyzes collection relationships
- [CacheService](./CacheService.md) - Caching layer for results