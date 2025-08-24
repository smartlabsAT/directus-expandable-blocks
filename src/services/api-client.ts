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
  TranslationInfo
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
    
    logDebug('DirectusApiClient initialized', { config: this.config });
  }

  /**
   * Search items in a collection using native Directus search
   */
  async searchItems<T = any>(
    collection: string,
    options: SearchOptions = {}
  ): Promise<SearchResult<T>> {
    try {
      // Build query params for native Directus API
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
      
      logDebug('Searching items with native API', { collection, params });
      
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
   * Load multiple items with their relations
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
      
      logDebug('Loading items with relations', { collection, ids: ids.length, fields });
      
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
      
      logDebug('Loading item with relations', { collection, id, fields });
      
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
      logDebug('Fetching fields info', { collection });
      
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
      logDebug('Fetching relations info', { collection });
      
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
      logDebug('Checking permissions', { collection, action });
      
      // Try to perform a minimal operation to check permission
      let allowed = false;
      let fields: string[] = [];
      
      if (action === 'read') {
        // Try to read with limit 0 to check permission
        try {
          const response = await this.api.get(`/items/${collection}`, {
            params: { limit: 0, meta: 'total_count' }
          });
          allowed = true;
          // TODO: Extract allowed fields from response if available
        } catch (err) {
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
        } catch (err) {
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
    // Look for translations relation
    const translationRelation = relations.find(r => 
      r.field === 'translations' &&
      r.meta?.one_collection_field === 'collection' &&
      r.meta?.junction_field
    );
    
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
    
    // Translatable fields are all fields except system fields
    const systemFields = ['id', 'languages_code', 'language', collection];
    const translatableFields = translationFields
      .filter(f => !systemFields.includes(f.field))
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