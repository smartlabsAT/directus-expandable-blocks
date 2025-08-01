import type { Response } from 'express';
import type { DirectusRequest } from '../types/directus-api';
import { ServiceFactory } from '../factories/ServiceFactory';
import { DirectusCacheWrapper } from '../services/DirectusCacheWrapper';
import { CacheTTL } from '../types/CacheTypes';
import { ItemQuery } from '../types/ItemLoaderTypes';
import type { SearchResponse } from '../schemas/response-schemas';

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
  handle = async (req: DirectusRequest, res: Response): Promise<void> => {
    // Extract collection from path
    const collection = req.params.collection;
    const cache = (req as any).cache as DirectusCacheWrapper | null;

    // Parse query parameters
    const parsedQuery = {
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 10,
      offset: req.query.offset ? parseInt(req.query.offset as string, 10) : 0,
      fields: req.query.fields ? 
        (typeof req.query.fields === 'string' ? 
          (req.query.fields === '*' ? ['*'] : req.query.fields.split(',').map(f => f.trim())) 
          : req.query.fields as string[]
        ) : ['*'],
      search: req.query.search as string | undefined,
      filter: req.query.filter ? 
        (typeof req.query.filter === 'string' ? JSON.parse(req.query.filter) : req.query.filter) 
        : undefined,
      sort: req.query.sort ? 
        (typeof req.query.sort === 'string' ? req.query.sort.split(',').map(s => s.trim()) : req.query.sort as string[]) 
        : undefined
    };

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