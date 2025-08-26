/**
 * Directus API Client Service
 * 
 * A service that provides a unified interface for interacting with the native Directus API.
 * This replaces the custom API extension with direct Directus API calls.
 */

import type { AxiosInstance } from 'axios';
import { logDebug, logError, logWarn } from '../utils/logger-wrapper';
import { createApiAvailabilityChecker } from './api-availability-checker';
import type { ApiAvailabilityChecker, FeatureSet } from './api-availability-checker';
import type {
  IDirectusApiClient,
  ApiClientConfig,
  SearchOptions,
  SearchResult,
  CollectionMetadata,
  FieldInfo,
  RelationInfo,
  PermissionResult,
  ApiError,
  TranslationInfo,
  ItemUsageResult
} from './api-client.types';

/**
 * Main Directus API Client implementation
 */
export class DirectusApiClient implements IDirectusApiClient {
  private api: AxiosInstance;
  private config: ApiClientConfig;
  private availabilityChecker: ApiAvailabilityChecker;

  constructor(api: AxiosInstance, config: ApiClientConfig = {}) {
    this.api = api;
    this.config = {
      retry: true,
      retryOptions: {
        maxRetries: 3,
        retryDelay: 1000,
      },
      checkApiAvailability: true,
      ...config
    };
    
    // Initialize availability checker
    this.availabilityChecker = createApiAvailabilityChecker(api);
  }

  /**
   * Search items in a collection using external API when available, fallback to native
   */
  async searchItems<T = any>(
    collection: string,
    options: SearchOptions = {}
  ): Promise<SearchResult<T>> {
    try {
      // Check if external API is available for enhanced search
      const hasCustomApi = await this.availabilityChecker.checkCustomApiAvailable();
      
      if (hasCustomApi && options.search) {
        // Use external API for better search performance
        try {
          const payload = {
            search: options.search,
            filter: options.filter,
            limit: options.limit || 50,
            offset: options.offset || (options.page && options.limit ? (options.page - 1) * options.limit : 0),
            sort: options.sort,
            fields: options.fields
          };
          
          const response = await this.retryRequest(() =>
            this.api.post(`/expandable-blocks-api/${collection}/search`, payload)
          );
          
          const result: SearchResult<T> = {
            data: response.data.data || [],
            meta: response.data.meta || {
              filter_count: response.data.data?.length || 0,
              total_count: response.data.total || response.data.data?.length || 0
            }
          };
          
          return result;
        } catch (externalApiError) {
          // Silently fall back to native API
          // This is expected when the external API is not available
        }
      }
      
      // Fallback to native Directus API
      const params: Record<string, any> = {};
      
      if (options.search) {
        params.search = options.search;
      }
      
      if (options.filter) {
        params.filter = options.filter;
      }
      
      if (options.limit !== undefined) {
        params.limit = options.limit;
      }
      
      if (options.offset !== undefined) {
        params.offset = options.offset;
      } else if (options.page !== undefined && options.limit) {
        params.offset = (options.page - 1) * options.limit;
      }
      
      if (options.sort) {
        params.sort = Array.isArray(options.sort) ? options.sort.join(',') : options.sort;
      }
      
      if (options.fields && options.fields.length > 0) {
        params.fields = options.fields.join(',');
      }
      
      if (options.deep) {
        params.deep = options.deep;
      }
      
      // Add meta for counts
      params.meta = 'filter_count,total_count';
      
      const response = await this.retryRequest(() => 
        this.api.get(`/items/${collection}`, { params })
      );
      
      const result: SearchResult<T> = {
        data: response.data.data || [],
        meta: response.data.meta
      };
      
      return result;
      
    } catch (error) {
      logError('Failed to search items', error, { collection, options });
      this.handleError(error as ApiError);
      throw error;
    }
  }

