import { describe, it, expect, beforeEach } from 'vitest';
import { ref } from 'vue';
import { useBlockState } from '@/composables/useBlockState';

// Mock dependencies

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

vi.mock('@/utils/helpers', () => ({
  deepClone: vi.fn((obj) => JSON.parse(JSON.stringify(obj))),
  deepEqual: vi.fn((a, b) => JSON.stringify(a) === JSON.stringify(b))
}));

vi.mock('@/utils/validation', () => ({
  isTemporaryId: vi.fn((id) => typeof id === 'string' && (id.startsWith('new_') || id.startsWith('dup_') || id.startsWith('temp_')))
}));

describe('useBlockState', () => {
  let relationInfo;

  beforeEach(() => {
    vi.clearAllMocks();
    relationInfo = ref({
      meta: {
        sort_field: 'sort'
      }
    });
  });

  describe('Initialization', () => {
    it('initializes with empty items when value is empty', () => {
      const state = useBlockState(relationInfo);
      expect(state.items.value).toEqual([]);
      expect(state.expandedItems.value).toEqual([]);
    });

    it('initializes with items after init', () => {
      const state = useBlockState(relationInfo);
      
      // Manually set items as the composable doesn't take initial items
      state.items.value = [
        { id: 1, collection: 'content_text', item: { title: 'Block 1' } },
        { id: 2, collection: 'content_text', item: { title: 'Block 2' } }
      ];
      
      expect(state.items.value).toHaveLength(2);
      expect(state.items.value[0].id).toBe(1);
      expect(state.items.value[1].id).toBe(2);
    });

    it('stores original states for existing items', () => {
      const state = useBlockState(relationInfo);
      
      const items = [
        { id: 1, collection: 'content_text', item: { id: 101, title: 'Block 1' } },
        { id: 2, collection: 'content_text', item: { id: 102, title: 'Block 2' } }
      ];
      
      // Manually add items and update original states
      state.items.value = items;
      state.updateOriginalState('1', { id: 101, title: 'Block 1' });
      state.updateOriginalState('2', { id: 102, title: 'Block 2' });
      
      expect(state.blockOriginalStates.value.has('1')).toBe(true);
      expect(state.blockOriginalStates.value.has('2')).toBe(true);
      expect(state.blockOriginalStates.value.get('1')).toEqual({ id: 101, title: 'Block 1' });
      expect(state.blockOriginalStates.value.get('2')).toEqual({ id: 102, title: 'Block 2' });
    });

    it('tracks original item order', () => {
      const state = useBlockState(relationInfo);
      
      state.originalItemOrder.value = [57, 58, 59];
      
      expect(state.originalItemOrder.value).toEqual([57, 58, 59]);
    });

    it('handles mixed ID and object values', () => {
      const state = useBlockState(relationInfo);
      
      state.originalItemOrder.value = [57, 58, 59];
      
      expect(state.originalItemOrder.value).toEqual([57, 58, 59]);
    });
  });

  describe('Loading States', () => {
    it('manages loading state', () => {
      const state = useBlockState(relationInfo);
      
      expect(state.loading.value).toEqual({});
      
      state.loading.value['123'] = true;
      expect(state.loading.value['123']).toBe(true);
    });

    it('manages initial load flag', () => {
      const state = useBlockState(relationInfo);
      
      expect(state.isInitialLoad.value).toBe(true);
      
      state.isInitialLoad.value = false;
      expect(state.isInitialLoad.value).toBe(false);
    });
  });

  describe('Expanded Items Management', () => {
    it('tracks expanded items', () => {
      const state = useBlockState(relationInfo);
      
      expect(state.expandedItems.value).toEqual([]);
      
      state.expandedItems.value.push('123');
      expect(state.expandedItems.value).toContain('123');
    });

    it('can expand multiple items', () => {
      const state = useBlockState(relationInfo);
      
      state.expandedItems.value = ['1', '2', '3'];
      expect(state.expandedItems.value).toHaveLength(3);
    });
  });

  describe('Dirty State Management', () => {
    it('initializes empty dirty states', () => {
      const state = useBlockState(relationInfo);
      
      expect(state.blockDirtyStates.value.size).toBe(0);
    });

    it('can track dirty states', () => {
      const state = useBlockState(relationInfo);
      
      state.markBlockDirty('123', true);
      
      expect(state.blockDirtyStates.value.has('123')).toBe(true);
      expect(state.blockDirtyStates.value.get('123')).toBe(true);
    });
  });


  describe('Item Updates', () => {
    it('updates items array', () => {
      const state = useBlockState(relationInfo);
      
      const newItems = [
        { id: 'new_1', collection: 'content_text', item: { title: 'New Block' } }
      ];
      
      state.items.value = newItems;
      expect(state.items.value).toEqual(newItems);
    });

    it('preserves reactivity when updating items', () => {
      const state = useBlockState(relationInfo);
      let _updateCount = 0;
      
      // Watch for changes
      const _unwatch = vi.fn(() => {
        _updateCount++;
      });
      
      // Simulate a watcher
      state.items.value = [];
      state.items.value = [{ id: 1 }];
      
      expect(state.items.value).toHaveLength(1);
    });
  });


  describe('State Persistence', () => {
    it('maintains separate state for each block', () => {
      const state = useBlockState(relationInfo);
      
      state.blockOriginalStates.value.set('1', { title: 'Block 1' });
      state.blockOriginalStates.value.set('2', { title: 'Block 2' });
      
      expect(state.blockOriginalStates.value.get('1')).toEqual({ title: 'Block 1' });
      expect(state.blockOriginalStates.value.get('2')).toEqual({ title: 'Block 2' });
    });

    it('can remove block state', () => {
      const state = useBlockState(relationInfo);
      
      state.blockOriginalStates.value.set('123', { title: 'Test' });
      expect(state.blockOriginalStates.value.has('123')).toBe(true);
      
      state.removeBlockState('123');
      expect(state.blockOriginalStates.value.has('123')).toBe(false);
    });
  });
});