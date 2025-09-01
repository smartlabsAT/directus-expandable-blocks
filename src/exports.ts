/**
 * Exports for use by other extensions
 * This file exports the shared components that other extensions can use
 */

// Export composables
export { useItemSelector } from './composables/useItemSelector';

// Export the main component that other extensions need
export { default as ItemSelectorDrawer } from './components/ItemSelectorDrawer.vue';

// Export types
export type { 
  ItemSelectorConfig,
  TranslationInfo,
  FieldWithTranslation,
  LanguageOption
} from './shared/types';

export { DEFAULT_ITEM_SELECTOR_CONFIG } from './shared/types';