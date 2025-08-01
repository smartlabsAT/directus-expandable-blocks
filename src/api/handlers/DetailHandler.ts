import type { Response } from 'express';
import type { DirectusRequest } from '../types/directus-api';
import type { DirectusItem, Logger } from '../types/common';
import { ServiceFactory } from '../factories/ServiceFactory';
import { DirectusCacheWrapper } from '../services/DirectusCacheWrapper';
import { CacheKeys, CacheTTL } from '../types/CacheTypes';
import type { DetailResponse, UsageLocation as ResponseUsageLocation, UsageSummary } from '../schemas/response-schemas';
import { createValidationError } from '../schemas/response-schemas';
import { validateCollection, validateIds, validateFields } from '../utils/validation';
import type { UsageFinderService } from '../services/UsageFinderService';
import type { PathBuilderService } from '../services/PathBuilderService';
import type { UsageLocation } from '../types/UsageFinderTypes';
import { getErrorMessage } from '../utils/error-utils';

/**
 * Handler for detail endpoint
 */
/**
 * Handler for the detail endpoint that returns items with their usage information
 * 
 * @example
 * POST /api/expandable-blocks-api/{collection}/detail
 * Body: { ids: [1, 2, 3], fields: ['*'] }
 */
export class DetailHandler {
  constructor(
    private readonly serviceFactory: ServiceFactory,
    private readonly logger: Logger
  ) {}

