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
import { TranslationFieldAnalyzer } from './TranslationFieldAnalyzer';
import type { DirectusServices, DirectusSchema, DirectusAccountability } from '../types/directus-api';

/**
 * Service for loading items from Directus collections with pagination and filtering
 */
export class ItemLoader {
  private database: Knex;
  private schema: DirectusSchema;
  private services: DirectusServices;
  private accountability?: DirectusAccountability;

  constructor(config: ItemLoaderConfig) {
    this.database = config.database;
    this.schema = config.schema;
    this.services = config.services;
    this.accountability = config.accountability;
  }

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
    // Validate collection exists
    // await this.validateCollectionExists(collection);

    // Merge with defaults and validate
    const normalizedQuery = this.normalizeQuery(query);

    // Check for translations and expand fields if needed
    const expandedFields = normalizedQuery.expandTranslations 
      ? await this.expandTranslationFields(collection, normalizedQuery.fields)
      : normalizedQuery.fields;

    // Get ItemsService from injected services
    const { ItemsService } = this.services;

    // Create ItemsService instance
    const itemsService = new ItemsService(collection, {
      knex: this.database,
      schema: this.schema,
      accountability: this.accountability
    });

    try {
      // Prepare query with deep relations for translations
      const queryOptions: any = {
        limit: normalizedQuery.limit,
        offset: normalizedQuery.offset,
        fields: expandedFields,
        filter: normalizedQuery.filter,
        search: normalizedQuery.search,
        sort: normalizedQuery.sort && normalizedQuery.sort.length > 0 ? normalizedQuery.sort : ['id']
      };
      
      // Add deep parameter if provided
      if (normalizedQuery.deep) {
        queryOptions.deep = normalizedQuery.deep;
      }
      
      // Load items
      const items = await itemsService.readByQuery(queryOptions);

      // Ensure items is always an array
      const itemsArray = Array.isArray(items) ? items : [items];

      // Get counts
      const [totalCount, filterCount] = await Promise.all([
        this.getTotalCount(collection),
        this.getFilteredCount({
          collection,
          filter: normalizedQuery.filter,
          search: normalizedQuery.search
        })
      ]);

      // Calculate pagination metadata
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
      throw new DatabaseQueryError(
        `Failed to load items from '${collection}': ${error.message || error}`
      );
    }
  }

  /**
   * Validates that a collection exists
   * @param collection The collection name to validate
   * @throws InvalidCollectionError if collection doesn't exist
   */
  private async validateCollectionExists(collection: string): Promise<void> {
    try {
      // Check in directus_collections first
      const collectionInfo = await this.database
        .select('collection')
        .from('directus_collections')
        .where('collection', collection)
        .first();

      if (!collectionInfo) {
        // Check if table exists directly
        const tableExists = await this.checkTableExists(collection);
        if (!tableExists) {
          throw new InvalidCollectionError(collection);
        }
      }
    } catch (error: any) {
      if (error instanceof InvalidCollectionError) {
        throw error;
      }
      throw new DatabaseQueryError(
        `Failed to validate collection '${collection}': ${error.message || error}`
      );
    }
  }

  /**
   * Check if a table exists in the database
   * @param tableName The table name to check
   * @returns true if table exists
   */
  private async checkTableExists(tableName: string): Promise<boolean> {
    try {
      // Validate table name format
      if (!/^[a-zA-Z0-9_-]+$/.test(tableName) || tableName.length > 64) {
        return false;
      }

      const result = await this.database.raw(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = ?
        );
      `, [tableName]);

      return result.rows?.[0]?.exists || false;
    } catch (error: any) {
      return false;
    }
  }

  /**
   * Normalize and validate query parameters
   * @param query Raw query parameters
   * @returns Normalized query with defaults
   */
  private normalizeQuery(query: ItemQuery): Required<ItemQuery> {
    const normalized = {
      ...DEFAULT_QUERY,
      ...query
    };

    // Validate and cap limit
    if (normalized.limit < 0) {
      normalized.limit = DEFAULT_QUERY.limit;
    } else if (normalized.limit > MAX_LIMIT) {
      normalized.limit = MAX_LIMIT;
    }

    // Validate offset
    if (normalized.offset < 0) {
      normalized.offset = 0;
    }

    // Ensure fields is array with default
    if (!normalized.fields || normalized.fields.length === 0) {
      normalized.fields = DEFAULT_QUERY.fields;
    }

    // Ensure sort is array
    if (!Array.isArray(normalized.sort)) {
      normalized.sort = [];
    }

    return normalized;
  }

  /**
   * Get total count of items in collection (without filters)
   * @param collection The collection name
   * @returns Total count
   */
  private async getTotalCount(collection: string): Promise<number> {
    try {
      const result = await this.database(collection)
        .count('* as count')
        .first();
      
      const count = parseInt(String(result?.count || '0'));
      return count;
    } catch (error: any) {
      return 0;
    }
  }

  /**
   * Get filtered count of items
   * @param options Count options with filters
   * @returns Filtered count
   */
  private async getFilteredCount(options: CountOptions): Promise<number> {
    const { collection, filter, search } = options;



    // Check for truly empty filter
    const hasFilter = filter && Object.keys(filter).length > 0;
    const hasSearch = search && search.trim().length > 0;

    // If no filters, return total count
    if (!hasFilter && !hasSearch) {
      return this.getTotalCount(collection);
    }

    try {
      // For complex filters, we need to use ItemsService
      const { ItemsService } = this.services;
      
      const itemsService = new ItemsService(collection, {
        knex: this.database,
        schema: this.schema,
        accountability: this.accountability
      });

      // Use readByQuery with aggregate to get count with filters
      const result = await itemsService.readByQuery({
        aggregate: {
          countDistinct: ['id']
        },
        filter,
        search
      });


      // Extract count from aggregate result
      // Try different possible response formats
      const count = result?.[0]?.countDistinct?.id || 
                   result?.[0]?.count?.id || 
                   result?.[0]?.count ||
                   0;

      return count;
      
    } catch (error: any) {
      // Fallback to unfiltered count
      return this.getTotalCount(collection);
    }
  }

  /**
   * Calculate pagination metadata
   * @param totalCount Total items in collection
   * @param filterCount Items matching filters
   * @param limit Applied limit
   * @param offset Applied offset
   * @returns Complete metadata
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

  /**
   * Expand fields array to include translation fields if collection has translations
   * @param collection The collection to check
   * @param fields Original fields array
   * @returns Expanded fields array with translation fields
   */
  private async expandTranslationFields(
    collection: string,
    fields: string[]
  ): Promise<string[]> {
    try {
      // Create TranslationFieldAnalyzer instance
      const translationAnalyzer = new TranslationFieldAnalyzer({
        database: this.database,
        services: this.services,
        schema: this.schema,
        accountability: this.accountability
      });

      // Analyze collection for translations
      const translationInfo = await translationAnalyzer.analyzeCollection(collection);

      // If no translations, return original fields
      if (!translationInfo.hasTranslations) {
        return fields;
      }

      // Always add translations.* if not already included
      const hasTranslationsField = fields.some(field => 
        field === 'translations' || 
        field.startsWith('translations.')
      );

      // If translations not explicitly included, add them
      if (!hasTranslationsField) {
        return [...fields, 'translations.*'];
      }
      
      return fields;
    } catch (error) {
      // On error, return original fields
      return fields;
    }
  }

}