import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ref } from 'vue';
import { useExpandableBlocks } from '@/composables/useExpandableBlocks';

// Mock all sub-composables
vi.mock('@/composables/useBlockState', () => ({
  useBlockState: vi.fn(() => ({
    // State
    items: ref([]),
    expandedItems: ref([]),
    loading: ref(false),
    blockOriginalStates: ref(new Map()),
    blockDirtyStates: ref(new Set()),
    originalItemOrder: ref([]),
    isInternalUpdate: ref(false),
    isInitialLoad: ref(true),
    isFullyInitialized: ref(false),
    
    // State functions
    getItemId: vi.fn((item) => item.id),
    isNewItem: vi.fn((item) => typeof item.id === 'string' && item.id.startsWith('new_')),
    prepareItemsForEmit: vi.fn((items) => items),
    updateOriginalState: vi.fn(),
    markBlockDirty: vi.fn(),
    removeBlockState: vi.fn(),
    updateOriginalItemOrder: vi.fn(),
    clearStateTracking: vi.fn(),
    isBlockDirty: vi.fn(),
    resetBlockState: vi.fn()
  }))
}));

vi.mock('@/composables/useBlockActions', () => ({
  useBlockActions: vi.fn(() => ({
    toggleExpand: vi.fn(),
    showDeleteDialog: vi.fn(),
    addNewItem: vi.fn(),
    updateItem: vi.fn(),
    confirmDeleteItem: vi.fn(),
    duplicateItem: vi.fn(),
    discardChanges: vi.fn(),
    updateItemStatus: vi.fn(),
    onSort: vi.fn()
  }))
}));

vi.mock('@/composables/useM2AData', () => ({
  useM2AData: vi.fn(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    loadFullItemData: vi.fn().mockResolvedValue(undefined),
    processLoadedRecords: vi.fn(),
    processPasteData: vi.fn().mockResolvedValue(undefined),
    allowedCollectionsMap: ref({})
  }))
}));

vi.mock('@/composables/useUIHelpers', () => ({
  useUIHelpers: vi.fn(() => ({
    // Add any UI helper methods that are spread into the return value
  }))
}));

vi.mock('@/composables/useBlockWatchers', () => ({
  useBlockWatchers: vi.fn(() => ({
    setupWatchers: vi.fn()
  }))
}));

// Mock utilities
vi.mock('@/utils/m2a-helper', () => ({
  M2AHelper: vi.fn()
}));

vi.mock('@/utils/logger-wrapper', () => ({
  logDebug: vi.fn(),
  logError: vi.fn()
}));

vi.mock('@/utils/helpers', () => ({
  deepClone: vi.fn((obj) => JSON.parse(JSON.stringify(obj))),
  deepEqual: vi.fn((a, b) => JSON.stringify(a) === JSON.stringify(b))
}));

vi.mock('@/utils/validation', () => ({
  isItemObject: vi.fn((item) => typeof item === 'object' && item !== null)
}));

// Mock Directus SDK
vi.mock('@directus/extensions-sdk', () => ({
  useStores: vi.fn(() => ({
    useFieldsStore: vi.fn(() => ({
      getFieldsForCollection: vi.fn(() => [])
    })),
    useRelationsStore: vi.fn(() => ({
      getRelationsForField: vi.fn(() => [])
    })),
    useCollectionsStore: vi.fn(() => ({})),
    useNotificationsStore: vi.fn(() => ({
      add: vi.fn()
    }))
  })),
  useApi: vi.fn(() => ({}))
}));

