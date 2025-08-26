import { ref, computed, nextTick, markRaw, type Ref } from 'vue';
import { useApi, useStores } from '@directus/extensions-sdk';
import { M2AHelper, type M2AFieldInfo } from '../utils/m2a-helper';
import { deepClone, deepEqual, getActualItemId } from '../utils/helpers';
import { logDebug, logError, logWarn } from '../utils/logger-wrapper';
import { isItemObject } from '../utils/validation';
import { createApiClient } from '../services/api-client';
import type { IDirectusApiClient } from '../services/api-client.types';
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
  DirectusNotificationsStore
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

  // Initialize M2A Helper and API Client
  const m2aHelper = new M2AHelper(api, stores);
  const apiClient: IDirectusApiClient = createApiClient(api);

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
  
  // Usage data state - use markRaw to prevent Vue reactivity
  const blockUsageDataStore = ref<Record<string, any>>(markRaw({}));
  const blockUsageData = computed(() => blockUsageDataStore.value);

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
    deletedItemsCount,
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
      isFullyInitialized,
      deletedItemsCount
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
    },
    permissions: {
      canUpdateItem,
      canReadItem,
      canDeleteItem
    }
  };

  // Initialize composables with context
  const blockActions = useBlockActions(ctx);
  const m2aData = useM2AData(ctx, updateOriginalItemOrder, clearStateTracking);
  const watchers = useBlockWatchers(ctx, updateOriginalItemOrder, clearStateTracking, m2aData.loadFullItemData, m2aData.processPasteData);
  const uiHelpers = useUIHelpers(ctx);
  const permissions = usePermissionChecks(computed(() => mergedOptions.value));
  
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
    
    // Filter collections where user has read permission AND either create or update permission
    // This ensures users can actually do something with the items they select
    return allowedCollectionsForExisting.value.filter(collection => {
      const hasReadPermission = permissionsStore.hasPermission(collection.collection, 'read');
      if (!hasReadPermission) {
        logDebug('User has no read permission for collection', { collection: collection.collection });
        return false;
      }
      
      // Check if user can either create (for duplicate) or update (for link) items
      const hasCreatePermission = permissionsStore.hasPermission(collection.collection, 'create');
      const hasUpdatePermission = permissionsStore.hasPermission(collection.collection, 'update');
      
      if (!hasCreatePermission && !hasUpdatePermission) {
        logDebug('User has read but no create/update permission for collection', { 
          collection: collection.collection,
          permissions: { read: true, create: hasCreatePermission, update: hasUpdatePermission }
        });
        return false;
      }
      
      return true;
    });
  });
  
  // Check if user can read a specific collection
  function canReadCollection(collection: string): boolean {
    if (!permissionsStore) return true; // If no permissions store, assume full access
    const canRead = permissionsStore.hasPermission(collection, 'read');
    if (!canRead) {
      logDebug('User has no read permission for collection', { collection });
    }
    return canRead;
  }
  
  // Check if user can update a specific collection
  function canUpdateCollection(collection: string): boolean {
    if (!permissionsStore) return true; // If no permissions store, assume full access
    const canUpdate = permissionsStore.hasPermission(collection, 'update');
    if (!canUpdate) {
      logDebug('User has no update permission for collection', { collection });
    }
    return canUpdate;
  }
  
  // Check if user can read a specific item
  function canReadItem(item: JunctionRecord): boolean {
    const collection = item.collection;
    
    if (!collection) {
      logWarn('No collection found for item, assuming can read', { item });
      return true;
    }
    
    return canReadCollection(collection);
  }
  
  // Check if user can update a specific item
  function canUpdateItem(item: JunctionRecord): boolean {
    // M2A structure: item.collection contains the target collection name
    const collection = item.collection;
    
    // logDebug('Checking update permission for item', {
    //   collection,
    //   itemStructure: {
    //     hasCollection: !!item.collection,
    //     hasItem: !!item.item,
    //     collectionValue: item.collection
    //   }
    // });
    //
    if (!collection) {
      logWarn('No collection found for item, assuming can update', { item });
      return true;
    }
    
    return canUpdateCollection(collection);
  }
  
  // Check if user can delete a specific collection
  function canDeleteCollection(collection: string): boolean {
    if (!permissionsStore) return true; // If no permissions store, assume full access
    const canDelete = permissionsStore.hasPermission(collection, 'delete');
    if (!canDelete) {
      logDebug('User has no delete permission for collection', { collection });
    }
    return canDelete;
  }
  
  // Check if user can delete a specific item
  function canDeleteItem(item: JunctionRecord): boolean {
    const collection = item.collection;
    
    if (!collection) {
      logWarn('No collection found for item, assuming can delete', { item });
      return true;
    }
    
    return canDeleteCollection(collection);
  }

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
      // First check if usage tracking is available at all
      const hasUsageTracking = await apiClient.isFeatureAvailable('usageTracking');
      
      // If API is not available, skip loading usage data entirely
      if (!hasUsageTracking) {
        logDebug('Usage tracking not available, skipping usage data loading');
        return;
      }
      
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
      
      // Collect all usage data updates
      const newUsageData: Record<string, any> = {};
      
      // Load usage data for each collection
      const currentParentId = props.primaryKey; // Define once at the beginning
      
      const usagePromises = Array.from(itemsByCollection.entries()).map(async ([collection, ids]) => {
        try {
          // We already know the API is available from the check above
          // Use custom API to get usage data for each item
          const usageDataPromises = ids.map(async (id) => {
            const usage = await apiClient.getItemUsage(collection, id);
            if (usage) {
              return {
                id,
                usage_summary: usage.usage_summary,
                usage_locations: usage.usage_locations
              };
            }
            return { id };
          });
          const responseData = await Promise.all(usageDataPromises);
          
          // Store usage data by item ID
          
          // Ensure response data exists and is an array
          if (!Array.isArray(responseData)) {
            logWarn('Invalid response data from API', { collection, responseData });
            return;
          }
          
          responseData.forEach((item: any) => {
            // Skip items with no permission or invalid data
            if (!item || typeof item !== 'object' || item._no_permission) {
              return;
            }
            
            // Ensure item has an id
            if (!item.id) {
              logWarn('Item missing id', { item });
              return;
            }
            
            // Filter out usage from current context (page/item we're currently editing)
            if (item.usage_summary?.total_count > 0) {
              const allUsageLocations = Array.isArray(item.usage_locations) ? item.usage_locations : [];
              
              // Count locations on current page and external pages
              let externalLocations = allUsageLocations;
              let locationsOnCurrentPage = 0;
              
              if (currentParentId !== undefined && currentParentId !== null && currentParentId !== '') {
                const currentParentIdStr = String(currentParentId);
                // Count how many times it's used on current page
                locationsOnCurrentPage = allUsageLocations.filter((location: any) => 
                  String(location.id) === currentParentIdStr
                ).length;
                // External locations are those NOT on current page
                externalLocations = allUsageLocations.filter((location: any) => 
                  String(location.id) !== currentParentIdStr
                );
              }
              
              // Calculate counts
              const externalCount = externalLocations.length;
              // Internal count is how many MORE times it's used on this page (minus the current one)
              const internalCount = locationsOnCurrentPage > 0 ? locationsOnCurrentPage - 1 : 0;
              
              // Store usage info if there are any usages (external OR internal)
              if (externalCount > 0 || internalCount > 0) {
                const key = `${collection}:${item.id}`;
                // Create plain object without Vue reactivity proxies
                const usageInfo = {
                  usageCount: externalCount + internalCount, // Total visible count
                  externalCount,
                  internalCount,
                  externalLocations,
                  usageSummary: {
                    total_count: item.usage_summary?.total_count || 0, // Keep original total
                    by_collection: item.usage_summary?.by_collection || {},
                    by_status: item.usage_summary?.by_status || {}
                  }
                };
                
                // Ensure we're not storing Vue reactive objects
                newUsageData[key] = JSON.parse(JSON.stringify(usageInfo));
              }
            }
          });
        } catch (error) {
          logError(`Error loading usage data for ${collection}`, error);
        }
      });
      
      await Promise.all(usagePromises);
      
      // Update blockUsageData once with all collected data
      // Create new marked raw object to prevent reactivity
      blockUsageDataStore.value = markRaw({ ...blockUsageDataStore.value, ...newUsageData });
      
    } catch (error) {
      logError('Error loading block usage data', error);
    }
  }
  
  /**
   * Get usage data for a specific block
   */
  function getBlockUsageData(item: JunctionRecord) {
    try {
      if (!item || typeof item !== 'object') {
        return null;
      }
      
      const collection = item.collection;
      const itemId = getActualItemId(item);
      
      if (!collection || !itemId || isNewItem(item)) {
        return null;
      }
      
      const key = `${collection}:${itemId}`;
      if (!blockUsageDataStore.value || typeof blockUsageDataStore.value !== 'object') {
        return null;
      }
      
      // Return a plain object to avoid Vue reactivity issues
      const data = blockUsageDataStore.value[key];
      if (!data) return null;
      
      // Create a shallow copy to avoid reactivity chains
      return {
        usageCount: data.usageCount || 0,
        externalCount: data.externalCount || 0,
        internalCount: data.internalCount || 0,
        externalLocations: data.externalLocations || [],
        usageSummary: data.usageSummary || null
      };
    } catch (error) {
      logError('getBlockUsageData - Error:', error, { item });
      return null;
    }
  }

  // Return all public methods and state
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
      deletedItemsCount,
    
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
    canReadCollection,
    canUpdateCollection,
    canDeleteCollection,
    canReadItem,
    canUpdateItem,
    canDeleteItem,
    
    // Actions from blockActions
    toggleExpand: blockActions.toggleExpand,
    showDeleteDialog: blockActions.showDeleteDialog,
    addNewItem: blockActions.addNewItem,
    addExistingItems: blockActions.addExistingItems,
    addAsNewItems: blockActions.addAsNewItems,
    updateItem: blockActions.updateItem,
    unlinkItem: blockActions.unlinkItem,
    confirmDeleteItem: blockActions.confirmDeleteItem,
    removeAllDeletedItems: blockActions.removeAllDeletedItems,
    duplicateItem: blockActions.duplicateItem,
    discardChanges: blockActions.discardChanges,
    updateItemStatus: blockActions.updateItemStatus,
    onSort: blockActions.onSort,
    checkItemUsage: blockActions.checkItemUsage,
    deleteItemWithConfirmation: blockActions.deleteItemWithConfirmation,
    
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