  /**
   * Load multiple items with their relations and usage information
   */
  async loadItemsWithRelations<T = any>(
    collection: string,
    ids: (string | number)[],
    fields?: string[]
  ): Promise<T[]> {
    if (ids.length === 0) {
      return [];
    }

    try {
      // Check if external API is available for enhanced data loading
      const hasCustomApi = await this.availabilityChecker.checkCustomApiAvailable();
      
      if (hasCustomApi) {
        // Use external API for enhanced data with usage information
        try {
          const payload = {
            ids,
            fields: fields || ['*.*']
          };
          
          const response = await this.retryRequest(() =>
            this.api.post(`/expandable-blocks-api/${collection}/detail`, payload)
          );
          
          const items = response.data.data || [];
          
          // Debug: Log what we got from the API
          if (items.length > 0 && items[0].usage_locations) {
            logDebug('API returned usage data', {
              itemId: ids[0],
              usageLocations: items[0].usage_locations,
              usageSummary: items[0].usage_summary
            });
          }
          
          // External API provides enhanced data with usage_locations and usage_summary
          return items;
        } catch (externalApiError) {
          // Silently fall back to native API
          // This is expected when the external API endpoints are not available
        }
      }
      
      // Fallback to native Directus API
      const params: Record<string, any> = {
        filter: {
          id: {
            _in: ids
          }
        }
      };
      
      if (fields && fields.length > 0) {
        params.fields = fields.join(',');
      } else {
        // Default: Load with one level of relations
        params.fields = '*.*';
      }
      
      const response = await this.retryRequest(() =>
        this.api.get(`/items/${collection}`, { params })
      );
      
      const items = response.data.data || [];
      
      return items;
      
    } catch (error) {
      logError('Failed to load items with relations', error, { collection, ids });
      this.handleError(error as ApiError);
      throw error;
    }
  }

  /**
   * Load a single item with its relations
   */
  async loadItemWithRelations<T = any>(
    collection: string,
    id: string | number,
    fields?: string[]
  ): Promise<T> {
    try {
      const params: Record<string, any> = {};
      
      if (fields && fields.length > 0) {
        params.fields = fields.join(',');
      } else {
        // Default: Load with one level of relations
        params.fields = '*.*';
      }
      
      const response = await this.retryRequest(() =>
        this.api.get(`/items/${collection}/${id}`, { params })
      );
      
      const item = response.data.data;
      
      return item;
      
    } catch (error) {
      logError('Failed to load item with relations', error, { collection, id });
      this.handleError(error as ApiError);
      throw error;
    }
  }

  /**
   * Get collection metadata including fields and relations
   */
  async getCollectionMetadata(
    collection: string
  ): Promise<CollectionMetadata> {
    try {
      // Check if external API is available for enhanced metadata
      const hasCustomApi = await this.availabilityChecker.checkCustomApiAvailable();
      
      if (hasCustomApi) {
        // Try to get enhanced metadata from external API
        try {
          const response = await this.retryRequest(() =>
            this.api.get(`/expandable-blocks-api/${collection}/metadata`)
          );
          
          if (response.data) {
            // If external API returns the old format with displayableFields, use it
            if (response.data.displayableFields && response.data.displayableFields.length > 0) {
              return response.data;
            }
          }
        } catch (externalApiError) {
          // Silently fall back to native API
          // This is expected when the external API is not available
        }
      }
      
      // Fallback to native Directus API
      // Fetch fields and relations in parallel
      const [fields, relations] = await Promise.all([
        this.getFieldsInfo(collection),
        this.getRelationsInfo(collection)
      ]);
      
      // Find primary key field
      const primaryKeyField = fields.find(f => 
        f.schema?.is_primary_key || f.field === 'id'
      )?.field || 'id';
      
      // Find display template
      const collectionInfo = await this.getCollectionInfo(collection);
      const displayTemplate = collectionInfo?.meta?.display_template;
      
      // Check for translations
      const translations = await this.getTranslationInfo(collection, fields, relations);
      
      const metadata: CollectionMetadata = {
        collection,
        fields,
        relations,
        primaryKeyField,
        displayTemplate,
        translations
      };
      
      return metadata;
      
    } catch (error) {
      logError('Failed to get collection metadata', error, { collection });
      this.handleError(error as ApiError);
      throw error;
    }
  }

  /**
   * Get fields information for a collection
   */
  async getFieldsInfo(
    collection: string
  ): Promise<FieldInfo[]> {
    try {
      const response = await this.retryRequest(() =>
        this.api.get(`/fields/${collection}`)
      );
      
      const fields = response.data.data || [];
      
      return fields;
      
    } catch (error) {
      logError('Failed to get fields info', error, { collection });
      this.handleError(error as ApiError);
      throw error;
    }
  }

  /**
   * Get relations information for a collection
   */
  async getRelationsInfo(
    collection: string
  ): Promise<RelationInfo[]> {
    try {
      const response = await this.retryRequest(() =>
        this.api.get('/relations', {
          params: {
            filter: {
              _or: [
                { collection: { _eq: collection } },
                { related_collection: { _eq: collection } }
              ]
            }
          }
        })
      );
      
      const relations = response.data.data || [];
      
      return relations;
      
    } catch (error) {
      logError('Failed to get relations info', error, { collection });
      this.handleError(error as ApiError);
      throw error;
    }
  }

