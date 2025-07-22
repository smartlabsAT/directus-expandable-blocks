# Expandable Blocks API Documentation

> **Version 2.0** - Updated: July 2025
> 
> **Breaking Changes:**
> - The `/detail` endpoint now returns a simplified response structure
> - `_usage` object replaced with `usage_locations` array and `usage_summary` object
> - Translation references are automatically excluded from usage tracking
> - Each M2A relationship is now listed individually (no more grouping)

## Overview

The Expandable Blocks extension provides three specialized API endpoints for efficient data retrieval with usage tracking capabilities.

## Authentication

All endpoints require authentication via Bearer token:

```http
Authorization: Bearer YOUR_DIRECTUS_TOKEN
```

## Base URL

```
https://yourdomain/expandable-blocks-api
```

## Endpoints

### 1. Collection Metadata

Get metadata about a collection including possible usage locations, searchable fields, and translation configuration.

**Endpoint:** `GET /:collection/metadata`

**Example Request:**
```http
GET /expandable-blocks-api/pages/metadata
```

**Response:**
```json
{
  "collection": "pages",
  "possibleLocations": [
    {
      "collection": "page_blocks",
      "fields": ["page"],
      "display_name": "Page Blocks",
      "icon": "view_module"
    }
  ],
  "searchableFields": [
    {
      "field": "title",
      "type": "string",
      "display_name": "Title",
      "searchable": true,
      "weight": 10
    }
  ],
  "translationInfo": {
    "hasTranslations": true,
    "combinedTranslationFields": [...],
    "standardTranslationFields": [],
    "jsonTranslationFields": []
  },
  "cached_at": "2025-07-21T16:30:00.000Z"
}
```

**Cache:** 30 minutes

### 2. Fast Search

Search and retrieve items with translations but without usage information. Optimized for speed.

**Endpoint:** `GET /:collection/search`

**Query Parameters:**
- `limit` (number, default: 10) - Items per page
- `offset` (number, default: 0) - Skip items for pagination
- `search` (string) - Search term
- `filter` (object/string) - Directus filter
- `fields` (string) - Comma-separated field list
- `sort` (string) - Sort fields (prefix with - for DESC)

**Example Requests:**

Basic search:
```http
GET /expandable-blocks-api/pages/search?search=home&limit=10
```

Pagination (Page 3, 20 items per page):
```http
GET /expandable-blocks-api/pages/search?limit=20&offset=40&sort=-date_created
```

Filtering:
```http
GET /expandable-blocks-api/pages/search?filter[status][_eq]=published&filter[featured][_eq]=true
```

Complex filter (JSON):
```http
GET /expandable-blocks-api/blocks/search?filter={"_and":[{"status":{"_eq":"published"}},{"_or":[{"type":{"_eq":"hero"}},{"type":{"_eq":"cta"}}]}]}
```

Specific fields:
```http
GET /expandable-blocks-api/pages/search?fields=id,title,slug,status,translations
```

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "title": "Homepage",
      "slug": "home",
      "status": "published",
      "translations": [...]
    }
  ],
  "meta": {
    "filter_count": 10,
    "total_count": 42
  }
}
```

### 3. Item Detail with Usage

Get specific items by IDs with simplified usage tracking information.

**Endpoint:** `POST /:collection/detail`

**Request Body:**
```json
{
  "ids": [1, 2, 3, 5, 8],
  "fields": "*"  // Optional, defaults to all fields
}
```

**Example Request:**
```http
POST /expandable-blocks-api/pages/detail
Content-Type: application/json

{
  "ids": [1, 2, 3],
  "fields": "*"
}
```

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "title": "Homepage",
      "slug": "home",
      "status": "published",
      "translations": [
        {
          "id": 1,
          "languages_code": "de-DE",
          "title": "Startseite"
        },
        {
          "id": 2,
          "languages_code": "en-US",
          "title": "Homepage"
        }
      ],
      "usage_locations": [
        {
          "id": "1",
          "collection": "navigation_items",
          "collection_display": "Navigation Items",
          "title": "Main Menu - Home",
          "status": "published",
          "field": "page_id",
          "field_display": "Page",
          "sort": null,
          "path": [
            {
              "id": "1",
              "collection": "navigation_items",
              "collection_display": "Navigation Items",
              "title": "Main Menu - Home",
              "status": "published",
              "linked_via_field": "page_id",
              "linked_via_field_display": "Page"
            }
          ],
          "edit_url": "/admin/content/navigation_items/1"
        },
        {
          "id": "5",
          "collection": "page_blocks",
          "collection_display": "Page Blocks",
          "title": "Hero Banner",
          "status": "published",
          "field": "blocks",
          "field_display": "Content Blocks",
          "sort": 1,
          "path": [
            {
              "id": "10",
              "collection": "pages",
              "collection_display": "Pages",
              "title": "About Us",
              "status": "published",
              "linked_via_field": "parent_page",
              "linked_via_field_display": "Parent Page"
            },
            {
              "id": "5",
              "collection": "page_blocks",
              "collection_display": "Page Blocks",
              "title": "Hero Banner",
              "status": "published",
              "linked_via_field": "blocks",
              "linked_via_field_display": "Content Blocks"
            }
          ],
          "edit_url": "/admin/content/page_blocks/5"
        }
      ],
      "usage_summary": {
        "total_count": 2,
        "by_collection": {
          "navigation_items": 1,
          "page_blocks": 1
        },
        "by_status": {
          "published": 2
        }
      }
    }
  ]
}
```

**Cache:** 5 minutes for usage data

## Usage Patterns

### Block Selector Implementation

1. **Initialize Interface:**
   ```javascript
   // Load metadata once on component mount
   const metadata = await fetch('/expandable-blocks-api/blocks/metadata');
   ```

2. **Live Search:**
   ```javascript
   // Fast search without usage for autocomplete
   const results = await fetch('/expandable-blocks-api/blocks/search?search=' + searchTerm);
   ```

3. **Load Selected Items:**
   ```javascript
   // Get full data with usage for selected/visible items
   const withUsage = await fetch('/expandable-blocks-api/blocks/detail', {
     method: 'POST',
     body: JSON.stringify({ ids: [1, 2, 3] })
   });
   ```

### Pagination Example

```javascript
const PAGE_SIZE = 20;
let currentPage = 1;

async function loadPage(page) {
  const offset = (page - 1) * PAGE_SIZE;
  const response = await fetch(
    `/expandable-blocks-api/pages/search?limit=${PAGE_SIZE}&offset=${offset}&sort=-date_updated`
  );
  return response.json();
}
```

## Performance Considerations

1. **Metadata Endpoint**: Cached for 30 minutes, call once per session
2. **Search Endpoint**: No usage calculations, optimized for speed
3. **Usage Endpoint**: Only request usage for visible/selected items
4. **Batch Requests**: Send multiple IDs in one request instead of individual calls

## Error Handling

All endpoints return errors in Directus standard format:

```json
{
  "errors": [
    {
      "message": "Error description",
      "extensions": {
        "code": "ERROR_CODE"
      }
    }
  ]
}
```

Common error codes:
- `INVALID_PAYLOAD` - Invalid request body
- `FORBIDDEN` - No permission to access collection
- `INTERNAL_SERVER_ERROR` - Server error

## Postman Collection

Import the included `postman-collection.json` file for ready-to-use API examples with all endpoints and various filtering/pagination scenarios.