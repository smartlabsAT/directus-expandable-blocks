import { expect, afterEach, vi } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
import { config } from '@vue/test-utils';

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers);

// Global test setup
afterEach(() => {
  // Clear all mocks after each test
  vi.clearAllMocks();
});

// Configure Vue Test Utils globally
config.global.mocks = {
  $t: (key: string) => key,
};

// Mock inject for all tests
config.global.provide = {
  system: {
    api: {
      get: vi.fn().mockResolvedValue({ data: { data: [] } }),
      post: vi.fn().mockResolvedValue({ data: { data: { id: 1 } } }),
      patch: vi.fn().mockResolvedValue({ data: { data: {} } }),
      delete: vi.fn().mockResolvedValue({}),
    },
    stores: {
      useFieldsStore: () => ({
        getFieldsForCollection: vi.fn().mockReturnValue([
          { field: 'title', type: 'string' },
          { field: 'status', type: 'string' }
        ])
      }),
      useRelationsStore: () => ({
        getRelationsForField: vi.fn().mockReturnValue([{
          collection: 'pages_content_blocks',
          field: 'content_blocks',
          meta: {
            one_allowed_collections: ['content_text', 'content_image']
          }
        }])
      }),
      useCollectionsStore: () => ({
        getCollection: vi.fn().mockReturnValue({
          collection: 'content_text',
          name: 'Content Text',
          meta: { icon: 'text_fields' }
        })
      })
    }
  },
  values: { value: {} },
  initialValues: { value: {} }
};

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
})) as any;

// Mock ResizeObserver
global.ResizeObserver = vi.fn(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
})) as any;