  /**
   * Check permissions for a collection and action
   */
  async checkPermissions(
    collection: string,
    action: 'create' | 'read' | 'update' | 'delete'
  ): Promise<PermissionResult> {
    try {
      // Try to perform a minimal operation to check permission
      let allowed = false;
      let fields: string[] = [];
      
      if (action === 'read') {
        // Try to read with limit 0 to check permission
        try {
          await this.api.get(`/items/${collection}`, {
            params: { limit: 0, meta: 'total_count' }
          });
          allowed = true;
          // TODO: Extract allowed fields from response if available
        } catch {
          allowed = false;
        }
      } else {
        // For other actions, we need to check via permissions endpoint
        // This is a simplified check - you might want to enhance this
        try {
          const response = await this.api.get('/permissions', {
            params: {
              filter: {
                collection: { _eq: collection },
                action: { _eq: action }
              }
            }
          });
          allowed = response.data.data && response.data.data.length > 0;
          if (allowed && response.data.data[0]?.fields) {
            fields = response.data.data[0].fields;
          }
        } catch {
          // If we can't access permissions endpoint, assume no permission
          allowed = false;
        }
      }
      
      return {
        collection,
        action,
        allowed,
        fields: fields.length > 0 ? fields : undefined
      };
      
    } catch (error) {
      logError('Failed to check permissions', error, { collection, action });
      return {
        collection,
        action,
        allowed: false
      };
    }
  }

  /**
   * Get usage information for an item (requires external API)
   */
  async getItemUsage(
    collection: string,
    id: string | number
  ): Promise<ItemUsageResult | null> {
    try {
      // This feature requires the external API
      const hasCustomApi = await this.availabilityChecker.checkCustomApiAvailable();
      
      if (!hasCustomApi) {
        return null;
      }
      
      // Usage data now comes from the /detail endpoint via loadItemsWithRelations
      const items = await this.loadItemsWithRelations(collection, [id]);
      const item = items?.[0];
      
      // Check if we got an item back from the API
      if (item) {
        // Even if usage_locations or usage_summary are missing/empty, 
        // we should still return a result (the API supports usage tracking)
        return {
          locations: item.usage_locations || [],
          total_count: item.usage_summary?.total_count || 0,
          can_delete: item.usage_summary?.can_delete !== false, // Default to true if not explicitly false
          usage_locations: item.usage_locations || [],
          usage_summary: item.usage_summary || {}
        };
      }
      
      return null;
      
    } catch (error) {
      // This is expected when the API is not available
      logDebug('Item usage check failed (API may not be available)', { collection, id });
      return null;
    }
  }

  /**
   * Get the raw API instance for direct calls
   */
  getApi(): AxiosInstance {
    return this.api;
  }

  /**
   * Get available features based on API availability
   */
  async getAvailableFeatures(): Promise<FeatureSet> {
    if (!this.config.checkApiAvailability) {
      // If checking is disabled, assume all basic features are available
      return {
        basicCRUD: true,
        search: true,
        filtering: true,
        sorting: true,
        pagination: true,
        relationChecking: false,
        usageTracking: false,
        deleteProtection: false,
        cascadeDelete: false,
        usageSummary: false,
        hasCustomApi: false,
        hasNativeApi: true
      };
    }
    
    return this.availabilityChecker.getAvailableFeatures();
  }

  /**
   * Check if a specific feature is available
   */
  async isFeatureAvailable(feature: keyof FeatureSet): Promise<boolean> {
    if (!this.config.checkApiAvailability) {
      // Assume basic features are available
      const basicFeatures = ['basicCRUD', 'search', 'filtering', 'sorting', 'pagination', 'hasNativeApi'];
      return basicFeatures.includes(feature);
    }
    
    return this.availabilityChecker.isFeatureAvailable(feature);
  }

  /**
   * Create a new item in a collection
   */
  async createItem<T = any>(collection: string, data: Partial<T>): Promise<T> {
    try {
      const response = await this.retryRequest(() =>
        this.api.post(`/items/${collection}`, data)
      );
      
      return response.data.data;
    } catch (error) {
      logError('Failed to create item', error, { collection });
      this.handleError(error as ApiError);
      throw error;
    }
  }

