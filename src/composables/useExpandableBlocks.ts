import { ref, computed, nextTick, type Ref } from 'vue';
import { useApi, useStores } from '@directus/extensions-sdk';
import { M2AHelper, type M2AFieldInfo } from '../utils/m2a-helper';
import { deepClone } from '../utils/helpers';
import { logDebug, logError } from '../utils/logger-wrapper';
import { useBlockState } from './useBlockState';
import { useBlockActions } from './useBlockActions';
import { useM2AData } from './useM2AData';
import { useBlockWatchers } from './useBlockWatchers';
import { useUIHelpers } from './useUIHelpers';
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
  const { useFieldsStore, useRelationsStore, useCollectionsStore, useNotificationsStore } = stores;
  const fieldsStore = useFieldsStore() as DirectusFieldsStore;
  const relationsStore = useRelationsStore() as DirectusRelationsStore;
  const collectionsStore = useCollectionsStore() as DirectusCollectionsStore;
  const notificationsStore = useNotificationsStore() as DirectusNotificationsStore;

  // Initialize M2A Helper
  const m2aHelper = new M2AHelper(api, stores);

  // Local state
  const relationInfo = ref<RelationInfo | null>(null);
  const m2aStructure = ref<M2AFieldInfo | null>(null);
  const allowedCollections = ref<CollectionInfo[]>([]);
  const deleteDialog = ref(false);
  const itemToDelete = ref<{ item: JunctionRecord; index: number } | null>(null);
  const mergedOptions = ref<ExpandableBlocksOptions>({});

  // Status configuration
  const availableStatuses = [
    { value: 'published', label: 'Published' },
    { value: 'draft', label: 'Draft' },
    { value: 'archived', label: 'Archived' }
  ];

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
    deepEqual,
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

  // Return consolidated API
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
    allowedCollectionsMap: m2aData.allowedCollectionsMap,
    
    // Core methods
    initialize,
    getItemId,
    isNewItem,
    isBlockDirty,
    
    // Actions from blockActions
    toggleExpand: blockActions.toggleExpand,
    showDeleteDialog: blockActions.showDeleteDialog,
    addNewItem: blockActions.addNewItem,
    updateItem: blockActions.updateItem,
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
    processPasteData: m2aData.processPasteData
  };
}