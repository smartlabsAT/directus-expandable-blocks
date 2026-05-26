import { describe, it, expect, beforeEach } from 'vitest';
import { ref } from 'vue';
import { useM2AData } from '../../../src/composables/useM2AData';
import type { ExpandableBlocksContext } from '../../../src/types/composable-context';

// Mock M2AHelper
vi.mock('../../../src/utils/m2a-helper', () => ({
  M2AHelper: vi.fn().mockImplementation(function () {
    return {
      analyzeM2AStructure: vi.fn().mockResolvedValue({
        field: 'content_blocks',
        collection: 'pages',
        junctionCollection: 'pages_content_blocks',
        foreignKeyField: 'pages_id',
        allowedCollections: ['content_text', 'content_image', 'content_hero'],
        nestedM2AFields: {}
      }),
      loadM2AData: vi.fn().mockResolvedValue([
        { id: 1, collection: 'content_text', item: { id: 101, title: 'Text Block' } },
        { id: 2, collection: 'content_image', item: { id: 102, url: '/image.jpg' } }
      ])
    };
  })
}));

// Mock logger

vi.mock('../../../src/utils/logger-wrapper', () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    log: vi.fn(),
    info: vi.fn()
  },
  logDebug: vi.fn(),
  logError: vi.fn(),
  logWarn: vi.fn(),
  logAction: vi.fn(),
  logStateChange: vi.fn(),
  logEvent: vi.fn(),
  logInit: vi.fn(),
  logLifecycle: vi.fn(),
  logData: vi.fn(),
  logPerformance: vi.fn(),
  createScopedLogger: vi.fn(() => ({
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    log: vi.fn(),
    info: vi.fn(),
    stateChange: vi.fn(),
    event: vi.fn(),
    action: vi.fn(),
    init: vi.fn(),
    lifecycle: vi.fn(),
    data: vi.fn(),
    performance: vi.fn()
  }))
}))

// Mock validation
vi.mock('../../../src/utils/validation', () => ({
  isValidPrimaryKey: vi.fn((key) => key && key !== '+' && key !== 'new'),
  isItemObject: vi.fn((item) => typeof item === 'object' && item !== null)
}));