  /**
   * Update an existing item in a collection
   */
  async updateItem<T = any>(collection: string, id: string | number, data: Partial<T>): Promise<T> {
    try {
      const response = await this.retryRequest(() =>
        this.api.patch(`/items/${collection}/${id}`, data)
      );
      
      return response.data.data;
    } catch (error) {
      logError('Failed to update item', error, { collection, id });
      this.handleError(error as ApiError);
      throw error;
    }
  }

  /**
   * Delete an item from a collection
   */
  async deleteItem(collection: string, id: string | number): Promise<void> {
    try {
      await this.retryRequest(() =>
        this.api.delete(`/items/${collection}/${id}`)
      );
    } catch (error) {
      logError('Failed to delete item', error, { collection, id });
      this.handleError(error as ApiError);
      throw error;
    }
  }

  /**
   * Get current user information
   */
  async getCurrentUser<T = any>(): Promise<T> {
    try {
      const response = await this.retryRequest(() =>
        this.api.get('/users/me', {
          params: {
            fields: ['*', 'role.*']
          }
        })
      );
      
      return response.data.data;
    } catch (error) {
      logError('Failed to get current user', error);
      this.handleError(error as ApiError);
      throw error;
    }
  }

  /**
   * Get user presets
   */
  async getPresets(filter?: Record<string, any>): Promise<any[]> {
    try {
      const params: Record<string, any> = {};
      if (filter) {
        params.filter = filter;
      }
      
      const response = await this.retryRequest(() =>
        this.api.get('/presets', { params })
      );
      
      return response.data.data || [];
    } catch (error) {
      logError('Failed to get presets', error, { filter });
      this.handleError(error as ApiError);
      throw error;
    }
  }

  /**
   * Create a new preset
   */
  async createPreset(data: any): Promise<any> {
    try {
      const response = await this.retryRequest(() =>
        this.api.post('/presets', data)
      );
      
      return response.data.data;
    } catch (error) {
      logError('Failed to create preset', error);
      this.handleError(error as ApiError);
      throw error;
    }
  }

  /**
   * Update an existing preset
   */
  async updatePreset(id: string | number, data: any): Promise<any> {
    try {
      const response = await this.retryRequest(() =>
        this.api.patch(`/presets/${id}`, data)
      );
      
      return response.data.data;
    } catch (error) {
      logError('Failed to update preset', error, { id });
      this.handleError(error as ApiError);
      throw error;
    }
  }

  /**
   * Private helper methods
   */

  private async getCollectionInfo(collection: string): Promise<any> {
    try {
      const response = await this.api.get(`/collections/${collection}`);
      return response.data.data;
    } catch (error) {
      logWarn('Failed to get collection info', { collection, error });
      return null;
    }
  }

