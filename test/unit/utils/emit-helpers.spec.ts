import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, type Ref } from 'vue';
import { emitChanges, emitSaveChanges } from '../../../src/utils/emit-helpers';
import type { EmitOptions } from '../../../src/utils/emit-helpers';

// Mock logger
vi.mock('../../../src/utils/logger', () => ({
  logger: {
    log: vi.fn()
  }
}));

// Mock nextTick
vi.mock('vue', async () => {
  const actual = await vi.importActual('vue');
  return {
    ...actual,
    nextTick: vi.fn((callback) => callback && callback())
  };
});

describe('emit-helpers', () => {
  let mockEmit: ReturnType<typeof vi.fn>;
  let mockPrepareItemsForEmit: ReturnType<typeof vi.fn>;
  let isInternalUpdate: Ref<boolean>;
  
  beforeEach(() => {
    vi.clearAllMocks();
    mockEmit = vi.fn();
    mockPrepareItemsForEmit = vi.fn((items) => items.map(item => item.id));
    isInternalUpdate = ref(false);
  });

  describe('emitChanges', () => {
    it('emits input event with prepared value', () => {
      const items = [
        { id: 1, collection: 'content_text', item: { title: 'Test 1' } },
        { id: 2, collection: 'content_text', item: { title: 'Test 2' } }
      ];
      
      const options: EmitOptions = {
        items,
        emit: mockEmit,
        prepareItemsForEmit: mockPrepareItemsForEmit,
        isInternalUpdate,
        source: 'TEST'
      };
      
      emitChanges(options);
      
      expect(mockPrepareItemsForEmit).toHaveBeenCalledWith(items, undefined, undefined);
      expect(mockEmit).toHaveBeenCalledWith('input', [1, 2]);
      expect(mockEmit).toHaveBeenCalledTimes(1);
    });

    it('sets and resets internal update flag', async () => {
      const items = [{ id: 1, collection: 'content_text', item: {} }];
      
      // Create a mock for nextTick that we can control
      const nextTickCallbacks: Array<() => void> = [];
      vi.mocked(await import('vue')).nextTick.mockImplementation((callback?: () => void) => {
        if (callback) {
          nextTickCallbacks.push(callback);
        }
        return Promise.resolve();
      });
      
      const options: EmitOptions = {
        items,
        emit: mockEmit,
        prepareItemsForEmit: mockPrepareItemsForEmit,
        isInternalUpdate,
        source: 'TEST'
      };
      
      expect(isInternalUpdate.value).toBe(false);
      
      emitChanges(options);
      
      // Should be set to true immediately
      expect(isInternalUpdate.value).toBe(true);
      
      // After nextTick, should be reset to false
      const { nextTick } = await import('vue');
      expect(nextTick).toHaveBeenCalled();
      
      // Execute the nextTick callback
      nextTickCallbacks.forEach(cb => cb());
      
      // Now it should be false
      expect(isInternalUpdate.value).toBe(false);
    });

    it('logs the emission with context', async () => {
      const { logger } = vi.mocked(await import('../../../src/utils/logger'));
      const items = [
        { id: 1, collection: 'content_text', item: {} },
        { id: 2, collection: 'content_image', item: {} }
      ];
      
      const options: EmitOptions = {
        items,
        emit: mockEmit,
        prepareItemsForEmit: mockPrepareItemsForEmit,
        isInternalUpdate,
        source: 'TEST_ACTION',
        debugData: { extra: 'data' }
      };
      
      emitChanges(options);
      
      expect(logger.log).toHaveBeenCalledWith('🔄 EMIT - TEST_ACTION:', {
        itemCount: 2,
        emitValue: [1, 2],
        hasSort: false,
        extra: 'data'
      });
    });

    it('handles sort field when provided', () => {
      const items = [{ id: 1, collection: 'content_text', item: {} }];
      
      const options: EmitOptions = {
        items,
        emit: mockEmit,
        prepareItemsForEmit: mockPrepareItemsForEmit,
        isInternalUpdate,
        source: 'SORT',
        sortField: 'sort_order'
      };
      
      emitChanges(options);
      
      expect(mockPrepareItemsForEmit).toHaveBeenCalledWith(items, 'sort_order', undefined);
    });

    it('handles empty arrays', () => {
      const options: EmitOptions = {
        items: [],
        emit: mockEmit,
        prepareItemsForEmit: mockPrepareItemsForEmit,
        isInternalUpdate,
        source: 'EMPTY'
      };
      
      emitChanges(options);
      
      expect(mockEmit).toHaveBeenCalledWith('input', []);
    });

    it('handles complex prepareItemsForEmit transformations', () => {
      const items = [
        { id: 1, collection: 'content_text', item: { title: 'Test' } },
        { id: 'new_1', collection: 'content_image', item: { url: '/test.jpg' } }
      ];
      
      const customPrepare = vi.fn((items) => 
        items.map(item => ({
          junction_id: item.id,
          collection: item.collection,
          data: item.item
        }))
      );
      
      const options: EmitOptions = {
        items,
        emit: mockEmit,
        prepareItemsForEmit: customPrepare,
        isInternalUpdate,
        source: 'TRANSFORM'
      };
      
      emitChanges(options);
      
      expect(mockEmit).toHaveBeenCalledWith('input', [
        { junction_id: 1, collection: 'content_text', data: { title: 'Test' } },
        { junction_id: 'new_1', collection: 'content_image', data: { url: '/test.jpg' } }
      ]);
    });
  });

  describe('emitSaveChanges', () => {
    it('calls emitChanges with save context', () => {
      const items = [{ id: 1, collection: 'content_text', item: {} }];
      
      emitSaveChanges(
        items,
        mockEmit,
        mockPrepareItemsForEmit,
        isInternalUpdate
      );
      
      expect(mockEmit).toHaveBeenCalledWith('input', [1]);
    });

    it('uses default source when not provided', async () => {
      const { logger } = vi.mocked(await import('../../../src/utils/logger'));
      const items = [{ id: 1, collection: 'content_text', item: {} }];
      
      emitSaveChanges(
        items,
        mockEmit,
        mockPrepareItemsForEmit,
        isInternalUpdate
      );
      
      expect(logger.log).toHaveBeenCalledWith(
        '🔄 EMIT - SAVE STATE:',
        expect.objectContaining({
          itemCount: 1,
          operation: 'save'
        })
      );
    });

    it('uses custom source when provided', async () => {
      const { logger } = vi.mocked(await import('../../../src/utils/logger'));
      const items = [{ id: 1, collection: 'content_text', item: {} }];
      
      emitSaveChanges(
        items,
        mockEmit,
        mockPrepareItemsForEmit,
        isInternalUpdate,
        'CUSTOM_SAVE'
      );
      
      expect(logger.log).toHaveBeenCalledWith(
        '🔄 EMIT - CUSTOM_SAVE:',
        expect.objectContaining({
          itemCount: 1,
          operation: 'save'
        })
      );
    });

    it('includes timestamp in debug data', async () => {
      const { logger } = vi.mocked(await import('../../../src/utils/logger'));
      const items = [{ id: 1, collection: 'content_text', item: {} }];
      
      emitSaveChanges(
        items,
        mockEmit,
        mockPrepareItemsForEmit,
        isInternalUpdate
      );
      
      const logCall = logger.log.mock.calls[0];
      const debugData = logCall[1];
      
      expect(debugData).toHaveProperty('timestamp');
      expect(debugData.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('handles multiple items correctly', () => {
      const items = [
        { id: 1, collection: 'content_text', item: { title: 'Item 1' } },
        { id: 2, collection: 'content_image', item: { url: '/img.jpg' } },
        { id: 3, collection: 'content_hero', item: { headline: 'Hero' } }
      ];
      
      emitSaveChanges(
        items,
        mockEmit,
        mockPrepareItemsForEmit,
        isInternalUpdate
      );
      
      expect(mockEmit).toHaveBeenCalledWith('input', [1, 2, 3]);
    });
  });
});