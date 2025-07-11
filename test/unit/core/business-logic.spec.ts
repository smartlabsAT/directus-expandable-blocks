import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ref } from 'vue';
import type { JunctionRecord, ItemRecord } from '@/types';

// We'll test the core functions by extracting them from the component
// In a real scenario, these would be refactored into separate composables

describe('Core Business Logic', () => {
  describe('isBlockDirty', () => {
    let blockOriginalStates: Map<string, any>;
    
    beforeEach(() => {
      blockOriginalStates = new Map();
    });

    function isBlockDirty(blockId: string, currentItemData: any): boolean {
      const originalData = blockOriginalStates.get(blockId);
      if (!originalData) return true;
      return JSON.stringify(currentItemData) !== JSON.stringify(originalData);
    }

    it('returns true for new blocks without original state', () => {
      const result = isBlockDirty('123', { title: 'New Block' });
      expect(result).toBe(true);
    });

    it('returns false when data matches original state', () => {
      const originalData = { id: 1, title: 'Test Block', content: 'Content' };
      blockOriginalStates.set('123', originalData);
      
      const result = isBlockDirty('123', { id: 1, title: 'Test Block', content: 'Content' });
      expect(result).toBe(false);
    });

    it('returns true when data differs from original state', () => {
      const originalData = { id: 1, title: 'Test Block', content: 'Content' };
      blockOriginalStates.set('123', originalData);
      
      const result = isBlockDirty('123', { id: 1, title: 'Modified Block', content: 'Content' });
      expect(result).toBe(true);
    });

    it('handles nested object changes', () => {
      const originalData = { 
        id: 1, 
        title: 'Test', 
        meta: { author: 'John', tags: ['a', 'b'] } 
      };
      blockOriginalStates.set('123', originalData);
      
      const modifiedData = { 
        id: 1, 
        title: 'Test', 
        meta: { author: 'John', tags: ['a', 'b', 'c'] } 
      };
      
      const result = isBlockDirty('123', modifiedData);
      expect(result).toBe(true);
    });
  });

  describe('prepareItemsForEmit', () => {
    let blockOriginalStates: Map<string, any>;
    let originalItemOrder: (string | number)[];

    beforeEach(() => {
      blockOriginalStates = new Map();
      originalItemOrder = [];
    });

    function isBlockDirty(blockId: string, currentItemData: any): boolean {
      const originalData = blockOriginalStates.get(blockId);
      if (!originalData) return true;
      return JSON.stringify(currentItemData) !== JSON.stringify(originalData);
    }

    function prepareItemsForEmit(itemsArray: JunctionRecord[]): any[] {
      const result = itemsArray.map(item => {
        const blockId = item.id?.toString();
        if (!blockId) return item;
        
        const isDirty = isBlockDirty(blockId, item.item);
        return isDirty ? item : item.id;
      });
      
      const dirtyCount = result.filter(item => typeof item === 'object').length;
      
      if (dirtyCount === 0 && originalItemOrder.length > 0) {
        const itemMap = new Map();
        itemsArray.forEach(item => {
          itemMap.set(item.id, item);
        });
        
        const orderedResult = originalItemOrder.filter(id => itemMap.has(id));
        return orderedResult;
      }
      
      return result;
    }

    it('returns IDs for clean blocks', () => {
      blockOriginalStates.set('1', { id: 101, title: 'Block 1' });
      blockOriginalStates.set('2', { id: 102, title: 'Block 2' });

      const items: JunctionRecord[] = [
        { id: 1, collection: 'content_text', item: { id: 101, title: 'Block 1' } },
        { id: 2, collection: 'content_text', item: { id: 102, title: 'Block 2' } }
      ];

      const result = prepareItemsForEmit(items);
      expect(result).toEqual([1, 2]);
    });

    it('returns full objects for dirty blocks', () => {
      blockOriginalStates.set('1', { id: 101, title: 'Block 1' });
      blockOriginalStates.set('2', { id: 102, title: 'Block 2' });

      const items: JunctionRecord[] = [
        { id: 1, collection: 'content_text', item: { id: 101, title: 'Block 1' } },
        { id: 2, collection: 'content_text', item: { id: 102, title: 'Modified Block 2' } }
      ];

      const result = prepareItemsForEmit(items);
      expect(result[0]).toBe(1); // Clean block - just ID
      expect(result[1]).toEqual(items[1]); // Dirty block - full object
    });

    it('returns mix of IDs and objects for mixed state', () => {
      blockOriginalStates.set('1', { id: 101, title: 'Block 1' });
      // Block 2 is new (no original state)
      blockOriginalStates.set('3', { id: 103, title: 'Block 3' });

      const items: JunctionRecord[] = [
        { id: 1, collection: 'content_text', item: { id: 101, title: 'Block 1' } },
        { id: 2, collection: 'content_text', item: { id: 102, title: 'New Block' } },
        { id: 3, collection: 'content_text', item: { id: 103, title: 'Block 3' } }
      ];

      const result = prepareItemsForEmit(items);
      expect(result[0]).toBe(1); // Clean
      expect(result[1]).toEqual(items[1]); // Dirty (new)
      expect(result[2]).toBe(3); // Clean
    });

    it('preserves original order when all blocks are clean', () => {
      originalItemOrder = [3, 1, 2]; // Different order
      
      blockOriginalStates.set('1', { id: 101, title: 'Block 1' });
      blockOriginalStates.set('2', { id: 102, title: 'Block 2' });
      blockOriginalStates.set('3', { id: 103, title: 'Block 3' });

      const items: JunctionRecord[] = [
        { id: 1, collection: 'content_text', item: { id: 101, title: 'Block 1' } },
        { id: 2, collection: 'content_text', item: { id: 102, title: 'Block 2' } },
        { id: 3, collection: 'content_text', item: { id: 103, title: 'Block 3' } }
      ];

      const result = prepareItemsForEmit(items);
      expect(result).toEqual([3, 1, 2]); // Original order preserved
    });

    it('does not preserve order when some blocks are dirty', () => {
      originalItemOrder = [3, 1, 2];
      
      blockOriginalStates.set('1', { id: 101, title: 'Block 1' });
      blockOriginalStates.set('2', { id: 102, title: 'Block 2' });
      blockOriginalStates.set('3', { id: 103, title: 'Block 3' });

      const items: JunctionRecord[] = [
        { id: 1, collection: 'content_text', item: { id: 101, title: 'Modified Block 1' } },
        { id: 2, collection: 'content_text', item: { id: 102, title: 'Block 2' } },
        { id: 3, collection: 'content_text', item: { id: 103, title: 'Block 3' } }
      ];

      const result = prepareItemsForEmit(items);
      expect(result[0]).toEqual(items[0]); // Dirty - full object
      expect(result[1]).toBe(2); // Clean - ID
      expect(result[2]).toBe(3); // Clean - ID
    });

    it('handles missing block IDs gracefully', () => {
      const items: JunctionRecord[] = [
        { id: 1, collection: 'content_text', item: { id: 101, title: 'Block 1' } },
        { id: null as any, collection: 'content_text', item: { id: 102, title: 'Block 2' } }
      ];

      const result = prepareItemsForEmit(items);
      expect(result[0]).toEqual(items[0]); // Since blockOriginalStates is empty, all items are considered dirty
      expect(result[1]).toEqual(items[1]); // Fallback to full object
    });
  });

  describe('Order Preservation Logic', () => {
    it('stores original order on mount', () => {
      const propsValue = [57, 58, 59];
      const originalItemOrder: (string | number)[] = [];
      
      // Simulate mount logic
      if (Array.isArray(propsValue)) {
        propsValue.forEach(item => {
          const id = typeof item === 'object' && item !== null ? (item as any).id : item;
          originalItemOrder.push(id);
        });
      }
      
      expect(originalItemOrder).toEqual([57, 58, 59]);
    });

    it('handles mixed ID and object input', () => {
      const propsValue = [
        57,
        { id: 58, collection: 'content_text', item: 123 },
        59
      ];
      const originalItemOrder: (string | number)[] = [];
      
      propsValue.forEach(item => {
        const id = typeof item === 'object' && item !== null ? (item as any).id : item;
        originalItemOrder.push(id);
      });
      
      expect(originalItemOrder).toEqual([57, 58, 59]);
    });
  });

  describe('Global Discard Detection', () => {
    it('detects reset to initial values', () => {
      const newVal = [64, 65, 67];
      const initialVal = [64, 65, 67];
      
      const isReset = JSON.stringify(newVal) === JSON.stringify(initialVal);
      expect(isReset).toBe(true);
    });

    it('detects reset to original order', () => {
      const newVal = [64, 65, 67];
      const initialVal = [65, 67, 64]; // Different order
      const originalItemOrder = [64, 65, 67];
      
      const isResetToInitial = JSON.stringify(newVal) === JSON.stringify(initialVal);
      const isResetToOriginal = originalItemOrder.length > 0 && 
        JSON.stringify(newVal) === JSON.stringify(originalItemOrder);
      
      const isReset = isResetToInitial || isResetToOriginal;
      
      expect(isResetToInitial).toBe(false);
      expect(isResetToOriginal).toBe(true);
      expect(isReset).toBe(true);
    });
  });
});