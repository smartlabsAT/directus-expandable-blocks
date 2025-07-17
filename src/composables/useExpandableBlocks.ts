import { ref, computed, watch, onMounted, nextTick, type Ref } from 'vue';
import { useApi, useStores } from '@directus/extensions-sdk';
import { M2AHelper, type M2AFieldInfo } from '../utils/m2a-helper';
import { logger } from '../utils/logger';
import { 
  buildM2AFieldsString, 
  extractItemTitle, 
  getActualItemId as getItemActualId,
  parseAllowedCollections,
  deepClone
} from '../utils/helpers';
import { useBlockState } from './useBlockState';
import { useBlockActions } from './useBlockActions';
import { useM2AData } from './useM2AData';
import type { 
  ExpandableBlocksOptions, 
  JunctionRecord, 
  ItemRecord, 
  CollectionInfo, 
  RelationInfo,
  DirectusFormValues,
  DirectusFieldsStore,
  DirectusRelationsStore,
  DirectusCollectionsStore,
  DirectusNotificationsStore
} from '../types';

export interface UseExpandableBlocksProps {
  value: JunctionRecord[] | null;
  collection: string;
  field: string;
  primaryKey?: string | number;
  disabled?: boolean;
  options?: ExpandableBlocksOptions;
}

export function useExpandableBlocks(
  props: UseExpandableBlocksProps,
  emit: (event: 'input', value: any[]) => void,
  values: Ref<DirectusFormValues>,
  initialValues: Ref<DirectusFormValues>
) {
  // API and stores
  const api = useApi();
  const stores = useStores();
  const { useFieldsStore, useRelationsStore, useCollectionsStore, useNotificationsStore } = stores;
  const fieldsStore = useFieldsStore() as DirectusFieldsStore;
  const relationsStore = useRelationsStore() as DirectusRelationsStore;
  const collectionsStore = useCollectionsStore() as DirectusCollectionsStore;
  const notificationsStore = useNotificationsStore() as DirectusNotificationsStore;

  // Initialize M2A Helper
  const m2aHelper = new M2AHelper(api, stores);

  // Initialize state composable
  const blockState = useBlockState();
  const {
    items,
    expandedItems,
    loading,
    blockOriginalStates,
    blockDirtyStates,
    originalItemOrder,
    isInitialLoad,
    isInternalUpdate,
    isFullyInitialized,
    isBlockDirty,
    prepareItemsForEmit,
    resetBlockState,
    markBlockDirty,
    clearStateTracking,
    updateOriginalState,
    updateOriginalItemOrder,
    removeBlockState,
    deepEqual,
    getItemId,
    isNewItem
  } = blockState;

  // Additional state not in useBlockState
  const relationInfo = ref<RelationInfo | null>(null);
  const m2aStructure = ref<M2AFieldInfo | null>(null);
  const allowedCollections = ref<CollectionInfo[]>([]);
  const deleteDialog = ref(false);
  const itemToDelete = ref<{ item: JunctionRecord; index: number } | null>(null);
  
  // Store merged options
  const mergedOptions = ref<ExpandableBlocksOptions>({});

  // Status configuration
  const availableStatuses = [
    { value: 'published', label: 'Published' },
    { value: 'draft', label: 'Draft' },
    { value: 'archived', label: 'Archived' }
  ];

  // Computed
  const sortable = computed(() => {
    // Default to true if not explicitly set to false
    return mergedOptions.value?.enableSorting !== false;
  });

  // Compute save button status (would be active if values differ from initialValues)
  const saveButtonWouldBeActive = computed(() => {
    if (!values.value || !initialValues.value || !props.field) return false;
    
    const currentValue = values.value[props.field];
    const initialValue = initialValues.value[props.field];
    
    // Deep comparison
    return JSON.stringify(currentValue) !== JSON.stringify(initialValue);
  });

  const shouldShowItemId = computed(() => {
    // Handle different possible values
    const value = mergedOptions.value?.showItemId;
    
    // If explicitly set to false, hide it
    if (value === false) {
      return false;
    }
    
    // If not set at all (undefined), default to true
    if (value === undefined) {
      return true;
    }
    
    // Otherwise use the value as-is
    return value;
  });

  const canAddMoreBlocks = computed(() => {
    const maxBlocks = mergedOptions.value?.maxBlocks;
    if (!maxBlocks || maxBlocks <= 0) {
      return true; // No limit
    }
    return items.value.length < maxBlocks;
  });

  // Initialize actions composable
  const blockActions = useBlockActions(
    items,
    expandedItems,
    loading,
    blockOriginalStates,
    blockDirtyStates,
    originalItemOrder,
    isInternalUpdate,
    isInitialLoad,
    getItemId,
    isNewItem,
    prepareItemsForEmit,
    updateOriginalState,
    markBlockDirty,
    removeBlockState,
    relationInfo,
    allowedCollections,
    deleteDialog,
    itemToDelete,
    mergedOptions,
    emit,
    props,
    api,
    notificationsStore,
    m2aHelper,
    m2aStructure,
    deepEqual,
    canAddMoreBlocks
  );
  const {
    toggleExpand,
    showDeleteDialog,
    addNewItem,
    updateItem,
    confirmDeleteItem,
    duplicateItem,
    discardChanges,
    updateItemStatus,
    onSort,
    getSortField
  } = blockActions;

  // Initialize M2A data composable
  const m2aData = useM2AData(
    items,
    expandedItems,
    loading,
    blockOriginalStates,
    blockDirtyStates,
    originalItemOrder,
    isInternalUpdate,
    isInitialLoad,
    isFullyInitialized,
    getItemId,
    isNewItem,
    updateOriginalState,
    markBlockDirty,
    updateOriginalItemOrder,
    clearStateTracking,
    props,
    api,
    m2aHelper,
    mergedOptions,
    relationInfo,
    allowedCollections,
    m2aStructure,
    deepEqual
  );
  const {
    allowedCollectionsMap,
    loadFullItemData,
    processLoadedRecords,
    processPasteData,
    analyzeM2AStructure,
    loadAllowedCollections,
    loadRelationInfo,
    initialize: initializeM2AData
  } = m2aData;

  /**
   * Load all options from field configuration
   */
  async function loadFieldOptions() {
    // Start with props options as base
    let fieldOptions = { ...props.options };
    
    // Try to get from field store
    try {
      const fields = fieldsStore.getFieldsForCollection(props.collection);
      const fieldConfig = fields.find((f: any) => f.field === props.field);
      if (fieldConfig?.meta?.options) {
        fieldOptions = { ...fieldOptions, ...fieldConfig.meta.options };
        logger.debug('Loaded field options from store:', fieldConfig.meta.options);
      }
    } catch (error) {
      logger.debug('Failed to get field options from store:', error);
    }
    
    // Store merged options
    mergedOptions.value = fieldOptions;
    logger.debug('Final merged options:', mergedOptions.value);
  }

  /**
   * Initialize the component
   * Sets up the expandable blocks interface with proper data loading and configuration
   * Handles:
   * - M2A structure analysis
   * - Allowed collections loading
   * - Initial data fetching
   * - Start expanded option implementation
   */
  async function initialize() {
    logger.debug('Component mounted', {
      field: props.field,
      primaryKey: props.primaryKey
    }, props);
    
    // Store the original order from props.value
    if (Array.isArray(props.value)) {
      originalItemOrder.value = props.value.map(item => {
        return typeof item === 'object' && item !== null ? item.id : item;
      });
    }
    
    try {
      // Load field options first
      await loadFieldOptions();
      
      // Copy values to initialValues if needed
      if (initialValues.value && values.value && props.field) {
        if (!initialValues.value[props.field] && values.value[props.field]) {
          initialValues.value[props.field] = deepClone(values.value[props.field]);
        }
      }
      
      // Initialize M2A data (analyzes structure, loads collections, relations, and data)
      await initializeM2AData();
      
      // Implement startExpanded option
      if (mergedOptions.value?.startExpanded && items.value.length > 0) {
        expandedItems.value = items.value.map(item => getItemId(item));
      }
      
      // Mark as fully initialized after a small delay
      await nextTick();
      setTimeout(() => {
        isFullyInitialized.value = true;
      }, 100);
      
    } catch (error) {
      logger.error('Error initializing expandable blocks:', error);
      notificationsStore.add({
        title: 'Initialization Error',
        text: 'Failed to initialize expandable blocks. Please refresh the page.',
        type: 'error'
      });
    }
  }

  // Computed property for allowed collections as a map (moved to useM2AData)
  // const allowedCollectionsMap = computed(() => {
  //   const map: Record<string, any> = {};
  //   allowedCollections.value.forEach(col => {
  //     if (typeof col === 'string') {
  //       map[col] = { collection: col };
  //     } else if (col && col.collection) {
  //       map[col.collection] = col;
  //     }
  //   });
  //   return map;
  // });

  // The following functions have been moved to useM2AData composable:
  // loadAllowedCollections, loadRelationInfo, loadFullItemData, processLoadedRecords, processPasteData

  /* DEPRECATED - All these functions have been moved to useM2AData composable:
  * - loadAllowedCollections()
  * - setAllowedCollections()
  * - loadRelationInfo()
  * - loadFullItemData()
  * - processPasteData()
  * - processLoadedRecords()
  */


  /**
   * Watch for external value changes
   */
  watch(() => props.value, async (newVal, oldVal) => {
    // Skip if this is an internal update
    if (isInternalUpdate.value) {
      return;
    }
    
    // Set originalItemOrder when it's empty and data arrives (initial load)
    if (originalItemOrder.value.length === 0 && Array.isArray(newVal) && newVal.length > 0) {
      logger.debug('Setting originalItemOrder from value watcher:', newVal);
      originalItemOrder.value = newVal.map(item => 
        typeof item === 'object' && item !== null ? item.id : item
      );
      // checkDelayedOptions(); // No longer needed with useM2AData
      if (props.primaryKey && props.primaryKey !== '+' && props.primaryKey !== 'new') {
        await loadFullItemData();  // Note: This function is now imported from useM2AData
      }
      isFullyInitialized.value = true;
      return;
    }
    
    // Check if ALL items are just IDs (indicates a save event)
    if (Array.isArray(newVal) && newVal.length > 0 && originalItemOrder.value.length > 0) {
      const allAreIds = newVal.every(item => typeof item !== 'object' || item === null);
      
      if (allAreIds) {
        const newOrder = newVal.map(item => 
          typeof item === 'object' && item !== null ? (item as any).id : item
        );
        
        // If all blocks are IDs only, this is a save event
        if (JSON.stringify(newOrder) !== JSON.stringify(originalItemOrder.value)) {
          logger.debug('Save detected - all blocks are clean IDs, updating originalItemOrder:', {
            previousOriginal: originalItemOrder.value,
            newOrder: newOrder
          });
          originalItemOrder.value = newOrder;
          
          // Clear all dirty states after successful save
          blockDirtyStates.value.clear();
          logger.debug('Cleared all dirty states after save');
          
          // Reload data in new order after save
          if (props.primaryKey && props.primaryKey !== '+' && props.primaryKey !== 'new') {
            await loadFullItemData(true);  // Pass true to indicate this is after a save
          }
          return;
        } else if (JSON.stringify(newOrder) === JSON.stringify(originalItemOrder.value)) {
          // Order hasn't changed but we got all IDs - this is still a save
          logger.debug('Save detected - all blocks are clean IDs, order unchanged');
          
          // Clear all dirty states after successful save
          blockDirtyStates.value.clear();
          logger.debug('Cleared all dirty states after save');
          
          // Reload data to get fresh state after save
          if (props.primaryKey && props.primaryKey !== '+' && props.primaryKey !== 'new') {
            await loadFullItemData(true);  // Pass true to indicate this is after a save
          }
          return;
        }
      }
    }
    
    if (isInitialLoad.value) {
      return;
    }
    
    // PASTE DETECTION: Check if this is a paste event
    // Paste can contain: 1) Just IDs, 2) Objects with ID, 3) Objects without ID (new blocks)
    if (Array.isArray(newVal) && newVal.length > 0) {
      // Analyze the data structure
      let hasJustIds = false;
      let hasObjectsWithId = false;
      let hasObjectsWithoutId = false;
      let hasMixedData = false;
      
      newVal.forEach(item => {
        if (typeof item === 'number' || typeof item === 'string') {
          hasJustIds = true;
        } else if (typeof item === 'object' && item !== null) {
          if ('collection' in item && 'item' in item) {
            if (item.id) {
              hasObjectsWithId = true;
            } else {
              hasObjectsWithoutId = true;
            }
          }
        }
      });
      
      hasMixedData = (hasJustIds && (hasObjectsWithId || hasObjectsWithoutId)) || 
                     (hasObjectsWithId && hasObjectsWithoutId);
      
      // Detect paste: Mixed data OR objects without ID OR significant structure change
      const isPasteEvent = hasMixedData || hasObjectsWithoutId || 
        (hasObjectsWithId && newVal.some(item => 
          typeof item === 'object' && 
          item !== null && 
          'item' in item && 
          typeof item.item === 'object'
        ));
      
      if (isPasteEvent) {
        logger.log('📋 PASTE EVENT DETECTED:', {
          hasJustIds,
          hasObjectsWithId,
          hasObjectsWithoutId,
          hasMixedData,
          totalItems: newVal.length,
          currentItemsCount: items.value.length
        });
        
        // Process paste data - completely replace current data
        await processPasteData(newVal);  // Note: This function is now imported from useM2AData
        return;
      }
    }
    
    // Not a paste event - check if actual items changed (add/remove)
    const oldIds = items.value.map(item => item.id).sort();
    const newIds = (newVal || []).map((item: any) => {
      return typeof item === 'object' ? item.id : item;
    }).filter(id => id != null).sort();
    
    if (JSON.stringify(oldIds) !== JSON.stringify(newIds)) {
      loadFullItemData();  // Note: This function is now imported from useM2AData
    }
  }, { deep: true });

  /**
   * Watch for global form resets (when user clicks "Discard Changes")
   * This happens when Directus resets values to initialValues
   */
  watch(() => values.value?.[props.field], (newVal, oldVal) => {
    // Skip if not initialized or if it's our own update
    if (!isFullyInitialized.value || isInternalUpdate.value) {
      return;
    }
    
    // Skip if no change
    if (JSON.stringify(newVal) === JSON.stringify(oldVal)) {
      return;
    }
    
    // Check if this is a reset to initialValues
    const initialVal = initialValues.value?.[props.field];
    if (!initialVal) {
      return;
    }
    
    // For comparison, we need to check if it matches initialValues (the saved state)
    const isResetToInitial = JSON.stringify(newVal) === JSON.stringify(initialVal);
    
    if (isResetToInitial) {
      logger.debug('Global discard detected - resetting blocks');
      
      // WICHTIG: Reset originalItemOrder to the initial/saved order
      if (Array.isArray(initialVal)) {
        originalItemOrder.value = initialVal.map(item => 
          typeof item === 'object' && item !== null ? item.id : item
        );
        
        logger.debug('Reset originalItemOrder to:', originalItemOrder.value);
      }
      
      // Reset all blocks to their original state
      items.value = items.value.map(item => {
        const blockId = item.id?.toString();
        if (!blockId) return item;
        
        const originalData = blockOriginalStates.value.get(blockId);
        if (!originalData) {
          logger.warn('No original data for block:', blockId);
          return item;
        }
        
        return {
          ...item,
          item: deepClone(originalData)
        };
      });
      
      // Reorder items according to the reset order
      if (originalItemOrder.value.length > 0) {
        const itemMap = new Map(items.value.map(item => [item.id, item]));
        const reorderedItems = originalItemOrder.value
          .map(id => itemMap.get(id))
          .filter(item => item !== undefined) as JunctionRecord[];
        
        if (reorderedItems.length > 0) {
          items.value = reorderedItems;
        }
      }
      
      // Clear all dirty states on global discard
      blockDirtyStates.value.clear();
      logger.debug('Cleared all dirty states on global discard');
      
      // Keep expanded items open for better UX
      // expandedItems stays the same
      
      // Emit the reset state
      isInternalUpdate.value = true;
      emit('input', newVal);
      nextTick(() => {
        isInternalUpdate.value = false;
      });
    }
    // If it's not a reset, it could be individual field updates which we ignore here
  }, { deep: true });

  /**
   * Watch for save events by monitoring initialValues changes
   * When Directus saves, it updates initialValues to match the saved state
   */
  watch(() => initialValues.value?.[props.field], async (newVal, oldVal) => {
    
    // Skip if not fully initialized to prevent initial trigger
    if (!isFullyInitialized.value) {
      return;
    }
    
    // Skip initial value setting
    if (!oldVal && newVal) {
      return;
    }
    
    if (!newVal || !items.value.length) return;
    
    // This is likely a save event
    logger.debug('Save detected - reloading data to reset dirty state');
    
    
    // Set internal update flag to prevent double emit
    isInternalUpdate.value = true;
    
    // Update originalItemOrder with current order after save
    originalItemOrder.value = items.value.map(item => item.id);
    
    logger.debug('Updated originalItemOrder after save:', originalItemOrder.value);
    // WICHTIG: Warte bis loadFullItemData fertig ist!
    await loadFullItemData(true);  // Pass true to indicate this is after a save
    
    // Nach dem Laden sind alle blockOriginalStates aktualisiert
    // und processLoadedRecords hat bereits korrekt emittiert
    logger.debug('✅ Data reload complete after save');
    
    // Reset internal update flag after a tick
    await nextTick();
    isInternalUpdate.value = false;
    
  }, { deep: true });

  /**
   * Watch for primaryKey changes - Extension loads before primaryKey is available
   */
  watch(() => props.primaryKey, async (newKey, oldKey) => {
    logger.debug('Primary key changed:', { oldKey, newKey });

    if (newKey && newKey !== '+' && newKey !== 'new' && newKey !== oldKey) {
      logger.debug('Valid primary key received, loading data...');
      await loadFullItemData();
    }
  }, { immediate: false });

  /* DEPRECATED - All these functions have been moved to useM2AData composable:
   * - loadAllowedCollections()
   * - setAllowedCollections()
   * - loadRelationInfo()
   * - loadFullItemData()
   * - processPasteData()
   * - processLoadedRecords()
   * 
   * The code has been removed to avoid duplication and parsing errors.
   */

  // UI Helper functions
  function getActualItemId(item: JunctionRecord): string | number {
    return getItemActualId(item);
  }

  function getItemTitle(item: JunctionRecord): string {
    return extractItemTitle(item);
  }

  function getCollectionName(item: JunctionRecord): string {
    const actualItem = item.item || item;
    const collection = (actualItem as any).collection || item.collection;
    const collectionInfo = collectionsStore.getCollection(collection);
    return collectionInfo?.name || collection || 'Unknown';
  }

  function getCollectionIcon(item: JunctionRecord): string | null {
    const actualItem = item.item || item;
    const collection = (actualItem as any).collection || item.collection;
    const collectionInfo = collectionsStore.getCollection(collection);
    return collectionInfo?.meta?.icon || null;
  }

  function getFieldsForItem(item: JunctionRecord): any[] {
    const actualItem = item.item || item;
    const collection = (actualItem as any).collection || item.collection;
    
    if (!collection) {
      logger.warn('No collection found for item:', item);
      return [];
    }
    
    return fieldsStore.getFieldsForCollection(collection)
      .filter((field: any) => {
        if (field.meta?.hidden || field.meta?.readonly) return false;
        if (['id', 'user_created', 'date_created', 'user_updated', 'date_updated'].includes(field.field)) return false;
        if (!field.meta?.interface) return false;
        
        if (mergedOptions.value?.showFieldsFilter && mergedOptions.value?.showFieldsFilter.length > 0) {
          return mergedOptions.value?.showFieldsFilter.includes(field.field);
        }
        
        return true;
      });
  }


  // Status functions
  function hasStatusField(item: JunctionRecord): boolean {
    const actualItem = item.item || item;
    const collection = item.collection || (actualItem as any).collection;
    
    if (!collection) return false;
    
    const fields = fieldsStore.getFieldsForCollection(collection);
    return fields.some((field: any) => field.field === 'status');
  }

  function getItemStatus(item: JunctionRecord): string {
    const actualItem = item.item || item;
    return (actualItem as ItemRecord).status || 'draft';
  }

  function getStatusLabel(status: string): string {
    const statusConfig = availableStatuses.find(s => s.value === status);
    return statusConfig?.label || status;
  }


  // Nested M2A functions
  function hasNestedM2A(item: JunctionRecord): boolean {
    if (!item.item || typeof item.item !== 'object') return false;
    if (!m2aStructure.value?.nestedM2AFields) return false;
    
    const collection = item.collection;
    return !!m2aStructure.value.nestedM2AFields[collection];
  }

  function getM2AFields(item: JunctionRecord): Record<string, any> {
    if (!item.item || typeof item.item !== 'object') return {};
    
    const m2aFields: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(item.item)) {
      if (Array.isArray(value) && value.length > 0 && value[0]?.collection && value[0]?.item) {
        m2aFields[key] = value;
      }
    }
    
    return m2aFields;
  }

  function formatFieldName(name: string): string {
    return name
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  // Return everything the component needs
  return {
    // State
    items,
    expandedItems,
    loading,
    relationInfo,
    m2aStructure,
    allowedCollections,
    deleteDialog,
    itemToDelete,
    isInitialLoad,
    mergedOptions,
    blockOriginalStates,
    originalItemOrder,
    availableStatuses,
    
    // Computed
    sortable,
    saveButtonWouldBeActive,
    shouldShowItemId,
    canAddMoreBlocks,
    allowedCollectionsMap,  // From useM2AData
    
    // Methods
    initialize,
    getItemId,
    getActualItemId,
    isNewItem,
    getItemTitle,
    getCollectionName,
    getCollectionIcon,
    getFieldsForItem,
    toggleExpand,
    updateItem,
    addNewItem,
    showDeleteDialog,
    confirmDeleteItem,
    duplicateItem,
    discardChanges,
    onSort,
    hasStatusField,
    getItemStatus,
    getStatusLabel,
    updateItemStatus,
    hasNestedM2A,
    getM2AFields,
    formatFieldName,
    isBlockDirty,
    
    // From useM2AData composable
    loadFullItemData,
    processLoadedRecords,
    processPasteData
  };
}
