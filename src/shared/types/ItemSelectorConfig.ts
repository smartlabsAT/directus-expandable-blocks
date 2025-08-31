import type { IDirectusApiClient } from '../../services/api-client.types';

/**
 * Configuration interface for ItemSelector components
 * Allows consuming extensions to customize behavior
 */
export interface ItemSelectorConfig {
  /**
   * Logger prefix for debugging messages
   * @default '[ItemSelector]'
   */
  loggerPrefix?: string;
  
  /**
   * Custom API client for data operations
   * If not provided, will use the default Directus API
   */
  apiClient?: IDirectusApiClient;
  
  /**
   * Whether to allow linking to existing items
   * @default true
   */
  allowLink?: boolean;
  
  /**
   * Whether to allow duplicating existing items
   * @default true
   */
  allowDuplicate?: boolean;
  
  /**
   * Default items per page for pagination
   * @default 100
   */
  defaultItemsPerPage?: number;
  
  /**
   * Default language for translations
   * @default 'en-US'
   */
  defaultLanguage?: string;
  
  /**
   * Custom field mappings for display
   * Allows consuming extensions to map field names
   */
  fieldMappings?: Record<string, string>;
  
  /**
   * Custom collection icons mapping
   * Allows overriding default collection icons
   */
  collectionIcons?: Record<string, string>;
  
  /**
   * Enable debug logging
   * @default false
   */
  debug?: boolean;
}

/**
 * Default configuration for ItemSelector
 */
export const DEFAULT_ITEM_SELECTOR_CONFIG: Required<ItemSelectorConfig> = {
  loggerPrefix: '[ItemSelector]',
  apiClient: null as any, // Will be set at runtime
  allowLink: true,
  allowDuplicate: true,
  defaultItemsPerPage: 100,
  defaultLanguage: 'en-US',
  fieldMappings: {},
  collectionIcons: {},
  debug: false
};