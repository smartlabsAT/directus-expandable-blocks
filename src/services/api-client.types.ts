/**
 * Type definitions for the Directus API Client
 */

import type { AxiosInstance } from 'axios';
import type { FeatureSet } from './api-availability-checker';

/**
 * Search query options
 */
export interface SearchOptions {
  search?: string;
  filter?: Record<string, any>;
  limit?: number;
  offset?: number;
  page?: number;
  sort?: string | string[];
  fields?: string[];
  deep?: Record<string, any>;
}

/**
 * Search result from Directus API
 */
export interface SearchResult<T = any> {
  data: T[];
  meta?: {
    filter_count?: number;
    total_count?: number;
  };
}

/**
 * Field information from Directus
 */
export interface FieldInfo {
  field: string;
  type: string;
  schema?: {
    data_type: string;
    is_nullable: boolean;
    is_primary_key: boolean;
    has_auto_increment: boolean;
    default_value?: any;
  };
  meta?: {
    id: number;
    collection: string;
    field: string;
    special?: string[];
    interface?: string;
    display?: string;
    options?: any;
    display_options?: any;
    translations?: any[];
    required?: boolean;
    hidden?: boolean;
    sort?: number;
    width?: string;
    group?: number;
    note?: string;
  };
}

/**
 * Relation information from Directus
 */
export interface RelationInfo {
  collection: string;
  field: string;
  related_collection: string | null;
  schema?: {
    constraint_name?: string;
    table: string;
    column: string;
    foreign_key_table?: string;
    foreign_key_column?: string;
  };
  meta?: {
    id: number;
    many_collection: string;
    many_field: string;
    one_collection?: string;
    one_field?: string;
    one_collection_field?: string;
    one_allowed_collections?: string[];
    junction_field?: string;
    sort_field?: string;
    one_deselect_action?: string;
  };
}

/**
 * Collection metadata
 */
export interface CollectionMetadata {
  collection: string;
  fields: FieldInfo[];
  relations: RelationInfo[];
  primaryKeyField?: string;
  displayTemplate?: string;
  translations?: TranslationInfo;
}

/**
 * Translation field information
 */
export interface TranslationInfo {
  translationsCollection: string;
  languageField: string;
  translatableFields: string[];
  languageCodeField: string;
}

/**
 * Item usage result from API
 */
export interface ItemUsageResult {
  locations?: any[];
  total_count?: number;
  can_delete?: boolean;
  usage_locations?: any[];
  usage_summary?: any;
}

/**
 * Permission check result
 */
export interface PermissionResult {
  collection: string;
  action: 'create' | 'read' | 'update' | 'delete';
  allowed: boolean;
  fields?: string[];
}

/**
 * API Error
 */
export interface ApiError extends Error {
  response?: {
    status: number;
    data?: {
      errors?: Array<{
        message: string;
        extensions?: Record<string, any>;
      }>;
    };
  };
}

/**
 * Retry options
 */
export interface RetryOptions {
  maxRetries?: number;
  retryDelay?: number;
  retryCondition?: (error: any) => boolean;
}

/**
 * API Client configuration
 */
export interface ApiClientConfig {
  baseURL?: string;
  timeout?: number;
  retry?: boolean;
  retryOptions?: RetryOptions;
  onError?: (error: ApiError) => void;
  checkApiAvailability?: boolean; // Enable API availability checking
}

/**
 * Main API Client interface
 */
export interface IDirectusApiClient {
  // Search
  searchItems<T = any>(
    collection: string, 
    options?: SearchOptions
  ): Promise<SearchResult<T>>;

  // Load with relations
  loadItemsWithRelations<T = any>(
    collection: string,
    ids: (string | number)[],
    fields?: string[]
  ): Promise<T[]>;

  // Load single item with relations
  loadItemWithRelations<T = any>(
    collection: string,
    id: string | number,
    fields?: string[]
  ): Promise<T>;

  // Metadata
  getCollectionMetadata(
    collection: string
  ): Promise<CollectionMetadata>;

  getFieldsInfo(
    collection: string
  ): Promise<FieldInfo[]>;

  getRelationsInfo(
    collection: string
  ): Promise<RelationInfo[]>;

  // Permissions
  checkPermissions(
    collection: string,
    action: 'create' | 'read' | 'update' | 'delete'
  ): Promise<PermissionResult>;

  // Usage tracking (requires external API)
  getItemUsage(
    collection: string,
    id: string | number
  ): Promise<ItemUsageResult | null>;

  // Get raw API instance for direct calls
  getApi(): AxiosInstance;
  
  // Feature availability
  getAvailableFeatures(): Promise<FeatureSet>;
  isFeatureAvailable(feature: keyof FeatureSet): Promise<boolean>;
  
  // CRUD operations
  createItem<T = any>(collection: string, data: Partial<T>): Promise<T>;
  updateItem<T = any>(collection: string, id: string | number, data: Partial<T>): Promise<T>;
  deleteItem(collection: string, id: string | number): Promise<void>;
  
  // User operations
  getCurrentUser<T = any>(): Promise<T>;
  
  // Preset operations
  getPresets(filter?: Record<string, any>): Promise<any[]>;
  createPreset(data: any): Promise<any>;
  updatePreset(id: string | number, data: any): Promise<any>;
}

/**
 * M2A (Many-to-Any) specific types
 */
export interface M2ARelation {
  id: number | string;
  collection: string;
  item: any;
  sort?: number;
}

export interface M2AFieldConfig {
  junctionCollection: string;
  junctionField: string;
  relatedCollections: string[];
}