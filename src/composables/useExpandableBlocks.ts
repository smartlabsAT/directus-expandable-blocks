import { ref, computed, nextTick, type Ref, type ComputedRef } from 'vue';
import { useApi, useStores } from '@directus/extensions-sdk';
import { M2AHelper, type M2AFieldInfo } from '../utils/m2a-helper';
import { deepClone, deepEqual, getActualItemId } from '../utils/helpers';
import { logDebug, logError } from '../utils/logger-wrapper';
import { isItemObject } from '../utils/validation';
import { useBlockState } from './useBlockState';
import { useBlockActions } from './useBlockActions';
import { useM2AData } from './useM2AData';
import { useBlockWatchers } from './useBlockWatchers';
import { useUIHelpers } from './useUIHelpers';
import { usePermissionChecks } from './usePermissionChecks';
import type { 
  ExpandableBlocksOptions, 
  JunctionRecord, 
  CollectionInfo, 
  RelationInfo,
  DirectusFormValues,
  DirectusFieldsStore,
  DirectusRelationsStore,
  DirectusCollectionsStore,
  DirectusNotificationsStore,
  DirectusPermissionsStore
} from '../types';
import type { ExpandableBlocksContext } from '../types/composable-context';

// Use the UseExpandableBlocksProps from types/index.ts instead
import type { UseExpandableBlocksProps as BaseProps } from '../types';

// Extend to allow null values
export interface UseExpandableBlocksProps extends Omit<BaseProps, 'value'> {
  value: JunctionRecord[] | null;
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
  const { useFieldsStore, useRelationsStore, useCollectionsStore, useNotificationsStore, usePermissionsStore } = stores;
  const fieldsStore = useFieldsStore() as DirectusFieldsStore;
  const relationsStore = useRelationsStore() as DirectusRelationsStore;
  const collectionsStore = useCollectionsStore() as DirectusCollectionsStore;
  const notificationsStore = useNotificationsStore() as DirectusNotificationsStore;
  const permissionsStore = usePermissionsStore ? usePermissionsStore() : null;

  // Initialize M2A Helper
  const m2aHelper = new M2AHelper(api, stores);

  // Local state
  const relationInfo = ref<RelationInfo | null>(null);
  const m2aStructure = ref<M2AFieldInfo | null>(null);
  const allowedCollections = ref<CollectionInfo[]>([]);
  const allowedCollectionsForExisting = ref<CollectionInfo[]>([]);
  const deleteDialog = ref(false);
  const itemToDelete = ref<{ item: JunctionRecord; index: number } | null>(null);
  const mergedOptions = ref<ExpandableBlocksOptions>({});

  // Status configuration
  const availableStatuses = [
    { value: 'published', label: 'Published' },
    { value: 'draft', label: 'Draft' },
    { value: 'archived', label: 'Archived' }
  ];
  
  // Usage data state
  const blockUsageData = ref<Record<string, any>>({});

  // Computed properties
  const sortable = computed(() => mergedOptions.value?.enableSorting !== false);
  
  const saveButtonWouldBeActive = computed(() => {
    if (!values.value || !initialValues.value || !props.field) return false;
    const currentValue = values.value[props.field];
    const initialValue = initialValues.value[props.field];
    return JSON.stringify(currentValue) !== JSON.stringify(initialValue);
  });

  const shouldShowItemId = computed(() => {
    const value = mergedOptions.value?.showItemId;
    if (value === false) return false;
    if (value === undefined) return true;
    return value;
  });

  const shouldShowCollectionName = computed(() => {
    const value = mergedOptions.value?.showCollectionName;
    if (value === false) return false;
    if (value === undefined) return true;
    return value;
  });

  const canAddMoreBlocks = computed(() => {
    const maxBlocks = mergedOptions.value?.maxBlocks;
    if (!maxBlocks || maxBlocks <= 0) return true;
    return items.value.length < maxBlocks;
  });

