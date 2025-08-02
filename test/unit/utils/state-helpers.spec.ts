import { describe, it, expect, vi } from 'vitest';
import {
  deepEqual,
  deepClone,
  createStateSnapshot,
  arraysEqual,
  arraysEqualUnordered,
  createStateDiff,
  safeStringify,
  setLoadingState,
  clearLoadingState,
  updateBlockDirtyState
} from '@/utils/state-helpers';
import { ref } from 'vue';

// Mock logger
vi.mock('@/utils/logger', () => ({
  logger: {
    log: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

describe('state-helpers', () => {
  describe('deepEqual', () => {
    it('returns true for identical primitives', () => {
      expect(deepEqual(5, 5)).toBe(true);
      expect(deepEqual('test', 'test')).toBe(true);
      expect(deepEqual(true, true)).toBe(true);
      expect(deepEqual(null, null)).toBe(true);
    });

    it('returns false for different primitives', () => {
      expect(deepEqual(5, 6)).toBe(false);
      expect(deepEqual('test', 'test2')).toBe(false);
      expect(deepEqual(true, false)).toBe(false);
      expect(deepEqual(null, undefined)).toBe(false);
    });

    it('returns true for identical objects', () => {
      const obj1 = { id: 1, title: 'Test', nested: { value: 'data' } };
      const obj2 = { id: 1, title: 'Test', nested: { value: 'data' } };
      expect(deepEqual(obj1, obj2)).toBe(true);
    });

    it('returns false for different objects', () => {
      const obj1 = { id: 1, title: 'Test' };
      const obj2 = { id: 1, title: 'Different' };
      expect(deepEqual(obj1, obj2)).toBe(false);
    });

    it('handles arrays correctly', () => {
      expect(deepEqual([1, 2, 3], [1, 2, 3])).toBe(true);
      expect(deepEqual([1, 2, 3], [1, 2, 4])).toBe(false);
      expect(deepEqual([1, 2, 3], [1, 2])).toBe(false);
    });

    it('handles nested structures', () => {
      const nested1 = { a: { b: { c: [1, 2, { d: 'test' }] } } };
      const nested2 = { a: { b: { c: [1, 2, { d: 'test' }] } } };
      const nested3 = { a: { b: { c: [1, 2, { d: 'different' }] } } };
      
      expect(deepEqual(nested1, nested2)).toBe(true);
      expect(deepEqual(nested1, nested3)).toBe(false);
    });
  });

  describe('deepClone', () => {
    it('clones primitive values', () => {
      expect(deepClone('test')).toBe('test');
      expect(deepClone(123)).toBe(123);
      expect(deepClone(true)).toBe(true);
      expect(deepClone(null)).toBe(null);
      expect(deepClone(undefined)).toBe(undefined);
    });

    it('clones simple objects', () => {
      const obj = { a: 1, b: 'test', c: true };
      const cloned = deepClone(obj);
      expect(cloned).toEqual(obj);
      expect(cloned).not.toBe(obj);
    });

    it('clones nested objects', () => {
      const obj = {
        a: 1,
        b: {
          c: 2,
          d: {
            e: 3
          }
        }
      };
      const cloned = deepClone(obj);
      expect(cloned).toEqual(obj);
      expect(cloned).not.toBe(obj);
      expect(cloned.b).not.toBe(obj.b);
      expect(cloned.b.d).not.toBe(obj.b.d);
    });

    it('clones arrays', () => {
      const arr = [1, 2, 3, { a: 4 }];
      const cloned = deepClone(arr);
      expect(cloned).toEqual(arr);
      expect(cloned).not.toBe(arr);
      expect(cloned[3]).not.toBe(arr[3]);
    });

    it('clones dates', () => {
      const date = new Date('2024-01-01');
      const cloned = deepClone(date);
      expect(cloned).toEqual(date);
      expect(cloned).not.toBe(date);
      expect(cloned instanceof Date).toBe(true);
    });

    it('clones Maps', () => {
      const map = new Map([
        ['key1', 'value1'],
        ['key2', { nested: true }]
      ]);
      const cloned = deepClone(map);
      // Maps are not explicitly handled by deepClone, they're treated as objects
      expect(cloned).toEqual({});
      expect(cloned).not.toBe(map);
      expect(cloned instanceof Map).toBe(false);
    });

    it('clones Sets', () => {
      const set = new Set([1, 2, { a: 3 }]);
      const cloned = deepClone(set);
      // Sets are not explicitly handled by deepClone, they're treated as objects
      expect(cloned).toEqual({});
      expect(cloned).not.toBe(set);
      expect(cloned instanceof Set).toBe(false);
    });
  });

  describe('createStateSnapshot', () => {
    it('creates a snapshot of state', () => {
      const state = { items: [1, 2, 3], meta: { total: 3 } };
      const snapshot = createStateSnapshot(state);
      
      expect(snapshot).toEqual(state);
      expect(snapshot).not.toBe(state);
      expect(snapshot.items).not.toBe(state.items);
      expect(snapshot.meta).not.toBe(state.meta);
    });
  });

  describe('arraysEqual', () => {
    it('returns true for identical arrays', () => {
      expect(arraysEqual([1, 2, 3], [1, 2, 3])).toBe(true);
      expect(arraysEqual([], [])).toBe(true);
      expect(arraysEqual(['a', 'b'], ['a', 'b'])).toBe(true);
    });

    it('returns false for different arrays', () => {
      expect(arraysEqual([1, 2, 3], [1, 2, 4])).toBe(false);
      expect(arraysEqual([1, 2, 3], [1, 2])).toBe(false);
      expect(arraysEqual([1, 2], [2, 1])).toBe(false);
    });

    it('handles empty arrays', () => {
      expect(arraysEqual([], [])).toBe(true);
      expect(arraysEqual([1], [])).toBe(false);
      expect(arraysEqual([], [1])).toBe(false);
    });
  });

  describe('arraysEqualUnordered', () => {
    it('returns true for arrays with same elements in different order', () => {
      expect(arraysEqualUnordered([1, 2, 3], [3, 1, 2])).toBe(true);
      expect(arraysEqualUnordered(['a', 'b', 'c'], ['c', 'a', 'b'])).toBe(true);
    });

    it('returns false for arrays with different elements', () => {
      expect(arraysEqualUnordered([1, 2, 3], [1, 2, 4])).toBe(false);
      expect(arraysEqualUnordered([1, 2, 3], [1, 2])).toBe(false);
    });

    it('handles duplicates correctly', () => {
      expect(arraysEqualUnordered([1, 1, 2], [1, 2, 1])).toBe(true);
      expect(arraysEqualUnordered([1, 1, 2], [1, 2, 2])).toBe(false);
    });
  });

  describe('createStateDiff', () => {
    it('identifies added properties', () => {
      const oldState = { a: 1 };
      const newState = { a: 1, b: 2 };
      const diffFn = createStateDiff(() => oldState, () => newState);
      const diff = diffFn();
      
      expect(diff.hasChanges).toBe(true);
      expect(diff.changes).toContain('b (added)');
    });

    it('identifies modified properties', () => {
      const oldState = { a: 1, b: 'old' };
      const newState = { a: 1, b: 'new' };
      const diffFn = createStateDiff(() => oldState, () => newState);
      const diff = diffFn();
      
      expect(diff.hasChanges).toBe(true);
      expect(diff.changes).toContain('b');
    });

    it('identifies removed properties', () => {
      const oldState = { a: 1, b: 2 };
      const newState = { a: 1 };
      const diffFn = createStateDiff(() => oldState, () => newState);
      const diff = diffFn();
      
      expect(diff.hasChanges).toBe(true);
      expect(diff.changes).toContain('b (removed)');
    });

    it('handles complex changes', () => {
      const oldState = { a: 1, b: 'old', c: true };
      const newState = { a: 2, b: 'old', d: false };
      const diffFn = createStateDiff(() => oldState, () => newState);
      const diff = diffFn();
      
      expect(diff.hasChanges).toBe(true);
      expect(diff.changes).toContain('a');
      expect(diff.changes).toContain('c (removed)');
      expect(diff.changes).toContain('d (added)');
    });

    it('handles nested objects', () => {
      const oldState = { nested: { a: 1, b: 2 } };
      const newState = { nested: { a: 1, b: 3, c: 4 } };
      const diffFn = createStateDiff(() => oldState, () => newState);
      const diff = diffFn();
      
      expect(diff.hasChanges).toBe(true);
      expect(diff.changes).toContain('nested.b');
      expect(diff.changes).toContain('nested.c (added)');
    });
  });

  describe('safeStringify', () => {
    it('stringifies simple objects', () => {
      const obj = { a: 1, b: 'test' };
      expect(safeStringify(obj)).toBe('{"a":1,"b":"test"}');
    });

    it('handles circular references', () => {
      const obj = { a: 1 };
      obj.self = obj;
      
      const result = safeStringify(obj);
      expect(result).toContain('"a":1');
      expect(result).toContain('[Circular]');
    });

    it('respects spacing parameter', () => {
      const obj = { a: 1, b: 2 };
      const result = safeStringify(obj, 2);
      expect(result).toContain('\n');
      expect(result).toContain('  ');
    });

    it('handles special values', () => {
      const obj = {
        undef: undefined,
        func: () => {},
        symbol: Symbol('test')
      };
      
      const result = safeStringify(obj);
      // Functions are converted to [Function], undefined is omitted, symbols are omitted
      expect(result).toBe('{"func":"[Function]"}');
    });
  });

  describe('setLoadingState', () => {
    it('sets loading state for a key', () => {
      const loading = ref({});
      setLoadingState(loading, 'test-key');
      
      expect(loading.value['test-key']).toBe(true);
    });

    it('sets loading state for numeric keys', () => {
      const loading = ref({});
      setLoadingState(loading, 123);
      
      expect(loading.value[123]).toBe(true);
    });

    it('preserves existing loading states', () => {
      const loading = ref({ existing: true });
      setLoadingState(loading, 'new-key');
      
      expect(loading.value.existing).toBe(true);
      expect(loading.value['new-key']).toBe(true);
    });
  });

  describe('clearLoadingState', () => {
    it('clears loading state for a key', () => {
      const loading = ref({ 'test-key': true });
      clearLoadingState(loading, 'test-key');
      
      expect(loading.value['test-key']).toBeUndefined();
    });

    it('clears loading state for numeric keys', () => {
      const loading = ref({ 123: true });
      clearLoadingState(loading, 123);
      
      expect(loading.value[123]).toBeUndefined();
    });

    it('preserves other loading states', () => {
      const loading = ref({ key1: true, key2: true });
      clearLoadingState(loading, 'key1');
      
      expect(loading.value.key1).toBeUndefined();
      expect(loading.value.key2).toBe(true);
    });
  });

  describe('updateBlockDirtyState', () => {
    it('marks block as dirty when data differs', () => {
      const originalStates = new Map([['block-1', { id: 1, title: 'Original' }]]);
      const dirtyStates = new Map();
      const currentData = { id: 1, title: 'Modified' };
      const deepEqualFn = (a, b) => JSON.stringify(a) === JSON.stringify(b);
      
      updateBlockDirtyState('block-1', currentData, originalStates, dirtyStates, deepEqualFn);
      
      expect(dirtyStates.get('block-1')).toBe(true);
    });

    it('marks block as clean when data matches', () => {
      const originalStates = new Map([['block-1', { id: 1, title: 'Same' }]]);
      const dirtyStates = new Map([['block-1', true]]);
      const currentData = { id: 1, title: 'Same' };
      const deepEqualFn = (a, b) => JSON.stringify(a) === JSON.stringify(b);
      
      updateBlockDirtyState('block-1', currentData, originalStates, dirtyStates, deepEqualFn);
      
      expect(dirtyStates.get('block-1')).toBe(false);
    });

    it('handles null original data', () => {
      const originalStates = new Map(); // No original state
      const dirtyStates = new Map();
      const currentData = { id: 1, title: 'New' };
      const deepEqualFn = (a, b) => JSON.stringify(a) === JSON.stringify(b);
      
      updateBlockDirtyState('block-1', currentData, originalStates, dirtyStates, deepEqualFn);
      
      expect(dirtyStates.get('block-1')).toBe(true);
    });

    it('handles complex nested changes', () => {
      const originalStates = new Map([['block-1', { 
        id: 1, 
        meta: { tags: ['a', 'b'], author: 'John' }
      }]]);
      const dirtyStates = new Map();
      const currentData = { 
        id: 1, 
        meta: { tags: ['a', 'b', 'c'], author: 'John' }
      };
      const deepEqualFn = (a, b) => JSON.stringify(a) === JSON.stringify(b);
      
      updateBlockDirtyState('block-1', currentData, originalStates, dirtyStates, deepEqualFn);
      
      expect(dirtyStates.get('block-1')).toBe(true);
    });
  });
});