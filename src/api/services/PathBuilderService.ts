import type { Knex } from 'knex';
import {
  PathBuilderConfig,
  PathStep,
  UsagePath,
  PathBuildOptions,
  PathFormatOptions,
  PathCollection,
  PathTemplateContext
} from '../types/PathBuilderTypes';
import { UsageLocation } from '../types/UsageFinderTypes';
import { UsageFinderService } from './UsageFinderService';
import { CacheService, CacheKeys, CacheTTL } from '../types/CacheTypes';
import { buildCacheKey, collectionCacheKey, fieldCacheKey } from '../utils/cache-utils';
import { TITLE_FIELDS } from '../utils/constants';
import { createServiceLogger } from '../utils/logger-utils';
import { getErrorMessage } from '../utils/error-utils';
import { formatCollectionName, formatFieldName } from '../utils/string-utils';
import type { Logger } from '../types/directus-api';

/**
 * Service for building hierarchical paths from usage information
 */
export class PathBuilderService {
  private readonly database: Knex;
  private readonly usageFinder: UsageFinderService;
  private readonly cache: CacheService;
  private readonly logger: Logger;

  constructor(config: PathBuilderConfig) {
    this.database = config.database;
    
    // Use provided UsageFinderService instance instead of creating new one
    this.usageFinder = config.usageFinder;
    this.cache = config.cache;
    this.logger = createServiceLogger('PathBuilder', config.services);
  }

  /**
   * Build a path from usage location
   * @param usage The usage location
   * @param options Build options
   * @returns Complete usage path
   */
  async buildPath(
    usage: UsageLocation,
    options: PathBuildOptions = {}
  ): Promise<UsagePath> {
    // Create cache key from usage location and options
    const cacheKey = buildCacheKey('path', usage.collection, usage.item_id, usage.field || 'none', JSON.stringify(options));
    
    return this.cache.getOrSet(
      cacheKey,
      async () => {
        const {
          includeAdminUrls = false,
          adminBaseUrl = '/admin'
        } = options;

        // Build path from bottom to top
        const steps: PathStep[] = [];
    
    // Add the starting point (the item being used)
    const fromStep: PathStep = {
      collection: usage.collection,
      collection_name: usage.collection_name,
      id: usage.item_id,
      name: usage.item_name,
      field: null,
      icon: usage.collection_icon,
      status: usage.status
    };

    if (includeAdminUrls) {
      fromStep.admin_url = `${adminBaseUrl}/content/${usage.collection}/${usage.item_id}`;
    }

        // Build path upwards
        const pathSteps = await this.buildPathUpwards(usage, options);
        steps.push(...pathSteps);

        // The "to" is the last step (root)
        const toStep = steps[steps.length - 1] || fromStep;

        const path: UsagePath = {
          from: fromStep,
          to: toStep,
          steps,
          formatted: this.formatPath(steps, options),
          short_formatted: this.formatPath(steps, { ...options, style: 'short' }),
          depth: steps.length,
          is_direct: steps.length === 1
        };

        return path;
      },
      { ttl: CacheTTL.SHORT }
    );
  }


  /**
   * Build all paths for an item
   * @param collection The collection of the item
   * @param itemId The ID of the item
   * @param options Build options
   * @returns Collection of all paths
   */
  async buildAllPaths(
    collection: string,
    itemId: string | number,
    options: PathBuildOptions = {}
  ): Promise<PathCollection> {
    // Create cache key for all paths
    const cacheKey = CacheKeys.itemPaths(collection, itemId);
    
    return this.cache.getOrSet(
      cacheKey,
      async () => {
        // Get all usages
        const usageTree = await this.usageFinder.findAllUsages(collection, itemId, {
          maxDepth: 5
        });

    const paths: UsagePath[] = [];
    const byCollection: Record<string, UsagePath[]> = {};
    const shortestPaths: Record<string, UsagePath> = {};

    // Process all direct usages
    for (const usage of usageTree.direct_usages) {
      const path = await this.buildPath(usage, options);
      paths.push(path);

      // Group by collection
      const targetCollection = path.to.collection;
      if (!byCollection[targetCollection]) {
        byCollection[targetCollection] = [];
      }
      byCollection[targetCollection].push(path);

      // Track shortest path
      if (!shortestPaths[targetCollection] || path.depth < shortestPaths[targetCollection].depth) {
        shortestPaths[targetCollection] = path;
      }
    }

        // Calculate statistics
        const uniqueCollections = new Set(paths.map(p => p.to.collection));
        const depths = paths.map(p => p.depth);
        const avgDepth = depths.length > 0 
          ? depths.reduce((a, b) => a + b, 0) / depths.length 
          : 0;

        return {
          item: usageTree.item,
          paths,
          by_collection: byCollection,
          shortest_paths: shortestPaths,
          stats: {
            total_paths: paths.length,
            unique_collections: uniqueCollections.size,
            max_depth: Math.max(...depths, 0),
            average_depth: avgDepth
          }
        };
      },
      { ttl: CacheTTL.SHORT }
    );
  }

