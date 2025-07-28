# Expandable Blocks API Documentation

The Expandable Blocks extension provides a bundle API endpoint that enhances the M2A interface with search, metadata, and usage tracking capabilities.

## Base URL

```
/expandable-blocks-api/
```

## Authentication

All endpoints use standard Directus authentication:
- Bearer Token in Authorization header
- Respects user permissions via Directus `accountability`

## Endpoints

### 1. Search Endpoint

Fast search with automatic translation support.

```
GET /expandable-blocks-api/:collection/search
```

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `search` | string | - | Search term (searches all text fields) |
| `limit` | number | 10 | Number of results |
| `offset` | number | 0 | Pagination offset |
| `fields` | string | * | Comma-separated fields or * for all |
| `filter` | object | - | Directus filter object (JSON) |
| `sort` | string | - | Sort fields (e.g., "-date_created") |

#### Example Request

```bash
GET /expandable-blocks-api/products/search?search=shirt&limit=20
```

#### Response

```json
{
  "data": [
    {
      "id": 1,
      "title": "Blue Shirt",
      "status": "published",
      "translations": [
        {
          "languages_code": "de-DE",
          "title": "Blaues Hemd"
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

### 2. Detail Endpoint

Get detailed information including usage locations.

```
POST /expandable-blocks-api/:collection/detail
```

#### Request Body

```json
{
  "ids": [1, 2, 3],
  "fields": "*"  // Optional
}
```

#### Response

```json
{
  "data": [
    {
      "id": 1,
      "title": "Product Name",
      "_usage": {
        "total_usage_count": 3,
        "direct_usages": [
          {
            "collection": "pages",
            "item_id": 5,
            "item_display": "Homepage",
            "field": "content_blocks",
            "path": "Pages > Homepage > Content Blocks",
            "admin_url": "/admin/content/pages/5"
          }
        ],
        "usage_stats": {
          "by_collection": {
            "pages": 2,
            "posts": 1
          }
        }
      }
    }
  ]
}
```

### 3. Metadata Endpoint

Get collection metadata for frontend initialization.

```
GET /expandable-blocks-api/:collection/metadata
```

#### Response

```json
{
  "collection": "products",
  "searchableFields": [
    {
      "field": "title",
      "type": "string",
      "meta": {
        "interface": "input",
        "required": true
      }
    }
  ],
  "translationInfo": {
    "hasTranslations": true,
    "translationsField": "translations",
    "translationsCollection": "products_translations"
  },
  "possibleLocations": [
    {
      "collection": "pages",
      "collection_name": "Pages",
      "fields": ["content_blocks"],
      "relation_details": [...]
    }
  ]
}
```

## Frontend Integration

### Basic Search Implementation

```javascript
// Search items
const searchItems = async (collection, query) => {
  const response = await fetch(
    `/expandable-blocks-api/${collection}/search?` + 
    new URLSearchParams({
      search: query,
      limit: 20,
      fields: 'id,title,status'
    }),
    {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }
  );
  return response.json();
};
```

### Get Items with Usage

```javascript
// Get detailed information
const getItemDetails = async (collection, ids) => {
  const response = await fetch(
    `/expandable-blocks-api/${collection}/detail`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ ids })
    }
  );
  return response.json();
};
```

### Field-Specific Search

The search endpoint supports advanced queries:

```
// Simple search (all fields)
?search=blue shirt

// Field-specific search
?search=title:shirt AND status:published

// Complex queries
?search=title:shirt OR description:cotton
?search=price:>100 AND stock:>0
```

## Error Handling

All endpoints return standard Directus error format:

```json
{
  "errors": [{
    "message": "Collection not found",
    "extensions": {
      "code": "INVALID_COLLECTION"
    }
  }]
}
```

### Common Error Codes

| Code | Description |
|------|-------------|
| `INVALID_COLLECTION` | Collection does not exist |
| `INVALID_PAYLOAD` | Invalid request parameters |
| `FORBIDDEN` | No permission to access |
| `DATABASE_QUERY_ERROR` | Database error |

## Performance

### Caching

- **Metadata**: Cached for 1 hour
- **Usage Data**: Cached for 5 minutes
- **Search Results**: Not cached

### Best Practices

1. **Batch Requests**: Use detail endpoint for multiple items
2. **Field Selection**: Only request needed fields
3. **Pagination**: Use limit/offset for large datasets
4. **Filters**: Use Directus filters to reduce server load

## Architecture Overview

The API is built on several core services:

### ItemLoader
- Handles pagination, filtering, and sorting
- Provides consistent metadata (counts, pagination info)
- Integrates with Directus permissions

### RelationAnalyzer
- Analyzes M2A relationships between collections
- Finds all possible usage locations
- Builds relation maps for efficient queries

### TranslationFieldAnalyzer
- Detects translation patterns
- Automatically loads translations
- Supports Directus translation conventions

### CacheService
- Singleton pattern for efficient memory usage
- Configurable TTL per cache type
- Automatic cleanup of expired entries

## Configuration

The API respects these environment variables:

```env
# Cache settings
EXPANDABLE_BLOCKS_CACHE_TTL=3600000  # 1 hour
EXPANDABLE_BLOCKS_USAGE_CACHE_TTL=300000  # 5 minutes

# Performance
EXPANDABLE_BLOCKS_MAX_DEPTH=5  # Max depth for usage search
EXPANDABLE_BLOCKS_MAX_ITEMS=1000  # Max items per request
```

## Directus Compatibility

- **Version**: Directus v11.0.0+
- **Database**: PostgreSQL, MySQL, SQLite
- **Relations**: M2A, M2O, O2M, M2M
- **Translations**: Native Directus translations support