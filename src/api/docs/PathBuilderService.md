# PathBuilderService Documentation

## Overview

The PathBuilderService constructs human-readable paths and breadcrumbs from usage relationships, showing how items are connected through the content hierarchy. It transforms raw usage data into navigable paths with support for multiple formats and visualizations.

## Purpose

When viewing where an item is used, raw relationship data like "pages->blocks->products" isn't user-friendly. The PathBuilderService:
- Creates readable paths like "Homepage > Content Blocks > Product Card"
- Generates breadcrumb navigation with admin links
- Builds complete path trees showing all usage routes
- Provides multiple formatting options for different UI needs

## Architecture

```
┌─────────────────────┐
│  Usage Location     │
│  (from UsageFinder) │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ PathBuilderService  │
└──────────┬──────────┘
           │
           ├────────────────┐
           ▼                ▼
┌─────────────────┐  ┌─────────────┐
│ Item Display    │  │   Admin     │
│ Name Resolution │  │   URL Gen   │
└─────────────────┘  └─────────────┘
           │
           ▼
┌─────────────────────┐
│  Formatted Paths    │
│  & Breadcrumbs      │
└─────────────────────┘
```

## Core Concepts

### 1. **Path Structure**
A path represents the route from a used item to its usage location:
```typescript
interface UsagePath {
  from: PathStep;           // The item being used
  to: PathStep;             // Where it's used (root)
  steps: PathStep[];        // All steps in between
  formatted: string;        // "Pages > Homepage > Content Blocks"
  short_formatted: string;  // "Homepage > Content Blocks"
  depth: number;           // Number of steps
  is_direct: boolean;      // True if only one step
}
```

### 2. **Path Step**
Each step in a path contains:
```typescript
interface PathStep {
  collection: string;       // Collection name
  collection_name: string;  // Display name
  id: string | number;      // Item ID
  name: string;            // Item display name
  field: string | null;    // Field name if applicable
  icon?: string;           // Collection icon
  status?: string;         // Item status
  admin_url?: string;      // Direct admin link
}
```

### 3. **Breadcrumbs**
Navigation-friendly format:
```typescript
interface Breadcrumb {
  label: string;           // Display text
  collection?: string;     // Collection (for collections)
  id?: string | number;    // Item ID (for items)
  field?: string;         // Field name (for fields)
  admin_url?: string;     // Click target
  icon?: string;          // Optional icon
  is_current?: boolean;   // Last item marker
}
```

### 4. **Path Collections**
Groups paths by collection:
```typescript
interface PathCollection {
  [collection: string]: {
    collection_name: string;
    icon: string;
    paths: Array<{
      path: string;
      admin_url?: string;
      item_id: string | number;
      item_name: string;
    }>;
  };
}
```

## API Reference

### Constructor
```typescript
const pathBuilder = new PathBuilderService({
  database: knex,
  services: directusServices,
  schema: directusSchema,
  accountability: req.accountability,
  defaultLocale: 'en-US',
  usageFinder: usageFinderInstance,
  cache: cacheInstance
});
```

### Main Methods

#### `buildPath(usage: UsageLocation, options?: PathBuildOptions): Promise<UsagePath>`
Builds a complete path from a usage location.

```typescript
const path = await pathBuilder.buildPath(usageLocation, {
  includeCollections: true,
  includeFields: true,
  includeIds: false,
  includeAdminUrls: true,
  adminBaseUrl: '/admin'
});

// Result:
{
  from: { collection: 'products', id: 123, name: 'T-Shirt' },
  to: { collection: 'pages', id: 1, name: 'Homepage' },
  steps: [...],
  formatted: 'Pages > Homepage > Content Blocks > Product Grid',
  short_formatted: 'Homepage > Product Grid',
  depth: 3
}
```

#### `buildBreadcrumbs(usage: UsageLocation, options?: PathBuildOptions): Promise<Breadcrumb[]>`
Creates breadcrumb navigation from usage.

```typescript
const breadcrumbs = await pathBuilder.buildBreadcrumbs(usage, {
  includeAdminUrls: true,
  adminBaseUrl: '/admin'
});

// Result:
[
  { label: 'Pages', collection: 'pages', admin_url: '/admin/content/pages' },
  { label: 'Homepage', id: 1, admin_url: '/admin/content/pages/1' },
  { label: 'Content Blocks', field: 'blocks', is_current: true }
]
```