describe('useExpandableBlocks', () => {
  let props;
  let emit;
  let values;
  let initialValues;

  beforeEach(() => {
    vi.clearAllMocks();
    
    props = {
      value: [],
      collection: 'pages',
      field: 'content_blocks',
      primaryKey: 1,
      disabled: false,
      options: {}
    };
    
    emit = vi.fn();
    values = ref({ content_blocks: [] });
    initialValues = ref({ content_blocks: [] });
  });

  describe('Initialization', () => {
    it('initializes all sub-composables', async () => {
      const { useBlockState } = vi.mocked(await import('@/composables/useBlockState'));
      const { useBlockActions } = vi.mocked(await import('@/composables/useBlockActions'));
      const { useM2AData } = vi.mocked(await import('@/composables/useM2AData'));
      const { useUIHelpers } = vi.mocked(await import('@/composables/useUIHelpers'));
      const { useBlockWatchers } = vi.mocked(await import('@/composables/useBlockWatchers'));
      
      useExpandableBlocks(props, emit, values, initialValues);
      
      expect(useBlockState).toHaveBeenCalled();
      expect(useBlockActions).toHaveBeenCalled();
      expect(useM2AData).toHaveBeenCalled();
      expect(useUIHelpers).toHaveBeenCalled();
      expect(useBlockWatchers).toHaveBeenCalled();
    });

    it('creates M2AHelper instance', async () => {
      const { M2AHelper } = vi.mocked(await import('@/utils/m2a-helper'));
      
      useExpandableBlocks(props, emit, values, initialValues);
      
      expect(M2AHelper).toHaveBeenCalled();
    });

    it('loads M2A data on initialize', async () => {
      const { useM2AData } = vi.mocked(await import('@/composables/useM2AData'));
      const mockInitialize = vi.fn().mockResolvedValue(undefined);
      
      useM2AData.mockReturnValueOnce({
        initialize: mockInitialize,
        loadFullItemData: vi.fn(),
        processLoadedRecords: vi.fn(),
        processPasteData: vi.fn(),
        allowedCollectionsMap: ref({})
      });
      
      const composable = useExpandableBlocks(props, emit, values, initialValues);
      
      // Call the initialize method
      await composable.initialize();
      
      expect(mockInitialize).toHaveBeenCalled();
    });
  });

  describe('Exposed API', () => {
    it('exposes all necessary properties and methods', () => {
      const composable = useExpandableBlocks(props, emit, values, initialValues);
      
      // State properties
      expect(composable).toHaveProperty('items');
      expect(composable).toHaveProperty('expandedItems');
      expect(composable).toHaveProperty('sortable');
      expect(composable).toHaveProperty('canAddMoreBlocks');
      expect(composable).toHaveProperty('loading');
      expect(composable).toHaveProperty('mergedOptions');
      expect(composable).toHaveProperty('deleteDialog');
      expect(composable).toHaveProperty('itemToDelete');
      expect(composable).toHaveProperty('allowedCollectionsMap');
      expect(composable).toHaveProperty('relationInfo');
      expect(composable).toHaveProperty('m2aStructure');
      expect(composable).toHaveProperty('allowedCollections');
      expect(composable).toHaveProperty('isInitialLoad');
      expect(composable).toHaveProperty('blockOriginalStates');
      expect(composable).toHaveProperty('originalItemOrder');
      expect(composable).toHaveProperty('availableStatuses');
      expect(composable).toHaveProperty('saveButtonWouldBeActive');
      expect(composable).toHaveProperty('shouldShowItemId');
      
      // Methods
      expect(composable).toHaveProperty('initialize');
      expect(composable).toHaveProperty('getItemId');
      expect(composable).toHaveProperty('isNewItem');
      expect(composable).toHaveProperty('isBlockDirty');
      expect(composable).toHaveProperty('toggleExpand');
      expect(composable).toHaveProperty('showDeleteDialog');
      expect(composable).toHaveProperty('addNewItem');
      expect(composable).toHaveProperty('updateItem');
      expect(composable).toHaveProperty('confirmDeleteItem');
      expect(composable).toHaveProperty('duplicateItem');
      expect(composable).toHaveProperty('discardChanges');
      expect(composable).toHaveProperty('updateItemStatus');
      expect(composable).toHaveProperty('onSort');
      expect(composable).toHaveProperty('loadFullItemData');
      expect(composable).toHaveProperty('processLoadedRecords');
      expect(composable).toHaveProperty('processPasteData');
    });

    it('exposes refs that are reactive', () => {
      const composable = useExpandableBlocks(props, emit, values, initialValues);
      
      expect(composable.items.value).toEqual([]);
      expect(composable.expandedItems.value).toEqual([]);
      expect(composable.loading.value).toBe(false);
    });
  });

  describe('Context Creation', () => {
    it('creates proper context for sub-composables', async () => {
      const { useBlockState } = vi.mocked(await import('@/composables/useBlockState'));
      const { useBlockActions } = vi.mocked(await import('@/composables/useBlockActions'));
      
      useExpandableBlocks(props, emit, values, initialValues);
      
      // useBlockState is called without context
      expect(useBlockState).toHaveBeenCalledWith();
      
      // useBlockActions is called with context
      const contextArg = useBlockActions.mock.calls[0][0];
      expect(contextArg).toHaveProperty('state');
      expect(contextArg).toHaveProperty('stateFns');
      expect(contextArg).toHaveProperty('deps');
      expect(contextArg.deps).toHaveProperty('props');
      expect(contextArg.deps).toHaveProperty('emit');
      expect(contextArg.deps).toHaveProperty('api');
      expect(contextArg.deps).toHaveProperty('stores');
      expect(contextArg).toHaveProperty('ui');
      expect(contextArg).toHaveProperty('data');
      expect(contextArg.data).toHaveProperty('values');
      expect(contextArg.data).toHaveProperty('initialValues');
    });
  });

  describe('Watchers Setup', () => {
    it('sets up watchers during initialization', async () => {
      const { useBlockWatchers } = vi.mocked(await import('@/composables/useBlockWatchers'));
      const mockSetupWatchers = vi.fn();
      
      useBlockWatchers.mockReturnValueOnce({
        setupWatchers: mockSetupWatchers
      });
      
      const composable = useExpandableBlocks(props, emit, values, initialValues);
      await composable.initialize();
      
      expect(mockSetupWatchers).toHaveBeenCalled();
    });
  });

  describe('Integration', () => {
    it('coordinates between all composables', async () => {
      const { useBlockState } = vi.mocked(await import('@/composables/useBlockState'));
      const { useBlockActions } = vi.mocked(await import('@/composables/useBlockActions'));
      const { useM2AData } = vi.mocked(await import('@/composables/useM2AData'));
      
      const mockState = {
        items: ref([{ id: 1, collection: 'content_text', item: { title: 'Test' } }]),
        expandedItems: ref([]),
        loading: ref(false),
        blockOriginalStates: ref(new Map()),
        blockDirtyStates: ref(new Set()),
        originalItemOrder: ref([]),
        isInternalUpdate: ref(false),
        isInitialLoad: ref(true),
        isFullyInitialized: ref(false),
        getItemId: vi.fn((item) => item.id),
        isNewItem: vi.fn(),
        prepareItemsForEmit: vi.fn(),
        updateOriginalState: vi.fn(),
        markBlockDirty: vi.fn(),
        removeBlockState: vi.fn(),
        updateOriginalItemOrder: vi.fn(),
        clearStateTracking: vi.fn(),
        isBlockDirty: vi.fn(),
        resetBlockState: vi.fn()
      };
      
      const mockActions = {
        toggleExpand: vi.fn(),
        showDeleteDialog: vi.fn(),
        addNewItem: vi.fn(),
        updateItem: vi.fn(),
        confirmDeleteItem: vi.fn(),
        duplicateItem: vi.fn(),
        discardChanges: vi.fn(),
        updateItemStatus: vi.fn(),
        onSort: vi.fn()
      };
      
      const mockM2AData = {
        initialize: vi.fn().mockResolvedValue(undefined),
        loadFullItemData: vi.fn().mockResolvedValue(undefined),
        processLoadedRecords: vi.fn(),
        processPasteData: vi.fn(),
        allowedCollectionsMap: ref({})
      };
      
      useBlockState.mockReturnValueOnce(mockState);
      useBlockActions.mockReturnValueOnce(mockActions);
      useM2AData.mockReturnValueOnce(mockM2AData);
      
      const composable = useExpandableBlocks(props, emit, values, initialValues);
      
      // Test that state is shared
      expect(composable.items.value).toBe(mockState.items.value);
      
      // Test that actions work
      composable.toggleExpand('1');
      expect(mockActions.toggleExpand).toHaveBeenCalledWith('1');
    });
  });

  describe('Options Handling', () => {
    it('loads field options during initialization', async () => {
      const { useStores } = vi.mocked(await import('@directus/extensions-sdk'));
      const mockGetFieldsForCollection = vi.fn().mockReturnValue([
        {
          field: 'content_blocks',
          meta: {
            options: {
              startExpanded: true,
              maxBlocks: 10
            }
          }
        }
      ]);
      
      useStores.mockReturnValueOnce({
        useFieldsStore: vi.fn(() => ({
          getFieldsForCollection: mockGetFieldsForCollection
        })),
        useRelationsStore: vi.fn(() => ({
          getRelationsForField: vi.fn(() => [])
        })),
        useCollectionsStore: vi.fn(() => ({})),
        useNotificationsStore: vi.fn(() => ({
          add: vi.fn()
        }))
      });
      
      const composable = useExpandableBlocks(props, emit, values, initialValues);
      await composable.initialize();
      
      expect(mockGetFieldsForCollection).toHaveBeenCalledWith('pages');
      expect(composable.mergedOptions.value).toEqual({
        startExpanded: true,
        maxBlocks: 10
      });
    });

    it('implements startExpanded option', async () => {
      const { useBlockState } = vi.mocked(await import('@/composables/useBlockState'));
      const { useM2AData } = vi.mocked(await import('@/composables/useM2AData'));
      
      const mockItems = ref([
        { id: 1, collection: 'content_text', item: { title: 'Block 1' } },
        { id: 2, collection: 'content_text', item: { title: 'Block 2' } }
      ]);
      
      const mockExpandedItems = ref([]);
      
      useBlockState.mockReturnValueOnce({
        items: mockItems,
        expandedItems: mockExpandedItems,
        loading: ref(false),
        blockOriginalStates: ref(new Map()),
        blockDirtyStates: ref(new Set()),
        originalItemOrder: ref([1, 2]),
        isInternalUpdate: ref(false),
        isInitialLoad: ref(true),
        isFullyInitialized: ref(false),
        getItemId: vi.fn((item) => item.id),
        isNewItem: vi.fn(),
        prepareItemsForEmit: vi.fn(),
        updateOriginalState: vi.fn(),
        markBlockDirty: vi.fn(),
        removeBlockState: vi.fn(),
        updateOriginalItemOrder: vi.fn(),
        clearStateTracking: vi.fn(),
        isBlockDirty: vi.fn(),
        resetBlockState: vi.fn()
      });
      
      // Mock M2AData to simulate items being loaded
      useM2AData.mockReturnValueOnce({
        initialize: vi.fn().mockImplementation(async () => {
          // Simulate loading items during initialization
          // Items are already set in the mock above
        }),
        loadFullItemData: vi.fn(),
        processLoadedRecords: vi.fn(),
        processPasteData: vi.fn(),
        allowedCollectionsMap: ref({})
      });
      
      props.options = { startExpanded: true };
      
      const composable = useExpandableBlocks(props, emit, values, initialValues);
      await composable.initialize();
      
      // The implementation sets expandedItems synchronously after m2aData.initialize()
      expect(mockExpandedItems.value).toEqual([1, 2]);
    });
  });

  describe('Error Handling', () => {
    it('handles errors during initialization', async () => {
      const { logError } = vi.mocked(await import('@/utils/logger-wrapper'));
      const { useM2AData } = vi.mocked(await import('@/composables/useM2AData'));
      const { useStores } = vi.mocked(await import('@directus/extensions-sdk'));
      
      // Get the mocked notificationsStore
      const mockNotificationsStore = { add: vi.fn() };
      useStores.mockReturnValue({
        useFieldsStore: vi.fn(() => ({
          getFieldsForCollection: vi.fn(() => [])
        })),
        useRelationsStore: vi.fn(() => ({
          getRelationsForField: vi.fn(() => [])
        })),
        useCollectionsStore: vi.fn(() => ({})),
        useNotificationsStore: vi.fn(() => mockNotificationsStore)
      });
      
      const error = new Error('Initialization error');
      useM2AData.mockReturnValueOnce({
        initialize: vi.fn().mockRejectedValue(error),
        loadFullItemData: vi.fn(),
        processLoadedRecords: vi.fn(),
        processPasteData: vi.fn(),
        allowedCollectionsMap: ref({})
      });
      
      const composable = useExpandableBlocks(props, emit, values, initialValues);
      await composable.initialize();
      
      expect(logError).toHaveBeenCalledWith('Error initializing expandable blocks', error);
      expect(mockNotificationsStore.add).toHaveBeenCalledWith({
        title: 'Initialization Error',
        text: 'Failed to initialize expandable blocks. Please refresh the page.',
        type: 'error'
      });
    });
  });
});