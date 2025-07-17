import { nextTick, type Ref } from 'vue';
import { logger } from '../utils/logger';
import { deepClone } from '../utils/helpers';
import type { JunctionRecord, ExpandableBlocksOptions, UseExpandableBlocksProps, ItemRecord } from '../types';
import type { M2AHelper } from '../utils/m2a-helper';

/**
 * Composable for managing all block actions in the expandable blocks extension
 * 
 * Responsibilities:
 * - CRUD operations (add, update, delete, duplicate)
 * - Status management
 * - UI actions (expand/collapse, dialogs)
 * - Sort handling
 */
export function useBlockActions(
  // State from useBlockState
  items: Ref<JunctionRecord[]>,
  expandedItems: Ref<string[]>,
  loading: Ref<Record<string | number, boolean>>,
  blockOriginalStates: Ref<Map<string, any>>,
  blockDirtyStates: Ref<Map<string, boolean>>,
  originalItemOrder: Ref<(string | number)[]>,
  isInternalUpdate: Ref<boolean>,
  isInitialLoad: Ref<boolean>,
  
  // Functions from useBlockState
  getItemId: (item: JunctionRecord) => string,
  isNewItem: (item: JunctionRecord) => boolean,
  prepareItemsForEmit: (items: JunctionRecord[], sortField?: string) => any[],
  updateOriginalState: (blockId: string, state: any) => void,
  markBlockDirty: (blockId: string, isDirty: boolean) => void,
  removeBlockState: (blockId: string) => void,
  
  // Other dependencies
  relationInfo: Ref<any>,
  allowedCollections: Ref<any[]>,
  deleteDialog: Ref<boolean>,
  itemToDelete: Ref<{ item: JunctionRecord; index: number } | null>,
  mergedOptions: Ref<ExpandableBlocksOptions>,
  emit: (event: string, value: any) => void,
  props: UseExpandableBlocksProps,
  api: any,
  notificationsStore: any,
  m2aHelper: M2AHelper,
  m2aStructure: Ref<any>,
  deepEqual: (a: any, b: any) => boolean,
  canAddMoreBlocks: Ref<boolean>
) {

  /**
   * Get sort field from relation info
   */
  function getSortField(): string | undefined {
    return relationInfo.value?.meta?.sort_field;
  }

  /**
   * Emit changes with proper internal update handling
   */
  function emitChanges(itemsArray: JunctionRecord[], source: string): void {
    isInternalUpdate.value = true;
    const emitValue = prepareItemsForEmit(itemsArray, getSortField());
    
    logger.log(`🔄 EMIT - ${source}:`, {
      itemCount: itemsArray.length,
      emitValue,
      hasSort: !!getSortField()
    });
    
    emit('input', emitValue);
    nextTick(() => {
      isInternalUpdate.value = false;
    });
  }

  /**
   * Toggle expand/collapse state for a block
   */
  function toggleExpand(itemId: string): void {
    if (props.disabled) return;
    
    const index = expandedItems.value.indexOf(itemId);
    
    if (mergedOptions.value?.accordionMode) {
      if (index > -1) {
        expandedItems.value = [];
      } else {
        expandedItems.value = [itemId];
      }
    } else {
      if (index > -1) {
        expandedItems.value.splice(index, 1);
      } else {
        expandedItems.value.push(itemId);
      }
    }
  }

  /**
   * Update item data and handle dirty state
   */
  function updateItem(index: number, newData: any): void {
    if (props.disabled) return;
    
    const currentItem = items.value[index];
    if (!currentItem) {
      logger.warn('updateItem: Invalid index', index);
      return;
    }
    
    const itemId = getItemId(currentItem);
    
    logger.debug(`updateItem called for ${itemId}`, {
      index,
      hasNewData: !!newData,
      newDataKeys: newData ? Object.keys(newData) : []
    });
    
    // Update local state
    const updatedItems = [...items.value];
    updatedItems[index] = {
      ...currentItem,
      item: { ...(currentItem.item as ItemRecord), ...newData }
    };
    items.value = updatedItems;
    
    // Check if this update actually makes the item dirty
    const originalData = blockOriginalStates.value.get(String(itemId));
    if (originalData) {
      const newItemData = updatedItems[index].item;
      const isDirty = !deepEqual(newItemData, originalData);
      blockDirtyStates.value.set(String(itemId), isDirty);
      logger.debug(`updateItem: Set dirty state for ${itemId} to ${isDirty}`);
    }
    
    // Set internal update flag to prevent watch from processing this as paste
    isInternalUpdate.value = true;
    
    // Emit with dirty tracking
    const emitValue = prepareItemsForEmit(items.value, getSortField());
    emit('input', emitValue);
    
    // Reset internal update flag after next tick
    nextTick(() => {
      isInternalUpdate.value = false;
    });
  }

  /**
   * Add a new block of the specified collection type
   */
  function addNewItem(collection: string): void {
    if (props.disabled) return;
    
    if (!props.primaryKey || props.primaryKey === '+' || props.primaryKey === 'new') {
      notificationsStore.add({
        title: 'Save Required',
        text: 'Please save the item first before adding blocks.',
        type: 'warning'
      });
      return;
    }
    
    // Get default data for the collection
    const defaultData = m2aHelper.getDefaultDataForCollection(collection);
    
    // Create new item structure WITHOUT ID (important!)
    // The ID will be assigned by the API when saving
    const newItem: JunctionRecord = {
      // No ID! This marks it as a new item
      collection: collection,
      item: defaultData // Just the default data, no ID
    };
    
    // Add foreign key
    const foreignKey = m2aStructure.value?.foreignKeyField || 
                      relationInfo.value?.foreignKeyField || 
                      `${props.collection}_id`;
    
    if (foreignKey && props.primaryKey) {
      const primaryKeyValue = typeof props.primaryKey === 'string' && !isNaN(Number(props.primaryKey)) 
        ? Number(props.primaryKey) 
        : props.primaryKey;
      (newItem as any)[foreignKey] = primaryKeyValue;
    }
    
    // Add sort value
    if (relationInfo.value?.meta?.sort_field) {
      (newItem as any)[relationInfo.value.meta.sort_field] = items.value.length;
    }
    
    // Add to items array
    items.value = [...items.value, newItem];
    
    // Auto-expand the new item
    expandedItems.value.push(getItemId(newItem));
    
    // Set internal update flag to prevent watch from processing this as paste
    isInternalUpdate.value = true;
    
    // Emit changes
    const emitValue = prepareItemsForEmit(items.value, getSortField());
    
    logger.log('🔄 NEW ITEM - addNewItem (no API calls):', {
      function: 'addNewItem',
      collection: collection,
      newItemStructure: {
        hasId: !!newItem.id,
        collection: newItem.collection,
        itemType: typeof newItem.item,
        foreignKey: (newItem as any)[foreignKey],
        defaultData: defaultData
      },
      totalItemsCount: items.value.length,
      emitValue
    });
    
    emit('input', emitValue);
    
    // Reset internal update flag after next tick
    nextTick(() => {
      isInternalUpdate.value = false;
    });
    
    notificationsStore.add({
      title: 'Block Added',
      text: 'New block added. Save to persist changes.',
      type: 'info'
    });
  }

  /**
   * Show delete confirmation dialog
   */
  function showDeleteDialog(item: JunctionRecord, index: number): void {
    itemToDelete.value = { item, index };
    deleteDialog.value = true;
    logger.debug('Delete dialog shown for item:', getItemId(item));
  }

  /**
   * Confirm and execute deletion
   */
  async function confirmDeleteItem(): Promise<void> {
    if (!itemToDelete.value) return;
    
    const { item, index } = itemToDelete.value;
    deleteDialog.value = false;
    
    try {
      const itemId = getItemId(item);
      loading.value[itemId] = true;
      
      // Delete junction record
      if (item.id && !isNewItem(item)) {
        const junctionCollection = relationInfo.value?.junctionCollection || `${props.collection}_${props.field}`;
        await api.delete(`/items/${junctionCollection}/${item.id}`);
        
        // Optionally delete the actual item
        if (item.item && typeof item.item === 'object' && item.collection) {
          try {
            await api.delete(`/items/${item.collection}/${(item.item as ItemRecord).id}`);
          } catch (error) {
            logger.warn('Failed to delete content item:', error);
          }
        }
      }
      
      // Remove from state
      expandedItems.value = expandedItems.value.filter(id => id !== itemId);
      blockOriginalStates.value.delete(itemId);
      
      // Update originalItemOrder to remove deleted item
      originalItemOrder.value = originalItemOrder.value.filter(id => String(id) !== String(item.id));
      logger.debug('Updated originalItemOrder after deletion:', originalItemOrder.value);
      
      const updatedItems = [...items.value];
      updatedItems.splice(index, 1);
      
      // Update sort values
      if (relationInfo.value?.meta?.sort_field) {
        updatedItems.forEach((item, idx) => {
          if (item[relationInfo.value!.meta!.sort_field!] !== idx) {
            item[relationInfo.value!.meta!.sort_field!] = idx;
          }
        });
      }
      
      items.value = updatedItems;
      
      // Emit changes
      isInternalUpdate.value = true;
      const emitValue = prepareItemsForEmit(updatedItems, getSortField());
      
      logger.log('🔄 SAVE STATE - confirmDeleteItem:', {
        function: 'confirmDeleteItem',
        collection: props.collection,
        field: props.field,
        primaryKey: props.primaryKey,
        deletedItem: {
          id: item.id,
          collection: item.collection,
          itemType: typeof item.item,
          foreignKey: item[relationInfo.value?.foreignKeyField || 'unknown']
        },
        remainingItemsCount: updatedItems.length,
        emitValue,
        emitValueType: typeof emitValue,
        emitValueLength: Array.isArray(emitValue) ? emitValue.length : 'not array',
        junctionInfo: {
          junctionCollection: relationInfo.value?.junctionCollection,
          foreignKeyField: relationInfo.value?.foreignKeyField
        }
      });
      
      emit('input', emitValue);
      
      itemToDelete.value = null;
      
      notificationsStore.add({
        title: 'Deleted',
        text: 'Block deleted successfully',
        type: 'success'
      });
      
    } catch (error) {
      logger.error('Error deleting block:', error);
      notificationsStore.add({
        title: 'Error',
        text: 'Failed to delete block',
        type: 'error'
      });
    } finally {
      delete loading.value[getItemId(item)];
    }
  }

  /**
   * Duplicate an existing block
   */
  async function duplicateItem(item: JunctionRecord, index: number): Promise<void> {
    if (props.disabled) return;
    
    // Check if we can add more blocks
    if (!canAddMoreBlocks.value) {
      notificationsStore.add({
        title: 'Maximum Reached',
        text: `Maximum number of blocks (${mergedOptions.value?.maxBlocks}) reached`,
        type: 'warning'
      });
      return;
    }
    
    const dupKey = `dup_${Date.now()}`;
    try {
      const actualItem = item.item || item;
      const collection = item.collection || (actualItem as any).collection;
      
      if (!collection) {
        logger.error('Cannot duplicate: no collection found');
        return;
      }
      
      loading.value[dupKey] = true;
      
      // Create copy
      const itemCopy: any = { ...(actualItem as ItemRecord) };
      delete itemCopy.id;
      delete itemCopy.user_created;
      delete itemCopy.user_updated;
      delete itemCopy.date_created;
      delete itemCopy.date_updated;
      
      // Update title
      if (itemCopy.title) {
        itemCopy.title += ' (Copy)';
      } else if (itemCopy.name) {
        itemCopy.name += ' (Copy)';
      } else if (itemCopy.headline) {
        itemCopy.headline += ' (Copy)';
      }
      
      // Create duplicate
      const newItemResponse = await api.post(`/items/${collection}`, itemCopy);
      const createdItem = newItemResponse.data.data;
      
      // Create junction
      const junctionData: any = {
        collection: collection,
        item: createdItem.id
      };
      
      if (relationInfo.value?.foreignKeyField && props.primaryKey) {
        // Convert primaryKey to number if it's a string number
        const primaryKeyValue = typeof props.primaryKey === 'string' && !isNaN(Number(props.primaryKey)) 
          ? Number(props.primaryKey) 
          : props.primaryKey;
        junctionData[relationInfo.value.foreignKeyField] = primaryKeyValue;
        
        logger.debug('Foreign key assignment (duplicate):', {
          foreignKey: relationInfo.value.foreignKeyField,
          originalPrimaryKey: props.primaryKey,
          originalType: typeof props.primaryKey,
          convertedValue: primaryKeyValue,
          convertedType: typeof primaryKeyValue
        });
      }
      
      if (relationInfo.value?.meta?.sort_field) {
        junctionData[relationInfo.value.meta.sort_field] = index + 1;
      }
      
      const junctionCollection = relationInfo.value?.junctionCollection || `${props.collection}_${props.field}`;
      const junctionResponse = await api.post(`/items/${junctionCollection}`, junctionData);
      const junctionRecord = junctionResponse.data.data;
      
      // Create complete item
      const newItem: JunctionRecord = {
        id: junctionRecord.id,
        collection: collection,
        item: createdItem
      };
      
      if (relationInfo.value?.foreignKeyField) {
        const primaryKeyValue = typeof props.primaryKey === 'string' && !isNaN(Number(props.primaryKey)) 
          ? Number(props.primaryKey) 
          : props.primaryKey;
        newItem[relationInfo.value.foreignKeyField] = primaryKeyValue;
      }
      
      // Insert at position
      const updatedItems = [...items.value];
      updatedItems.splice(index + 1, 0, newItem);
      items.value = updatedItems;
      
      // Auto-expand
      expandedItems.value.push(String(junctionRecord.id));
      
      // Emit changes
      isInternalUpdate.value = true;
      const emitValue = prepareItemsForEmit(updatedItems, getSortField());
      
      logger.log('🔄 SAVE STATE - duplicateItem:', {
        function: 'duplicateItem',
        collection: props.collection,
        field: props.field,
        primaryKey: props.primaryKey,
        originalItem: {
          id: item.id,
          collection: item.collection,
          itemType: typeof item.item
        },
        duplicatedItem: {
          id: createdItem.id,
          data: createdItem
        },
        duplicatedJunction: {
          id: junctionRecord.id,
          data: junctionRecord
        },
        itemsCount: updatedItems.length,
        emitValue,
        emitValueType: typeof emitValue,
        emitValueLength: Array.isArray(emitValue) ? emitValue.length : 'not array'
      });
      
      emit('input', emitValue);
      
      notificationsStore.add({
        title: 'Duplicated',
        text: 'Block duplicated successfully',
        type: 'success'
      });
      
    } catch (error) {
      logger.error('Error duplicating block:', error);
      notificationsStore.add({
        title: 'Error',
        text: 'Failed to duplicate block',
        type: 'error'
      });
    } finally {
      delete loading.value[dupKey];
    }
  }

  /**
   * Update item status
   */
  async function updateItemStatus(item: JunctionRecord, index: number, newStatus: string): Promise<void> {
    if (props.disabled) return;
    
    try {
      const actualItem = item.item || item;
      const itemId = (actualItem as ItemRecord).id;
      const collection = item.collection || (actualItem as any).collection;
      
      if (!itemId || !collection) {
        logger.error('Cannot update status: missing item ID or collection');
        return;
      }
      
      // No API call - just update local state
      
      // Update local state only
      const updatedItems = [...items.value];
      if (item.item) {
        updatedItems[index] = {
          ...item,
          item: {
            ...(item.item as ItemRecord),
            status: newStatus as 'published' | 'draft' | 'archived'
          }
        };
      } else {
        updatedItems[index] = {
          ...item,
          status: newStatus as 'published' | 'draft' | 'archived'
        };
      }
      items.value = updatedItems;
      
      // Check if this update actually makes the item dirty
      const blockId = getItemId(item);
      if (blockId) {
        const originalData = blockOriginalStates.value.get(String(blockId));
        if (originalData) {
          const newItemData = updatedItems[index].item || updatedItems[index];
          const isDirty = !deepEqual(newItemData, originalData);
          blockDirtyStates.value.set(String(blockId), isDirty);
          logger.debug(`Status update: Set dirty state for ${blockId} to ${isDirty}`);
        } else {
          blockDirtyStates.value.set(String(blockId), true);
          logger.debug('Block marked as dirty after status update (no original):', blockId);
        }
      }
      
      // Set internal update flag to prevent watch from processing this as paste
      isInternalUpdate.value = true;
      
      const emitValue = prepareItemsForEmit(items.value, getSortField());
      
      logger.log('🔄 SAVE STATE - updateItemStatus:', {
        function: 'updateItemStatus',
        collection: props.collection,
        field: props.field,
        primaryKey: props.primaryKey,
        itemId,
        targetCollection: collection,
        newStatus,
        item: {
          id: item.id,
          collection: item.collection,
          itemType: typeof item.item
        },
        itemsCount: items.value.length,
        emitValue,
        emitValueType: typeof emitValue,
        emitValueLength: Array.isArray(emitValue) ? emitValue.length : 'not array'
      });
      
      emit('input', emitValue);
      
      // Reset internal update flag after next tick
      nextTick(() => {
        isInternalUpdate.value = false;
      });
      
      // Don't show notification - status not saved yet
      
    } catch (error) {
      logger.error('Error updating status:', error);
      notificationsStore.add({
        title: 'Error',
        text: 'Failed to update status',
        type: 'error'
      });
    }
  }

  /**
   * Discard changes for a specific block
   */
  function discardChanges(item: JunctionRecord, index: number): void {
    if (props.disabled) return;
    
    const blockId = item.id?.toString();
    if (!blockId) return;
    
    const originalData = blockOriginalStates.value.get(blockId);
    if (!originalData) {
      logger.warn('No original data found for block:', blockId);
      return;
    }
    
    logger.debug(`discardChanges called for ${blockId}`, {
      hasOriginalData: !!originalData,
      currentDirtyState: blockDirtyStates.value.get(blockId)
    });
    
    // Update local state with original data
    const updatedItems = [...items.value];
    updatedItems[index] = {
      ...item,
      item: deepClone(originalData)
    };
    items.value = updatedItems;
    
    // Clear dirty state for this block BEFORE emitting
    blockDirtyStates.value.set(blockId, false);
    logger.debug(`Cleared dirty state for block ${blockId}`);
    
    // Verify the item is actually restored
    const restoredData = updatedItems[index].item;
    const isRestored = deepEqual(restoredData, originalData);
    logger.debug(`Discard verification for ${blockId}: isRestored=${isRestored}`);
    
    // Set internal update flag to prevent watch from processing this as paste
    isInternalUpdate.value = true;
    
    // Emit the change
    const emitValue = prepareItemsForEmit(items.value, getSortField());
    
    logger.log('🔄 SAVE STATE - discardBlockChanges:', {
      function: 'discardBlockChanges',
      collection: props.collection,
      field: props.field,
      primaryKey: props.primaryKey,
      blockId,
      index,
      itemsCount: items.value.length,
      emitValue,
      emitValueType: typeof emitValue,
      emitValueLength: Array.isArray(emitValue) ? emitValue.length : 'not array',
      isRestored
    });
    
    emit('input', emitValue);
    
    // Reset internal update flag after next tick
    nextTick(() => {
      isInternalUpdate.value = false;
    });
    
    // Show notification
    notificationsStore.add({
      title: 'Changes Discarded',
      text: 'Block reverted to last saved state',
      type: 'success'
    });
  }

  /**
   * Handle sort order changes
   */
  function onSort(): void {
    if (props.disabled) return;
    
    // Update sort values if we have a sort field
    if (relationInfo.value?.meta?.sort_field) {
      items.value = items.value.map((item, index) => ({
        ...item,
        [relationInfo.value!.meta!.sort_field!]: index
      }));
    }
    
    // Set internal update flag to prevent watch from processing this as paste
    isInternalUpdate.value = true;
    
    const emitValue = prepareItemsForEmit(items.value, getSortField());
    
    logger.log('🔄 SAVE STATE - onSort:', {
      function: 'onSort',
      collection: props.collection,
      field: props.field,
      primaryKey: props.primaryKey,
      sortField: relationInfo.value?.meta?.sort_field,
      itemsCount: items.value.length,
      emitValue,
      emitValueType: typeof emitValue,
      emitValueLength: Array.isArray(emitValue) ? emitValue.length : 'not array'
    });
    
    emit('input', emitValue);
    
    // Reset internal update flag after next tick
    nextTick(() => {
      isInternalUpdate.value = false;
    });
  }

  return {
    // UI Actions
    toggleExpand,
    showDeleteDialog,
    
    // CRUD Operations
    addNewItem,
    updateItem,
    confirmDeleteItem,
    duplicateItem,
    discardChanges,
    
    // Status & State
    updateItemStatus,
    onSort,
    
    // Helper
    getSortField
  };
}