#### `buildAllPaths(collection: string, itemId: string | number, options?: PathBuildOptions): Promise<PathCollection>`
Builds all paths for an item's usage locations.

```typescript
const allPaths = await pathBuilder.buildAllPaths('products', 123, {
  includeAdminUrls: true
});

// Result:
{
  by_collection: {
    pages: {
      collection_name: 'Pages',
      icon: 'article',
      paths: [
        { path: 'Homepage > Content Blocks', admin_url: '/admin/content/pages/1' },
        { path: 'About > Hero Section', admin_url: '/admin/content/pages/2' }
      ]
    }
  },
  shortest_paths: ['Homepage > Content Blocks', 'About > Hero'],
  total_paths: 2
}
```

#### `formatPath(steps: PathStep[], options?: PathFormatOptions): string`
Formats path steps into a string.

```typescript
const formatted = pathBuilder.formatPath(steps, {
  separator: ' → ',
  style: 'full',
  includeCollections: true,
  includeFields: false
});

// Result: "Pages → Homepage → Content Blocks"
```

#### `visualizePaths(paths: UsagePath[], options?: PathVisualizationOptions): PathVisualization`
Creates visual representations of paths.

```typescript
const viz = await pathBuilder.visualizePaths(paths, {
  format: 'tree',
  maxDepth: 3
});

// Result:
{
  tree: {
    'pages': {
      name: 'Pages',
      children: {
        '1': { name: 'Homepage', children: {...} }
      }
    }
  },
  ascii: '├── Pages\n│   └── Homepage\n│       └── Content Blocks'
}
```

## Usage Examples

### Basic Path Building
```typescript
// From a usage location
const usage: UsageLocation = {
  collection: 'pages',
  item_id: 1,
  item_name: 'Homepage',
  field: 'blocks',
  // ... other fields
};

const path = await pathBuilder.buildPath(usage);
console.log(path.formatted); // "Pages > Homepage > Content Blocks"
```

### Building Admin Navigation
```typescript
// Generate clickable breadcrumbs for admin panel
const breadcrumbs = await pathBuilder.buildBreadcrumbs(usage, {
  includeAdminUrls: true,
  adminBaseUrl: '/directus'
});

// Use in UI
breadcrumbs.forEach(crumb => {
  if (crumb.admin_url) {
    console.log(`<a href="${crumb.admin_url}">${crumb.label}</a>`);
  } else {
    console.log(`<span>${crumb.label}</span>`);
  }
});
```

### Complete Usage Analysis
```typescript
// Find all paths where a product is used
const usageTree = await usageFinder.findAllUsages('products', 123);
const allPaths = await pathBuilder.buildAllPaths('products', 123);

// Display by collection
Object.entries(allPaths.by_collection).forEach(([collection, data]) => {
  console.log(`\n${data.collection_name}:`);
  data.paths.forEach(p => {
    console.log(`  - ${p.path}`);
  });
});
```

### Custom Path Formatting
```typescript
// Different formatting styles
const steps = [...]; // Path steps

// Full path with everything
const full = pathBuilder.formatPath(steps, {
  style: 'full',
  separator: ' > ',
  includeCollections: true,
  includeFields: true,
  includeIds: true
});
// "Pages (pages) #1 > Homepage > Content Blocks (blocks)"

// Short path for UI
const short = pathBuilder.formatPath(steps, {
  style: 'short',
  includeCollections: false,
  includeFields: false
});
// "Homepage > Content Blocks"

// Custom template
const custom = pathBuilder.formatPath(steps, {
  template: '{{name}} [{{collection}}]',
  separator: ' → '
});
// "Homepage [pages] → Content Blocks [blocks]"
```

## Implementation Details

### 1. **Path Building Algorithm**
Builds paths from bottom to top:
1. Start with usage location (where item is used)
2. Load parent item details
3. Continue up the hierarchy until reaching root
4. Reverse steps for top-down presentation