  /**
   * Handle detail request for retrieving items with usage information
   * 
   * @param req - The incoming request with collection in params and ids/fields in body
   * @param res - Express response object
   * @returns Promise that resolves when response is sent
   * @throws Will return appropriate HTTP error codes for validation or permission errors
   */
  public async handle(req: DirectusRequest, res: Response): Promise<void> {
    try {
      const cache = (req as DirectusRequest & { cache?: DirectusCacheWrapper }).cache || null;

      // Validate collection against whitelist
      const collection = req.params.collection;
      validateCollection(collection);
      
      // Get request data (body for POST, query for GET)
      const requestData = req.method === 'POST' ? req.body : req.query;
      
      // Validate request data
      if (!requestData || !requestData.ids) {
        res.status(400).json(createValidationError('ids array is required'));
        return;
      }
      
      // Validate and sanitize IDs
      const rawIds = Array.isArray(requestData.ids) ? requestData.ids : [requestData.ids];
      const ids = validateIds(rawIds);
      
      // Validate and sanitize fields
      const fields = validateFields(requestData.fields);

    // Get services
    const itemLoader = await this.serviceFactory.getItemLoader();
    const usageFinder = await this.serviceFactory.getUsageFinder(collection);
    const pathBuilder = cache ? await this.serviceFactory.getPathBuilder(collection, cache) : null;

    // Load items by IDs
    const itemsResult = await itemLoader.loadItems(collection, {
      filter: { id: { _in: ids } },
      fields,
      limit: -1,
      returnMinimalOnPermissionError: true
    });

    // Separate items by permission status
    const itemsWithPermission = itemsResult.data.filter(item => !item._no_permission);
    const itemsWithoutPermission = itemsResult.data.filter(item => item._no_permission);
    
    // Process items without permission immediately
    const processedNoPermission = itemsWithoutPermission.map(item => ({
      ...item,
      usage_locations: [],
      usage_summary: this.createEmptySummary()
    }));
    
    // Batch load usage for items with permission
    let processedWithPermission: any[] = [];
    
    if (itemsWithPermission.length > 0) {
      // Check cache first for all items
      const uncachedItems: any[] = [];
      const cachedResults: any[] = [];
      
      if (cache) {
        for (const item of itemsWithPermission) {
          const itemCacheKey = CacheKeys.itemDetail(collection, item.id, fields.join(','));
          const cached = await cache.get(itemCacheKey);
          
          if (cached) {
            cachedResults.push(cached);
          } else {
            uncachedItems.push(item);
          }
        }
      } else {
        uncachedItems.push(...itemsWithPermission);
      }
      
      // Batch load usage for uncached items
      const uncachedWithUsage = await this.batchLoadItemsWithUsage(
        uncachedItems,
        collection,
        usageFinder,
        pathBuilder,
        cache,
        fields
      );
      
      processedWithPermission = [...cachedResults, ...uncachedWithUsage];
    }
    
    // Combine all results maintaining original order
    const itemsWithUsage = itemsResult.data.map(originalItem => {
      if (originalItem._no_permission) {
        return processedNoPermission.find(item => item.id === originalItem.id)!;
      }
      return processedWithPermission.find(item => item.id === originalItem.id)!;
    });

      // Send response
      const response: DetailResponse = {
        data: itemsWithUsage
      };

      res.json(response);
    } catch (error) {
      // Log error but don't expose internals
      this.logger.error('Detail handler error: ' + getErrorMessage(error));
      
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

  /**
   * Batch load items with usage information
   */
  /**
   * Batch load usage information for multiple items
   * 
   * @param items - Array of items to process
   * @param collection - Collection name
   * @param usageFinder - Usage finder service instance
   * @param pathBuilder - Path builder service instance or null
   * @param cache - Cache wrapper instance or null
   * @param fields - Fields that were requested
   * @returns Array of items with usage information added
   */
  private async batchLoadItemsWithUsage(
    items: DirectusItem[],
    collection: string,
    usageFinder: UsageFinderService,
    pathBuilder: PathBuilderService | null,
    cache: DirectusCacheWrapper | null,
    fields: string[]
  ): Promise<DirectusItem[]> {
    if (items.length === 0) {
      return [];
    }
    
    try {
      // Collect all item IDs
      const itemIds = items.map(item => item.id);
      
      // For now, fall back to individual queries until batch method is implemented
      // TODO: Implement proper batch query method in UsageFinderService
      const allUsages: any[] = [];
      
      for (const itemId of itemIds) {
        const itemUsages = await usageFinder.findDirectUsages(collection, itemId, {
          includeFieldMetadata: true,
          excludeTranslations: true,
          groupDuplicates: false
        });
        
        // Add target_id to each usage for filtering later
        itemUsages.forEach((usage: any) => {
          usage.target_id = itemId;
        });
        
        allUsages.push(...itemUsages);
      }
      
      // Process each item with its usages
      return await Promise.all(
        items.map(async (item) => {
          const itemUsages = allUsages.filter((usage: any) => usage.target_id === item.id);
          
          // Build usage locations with path information
          const usageLocations = await this.buildUsageLocations(itemUsages, pathBuilder);
          
          // Calculate summary
          const summary = this.calculateUsageSummary(usageLocations);
          
          const result = {
            ...item,
            usage_locations: usageLocations,
            usage_summary: summary
          };
          
          // Cache the result
          if (cache) {
            const itemCacheKey = CacheKeys.itemDetail(collection, item.id, fields.join(','));
            await cache.set(itemCacheKey, result, { 
              ttl: cache.getTTLForDataType('detail') || CacheTTL.SHORT 
            });
          }
          
          return result;
        })
      );
    } catch (error) {
      this.logger.error('Error batch processing usage: ' + getErrorMessage(error));
      
      // Fallback to individual processing on error
      return Promise.all(
        items.map(item => this.loadItemWithUsage(item, collection, usageFinder, pathBuilder))
      );
    }
  }

  /**
   * Load item with usage information
   */
  /**
   * Load usage information for a single item
   * 
   * @param item - The item to process
   * @param collection - Collection name
   * @param usageFinder - Usage finder service instance
   * @param pathBuilder - Path builder service instance or null
   * @returns Item with usage information added
   */
  private async loadItemWithUsage(
    item: DirectusItem,
    collection: string,
    usageFinder: UsageFinderService,
    pathBuilder: PathBuilderService | null
  ): Promise<DirectusItem> {
    try {
      // Find direct usages only, excluding translations
      const directUsages = await usageFinder.findDirectUsages(collection, item.id, {
        includeFieldMetadata: true,
        excludeTranslations: true,
        groupDuplicates: false
      });

      // Build usage locations with full path information
      const usageLocations = await this.buildUsageLocations(directUsages, pathBuilder);
      
      // Calculate simple summary
      const summary = this.calculateUsageSummary(usageLocations);

      return {
        ...item,
        usage_locations: usageLocations,
        usage_summary: summary
      };
    } catch (error) {
      this.logger.error(`Error processing usage for item ${item.id}: ` + getErrorMessage(error));
      return {
        ...item,
        usage_locations: [],
        usage_summary: this.createEmptySummary()
      };
    }
  }

  /**
   * Build usage locations with full path information
   */
  /**
   * Build usage location objects from raw usage data
   * 
   * @param directUsages - Raw usage data from usage finder
   * @param pathBuilder - Path builder service instance or null
   * @returns Array of formatted usage locations
   */
  private async buildUsageLocations(
    directUsages: UsageLocation[],
    pathBuilder: PathBuilderService | null
  ): Promise<ResponseUsageLocation[]> {
    const locations: ResponseUsageLocation[] = [];
    
    for (const usage of directUsages) {
      // Build path with full relation information
      const path = pathBuilder 
        ? await pathBuilder.buildSimplePathWithRelations(usage)
        : null;
      
      locations.push({
        id: usage.item_id,
        collection: usage.collection,
        collection_display: usage.collection_name,
        title: usage.item_name,
        status: usage.status || null,
        field: usage.field,
        field_display: usage.field_name || usage.field || '',
        sort: usage.sort || null,
        path,
        edit_url: `/admin/content/${usage.collection}/${usage.item_id}`
      });
    }
    
    return locations;
  }

  /**
   * Calculate usage summary from usage locations
   */
  private calculateUsageSummary(usageLocations: ResponseUsageLocation[]): UsageSummary {
    const summary: UsageSummary = {
      total_count: usageLocations.length,
      by_collection: {},
      by_status: {}
    };
    
    for (const location of usageLocations) {
      // Count by collection
      if (!summary.by_collection[location.collection]) {
        summary.by_collection[location.collection] = 0;
      }
      summary.by_collection[location.collection]++;
      
      // Count by status
      if (location.status) {
        if (!summary.by_status[location.status]) {
          summary.by_status[location.status] = 0;
        }
        summary.by_status[location.status]++;
      }
    }
    
    return summary;
  }

  /**
   * Create empty usage summary
   */
  private createEmptySummary(): UsageSummary {
    return {
      total_count: 0,
      by_collection: {},
      by_status: {}
    };
  }
}