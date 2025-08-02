/**
 * Configuration options for the expandable-blocks extension
 */

export interface ExpandableBlocksOptions {
  // Display Options
  enableSorting?: boolean;
  startExpanded?: boolean;
  accordionMode?: boolean;
  showFieldsFilter?: string[];
  compactMode?: boolean;
  showItemId?: boolean;
  showCollectionName?: boolean;
  
  // Collection Options
  allowedCollections?: string[];
  includeCollections?: string[];
  allowedCollectionsForExisting?: string[];
  
  // Permissions
  isAllowedDelete?: boolean;
  isAllowedDuplicate?: boolean;
  maxBlocks?: number | null;
  allowLinkExisting?: boolean;
  allowDuplicateExisting?: boolean;
  
  // Role-based Permissions
  rolesCanChangeStatus?: string[];
  rolesCanSort?: string[];
  rolesCanAddBlocks?: string[];
  rolesCanDelete?: string[];
  rolesCanDuplicate?: string[];
  
  // AI Configuration
  enableAI?: boolean;
  aiProvider?: 'openai' | 'claude' | 'custom';
  aiApiKey?: string;
  aiModel?: string;
  aiTemperature?: number;
  aiMaxTokens?: number;
  aiCustomUrl?: string;
  
  // Cache Configuration
  enableCache?: boolean;
}