/**
 * Legacy useItemSelector - kept for reference
 * The actual implementation is now in src/shared/composables/useItemSelector.ts
 * This file is preserved for comparison and migration purposes
 */

import { useItemSelector as useSharedItemSelector } from '../shared/composables/useItemSelector';
import type { ItemSelectorConfig } from '../shared/types/ItemSelectorConfig';
import type { ExpandableBlocksOptions } from '../types';

/**
 * ExpandableBlocks-specific wrapper around the shared useItemSelector
 * Provides backward compatibility and specific configuration for expandable-blocks
 */
export function useItemSelector(
  api: any, 
  allowedCollections?: string[], 
  options?: ExpandableBlocksOptions
) {
  // Configure shared ItemSelector with expandable-blocks specific settings
  const config: ItemSelectorConfig = {
    loggerPrefix: '[ExpandableBlocks]',
    allowLink: true,
    allowDuplicate: true,
    defaultItemsPerPage: 100,
    defaultLanguage: 'en-US',
    debug: false,
    // Add any expandable-blocks specific configurations here
    ...options
  };

  // Use the shared implementation with expandable-blocks configuration
  return useSharedItemSelector(api, allowedCollections, config);
}