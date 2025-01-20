# Expandable Blocks API Reference

The Expandable Blocks Extension provides three specialized API endpoints optimized for managing M2A relationships and finding item usage locations.

## Endpoint Overview

1. **Metadata Endpoint** - Provides metadata about collections and their relationships
2. **Search Endpoint** - Fast search for items with translations
3. **Detail Endpoint** - Detailed information including usage locations for specific items

## 1. Metadata Endpoint

### Endpoint
```
GET /expandable-blocks-api/:collection/metadata
```

Provides comprehensive metadata about a collection for frontend initialization.

### Response Format
```json
{
  "collection": "products",
  "possibleLocations": [
    {
      "collection": "pages",
      "collection_name": "Pages",
      "collection_icon": "article",
      "fields": ["blocks", "hero_banner"],
      "relation_details": [
        {
          "field": "blocks",
          "field_name": "Content Blocks",
          "relation_type": "M2A",
          "junction_table": "pages_blocks",
          "junction_field": "pages_id",
          "item_field": "item",
          "collection_field": "collection",
          "sort_field": "sort",
          "relation_id": 42
        }
      ]
    }
  ],
  "searchableFields": [
    {
      "field": "title",
      "type": "string",
      "meta": {
        "interface": "input",
        "display": "formatted-value",
        "display_options": {},
        "required": true
      }
    },
    {
      "field": "description",
      "type": "text",
      "meta": {
        "interface": "input-rich-text-html"
      }
    }
  ],
  "translationInfo": {
    "hasTranslations": true,
    "translationsField": "translations",
    "translationsCollection": "products_translations",
    "languageField": "languages_code",
    "primaryKeyField": "products_id",
    "isTranslationTable": false
  },
  "cached_at": "2024-01-15T10:30:00Z"
}
```

### Features
- **Caching**: Metadata is cached with long TTL for optimal performance
- **Permissions**: Respects user permissions via `accountability`
- **Translation Support**: Automatically detects translation structures

## 2. Search Endpoint

### Endpoint
```
GET /expandable-blocks-api/:collection/search
```

Fast search for items with automatic translation integration.

### Query Parameters
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| limit | number | 10 | Number of results to return |
| offset | number | 0 | Offset for pagination |
| search | string | - | Search term (searches all searchable fields) |
| filter | object/string | - | Directus filter object (JSON) |
| fields | string | * | Comma-separated field list or * for all |
| sort | string | - | Comma-separated sort fields |

### Response Format
```json
{
  "data": [
    {
      "id": 1,
      "title": "Product Name",
      "description": "Product description",
      "translations": [
        {
          "languages_code": "de-DE",
          "title": "Produktname",
          "description": "Produktbeschreibung"
        },
        {
          "languages_code": "en-US",
          "title": "Product Name",
          "description": "Product description"
        }
      ]
    }
  ],
  "meta": {
    "filter_count": 25,
    "total_count": 100
  }
}
```

### Features
- **Full-Text Search**: Automatically searches all text-based fields
- **Translation Integration**: Automatically loads translations
- **Performance**: Optimized for fast response times without usage calculations

## 3. Detail Endpoint

### Endpoint
```
POST /expandable-blocks-api/:collection/detail
```

Provides detailed information for specific items including complete usage analysis.

### Request Body
```json
{
  "ids": [1, 2, 3],
  "fields": "*"  // Optional: field list
}
```

