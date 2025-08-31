/**
 * ExpandableBlocks-specific useItemSelector composable
 * 
 * This is a wrapper around the shared useItemSelector that provides
 * expandable-blocks specific configuration and maintains backward compatibility.
 */

import { useItemSelector as useSharedItemSelector } from '../shared/composables/useItemSelector';
import type { ItemSelectorConfig } from '../shared/types/ItemSelectorConfig';
import type { ExpandableBlocksOptions } from '../types';

/**
 * ExpandableBlocks-specific wrapper around the shared useItemSelector
 * Provides backward compatibility and specific configuration for expandable-blocks
 * 
 * @param api Directus API instance
 * @param allowedCollections Optional array of allowed collections
 * @param options ExpandableBlocks specific options
 * @returns ItemSelector state and methods configured for ExpandableBlocks
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
    // Collection icons specific to expandable-blocks (can be customized)
    collectionIcons: {
      // Add any specific collection icon overrides here
      // 'my_collection': 'custom_icon'
    },
    // Field mappings specific to expandable-blocks (can be customized)
    fieldMappings: {
      // Add any field name mappings here
      // 'api_field_name': 'display_field_name'
    },
    // Merge any additional options passed from ExpandableBlocksOptions
    ...options
  };

  // Use the shared implementation with expandable-blocks configuration
  return useSharedItemSelector(api, allowedCollections, config);
}