  // Initialize block state
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
    getItemId,
    isNewItem
  } = blockState;

  // Create context object
  const ctx: ExpandableBlocksContext = {
    state: {
      items,
      expandedItems,
      loading,
      blockOriginalStates,
      blockDirtyStates,
      originalItemOrder,
      isInternalUpdate,
      isInitialLoad,
      isFullyInitialized
    },
    stateFns: {
      getItemId,
      isNewItem,
      prepareItemsForEmit,
      updateOriginalState,
      markBlockDirty,
      removeBlockState,
      isBlockDirty,
      resetBlockState
    },
    deps: {
      api,
      emit,
      props,
      stores: {
        notificationsStore,
        fieldsStore,
        relationsStore,
        collectionsStore
      },
      helpers: {
        m2aHelper,
        deepEqual
      }
    },
    ui: {
      deleteDialog,
      itemToDelete,
      mergedOptions: computed(() => mergedOptions.value),
      canAddMoreBlocks,
      availableStatuses
    },
    data: {
      relationInfo,
      allowedCollections,
      allowedCollectionsForExisting,
      m2aStructure,
      values,
      initialValues
    }
  };

  // Initialize composables with context
  const blockActions = useBlockActions(ctx);
  const m2aData = useM2AData(ctx, updateOriginalItemOrder, clearStateTracking);
  const watchers = useBlockWatchers(ctx, updateOriginalItemOrder, clearStateTracking, m2aData.loadFullItemData, m2aData.processPasteData);
  const uiHelpers = useUIHelpers(ctx);
  const permissions = usePermissionChecks(mergedOptions);
  
  // Computed collections filtered by permissions
  const allowedCollectionsWithPermissions = computed(() => {
    if (!permissionsStore) return allowedCollections.value;
    
    // Filter collections where user has create permission
    return allowedCollections.value.filter(collection => {
      const hasCreatePermission = permissionsStore.hasPermission(collection.collection, 'create');
      if (!hasCreatePermission) {
        logDebug('User has no create permission for collection', { collection: collection.collection });
      }
      return hasCreatePermission;
    });
  });
  
  const allowedCollectionsForExistingWithPermissions = computed(() => {
    if (!permissionsStore) return allowedCollectionsForExisting.value;
    
    // Filter collections where user has read permission
    return allowedCollectionsForExisting.value.filter(collection => {
      const hasReadPermission = permissionsStore.hasPermission(collection.collection, 'read');
      if (!hasReadPermission) {
        logDebug('User has no read permission for collection', { collection: collection.collection });
      }
      return hasReadPermission;
    });
  });

  /**
   * Load all options from field configuration
   */
  async function loadFieldOptions() {
    let fieldOptions = { ...props.options };
    
    try {
      const fields = fieldsStore.getFieldsForCollection(props.collection);
      const fieldConfig = fields.find((f: any) => f.field === props.field);
      if (fieldConfig?.meta?.options) {
        fieldOptions = { ...fieldOptions, ...fieldConfig.meta.options };
        logDebug('Loaded field options from store', { options: fieldConfig.meta.options });
      }
    } catch (error) {
      logDebug('Failed to get field options from store', { error });
    }
    
    mergedOptions.value = fieldOptions;
    logDebug('Final merged options', { options: mergedOptions.value });
  }

  /**
   * Initialize the component
   */
  async function initialize() {
    logDebug('Component mounted', {
      field: props.field,
      primaryKey: props.primaryKey,
      props
    });
    
    // Store the original order from props.value
    if (Array.isArray(props.value)) {
      originalItemOrder.value = props.value.map(item => {
        return isItemObject(item) ? item.id : item;
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
      
      // Initialize M2A data
      await m2aData.initialize();
      
      // Implement startExpanded option
      if (mergedOptions.value?.startExpanded && items.value.length > 0) {
        expandedItems.value = items.value.map(item => getItemId(item));
      }
      
      // Setup watchers
      watchers.setupWatchers();
      
      // Mark as fully initialized
      await nextTick();
      setTimeout(() => {
        isFullyInitialized.value = true;
      }, 100);
      
    } catch (error) {
      logError('Error initializing expandable blocks', error);
      notificationsStore.add({
        title: 'Initialization Error',
        text: 'Failed to initialize expandable blocks. Please refresh the page.',
        type: 'error'
      });
    }
  }

  /**
   * Load usage data for existing blocks
   */
  async function loadBlockUsageData() {
    try {
      // Get all existing item IDs grouped by collection
      const itemsByCollection = new Map<string, (string | number)[]>();
      
      items.value.forEach(item => {
        if (!isNewItem(item)) {
          const collection = item.collection;
          const itemId = getActualItemId(item);
          
          if (collection && itemId) {
            if (!itemsByCollection.has(collection)) {
              itemsByCollection.set(collection, []);
            }
            itemsByCollection.get(collection)!.push(itemId);
          }
        }
      });
      
      // Load usage data for each collection
      const usagePromises = Array.from(itemsByCollection.entries()).map(async ([collection, ids]) => {
        try {
          const response = await api.post(
            `/expandable-blocks-api/${collection}/detail`,
            { ids, fields: '*' }
          );
          
          // Store usage data by item ID
          const currentParentId = props.primaryKey;
          
          response.data.data.forEach((item: any) => {
            if (item.usage_summary?.total_count > 0) {
              // Group locations by parent entity
              const locationsByParent = new Map<string, any>();
              
              item.usage_locations.forEach((location: any) => {
                const parentKey = `${location.collection}:${location.id}`;
                if (!locationsByParent.has(parentKey)) {
                  locationsByParent.set(parentKey, {
                    collection: location.collection,
                    id: location.id,
                    count: 0,
                    locations: []
                  });
                }
                const parent = locationsByParent.get(parentKey);
                parent.count++;
                parent.locations.push(location);
              });
              
              // Calculate usage counts
              let externalCount = 0;
              let internalCount = 0;
              const externalLocations: any[] = [];
              
              locationsByParent.forEach((parent) => {
                if (parent.id === currentParentId) {
                  // Internal usages: count - 1 (for current instance)
                  internalCount = Math.max(0, parent.count - 1);
                } else {
                  // External usages: full count
                  externalCount += parent.count;
                  externalLocations.push(...parent.locations);
                }
              });
              
              const totalCount = externalCount + internalCount;
              
              // Only store if there are other usages
              if (totalCount > 0) {
                blockUsageData.value[`${collection}:${item.id}`] = {
                  usageCount: totalCount,
                  externalCount,
                  internalCount,
                  externalLocations,
                  usageSummary: {
                    ...item.usage_summary,
                    total_count: totalCount
                  }
                };
              }
            }
          });
        } catch (error) {
          logError(`Error loading usage data for ${collection}`, error);
        }
      });
      
      await Promise.all(usagePromises);
      
      logDebug('Loaded block usage data', {
        totalBlocksWithUsage: Object.keys(blockUsageData.value).length,
        data: blockUsageData.value
      });
    } catch (error) {
      logError('Error loading block usage data', error);
    }
  }
  
  /**
   * Get usage data for a specific block
   */
  function getBlockUsageData(item: JunctionRecord) {
    const collection = item.collection;
    const itemId = getActualItemId(item);
    
    if (!collection || !itemId || isNewItem(item)) {
      return null;
    }
    
    return blockUsageData.value[`${collection}:${itemId}`] || null;
  }

  // Return consolidated API
  return {
    // State
    items,
    expandedItems,
    loading,
    relationInfo,
    m2aStructure,
    allowedCollections,
    allowedCollectionsForExisting,
    deleteDialog,
    itemToDelete,
    isInitialLoad,
    mergedOptions,
    blockOriginalStates,
    originalItemOrder,
    availableStatuses,
    blockUsageData,
    
    // Computed
    sortable,
    saveButtonWouldBeActive,
    shouldShowItemId,
    shouldShowCollectionName,
    canAddMoreBlocks,
    allowedCollectionsMap: m2aData.allowedCollectionsMap,
    allowedCollectionsWithPermissions,
    allowedCollectionsForExistingWithPermissions,
    
    // Core methods
    initialize,
    getItemId,
    isNewItem,
    isBlockDirty,
    loadBlockUsageData,
    getBlockUsageData,
    
    // Actions from blockActions
    toggleExpand: blockActions.toggleExpand,
    showDeleteDialog: blockActions.showDeleteDialog,
    addNewItem: blockActions.addNewItem,
    addExistingItems: blockActions.addExistingItems,
    addAsNewItems: blockActions.addAsNewItems,
    updateItem: blockActions.updateItem,
    unlinkItem: blockActions.unlinkItem,
    confirmDeleteItem: blockActions.confirmDeleteItem,
    duplicateItem: blockActions.duplicateItem,
    discardChanges: blockActions.discardChanges,
    updateItemStatus: blockActions.updateItemStatus,
    onSort: blockActions.onSort,
    
    // UI helpers
    ...uiHelpers,
    
    // From useM2AData (for interface.vue if needed)
    loadFullItemData: m2aData.loadFullItemData,
    processLoadedRecords: m2aData.processLoadedRecords,
    processPasteData: m2aData.processPasteData,
    
    // Permissions
    ...permissions
  };
}