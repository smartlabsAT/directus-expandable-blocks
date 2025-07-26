import type { Ref } from 'vue';
import { nextTick } from 'vue';
import { logger } from './logger';
import type { JunctionRecord } from '../types';

export interface EmitOptions {
  items: JunctionRecord[];
  emit: (event: 'input', value: any[]) => void;
  prepareItemsForEmit: (items: JunctionRecord[], sortField?: string, canUpdateItemFn?: (item: JunctionRecord) => boolean) => any[];
  isInternalUpdate: Ref<boolean>;
  source: string;
  sortField?: string;
  debugData?: Record<string, any>;
  canUpdateItemFn?: (item: JunctionRecord) => boolean;
}

/**
 * Centralized emit handler to reduce code duplication
 * Handles the common pattern of:
 * 1. Setting internal update flag
 * 2. Preparing items for emit
 * 3. Logging the action
 * 4. Emitting the input event
 * 5. Resetting internal update flag
 */
export function emitChanges(options: EmitOptions): void {
  const { 
    items, 
    emit, 
    prepareItemsForEmit, 
    isInternalUpdate, 
    source, 
    sortField,
    debugData = {},
    canUpdateItemFn
  } = options;

  // Set internal update flag to prevent watch from processing this as external change
  isInternalUpdate.value = true;
  
  // Prepare items for emit
  const emitValue = prepareItemsForEmit(items, sortField, canUpdateItemFn);
  
  // Log the action with context
  logger.log(`🔄 EMIT - ${source}:`, {
    itemCount: items.length,
    emitValue,
    hasSort: !!sortField,
    ...debugData
  });
  
  // Emit the input event
  emit('input', emitValue);
  
  // Reset internal update flag after next tick
  nextTick(() => {
    isInternalUpdate.value = false;
  });
}

/**
 * Simplified emit for save operations
 */
export function emitSaveChanges(
  items: JunctionRecord[],
  emit: (event: 'input', value: any[]) => void,
  prepareItemsForEmit: (items: JunctionRecord[], sortField?: string, canUpdateItemFn?: (item: JunctionRecord) => boolean) => any[],
  isInternalUpdate: Ref<boolean>,
  source: string = 'SAVE STATE',
  canUpdateItemFn?: (item: JunctionRecord) => boolean
): void {
  emitChanges({
    items,
    emit,
    prepareItemsForEmit,
    isInternalUpdate,
    source,
    debugData: {
      timestamp: new Date().toISOString(),
      operation: 'save'
    },
    canUpdateItemFn
  });
}