### Response Format
```json
{
  "data": [
    {
      "id": 1,
      "title": "Product Name",
      "_usage": {
        "direct_usages": [
          {
            "collection": "pages",
            "collection_meta": {
              "collection": "pages",
              "name": "Pages",
              "icon": "article"
            },
            "item_id": 5,
            "item_display": "Homepage",
            "field": "blocks",
            "field_meta": {
              "field": "blocks",
              "name": "Content Blocks",
              "type": "alias",
              "interface": "list-m2a"
            },
            "path": "Pages > Homepage > Content Blocks",
            "short_path": "Homepage > Content Blocks",
            "breadcrumbs": [
              {
                "label": "Pages",
                "collection": "pages",
                "admin_url": "/admin/content/pages"
              },
              {
                "label": "Homepage",
                "id": 5,
                "admin_url": "/admin/content/pages/5"
              },
              {
                "label": "Content Blocks",
                "field": "blocks"
              }
            ],
            "admin_url": "/admin/content/pages/5"
          }
        ],
        "total_usage_count": 3,
        "usage_tree": {
          "item": {
            "collection": "products",
            "id": 1,
            "display": "Product Name"
          },
          "direct_usages": [...],
          "nested_usages": [...],
          "total_usage_count": 3,
          "has_circular_reference": false
        },
        "usage_stats": {
          "by_collection": {
            "pages": 2,
            "posts": 1
          },
          "by_field": {
            "blocks": 2,
            "hero_banner": 1
          },
          "by_depth": {
            "1": 2,
            "2": 1
          },
          "total_count": 3,
          "max_depth": 2
        },
        "paths_by_collection": {
          "pages": [
            {
              "path": "Pages > Homepage > Content Blocks",
              "admin_url": "/admin/content/pages/5"
            }
          ]
        },
        "shortest_paths": [
          "Homepage > Content Blocks",
          "About Us > Hero Banner"
        ],
        "has_circular_reference": false
      }
    }
  ]
}
```

### Features
- **Deep Usage Analysis**: Finds all usage locations up to configurable depth
- **Path Building**: Creates readable paths and breadcrumbs
- **Admin URLs**: Generates direct links to Directus Admin Panel
- **Statistics**: Provides aggregated usage statistics
- **Caching**: Usage information is cached for short periods

## Example Workflows

### 1. Item Selection Dialog
```javascript
// 1. Load metadata when opening dialog
const metadata = await fetch('/expandable-blocks-api/products/metadata')
  .then(r => r.json());

// 2. Search items as user types
const searchResults = await fetch(
  '/expandable-blocks-api/products/search?search=shirt&limit=20'
).then(r => r.json());

// 3. Load details for selected items
const details = await fetch('/expandable-blocks-api/products/detail', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({ids: [1, 2, 3]})
}).then(r => r.json());
```

### 2. Usage Analysis for Content Managers
```javascript
// Find all places where a product is used
const usage = await fetch('/expandable-blocks-api/products/detail', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({ids: [productId]})
}).then(r => r.json());

// Show warning when deleting
if (usage.data[0]._usage.total_usage_count > 0) {
  alert(`This product is used in ${usage.data[0]._usage.total_usage_count} places!`);
}
```

## Error Handling

### Standard Error Format
```json
{
  "errors": [{
    "message": "Error description",
    "extensions": {
      "code": "ERROR_CODE"
    }
  }]
}
```

### Error Codes
| Code | Description |
|------|-------------|
| INVALID_COLLECTION | Collection does not exist |
| INVALID_PAYLOAD | Invalid request parameters |
| DATABASE_QUERY_ERROR | Database error |
| INTERNAL_SERVER_ERROR | Unexpected error |

## Performance Optimizations

### Caching Strategy
- **Metadata**: Long TTL (1 hour)
- **Collection Relations**: Long TTL (1 hour)
- **Item Usage**: Short TTL (5 minutes)
- **Search Results**: No caching

### Best Practices
1. **Batch Requests**: Use detail endpoint for multiple IDs at once
2. **Field Selection**: Load only required fields with `fields` parameter
3. **Pagination**: Use `limit` and `offset` for large datasets
4. **Filtering**: Use Directus filters for precise queries

## Integration with Directus

### Authentication
All endpoints respect Directus permissions:
- Use standard Directus authentication (Bearer Token)
- Endpoints honor user permissions via `accountability`

### Compatibility
- Directus v11.0.0+
- Supports all Directus relation types (M2A, M2O, O2M)
- Automatic detection of translation patterns