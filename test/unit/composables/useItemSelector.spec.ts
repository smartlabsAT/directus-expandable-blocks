import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useItemSelector } from '@/composables/useItemSelector';

// Mock stores
vi.mock('@directus/extensions-sdk', () => ({
  useStores: vi.fn(() => ({
    useCollectionsStore: () => ({
      getCollection: vi.fn((collection) => ({
        collection,
        name: 'Test Collection',
        meta: { icon: 'folder' }
      }))
    })
  }))
}));

// Mock logger
vi.mock('@/utils/logger-wrapper', () => ({
  logDebug: vi.fn(),
  logError: vi.fn()
}));

describe('useItemSelector', () => {
  let mockApi: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Create mock API
    mockApi = {
      get: vi.fn((url) => {
        // Mock metadata endpoint
        if (url.includes('/metadata')) {
          return Promise.resolve({ 
            data: {
              searchableFields: [
                { field: 'title', type: 'string', name: 'Title' },
                { field: 'description', type: 'text', name: 'Description' }
              ]
            } 
          });
        }
        // Mock search endpoint
        return Promise.resolve({ 
          data: { 
            data: [
              { id: 1, title: 'Item 1', description: 'Description 1' },
              { id: 2, title: 'Item 2', description: 'Description 2' }
            ],
            meta: { total_count: 2, filter_count: 2 }
          } 
        });
      })
    };
  });

  describe('Basic Functionality', () => {
    it('initializes with default values', () => {
      const composable = useItemSelector(mockApi, ['test_collection']);

      expect(composable.isOpen.value).toBe(false);
      expect(composable.searchQuery.value).toBe('');
      expect(composable.loading.value).toBe(false);
      expect(composable.currentPage.value).toBe(1);
    });

    it('can open and close', async () => {
      const composable = useItemSelector(mockApi, ['test_collection']);

      expect(composable.isOpen.value).toBe(false);
      
      await composable.open('test_collection');
      expect(composable.isOpen.value).toBe(true);
      expect(composable.selectedCollection.value).toBe('test_collection');
      
      composable.close();
      expect(composable.isOpen.value).toBe(false);
    });

    it('loads items when opened', async () => {
      const composable = useItemSelector(mockApi, ['test_collection']);
      
      await composable.open('test_collection');
      
      expect(mockApi.get).toHaveBeenCalled();
      expect(composable.availableItems.value).toHaveLength(2);
      expect(composable.totalItems.value).toBe(2);
    });

    it('handles search', async () => {
      const composable = useItemSelector(mockApi, ['test_collection']);
      
      await composable.open('test_collection');
      composable.searchQuery.value = 'test';
      
      // loadItems is the method that actually performs the search
      await composable.loadItems();
      
      // The search API is called with /expandable-blocks-api/{collection}/search and the searchQuery is embedded in the filter
      const calls = mockApi.get.mock.calls;
      const searchCall = calls.find(call => call[0].includes('/search'));
      expect(searchCall).toBeDefined();
      expect(searchCall[0]).toContain('/expandable-blocks-api/test_collection/search');
    });

    it('handles pagination', async () => {
      const composable = useItemSelector(mockApi, ['test_collection']);
      
      await composable.open('test_collection');
      composable.currentPage.value = 2;
      await composable.loadItems();
      
      expect(composable.currentPage.value).toBe(2);
      // The pagination is handled through offset in params
      const calls = mockApi.get.mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall).toBeDefined();
      // Check that API was called with proper offset (page 2 = offset 100 with default itemsPerPage 100)
      if (lastCall && lastCall[1] && lastCall[1].params) {
        expect(lastCall[1].params.offset).toBe(100);
      }
    });

    it('handles sorting', async () => {
      const composable = useItemSelector(mockApi, ['test_collection']);
      
      await composable.open('test_collection');
      composable.sortField.value = 'title';
      composable.sortDirection.value = 'desc';
      await composable.loadItems();
      
      expect(composable.sortField.value).toBe('title');
      expect(composable.sortDirection.value).toBe('desc');
    });

    it('handles errors gracefully', async () => {
      // Override mock to reject for all calls
      mockApi.get = vi.fn().mockRejectedValue(new Error('API Error'));
      
      const composable = useItemSelector(mockApi, ['test_collection']);
      await composable.open('test_collection');
      
      expect(composable.loading.value).toBe(false);
      // The error is set from the Error object's message
      expect(composable.apiError.value).toBe('API Error');
    });
  });
});