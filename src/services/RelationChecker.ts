import { logDebug, logError, logWarn } from '../utils/logger-wrapper';
import { createApiClient } from './api-client';
import type { IDirectusApiClient } from './api-client.types';

export interface ItemUsageLocation {
  collection: string;
  id: string | number;
  field: string;
  title?: string;
  status?: string;
}

export interface ItemUsageInfo {
  totalCount: number;
  currentPageUsage: boolean;
  locations: ItemUsageLocation[];
  canDelete: boolean;
}

interface DirectusAPI {
  post: (url: string, data?: any) => Promise<any>;
  get: (url: string, options?: any) => Promise<any>;
  delete: (url: string) => Promise<any>;
}

export class RelationChecker {
  private api: DirectusAPI;
  private apiClient: IDirectusApiClient;
  private currentPageId: string | number | null;
  private isRelationCheckingAvailable: boolean = false;

  constructor(api: DirectusAPI, currentPageId?: string | number | null) {
    this.api = api;
    this.apiClient = createApiClient(api as any);
    this.currentPageId = currentPageId || null;
    
    // Check if relation checking is available on initialization
    this.checkFeatureAvailability();
  }
  
  /**
   * Check if relation checking features are available
   */
  private async checkFeatureAvailability(): Promise<void> {
    try {
      this.isRelationCheckingAvailable = await this.apiClient.isFeatureAvailable('relationChecking');
      if (!this.isRelationCheckingAvailable) {
        logWarn('Relation checking not available - running in degraded mode');
      }
    } catch (error) {
      logError('Failed to check feature availability', error);
      this.isRelationCheckingAvailable = false;
    }
  }

  /**
   * Check where an item is being used across the system
   */
  async checkItemUsage(collection: string, itemId: string | number): Promise<ItemUsageInfo> {
    // If relation checking is not available, return safe defaults
    if (!this.isRelationCheckingAvailable) {
      logDebug('Relation checking not available, returning safe defaults', { collection, itemId });
      return {
        totalCount: 0,
        currentPageUsage: false,
        locations: [],
        canDelete: false // Be conservative - don't allow deletion without checking
      };
    }
    
    try {
      logDebug('Checking item usage', { collection, itemId, currentPageId: this.currentPageId });

      // Use native API client to get item data with relations
      const items = await this.apiClient.loadItemsWithRelations(
        collection,
        [itemId],
        ['*.*'] // Load with one level of relations to check usage
      );

      const itemData = items?.[0];
      
      if (!itemData || itemData._no_permission) {
        logWarn('No data or permission for item', { collection, itemId });
        return {
          totalCount: 0,
          currentPageUsage: false,
          locations: [],
          canDelete: true
        };
      }

      const locations: ItemUsageLocation[] = [];
      let currentPageUsage = false;

      // Process usage locations if available
      if (itemData.usage_locations && Array.isArray(itemData.usage_locations)) {
        // Use a Set to track unique locations
        const uniqueLocationKeys = new Set<string>();
        
        for (const location of itemData.usage_locations) {
          // Create unique key for this location
          const locationKey = `${location.collection}:${location.id}:${location.field || 'unknown'}`;
          
          // Skip if we've already processed this location
          if (uniqueLocationKeys.has(locationKey)) {
            continue;
          }
          uniqueLocationKeys.add(locationKey);
          
          // Check if this is the current page
          if (this.currentPageId && location.id === this.currentPageId) {
            currentPageUsage = true;
          }
          
          // Get additional info about the location
          const locationInfo: ItemUsageLocation = {
            collection: location.collection,
            id: location.id,
            field: location.field || 'unknown',
            title: location.title || `${location.collection} #${location.id}`,
            status: location.status
          };

          locations.push(locationInfo);
        }
      }

      const totalCount = itemData.usage_summary?.total_count || 0;

      return {
        totalCount,
        currentPageUsage,
        locations,
        canDelete: totalCount === 0 || (totalCount === 1 && currentPageUsage)
      };

    } catch (error) {
      logError('Failed to check item usage', error, { collection, itemId });
      
      // In case of error, return safe defaults
      return {
        totalCount: 0,
        currentPageUsage: false,
        locations: [],
        canDelete: false
      };
    }
  }

