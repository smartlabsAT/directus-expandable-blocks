import type { Response } from 'express';
import type { DirectusRequest } from '../types/directus-api';
import { ServiceFactory } from '../factories/ServiceFactory';
import { DirectusCacheWrapper } from '../services/DirectusCacheWrapper';
import { CacheTTL } from '../types/CacheTypes';
import { ItemQuery } from '../types/ItemLoaderTypes';
import type { SearchResponse } from '../schemas/response-schemas';
import type { SearchRequest } from '../schemas/request-schemas';
import { parseSearchQuery } from '../schemas/request-schemas';

/**
 * Handler for search endpoint
 */
export class SearchHandler {
  constructor(
    private readonly serviceFactory: ServiceFactory,
    private readonly logger: any
  ) {}

  /**
   * Handle search request
   */
  handle = async (req: DirectusRequest & SearchRequest, res: Response): Promise<void> => {
    const { collection } = req.params;
    const cache = (req as any).cache as DirectusCacheWrapper | null;

    // Parse and validate query parameters
    const parsedQuery = parseSearchQuery(req.query);

    // Get item loader service
    const itemLoader = await this.serviceFactory.getItemLoader();

    // Build query object
    const query: ItemQuery = {
      limit: parsedQuery.limit,
      offset: parsedQuery.offset,
      fields: parsedQuery.fields,
      search: parsedQuery.search,
      filter: parsedQuery.filter,
      sort: parsedQuery.sort,
      expandTranslations: true  // Always expand translations for search
    };

    // Create cache key for search query
    const searchCacheKey = cache ? `search:${collection}:${JSON.stringify(query)}` : null;
    
    // Load items with translations
    const itemsResult = cache && searchCacheKey
      ? await cache.getOrSet(
          searchCacheKey,
          async () => itemLoader.loadItems(collection, query),
          { ttl: cache.getTTLForDataType('search') || CacheTTL.SHORT }
        )
      : await itemLoader.loadItems(collection, query);

    // Send response
    const response: SearchResponse = {
      data: itemsResult.data,
      meta: itemsResult.meta
    };

    res.json(response);
  }
}