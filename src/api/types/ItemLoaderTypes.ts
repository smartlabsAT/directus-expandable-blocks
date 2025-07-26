import { Knex } from 'knex';
import type { DirectusServices, DirectusSchema, DirectusAccountability } from './directus-api';

/**
 * Configuration for ItemLoader service
 */
export interface ItemLoaderConfig {
  /** Database connection */
  database: Knex;
  
  /** Directus schema object */
  schema: DirectusSchema;
  
  /** Directus services object containing ItemsService, etc. */
  services: DirectusServices;
  
  /** Optional accountability for permissions */
  accountability?: DirectusAccountability;
}

/**
 * Query parameters for loading items
 */
export interface ItemQuery {
  /** Maximum number of items to return (default: 10) */
  limit?: number;
  
  /** Number of items to skip (default: 0) */
  offset?: number;
  
  /** Fields to include in response (default: ['*']) */
  fields?: string[];
  
  /** Filter object following Directus filter syntax */
  filter?: any;
  
  /** Search string for full-text search */
  search?: string;
  
  /** Sort fields and directions (e.g. ['-date_created', 'title']) */
  sort?: string[];
  
  /** Whether to automatically expand translation fields (default: true) */
  expandTranslations?: boolean;
  
  /** Deep filter for nested relations */
  deep?: any;
}

/**
 * Result structure for loaded items
 */
export interface ItemResult<T = any> {
  /** Array of loaded items */
  data: T[];
  
  /** Metadata about the query results */
  meta: ItemMetadata;
}

/**
 * Metadata about item query results
 */
export interface ItemMetadata {
  /** Total number of items in the collection (without filters) */
  total_count: number;
  
  /** Number of items matching current filters */
  filter_count: number;
  
  /** Applied limit */
  limit: number;
  
  /** Applied offset */
  offset: number;
  
  /** Current page (calculated from offset/limit) */
  page?: number;
  
  /** Total pages (calculated from filter_count/limit) */
  page_count?: number;
}

/**
 * Options for count queries
 */
export interface CountOptions {
  /** The collection to count items from */
  collection: string;
  
  /** Optional filter to apply */
  filter?: any;
  
  /** Optional search to apply */
  search?: string;
}

/**
 * Default query values
 */
export const DEFAULT_QUERY: Required<ItemQuery> = {
  limit: 10,
  offset: 0,
  fields: ['*'],
  filter: undefined as any,
  search: '' as string,
  sort: [],
  expandTranslations: true,
  deep: undefined as any
};

/**
 * Maximum allowed limit for safety
 */
export const MAX_LIMIT = 1000;

/**
 * Type guard to check if value is a valid ItemQuery
 */
export function isValidItemQuery(query: any): query is ItemQuery {
  if (typeof query !== 'object' || query === null) {
    return false;
  }
  
  // Check optional numeric fields
  if (query.limit !== undefined && (typeof query.limit !== 'number' || query.limit < 0)) {
    return false;
  }
  
  if (query.offset !== undefined && (typeof query.offset !== 'number' || query.offset < 0)) {
    return false;
  }
  
  // Check optional array fields
  if (query.fields !== undefined && !Array.isArray(query.fields)) {
    return false;
  }
  
  if (query.sort !== undefined && !Array.isArray(query.sort)) {
    return false;
  }
  
  return true;
}