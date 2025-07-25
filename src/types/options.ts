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
  
  // Permissions
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