/**
 * Tests for shared useItemSelector composable
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useItemSelector } from '../../../src/shared/composables/useItemSelector';
import type { ItemSelectorConfig } from '../../../src/shared/types/ItemSelectorConfig';

// Mock dependencies
vi.mock('@directus/extensions-sdk', () => ({
  useStores: () => ({
    useCollectionsStore: () => ({
      getCollection: vi.fn((name: string) => ({
        name: name,
        meta: {
          icon: 'box'
        }
      }))
    })
  })
}));

vi.mock('../../../src/services/api-client', () => ({
  createApiClient: vi.fn(() => ({
    getCollectionMetadata: vi.fn().mockResolvedValue({
      fields: [],
      translations: null
    }),
    searchItems: vi.fn().mockResolvedValue({
      data: [],
      meta: { filter_count: 0 }
    }),
    loadItemsWithRelations: vi.fn().mockResolvedValue([])
  }))
}));

vi.mock('../../../src/utils/error-helpers', () => ({
  handleApiError: vi.fn((error) => error.message || 'API Error')
}));

vi.mock('../../../src/shared/utils/logger', () => ({
  createScopedLogger: vi.fn(() => ({
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    log: vi.fn()
  }))
}));

describe('useItemSelector (Shared)', () => {
  let mockApi: any;
  
  beforeEach(() => {
    mockApi = {
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn()
    };
    
    vi.clearAllMocks();
  });

  it('should initialize with default configuration', () => {
    const itemSelector = useItemSelector(mockApi);
    
    expect(itemSelector.config.loggerPrefix).toBe('[ItemSelector]');
    expect(itemSelector.config.allowLink).toBe(true);
    expect(itemSelector.config.allowDuplicate).toBe(true);
    expect(itemSelector.config.defaultItemsPerPage).toBe(100);
    expect(itemSelector.config.defaultLanguage).toBe('en-US');
  });

  it('should accept custom configuration', () => {
    const config: ItemSelectorConfig = {
      loggerPrefix: '[TestExtension]',
      allowLink: false,
      allowDuplicate: true,
      defaultItemsPerPage: 50,
      defaultLanguage: 'de-DE',
      debug: true,
      collectionIcons: {
        'test_collection': 'test_icon'
      },
      fieldMappings: {
        'api_field': 'Display Field'
      }
    };

    const itemSelector = useItemSelector(mockApi, ['test_collection'], config);
    
    expect(itemSelector.config.loggerPrefix).toBe('[TestExtension]');
    expect(itemSelector.config.allowLink).toBe(false);
    expect(itemSelector.config.allowDuplicate).toBe(true);
    expect(itemSelector.config.defaultItemsPerPage).toBe(50);
    expect(itemSelector.config.defaultLanguage).toBe('de-DE');
    expect(itemSelector.config.debug).toBe(true);
    expect(itemSelector.config.collectionIcons).toEqual({ 'test_collection': 'test_icon' });
    expect(itemSelector.config.fieldMappings).toEqual({ 'api_field': 'Display Field' });
  });

  it('should return reactive state properties', () => {
    const itemSelector = useItemSelector(mockApi);
    
    // Check that all expected reactive properties exist
    expect(itemSelector.isOpen).toBeDefined();
    expect(itemSelector.selectedCollection).toBeDefined();
    expect(itemSelector.selectedCollectionName).toBeDefined();
    expect(itemSelector.selectedCollectionIcon).toBeDefined();
    expect(itemSelector.searchQuery).toBeDefined();
    expect(itemSelector.availableItems).toBeDefined();
    expect(itemSelector.loading).toBeDefined();
    expect(itemSelector.loadingDetails).toBeDefined();
    expect(itemSelector.availableFields).toBeDefined();
    expect(itemSelector.itemRelations).toBeDefined();
    expect(itemSelector.apiError).toBeDefined();
    
    // Translation state
    expect(itemSelector.translationInfo).toBeDefined();
    expect(itemSelector.selectedLanguage).toBeDefined();
    expect(itemSelector.availableLanguages).toBeDefined();
    
    // Pagination
    expect(itemSelector.currentPage).toBeDefined();
    expect(itemSelector.itemsPerPage).toBeDefined();
    expect(itemSelector.totalItems).toBeDefined();
    
    // Sorting
    expect(itemSelector.sortField).toBeDefined();
    expect(itemSelector.sortDirection).toBeDefined();
  });

  it('should return expected methods', () => {
    const itemSelector = useItemSelector(mockApi);
    
    expect(typeof itemSelector.open).toBe('function');
    expect(typeof itemSelector.close).toBe('function');
    expect(typeof itemSelector.loadItems).toBe('function');
    expect(typeof itemSelector.handleSearch).toBe('function');
    expect(typeof itemSelector.handlePageChange).toBe('function');
    expect(typeof itemSelector.getTranslatedFieldValue).toBe('function');
    expect(typeof itemSelector.isFieldTranslatable).toBe('function');
    expect(typeof itemSelector.updateSort).toBe('function');
    expect(typeof itemSelector.updateItemsPerPage).toBe('function');
  });

  it('should initialize with default language from config', () => {
    const config: ItemSelectorConfig = {
      defaultLanguage: 'fr-FR'
    };

    const itemSelector = useItemSelector(mockApi, [], config);
    
    expect(itemSelector.selectedLanguage.value).toBe('fr-FR');
  });

  it('should initialize items per page from config', () => {
    const config: ItemSelectorConfig = {
      defaultItemsPerPage: 25
    };

    const itemSelector = useItemSelector(mockApi, [], config);
    
    expect(itemSelector.itemsPerPage.value).toBe(25);
  });

  it('should handle close method correctly', () => {
    const itemSelector = useItemSelector(mockApi);
    
    // Set some state
    itemSelector.isOpen.value = true;
    itemSelector.selectedCollection.value = 'test';
    
    itemSelector.close();
    
    expect(itemSelector.isOpen.value).toBe(false);
  });

  it('should handle search method correctly', () => {
    const itemSelector = useItemSelector(mockApi);
    
    itemSelector.handleSearch('test query');
    
    expect(itemSelector.searchQuery.value).toBe('test query');
    expect(itemSelector.currentPage.value).toBe(1); // Should reset to first page
  });

  it('should handle page change correctly', () => {
    const itemSelector = useItemSelector(mockApi);
    
    itemSelector.handlePageChange(3);
    
    expect(itemSelector.currentPage.value).toBe(3);
  });

  it('should handle sort update correctly', () => {
    const itemSelector = useItemSelector(mockApi);
    
    itemSelector.updateSort('title', 'desc');
    
    expect(itemSelector.sortField.value).toBe('title');
    expect(itemSelector.sortDirection.value).toBe('desc');
    expect(itemSelector.currentPage.value).toBe(1); // Should reset to first page
  });

  it('should handle items per page update correctly', () => {
    const itemSelector = useItemSelector(mockApi);
    
    itemSelector.updateItemsPerPage(200);
    
    expect(itemSelector.itemsPerPage.value).toBe(200);
    expect(itemSelector.currentPage.value).toBe(1); // Should reset to first page
  });

  it('should use custom collection icon when provided', async () => {
    const config: ItemSelectorConfig = {
      collectionIcons: {
        'test_collection': 'custom_icon'
      }
    };

    const itemSelector = useItemSelector(mockApi, [], config);
    
    await itemSelector.open('test_collection');
    
    expect(itemSelector.selectedCollectionIcon.value).toBe('custom_icon');
  });

  it('should fall back to default collection icon when not provided', async () => {
    const itemSelector = useItemSelector(mockApi);
    
    await itemSelector.open('test_collection');
    
    expect(itemSelector.selectedCollectionIcon.value).toBe('box'); // From mocked collectionsStore
  });

  it('should return non-translatable field value directly', () => {
    const itemSelector = useItemSelector(mockApi);
    
    const item = { title: 'Test Title', description: 'Test Description' };
    const result = itemSelector.getTranslatedFieldValue(item, 'title');
    
    expect(result).toBe('Test Title');
  });

  it('should return empty string for missing field', () => {
    const itemSelector = useItemSelector(mockApi);
    
    const item = { title: 'Test Title' };
    const result = itemSelector.getTranslatedFieldValue(item, 'missing_field');
    
    expect(result).toBe('');
  });

  it('should return false for non-translatable field', () => {
    const itemSelector = useItemSelector(mockApi);
    
    const result = itemSelector.isFieldTranslatable('title');
    
    expect(result).toBe(false);
  });

  it('should merge configuration with defaults correctly', () => {
    const partialConfig: ItemSelectorConfig = {
      loggerPrefix: '[CustomExtension]',
      allowLink: false
      // Other properties should use defaults
    };

    const itemSelector = useItemSelector(mockApi, [], partialConfig);
    
    expect(itemSelector.config.loggerPrefix).toBe('[CustomExtension]');
    expect(itemSelector.config.allowLink).toBe(false);
    expect(itemSelector.config.allowDuplicate).toBe(true); // Default
    expect(itemSelector.config.defaultItemsPerPage).toBe(100); // Default
    expect(itemSelector.config.defaultLanguage).toBe('en-US'); // Default
  });
});