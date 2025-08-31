/**
 * TypeScript declarations for shared components
 * Manual definitions for consuming extensions
 */

import type { Component } from 'vue';

// Re-export types from main types
export type {
  ItemSelectorConfig,
  TranslationInfo,
  FieldWithTranslation,
  LanguageOption,
  ExpandableBlocksOptions,
  IDirectusApiClient,
  SearchOptions,
  CollectionMetadata
} from './types';

export { DEFAULT_ITEM_SELECTOR_CONFIG } from './types';

// Composable types
export interface ItemSelectorReturn {
  // Configuration
  config: ItemSelectorConfig;
  
  // State
  isOpen: import('vue').Ref<boolean>;
  selectedCollection: import('vue').Ref<string | null>;
  selectedCollectionName: import('vue').Ref<string | null>;
  selectedCollectionIcon: import('vue').Ref<string | null>;
  searchQuery: import('vue').Ref<string>;
  availableItems: import('vue').Ref<any[]>;
  loading: import('vue').Ref<boolean>;
  loadingDetails: import('vue').Ref<boolean>;
  availableFields: import('vue').Ref<FieldWithTranslation[]>;
  itemRelations: import('vue').Ref<Record<string, any[]>>;
  loadingRelations: import('vue').Ref<boolean>;
  apiError: import('vue').Ref<string | null>;
  
  // Translation state
  translationInfo: import('vue').Ref<TranslationInfo | null>;
  selectedLanguage: import('vue').Ref<string>;
  availableLanguages: import('vue').Ref<LanguageOption[]>;

  // Pagination
  currentPage: import('vue').Ref<number>;
  itemsPerPage: import('vue').Ref<number>;
  totalItems: import('vue').Ref<number>;
  
  // Sorting
  sortField: import('vue').Ref<string | null>;
  sortDirection: import('vue').Ref<'asc' | 'desc'>;

  // Methods
  open: (collection: string, userPrefs?: any) => Promise<void>;
  close: () => void;
  loadItems: () => Promise<void>;
  handleSearch: (query: string) => void;
  handlePageChange: (page: number) => void;
  getTranslatedFieldValue: (item: any, field: string, language?: string) => string;
  isFieldTranslatable: (field: string) => boolean;
  updateSort: (field: string | null, direction: 'asc' | 'desc') => void;
  updateItemsPerPage: (value: number) => void;
}

// Composable function type
export declare function useItemSelector(
  api: any,
  allowedCollections?: string[],
  config?: ItemSelectorConfig
): ItemSelectorReturn;

// Component types
export declare const ItemSelectorDrawer: Component;
export declare const ItemSearchPanel: Component;
export declare const FieldDisplay: Component;
export declare const UsagePopover: Component;
export declare const FieldSettingsMenu: Component;
export declare const ItemEditDrawer: Component;
export declare const ItemSelectorTable: Component;

// Logger types
export interface ScopedLogger {
  log: (message: string, context?: any) => void;
  debug: (message: string, context?: any) => void;
  error: (message: string, error?: Error | any, context?: any) => void;
  warn: (message: string, context?: any) => void;
  action: (message: string, context?: any) => void;
  stateChange: (property: string, oldValue: any, newValue: any) => void;
  event: (eventName: string, context?: any) => void;
  init: (componentName: string, context?: any) => void;
  lifecycle: (componentName: string, lifecycle: string, context?: any) => void;
  data: (operation: string, context?: any) => void;
  performance: (operation: string, timeMs: number, context?: any) => void;
}

export declare function createScopedLogger(prefix?: string): ScopedLogger;

// Logger functions
export declare function logDebug(message: string, context?: any): void;
export declare function logError(message: string, error?: Error | any, context?: any): void;
export declare function logWarn(message: string, context?: any): void;
export declare function logAction(message: string, context?: any): void;
export declare function logStateChange(property: string, oldValue: any, newValue: any): void;
export declare function logEvent(eventName: string, context?: any): void;
export declare function logInit(componentName: string, context?: any): void;
export declare function logLifecycle(componentName: string, lifecycle: string, context?: any): void;
export declare function logData(operation: string, context?: any): void;
export declare function logPerformance(operation: string, timeMs: number, context?: any): void;

// Version
export declare const SHARED_VERSION: string;