  private async getTranslationInfo(
    collection: string,
    fields: FieldInfo[],
    relations: RelationInfo[]
  ): Promise<TranslationInfo | undefined> {
    // First, try the simple approach: check if a translation table exists
    // Most common pattern is {collection}_translations
    const possibleTranslationTable = `${collection}_translations`;
    
    try {
      // Try to get fields from the translation table directly
      const translationFields = await this.getFieldsInfo(possibleTranslationTable);
      
      if (translationFields && translationFields.length > 0) {
        // Find language field
        const languageField = translationFields.find(f => 
          f.field === 'languages_code' || 
          f.field === 'language' ||
          f.meta?.interface === 'select-dropdown' && f.meta?.special?.includes('m2o')
        );
        
        if (languageField) {
          // We found a valid translation table!
          // Get translatable fields (all non-system fields from the translation table)
          const systemFields = ['id', 'languages_code', 'language', 'languages_id', `${collection}_id`,
                               'user_created', 'user_updated', 'date_created', 'date_updated', 'sort', 'status'];
          
          // All non-system fields from the translation table are translatable
          const translatableFields = translationFields
            .filter(f => !systemFields.includes(f.field))
            .map(f => f.field);
          
          return {
            translationsCollection: possibleTranslationTable,
            languageField: languageField.field,
            translatableFields,
            languageCodeField: languageField.field
          };
        }
      }
    } catch {
      // Table doesn't exist or we can't access it, continue with relation-based detection
    }
    
    // Look for translations relation - be more flexible in detection
    // BUT exclude system translation tables
    // Note: Relations can be defined in either direction (from main to translations or vice versa)
    let translationRelation = relations.find(r => {
      // Skip system translation tables
      if (r.related_collection === 'directus_translations') {
        return false;
      }
      
      // Common patterns for translation relations
      const isTranslationField = r.field === 'translations' || 
                                 r.field === 'translation' ||
                                 r.field?.includes('translation');
      
      // Check if it's a one-to-many relation to a translation collection
      // Specifically look for collection-specific translation tables like 'content_headline_translations'
      const isCollectionTranslation = r.related_collection?.includes(`${collection}_translations`) ||
                                      r.related_collection?.includes(`${collection}_translation`);
      
      // Also check for general translation pattern but not the system one
      const isTranslationRelation = (r.related_collection?.includes('translations') ||
                                     r.related_collection?.includes('translation')) &&
                                     r.related_collection !== 'directus_translations';
      
      // Prioritize collection-specific translations
      return isCollectionTranslation || (isTranslationField && isTranslationRelation);
    });
    
    // If no direct relation found, check for reverse relations
    // e.g., content_headline_translations -> content_headline
    if (!translationRelation) {
      // Look for relations where the collection is the target (one_collection)
      // and the source (many_collection) is a translation table
      translationRelation = relations.find(r => {
        const sourceCollection = r.collection || r.meta?.many_collection;
        const isTranslationSource = sourceCollection?.includes(`${collection}_translations`) ||
                                    sourceCollection?.includes(`${collection}_translation`);
        
        if (isTranslationSource) {
          // Transform to expected format - use the source as related_collection
          return {
            ...r,
            related_collection: sourceCollection,
            field: 'translations' // Virtual field name
          };
        }
        
        return false;
      });
      
      // If we found a reverse relation, use the many_collection as the translation collection
      if (translationRelation) {
        const sourceCollection = translationRelation.collection || translationRelation.meta?.many_collection;
        translationRelation = {
          ...translationRelation,
          related_collection: sourceCollection || null,
          field: 'translations'
        };
      }
    }
    
    if (!translationRelation) {
      return undefined;
    }
    
    const translationsCollection = translationRelation.related_collection;
    if (!translationsCollection) {
      return undefined;
    }
    
    // Get translation fields
    const translationFields = await this.getFieldsInfo(translationsCollection);
    
    // Find language field
    const languageField = translationFields.find(f => 
      f.field === 'languages_code' || 
      f.field === 'language' ||
      f.meta?.interface === 'select-dropdown' && f.meta?.special?.includes('m2o')
    );
    
    if (!languageField) {
      return undefined;
    }
    
    // Important: translatable fields are the fields that exist in BOTH collections
    // System fields that should not be considered translatable
    const systemFields = ['id', 'languages_code', 'language', 'languages_id', collection, 
                          'user_created', 'user_updated', 'date_created', 'date_updated', 'sort', 'status'];
    
    // Get field names from translation collection (excluding system fields)
    const translationFieldNames = translationFields
      .filter(f => !systemFields.includes(f.field))
      .map(f => f.field);
    
    // Find which fields from the main collection are translatable
    // A field is translatable if it exists in both the main collection and the translation collection
    const translatableFields = fields
      .filter(f => translationFieldNames.includes(f.field) && !systemFields.includes(f.field))
      .map(f => f.field);
    
    return {
      translationsCollection,
      languageField: languageField.field,
      translatableFields,
      languageCodeField: languageField.field
    };
  }

  private async retryRequest<T>(
    request: () => Promise<T>,
    retries: number = 0
  ): Promise<T> {
    try {
      return await request();
    } catch (error: any) {
      const maxRetries = this.config.retryOptions?.maxRetries || 3;
      const retryDelay = this.config.retryOptions?.retryDelay || 1000;
      const retryCondition = this.config.retryOptions?.retryCondition || this.defaultRetryCondition;
      
      if (retries < maxRetries && retryCondition(error)) {
        logWarn(`Request failed, retrying... (${retries + 1}/${maxRetries})`, { error: error.message });
        await new Promise(resolve => setTimeout(resolve, retryDelay * (retries + 1)));
        return this.retryRequest(request, retries + 1);
      }
      
      throw error;
    }
  }

  private defaultRetryCondition(error: any): boolean {
    // Retry on network errors or 5xx errors
    return !error.response || error.response.status >= 500;
  }

  private handleError(error: ApiError): void {
    if (this.config.onError) {
      this.config.onError(error);
    }
    
    // Log structured error
    const errorInfo = {
      message: error.message,
      status: error.response?.status,
      errors: error.response?.data?.errors
    };
    
    logError('API request failed', error, errorInfo);
  }
}

/**
 * Factory function to create API client instance
 */
export function createApiClient(
  api: AxiosInstance,
  config?: ApiClientConfig
): IDirectusApiClient {
  return new DirectusApiClient(api, config);
}