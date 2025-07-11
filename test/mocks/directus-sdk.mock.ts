import { vi } from 'vitest';

// Mock useApi
export const useApi = vi.fn(() => ({
  get: vi.fn().mockResolvedValue({ data: { data: [] } }),
  post: vi.fn().mockResolvedValue({ data: { data: { id: 1 } } }),
  patch: vi.fn().mockResolvedValue({ data: { data: {} } }),
  delete: vi.fn().mockResolvedValue({}),
}));

// Mock useStores
export const useStores = vi.fn(() => ({
  useFieldsStore: () => ({
    getFieldsForCollection: vi.fn((collection: string) => {
      // Return mock fields based on collection
      return [
        {
          field: 'id',
          type: 'integer',
          meta: { interface: 'input', hidden: true }
        },
        {
          field: 'title',
          type: 'string',
          meta: { interface: 'input' }
        },
        {
          field: 'content',
          type: 'text',
          meta: { interface: 'input-rich-text-html' }
        },
        {
          field: 'status',
          type: 'string',
          meta: { interface: 'select-dropdown' }
        }
      ];
    }),
    getField: vi.fn()
  }),
  useRelationsStore: () => ({
    getRelationsForField: vi.fn((collection: string, field: string) => {
      return [{
        collection: `${collection}_${field}`,
        field: field,
        related_collection: null,
        meta: {
          one_allowed_collections: ['content_text', 'content_image'],
          junction_field: 'item',
          sort_field: 'sort'
        }
      }];
    })
  }),
  useCollectionsStore: () => ({
    getCollection: vi.fn((collection: string) => ({
      collection,
      name: collection.split('_').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' '),
      meta: {
        icon: 'box',
        display_template: '{{title}}'
      }
    }))
  }),
  useNotificationsStore: () => ({
    add: vi.fn()
  })
}));

// Mock defineInterface
export const defineInterface = vi.fn((config) => config);