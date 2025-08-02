/**
 * Common type definitions for the Expandable Blocks API
 */

import type { Accountability } from '@directus/types';
import type { Knex } from 'knex';

/**
 * Directus Item Service interface
 */
export interface DirectusItemService {
  readByQuery(query: DirectusQuery): Promise<DirectusItem[]>;
  readOne(id: string | number, query?: DirectusQuery): Promise<DirectusItem | null>;
  aggregate(query: DirectusAggregateQuery): Promise<DirectusAggregateResult[]>;
}

/**
 * Directus query parameters
 */
export interface DirectusQuery {
  fields?: string[];
  filter?: DirectusFilter;
  limit?: number;
  offset?: number;
  page?: number;
  sort?: string[];
  search?: string;
  deep?: Record<string, DirectusDeepQuery>;
  alias?: Record<string, string>;
}

/**
 * Directus deep query for nested relations
 */
export interface DirectusDeepQuery {
  _fields?: string[];
  _filter?: DirectusFilter;
  _limit?: number;
  _offset?: number;
  _sort?: string[];
}

/**
 * Directus filter object
 */
export interface DirectusFilter {
  [key: string]: DirectusFilterValue | DirectusFilter;
}

/**
 * Directus filter value types
 */
export type DirectusFilterValue = 
  | string 
  | number 
  | boolean 
  | null 
  | string[] 
  | number[] 
  | { _eq?: any; _neq?: any; _in?: any[]; _nin?: any[]; _gt?: any; _gte?: any; _lt?: any; _lte?: any; _contains?: string; _ncontains?: string; _starts_with?: string; _ends_with?: string; _null?: boolean; _nnull?: boolean; };

/**
 * Directus item structure
 */
export interface DirectusItem {
  id: string | number;
  [key: string]: unknown;
}

/**
 * Directus aggregate query
 */
export interface DirectusAggregateQuery {
  aggregate?: {
    count?: string[];
    sum?: string[];
    avg?: string[];
    min?: string[];
    max?: string[];
  };
  groupBy?: string[];
  filter?: DirectusFilter;
}

/**
 * Directus aggregate result
 */
export interface DirectusAggregateResult {
  count?: Record<string, number>;
  sum?: Record<string, number>;
  avg?: Record<string, number>;
  min?: Record<string, number | string>;
  max?: Record<string, number | string>;
  [key: string]: unknown;
}

/**
 * Logger interface
 */
export interface Logger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  debug(message: string, meta?: Record<string, unknown>): void;
}

/**
 * Field metadata from Directus schema
 */
export interface FieldMetadata {
  collection: string;
  field: string;
  type: string;
  schema?: {
    name: string;
    table: string;
    data_type: string;
    is_nullable: boolean;
    is_unique: boolean;
    is_primary_key: boolean;
    has_auto_increment: boolean;
    foreign_key_column?: string;
    foreign_key_table?: string;
  };
  meta?: {
    id: number;
    collection: string;
    field: string;
    special?: string[];
    interface?: string;
    options?: Record<string, unknown>;
    display?: string;
    display_options?: Record<string, unknown>;
    translations?: Array<{
      language: string;
      translation: string;
    }>;
    note?: string;
  };
}

/**
 * Collection metadata from Directus schema
 */
export interface CollectionMetadata {
  collection: string;
  meta?: {
    collection: string;
    icon?: string;
    note?: string;
    display_template?: string;
    hidden: boolean;
    singleton: boolean;
    translations?: Array<{
      language: string;
      translation: string;
    }>;
    accountability?: string;
    color?: string;
    sort_field?: string;
  };
}

/**
 * Request with Directus context
 */
export interface DirectusRequestContext {
  accountability?: Accountability;
  database: Knex;
  logger: Logger;
  schema: any; // DirectusSchema - avoid circular dependency
  services: any; // DirectusServices - avoid circular dependency
}

/**
 * Cache entry structure
 */
export interface CacheEntry<T> {
  value: T;
  ttl: number;
  createdAt: number;
  tags?: string[];
}

/**
 * Error with code
 */
export interface ErrorWithCode extends Error {
  code?: string;
  extensions?: {
    code: string;
    [key: string]: unknown;
  };
}