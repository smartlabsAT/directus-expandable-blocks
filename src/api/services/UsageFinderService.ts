import { Knex } from 'knex';
import type { UsageFinderConfig, UsageLocation, UsageTree, FindUsageOptions, UsageStatistics, RelationInfo, UsageCacheEntry } from '../types/UsageFinderTypes';
import { createServiceLogger } from '../utils/logger-utils';
import { buildCacheKey, itemCacheKey } from '../utils/cache-utils';
import { TITLE_FIELDS, METADATA_FIELDS, parseAllowedCollections } from '../utils/constants';
import { getErrorMessage } from '../utils/error-utils';
import type { Logger, DirectusServices, DirectusSchema, DirectusAccountability } from '../types/directus-api';

/**
 * Service for finding where items are used across collections
 */
export class UsageFinderService {
  // Constants
  private static readonly CACHE_TTL_MINUTES = 5;
  private static readonly CACHE_TTL = UsageFinderService.CACHE_TTL_MINUTES * 60 * 1000;
  private static readonly DEFAULT_MAX_DEPTH = 5;
  private static readonly MAX_DISPLAY_NAME_LENGTH = 100;
  private static readonly ADDITIONAL_DISPLAY_FIELDS = [
    'display_name', 'slug', 'description', 'text', 'content',
    'page_title', 'menu_title', 'caption', 'subject'
  ];
  
  // Instance properties
  private readonly database: Knex;
  private readonly services: DirectusServices;
  private readonly schema?: DirectusSchema;
  private readonly accountability?: DirectusAccountability;
  private readonly incomingRelations: RelationInfo[];
  private readonly cache: Map<string, UsageCacheEntry> = new Map();
  private readonly logger: Logger;

