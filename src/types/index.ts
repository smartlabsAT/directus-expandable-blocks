/**
 * Type definitions for the expandable-blocks extension
 */

export interface ExpandableBlocksOptions {
  enableSorting?: boolean;
  startExpanded?: boolean;
  accordionMode?: boolean;
  showFieldsFilter?: string[];
  compactMode?: boolean;
  allowedCollections?: string[];
  showItemId?: boolean;
  isAllowedDelete?: boolean;
  isAllowedDuplicate?: boolean;
  maxBlocks?: number | null;
  
  // AI Configuration
  enableAI?: boolean;
  aiProvider?: 'openai' | 'claude' | 'custom';
  aiApiKey?: string;
  aiModel?: string;
  aiTemperature?: number;
  aiMaxTokens?: number;
  aiCustomUrl?: string;
}

export interface JunctionRecord {
  id: string | number;
  collection: string;
  item: string | number | ItemRecord;
  sort?: number;
  [foreignKey: string]: any;
}

export interface ItemRecord {
  id: string | number;
  title?: string;
  name?: string;
  headline?: string;
  label?: string;
  heading?: string;
  status?: 'published' | 'draft' | 'archived';
  [key: string]: any;
}

export interface CollectionInfo {
  collection: string;
  name: string;
  meta?: {
    icon?: string;
    [key: string]: any;
  };
}

export interface RelationInfo {
  collection: string;
  field: string;
  related_collection?: string | null;
  meta?: {
    one_allowed_collections?: string[] | string | null;
    junction_field?: string;
    sort_field?: string;
    [key: string]: any;
  };
  junctionCollection?: string;
  foreignKeyField?: string;
  sort_field?: string;
}

// Re-export Directus types
export * from './directus';