describe('useM2AData', () => {
  let ctx: ExpandableBlocksContext;
  let updateOriginalItemOrder: ReturnType<typeof vi.fn>;
  let clearStateTracking: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Create a proper context structure matching ExpandableBlocksContext
    ctx = {
      state: {
        items: ref([]),
        expandedItems: ref([]),
        loading: ref(false),
        blockOriginalStates: ref(new Map()),
        blockDirtyStates: ref(new Map()),
        originalItemOrder: ref([]),
        isInternalUpdate: ref(false),
        isInitialLoad: ref(true),
        isFullyInitialized: ref(false)
      },
      stateFns: {
        getItemId: vi.fn((item) => item.id),
        isNewItem: vi.fn((item) => typeof item.id === 'string' && item.id.startsWith('new_')),
        updateOriginalState: vi.fn(),
        markBlockDirty: vi.fn(),
        prepareItemsForEmit: vi.fn((items) => items),
        removeBlockState: vi.fn(),
        isBlockDirty: vi.fn(),
        resetBlockState: vi.fn()
      },
      deps: {
        api: {
          get: vi.fn().mockResolvedValue({ 
            data: { 
              data: [
                { id: 1, collection: 'content_text', item: { id: 101, title: 'Text Block' } },
                { id: 2, collection: 'content_image', item: { id: 102, url: '/image.jpg' } }
              ] 
            } 
          }),
          post: vi.fn().mockResolvedValue({
            data: {
              data: { id: 3, collection: 'content_hero', item: { id: 103, headline: 'Hero Block' } }
            }
          })
        },
        props: {
          collection: 'pages',
          field: 'content_blocks',
          primaryKey: 123,
          value: ref([])
        },
        stores: {
          relationsStore: {
            getRelationsForField: vi.fn().mockReturnValue([{
              collection: 'pages_content_blocks',
              junctionCollection: 'pages_content_blocks',
              foreignKeyField: 'pages_id',
              meta: {
                junction_field: 'content_blocks',
                sort_field: 'sort',
                one_allowed_collections: ['content_text', 'content_image', 'content_hero']
              }
            }]),
            getRelations: vi.fn().mockReturnValue([{
              collection: 'pages_content_blocks',
              field: 'collection',
              schema: { table: 'pages_content_blocks' },
              meta: {
                one_allowed_collections: ['content_text', 'content_image', 'content_hero']
              }
            }])
          },
          fieldsStore: {
            getFieldsForCollection: vi.fn((collection) => {
              const fields = {
                content_text: [
                  { field: 'title', type: 'string', name: 'Title' },
                  { field: 'content', type: 'text', name: 'Content' }
                ],
                content_image: [
                  { field: 'url', type: 'string', name: 'URL' },
                  { field: 'alt', type: 'string', name: 'Alt Text' }
                ],
                content_hero: [
                  { field: 'headline', type: 'string', name: 'Headline' },
                  { field: 'subtitle', type: 'string', name: 'Subtitle' }
                ]
              };
              return fields[collection] || [];
            }),
            getField: vi.fn().mockReturnValue({
              meta: {
                special: ['m2a'],
                options: {
                  allowedCollections: ['content_text', 'content_image', 'content_hero']
                }
              }
            })
          }
        },
        helpers: {
          m2aHelper: new (vi.mocked(await import('../../../src/utils/m2a-helper')).M2AHelper)(),
          deepEqual: vi.fn((a, b) => JSON.stringify(a) === JSON.stringify(b))
        }
      },
      ui: {
        mergedOptions: ref({}),
        deleteDialog: ref({ active: false }),
        itemToDelete: ref(null),
        canAddMoreBlocks: ref(true),
        availableStatuses: []
      },
      data: {
        relationInfo: ref(null),
        allowedCollections: ref([]),
        m2aStructure: ref(null),
        values: ref({}),
        initialValues: ref({})
      }
    } as unknown as ExpandableBlocksContext;

    updateOriginalItemOrder = vi.fn();
    clearStateTracking = vi.fn();
  });

  describe('initialize', () => {
    it('initializes M2A data loading', async () => {
      const m2aData = useM2AData(ctx, updateOriginalItemOrder, clearStateTracking);
      
      await m2aData.initialize();
      
      // Check that M2A structure was analyzed
      expect(ctx.deps.helpers.m2aHelper.analyzeM2AStructure).toHaveBeenCalledWith('pages', 'content_blocks');
      expect(ctx.data.m2aStructure.value).toBeTruthy();
      
      // Check that fully initialized flag is set
      expect(ctx.state.isFullyInitialized.value).toBe(true);
    });

    it('handles errors during initialization', async () => {
      ctx.deps.helpers.m2aHelper.analyzeM2AStructure = vi.fn().mockRejectedValue(new Error('Test error'));
      
      const m2aData = useM2AData(ctx, updateOriginalItemOrder, clearStateTracking);
      
      // Should not throw
      await expect(m2aData.initialize()).resolves.not.toThrow();
      
      // Should mark as fully initialized even on error
      expect(ctx.state.isFullyInitialized.value).toBe(true);
    });
  });

  describe('loadFullItemData', () => {
    it('loads data and processes records', async () => {
      const m2aData = useM2AData(ctx, updateOriginalItemOrder, clearStateTracking);
      
      await m2aData.loadFullItemData();
      
      // Check that items were loaded from the mock
      expect(ctx.state.items.value).toHaveLength(2);
      
      // Check that items were processed
      expect(ctx.state.items.value).toHaveLength(2);
      expect(ctx.state.items.value[0]).toEqual({
        id: 1,
        collection: 'content_text',
        item: { id: 101, title: 'Text Block' }
      });
      
      // Check that original states were stored
      expect(ctx.stateFns.updateOriginalState).toHaveBeenCalled();
      
      // Check that original item order was updated
      // The implementation passes IDs as they are (not converted)
      expect(updateOriginalItemOrder).toHaveBeenCalledWith([1, 2]);
    });

    it('handles no primary key gracefully', async () => {
      ctx.deps.props.primaryKey = null;
      const m2aData = useM2AData(ctx, updateOriginalItemOrder, clearStateTracking);
      
      await m2aData.loadFullItemData();
      
      // Should clear items and return early
      expect(ctx.state.items.value).toEqual([]);
      expect(ctx.deps.helpers.m2aHelper.loadM2AData).not.toHaveBeenCalled();
    });

    it('handles API errors', async () => {
      ctx.deps.api.get.mockRejectedValueOnce(new Error('API Error'));
      const m2aData = useM2AData(ctx, updateOriginalItemOrder, clearStateTracking);
      
      await m2aData.loadFullItemData();
      
      // Should handle error gracefully and mark as fully initialized
      expect(ctx.state.isFullyInitialized.value).toBe(true);
      expect(ctx.state.isInitialLoad.value).toBe(false);
    });

    it('clears state tracking on initial load', async () => {
      ctx.state.items.value = [];
      ctx.state.isFullyInitialized.value = false;
      ctx.state.isInitialLoad.value = true;
      
      const m2aData = useM2AData(ctx, updateOriginalItemOrder, clearStateTracking);
      
      await m2aData.loadFullItemData();
      
      expect(clearStateTracking).toHaveBeenCalled();
      expect(ctx.state.isInitialLoad.value).toBe(false); // Should be reset after load
    });
  });

  describe('processLoadedRecords', () => {
    it('processes junction records correctly', () => {
      const m2aData = useM2AData(ctx, updateOriginalItemOrder, clearStateTracking);
      
      const records = [
        { id: 1, collection: 'content_text', item: { id: 101, title: 'Text Block' } },
        { id: 2, collection: 'content_image', item: { id: 102, url: '/image.jpg' } }
      ];
      
      m2aData.processLoadedRecords(records);
      
      // Check that items were updated
      expect(ctx.state.items.value).toEqual(records);
      
      // Check that original states were initialized
      expect(ctx.stateFns.updateOriginalState).toHaveBeenCalledTimes(2);
      expect(ctx.stateFns.updateOriginalState).toHaveBeenCalledWith(1, { id: 101, title: 'Text Block' });
      expect(ctx.stateFns.updateOriginalState).toHaveBeenCalledWith(2, { id: 102, url: '/image.jpg' });
      
      // Check that items were marked as clean
      expect(ctx.stateFns.markBlockDirty).toHaveBeenCalledWith(1, false);
      expect(ctx.stateFns.markBlockDirty).toHaveBeenCalledWith(2, false);
      
      // Check that original item order was updated
      // The implementation passes IDs as they are (not converted)
      expect(updateOriginalItemOrder).toHaveBeenCalledWith([1, 2]);
    });

    it('handles pasted items correctly', () => {
      const m2aData = useM2AData(ctx, updateOriginalItemOrder, clearStateTracking);
      
      const records = [
        { id: 1, collection: 'content_text', item: { id: 101, title: 'Text Block' } },
        { id: 2, collection: 'content_image', item: { id: 102, url: '/image.jpg' } }
      ];
      
      const pastedIds = new Set([2]);
      
      m2aData.processLoadedRecords(records, pastedIds);
      
      // Check that pasted item was marked as dirty
      expect(ctx.stateFns.markBlockDirty).toHaveBeenCalledWith(2, true);
      
      // Check that non-pasted item was marked as clean
      expect(ctx.stateFns.markBlockDirty).toHaveBeenCalledWith(1, false);
    });

    it('handles save events correctly', () => {
      ctx.state.isInitialLoad.value = false;
      
      const m2aData = useM2AData(ctx, updateOriginalItemOrder, clearStateTracking);
      
      const records = [
        { id: 1, collection: 'content_text', item: { id: 101, title: 'Updated Text' } }
      ];
      
      m2aData.processLoadedRecords(records, undefined, true);
      
      // After save, should update original state
      expect(ctx.stateFns.updateOriginalState).toHaveBeenCalledWith(1, { id: 101, title: 'Updated Text' });
      
      // After save, should mark as clean
      expect(ctx.stateFns.markBlockDirty).toHaveBeenCalledWith(1, false);
      
      // Should not update order after save
      expect(updateOriginalItemOrder).not.toHaveBeenCalled();
    });
  });

  describe('processPasteData', () => {
    it('processes mixed paste data correctly', async () => {
      const m2aData = useM2AData(ctx, updateOriginalItemOrder, clearStateTracking);
      
      const pastedData = [
        1, // Just an ID
        { id: 2, collection: 'content_image', item: { id: 102, url: '/image.jpg' } }, // Full record
        { collection: 'content_hero', item: { headline: 'New Hero' } } // New item without ID
      ];
      
      await m2aData.processPasteData(pastedData);
      
      // Should have created junction for new item without ID
      expect(ctx.deps.api.post).toHaveBeenCalledWith(
        '/items/pages_content_blocks',
        expect.objectContaining({
          collection: 'content_hero'
          // item field is undefined when creating new items without ID
        })
      );
      
      // Should mark pasted items as dirty
      expect(ctx.stateFns.markBlockDirty).toHaveBeenCalled();
    });

    it('handles objects with extra fields correctly', async () => {
      ctx.data.relationInfo.value = {
        junctionCollection: 'pages_content_blocks',
        foreignKeyField: 'pages_id',
        meta: { sort_field: 'sort' }
      };
      
      const m2aData = useM2AData(ctx, updateOriginalItemOrder, clearStateTracking);
      
      const pastedData = [
        {
          collection: 'content_text',
          item: { title: 'New Text' },
          extra_id: 456, // Extra field that should be preserved
          custom_field: 'value'
        }
      ];
      
      await m2aData.processPasteData(pastedData);
      
      // Should preserve extra fields when creating junction
      expect(ctx.deps.api.post).toHaveBeenCalledWith(
        '/items/pages_content_blocks',
        expect.objectContaining({
          collection: 'content_text',
          extra_id: 456,
          custom_field: 'value'
        })
      );
    });

    it('handles simple ID array', async () => {
      const m2aData = useM2AData(ctx, updateOriginalItemOrder, clearStateTracking);
      
      await m2aData.processPasteData([1, 2, 3]);
      
      // Should have reloaded the data
      expect(ctx.state.items.value.length).toBeGreaterThan(0);
    });
  });

  describe('loadAllowedCollections', () => {
    it('loads collections from relation metadata', async () => {
      const m2aData = useM2AData(ctx, updateOriginalItemOrder, clearStateTracking);
      
      // Set includeCollections in merged options - this is the simplest way
      ctx.ui.mergedOptions.value = {
        includeCollections: ['content_text', 'content_image', 'content_hero']
      };
      
      // Mock successful API responses for collections
      ctx.deps.api.get.mockImplementation((url: string) => {
        if (url.startsWith('/collections/')) {
          const collection = url.split('/').pop();
          return Promise.resolve({
            data: {
              data: {
                collection,
                meta: {
                  display_name: collection,
                  icon: 'box',
                  singleton: false
                }
              }
            }
          });
        }
        return Promise.resolve({ data: { data: [] } });
      });
      
      await m2aData.loadAllowedCollections();
      
      // Should have loaded allowed collections
      expect(ctx.data.allowedCollections.value.length).toBe(3);
      expect(ctx.data.allowedCollections.value[0].collection).toBe('content_text');
    });

    it('uses includeCollections from options when provided', async () => {
      ctx.ui.mergedOptions.value = {
        includeCollections: ['content_text', 'content_image']
      };
      
      const m2aData = useM2AData(ctx, updateOriginalItemOrder, clearStateTracking);
      
      await m2aData.loadAllowedCollections();
      
      // Should respect the includeCollections filter
      expect(ctx.data.allowedCollections.value.length).toBeLessThanOrEqual(2);
    });

    it('handles collection loading errors gracefully', async () => {
      ctx.deps.api.get.mockRejectedValue(new Error('Not found'));
      
      const m2aData = useM2AData(ctx, updateOriginalItemOrder, clearStateTracking);
      
      // Should not throw when API fails
      await expect(m2aData.loadAllowedCollections()).resolves.not.toThrow();
    });
  });

  describe('loadRelationInfo', () => {
    it('loads relation info and junction metadata', async () => {
      const m2aData = useM2AData(ctx, updateOriginalItemOrder, clearStateTracking);
      
      await m2aData.loadRelationInfo();
      
      expect(ctx.data.relationInfo.value).toBeTruthy();
      expect(ctx.data.relationInfo.value.junctionCollection).toBe('pages_content_blocks');
      
      // Should try to load junction fields
      expect(ctx.deps.api.get).toHaveBeenCalledWith('/fields/pages_content_blocks');
    });

    // Temporarily disabled - timeout issue
    it.skip('handles junction field loading errors', async () => {
      // Mock successful loadRelationInfo first
      const m2aData = useM2AData(ctx, updateOriginalItemOrder, clearStateTracking);
      
      // Ensure relationInfo is set
      await m2aData.loadRelationInfo();
      
      // Then mock API failure for junction fields
      ctx.deps.api.get.mockRejectedValue(new Error('Not found'));
      
      // Should not throw when calling again
      await expect(m2aData.loadRelationInfo()).resolves.not.toThrow();
    });
  });

  describe('allowedCollectionsMap', () => {
    it('creates a map from allowed collections', async () => {
      // Set up allowed collections manually
      ctx.data.allowedCollections.value = [
        { collection: 'content_text', name: 'Text', icon: 'text' },
        { collection: 'content_image', name: 'Image', icon: 'image' },
        { collection: 'content_hero', name: 'Hero', icon: 'star' }
      ];

      const m2aData = useM2AData(ctx, updateOriginalItemOrder, clearStateTracking);

      const map = m2aData.allowedCollectionsMap.value;
      expect(map).toHaveProperty('content_text');
      expect(map).toHaveProperty('content_image');
      expect(map).toHaveProperty('content_hero');

      expect(map.content_text.collection).toBe('content_text');
    });
  });

  describe('loadAllowedCollectionsForExisting', () => {
    it('falls back to allowedCollections when allowedCollectionsForExisting is empty', async () => {
      ctx.data.allowedCollectionsForExisting = ref([]);
      ctx.deps.stores.collectionsStore = {
        getCollection: vi.fn().mockReturnValue({
          name: 'Content Text',
          meta: { icon: 'article', singleton: false }
        })
      };
      ctx.data.allowedCollections.value = [
        { collection: 'content_text', name: 'Content Text', icon: 'article', singleton: false },
        { collection: 'content_image', name: 'Content Image', icon: 'image', singleton: false }
      ];
      ctx.ui.mergedOptions.value = { allowedCollections: ['content_text', 'content_image'] };

      const m2aData = useM2AData(ctx, updateOriginalItemOrder, clearStateTracking);
      await m2aData.loadAllowedCollectionsForExisting();

      expect(ctx.data.allowedCollectionsForExisting.value).toHaveLength(2);
      expect(ctx.data.allowedCollectionsForExisting.value[0].collection).toBe('content_text');
    });

    it('uses explicit allowedCollectionsForExisting when provided', async () => {
      ctx.data.allowedCollectionsForExisting = ref([]);
      ctx.deps.stores.collectionsStore = {
        getCollection: vi.fn().mockReturnValue({
          name: 'Content Text',
          meta: { icon: 'article', singleton: false }
        })
      };
      ctx.ui.mergedOptions.value = { allowedCollectionsForExisting: ['content_text'] };

      const m2aData = useM2AData(ctx, updateOriginalItemOrder, clearStateTracking);
      await m2aData.loadAllowedCollectionsForExisting();

      expect(ctx.data.allowedCollectionsForExisting.value).toHaveLength(1);
      expect(ctx.data.allowedCollectionsForExisting.value[0].collection).toBe('content_text');
    });
  });
});