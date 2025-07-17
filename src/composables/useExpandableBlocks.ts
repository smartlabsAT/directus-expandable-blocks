import { ref, computed, nextTick, type Ref } from 'vue';
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
import { useBlockWatchers } from './useBlockWatchers';
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

  // Initialize watchers composable
  const watchers = useBlockWatchers(
    items,
    expandedItems,
    loading,
    blockOriginalStates,
    blockDirtyStates,
    originalItemOrder,
    isInitialLoad,
    isInternalUpdate,
    isFullyInitialized,
    updateOriginalItemOrder,
    clearStateTracking,
    deepEqual,
    loadFullItemData,
    processPasteData,
    props,
    emit,
    values,
    initialValues
  );
  const { setupWatchers } = watchers;

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
      
      // Setup watchers
      setupWatchers();
      
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

  // All watchers have been moved to useBlockWatchers composable
  // The watchers are set up in the initialize function via setupWatchers()

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