  constructor(config: UsageFinderConfig) {
    this.database = config.database;
    this.services = config.services;
    this.schema = config.schema;
    this.accountability = config.accountability;
    this.incomingRelations = config.incomingRelations;
    this.logger = createServiceLogger('UsageFinder', config.services);
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
    const cacheKey = itemCacheKey('direct-usages', collection, itemId);
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached as UsageLocation[];

    const {
      excludeCollections = [],
      groupDuplicates = true,
      excludeTranslations = false
    } = options;

    this.logger.debug(`Finding direct usages for ${collection}/${itemId}`);

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
          await this.processM2ARelations(relation, collection, itemId, options, usageMap, usages);
        }
        // Handle regular M2O relations
        else if (relation.many_collection && relation.many_field) {
          await this.processM2ORelations(relation, itemId, options, usageMap, usages);
        }
      } catch (error) {
        this.logger.error(`Error checking relation:`, error);
      }
    }

    // If grouping duplicates, convert map to array
    const finalUsages = groupDuplicates ? Array.from(usageMap.values()) : usages;
    
    this.setCache(cacheKey, finalUsages);
    return finalUsages;
  }

  /**
   * Batch find direct usages for multiple items
   * @param collection The collection of the items
   * @param itemIds Array of item IDs
   * @param options Search options
   * @returns Array of usages for all items
   */
  async findBatchUsages(
    collection: string,
    itemIds: (string | number)[],
    options: FindUsageOptions = {}
  ): Promise<UsageLocation[]> {
    if (itemIds.length === 0) {
      return [];
    }
    
    // Build batch cache key
    const cacheKey = `batch:${collection}:${itemIds.sort().join(',')}:${JSON.stringify(options)}`;
    const cached = this.getFromCache(cacheKey);
    
    if (cached) {
      return cached;
    }
    
    const {
      excludeTranslations = false
    } = options;
    
    // Use pre-loaded incoming relations
    const relationsToCollection = this.incomingRelations;
    
    if (relationsToCollection.length === 0) {
      this.setCache(cacheKey, []);
      return [];
    }
    
    const usages: UsageLocation[] = [];
    
    // Process each relation in batch
    for (const relation of relationsToCollection) {
      try {
        // Handle M2A relations
        if (!relation.one_collection) {
          const allowedCollections = parseAllowedCollections(relation.one_allowed_collections!);
          if (!allowedCollections.includes(collection)) continue;
          
          // Find usages in junction table for all items
          const junctionUsages = await this.database(relation.many_collection)
            .where(relation.one_collection_field!, collection)
            .whereIn(relation.junction_field!, itemIds.map(id => String(id)))
            .select('*');
            
          for (const junctionItem of junctionUsages) {
            const usage: UsageLocation = {
              collection: relation.many_collection,
              collection_name: relation.many_collection,
              item_id: junctionItem[relation.many_field!],
              item_name: `Item ${junctionItem[relation.many_field!]}`,
              field: relation.many_field!,
              field_name: relation.many_field!,
              status: junctionItem.status || null,
              sort: junctionItem.sort || 0,
              depth: 0,
              relation_type: 'M2A' as const
            };
            usages.push(usage);
          }
        } else {
          // Handle M2O relations
          const items = await this.database(relation.many_collection)
            .whereIn(relation.many_field, itemIds.map(id => String(id)))
            .select('*');
            
          for (const item of items) {
            const usage: UsageLocation = {
              collection: relation.many_collection,
              collection_name: relation.many_collection,
              item_id: item.id,
              item_name: item.title || item.name || `Item ${item.id}`,
              field: relation.many_field,
              field_name: relation.many_field,
              status: item.status || null,
              sort: item.sort || 0,
              depth: 0,
              relation_type: 'M2O' as const
            };
            usages.push(usage);
          }
        }
      } catch (error) {
        this.logger.error(`Error finding batch usages in relation:`, {
          relation: relation.many_collection,
          field: relation.many_field,
          error: getErrorMessage(error)
        });
      }
    }
    
    // Filter translations if needed
    let filteredUsages = usages;
    if (excludeTranslations) {
      filteredUsages = usages.filter(usage => !usage.collection.endsWith('_translations'));
    }
    
    this.setCache(cacheKey, filteredUsages);
    return filteredUsages;
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
    const { maxDepth = UsageFinderService.DEFAULT_MAX_DEPTH } = options;
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
   * Create a unique key for a usage location
   */
  private createUsageKey(usage: UsageLocation): string {
    return `${usage.collection}:${usage.item_id}:${usage.field}`;
  }

  /**
   * Handle duplicate usage tracking
   */
  private handleDuplicateUsage(
    usage: UsageLocation,
    enrichedUsage: UsageLocation,
    usageMap: Map<string, UsageLocation>,
    usages: UsageLocation[],
    groupDuplicates: boolean
  ): void {
    if (groupDuplicates) {
      const usageKey = this.createUsageKey(usage);
      
      if (!usageMap.has(usageKey)) {
        usageMap.set(usageKey, enrichedUsage);
      } else {
        const existing = usageMap.get(usageKey)!;
        if (!existing.usage_count) existing.usage_count = 1;
        existing.usage_count++;
      }
    } else {
      usages.push(enrichedUsage);
    }
  }

  /**
   * Process M2A relations for finding usages
   */
  private async processM2ARelations(
    relation: RelationInfo,
    collection: string,
    itemId: string | number,
    options: FindUsageOptions,
    usageMap: Map<string, UsageLocation>,
    usages: UsageLocation[]
  ): Promise<void> {
    const allowedCollections = parseAllowedCollections(relation.one_allowed_collections!);
    if (!allowedCollections.includes(collection)) return;

    const junctionUsages = await this.findM2AUsages(
      relation,
      collection,
      itemId,
      options.includeInactive ?? true,
      options.limitPerCollection,
      options.groupDuplicates ?? true
    );

    for (const usage of junctionUsages) {
      const enrichedUsage = await this.enrichUsageLocation(
        usage,
        options.includeFieldMetadata ?? true
      );
      
      this.handleDuplicateUsage(usage, enrichedUsage, usageMap, usages, options.groupDuplicates ?? true);
    }
  }

  /**
   * Process M2O relations for finding usages
   */
  private async processM2ORelations(
    relation: RelationInfo,
    itemId: string | number,
    options: FindUsageOptions,
    usageMap: Map<string, UsageLocation>,
    usages: UsageLocation[]
  ): Promise<void> {
    const directUsages = await this.findM2OUsages(
      relation,
      itemId,
      options.includeInactive ?? true,
      options.limitPerCollection
    );

    for (const usage of directUsages) {
      const enrichedUsage = await this.enrichUsageLocation(
        usage,
        options.includeFieldMetadata ?? true
      );
      
      this.handleDuplicateUsage(usage, enrichedUsage, usageMap, usages, options.groupDuplicates ?? true);
    }
  }

  /**
   * Load junction entries for M2A relations
   */
  private async loadJunctionEntries(
    junctionTable: string,
    itemField: string,
    collectionField: string,
    itemId: string | number,
    collection: string,
    limit?: number
  ): Promise<any[]> {
    let query = this.database(junctionTable)
      .where(itemField, String(itemId))
      .where(collectionField, collection);

    if (limit) {
      query = query.limit(limit);
    }

    return query;
  }

  /**
   * Group junction entries by parent ID
   */
  private groupJunctionEntriesByParent(
    junctionEntries: any[],
    junctionField: string
  ): Map<string, any[]> {
    const parentGroups = new Map<string, any[]>();
    
    for (const entry of junctionEntries) {
      const parentId = String(entry[junctionField]);
      if (!parentGroups.has(parentId)) {
        parentGroups.set(parentId, []);
      }
      parentGroups.get(parentId)!.push(entry);
    }
    
    return parentGroups;
  }

  /**
   * Build usage location from parent data
   */
  private buildUsageLocation(
    parentId: string,
    parent: any,
    parentCollection: string,
    fieldName: string,
    junctionTable: string,
    entries: any[],
    groupDuplicates: boolean
  ): UsageLocation | UsageLocation[] {
    const baseUsage = {
      collection: parentCollection,
      collection_name: parentCollection,
      item_id: parentId,
      item_name: this.findDisplayNameFromObject(parent, parentCollection),
      field: fieldName,
      field_name: fieldName,
      relation_type: 'M2A' as const,
      junction_table: junctionTable,
      status: parent.status || null,
      depth: 0
    };

    if (groupDuplicates) {
      return {
        ...baseUsage,
        sort: entries[0].sort || null,
        usage_count: entries.length
      };
    } else {
      return entries.map(entry => ({
        ...baseUsage,
        sort: entry.sort || null
      }));
    }
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
    const nodeKey = buildCacheKey('node', collection, itemId);
    
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

    // Load junction entries
    const junctionEntries = await this.loadJunctionEntries(
      junctionTable,
      itemField,
      collectionField,
      itemId,
      collection,
      limit
    );

    if (junctionEntries.length === 0) return [];

    // Get unique parent IDs
    const parentIds = [...new Set(junctionEntries.map(e => e[junctionField]))];
    
    // Determine parent collection from junction table name
    const parentCollection = this.extractParentCollection(junctionTable, junctionField);
    
    // Load parent items
    const parentItems = await this.loadItemsByIds(parentCollection, parentIds);
    const parentMap = new Map(parentItems.map(item => [String(item.id), item]));

    // Group junction entries by parent ID
    const parentGroups = this.groupJunctionEntriesByParent(junctionEntries, junctionField);

    // Build usage locations
    const usages: UsageLocation[] = [];
    
    for (const [parentId, entries] of parentGroups) {
      const parent = parentMap.get(parentId);
      
      if (!parent) continue;
      if (!includeInactive && parent.status === 'archived') continue;

      // Get field name from relation or junction table
      const fieldName = this.extractFieldName(junctionTable, parentCollection);
      
      const locationOrLocations = this.buildUsageLocation(
        parentId,
        parent,
        parentCollection,
        fieldName,
        junctionTable,
        entries,
        groupDuplicates
      );
      
      if (Array.isArray(locationOrLocations)) {
        usages.push(...locationOrLocations);
      } else {
        usages.push(locationOrLocations);
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
      return await this.database(collection)
        .whereIn('id', ids.map(id => String(id)));
    } catch (error) {
      this.logger.error(`Error loading items from ${collection}:`, error);
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
    } catch {
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

    // Common field names for display - use TITLE_FIELDS first, then additional fields
    const displayFields = [
      ...TITLE_FIELDS,
      ...UsageFinderService.ADDITIONAL_DISPLAY_FIELDS
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
          ![...METADATA_FIELDS, 'status', 'sort'].includes(key) &&
          value.trim().length > 0 && value.trim().length < UsageFinderService.MAX_DISPLAY_NAME_LENGTH) {
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
    } catch {
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
      } catch {
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
      ttl: UsageFinderService.CACHE_TTL
    });
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}