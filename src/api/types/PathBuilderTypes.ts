import { Knex } from 'knex';
import { UsageFinderService } from '../services/UsageFinderService';
import type { CacheService } from './CacheTypes';
import type { DirectusServices, DirectusSchema, DirectusAccountability } from './directus-api';

/**
 * Configuration for PathBuilderService
 */
export interface PathBuilderConfig {
  /** Database connection */
  database: Knex;
  
  /** Directus services object */
  services: DirectusServices;
  
  /** Optional Directus schema */
  schema?: DirectusSchema;
  
  /** Optional accountability for permissions */
  accountability?: DirectusAccountability;
  
  /** Default locale for formatting */
  defaultLocale?: string;
  
  /** UsageFinderService instance - REQUIRED for performance */
  usageFinder: UsageFinderService;
  
  /** CacheService instance for caching path operations */
  cache: CacheService;
}

/**
 * Represents a single step in a path
 */
export interface PathStep {
  /** Collection name */
  collection: string;
  
  /** Collection display name */
  collection_name: string;
  
  /** Item ID */
  id: string | number;
  
  /** Item display name */
  name: string;
  
  /** Field used to reach this step (null for root) */
  field: string | null;
  
  /** Field display name */
  field_name?: string;
  
  /** Relation type used */
  relation_type?: 'M2O' | 'O2M' | 'M2M' | 'M2A';
  
  /** Icon for the collection */
  icon?: string;
  
  /** Status of the item */
  status?: string;
  
  /** URL to access this item in Directus */
  admin_url?: string;
}

/**
 * Complete usage path
 */
export interface UsagePath {
  /** Starting point (the item being used) */
  from: PathStep;
  
  /** Ending point (where it's used) */
  to: PathStep;
  
  /** All steps in the path */
  steps: PathStep[];
  
  /** Formatted path string */
  formatted: string;
  
  /** Short formatted path (collection names only) */
  short_formatted: string;
  
  /** Path depth */
  depth: number;
  
  /** Whether this is a direct usage (depth = 1) */
  is_direct: boolean;
}

/**
 * Breadcrumb for navigation
 */
export interface Breadcrumb {
  /** Display label */
  label: string;
  
  /** Collection */
  collection: string;
  
  /** Item ID */
  id: string | number;
  
  /** URL to navigate to */
  url?: string;
  
  /** Icon */
  icon?: string;
  
  /** Whether this is the current item */
  is_current: boolean;
}

/**
 * Options for building paths
 */
export interface PathBuildOptions {
  /** Include collection names in path (default: true) */
  includeCollections?: boolean;
  
  /** Include field names in path (default: true) */
  includeFields?: boolean;
  
  /** Include item IDs in path (default: false) */
  includeIds?: boolean;
  
  /** Maximum length for item names (default: 50) */
  maxNameLength?: number;
  
  /** Separator for path segments (default: ' → ') */
  separator?: string;
  
  /** Format for displaying items (default: '{name}') */
  itemFormat?: string;
  
  /** Generate admin URLs (default: false) */
  includeAdminUrls?: boolean;
  
  /** Base URL for admin panel */
  adminBaseUrl?: string;
}

/**
 * Path formatting options
 */
export interface PathFormatOptions extends Partial<PathBuildOptions> {
  /** Locale for formatting */
  locale?: string;
  
  /** Use icons in path (default: false) */
  useIcons?: boolean;
  
  /** Path style: 'full', 'short', 'breadcrumb' */
  style?: 'full' | 'short' | 'breadcrumb';
  
  /** HTML output (default: false) */
  html?: boolean;
  
  /** Custom templates for formatting */
  templates?: {
    step?: string;
    separator?: string;
    collection?: string;
    field?: string;
  };
}

/**
 * Collection of paths for an item
 */
export interface PathCollection {
  /** The item */
  item: {
    collection: string;
    id: string | number;
    display_name: string;
  };
  
  /** All usage paths */
  paths: UsagePath[];
  
  /** Paths grouped by collection */
  by_collection: Record<string, UsagePath[]>;
  
  /** Shortest path to each collection */
  shortest_paths: Record<string, UsagePath>;
  
  /** Statistics */
  stats: {
    total_paths: number;
    unique_collections: number;
    max_depth: number;
    average_depth: number;
  };
}

/**
 * Path visualization data
 */
export interface PathVisualization {
  /** Nodes in the graph */
  nodes: {
    id: string;
    label: string;
    collection: string;
    type: 'item' | 'collection';
    level: number;
  }[];
  
  /** Edges connecting nodes */
  edges: {
    from: string;
    to: string;
    label: string;
    type: 'usage' | 'contains';
  }[];
  
  /** Layout hints */
  layout: {
    direction: 'TB' | 'LR' | 'BT' | 'RL';
    spacing: number;
  };
}

/**
 * Template context for path formatting
 */
export interface PathTemplateContext {
  /** Current step */
  step: PathStep;
  
  /** Step index */
  index: number;
  
  /** Total steps */
  total: number;
  
  /** Is first step */
  is_first: boolean;
  
  /** Is last step */
  is_last: boolean;
  
  /** Previous step */
  previous?: PathStep;
  
  /** Next step */
  next?: PathStep;
}