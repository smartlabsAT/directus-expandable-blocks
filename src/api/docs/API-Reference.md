# RelationAnalyzer API Quick Reference

## Endpoint

```
GET /items-with-relations/:collection
```

Returns all possible locations where items from `:collection` can be used.

## Response Format

```json
[
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
]
```

## Field Descriptions

### PossibleUsageLocation
| Field | Type | Description |
|-------|------|-------------|
| collection | string | Technical collection name |
| collection_name | string | Human-readable collection name |
| collection_icon | string | Icon identifier from Directus |
| fields | string[] | List of fields that reference the target |
| relation_details | RelationDetail[] | Detailed information per field |

### RelationDetail
| Field | Type | Description |
|-------|------|-------------|
| field | string | Field name in parent collection |
| field_name | string | Human-readable field name |
| relation_type | string | Type: M2A, M2O, O2M |
| junction_table | string? | Junction table name (M2A only) |
| junction_field | string? | Field pointing to parent (M2A only) |
| item_field | string? | Field containing item ID (M2A only) |
| collection_field | string? | Field containing collection name (M2A only) |
| sort_field | string? | Sort field in junction table |
| relation_id | number | ID from directus_relations (-1 for synthetic) |

## Examples

### Basic Usage
```bash
curl http://localhost:8055/items-with-relations/products
```

### With System Collections
```typescript
const locations = await relationAnalyzer.getPossibleUsageLocations('directus_files', {
  includeSystem: true
});
```

### Translation Tables
```bash
# Automatically detects translation pattern
curl http://localhost:8055/items-with-relations/pages_translations

# Returns:
[{
  "collection": "pages",
  "fields": ["translations"],
  "relation_details": [{
    "field": "translations",
    "relation_type": "O2M",
    "relation_id": -1  # Synthetic relation
  }]
}]
```

## Error Responses

### Collection Not Found
```json
{
  "errors": [{
    "message": "Invalid collection: unknown_collection",
    "extensions": {
      "code": "INVALID_COLLECTION"
    }
  }]
}
```

### Database Error
```json
{
  "errors": [{
    "message": "Failed to load relations for 'collection': error details",
    "extensions": {
      "code": "DATABASE_QUERY_ERROR"
    }
  }]
}
```