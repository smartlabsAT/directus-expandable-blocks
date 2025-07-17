import { ref, type Ref } from 'vue';
import { logger } from '../utils/logger';
import { deepClone } from '../utils/helpers';
import type { JunctionRecord } from '../types';

/**
 * Composable for managing block state in the expandable blocks extension
 * 
 * Responsibilities:
 * - Central state management for blocks
 * - Dirty state tracking
 * - Original state preservation
 * - State preparation for emit
 */
export function useBlockState(relationInfo?: Ref<any>) {
  // Core state
  const items = ref<JunctionRecord[]>([]);
  const expandedItems = ref<string[]>([]);
  const loading = ref<Record<string | number, boolean>>({});
  
  // State tracking
  const blockOriginalStates = ref<Map<string, any>>(new Map());
  const blockDirtyStates = ref<Map<string, boolean>>(new Map());
  const originalItemOrder = ref<(string | number)[]>([]);
  
  // Internal flags
  const isInitialLoad = ref(true);
  const isInternalUpdate = ref(false);
  const isFullyInitialized = ref(false);

  /**
   * Deep equality check for objects
   */
  function deepEqual(a: any, b: any): boolean {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (typeof a !== 'object' || typeof b !== 'object') return false;
    
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    
    if (keysA.length !== keysB.length) return false;
    
    for (const key of keysA) {
      if (!keysB.includes(key)) return false;
      if (!deepEqual(a[key], b[key])) return false;
    }
    
    return true;
  }

  /**
   * Get item ID from a junction record
   */
  function getItemId(item: JunctionRecord): string {
    // For items without ID, use array index as identifier
    if (!item.id) {
      const index = items.value.indexOf(item);
      return `idx_${index}`;
    }
    return String(item.id);
  }

  /**
   * Check if an item is new (not saved to database yet)
   */
  function isNewItem(item: JunctionRecord): boolean {
    return !item.id || String(item.id).startsWith('temp_');
  }

  /**
   * Check if a specific block is dirty (has unsaved changes)
   * Compares current item data with the original state stored when block was loaded
   * @param blockId - The unique identifier of the block
   * @param currentItemData - The current state of the item data
   * @returns true if the block has unsaved changes, false otherwise
   */
  function isBlockDirty(blockId: string, currentItemData: any): boolean {
    const originalData = blockOriginalStates.value.get(blockId);
    if (!originalData) {
      logger.debug(`isBlockDirty: No original data for ${blockId}, marking as dirty`);
      return true; // New blocks are always dirty
    }
    
    // Check if content has changed using deep equality
    const contentChanged = !deepEqual(currentItemData, originalData);
    
    if (contentChanged) {
      logger.debug(`isBlockDirty: Content changed for ${blockId}`, {
        originalKeys: Object.keys(originalData),
        currentKeys: currentItemData ? Object.keys(currentItemData) : [],
        sampleOriginal: JSON.stringify(originalData).substring(0, 100),
        sampleCurrent: JSON.stringify(currentItemData).substring(0, 100)
      });
    }
    
    // Check if position has changed
    const currentIndex = items.value.findIndex(item => getItemId(item) === blockId);
    const originalIndex = originalItemOrder.value.findIndex(id => String(id) === blockId);
    const positionChanged = currentIndex !== -1 && originalIndex !== -1 && currentIndex !== originalIndex;
    
    if (positionChanged) {
      logger.debug(`isBlockDirty: Position changed for ${blockId}`, {
        currentIndex,
        originalIndex
      });
    }
    
    const isDirty = contentChanged || positionChanged;
    logger.debug(`isBlockDirty result for ${blockId}: ${isDirty}`);
    
    return isDirty;
  }

  /**
   * Prepare items for emit (mix of IDs for clean blocks and full objects for dirty blocks)
   * This is the core solution for the dirty state tracking issue:
   * - Clean blocks: emit only their ID (matches Directus's expected format)
   * - Dirty blocks: emit full object (allows Directus to save the changes)
   * @param itemsArray - Array of junction records to process
   * @param sortField - Optional sort field from relation info
   * @returns Array with IDs for clean blocks and full objects for dirty blocks
   */
  function prepareItemsForEmit(itemsArray: JunctionRecord[], sortField?: string): any[] {
    const debugInfo: Record<string, any> = {
      itemsCount: itemsArray.length,
      dirtyStatesCount: blockDirtyStates.value.size,
      originalStatesCount: blockOriginalStates.value.size,
      originalOrderLength: originalItemOrder.value.length,
      originalOrder: originalItemOrder.value,
      items: []
    };

    const result = itemsArray.map((item, index) => {
      const blockId = getItemId(item);
      const isNew = isNewItem(item);
      
      // Existing block logic
      if (!isNew && blockId) {
        // First check if it's manually marked as dirty
        let isDirty = blockDirtyStates.value.get(blockId) || false;
        
        // If not manually marked, check using temp index key
        if (!isDirty && !blockId) {
          isDirty = blockDirtyStates.value.get(`idx_${index}`) || false;
        }
        
        // If still not marked as dirty, check actual data changes
        if (!isDirty && item.item) {
          // Only check content changes, not position for individual blocks
          const originalData = blockOriginalStates.value.get(blockId);
          if (originalData) {
            isDirty = !deepEqual(item.item, originalData);
          } else {
            isDirty = isBlockDirty(blockId, item.item);
          }
        }
        
        debugInfo.items.push({
          index,
          blockId,
          isDirty,
          hasOriginalState: blockOriginalStates.value.has(blockId),
          manuallyMarkedDirty: blockDirtyStates.value.get(blockId) || false,
          itemKeys: item.item ? Object.keys(item.item) : []
        });
        
        if (isDirty) {
          logger.debug(`Emitting full object for dirty block ${blockId}`);
          // If dirty and sort field exists, update the sort value
          if (sortField) {
            const itemToEmit = { ...item };
            itemToEmit[sortField] = index;
            return itemToEmit;
          }
          return item; // Full object for dirty blocks
        } else {
          logger.debug(`Emitting ID only for clean block ${blockId}`);
          return item.id; // ID only for clean blocks (use item.id not blockId)
        }
      }
      
      // New block - always emit full object
      logger.debug(`Emitting full object for new block at index ${index}`);
      debugInfo.items.push({
        index,
        blockId: 'NEW',
        isDirty: true,
        isNew: true
      });
      // If sort field exists, ensure it's set
      if (sortField) {
        const itemToEmit = { ...item };
        itemToEmit[sortField] = index;
        return itemToEmit;
      }
      return item;
    });

    // Check if order has changed
    const currentOrder = itemsArray.map(item => getItemId(item)).filter(id => id);
    const orderChanged = JSON.stringify(currentOrder) !== JSON.stringify(originalItemOrder.value);
    
    logger.debug('prepareItemsForEmit complete:', {
      ...debugInfo,
      orderChanged,
      currentOrder,
      resultTypes: result.map((r, idx) => ({
        index: idx,
        type: typeof r === 'string' ? 'ID' : 'OBJECT',
        value: typeof r === 'string' ? r : 'fullObject'
      }))
    });
    
    // Add debug info about dirty states
    const dirtyStates = Array.from(blockDirtyStates.value.entries());
    if (dirtyStates.length > 0) {
      logger.debug('Current dirty states:', dirtyStates);
    }

    // Add debug info about the result
    logger.debug('prepareItemsForEmit result:', {
      totalItems: result.length,
      cleanBlocks: result.filter(r => typeof r === 'string').length,
      dirtyBlocks: result.filter(r => typeof r === 'object').length,
      hasOriginalOrder: originalItemOrder.value.length > 0
    });

    return result;
  }

  /**
   * Reset block state to its original state
   * @param blockId - The ID of the block to reset
   */
  function resetBlockState(blockId: string): void {
    const originalData = blockOriginalStates.value.get(blockId);
    if (originalData) {
      const itemIndex = items.value.findIndex(item => getItemId(item) === blockId);
      if (itemIndex !== -1 && items.value[itemIndex].item) {
        items.value[itemIndex].item = deepClone(originalData);
        blockDirtyStates.value.set(blockId, false);
        logger.debug(`Reset block ${blockId} to original state`);
      }
    }
  }

  /**
   * Mark a block as dirty or clean
   * @param blockId - The ID of the block
   * @param isDirty - Whether the block should be marked as dirty
   */
  function markBlockDirty(blockId: string, isDirty: boolean): void {
    blockDirtyStates.value.set(blockId, isDirty);
    logger.debug(`Marked block ${blockId} as ${isDirty ? 'dirty' : 'clean'}`);
  }

  /**
   * Clear all state tracking
   */
  function clearStateTracking(): void {
    blockOriginalStates.value.clear();
    blockDirtyStates.value.clear();
    originalItemOrder.value = [];
    logger.debug('Cleared all state tracking');
  }

  /**
   * Update original state for a block
   * @param blockId - The ID of the block
   * @param state - The new original state
   */
  function updateOriginalState(blockId: string, state: any): void {
    blockOriginalStates.value.set(blockId, deepClone(state));
    logger.debug(`Updated original state for block ${blockId}`);
  }

  /**
   * Update the original item order
   * @param order - The new order of item IDs
   */
  function updateOriginalItemOrder(order: (string | number)[]): void {
    originalItemOrder.value = [...order];
    logger.debug('Updated original item order:', order);
  }

  /**
   * Remove state tracking for a specific block
   * @param blockId - The ID of the block to remove
   */
  function removeBlockState(blockId: string): void {
    blockOriginalStates.value.delete(blockId);
    blockDirtyStates.value.delete(blockId);
    originalItemOrder.value = originalItemOrder.value.filter(id => String(id) !== blockId);
    logger.debug(`Removed state tracking for block ${blockId}`);
  }

  return {
    // State
    items,
    expandedItems,
    loading,
    blockOriginalStates,
    blockDirtyStates,
    originalItemOrder,
    isInitialLoad,
    isInternalUpdate,
    isFullyInitialized,
    
    // Core functions
    isBlockDirty,
    prepareItemsForEmit,
    resetBlockState,
    markBlockDirty,
    clearStateTracking,
    updateOriginalState,
    updateOriginalItemOrder,
    removeBlockState,
    
    // Utility functions
    deepEqual,
    getItemId,
    isNewItem
  };
}