import type { Knex } from 'knex';
import { 
  ItemLoaderConfig, 
  ItemQuery, 
  ItemResult, 
  ItemMetadata,
  CountOptions
} from '../types/ItemLoaderTypes';
import { InvalidCollectionError, DatabaseQueryError } from '../types/errors';
import { FieldAnalyzer } from './FieldAnalyzer';
import { checkTableExists, extractDirectusErrorMessage, extractAggregateCount } from '../utils/database-utils';
import { normalizeQuery } from '../utils/query-utils';
import type { DirectusServices, DirectusSchema, DirectusAccountability } from '../types/directus-api';

// ============================================================================
// ItemLoader Class
// ============================================================================

/**
 * Service for loading items from Directus collections with pagination and filtering
 */
export class ItemLoader {
  private readonly database: Knex;
  private readonly schema: DirectusSchema;
  private readonly services: DirectusServices;
  private readonly accountability?: DirectusAccountability;
  private fieldAnalyzer?: FieldAnalyzer;

  constructor(config: ItemLoaderConfig) {
    this.database = config.database;
    this.schema = config.schema;
    this.services = config.services;
    this.accountability = config.accountability;
  }

  // ============================================================================
  // Public API Methods
  // ============================================================================

  /**
   * Load items from a collection with query parameters
   * @param collection The collection to load items from
   * @param query Query parameters (limit, offset, filter, etc.)
   * @returns Items with metadata
   * @throws InvalidCollectionError if collection doesn't exist
   * @throws DatabaseQueryError if query fails
   */
  async loadItems<T = any>(
    collection: string,
    query: ItemQuery = {}
  ): Promise<ItemResult<T>> {
    const normalizedQuery = normalizeQuery(query);

    try {
      // Check for translations and expand fields if needed
      const expandedFields = normalizedQuery.expandTranslations 
        ? await this.expandTranslationFields(collection, normalizedQuery.fields)
        : normalizedQuery.fields;

      const itemsService = this.createItemsService(collection);
      const queryOptions: any = {
        limit: normalizedQuery.limit,
        offset: normalizedQuery.offset,
        fields: expandedFields,
        filter: normalizedQuery.filter,
        search: normalizedQuery.search,
        sort: normalizedQuery.sort.length > 0 ? normalizedQuery.sort : ['id']
      };
      
      if (normalizedQuery.deep) {
        queryOptions.deep = normalizedQuery.deep;
      }
      
      const items = await itemsService.readByQuery(queryOptions);
      const itemsArray = Array.isArray(items) ? items : [items];

      // Get counts in parallel
      const [totalCount, filterCount] = await Promise.all([
        this.getTotalCount(collection),
        this.getFilteredCount({
          collection,
          filter: normalizedQuery.filter,
          search: normalizedQuery.search
        })
      ]);

      const metadata = this.calculateMetadata(
        totalCount,
        filterCount,
        normalizedQuery.limit,
        normalizedQuery.offset
      );

      return {
        data: itemsArray,
        meta: metadata
      };
    } catch (error) {
      if (error instanceof InvalidCollectionError) {
        throw error;
      }
      
      const errorMsg = error instanceof Error ? error.message : String(error);
      const errorCode = error instanceof Error && 'code' in error ? (error as any).code : undefined;
      
      // Log error for debugging
      console.log('[ItemLoader] Error loading items:', {
        collection,
        error: errorMsg,
        code: errorCode,
        returnMinimalOnPermissionError: normalizedQuery.returnMinimalOnPermissionError
      });
      
      // Check if it's a permission error and we should return minimal data
      const isPermissionError = this.isPermissionError(error);
      if (isPermissionError && normalizedQuery.returnMinimalOnPermissionError) {
        console.log('[ItemLoader] Permission error detected, returning minimal items');
        return this.loadMinimalItems(collection, normalizedQuery);
      }
      
      const errorMessage = `Failed to load items from '${collection}': ${extractDirectusErrorMessage(error)}`;
      throw new DatabaseQueryError(errorMessage);
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Check if an error is a permission error
   */
  private isPermissionError(error: any): boolean {
    const message = extractDirectusErrorMessage(error).toLowerCase();
    const isPermError = message.includes('permission') || 
           message.includes('access') ||
           message.includes('forbidden') ||
           message.includes('does not exist') || // Directus often says "or it does not exist" for permission errors
           error.code === 'FORBIDDEN' ||
           error.extensions?.code === 'FORBIDDEN';
    
    console.log('[ItemLoader] Permission check:', {
      message,
      isPermError,
      code: error.code,
      extensionsCode: error.extensions?.code
    });
    
    return isPermError;
  }

  /**
   * Load minimal item data directly from database
   * Used when user has no permission but we still need to show locked items
   */
  private async loadMinimalItems<T = any>(
    collection: string,
    query: Required<ItemQuery>
  ): Promise<ItemResult<T>> {
    // Check if table exists first
    const tableExists = await checkTableExists(this.database, collection);
    if (!tableExists) {
      console.log('[ItemLoader] Table does not exist:', collection);
      // Return empty result for non-existent tables
      return {
        data: [],
        meta: {
          total_count: 0,
          filter_count: 0,
          limit: query.limit,
          offset: query.offset
        }
      };
    }

    try {
      console.log('[ItemLoader] Loading minimal items for:', {
        collection,
        filter: query.filter
      });

      // Build safe query
      let dbQuery = this.database(collection)
        .select('id')
        .limit(query.limit >= 0 ? query.limit : -1);

      if (query.offset > 0) {
        dbQuery = dbQuery.offset(query.offset);
      }

      // Apply filter if provided
      if (query.filter?.id?._in) {
        dbQuery = dbQuery.whereIn('id', query.filter.id._in);
      }

      const items = await dbQuery;

      // Add minimal data and permission flag
      const minimalItems = items.map((item: any) => ({
        id: item.id,
        _collection: collection,
        _no_permission: true
      }));

      // Get counts (without permission check)
      const totalCount = await this.database(collection).count('* as count').first();
      const filterCount = query.filter?.id?._in 
        ? minimalItems.length 
        : Number(totalCount?.count) || 0;

      const metadata = this.calculateMetadata(
        Number(totalCount?.count) || 0,
        Number(filterCount),
        query.limit,
        query.offset
      );

      return {
        data: minimalItems as T[],
        meta: metadata
      };
    } catch (error) {
      // If even minimal access fails, return empty result
      return {
        data: [],
        meta: {
          total_count: 0,
          filter_count: 0,
          limit: query.limit,
          offset: query.offset
        }
      };
    }
  }

  /**
   * Create an ItemsService instance for a collection
   */
  private createItemsService(collection: string): any {
    const { ItemsService } = this.services;
    return new ItemsService(collection, {
      knex: this.database,
      schema: this.schema,
      accountability: this.accountability
    });
  }

  /**
   * Get or create FieldAnalyzer instance
   */
  private getFieldAnalyzer(): FieldAnalyzer {
    if (!this.fieldAnalyzer) {
      this.fieldAnalyzer = new FieldAnalyzer({
        database: this.database,
        services: this.services,
        schema: this.schema,
        accountability: this.accountability
      });
    }
    return this.fieldAnalyzer;
  }


  /**
   * Expand fields array to include translation fields if collection has translations
   */
  private async expandTranslationFields(
    collection: string,
    fields: string[]
  ): Promise<string[]> {
    try {
      const fieldAnalyzer = this.getFieldAnalyzer();
      const translationInfo = await fieldAnalyzer.analyzeTranslations(collection);

      if (!translationInfo.hasTranslations) {
        return fields;
      }

      // Check if translations are already included
      const hasTranslationsField = fields.some(field => 
        field === 'translations' || 
        field.startsWith('translations.')
      );

      if (!hasTranslationsField) {
        return [...fields, 'translations.*'];
      }
      
      return fields;
    } catch (error) {
      // On error, return original fields
      return fields;
    }
  }

  // ============================================================================
  // Count Methods
  // ============================================================================

  /**
   * Get total count of items in collection (without filters)
   */
  private async getTotalCount(collection: string): Promise<number> {
    try {
      const result = await this.database(collection)
        .count('* as count')
        .first();
      
      return parseInt(String(result?.count || '0'));
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get filtered count of items
   */
  private async getFilteredCount(options: CountOptions): Promise<number> {
    const { collection, filter, search } = options;

    const hasFilter = filter && Object.keys(filter).length > 0;
    const hasSearch = search && search.trim().length > 0;

    // If no filters, return total count
    if (!hasFilter && !hasSearch) {
      return this.getTotalCount(collection);
    }

    try {
      const itemsService = this.createItemsService(collection);

      const result = await itemsService.readByQuery({
        aggregate: {
          countDistinct: ['id']
        },
        filter,
        search
      });

      return extractAggregateCount(result);
    } catch (error) {
      // Fallback to unfiltered count
      return this.getTotalCount(collection);
    }
  }

  // ============================================================================
  // Metadata Methods
  // ============================================================================

  /**
   * Calculate pagination metadata
   */
  private calculateMetadata(
    totalCount: number,
    filterCount: number,
    limit: number,
    offset: number
  ): ItemMetadata {
    const page = Math.floor(offset / limit) + 1;
    const pageCount = Math.ceil(filterCount / limit);

    return {
      total_count: totalCount,
      filter_count: filterCount,
      limit,
      offset,
      page,
      page_count: pageCount
    };
  }
}