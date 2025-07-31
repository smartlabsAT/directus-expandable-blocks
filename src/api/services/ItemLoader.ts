import { Knex } from 'knex';
import { 
  ItemLoaderConfig, 
  ItemQuery, 
  ItemResult, 
  ItemMetadata,
  CountOptions,
  DEFAULT_QUERY,
  MAX_LIMIT
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
  private database: Knex;
  private schema: DirectusSchema;
  private services: DirectusServices;
  private accountability?: DirectusAccountability;
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

    // Check for translations and expand fields if needed
    const expandedFields = normalizedQuery.expandTranslations 
      ? await this.expandTranslationFields(collection, normalizedQuery.fields)
      : normalizedQuery.fields;

    const itemsService = this.createItemsService(collection);

    try {
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
    } catch (error: any) {
      if (error instanceof InvalidCollectionError) {
        throw error;
      }
      
      const errorMessage = `Failed to load items from '${collection}': ${extractDirectusErrorMessage(error)}`;
      throw new DatabaseQueryError(errorMessage);
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

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
    } catch (error: any) {
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
    } catch (error: any) {
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