  /**
   * Format a path as string
   * @param path The path or steps to format
   * @param options Format options
   * @returns Formatted path string
   */
  formatPath(
    path: UsagePath | PathStep[],
    options: PathFormatOptions = {}
  ): string {
    const {
      style = 'full',
      html = false,
      templates = {}
    } = options;

    const steps = Array.isArray(path) ? path : path.steps;
    if (steps.length === 0) return '';

    const separator = templates.separator || ' → ';
    const parts: string[] = [];

    steps.forEach((step, index) => {
      const context: PathTemplateContext = {
        step,
        index,
        total: steps.length,
        is_first: index === 0,
        is_last: index === steps.length - 1,
        previous: steps[index - 1],
        next: steps[index + 1]
      };

      const formatted = this.formatStep(step, style, context, options);
      parts.push(formatted);
    });

    const result = parts.join(separator);
    
    if (html) {
      return `<span class="usage-path">${result}</span>`;
    }

    return result;
  }


  /**
   * Build path upwards from usage location
   */
  private async buildPathUpwards(
    usage: UsageLocation,
    options: PathBuildOptions
  ): Promise<PathStep[]> {
    const steps: PathStep[] = [];
    const visited = new Set<string>();
    const { includeAdminUrls = false, adminBaseUrl = '/admin' } = options;

    let currentUsage: UsageLocation | null = usage;
    let depth = 0;
    const maxDepth = 10; // Prevent infinite loops

    while (currentUsage && depth < maxDepth) {
      const key = `${currentUsage.collection}:${currentUsage.item_id}`;
      
      // Check for circular reference
      if (visited.has(key)) {
        this.logger.warn(`Circular reference detected at ${key}`);
        break;
      }
      visited.add(key);

      // Create step
      const step: PathStep = {
        collection: currentUsage.collection,
        collection_name: currentUsage.collection_name,
        id: currentUsage.item_id,
        name: currentUsage.item_name,
        field: currentUsage.field,
        field_name: currentUsage.field_name,
        relation_type: currentUsage.relation_type,
        icon: currentUsage.collection_icon,
        status: currentUsage.status
      };

      if (includeAdminUrls) {
        step.admin_url = `${adminBaseUrl}/content/${currentUsage.collection}/${currentUsage.item_id}`;
      }

      steps.push(step);

      // Find parent usage
      const parentUsages = await this.usageFinder.findDirectUsages(
        currentUsage.collection,
        currentUsage.item_id,
        { limitPerCollection: 1 }
      );

      currentUsage = parentUsages[0] || null;
      depth++;
    }

    return steps;
  }

  /**
   * Format a single step
   */
  private formatStep(
    step: PathStep,
    style: string,
    context: PathTemplateContext,
    options: PathFormatOptions
  ): string {
    const { templates = {} } = options;
    
    let formatted;

    switch (style) {
      case 'short':
        // Only collection and name
        formatted = step.name;
        break;

      case 'breadcrumb':
        // Name with optional collection
        formatted = step.name;
        if (context.is_first && step.collection_name) {
          formatted = `${step.collection_name}: ${formatted}`;
        }
        break;

      case 'full':
      default:
        // Full format with collection, name, and field
        const parts = [];
        
        if (step.collection_name) {
          parts.push(step.collection_name);
        }
        
        parts.push(step.name);
        
        if (step.field_name && !context.is_last) {
          parts.push(`(${step.field_name})`);
        }

        formatted = parts.join(' ');
        break;
    }

    // Apply custom template if provided
    if (templates.step) {
      formatted = this.applyTemplate(templates.step, {
        ...step,
        formatted
      });
    }

    return formatted;
  }

  /**
   * Apply a template string
   */
  private applyTemplate(template: string, data: any): string {
    return template.replace(/{(\w+)}/g, (match, key) => {
      return data[key] || match;
    });
  }

