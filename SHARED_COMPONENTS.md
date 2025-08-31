# Shared ItemSelector Components

This document describes how to use the shared ItemSelector components from the `directus-extension-expandable-blocks` package in other Directus extensions.

## Overview

The `expandable-blocks` extension provides reusable ItemSelector components that can be used in other extensions like LayoutBlocks. This allows for consistent UX and avoids code duplication.

## Installation

Add the expandable-blocks extension as a dependency in your consuming extension:

```json
{
  "dependencies": {
    "directus-extension-expandable-blocks": "^1.2.0"
  }
}
```

## Basic Usage

### 1. Import Components and Composables

```typescript
import { 
  useItemSelector, 
  ItemSelectorDrawer,
  type ItemSelectorConfig 
} from 'directus-extension-expandable-blocks/shared';
```

### 2. Configure the ItemSelector

```typescript
// In your Vue component or composable
export default {
  setup() {
    const api = useApi(); // Your Directus API instance
    
    const itemSelector = useItemSelector(api, ['pages', 'articles'], {
      loggerPrefix: '[MyExtension]',
      allowLink: true,
      allowDuplicate: false,
      defaultItemsPerPage: 50,
      defaultLanguage: 'en-US',
      collectionIcons: {
        'pages': 'description',
        'articles': 'article'
      }
    });
    
    return {
      itemSelector
    };
  }
};
```

### 3. Use the ItemSelectorDrawer Component

```vue
<template>
  <div>
    <!-- Your extension UI -->
    <v-button @click="openSelector">Select Items</v-button>
    
    <!-- ItemSelector Drawer -->
    <ItemSelectorDrawer
      :open="itemSelector.isOpen.value"
      :collection="itemSelector.selectedCollection.value"
      :collection-name="itemSelector.selectedCollectionName.value"
      :collection-icon="itemSelector.selectedCollectionIcon.value"
      :items="itemSelector.availableItems.value"
      :loading="itemSelector.loading.value"
      :loading-details="itemSelector.loadingDetails.value"
      :current-page="itemSelector.currentPage.value"
      :items-per-page="itemSelector.itemsPerPage.value"
      :total-items="itemSelector.totalItems.value"
      :available-fields="itemSelector.availableFields.value"
      :item-relations="itemSelector.itemRelations.value"
      :api-error="itemSelector.apiError.value"
      :translation-info="itemSelector.translationInfo.value"
      :selected-language="itemSelector.selectedLanguage.value"
      :available-languages="itemSelector.availableLanguages.value"
      :get-translated-field-value="itemSelector.getTranslatedFieldValue"
      :is-field-translatable="itemSelector.isFieldTranslatable"
      :allow-link="true"
      :allow-duplicate="false"
      :sort-field="itemSelector.sortField.value"
      :sort-direction="itemSelector.sortDirection.value"
      :logger-prefix="'[MyExtension]'"
      @close="itemSelector.close"
      @confirm="handleItemsSelected"
      @confirm-copy="handleItemsDuplicated"
      @search="itemSelector.handleSearch"
      @update:current-page="itemSelector.handlePageChange"
      @update:selected-language="updateLanguage"
      @update:sort="itemSelector.updateSort"
      @update:items-per-page="itemSelector.updateItemsPerPage"
    />
  </div>
</template>

<script setup lang="ts">
import { useItemSelector, ItemSelectorDrawer } from 'directus-extension-expandable-blocks/shared';

function openSelector() {
  itemSelector.open('pages');
}

function handleItemsSelected(items: any[]) {
  console.log('Selected items:', items);
  itemSelector.close();
}

function handleItemsDuplicated(items: any[]) {
  console.log('Duplicated items:', items);
  itemSelector.close();
}

function updateLanguage(language: string) {
  itemSelector.selectedLanguage.value = language;
}
</script>
```

## Configuration Options

### ItemSelectorConfig

```typescript
interface ItemSelectorConfig {
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
```

## Available Components

### Core Components
- `ItemSelectorDrawer` - Main selector drawer component
- `ItemSearchPanel` - Search interface with advanced operators
- `ItemSelectorTable` - Table view for items
- `FieldDisplay` - Field value display component
- `FieldSettingsMenu` - Column and display settings

