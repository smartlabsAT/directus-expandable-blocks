import { Knex } from 'knex';
import type { DirectusServices, DirectusSchema, DirectusAccountability } from './directus-api';

/**
 * Configuration for UsageFinderService
 */
export interface UsageFinderConfig {
  /** Database connection */
  database: Knex;
  
  /** Directus services object */
  services: DirectusServices;
  
  /** Optional Directus schema */
  schema?: DirectusSchema;
  
  /** Optional accountability for permissions */
  accountability?: DirectusAccountability;
  
  /** Incoming relations for the collection - REQUIRED for performance */
  incomingRelations: RelationInfo[];
}

/**
 * Represents a location where an item is used
 */
export interface UsageLocation {
  /** Collection containing the reference */
  collection: string;
  
  /** Collection display name */
  collection_name: string;
  
  /** Collection icon */
  collection_icon?: string;
  
  /** ID of the item containing the reference */
  item_id: string | number;
  
  /** Display name of the item */
  item_name: string;
  
  /** Field containing the reference */
  field: string;
  
  /** Field display name */
  field_name: string;
  
  /** Type of relation (M2O, O2M, M2M, M2A) */
  relation_type: 'M2O' | 'O2M' | 'M2M' | 'M2A';
  
  /** For M2M/M2A: junction table name */
  junction_table?: string;
  
  /** For array fields: index in the array */
  array_index?: number;
  
  /** Sort order in the relation */
  sort?: number;
  
  /** Status of the referencing item */
  status?: string;
  
  /** Depth level (0 = direct usage) */
  depth: number;
  
  /** Number of times this item is used in the same context (for duplicates) */
  usage_count?: number;
}

/**
 * Tree structure for hierarchical usage
 */
export interface UsageTree {
  /** The item being analyzed */
  item: {
    collection: string;
    id: string | number;
    display_name: string;
  };
  
  /** Direct usages of this item */
  direct_usages: UsageLocation[];
  
  /** Child nodes (items that use this item) */
  children: UsageTree[];
  
  /** Total count of all usages (direct + indirect) */
  total_usage_count: number;
  
  /** Whether this branch has circular references */
  has_circular_reference: boolean;
  
  /** Path of circular reference if detected */
  circular_path?: string[];
}

/**
 * Options for finding usages
 */
export interface FindUsageOptions {
  /** Maximum depth to search (default: 5) */
  maxDepth?: number;
  
  /** Include draft/archived items (default: true) */
  includeInactive?: boolean;
  
  /** Limit results per collection (default: no limit) */
  limitPerCollection?: number;
  
  /** Collections to exclude from search */
  excludeCollections?: string[];
  
  /** Include item details (default: false) */
  includeItemDetails?: boolean;
  
  /** Include field metadata (default: true) */
  includeFieldMetadata?: boolean;
  
  /** Group duplicate usages from same source (default: true) */
  groupDuplicates?: boolean;
  
  /** Exclude translation references (default: false) */
  excludeTranslations?: boolean;
}

/**
 * Summary statistics for usage
 */
export interface UsageStatistics {
  /** Total number of direct usages */
  direct_count: number;
  
  /** Total number of indirect usages */
  indirect_count: number;
  
  /** Collections that use this item */
  collections_using: string[];
  
  /** Most common usage pattern */
  most_common_field?: string;
  
  /** Depth of deepest usage */
  max_depth: number;
  
  /** Has circular references */
  has_circular_references: boolean;
}

/**
 * Relation information for usage detection
 */
export interface RelationInfo {
  /** Relation ID */
  id: number;
  
  /** Many collection */
  many_collection: string;
  
  /** Many field */
  many_field: string;
  
  /** One collection (null for M2A) */
  one_collection: string | null;
  
  /** One field */
  one_field?: string;
  
  /** Junction field for M2A */
  junction_field?: string;
  
  /** Allowed collections for M2A */
  one_allowed_collections?: string;
  
  /** Collection field for M2A */
  one_collection_field?: string;
}

/**
 * Cache entry for usage results
 */
export interface UsageCacheEntry {
  /** Cache key */
  key: string;
  
  /** Cached result */
  result: UsageLocation[] | UsageTree;
  
  /** Timestamp when cached */
  timestamp: number;
  
  /** Time to live in milliseconds */
  ttl: number;
}