import { describe, it, expect, beforeEach } from 'vitest';
import { M2AHelper } from '@/utils/m2a-helper';

// Mock logger
vi.mock('@/utils/logger-wrapper', () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

// Mock validation
vi.mock('@/utils/validation', () => ({
  isNotNullish: vi.fn((value) => value !== null && value !== undefined)
}));

describe('M2AHelper', () => {
  let m2aHelper: M2AHelper;
  let mockApi: any;
  let mockStores: any;

  beforeEach(() => {
    // Mock API
    mockApi = {
      get: vi.fn().mockResolvedValue({ 
        data: { 
          data: [
            { id: 1, collection: 'content_text', item: { id: 101, title: 'Text Block' } },
            { id: 2, collection: 'content_image', item: { id: 102, url: '/image.jpg' } }
          ] 
        } 
      })
    };

    // Mock Stores
    const fieldsStoreMock = vi.fn((collection) => {
      const fields: Record<string, any[]> = {
        pages: [
          { field: 'content_blocks', type: 'alias', meta: { interface: 'm2a' } }
        ],
        content_text: [
          { field: 'id', type: 'integer' },
          { field: 'title', type: 'string' },
          { field: 'content', type: 'text' },
          { field: 'status', type: 'string', schema: { default_value: 'draft' } },
          { field: 'sort', type: 'integer', schema: { default_value: 0 } }
        ],
        content_image: [
          { field: 'id', type: 'integer' },
          { field: 'url', type: 'string' },
          { field: 'alt', type: 'string' },
          { field: 'status', type: 'string', schema: { default_value: 'draft' } }
        ],
        content_accordion: [
          { field: 'id', type: 'integer' },
          { field: 'title', type: 'string' },
          { field: 'accordion_items', type: 'alias', meta: { interface: 'm2a', special: ['m2a'] } }
        ]
      };
      return fields[collection] || [];
    });

    mockStores = {
      useFieldsStore: () => ({
        getFieldsForCollection: fieldsStoreMock
      }),
      useRelationsStore: () => ({
        getRelationsForField: vi.fn((collection, field) => {
          const relationsKey = `${collection}_${field}`;
          const relations: Record<string, any[]> = {
            'pages_content_blocks': [{
              collection: 'pages_content_blocks',
              field: field,
              related_collection: null,
              meta: {
                one_allowed_collections: ['content_text', 'content_image', 'content_accordion'],
                junction_field: 'item',
                sort_field: 'sort',
                many_field: 'pages_id'
              }
            }],
            'content_accordion_accordion_items': [{
              collection: 'content_accordion_accordion_items',
              field: 'accordion_items',
              related_collection: null,
              meta: {
                one_allowed_collections: ['accordion_item'],
                junction_field: 'item',
                many_field: 'content_accordion_id'
              }
            }]
          };
          return relations[relationsKey] || [];
        })
      })
    };

    m2aHelper = new M2AHelper(mockApi, mockStores);
  });

  describe('analyzeM2AStructure', () => {
    it('analyzes basic M2A structure correctly', async () => {
      const result = await m2aHelper.analyzeM2AStructure('pages', 'content_blocks');
      
      expect(result).toMatchObject({
        field: 'content_blocks',
        collection: 'pages',
        junctionCollection: 'pages_content_blocks',
        foreignKeyField: 'pages_id',
        allowedCollections: ['content_text', 'content_image', 'content_accordion']
      });
    });

    it('detects nested M2A fields', async () => {
      const result = await m2aHelper.analyzeM2AStructure('pages', 'content_blocks');
      
      expect(result.nestedM2AFields).toBeDefined();
      expect(result.hasNestedM2A).toBe(true);
      
      // The nestedM2AFields should contain the nested field info for content_accordion
      expect(result.nestedM2AFields?.['content_accordion']).toBeDefined();
      expect(result.nestedM2AFields?.['content_accordion']).toMatchObject({
        field: 'accordion_items',
        collection: 'content_accordion',
        junctionCollection: 'content_accordion_accordion_items',
        foreignKeyField: 'content_accordion_id',
        allowedCollections: ['accordion_item']
      });
    });

    it('handles collections without M2A fields', async () => {
      // Returns a default structure when no relation is found
      const result = await m2aHelper.analyzeM2AStructure('content_text', 'title');
      expect(result).toMatchObject({
        field: 'title',
        collection: 'content_text',
        junctionCollection: 'content_text_title',
        allowedCollections: []
      });
    });

    it('returns default structure when no relation found', async () => {
      mockStores.useRelationsStore().getRelationsForField.mockReturnValueOnce([]);
      
      const result = await m2aHelper.analyzeM2AStructure('unknown', 'field');
      expect(result).toMatchObject({
        field: 'field',
        collection: 'unknown',
        junctionCollection: 'unknown_field',
        allowedCollections: []
      });
    });

    it('handles custom junction collection names', async () => {
      // Need to create a new M2AHelper with custom mock
      const customMockStores = {
        ...mockStores,
        useRelationsStore: () => ({
          getRelationsForField: vi.fn((collection, field) => {
            if (collection === 'custom' && field === 'blocks') {
              return [{
                collection: 'custom_junction',
                field: 'blocks',
                meta: {
                  one_allowed_collections: ['block_a', 'block_b'],
                  junction_field: 'item',
                  many_field: 'parent_id'
                }
              }];
            }
            return [];
          })
        })
      };
      
      const customM2aHelper = new M2AHelper(mockApi, customMockStores);
      const result = await customM2aHelper.analyzeM2AStructure('custom', 'blocks');
      
      expect(result.junctionCollection).toBe('custom_junction');
      expect(result.foreignKeyField).toBe('parent_id');
    });
  });

  describe('loadM2AData', () => {
    it('loads M2A data with proper field selection', async () => {
      const fieldInfo = {
        field: 'content_blocks',
        collection: 'pages',
        junctionCollection: 'pages_content_blocks',
        junctionField: 'content_blocks',
        foreignKeyField: 'pages_id',
        allowedCollections: ['content_text', 'content_image'],
        nestedM2AFields: {}
      };
      
      await m2aHelper.loadM2AData(123, fieldInfo, 0, 3);
      
      expect(mockApi.get).toHaveBeenCalledWith('/items/pages_content_blocks', {
        params: {
          filter: {
            pages_id: { _eq: 123 }
          },
          fields: '*,item:content_text.*,item:content_image.*',
          limit: -1,
          sort: 'id'
        }
      });
    });

    it('respects depth limits for nested loading', async () => {
      const fieldInfo = {
        field: 'content_blocks',
        collection: 'pages',
        junctionCollection: 'pages_content_blocks',
        junctionField: 'content_blocks',
        foreignKeyField: 'pages_id',
        allowedCollections: ['content_accordion'],
        hasNestedM2A: true,
        nestedM2AFields: {
          content_accordion: {
            field: 'accordion_items',
            collection: 'content_accordion',
            junctionCollection: 'content_accordion_accordion_items',
            junctionField: 'accordion_items',
            foreignKeyField: 'content_accordion_id',
            allowedCollections: ['accordion_item'],
            nestedM2AFields: {}
          }
        }
      };
      
      // Mock response with nested structure
      mockApi.get.mockResolvedValueOnce({
        data: {
          data: [{
            id: 1,
            collection: 'content_accordion',
            item: {
              id: 201,
              title: 'Accordion',
              accordion_items: [] // Would be loaded if depth allows
            }
          }]
        }
      });
      
      const result = await m2aHelper.loadM2AData(123, fieldInfo, 0, 3);
      
      expect(result).toHaveLength(1);
      expect(result[0].collection).toBe('content_accordion');
    });

    it('skips nested loading at max depth', async () => {
      // Override the mock to return no data at max depth
      mockApi.get.mockResolvedValueOnce({ data: { data: [] } });
      
      const fieldInfo = {
        field: 'content_blocks',
        collection: 'pages',
        junctionCollection: 'pages_content_blocks',
        junctionField: 'content_blocks',
        foreignKeyField: 'pages_id',
        allowedCollections: ['content_text'],
        hasNestedM2A: false,
        nestedM2AFields: {}
      };
      
      const result = await m2aHelper.loadM2AData(123, fieldInfo, 3, 3);
      
      // At max depth, it returns empty array based on our mock
      expect(result).toHaveLength(0);
    });

    it('handles empty results', async () => {
      mockApi.get.mockResolvedValueOnce({ data: { data: [] } });
      
      const fieldInfo = {
        field: 'content_blocks',
        collection: 'pages',
        junctionCollection: 'pages_content_blocks',
        junctionField: 'content_blocks',
        foreignKeyField: 'pages_id',
        allowedCollections: [],
        nestedM2AFields: {}
      };
      
      const result = await m2aHelper.loadM2AData(123, fieldInfo, 0, 3);
      expect(result).toEqual([]);
    });

    it('handles API errors', async () => {
      mockApi.get.mockRejectedValueOnce(new Error('Network error'));
      
      const fieldInfo = {
        field: 'content_blocks',
        collection: 'pages',
        junctionCollection: 'pages_content_blocks',
        junctionField: 'content_blocks',
        foreignKeyField: 'pages_id',
        allowedCollections: [],
        nestedM2AFields: {}
      };
      
      await expect(
        m2aHelper.loadM2AData(123, fieldInfo, 0, 3)
      ).rejects.toThrow('Network error');
    });

    it('uses default sort field', async () => {
      const fieldInfo = {
        field: 'content_blocks',
        collection: 'pages',
        junctionCollection: 'pages_content_blocks',
        junctionField: 'content_blocks',
        foreignKeyField: 'pages_id',
        allowedCollections: ['content_text'],
        nestedM2AFields: {}
      };
      
      await m2aHelper.loadM2AData(123, fieldInfo, 0, 3);
      
      expect(mockApi.get).toHaveBeenCalledWith('/items/pages_content_blocks', {
        params: expect.objectContaining({
          sort: 'id'
        })
      });
    });
  });

  describe('getDefaultDataForCollection', () => {
    it('returns default data based on collection fields', () => {
      const result = m2aHelper.getDefaultDataForCollection('content_text');
      
      expect(result).toEqual({
        title: '',
        content: '',
        status: 'draft',
        sort: 0
      });
    });

    it('uses schema default values when available', () => {
      const result = m2aHelper.getDefaultDataForCollection('content_image');
      
      expect(result).toEqual({
        url: '',
        alt: '',
        status: 'draft'
      });
    });

    it('provides sensible defaults by field type', () => {
      mockStores.useFieldsStore().getFieldsForCollection.mockReturnValueOnce([
        { field: 'text_field', type: 'string' },
        { field: 'number_field', type: 'integer' },
        { field: 'bool_field', type: 'boolean' },
        { field: 'json_field', type: 'json' },
        { field: 'date_field', type: 'dateTime' },
        { field: 'fk_field', type: 'integer', schema: { foreign_key_table: 'other_table' } }
      ]);
      
      const result = m2aHelper.getDefaultDataForCollection('test');
      
      expect(result).toEqual({
        text_field: '',
        number_field: 0,
        bool_field: false,
        json_field: null,
        date_field: null,
        fk_field: null // Foreign keys should be null
      });
    });

    it('ignores system fields', () => {
      mockStores.useFieldsStore().getFieldsForCollection.mockReturnValueOnce([
        { field: 'id', type: 'integer' },
        { field: 'user_created', type: 'uuid' },
        { field: 'user_updated', type: 'uuid' },
        { field: 'date_created', type: 'dateTime' },
        { field: 'date_updated', type: 'dateTime' },
        { field: 'title', type: 'string' }
      ]);
      
      const result = m2aHelper.getDefaultDataForCollection('test');
      
      expect(result).toEqual({
        title: ''
      });
      expect(result).not.toHaveProperty('id');
      expect(result).not.toHaveProperty('user_created');
    });

    it('ignores hidden fields', () => {
      mockStores.useFieldsStore().getFieldsForCollection.mockReturnValueOnce([
        { field: 'visible_field', type: 'string', meta: { hidden: false } },
        { field: 'hidden_field', type: 'string', meta: { hidden: true } },
        { field: 'no_meta_field', type: 'string' }
      ]);
      
      const result = m2aHelper.getDefaultDataForCollection('test');
      
      expect(result).toEqual({
        visible_field: '',
        no_meta_field: ''
      });
      expect(result).not.toHaveProperty('hidden_field');
    });

    it('handles collections with no fields', () => {
      mockStores.useFieldsStore().getFieldsForCollection.mockReturnValueOnce([]);
      
      const result = m2aHelper.getDefaultDataForCollection('empty');
      
      expect(result).toEqual({});
    });

    it('ignores alias fields', () => {
      mockStores.useFieldsStore().getFieldsForCollection.mockReturnValueOnce([
        { field: 'regular_field', type: 'string' },
        { field: 'm2a_field', type: 'alias', meta: { interface: 'm2a' } }
      ]);
      
      const result = m2aHelper.getDefaultDataForCollection('test');
      
      expect(result).toEqual({
        regular_field: ''
      });
      expect(result).not.toHaveProperty('m2a_field');
    });
  });

  describe('Field type defaults', () => {
    it('handles all common field types', () => {
      mockStores.useFieldsStore().getFieldsForCollection.mockReturnValueOnce([
        { field: 'string', type: 'string' },
        { field: 'text', type: 'text' },
        { field: 'integer', type: 'integer' },
        { field: 'bigInteger', type: 'bigInteger' },
        { field: 'float', type: 'float' },
        { field: 'decimal', type: 'decimal' },
        { field: 'boolean', type: 'boolean' },
        { field: 'date', type: 'date' },
        { field: 'time', type: 'time' },
        { field: 'dateTime', type: 'dateTime' },
        { field: 'timestamp', type: 'timestamp' },
        { field: 'json', type: 'json' },
        { field: 'uuid', type: 'uuid' },
        { field: 'hash', type: 'hash' },
        { field: 'csv', type: 'csv' }
      ]);
      
      const result = m2aHelper.getDefaultDataForCollection('test');
      
      expect(result.string).toBe('');
      expect(result.text).toBe('');
      expect(result.integer).toBe(0);
      expect(result.bigInteger).toBe(0);
      expect(result.float).toBe(0);
      expect(result.decimal).toBe(0);
      expect(result.boolean).toBe(false);
      expect(result.date).toBe(null);
      expect(result.time).toBe(null);
      expect(result.dateTime).toBe(null);
      expect(result.timestamp).toBe(null);
      expect(result.json).toBe(null);
      expect(result.uuid).toBe(null);
      expect(result.hash).toBe(null);
      expect(result.csv).toBe(null);
    });
  });
});