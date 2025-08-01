import type { Response } from 'express';
import type { DirectusRequest } from '../types/directus-api';
import type { Logger } from '../types/common';
import { ServiceFactory } from '../factories/ServiceFactory';
import { DirectusCacheWrapper } from '../services/DirectusCacheWrapper';
import { CacheTTL } from '../types/CacheTypes';
import { ItemQuery } from '../types/ItemLoaderTypes';
import type { SearchResponse } from '../schemas/response-schemas';
import { createValidationError } from '../schemas/response-schemas';
import { validateCollection, validateFields, validateFilter, validateSort, validatePagination } from '../utils/validation';

/**
 * Handler for the search endpoint that returns items with optional filtering and pagination
 * 
 * @example
 * GET /api/expandable-blocks-api/{collection}/search?search=term&limit=10&offset=0
 */
export class SearchHandler {
  constructor(
    private readonly serviceFactory: ServiceFactory,
    private readonly logger: Logger
  ) {}

  /**
   * Handle search request with filtering, pagination, and field selection
   * 
   * @param req - The incoming request with collection in params and query parameters
   * @param res - Express response object
   * @returns Promise that resolves when response is sent
   * @throws Will return appropriate HTTP error codes for validation or permission errors
   */
  public async handle(req: DirectusRequest, res: Response): Promise<void> {
    try {
      // Validate collection
      const collection = req.params.collection;
      validateCollection(collection);
      
      const cache = (req as DirectusRequest & { cache?: DirectusCacheWrapper }).cache || null;

      // Validate and parse query parameters
      const { limit, offset } = validatePagination(req.query.limit, req.query.offset);
      const fields = validateFields(req.query.fields);
      const filter = validateFilter(req.query.filter);
      const sort = validateSort(req.query.sort);
      const search = req.query.search as string | undefined;

      // Get item loader service
      const itemLoader = await this.serviceFactory.getItemLoader();

      // Build query object
      const query: ItemQuery = {
        limit,
        offset,
        fields,
        search,
        filter,
        sort,
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
    } catch (error) {
      // Log error but don't expose internals
      this.logger.error('Search handler error:', error);
      
      // Send appropriate error response
      if (error instanceof Error) {
        if (error.message.includes('not allowed') || error.message.includes('Collection')) {
          res.status(403).json(createValidationError('Access denied'));
          return;
        }
        if (error.message.includes('Invalid') || error.message.includes('required')) {
          res.status(400).json(createValidationError(error.message));
          return;
        }
      }
      
      // Generic error for unexpected issues
      res.status(500).json(createValidationError('An error occurred processing your request'));
    }
  }
}