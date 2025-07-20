import { Knex } from 'knex';

/**
 * Represents a possible location where an item from a collection can be used
 */
export interface PossibleUsageLocation {
  /** The collection that references our target collection */
  collection: string;
  
  /** Human-readable name of the collection */
  collection_name: string;
  
  /** Icon for the collection (from directus_collections) */
  collection_icon: string;
  
  /** Field names in that collection that reference our target */
  fields: string[];
  
  /** Additional relation details for each field */
  relation_details?: RelationDetail[];
}

/**
 * Detailed information about a specific relation
 */
export interface RelationDetail {
  /** The field name in the parent collection */
  field: string;
  
  /** Human-readable field name */
  field_name?: string;
  
  /** Type of relation for this specific field */
  relation_type: RelationType;
  
  /** The junction table (for M2A/M2M) */
  junction_table?: string;
  
  /** Field in junction table that points to parent */
  junction_field?: string;
  
  /** Field in junction table that contains item ID */
  item_field?: string;
  
  /** Field in junction table that contains collection name (M2A) */
  collection_field?: string;
  
  /** Sort field in junction table */
  sort_field?: string;
  
  /** The relation ID from directus_relations */
  relation_id?: number;
}

/**
 * Types of relations in Directus
 */
export type RelationType = 'M2A' | 'M2O' | 'O2M' | 'M2M' | 'O2O';

/**
 * Raw row from directus_relations table
 */
export interface DirectusRelationRow {
  id: number;
  many_collection: string | null;
  many_field: string | null;
  one_collection: string | null;
  one_field?: string | null;
  one_collection_field: string | null;
  one_allowed_collections: string | null;
  junction_field: string | null;
  sort_field: string | null;
  one_deselect_action: string;
  meta: any; // Can be string (JSON) or object
}

/**
 * Metadata for a collection from directus_collections
 */
export interface CollectionMetadata {
  collection: string;
  name: string;
  icon: string;
  display_template?: string;
  hidden?: boolean;
  singleton?: boolean;
}

/**
 * Internal structure for building usage map
 */
export interface UsageMapEntry {
  fields: Set<string>;
  relation_details: Map<string, RelationDetail>;
}

/**
 * Configuration for RelationAnalyzer
 */
export interface RelationAnalyzerConfig {
  /** Database connection */
  database: Knex;
  
  // TODO: Implement these features in future versions
  /** Optional: Collections to exclude from analysis */
  // excludeCollections?: string[];
  
  /** Optional: Enable caching */
  // enableCache?: boolean;
  
  /** Optional: Cache TTL in seconds */
  // cacheTTL?: number;
}

/**
 * Result of analyzing a specific relation
 */
export interface AnalyzedRelation {
  /** Source collection (the one being referenced) */
  sourceCollection: string;
  
  /** Target collection (the one doing the referencing) */
  targetCollection: string;
  
  /** Field name in target collection */
  fieldName: string;
  
  /** Junction table name (for M2A/M2M) */
  junctionTable?: string;
  
  /** Type of relation */
  relationType: RelationType;
  
  /** Additional metadata */
  meta?: {
    sortField?: string;
    oneDeselectAction?: string;
    displayTemplate?: string;
  };
}

/**
 * Cache entry for relation analysis
 */
export interface RelationCacheEntry {
  data: PossibleUsageLocation[];
  timestamp: number;
  collection: string;
}

/**
 * Options for getPossibleUsageLocations method
 */
export interface GetUsageLocationsOptions {
  /** Include hidden collections */
  includeHidden?: boolean;
  
  /** Include system collections */
  includeSystem?: boolean;
  
  /** Force refresh (ignore cache) */
  forceRefresh?: boolean;
}

/**
 * Helper type for junction table analysis
 */
export interface JunctionTableInfo {
  tableName: string;
  parentCollection: string;
  parentField: string;
  itemField: string;
  collectionField: string;
}

/**
 * Type guards
 */
export const isM2ARelation = (rel: DirectusRelationRow): boolean => {
  return rel.one_collection === null && 
         rel.one_allowed_collections !== null &&
         rel.one_collection_field === 'collection';
};

export const isM2ORelation = (rel: DirectusRelationRow): boolean => {
  return rel.one_collection !== null && 
         rel.many_collection !== null && 
         rel.many_field !== null &&
         !rel.junction_field;
};

export const isM2MRelation = (rel: DirectusRelationRow): boolean => {
  return rel.one_collection !== null && 
         rel.many_collection !== null && 
         rel.junction_field !== null &&
         !rel.one_collection_field;
};

/**
 * Metadata structure parsed from JSON fields
 */
export interface ParsedMetadata {
  display?: string;
  name?: string;
  icon?: string;
  display_template?: string;
  one_field?: string;
  [key: string]: any;
}

/**
 * Constants
 */
export const SYSTEM_COLLECTIONS = [
  'directus_activity',
  'directus_collections',
  'directus_fields',
  'directus_files',
  'directus_folders',
  'directus_migrations',
  'directus_permissions',
  'directus_presets',
  'directus_relations',
  'directus_revisions',
  'directus_roles',
  'directus_settings',
  'directus_users',
  'directus_webhooks'
];

export const EXCLUDED_FIELDS = [
  'user_created',
  'user_updated',
  'date_created', 
  'date_updated',
  'id'
];

export const DEFAULT_COLLECTION_ICON = 'box';
export const DEFAULT_CACHE_TTL = 300; // 5 minutes

// Special IDs
export const SYNTHETIC_RELATION_ID = -1;

// Database limits
export const POSTGRES_TABLE_NAME_LIMIT = 64;

// Regex patterns
export const VALID_TABLE_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;