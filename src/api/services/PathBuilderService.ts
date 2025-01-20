import { Knex } from 'knex';
import {
  PathBuilderConfig,
  PathStep,
  UsagePath,
  Breadcrumb,
  PathBuildOptions,
  PathFormatOptions,
  PathCollection,
  PathVisualization,
  PathTemplateContext
} from '../types/PathBuilderTypes';
import { UsageLocation, UsageTree } from '../types/UsageFinderTypes';
import { UsageFinderService } from './UsageFinderService';
import { CacheService, CacheKeys, CacheTTL } from '../types/CacheTypes';

/**
 * Service for building hierarchical paths from usage information
 */
export class PathBuilderService {
  private database: Knex;
  private services: any;
  private schema?: any;
  private accountability?: any;
  private defaultLocale: string;
  private usageFinder: UsageFinderService;
  private cache: CacheService;

  constructor(config: PathBuilderConfig) {
    this.database = config.database;
    this.services = config.services;
    this.schema = config.schema;
    this.accountability = config.accountability;
    this.defaultLocale = config.defaultLocale || 'de-DE';
    
    // Use provided UsageFinderService instance instead of creating new one
    this.usageFinder = config.usageFinder;
    this.cache = config.cache;
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
    const cacheKey = `path:${usage.collection}:${usage.item_id}:${usage.field || 'none'}:${JSON.stringify(options)}`;
    
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
   * Build breadcrumbs for navigation
   * @param usage The usage location
   * @param options Build options
   * @returns Array of breadcrumbs
   */
  async buildBreadcrumbs(
    usage: UsageLocation,
    options: PathBuildOptions = {}
  ): Promise<Breadcrumb[]> {
    const path = await this.buildPath(usage, options);
    const breadcrumbs: Breadcrumb[] = [];

    path.steps.forEach((step, index) => {
      breadcrumbs.push({
        label: step.name,
        collection: step.collection,
        id: step.id,
        url: step.admin_url,
        icon: step.icon,
        is_current: index === path.steps.length - 1
      });
    });

    return breadcrumbs;
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
      locale = this.defaultLocale,
      useIcons = false,
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
   * Generate visualization data for paths
   * @param collection The collection of the item
   * @param itemId The ID of the item
   * @returns Visualization data
   */
  async generateVisualization(
    collection: string,
    itemId: string | number
  ): Promise<PathVisualization> {
    const pathCollection = await this.buildAllPaths(collection, itemId);
    const nodes: PathVisualization['nodes'] = [];
    const edges: PathVisualization['edges'] = [];
    const nodeMap = new Map<string, boolean>();

    // Add root node
    const rootId = `${collection}:${itemId}`;
    nodes.push({
      id: rootId,
      label: pathCollection.item.display_name,
      collection,
      type: 'item',
      level: 0
    });
    nodeMap.set(rootId, true);

    // Process all paths
    pathCollection.paths.forEach(path => {
      let previousId = rootId;
      
      path.steps.forEach((step, index) => {
        const nodeId = `${step.collection}:${step.id}`;
        
        // Add node if not exists
        if (!nodeMap.has(nodeId)) {
          nodes.push({
            id: nodeId,
            label: step.name,
            collection: step.collection,
            type: 'item',
            level: index + 1
          });
          nodeMap.set(nodeId, true);
        }

        // Add edge
        if (index > 0 || step.id !== itemId) {
          edges.push({
            from: previousId,
            to: nodeId,
            label: step.field || '',
            type: 'usage'
          });
        }

        previousId = nodeId;
      });
    });

    return {
      nodes,
      edges,
      layout: {
        direction: 'TB',
        spacing: 100
      }
    };
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
        console.warn(`[PathBuilder] Circular reference detected at ${key}`);
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
    const { useIcons = false, templates = {} } = options;
    
    let formatted = '';

    switch (style) {
      case 'short':
        // Only collection and name
        formatted = step.name;
        if (useIcons && step.icon) {
          formatted = `${step.icon} ${formatted}`;
        }
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
        
        if (useIcons && step.icon) {
          formatted = `${step.icon} ${formatted}`;
        }
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
    return template.replace(/\{(\w+)\}/g, (match, key) => {
      return data[key] || match;
    });
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
      
      // Common field names for display
      const displayFields = [
        'name', 'title', 'headline', 'label', 'display_name',
        'slug', 'description', 'text', 'content'
      ];

      for (const field of displayFields) {
        if (item[field] && item[field].toString().trim()) {
          return item[field];
        }
      }

      return `${collection} #${itemId}`;
    } catch (error) {
      return `${collection} #${itemId}`;
    }
  }
}