### 2. **Display Name Resolution**
Resolves human-readable names:
1. Check for title/name fields in item
2. Fall back to display template from collection settings
3. Use translated values if available
4. Default to ID if no name found

### 3. **Caching Strategy**
- Paths are cached with SHORT TTL (5 minutes)
- Cache key includes all options for accuracy
- Invalidated when items change

### 4. **Admin URL Generation**
Generates correct admin URLs based on:
- Collection type (singleton vs regular)
- Module location (content, users, files, etc.)
- Custom module paths

## Advanced Features

### Path Templates
```typescript
// Custom path templates with variables
const formatted = pathBuilder.formatPath(steps, {
  template: '{{icon}} {{name}}{{#if field}} ({{field}}){{/if}}',
  separator: ' > '
});
// "📄 Homepage > 🔧 Content Blocks (blocks)"
```

### Path Visualization
```typescript
// ASCII tree visualization
const viz = await pathBuilder.visualizePaths(paths, {
  format: 'ascii',
  showIds: true,
  showIcons: true
});

/*
📁 Pages
├── 📄 Homepage [1]
│   ├── 🔧 blocks: Content Blocks
│   └── 🖼️ hero: Hero Section
└── 📄 About [2]
    └── 🔧 blocks: Content Blocks
*/
```

### Batch Path Building
```typescript
// Build paths for multiple usage locations
const usageLocations = [...]; // Array of usage locations

const paths = await Promise.all(
  usageLocations.map(usage => 
    pathBuilder.buildPath(usage, { includeAdminUrls: true })
  )
);

// Group by collection
const grouped = paths.reduce((acc, path) => {
  const collection = path.to.collection;
  if (!acc[collection]) acc[collection] = [];
  acc[collection].push(path);
  return acc;
}, {});
```

## Performance Considerations

### 1. **Caching**
- All paths are cached for 5 minutes
- Batch operations share cache entries
- Consider warming cache for frequently accessed items

### 2. **Batch Loading**
```typescript
// Efficient: Load all paths at once
const allPaths = await pathBuilder.buildAllPaths('products', 123);

// Inefficient: Individual path building
for (const usage of usages) {
  const path = await pathBuilder.buildPath(usage);
}
```

### 3. **Display Name Resolution**
- Display names are resolved once per item
- Translations are loaded in batch
- Consider caching frequently used names

## Error Handling

### Missing Items
```typescript
try {
  const path = await pathBuilder.buildPath(usage);
} catch (error) {
  if (error.message.includes('not found')) {
    // Handle deleted parent items
    console.log('Parent item has been deleted');
  }
}
```

### Permission Errors
```typescript
// Paths respect user permissions
const path = await pathBuilder.buildPath(usage);
// Steps may be filtered based on user access
```

## Integration Examples

### With UsageFinderService
```typescript
// Complete usage analysis with paths
const usageTree = await usageFinder.findAllUsages('products', 123);

// Build paths for all direct usages
const pathsWithUsage = await Promise.all(
  usageTree.direct_usages.map(async usage => ({
    usage,
    path: await pathBuilder.buildPath(usage),
    breadcrumbs: await pathBuilder.buildBreadcrumbs(usage)
  }))
);
```

### In API Endpoints
```typescript
// Add paths to item response
router.get('/items/:collection/:id/usage', async (req, res) => {
  const { collection, id } = req.params;
  
  const usageTree = await usageFinder.findAllUsages(collection, id);
  const paths = await pathBuilder.buildAllPaths(collection, id, {
    includeAdminUrls: true,
    adminBaseUrl: '/admin'
  });
  
  res.json({
    usage: usageTree,
    paths: paths,
    primary_path: paths.shortest_paths[0]
  });
});
```

## Best Practices

1. **Always Include Admin URLs** for interactive UIs
2. **Use Short Format** for limited space displays
3. **Cache Aggressively** for frequently accessed items
4. **Batch Operations** when building multiple paths
5. **Handle Missing Items** gracefully in paths
6. **Respect Permissions** in path visibility
7. **Provide Fallbacks** for missing display names

## Related Documentation

- [UsageFinderService](./UsageFinderService.md) - Finds usage locations
- [CacheService](./CacheService.md) - Caching layer
- [ItemLoader](./ItemLoader.md) - Loads item details