  /**
   * Build a simple path array with complete relation information
   * This is the new simplified method for the API response
   * @param usage The usage location to build path for
   * @returns Array of path elements with full relation details
   */
  async buildSimplePathWithRelations(usage: UsageLocation): Promise<any[]> {
    const path: any[] = [];
    let current = usage;
    
    try {
      while (current) {
        // Get collection display name
        const collectionDisplay = await this.getCollectionDisplay(current.collection);
        
        // Get field display name
        const fieldDisplay = current.field ? 
          await this.getFieldDisplay(current.collection, current.field) : 
          null;
        
        const pathElement = {
          id: current.item_id,
          collection: current.collection,
          collection_display: collectionDisplay,
          title: current.item_name || await this.getItemDisplayName(current.collection, current.item_id),
          status: current.status,
          linked_via_field: current.field,
          linked_via_field_display: fieldDisplay
        };
        
        // Add to beginning of array for correct order
        path.unshift(pathElement);
        
        // Try to load parent
        try {
          const parent = await this.loadParent(current);
          if (!parent) break;
          current = parent;
        } catch (error) {
          // Parent could not be loaded - end hierarchy here (graceful degradation)
          const errorMessage = getErrorMessage(error);
          this.logger.debug(`Parent loading failed for ${current.collection}/${current.item_id}:`, errorMessage);
          break;
        }
      }
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      this.logger.error('Error building path with relations:', errorMessage);
    }
    
    return path;
  }

  /**
   * Load parent item for a usage location
   * @param usage Current usage location
   * @returns Parent usage location or null
   */
  private async loadParent(usage: UsageLocation): Promise<UsageLocation | null> {
    try {
      // The usage location contains the item that uses our content
      // We need to check if this item has a parent
      const item = await this.database(usage.collection)
        .where('id', String(usage.item_id))
        .first();
      
      if (!item) return null;
      
      // Look for parent relationship fields in this collection
      const parentRelations = await this.database
        .select('*')
        .from('directus_relations')
        .where('many_collection', usage.collection)
        .andWhere(function() {
          this.where('many_field', 'parent')
            .orWhere('many_field', 'parent_id')
            .orWhere('many_field', 'parent_page')
            .orWhere('many_field', 'parent_item')
            .orWhere('many_field', 'parent_collection');
        })
        .first();
      
      if (!parentRelations || !item[parentRelations.many_field]) {
        return null;
      }
      
      // Load the parent item
      const parentId = item[parentRelations.many_field];
      const parentCollection = parentRelations.one_collection;
      
      if (!parentCollection || !parentId) return null;
      
      const parentItem = await this.database(parentCollection)
        .where('id', String(parentId))
        .first();
      
      if (!parentItem) return null;
      
      // Create usage location for parent
      return {
        collection: parentCollection,
        collection_name: await this.getCollectionDisplay(parentCollection),
        item_id: parentItem.id,
        item_name: await this.getItemDisplayName(parentCollection, parentItem.id),
        field: parentRelations.many_field,
        field_name: await this.getFieldDisplay(usage.collection, parentRelations.many_field),
        relation_type: 'M2O',
        status: parentItem.status,
        depth: 0
      };
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      this.logger.error('Error loading parent:', errorMessage);
    }
    
    return null;
  }

  /**
   * Get collection display name
   */
  private async getCollectionDisplay(collection: string): Promise<string> {
    const cacheKey = collectionCacheKey('display', collection);
    
    return this.cache.getOrSet(
      cacheKey,
      async () => {
        try {
          const collectionMeta = await this.database('directus_collections')
            .where('collection', collection)
            .first();
          
          if (collectionMeta?.collection_display) {
            return collectionMeta.collection_display;
          }
          
          // Fallback to formatted collection name
          return formatCollectionName(collection);
        } catch (error) {
          const errorMessage = getErrorMessage(error);
          this.logger.debug(`Failed to get collection display for '${collection}':`, errorMessage);
          return collection;
        }
      },
      { ttl: CacheTTL.LONG }
    );
  }

  /**
   * Get field display name
   */
  private async getFieldDisplay(collection: string, field: string): Promise<string> {
    const cacheKey = fieldCacheKey('display', collection, field);
    
    return this.cache.getOrSet(
      cacheKey,
      async () => {
        try {
          const fieldMeta = await this.database('directus_fields')
            .where('collection', collection)
            .andWhere('field', field)
            .first();
          
          if (fieldMeta?.field_display) {
            return fieldMeta.field_display;
          }
          
          // Fallback to formatted field name
          return formatFieldName(field);
        } catch (error) {
          const errorMessage = getErrorMessage(error);
          this.logger.debug(`Failed to get field display for '${collection}.${field}':`, errorMessage);
          return field;
        }
      },
      { ttl: CacheTTL.LONG }
    );
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
      
      // Common field names for display - use TITLE_FIELDS first, then additional fields
      const displayFields = [
        ...TITLE_FIELDS,
        'display_name', 'slug', 'description', 'text', 'content'
      ];

      for (const field of displayFields) {
        if (item[field] && item[field].toString().trim()) {
          return item[field];
        }
      }

      return `${collection} #${itemId}`;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      this.logger.debug(`Failed to get item display name for ${collection}#${itemId}:`, errorMessage);
      return `${collection} #${itemId}`;
    }
  }
}