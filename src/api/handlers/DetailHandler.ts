import type { Response } from 'express';
import type { DirectusRequest } from '../types/directus-api';
import { ServiceFactory } from '../factories/ServiceFactory';
import { DirectusCacheWrapper } from '../services/DirectusCacheWrapper';
import { CacheKeys, CacheTTL } from '../types/CacheTypes';
import type { DetailResponse, UsageLocation, UsageSummary } from '../schemas/response-schemas';
import { createValidationError } from '../schemas/response-schemas';

/**
 * Handler for detail endpoint
 */
export class DetailHandler {
  constructor(
    private readonly serviceFactory: ServiceFactory,
    private readonly logger: any
  ) {}

  /**
   * Handle detail request
   */
  handle = async (req: DirectusRequest, res: Response): Promise<void> => {
    const cache = (req as any).cache as DirectusCacheWrapper | null;

    // Extract collection from path
    const collection = req.params.collection;
    
    // Get request data (body for POST, query for GET)
    const requestData = req.method === 'POST' ? req.body : req.query;
    
    // Validate request data
    if (!requestData || !requestData.ids) {
      res.status(400).json(createValidationError('ids array is required'));
      return;
    }
    
    // Ensure ids is an array
    const ids = Array.isArray(requestData.ids) ? requestData.ids : [requestData.ids];
    if (ids.length === 0) {
      res.status(400).json(createValidationError('At least one ID is required'));
      return;
    }
    if (ids.length > 100) {
      res.status(400).json(createValidationError('Too many IDs requested'));
      return;
    }
    
    // Get fields (default to all)
    let fields = requestData.fields || ['*'];
    if (typeof fields === 'string') {
      fields = fields === '*' ? ['*'] : fields.split(',').map(f => f.trim());
    }

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

    // Add usage information to each item
    const itemsWithUsage = await Promise.all(
      itemsResult.data.map(async (item) => {
        // Skip usage calculation for items without permission
        if (item._no_permission) {
          return {
            ...item,
            usage_locations: [],
            usage_summary: this.createEmptySummary()
          };
        }

        // Try to get complete cached result first
        const itemCacheKey = CacheKeys.itemDetail(collection, item.id, fields.join(','));
        
        return cache
          ? await cache.getOrSet(
              itemCacheKey,
              () => this.loadItemWithUsage(item, collection, usageFinder, pathBuilder),
              { ttl: cache.getTTLForDataType('detail') || CacheTTL.SHORT }
            )
          : await this.loadItemWithUsage(item, collection, usageFinder, pathBuilder);
      })
    );

    // Send response
    const response: DetailResponse = {
      data: itemsWithUsage
    };

    res.json(response);
  }

  /**
   * Load item with usage information
   */
  private async loadItemWithUsage(
    item: any,
    collection: string,
    usageFinder: any,
    pathBuilder: any
  ): Promise<any> {
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
      this.logger.error(`Error processing usage for item ${item.id}:`, error);
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
  private async buildUsageLocations(
    directUsages: any[],
    pathBuilder: any | null
  ): Promise<UsageLocation[]> {
    const locations: UsageLocation[] = [];
    
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
        status: usage.status,
        field: usage.field,
        field_display: usage.field_name,
        sort: usage.sort,
        path,
        edit_url: `/admin/content/${usage.collection}/${usage.item_id}`
      });
    }
    
    return locations;
  }

  /**
   * Calculate usage summary from usage locations
   */
  private calculateUsageSummary(usageLocations: UsageLocation[]): UsageSummary {
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