import { deepClone, getActualItem, getItemCollection, TITLE_FIELDS, METADATA_FIELDS, addJunctionMetadata } from '../utils/helpers';
import { emitChanges as emitHelper } from '../utils/emit-helpers';
import { logAction, logDebug, logWarn, logEvent } from '../utils/logger-wrapper';
import { isValidPrimaryKey, isValidCollection } from '../utils/validation';
import { createNotificationHelpers } from '../utils/notifications';
import { setLoadingState, clearLoadingState, updateBlockDirtyState } from '../utils/state-helpers';
import type { JunctionRecord, ItemRecord } from '../types';
import type { ExpandableBlocksContext } from '../types/composable-context';

/**
 * Composable for managing all block actions in the expandable blocks extension
 * 
 * Responsibilities:
 * - CRUD operations (add, update, delete, duplicate)
 * - Status management
 * - UI actions (expand/collapse, dialogs)
 * - Sort handling
 */
export function useBlockActions(ctx: ExpandableBlocksContext) {
  // Destructure what we need from context
  const { items, expandedItems, loading, blockOriginalStates, blockDirtyStates, originalItemOrder, isInternalUpdate } = ctx.state;
  const { getItemId, isNewItem, prepareItemsForEmit, updateOriginalState, markBlockDirty, removeBlockState } = ctx.stateFns;
  const { emit, api, props, stores: { notificationsStore }, helpers: { m2aHelper, deepEqual } } = ctx.deps;
  const { deleteDialog, itemToDelete, mergedOptions, canAddMoreBlocks } = ctx.ui;
  const { relationInfo, allowedCollections, m2aStructure } = ctx.data;

  /**
   * Get sort field from relation info
   */
  function getSortField(): string | undefined {
    return relationInfo.value?.meta?.sort_field;
  }

  /**
   * Convert primary key to proper type (number if numeric string)
   */
  function getPrimaryKeyValue(): string | number {
    if (typeof props.primaryKey === 'string' && !isNaN(Number(props.primaryKey))) {
      return Number(props.primaryKey);
    }
    return props.primaryKey;
  }

  /**
   * Get foreign key field name
   */
  function getForeignKeyField(): string {
    return m2aStructure.value?.foreignKeyField || 
           relationInfo.value?.foreignKeyField || 
           `${props.collection}_id`;
  }

  /**
   * Clean metadata fields from an item copy
   */
  function cleanItemMetadata(item: any): any {
    const cleaned = { ...item };
    // Remove all metadata fields using the constant
    for (const field of METADATA_FIELDS) {
      delete cleaned[field];
    }
    return cleaned;
  }

  /**
   * Add copy suffix to item title/name
   */
  function addCopySuffix(item: any): void {
    // Find the first available title field and add suffix
    for (const field of TITLE_FIELDS) {
      if (item[field] && typeof item[field] === 'string') {
        item[field] += ' (Copy)';
        break;
      }
    }
  }

  // Create notification helpers bound to the notifications store
  const { notify, notifySuccess, notifyError, notifyWarning, notifyInfo } = createNotificationHelpers(notificationsStore);

  /**
   * Build common debug data for emit operations
   */
  function buildDebugData(functionName: string, extraData: Record<string, any> = {}): Record<string, any> {
    return {
      function: functionName,
      collection: props.collection,
      field: props.field,
      primaryKey: props.primaryKey,
      itemsCount: items.value.length,
      ...extraData
    };
  }

  /**
   * Update sort values for all items
   */
  function updateSortValues(itemsArray: JunctionRecord[]): void {
    const sortField = relationInfo.value?.meta?.sort_field;
    if (!sortField) return;
    
    itemsArray.forEach((item, idx) => {
      if (item[sortField] !== idx) {
        item[sortField] = idx;
      }
    });
  }

  /**
   * Get junction collection name
   */
  function getJunctionCollection(): string {
    return relationInfo.value?.junctionCollection || `${props.collection}_${props.field}`;
  }

  /**
   * Emit changes with proper internal update handling
   */
  function emitChanges(itemsArray: JunctionRecord[], source: string, extraDebugData?: Record<string, any>): void {
    emitHelper({
      items: itemsArray,
      emit,
      prepareItemsForEmit,
      isInternalUpdate,
      source,
      sortField: getSortField(),
      debugData: { itemCount: itemsArray.length, ...extraDebugData }
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
      logWarn('updateItem: Invalid index', { index });
      return;
    }
    
    const itemId = getItemId(currentItem);
    
    logDebug(`updateItem called for ${itemId}`, {
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
    
    // Update dirty state using helper
    updateBlockDirtyState(
      String(itemId),
      updatedItems[index].item,
      blockOriginalStates.value,
      blockDirtyStates.value,
      deepEqual
    );
    
    // Emit with dirty tracking
    emitHelper({
      items: items.value,
      emit,
      prepareItemsForEmit,
      isInternalUpdate,
      source: 'updateItem',
      sortField: getSortField()
    });
  }

  /**
   * Add a new block of the specified collection type
   */
  function addNewItem(collection: string): void {
    if (props.disabled) return;
    
    if (!isValidPrimaryKey(props.primaryKey)) {
      notifyWarning('Save Required', 'Please save the item first before adding blocks.');
      return;
    }
    
    // Get default data for the collection
    const defaultData = m2aHelper.getDefaultDataForCollection(collection);
    
    // Create new item structure WITHOUT ID (important!)
    // The ID will be assigned by the API when saving
    const newItem: JunctionRecord = {
      id: 'new_' + Date.now(), // Temporary ID for new items
      collection: collection,
      item: defaultData // Just the default data, no ID
    };
    
    // Add foreign key and sort value using helper
    addJunctionMetadata(
      newItem,
      getForeignKeyField(),
      props.primaryKey ? getPrimaryKeyValue() : undefined,
      relationInfo.value?.meta?.sort_field,
      items.value.length
    );
    
    // Add to items array
    items.value = [...items.value, newItem];
    
    // Auto-expand the new item
    expandedItems.value.push(getItemId(newItem));
    
    // Emit changes
    emitHelper({
      items: items.value,
      emit,
      prepareItemsForEmit,
      isInternalUpdate,
      source: 'NEW ITEM - addNewItem (no API calls)',
      sortField: getSortField(),
      debugData: {
        function: 'addNewItem',
        collection: collection,
        newItemStructure: {
          hasId: !!newItem.id,
          collection: newItem.collection,
          itemType: typeof newItem.item,
          foreignKey: (newItem as any)[foreignKey],
          defaultData: defaultData
        },
        totalItemsCount: items.value.length
      }
    });
    
    notifyInfo('Block Added', 'New block added. Save to persist changes.');
  }

  /**
   * Show delete confirmation dialog
   */
  function showDeleteDialog(item: JunctionRecord, index: number): void {
    itemToDelete.value = { item, index };
    deleteDialog.value = true;
    logDebug('Delete dialog shown for item', { itemId: getItemId(item) });
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
      setLoadingState(loading, itemId);
      
      // Delete junction record
      if (item.id && !isNewItem(item)) {
        const junctionCollection = getJunctionCollection();
        await api.delete(`/items/${junctionCollection}/${item.id}`);
        
        // Optionally delete the actual item
        if (item.item && typeof item.item === 'object' && item.collection) {
          try {
            await api.delete(`/items/${item.collection}/${(item.item as ItemRecord).id}`);
          } catch (error) {
            logWarn('Failed to delete content item', { error });
          }
        }
      }
      
      // Remove from state
      expandedItems.value = expandedItems.value.filter(id => id !== itemId);
      blockOriginalStates.value.delete(itemId);
      
      // Update originalItemOrder to remove deleted item
      originalItemOrder.value = originalItemOrder.value.filter(id => String(id) !== String(item.id));
      logDebug('Updated originalItemOrder after deletion', { order: originalItemOrder.value });
      
      const updatedItems = [...items.value];
      updatedItems.splice(index, 1);
      
      // Update sort values
      updateSortValues(updatedItems);
      
      items.value = updatedItems;
      
      // Emit changes
      emitHelper({
        items: updatedItems,
        emit,
        prepareItemsForEmit,
        isInternalUpdate,
        source: 'SAVE STATE - confirmDeleteItem',
        sortField: getSortField(),
        debugData: {
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
          junctionInfo: {
            junctionCollection: relationInfo.value?.junctionCollection,
            foreignKeyField: relationInfo.value?.foreignKeyField
          }
        }
      });
      
      itemToDelete.value = null;
      
      notifySuccess('Deleted', 'Block deleted successfully');
      
    } catch (error) {
      logEvent('Error deleting block', { error });
      notifyError('Error', 'Failed to delete block');
    } finally {
      clearLoadingState(loading, getItemId(item));
    }
  }

  /**
   * Duplicate an existing block
   */
  function duplicateItem(item: JunctionRecord, index: number): void {
    if (props.disabled) return;
    
    // Check if we can add more blocks
    if (!canAddMoreBlocks.value) {
      notifyWarning('Maximum Reached', `Maximum number of blocks (${mergedOptions.value?.maxBlocks}) reached`);
      return;
    }
    
    const dupKey = `dup_${Date.now()}`;
    const actualItem = getActualItem(item);
    const collection = getItemCollection(item);
    
    if (!isValidCollection(collection)) {
      logEvent('Cannot duplicate: no collection found', {});
      return;
    }
    
    setLoadingState(loading, dupKey);
    
    try {
      // Create copy and clean metadata
      const itemCopy = cleanItemMetadata(actualItem as ItemRecord);
      addCopySuffix(itemCopy);
      
      // Create new junction record with temporary ID (no API calls)
      const newItem: JunctionRecord = {
        id: dupKey, // Temporary ID for tracking
        collection: collection,
        item: itemCopy // Copied data without ID
      };
      
      // Add foreign key and sort value using helper
      addJunctionMetadata(
        newItem,
        relationInfo.value?.foreignKeyField,
        props.primaryKey ? getPrimaryKeyValue() : undefined,
        relationInfo.value?.meta?.sort_field,
        index + 1
      );
      
      if (relationInfo.value?.foreignKeyField && props.primaryKey) {
        logDebug('Foreign key assignment (duplicate)', {
          foreignKey: relationInfo.value.foreignKeyField,
          primaryKey: props.primaryKey,
          value: newItem[relationInfo.value.foreignKeyField]
        });
      }
      
      // Insert at position
      const updatedItems = [...items.value];
      updatedItems.splice(index + 1, 0, newItem);
      items.value = updatedItems;
      
      // Auto-expand the duplicated item
      expandedItems.value.push(dupKey);
      
      // Emit changes
      emitHelper({
        items: updatedItems,
        emit,
        prepareItemsForEmit,
        isInternalUpdate,
        source: 'DUPLICATE - duplicateItem (no API calls)',
        sortField: getSortField(),
        debugData: buildDebugData('duplicateItem', {
          originalItem: {
            id: item.id,
            collection: item.collection
          },
          duplicatedItem: {
            tempId: dupKey,
            collection: collection
          }
        })
      });
      
      notifySuccess('Duplicated', 'Block duplicated. Save to persist changes.');
      
    } catch (error) {
      logEvent('Error duplicating block', { error });
      notifyError('Error', 'Failed to duplicate block');
    } finally {
      clearLoadingState(loading, dupKey);
    }
  }

  /**
   * Update item status
   */
  async function updateItemStatus(item: JunctionRecord, index: number, newStatus: string): Promise<void> {
    if (props.disabled) return;
    
    try {
      const actualItem = getActualItem(item);
      const itemId = (actualItem as ItemRecord).id;
      const collection = getItemCollection(item);
      
      if (!itemId || !isValidCollection(collection)) {
        logEvent('Cannot update status: missing item ID or collection', {});
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
      
      // Update dirty state using helper
      const blockId = getItemId(item);
      if (blockId) {
        const newItemData = updatedItems[index].item || updatedItems[index];
        updateBlockDirtyState(
          String(blockId),
          newItemData,
          blockOriginalStates.value,
          blockDirtyStates.value,
          deepEqual
        );
      }
      
      // Emit changes
      emitHelper({
        items: items.value,
        emit,
        prepareItemsForEmit,
        isInternalUpdate,
        source: 'SAVE STATE - updateItemStatus',
        sortField: getSortField(),
        debugData: buildDebugData('updateItemStatus', {
          itemId,
          targetCollection: collection,
          newStatus,
          item: {
            id: item.id,
            collection: item.collection,
            itemType: typeof item.item
          }
        })
      });
      
      // Don't show notification - status not saved yet
      
    } catch (error) {
      logEvent('Error updating status', { error });
      notifyError('Error', 'Failed to update status');
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
      logWarn('No original data found for block', { blockId });
      return;
    }
    
    logDebug(`discardChanges called for ${blockId}`, {
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
    logDebug(`Cleared dirty state for block ${blockId}`);
    
    // Verify the item is actually restored
    const restoredData = updatedItems[index].item;
    const isRestored = deepEqual(restoredData, originalData);
    logDebug(`Discard verification for ${blockId}: isRestored=${isRestored}`);
    
    // Emit the change
    emitHelper({
      items: items.value,
      emit,
      prepareItemsForEmit,
      isInternalUpdate,
      source: 'SAVE STATE - discardBlockChanges',
      sortField: getSortField(),
      debugData: buildDebugData('discardBlockChanges', {
        blockId,
        index,
        isRestored
      })
    });
    
    // Show notification
    notifySuccess('Changes Discarded', 'Block reverted to last saved state');
  }

  /**
   * Handle sort order changes
   */
  function onSort(): void {
    if (props.disabled) return;
    
    // Update sort values if we have a sort field
    updateSortValues(items.value);
    
    // Emit changes
    emitChanges(items.value, 'SAVE STATE - onSort', buildDebugData('onSort', {
      sortField: relationInfo.value?.meta?.sort_field
    }));
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