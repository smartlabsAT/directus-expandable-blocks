import { describe, it, expect, beforeEach } from 'vitest';
import {
  deepEqual,
  deepClone,
  StateTracker,
  createStateSnapshot,
  arraysEqual,
  arraysEqualUnordered,
  OrderTracker,
  BatchStateUpdater,
  createStateDiff,
  safeStringify
} from './state-helpers';

describe('state-helpers', () => {
  describe('deepEqual', () => {
    it('should return true for identical primitives', () => {
      expect(deepEqual(1, 1)).toBe(true);
      expect(deepEqual('test', 'test')).toBe(true);
      expect(deepEqual(true, true)).toBe(true);
      expect(deepEqual(null, null)).toBe(true);
      expect(deepEqual(undefined, undefined)).toBe(true);
    });

    it('should return false for different primitives', () => {
      expect(deepEqual(1, 2)).toBe(false);
      expect(deepEqual('test', 'test2')).toBe(false);
      expect(deepEqual(true, false)).toBe(false);
      expect(deepEqual(null, undefined)).toBe(false);
    });

    it('should compare objects deeply', () => {
      const obj1 = { a: 1, b: { c: 2, d: [3, 4] } };
      const obj2 = { a: 1, b: { c: 2, d: [3, 4] } };
      const obj3 = { a: 1, b: { c: 2, d: [3, 5] } };
      
      expect(deepEqual(obj1, obj2)).toBe(true);
      expect(deepEqual(obj1, obj3)).toBe(false);
    });

    it('should handle arrays', () => {
      expect(deepEqual([1, 2, 3], [1, 2, 3])).toBe(true);
      expect(deepEqual([1, 2, 3], [1, 2, 4])).toBe(false);
      expect(deepEqual([1, 2, 3], [1, 2])).toBe(false);
    });
  });

  describe('deepClone', () => {
    it('should clone primitives', () => {
      expect(deepClone(1)).toBe(1);
      expect(deepClone('test')).toBe('test');
      expect(deepClone(true)).toBe(true);
      expect(deepClone(null)).toBe(null);
      expect(deepClone(undefined)).toBe(undefined);
    });

    it('should clone dates', () => {
      const date = new Date('2023-01-01');
      const cloned = deepClone(date);
      expect(cloned).toEqual(date);
      expect(cloned).not.toBe(date);
    });

    it('should deeply clone objects', () => {
      const obj = { a: 1, b: { c: 2, d: [3, 4] } };
      const cloned = deepClone(obj);
      
      expect(cloned).toEqual(obj);
      expect(cloned).not.toBe(obj);
      expect(cloned.b).not.toBe(obj.b);
      expect(cloned.b.d).not.toBe(obj.b.d);
    });

    it('should clone arrays', () => {
      const arr = [1, { a: 2 }, [3, 4]];
      const cloned = deepClone(arr);
      
      expect(cloned).toEqual(arr);
      expect(cloned).not.toBe(arr);
      expect(cloned[1]).not.toBe(arr[1]);
      expect(cloned[2]).not.toBe(arr[2]);
    });
  });

  describe('StateTracker', () => {
    let tracker: StateTracker<any>;

    beforeEach(() => {
      tracker = new StateTracker('test');
    });

    it('should store and retrieve original states', () => {
      const state = { name: 'test', value: 42 };
      tracker.storeOriginalState('item1', state);
      
      expect(tracker.getOriginalState('item1')).toEqual(state);
      expect(tracker.hasOriginalState('item1')).toBe(true);
      expect(tracker.hasOriginalState('item2')).toBe(false);
    });

    it('should track dirty flags', () => {
      tracker.setDirtyFlag('item1', true);
      expect(tracker.isDirty('item1')).toBe(true);
      expect(tracker.isDirty('item2')).toBe(false);
      
      tracker.setDirtyFlag('item1', false);
      expect(tracker.isDirty('item1')).toBe(false);
    });

    it('should detect changes from original state', () => {
      const original = { name: 'test', value: 42 };
      tracker.storeOriginalState('item1', original);
      
      expect(tracker.hasChanged('item1', { name: 'test', value: 42 })).toBe(false);
      expect(tracker.hasChanged('item1', { name: 'test', value: 43 })).toBe(true);
      expect(tracker.hasChanged('item2', { name: 'test' })).toBe(true); // No original
    });

    it('should reset to original state', () => {
      const original = { name: 'test', value: 42 };
      tracker.storeOriginalState('item1', original);
      tracker.setDirtyFlag('item1', true);
      
      const reset = tracker.resetToOriginal('item1');
      expect(reset).toEqual(original);
      expect(reset).not.toBe(original); // Should be a clone
      expect(tracker.isDirty('item1')).toBe(false);
    });

    it('should remove tracking', () => {
      tracker.storeOriginalState('item1', { test: 1 });
      tracker.setDirtyFlag('item1', true);
      
      tracker.removeTracking('item1');
      expect(tracker.hasOriginalState('item1')).toBe(false);
      expect(tracker.isDirty('item1')).toBe(false);
    });

    it('should clear all tracking', () => {
      tracker.storeOriginalState('item1', { test: 1 });
      tracker.storeOriginalState('item2', { test: 2 });
      tracker.setDirtyFlag('item1', true);
      
      tracker.clearAll();
      expect(tracker.getTrackedIds()).toHaveLength(0);
      expect(tracker.getDirtyIds()).toHaveLength(0);
    });

    it('should provide debug info', () => {
      tracker.storeOriginalState('item1', { test: 1 });
      tracker.storeOriginalState('item2', { test: 2 });
      tracker.setDirtyFlag('item1', true);
      
      const debug = tracker.getDebugInfo();
      expect(debug.originalStatesCount).toBe(2);
      expect(debug.dirtyFlagsCount).toBe(1);
      expect(debug.dirtyIds).toEqual(['item1']);
      expect(debug.trackedIds).toHaveLength(2);
    });
  });

  describe('array comparison helpers', () => {
    it('arraysEqual should compare arrays in order', () => {
      expect(arraysEqual([1, 2, 3], [1, 2, 3])).toBe(true);
      expect(arraysEqual([1, 2, 3], [3, 2, 1])).toBe(false);
      expect(arraysEqual([1, 2], [1, 2, 3])).toBe(false);
    });

    it('arraysEqualUnordered should compare arrays regardless of order', () => {
      expect(arraysEqualUnordered([1, 2, 3], [3, 2, 1])).toBe(true);
      expect(arraysEqualUnordered(['a', 'b', 'c'], ['c', 'a', 'b'])).toBe(true);
      expect(arraysEqualUnordered([1, 2, 3], [1, 2, 4])).toBe(false);
    });

    it('arraysEqualUnordered should work with complex objects', () => {
      const obj1 = { id: 1, name: 'test' };
      const obj2 = { id: 2, name: 'test2' };
      
      expect(arraysEqualUnordered([obj1, obj2], [obj2, obj1])).toBe(true);
      expect(arraysEqualUnordered([obj1], [obj2])).toBe(false);
    });
  });

  describe('OrderTracker', () => {
    let tracker: OrderTracker;

    beforeEach(() => {
      tracker = new OrderTracker('test');
    });

    it('should track order changes', () => {
      tracker.storeOriginalOrder([1, 2, 3]);
      
      expect(tracker.hasOrderChanged([1, 2, 3])).toBe(false);
      expect(tracker.hasOrderChanged([1, 3, 2])).toBe(true);
      expect(tracker.hasOrderChanged([1, 2])).toBe(true);
    });

    it('should return original order', () => {
      const order = [1, 2, 3];
      tracker.storeOriginalOrder(order);
      
      const retrieved = tracker.getOriginalOrder();
      expect(retrieved).toEqual(order);
      expect(retrieved).not.toBe(order); // Should be a copy
    });
  });

  describe('BatchStateUpdater', () => {
    it('should batch updates and apply to tracker', () => {
      const updater = new BatchStateUpdater<any>();
      const tracker = new StateTracker<any>();
      
      updater.queueUpdate('item1', { test: 1 });
      updater.queueUpdate('item2', { test: 2 });
      
      expect(updater.getPendingCount()).toBe(2);
      
      updater.applyTo(tracker);
      
      expect(tracker.hasOriginalState('item1')).toBe(true);
      expect(tracker.hasOriginalState('item2')).toBe(true);
      expect(updater.getPendingCount()).toBe(0);
    });
  });

  describe('createStateDiff', () => {
    it('should detect changes between states', () => {
      let original = { a: 1, b: { c: 2 } };
      let current = { a: 1, b: { c: 2 } };
      
      const diff = createStateDiff(() => original, () => current);
      
      expect(diff().hasChanges).toBe(false);
      
      current = { a: 2, b: { c: 2 } };
      expect(diff().hasChanges).toBe(true);
      expect(diff().changes).toContain('a');
    });

    it('should track added and removed properties', () => {
      const original = { a: 1, b: 2 };
      const current = { a: 1, c: 3 };
      
      const diff = createStateDiff(() => original, () => current);
      const result = diff();
      
      expect(result.hasChanges).toBe(true);
      expect(result.changes).toContain('b (removed)');
      expect(result.changes).toContain('c (added)');
    });
  });

  describe('safeStringify', () => {
    it('should handle circular references', () => {
      const obj: any = { a: 1 };
      obj.circular = obj;
      
      const result = safeStringify(obj);
      expect(result).toContain('[Circular]');
      expect(() => JSON.parse(result)).not.toThrow();
    });

    it('should handle functions', () => {
      const obj = { 
        a: 1, 
        fn: () => console.log('test') 
      };
      
      const result = safeStringify(obj);
      expect(result).toContain('[Function]');
      expect(() => JSON.parse(result)).not.toThrow();
    });
  });
});