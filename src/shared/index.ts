/**
 * Shared components and composables for reuse in other Directus extensions
 * 
 * This module exports the ItemSelector functionality from expandable-blocks
 * for use in other extensions like LayoutBlocks.
 * 
 * @example
 * ```typescript
 * // In consuming extension
 * import { 
 *   useItemSelector, 
 *   ItemSelectorDrawer,
 *   type ItemSelectorConfig 
 * } from 'directus-extension-expandable-blocks/shared';
 * 
 * // Configure for specific extension
 * const itemSelector = useItemSelector(api, allowedCollections, {
 *   loggerPrefix: '[LayoutBlocks]',
 *   allowLink: true,
 *   allowDuplicate: false
 * });
 * ```
 */

// Export types first
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

// Export composables
export { useItemSelector } from './composables/useItemSelector';

// Export utilities
export { 
  createScopedLogger,
  logDebug,
  logError,
  logWarn,
  logAction,
  logStateChange,
  logEvent,
  logInit,
  logLifecycle,
  logData,
  logPerformance
} from './utils/logger';

// Export components
export { default as ItemSelectorDrawer } from './components/ItemSelectorDrawer.vue';
export { default as ItemSearchPanel } from './components/ItemSearchPanel.vue';
export { default as FieldDisplay } from './components/FieldDisplay.vue';
export { default as UsagePopover } from './components/UsagePopover.vue';
export { default as FieldSettingsMenu } from './components/FieldSettingsMenu.vue';
export { default as ItemEditDrawer } from './components/ItemEditDrawer.vue';
export { default as ItemSelectorTable } from './components/ItemSelectorTable.vue';

/**
 * Version information for shared components
 */
export const SHARED_VERSION = '1.2.0';