  /**
   * Check multiple items at once
   */
  async checkMultipleItemsUsage(items: Array<{ collection: string; id: string | number }>): Promise<Map<string, ItemUsageInfo>> {
    const results = new Map<string, ItemUsageInfo>();

    // If relation checking is not available, return safe defaults for all items
    if (!this.isRelationCheckingAvailable) {
      logDebug('Relation checking not available, returning safe defaults for all items');
      for (const item of items) {
        const key = `${item.collection}:${item.id}`;
        results.set(key, {
          totalCount: 0,
          currentPageUsage: false,
          locations: [],
          canDelete: false // Be conservative
        });
      }
      return results;
    }

    try {
      // Group items by collection for efficiency
      const itemsByCollection = new Map<string, (string | number)[]>();
      
      for (const item of items) {
        if (!itemsByCollection.has(item.collection)) {
          itemsByCollection.set(item.collection, []);
        }
        itemsByCollection.get(item.collection)!.push(item.id);
      }

      // Check each collection
      for (const [collection, ids] of itemsByCollection) {
        try {
          // Use native API client to get items data with relations
          const itemsData = await this.apiClient.loadItemsWithRelations(
            collection,
            ids,
            ['*.*']
          ) || [];
          
          for (const itemData of itemsData) {
            if (!itemData || itemData._no_permission) continue;

            const locations: ItemUsageLocation[] = [];
            let currentPageUsage = false;

            if (itemData.usage_locations && Array.isArray(itemData.usage_locations)) {
              for (const location of itemData.usage_locations) {
                if (this.currentPageId && location.id === this.currentPageId) {
                  currentPageUsage = true;
                }
                
                locations.push({
                  collection: location.collection,
                  id: location.id,
                  field: location.field || 'unknown',
                  title: location.title || `${location.collection} #${location.id}`,
                  status: location.status
                });
              }
            }

            const totalCount = itemData.usage_summary?.total_count || 0;
            const key = `${collection}:${itemData.id}`;

            results.set(key, {
              totalCount,
              currentPageUsage,
              locations,
              canDelete: totalCount === 0 || (totalCount === 1 && currentPageUsage)
            });
          }
        } catch (error) {
          logError(`Failed to check usage for collection ${collection}`, error);
        }
      }

    } catch (error) {
      logError('Failed to check multiple items usage', error);
    }

    return results;
  }

  /**
   * Delete item from specific locations
   */
  async deleteFromLocations(
    item: { collection: string; id: string | number },
    locationIds: (string | number)[],
    junctionCollection: string
  ): Promise<boolean> {
    try {
      logDebug('Deleting item from locations', { 
        item, 
        locationIds, 
        junctionCollection 
      });

      // Find and delete junction records for specified locations
      interface JunctionRecord {
        id: string | number;
        parent_id?: string | number;
        page_id?: string | number;
        collection: string;
        item: string | number;
      }

      const junctionRecords = await this.api.get(`/items/${junctionCollection}`, {
        params: {
          filter: {
            _and: [
              { collection: { _eq: item.collection } },
              { item: { _eq: item.id } }
            ]
          }
        }
      });

      const recordsToDelete = junctionRecords.data.data.filter((record: JunctionRecord) => {
        // Check if this junction belongs to one of the specified locations
        // This depends on your junction structure
        return (record.parent_id && locationIds.includes(record.parent_id)) || 
               (record.page_id && locationIds.includes(record.page_id));
      });

      for (const record of recordsToDelete) {
        await this.api.delete(`/items/${junctionCollection}/${record.id}`);
      }

      return true;
    } catch (error) {
      logError('Failed to delete from locations', error);
      return false;
    }
  }
}