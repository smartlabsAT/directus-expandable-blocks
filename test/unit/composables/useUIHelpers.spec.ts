import { describe, it, expect, beforeEach } from 'vitest';
import { ref } from 'vue';
import { useUIHelpers } from '@/composables/useUIHelpers';
import type { ExpandableBlocksContext } from '@/types/composable-context';

// Mock logger

vi.mock('@/utils/logger-wrapper', () => ({
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

// Mock helpers
vi.mock('@/utils/helpers', () => ({
  extractItemTitle: vi.fn((item) => item.item?.title || item.title || 'Untitled'),
  getActualItemId: vi.fn((item) => item.item?.id || item.id),
  getActualItem: vi.fn((item) => item.item || item),
  getItemCollection: vi.fn((item) => item.collection),
  METADATA_FIELDS: ['user_created', 'date_created', 'user_updated', 'date_updated']
}));

// Mock validation
vi.mock('@/utils/validation', () => ({
  isValidCollection: vi.fn((collection) => !!collection && typeof collection === 'string')
}));

describe('useUIHelpers', () => {
  let ctx: ExpandableBlocksContext;

  beforeEach(() => {
    // Create a proper context structure matching ExpandableBlocksContext
    ctx = {
      state: {
        items: ref([]),
        expandedItems: ref([]),
        loading: ref(false),
        blockOriginalStates: ref(new Map()),
        blockDirtyStates: ref(new Set()),
        originalItemOrder: ref([]),
        isInternalUpdate: ref(false),
        isInitialLoad: ref(true),
        isFullyInitialized: ref(false)
      },
      stateFns: {
        getItemId: vi.fn(),
        isNewItem: vi.fn(),
        updateOriginalState: vi.fn(),
        markBlockDirty: vi.fn(),
        prepareItemsForEmit: vi.fn(),
        removeBlockState: vi.fn(),
        isBlockDirty: vi.fn(),
        resetBlockState: vi.fn()
      },
      deps: {
        api: {},
        emit: vi.fn(),
        props: {
          collection: 'pages',
          field: 'content_blocks',
          primaryKey: 1,
          disabled: false,
          options: {}
        },
        stores: {
          fieldsStore: {
            getFieldsForCollection: vi.fn((collection) => {
              if (collection === 'content_text') {
                return [
                  { field: 'id', meta: { hidden: true } },
                  { field: 'title', meta: { interface: 'input' } },
                  { field: 'content', meta: { interface: 'input-rich-text-html' } },
                  { field: 'status', meta: { interface: 'select-dropdown' } },
                  { field: 'user_created', meta: { hidden: true } },
                  { field: 'hidden_field', meta: { hidden: true } },
                  { field: 'readonly_field', meta: { readonly: true } },
                  { field: 'no_interface_field', meta: {} }
                ];
              }
              return [];
            })
          },
          collectionsStore: {
            getCollection: vi.fn((collection) => {
              if (collection === 'content_text') {
                return {
                  collection: 'content_text',
                  name: 'Text Content',
                  meta: { icon: 'text_fields' }
                };
              }
              return null;
            })
          },
          relationsStore: {},
          notificationsStore: {}
        },
        helpers: {
          deepEqual: vi.fn(),
          m2aHelper: {}
        }
      },
      ui: {
        mergedOptions: ref({}),
        availableStatuses: [
          { value: 'published', label: 'Published' },
          { value: 'draft', label: 'Draft' },
          { value: 'archived', label: 'Archived' }
        ],
        deleteDialog: ref({ active: false }),
        itemToDelete: ref(null),
        canAddMoreBlocks: ref(true)
      },
      data: {
        relationInfo: ref(null),
        allowedCollections: ref([]),
        m2aStructure: ref({
          nestedM2AFields: {
            content_text: ['related_items']
          }
        }),
        values: ref({}),
        initialValues: ref({})
      }
    } as unknown as ExpandableBlocksContext;
  });

  describe('Item Helpers', () => {
    it('getActualItemId returns the actual item ID', () => {
      const helpers = useUIHelpers(ctx);
      const item = { id: 1, collection: 'content_text', item: { id: 101, title: 'Test' } };
      
      expect(helpers.getActualItemId(item)).toBe(101);
    });

    it('getItemTitle returns the item title', () => {
      const helpers = useUIHelpers(ctx);
      const item = { id: 1, collection: 'content_text', item: { id: 101, title: 'Test Title' } };
      
      expect(helpers.getItemTitle(item)).toBe('Test Title');
    });
  });

  describe('Collection Helpers', () => {
    it('getCollectionName returns the collection display name', () => {
      const helpers = useUIHelpers(ctx);
      const item = { id: 1, collection: 'content_text', item: { id: 101 } };
      
      expect(helpers.getCollectionName(item)).toBe('Text Content');
    });

    it('getCollectionName returns collection key when no collection info found', () => {
      const helpers = useUIHelpers(ctx);
      const item = { id: 1, collection: 'unknown_collection', item: { id: 101 } };
      
      expect(helpers.getCollectionName(item)).toBe('unknown_collection');
    });

    it('getCollectionName returns Unknown when no collection', () => {
      const helpers = useUIHelpers(ctx);
      const item = { id: 1, item: { id: 101 } };
      
      expect(helpers.getCollectionName(item)).toBe('Unknown');
    });

    it('getCollectionIcon returns the collection icon', () => {
      const helpers = useUIHelpers(ctx);
      const item = { id: 1, collection: 'content_text', item: { id: 101 } };
      
      expect(helpers.getCollectionIcon(item)).toBe('text_fields');
    });

    it('getCollectionIcon returns null when no collection info', () => {
      const helpers = useUIHelpers(ctx);
      const item = { id: 1, collection: 'unknown_collection', item: { id: 101 } };
      
      expect(helpers.getCollectionIcon(item)).toBe(null);
    });
  });

  describe('Field Helpers', () => {
    it('getFieldsForItem returns filtered fields for collection', () => {
      const helpers = useUIHelpers(ctx);
      const item = { id: 1, collection: 'content_text', item: { id: 101 } };
      
      const fields = helpers.getFieldsForItem(item);
      
      expect(fields).toHaveLength(2); // title, content (status is filtered out)
      expect(fields.map(f => f.field)).toEqual(['title', 'content']);
    });

    it('getFieldsForItem filters out hidden and readonly fields', () => {
      const helpers = useUIHelpers(ctx);
      const item = { id: 1, collection: 'content_text', item: { id: 101 } };
      
      const fields = helpers.getFieldsForItem(item);
      const fieldNames = fields.map(f => f.field);
      
      expect(fieldNames).not.toContain('hidden_field');
      expect(fieldNames).not.toContain('readonly_field');
      expect(fieldNames).not.toContain('no_interface_field');
    });

    it('getFieldsForItem filters out system fields', () => {
      const helpers = useUIHelpers(ctx);
      const item = { id: 1, collection: 'content_text', item: { id: 101 } };
      
      const fields = helpers.getFieldsForItem(item);
      const fieldNames = fields.map(f => f.field);
      
      expect(fieldNames).not.toContain('id');
      expect(fieldNames).not.toContain('user_created');
    });

    it('getFieldsForItem respects showFieldsFilter option', () => {
      ctx.ui.mergedOptions.value = {
        showFieldsFilter: ['title', 'status']
      };
      
      const helpers = useUIHelpers(ctx);
      const item = { id: 1, collection: 'content_text', item: { id: 101 } };
      
      const fields = helpers.getFieldsForItem(item);
      
      expect(fields).toHaveLength(1);
      expect(fields.map(f => f.field)).toEqual(['title']);
    });

    it('getFieldsForItem returns empty array for invalid collection', () => {
      const helpers = useUIHelpers(ctx);
      const item = { id: 1, item: { id: 101 } };
      
      const fields = helpers.getFieldsForItem(item);
      
      expect(fields).toEqual([]);
    });
  });

  describe('Status Helpers', () => {
    it('hasStatusField returns true when status field exists', () => {
      const helpers = useUIHelpers(ctx);
      const item = { id: 1, collection: 'content_text', item: { id: 101 } };
      
      expect(helpers.hasStatusField(item)).toBe(true);
    });

    it('hasStatusField returns false when no status field', () => {
      ctx.deps.stores.fieldsStore.getFieldsForCollection = vi.fn().mockReturnValue([
        { field: 'title', meta: { interface: 'input' } }
      ]);
      
      const helpers = useUIHelpers(ctx);
      const item = { id: 1, collection: 'content_text', item: { id: 101 } };
      
      expect(helpers.hasStatusField(item)).toBe(false);
    });

    it('hasStatusField returns false for invalid collection', () => {
      const helpers = useUIHelpers(ctx);
      const item = { id: 1, item: { id: 101 } };
      
      expect(helpers.hasStatusField(item)).toBe(false);
    });

    it('getItemStatus returns the item status', () => {
      const helpers = useUIHelpers(ctx);
      const item = { 
        id: 1, 
        collection: 'content_text', 
        item: { id: 101, status: 'published' } 
      };
      
      expect(helpers.getItemStatus(item)).toBe('published');
    });

    it('getItemStatus returns draft as default', () => {
      const helpers = useUIHelpers(ctx);
      const item = { 
        id: 1, 
        collection: 'content_text', 
        item: { id: 101 } 
      };
      
      expect(helpers.getItemStatus(item)).toBe('draft');
    });

    it('getStatusLabel returns the status label', () => {
      const helpers = useUIHelpers(ctx);
      
      expect(helpers.getStatusLabel('published')).toBe('Published');
      expect(helpers.getStatusLabel('draft')).toBe('Draft');
      expect(helpers.getStatusLabel('archived')).toBe('Archived');
    });

    it('getStatusLabel returns status value when no config found', () => {
      const helpers = useUIHelpers(ctx);
      
      expect(helpers.getStatusLabel('custom_status')).toBe('custom_status');
    });
  });

  describe('Nested M2A Helpers', () => {
    it('hasNestedM2A returns true when collection has nested M2A fields', () => {
      const helpers = useUIHelpers(ctx);
      const item = { 
        id: 1, 
        collection: 'content_text', 
        item: { id: 101 } 
      };
      
      expect(helpers.hasNestedM2A(item)).toBe(true);
    });

    it('hasNestedM2A returns false when collection has no nested M2A fields', () => {
      const helpers = useUIHelpers(ctx);
      const item = { 
        id: 1, 
        collection: 'content_image', 
        item: { id: 101 } 
      };
      
      expect(helpers.hasNestedM2A(item)).toBe(false);
    });

    it('hasNestedM2A returns false when no m2aStructure', () => {
      ctx.data.m2aStructure.value = null;
      
      const helpers = useUIHelpers(ctx);
      const item = { 
        id: 1, 
        collection: 'content_text', 
        item: { id: 101 } 
      };
      
      expect(helpers.hasNestedM2A(item)).toBe(false);
    });

    it('hasNestedM2A returns false when item has no item property', () => {
      const helpers = useUIHelpers(ctx);
      const item = { id: 1, collection: 'content_text' };
      
      expect(helpers.hasNestedM2A(item)).toBe(false);
    });

    it('getM2AFields extracts M2A fields from item', () => {
      const helpers = useUIHelpers(ctx);
      const item = { 
        id: 1, 
        collection: 'content_text', 
        item: { 
          id: 101,
          title: 'Test',
          related_items: [
            { id: 1, collection: 'images', item: { url: '/test.jpg' } },
            { id: 2, collection: 'videos', item: { url: '/test.mp4' } }
          ],
          another_relation: [
            { id: 3, collection: 'documents', item: { name: 'doc.pdf' } }
          ]
        } 
      };
      
      const m2aFields = helpers.getM2AFields(item);
      
      expect(Object.keys(m2aFields)).toEqual(['related_items', 'another_relation']);
      expect(m2aFields.related_items).toHaveLength(2);
      expect(m2aFields.another_relation).toHaveLength(1);
    });

    it('getM2AFields returns empty object when no M2A fields', () => {
      const helpers = useUIHelpers(ctx);
      const item = { 
        id: 1, 
        collection: 'content_text', 
        item: { 
          id: 101,
          title: 'Test',
          content: 'Some content'
        } 
      };
      
      const m2aFields = helpers.getM2AFields(item);
      
      expect(m2aFields).toEqual({});
    });

    it('getM2AFields returns empty object when item has no item property', () => {
      const helpers = useUIHelpers(ctx);
      const item = { id: 1, collection: 'content_text' };
      
      const m2aFields = helpers.getM2AFields(item);
      
      expect(m2aFields).toEqual({});
    });
  });

  describe('Formatting Helpers', () => {
    it('formatFieldName formats field names correctly', () => {
      const helpers = useUIHelpers(ctx);
      
      expect(helpers.formatFieldName('field_name')).toBe('Field Name');
      expect(helpers.formatFieldName('another_field_name')).toBe('Another Field Name');
      expect(helpers.formatFieldName('simple')).toBe('Simple');
      expect(helpers.formatFieldName('UPPERCASE')).toBe('UPPERCASE');
    });
  });
});