### Utility Components
- `UsagePopover` - Shows where items are used
- `ItemEditDrawer` - Inline item editing

## Available Composables

### useItemSelector

The main composable that provides all ItemSelector functionality:

```typescript
const itemSelector = useItemSelector(api, allowedCollections, config);

// Access reactive state
itemSelector.isOpen.value
itemSelector.selectedCollection.value
itemSelector.availableItems.value
itemSelector.loading.value

// Call methods
itemSelector.open('collection_name')
itemSelector.close()
itemSelector.handleSearch('search query')
```

## Advanced Usage Examples

### 1. Custom API Client

```typescript
import { createApiClient } from 'directus-extension-expandable-blocks/shared';

const customApiClient = createApiClient(api, {
  // Custom configuration
});

const itemSelector = useItemSelector(api, collections, {
  apiClient: customApiClient,
  loggerPrefix: '[CustomExtension]'
});
```

### 2. Multi-language Support

```typescript
const itemSelector = useItemSelector(api, collections, {
  defaultLanguage: 'de-DE',
  loggerPrefix: '[MultiLangExtension]'
});

// Language will be automatically detected from available languages
// or you can set it manually
itemSelector.selectedLanguage.value = 'fr-FR';
```

### 3. Custom Collection Icons

```typescript
const itemSelector = useItemSelector(api, collections, {
  collectionIcons: {
    'blog_posts': 'article',
    'products': 'inventory',
    'categories': 'folder'
  }
});
```

### 4. Field Mappings

```typescript
const itemSelector = useItemSelector(api, collections, {
  fieldMappings: {
    'internal_name': 'Display Name',
    'created_by': 'Author'
  }
});
```

## Event Handling

The ItemSelectorDrawer emits several events:

```typescript
// Required events
@close - Drawer close request
@confirm - Items selected for linking (receives array of items)
@confirm-copy - Items selected for duplication (receives array of items)

// Optional events  
@search - Search query changed
@update:current-page - Page changed
@update:selected-language - Language changed
@update:sort - Sorting changed
@update:items-per-page - Items per page changed
```

## Logging and Debugging

Enable debug logging to troubleshoot issues:

```typescript
const itemSelector = useItemSelector(api, collections, {
  debug: true,
  loggerPrefix: '[MyExtension Debug]'
});
```

This will output detailed logs for:
- API requests and responses
- State changes
- User interactions
- Performance metrics
- Error details

## TypeScript Support

Full TypeScript support is included with type definitions for all components and composables:

```typescript
import type { 
  ItemSelectorConfig,
  ItemSelectorReturn,
  TranslationInfo,
  FieldWithTranslation 
} from 'directus-extension-expandable-blocks/shared';
```

## Backward Compatibility

The shared components are designed to be backward compatible. The original `expandable-blocks` extension continues to work unchanged, as it uses these shared components internally with its own configuration.

## Version Compatibility

- `expandable-blocks` v1.2.0+: Full shared component support
- Directus v11.0.0+: Required for all functionality
- Vue 3.3+: Required for composition API features

## Troubleshooting

### Common Issues

1. **Import errors**: Make sure `directus-extension-expandable-blocks` is installed as a dependency
2. **Type errors**: Check that your TypeScript configuration supports the shared types
3. **Build errors**: Ensure your build system can handle the shared component dependencies
4. **Runtime errors**: Enable debug logging to see detailed error information

### Getting Help

- Check the GitHub issues: https://github.com/smartlabsAT/directus-expandable-blocks/issues
- Review the main extension documentation
- Enable debug logging for detailed error information

## Examples Repository

For complete working examples of consuming extensions, see:
- [Example LayoutBlocks Extension] (coming soon)
- [Example ContentBuilder Extension] (coming soon)

## Contributing

If you find issues with the shared components or want to suggest improvements, please:
1. Open an issue on GitHub
2. Submit a pull request with your changes
3. Update the documentation for new features

## License

The shared components inherit the same MIT license as the main expandable-blocks extension.