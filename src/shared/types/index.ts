// Export all shared types
export type { ItemSelectorConfig } from './ItemSelectorConfig';
export { DEFAULT_ITEM_SELECTOR_CONFIG } from './ItemSelectorConfig';

// Re-export commonly used types from the main extension
export type {
  TranslationInfo,
  FieldWithTranslation,
  LanguageOption,
  ExpandableBlocksOptions
} from '../../types';

export type {
  IDirectusApiClient,
  SearchOptions,
  CollectionMetadata
} from '../../services/api-client.types';