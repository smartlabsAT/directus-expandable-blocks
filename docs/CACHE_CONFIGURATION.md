# Cache Configuration for Expandable Blocks

## Overview

The Expandable Blocks extension includes a powerful caching system to improve API performance. The cache can be configured at two levels:

1. **Interface Level**: Enable/disable cache per field
2. **Global Level**: Configure cache TTLs and behavior via environment variables

## Interface-Level Configuration

Each M2A field using the Expandable Blocks interface has a simple cache toggle:

- **Enable Caching**: Toggle to enable/disable caching for this specific field
- Default: `true` (enabled)
- Use case: Disable during development for real-time data updates

## Global Cache Configuration

Cache behavior can be fine-tuned using environment variables. Add these to your `.env` file:

### Environment Variables

```bash
# Cache TTL Settings (in minutes)
EXPANDABLE_BLOCKS_CACHE_TTL_METADATA=30    # Collection metadata (default: 30)
EXPANDABLE_BLOCKS_CACHE_TTL_SEARCH=5        # Search results (default: 5)
EXPANDABLE_BLOCKS_CACHE_TTL_DETAIL=10       # Item details with usage (default: 10)
EXPANDABLE_BLOCKS_CACHE_TTL_PATHS=10        # Usage paths (default: 10)

# Default TTL for other cache entries (in milliseconds)
EXPANDABLE_BLOCKS_CACHE_DEFAULT_TTL=600000  # Default: 10 minutes

# Maximum cache size
EXPANDABLE_BLOCKS_CACHE_MAX_SIZE=50000      # Maximum cached items (default: 50000)
```

### Data Types Explained

- **metadata**: Collection structure, searchable fields, translation info
- **search**: Search results from the item selector
- **detail**: Individual item details including usage information
- **paths**: Usage path calculations

## Default Values

If no environment variables are set, the following defaults are used:

| Data Type | Default TTL |
|-----------|-------------|
| Metadata  | 30 minutes  |
| Search    | 5 minutes   |
| Detail    | 10 minutes  |
| Paths     | 10 minutes  |

## Cache Strategy

The extension uses an in-memory cache by default. This provides:
- Fast response times
- Automatic cleanup of expired entries
- LRU (Least Recently Used) eviction when size limit is reached

## Development Tips

### Disable Cache During Development

1. **Per Field**: Toggle "Enable Caching" to OFF in the field settings
2. **Globally**: Set very short TTLs in environment variables:
   ```bash
   EXPANDABLE_BLOCKS_CACHE_TTL_METADATA=1
   EXPANDABLE_BLOCKS_CACHE_TTL_SEARCH=1
   EXPANDABLE_BLOCKS_CACHE_TTL_DETAIL=1
   ```

### Testing Cache Behavior

The API respects the `X-Cache-Enabled` header sent by the interface:
- `X-Cache-Enabled: true` - Uses cache (if available)
- `X-Cache-Enabled: false` - Bypasses cache completely

## Performance Considerations

1. **Metadata Cache**: Set longer TTLs (30-60 minutes) as collection structure rarely changes
2. **Search Cache**: Keep shorter (5-10 minutes) for fresher results
3. **Detail Cache**: Balance between performance and data freshness (10-15 minutes)
4. **Max Size**: Increase for larger datasets, decrease if memory is limited

## Example Configuration

### Production Environment
```bash
# Optimized for performance
EXPANDABLE_BLOCKS_CACHE_TTL_METADATA=60    # 1 hour
EXPANDABLE_BLOCKS_CACHE_TTL_SEARCH=10      # 10 minutes
EXPANDABLE_BLOCKS_CACHE_TTL_DETAIL=15      # 15 minutes
EXPANDABLE_BLOCKS_CACHE_MAX_SIZE=100000    # 100k items
```

### Development Environment
```bash
# Optimized for real-time updates
EXPANDABLE_BLOCKS_CACHE_TTL_METADATA=5     # 5 minutes
EXPANDABLE_BLOCKS_CACHE_TTL_SEARCH=1       # 1 minute
EXPANDABLE_BLOCKS_CACHE_TTL_DETAIL=2       # 2 minutes
EXPANDABLE_BLOCKS_CACHE_MAX_SIZE=10000     # 10k items
```

## Monitoring

The cache logs initialization details to the Directus logs:
```
[API] Initialized cache with global config: {
  defaultTTL: 600000,
  maxKeys: 50000,
  ttlOverrides: { metadata: 1800000, search: 300000, detail: 600000, paths: 600000 }
}
```

## Future Enhancements

- Redis support for distributed caching
- Cache warming strategies
- Per-collection TTL overrides
- Cache invalidation webhooks