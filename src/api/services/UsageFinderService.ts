import { Knex } from 'knex';
import {
  UsageFinderConfig,
  UsageLocation,
  UsageTree,
  FindUsageOptions,
  UsageStatistics,
  RelationInfo,
  UsageCacheEntry
} from '../types/UsageFinderTypes';
import { getLogger } from '../utils/logger-utils';

/**
 * Service for finding where items are used across collections
 */
export class UsageFinderService {
  private database: Knex;
  private services: any;
  private schema?: any;
  private accountability?: any;
  private incomingRelations: RelationInfo[];
  private cache: Map<string, UsageCacheEntry> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private logger: any;

  constructor(config: UsageFinderConfig) {
    this.database = config.database;
    this.services = config.services;
    this.schema = config.schema;
    this.accountability = config.accountability;
    this.incomingRelations = config.incomingRelations;
    this.logger = getLogger(config.services);
  }

  /**
   * Find all direct usages of an item
   * @param collection The collection of the item
   * @param itemId The ID of the item
   * @param options Search options
   * @returns Array of usage locations
   */
  async findDirectUsages(
    collection: string,
    itemId: string | number,
    options: FindUsageOptions = {}
  ): Promise<UsageLocation[]> {
    const cacheKey = `direct:${collection}:${itemId}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached as UsageLocation[];

    const {
      includeInactive = true,
      limitPerCollection,
      excludeCollections = [],
      includeItemDetails = false,
      includeFieldMetadata = true,
      groupDuplicates = true,  // New option to group duplicates
      excludeTranslations = false  // New option to exclude translation references
    } = options;

    this.logger.debug(`[UsageFinder] Finding direct usages for ${collection}/${itemId}`);

    // Use pre-loaded relations instead of querying again
    const relations = this.incomingRelations;
    const usages: UsageLocation[] = [];
    const usageMap = new Map<string, UsageLocation>();  // Track unique usages

    for (const relation of relations) {
      if (excludeCollections.includes(relation.many_collection)) continue;
      
      // Filter out translation references if requested
      if (excludeTranslations && relation.many_collection?.endsWith('_translations')) {
        continue;
      }

      try {
        // Handle M2A relations
        if (relation.one_collection === null && relation.one_allowed_collections) {
          const allowedCollections = relation.one_allowed_collections.split(',').map(c => c.trim());
          if (!allowedCollections.includes(collection)) continue;

          const junctionUsages = await this.findM2AUsages(
            relation,
            collection,
            itemId,
            includeInactive,
            limitPerCollection,
            groupDuplicates
          );

          for (const usage of junctionUsages) {
            const enrichedUsage = await this.enrichUsageLocation(
              usage,
              includeItemDetails,
              includeFieldMetadata
            );
            
            if (groupDuplicates) {
              // Create unique key for this usage
              const usageKey = `${usage.collection}:${usage.item_id}:${usage.field}`;
              
              // Only add if not already present or update with additional info
              if (!usageMap.has(usageKey)) {
                usageMap.set(usageKey, enrichedUsage);
              } else {
                // Could merge additional info here if needed
                const existing = usageMap.get(usageKey)!;
                // For M2A, we might want to track multiple junction entries
                if (!existing.usage_count) existing.usage_count = 1;
                existing.usage_count++;
              }
            } else {
              usages.push(enrichedUsage);
            }
          }
        }
        // Handle regular M2O relations
        else if (relation.many_collection && relation.many_field) {
          const directUsages = await this.findM2OUsages(
            relation,
            itemId,
            includeInactive,
            limitPerCollection
          );

          for (const usage of directUsages) {
            const enrichedUsage = await this.enrichUsageLocation(
              usage,
              includeItemDetails,
              includeFieldMetadata
            );
            
            if (groupDuplicates) {
              // Create unique key for this usage
              const usageKey = `${usage.collection}:${usage.item_id}:${usage.field}`;
              
              // Only add if not already present
              if (!usageMap.has(usageKey)) {
                usageMap.set(usageKey, enrichedUsage);
              } else {
                // For M2O, duplicates shouldn't happen but handle anyway
                const existing = usageMap.get(usageKey)!;
                if (!existing.usage_count) existing.usage_count = 1;
                existing.usage_count++;
              }
            } else {
              usages.push(enrichedUsage);
            }
          }
        }
      } catch (error) {
        this.logger.error(`[UsageFinder] Error checking relation:`, error);
      }
    }

    // If grouping duplicates, convert map to array
    const finalUsages = groupDuplicates ? Array.from(usageMap.values()) : usages;
    
    this.setCache(cacheKey, finalUsages);
    return finalUsages;
  }

  /**
   * Find all usages (direct and indirect) building a tree structure
   * @param collection The collection of the item
   * @param itemId The ID of the item
   * @param options Search options
   * @returns Usage tree with hierarchical structure
   */
  async findAllUsages(
    collection: string,
    itemId: string | number,
    options: FindUsageOptions = {}
  ): Promise<UsageTree> {
    const { maxDepth = 5 } = options;
    const visited = new Set<string>();
    
    return this.buildUsageTree(
      collection,
      itemId,
      0,
      maxDepth,
      visited,
      options
    );
  }

  /**
   * Get usage statistics for an item
   * @param collection The collection of the item
   * @param itemId The ID of the item
   * @param tree Optional pre-calculated usage tree (for performance)
   * @param options Search options
   * @returns Usage statistics
   */
  async getUsageStatistics(
    collection: string,
    itemId: string | number,
    tree?: UsageTree,
    options: FindUsageOptions = {}
  ): Promise<UsageStatistics> {
    // Use provided tree or calculate new one
    const usageTree = tree || await this.findAllUsages(collection, itemId, options);
    
    const stats: UsageStatistics = {
      direct_count: usageTree.direct_usages.length,
      indirect_count: usageTree.total_usage_count - usageTree.direct_usages.length,
      collections_using: [],
      most_common_field: undefined,
      max_depth: 0,
      has_circular_references: usageTree.has_circular_reference
    };

    // Collect unique collections and field usage
    const collectionSet = new Set<string>();
    const fieldCounts = new Map<string, number>();
    
    this.collectStatistics(usageTree, collectionSet, fieldCounts, stats);
    
    stats.collections_using = Array.from(collectionSet);
    
    // Find most common field
    let maxCount = 0;
    fieldCounts.forEach((count, field) => {
      if (count > maxCount) {
        maxCount = count;
        stats.most_common_field = field;
      }
    });

    return stats;
  }

  /**
   * Check if an item is used in a specific collection
   * @param itemCollection The collection of the item
   * @param itemId The ID of the item
   * @param targetCollection The collection to check
   * @returns true if item is used in target collection
   */
  async isUsedInCollection(
    itemCollection: string,
    itemId: string | number,
    targetCollection: string
  ): Promise<boolean> {
    const usages = await this.findDirectUsages(itemCollection, itemId, {
      excludeCollections: [],
      limitPerCollection: 1
    });

    return usages.some(usage => usage.collection === targetCollection);
  }

  /**
   * Build usage tree recursively
   */
  private async buildUsageTree(
    collection: string,
    itemId: string | number,
    currentDepth: number,
    maxDepth: number,
    visited: Set<string>,
    options: FindUsageOptions
  ): Promise<UsageTree> {
    const nodeKey = `${collection}:${itemId}`;
    
    // Check for circular reference
    if (visited.has(nodeKey)) {
      return {
        item: {
          collection,
          id: itemId,
          display_name: await this.getItemDisplayName(collection, itemId)
        },
        direct_usages: [],
        children: [],
        total_usage_count: 0,
        has_circular_reference: true,
        circular_path: Array.from(visited)
      };
    }

    visited.add(nodeKey);

    // Get direct usages
    const directUsages = await this.findDirectUsages(collection, itemId, options);
    
    // Add depth to usages
    const usagesWithDepth = directUsages.map(usage => ({
      ...usage,
      depth: currentDepth
    }));

    const tree: UsageTree = {
      item: {
        collection,
        id: itemId,
        display_name: await this.getItemDisplayName(collection, itemId)
      },
      direct_usages: usagesWithDepth,
      children: [],
      // FIXED: Only count direct usages, not recursive
      total_usage_count: directUsages.length,
      has_circular_reference: false
    };

    // Recursively find indirect usages if not at max depth
    if (currentDepth < maxDepth) {
      for (const usage of directUsages) {
        const childTree = await this.buildUsageTree(
          usage.collection,
          usage.item_id,
          currentDepth + 1,
          maxDepth,
          new Set(visited), // Create new set for each branch
          options
        );

        tree.children.push(childTree);
        // REMOVED: Don't add child counts to total_usage_count
        // tree.total_usage_count += childTree.total_usage_count;
        
        if (childTree.has_circular_reference) {
          tree.has_circular_reference = true;
        }
      }
    }

    visited.delete(nodeKey);
    return tree;
  }

  /**
   * Find M2A usages through junction table
   */
  private async findM2AUsages(
    relation: RelationInfo,
    collection: string,
    itemId: string | number,
    includeInactive: boolean,
    limit?: number,
    groupDuplicates: boolean = true
  ): Promise<UsageLocation[]> {
    const junctionTable = relation.many_collection;
    const itemField = relation.many_field;
    const collectionField = relation.one_collection_field || 'collection';
    const junctionField = relation.junction_field!;

    // Query junction table
    let query = this.database(junctionTable)
      .where(itemField, String(itemId))
      .where(collectionField, collection);

    if (limit) {
      query = query.limit(limit);
    }

    const junctionEntries = await query;
    const usages: UsageLocation[] = [];

    // Get unique parent IDs
    const parentIds = [...new Set(junctionEntries.map(e => e[junctionField]))];
    if (parentIds.length === 0) return usages;

    // Determine parent collection from junction table name
    const parentCollection = this.extractParentCollection(junctionTable, junctionField);
    
    // Load parent items
    const parentItems = await this.loadItemsByIds(parentCollection, parentIds);
    const parentMap = new Map(parentItems.map(item => [String(item.id), item]));

    // Group junction entries by parent ID to count duplicates
    const parentGroups = new Map<string, any[]>();
    for (const entry of junctionEntries) {
      const parentId = String(entry[junctionField]);
      if (!parentGroups.has(parentId)) {
        parentGroups.set(parentId, []);
      }
      parentGroups.get(parentId)!.push(entry);
    }

    // Build usage locations
    for (const [parentId, entries] of parentGroups) {
      const parent = parentMap.get(parentId);
      
      if (!parent) continue;
      if (!includeInactive && parent.status === 'archived') continue;

      // Get field name from relation or junction table
      const fieldName = this.extractFieldName(junctionTable, parentCollection);
      
      if (groupDuplicates) {
        // Group duplicates: one entry per parent with usage count
        const firstEntry = entries[0];
        usages.push({
          collection: parentCollection,
          collection_name: parentCollection,
          item_id: parentId,
          item_name: this.findDisplayNameFromObject(parent, parentCollection),
          field: fieldName,
          field_name: fieldName,
          relation_type: 'M2A',
          junction_table: junctionTable,
          sort: firstEntry.sort || null,
          status: parent.status || null,
          depth: 0,
          usage_count: entries.length  // Track how many times used
        });
      } else {
        // Don't group duplicates: one entry per junction entry
        for (const entry of entries) {
          usages.push({
            collection: parentCollection,
            collection_name: parentCollection,
            item_id: parentId,
            item_name: this.findDisplayNameFromObject(parent, parentCollection),
            field: fieldName,
            field_name: fieldName,
            relation_type: 'M2A',
            junction_table: junctionTable,
            sort: entry.sort || null,
            status: parent.status || null,
            depth: 0,
            // Don't include usage_count when not grouping
          });
        }
      }
    }

    return usages;
  }

  /**
   * Find M2O usages (direct foreign key references)
   */
  private async findM2OUsages(
    relation: RelationInfo,
    itemId: string | number,
    includeInactive: boolean,
    limit?: number
  ): Promise<UsageLocation[]> {
    const referencingCollection = relation.many_collection;
    const referencingField = relation.many_field;

    // Query referencing collection
    let query = this.database(referencingCollection)
      .where(referencingField, String(itemId));

    if (!includeInactive) {
      query = query.whereNot('status', 'archived');
    }

    if (limit) {
      query = query.limit(limit);
    }

    const items = await query;
    const usages: UsageLocation[] = [];

    for (const item of items) {
      usages.push({
        collection: referencingCollection,
        collection_name: referencingCollection,
        item_id: item.id,
        item_name: this.findDisplayNameFromObject(item, referencingCollection),
        field: referencingField,
        field_name: referencingField,
        relation_type: 'M2O',
        status: item.status || null,
        depth: 0
      });
    }

    return usages;
  }


  /**
   * Load items by IDs
   */
  private async loadItemsByIds(
    collection: string,
    ids: (string | number)[]
  ): Promise<any[]> {
    if (ids.length === 0) return [];

    try {
      const items = await this.database(collection)
        .whereIn('id', ids.map(id => String(id)));
      return items;
    } catch (error) {
      this.logger.error(`[UsageFinder] Error loading items from ${collection}:`, error);
      return [];
    }
  }

  /**
   * Get display name for an item
   */
  private async getItemDisplayName(
    collection: string,
    itemId: string | number
  ): Promise<string> {
    try {
      const item = await this.database(collection)
        .where('id', String(itemId))
        .first();
      
      if (!item) return `${collection} #${itemId}`;
      
      return this.findDisplayNameFromObject(item, collection);
    } catch (error) {
      return `${collection} #${itemId}`;
    }
  }

  /**
   * Find display name from an object
   */
  private findDisplayNameFromObject(obj: any, collectionName: string): string {
    if (!obj || !obj.id) {
      return `${collectionName} #unknown`;
    }

    // Common field names for display
    const displayFields = [
      'name', 'title', 'headline', 'label', 'display_name',
      'slug', 'description', 'text', 'content', 'page_title',
      'menu_title', 'heading', 'caption', 'subject'
    ];

    // Find first non-empty field
    for (const field of displayFields) {
      if (obj[field] && obj[field].toString().trim()) {
        return obj[field];
      }
    }

    // If no display field found, use first string field
    for (const [key, value] of Object.entries(obj)) {
      if (value && typeof value === 'string' &&
          !['id', 'status', 'sort', 'user_created', 'user_updated',
            'date_created', 'date_updated'].includes(key) &&
          value.trim().length > 0 && value.trim().length < 100) {
        return value;
      }
    }

    // Fallback to ID
    return `${collectionName} #${obj.id}`;
  }

  /**
   * Extract parent collection from junction table name
   */
  private extractParentCollection(junctionTable: string, junctionField: string): string {
    // Remove _id suffix from junction field
    let collection = junctionField.replace('_id', '');
    
    // Common patterns
    if (junctionTable.includes('_m2a')) {
      collection = junctionTable.replace('_m2a', '');
    } else if (junctionTable.endsWith('_blocks')) {
      collection = junctionTable.replace('_blocks', '');
    } else if (junctionTable.includes('_')) {
      const parts = junctionTable.split('_');
      collection = parts[0];
    }

    return collection;
  }

  /**
   * Extract field name from junction table
   */
  private extractFieldName(junctionTable: string, parentCollection: string): string {
    if (junctionTable.startsWith(parentCollection + '_')) {
      return junctionTable.substring(parentCollection.length + 1);
    }
    
    if (junctionTable.endsWith('_m2a')) {
      return junctionTable.replace('_m2a', '');
    }
    
    const parts = junctionTable.split('_');
    return parts[parts.length - 1];
  }

  /**
   * Enrich usage location with additional metadata
   */
  private async enrichUsageLocation(
    usage: UsageLocation,
    includeItemDetails: boolean,
    includeFieldMetadata: boolean
  ): Promise<UsageLocation> {
    // Get collection metadata
    try {
      const collectionInfo = await this.database
        .select('*')
        .from('directus_collections')
        .where('collection', usage.collection)
        .first();

      if (collectionInfo) {
        const metaData = collectionInfo.options || collectionInfo.meta || collectionInfo.collection_meta;
        if (metaData) {
          const parsed = typeof metaData === 'string' ? JSON.parse(metaData) : metaData;
          usage.collection_name = parsed.display || parsed.name || usage.collection;
          usage.collection_icon = parsed.icon || 'box';
        }
      }
    } catch (error) {
      // Keep defaults
    }

    // Get field metadata if requested
    if (includeFieldMetadata && this.services) {
      try {
        const { FieldsService } = this.services;
        const fieldsService = new FieldsService({
          knex: this.database,
          schema: this.schema,
          accountability: this.accountability
        });

        const fields = await fieldsService.readAll(usage.collection);
        const field = fields.find((f: any) => f.field === usage.field);
        
        if (field && field.meta) {
          usage.field_name = field.meta.display || field.meta.name || usage.field;
        }
      } catch (error) {
        // Keep defaults
      }
    }

    return usage;
  }

  /**
   * Collect statistics from usage tree
   */
  private collectStatistics(
    tree: UsageTree,
    collectionSet: Set<string>,
    fieldCounts: Map<string, number>,
    stats: UsageStatistics,
    currentDepth: number = 0
  ): void {
    // Update max depth
    if (currentDepth > stats.max_depth) {
      stats.max_depth = currentDepth;
    }

    // Process direct usages
    for (const usage of tree.direct_usages) {
      collectionSet.add(usage.collection);
      
      const fieldKey = `${usage.collection}.${usage.field}`;
      fieldCounts.set(fieldKey, (fieldCounts.get(fieldKey) || 0) + 1);
    }

    // Process children
    for (const child of tree.children) {
      this.collectStatistics(child, collectionSet, fieldCounts, stats, currentDepth + 1);
    }
  }

  /**
   * Cache management
   */
  private getFromCache(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.result;
  }

  private setCache(key: string, result: any): void {
    this.cache.set(key, {
      key,
      result,
      timestamp: Date.now(),
      ttl: this.CACHE_TTL
    });
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}