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

  // Helper to get the sort field from relationInfo
  function getSortField(): string | undefined {
    return relationInfo.value?.meta?.sort_field;
  }

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
      
      // Analyze M2A structure
      try {
        m2aStructure.value = await m2aHelper.analyzeM2AStructure(
          props.collection,
          props.field
        );
      } catch (error) {
        logger.warn('Failed to analyze M2A structure:', error);
      }
      
      // Load allowed collections
      await loadAllowedCollections();
      
      // Load relation info
      await loadRelationInfo();
      
      // Load data
      await loadFullItemData();
      
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

  /**
   * Load allowed collections from various sources
   */
  async function loadAllowedCollections() {
    // Use merged options which already contains field store options
    const fieldOptions = mergedOptions.value || {};
    
    // First, always try to get the M2A configured collections
    const relations = relationsStore.getRelationsForField(props.collection, props.field);
    let m2aConfiguredCollections: string[] = [];
    if (relations && relations.length > 0) {
      // For M2A, we need to look at all relations to find the configured collections
      for (const relation of relations) {
        // Store the first relation as relationInfo
        if (!relationInfo.value) {
          relationInfo.value = relation;
        }
        
        // Try to get collections from different places
        if (relation.meta?.one_allowed_collections) {
          const collections = parseAllowedCollections(relation.meta.one_allowed_collections);
          if (collections.length > 0) {
            m2aConfiguredCollections = collections;
            break;
          }
        }
      }
      
      // If still no collections found, try to get them from the field configuration
      if (m2aConfiguredCollections.length === 0) {
        const field = fieldsStore.getField(props.collection, props.field) as any;
        
        // Check if field has special configuration for M2A
        if (field?.special && (field.special as string[]).includes('m2a')) {
          // Get the junction collection
          const junctionRelation = relations.find(r => r.meta?.junction_field);
          if (junctionRelation) {
            const junctionCollection = junctionRelation.collection;
            
            // Get all fields from junction to find related collections
            const junctionFields = fieldsStore.getFieldsForCollection(junctionCollection);
            
            // Find the one_collection field
            const oneCollectionField = junctionFields.find(f => 
              f.field === 'collection' || 
              f.field === 'item' || 
              (f.type === 'string' && f.meta?.interface === 'select-dropdown')
            );
            
            // Extract collections from field configuration
            if (oneCollectionField?.meta?.options?.choices) {
              m2aConfiguredCollections = oneCollectionField.meta.options.choices
                .map((choice: any) => typeof choice === 'string' ? choice : choice.value)
                .filter(Boolean);
            }
          }
        }
      }
    }
    
    // Now check the interface options
    if (fieldOptions?.allowedCollections !== undefined && Array.isArray(fieldOptions.allowedCollections)) {
      if (fieldOptions.allowedCollections.length > 0) {
        // Specific collections selected - use only these
        setAllowedCollections(fieldOptions.allowedCollections);
      } else {
        // Empty array means "no restrictions" - use all M2A collections
        if (m2aConfiguredCollections.length > 0) {
          setAllowedCollections(m2aConfiguredCollections);
        }
      }
    } else {
      // allowedCollections not set at all - use M2A collections
      if (m2aConfiguredCollections.length > 0) {
        setAllowedCollections(m2aConfiguredCollections);
      }
    }
  }

  /**
   * Set allowed collections with proper formatting
   */
  function setAllowedCollections(collections: string[]) {
    allowedCollections.value = collections.map((col: string) => {
      const collection = collectionsStore.getCollection(col);
      return {
        collection: col,
        name: collection?.name || col,
        meta: collection?.meta
      };
    });
  }

  /**
   * Load relation info for junction handling
   */
  async function loadRelationInfo() {
    if (!relationInfo.value) {
      const relations = relationsStore.getRelationsForField(props.collection, props.field);
      if (relations && relations.length > 0) {
        relationInfo.value = relations[0];
      }
    }
    
    if (relationInfo.value) {
      // Determine junction collection
      let junctionCollection = 
        relationInfo.value.meta?.junction_field ? relationInfo.value.collection :
        relationInfo.value.related_collection && relationInfo.value.related_collection !== props.collection ? 
          relationInfo.value.related_collection : 
          `${props.collection}_${props.field}`;
      
      const foreignKeyField = `${props.collection}_id`;
      
      relationInfo.value.junctionCollection = junctionCollection;
      relationInfo.value.foreignKeyField = foreignKeyField;
      
      logger.debug('Junction info:', {
        junctionCollection,
        foreignKeyField
      });
    }
  }

  /**
   * Check for delayed options loading
   */
  function checkDelayedOptions() {
    if (fieldsStore && props.collection && props.field) {
      try {
        const fields = fieldsStore.getFieldsForCollection(props.collection);
        const fieldConfig = fields.find((f: any) => f.field === props.field);
        
        if (fieldConfig?.meta?.options?.allowedCollections && 
            fieldConfig.meta.options.allowedCollections.length > 0 &&
            allowedCollections.value.length === 0) {
          logger.debug('Found allowed collections in delayed check');
          setAllowedCollections(fieldConfig.meta.options.allowedCollections);
        }
      } catch (error) {
        logger.debug('Delayed options check failed:', error);
      }
    }
  }

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
      checkDelayedOptions();
      if (props.primaryKey && props.primaryKey !== '+' && props.primaryKey !== 'new') {
        await loadFullItemData();
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
          
          // Reload data in new order
          if (props.primaryKey && props.primaryKey !== '+' && props.primaryKey !== 'new') {
            await loadFullItemData();
          }
          return;
        } else if (JSON.stringify(newOrder) === JSON.stringify(originalItemOrder.value)) {
          // Order hasn't changed but we got all IDs - this is still a save
          logger.debug('Save detected - all blocks are clean IDs, order unchanged');
          
          // Clear all dirty states after successful save
          blockDirtyStates.value.clear();
          logger.debug('Cleared all dirty states after save');
          
          // Reload data to get fresh state
          if (props.primaryKey && props.primaryKey !== '+' && props.primaryKey !== 'new') {
            await loadFullItemData();
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
        await processPasteData(newVal);
        return;
      }
    }
    
    // Not a paste event - check if actual items changed (add/remove)
    const oldIds = items.value.map(item => item.id).sort();
    const newIds = (newVal || []).map((item: any) => {
      return typeof item === 'object' ? item.id : item;
    }).filter(id => id != null).sort();
    
    if (JSON.stringify(oldIds) !== JSON.stringify(newIds)) {
      loadFullItemData();
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
    await loadFullItemData();
    
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

  /**
   * Load full item data from the API
   */
  async function loadFullItemData() {
    try {
      if (!props.primaryKey || props.primaryKey === '+' || props.primaryKey === 'new') {
        items.value = [];
        return;
      }
      
      // Check if props.value already contains full objects (e.g., from paste)
      if (Array.isArray(props.value) && props.value.length > 0) {
        const hasFullObjects = props.value.some(item => 
          typeof item === 'object' && 
          item !== null && 
          'collection' in item && 
          'item' in item
        );
        
        if (hasFullObjects) {
          logger.log('🔍 PASTE DETECTED - Full objects in props.value:', {
            propsValueLength: props.value.length,
            validObjectsCount: props.value.filter(item =>
              typeof item === 'object' && 
              item !== null && 
              'collection' in item && 
              'item' in item
            ).length,
            isInitialLoad: isInitialLoad.value,
            isInternalUpdate: isInternalUpdate.value,
            currentItemsLength: items.value.length,
            sample: props.value[0]
          });
          
          // For paste operations, we need to ensure isInitialLoad is false
          // so that processLoadedRecords will update the UI
          if (isInitialLoad.value) {
            logger.log('🔍 PASTE - Setting isInitialLoad to false');
            isInitialLoad.value = false;
          }
          
          // We need to handle mixed arrays (IDs and full objects)
          // First, collect all IDs that are just numbers/strings
          const idsToLoad = props.value.filter(item => 
            typeof item !== 'object' || item === null
          );
          
          // If we have IDs to load, we need to fetch them first
          if (idsToLoad.length > 0) {
            logger.log('🔍 PASTE - Mixed data detected, loading IDs from server:', idsToLoad);
            // Fall through to normal loading process
          } else {
            // All items are full objects, we can process them directly
            logger.log('🔍 PASTE - All items are objects, processing directly');
            processLoadedRecords(props.value as JunctionRecord[]);
            return;
          }
        }
      }
      
      // Check if we have a mix of IDs and full objects that need to be merged
      const existingFullObjects = new Map<string | number, JunctionRecord>();
      if (Array.isArray(props.value)) {
        props.value.forEach(item => {
          if (typeof item === 'object' && item !== null && 'collection' in item && 'item' in item) {
            existingFullObjects.set(item.id, item as JunctionRecord);
          }
        });
      }
      
      // Use M2A helper if available
      if (m2aStructure.value) {
        if (m2aStructure.value.allowedCollections.length === 0 && allowedCollections.value.length > 0) {
          m2aStructure.value.allowedCollections = allowedCollections.value.map(c => c.collection);
        }
        
        const fullRecords = await m2aHelper.loadM2AData(
          props.primaryKey,
          m2aStructure.value,
          0,
          3 // Max depth for nested M2A
        );
        
        // Merge with existing full objects from paste
        const pastedIds = new Set<string | number>();
        if (existingFullObjects.size > 0) {
          logger.log('🔀 Merging pasted objects with loaded data');
          fullRecords.forEach((record, index) => {
            if (existingFullObjects.has(record.id)) {
              fullRecords[index] = existingFullObjects.get(record.id)!;
              pastedIds.add(record.id);
            }
          });
        }
        
        processLoadedRecords(fullRecords, pastedIds);
        return;
      }
      
      // Fallback loading logic
      const junctionCollection = relationInfo.value?.junctionCollection || `${props.collection}_${props.field}`;
      const foreignKeyField = relationInfo.value?.foreignKeyField || `${props.collection}_id`;
      
      const response = await api.get(`/items/${junctionCollection}`, {
        params: {
          filter: {
            [foreignKeyField]: {
              _eq: props.primaryKey
            }
          },
          fields: buildM2AFieldsString(allowedCollections.value),
          limit: -1,
          sort: relationInfo.value?.meta?.sort_field || 'id'
        }
      });
      
      let records = response.data.data || [];
      
      // Merge with existing full objects from paste
      const pastedIds = new Set<string | number>();
      if (existingFullObjects.size > 0) {
        logger.log('🔀 Merging pasted objects with loaded data (fallback)');
        records = records.map((record: JunctionRecord) => {
          if (existingFullObjects.has(record.id)) {
            pastedIds.add(record.id);
            return existingFullObjects.get(record.id)!;
          }
          return record;
        });
      }
      
      processLoadedRecords(records, pastedIds);
    } catch (error) {
      logger.error('Error loading item data:', error);
      notificationsStore.add({
        title: 'Loading Error',
        text: 'Failed to load blocks. Please refresh the page.',
        type: 'error'
      });
    }
  }

  /**
   * Process pasted data from "paste raw value" operation
   * Handles all three data types: IDs only, objects with ID, objects without ID
   * @param pastedData - The pasted array containing mixed data types
   */
  async function processPasteData(pastedData: any[]) {
    logger.log('📋 PROCESS PASTE DATA - Start:', {
      totalItems: pastedData.length,
      currentItemsCount: items.value.length
    });
    
    try {
      // Step 1: Analyze and categorize the pasted data
      const idsToLoad: (string | number)[] = [];
      const objectsWithId: JunctionRecord[] = [];
      const objectsWithoutId: JunctionRecord[] = [];
      
      pastedData.forEach((item, index) => {
        if (typeof item === 'number' || typeof item === 'string') {
          // Just an ID - needs to be loaded
          idsToLoad.push(item);
        } else if (typeof item === 'object' && item !== null && 'collection' in item) {
          if (item.id) {
            // Object with ID
            objectsWithId.push(item);
          } else {
            // Object without ID (new block)
            objectsWithoutId.push(item);
          }
        }
      });
      
      logger.log('📋 PASTE DATA ANALYSIS:', {
        idsToLoad: idsToLoad.length,
        objectsWithId: objectsWithId.length,
        objectsWithoutId: objectsWithoutId.length
      });
      
      // Step 2: Load data for IDs if needed
      let loadedRecords: JunctionRecord[] = [];
      if (idsToLoad.length > 0) {
        try {
          const junctionCollection = relationInfo.value?.junctionCollection || `${props.collection}_${props.field}`;
          const foreignKeyField = relationInfo.value?.foreignKeyField || `${props.collection}_id`;
          
          const response = await api.get(`/items/${junctionCollection}`, {
            params: {
              filter: {
                id: { _in: idsToLoad },
                [foreignKeyField]: { _eq: props.primaryKey }
              },
              fields: buildM2AFieldsString(allowedCollections.value),
              limit: -1
            }
          });
          loadedRecords = response.data.data || [];
          
          // Check for missing IDs
          const foundIds = loadedRecords.map(r => r.id);
          const missingIds = idsToLoad.filter(id => !foundIds.includes(id));
          
          if (missingIds.length > 0) {
            logger.warn('📋 Missing IDs during paste:', {
              requested: idsToLoad,
              found: foundIds,
              missing: missingIds
            });
            
            notificationsStore.add({
              title: 'Warning: Blocks not found',
              text: `The following block IDs do not exist: ${missingIds.join(', ')}`,
              type: 'warning'
            });
          }
          
          logger.log('📋 Loaded records for IDs:', {
            requested: idsToLoad,
            loaded: foundIds,
            missing: missingIds
          });
        } catch (error) {
          logger.error('Failed to load IDs for paste:', error);
        }
      }
      
      // Step 3: Build complete items array in correct order
      const completeItems: JunctionRecord[] = [];
      const pastedItemIds = new Set<string | number>();
      const foreignKeyField = relationInfo.value?.foreignKeyField || `${props.collection}_id`;
      
      pastedData.forEach((item, index) => {
        if (typeof item === 'number' || typeof item === 'string') {
          // Find the loaded record for this ID
          const loaded = loadedRecords.find(r => r.id === item);
          if (loaded) {
            completeItems.push(loaded);
            pastedItemIds.add(loaded.id);
          }
        } else if (typeof item === 'object' && item !== null) {
          // Ensure the object has the correct structure
          const processedItem = { ...item };
          
          // Add foreign key if missing
          if (foreignKeyField && props.primaryKey && !processedItem[foreignKeyField]) {
            const primaryKeyValue = typeof props.primaryKey === 'string' && !isNaN(Number(props.primaryKey)) 
              ? Number(props.primaryKey) 
              : props.primaryKey;
            processedItem[foreignKeyField] = primaryKeyValue;
          }
          
          // Add sort value if missing
          if (relationInfo.value?.meta?.sort_field && !processedItem[relationInfo.value.meta.sort_field]) {
            processedItem[relationInfo.value.meta.sort_field] = index;
          }
          
          completeItems.push(processedItem);
          if (processedItem.id) {
            pastedItemIds.add(processedItem.id);
          }
        }
      });
      
      // Step 4: Preserve original states for existing blocks
      const existingOriginalStates = new Map(blockOriginalStates.value);
      const currentItemsMap = new Map(items.value.map(item => [item.id?.toString(), item]));
      
      // Step 5: Update items.value with the pasted data
      items.value = completeItems;
      
      // Step 6: Update states
      blockOriginalStates.value.clear();
      blockDirtyStates.value.clear();
      
      completeItems.forEach((item, index) => {
        const itemId = item.id?.toString();
        
        if (!item.id) {
          // New block without ID - always dirty
          blockDirtyStates.value.set(`idx_${index}`, true);
          logger.log('📋 New block without ID marked as dirty at index:', index);
        } else if (itemId) {
          // Check if this block existed before
          const existingOriginal = existingOriginalStates.get(itemId);
          const currentItem = currentItemsMap.get(itemId);
          
          if (existingOriginal) {
            // Block existed before - preserve original state
            blockOriginalStates.value.set(itemId, existingOriginal);
            
            // Check if it's dirty by comparing with original
            if (item.item && typeof item.item === 'object') {
              const isDirty = !deepEqual(item.item, existingOriginal);
              if (isDirty) {
                blockDirtyStates.value.set(itemId, true);
                logger.log('📋 Existing block marked as dirty:', itemId);
              }
            }
          } else {
            // New block with ID
            if (item.item && typeof item.item === 'object') {
              blockOriginalStates.value.set(itemId, deepClone(item.item));
              blockDirtyStates.value.set(itemId, true);
              logger.log('📋 New block with ID marked as dirty:', itemId);
            }
          }
        }
      });
      
      // Step 7: Update original item order
      originalItemOrder.value = completeItems
        .filter(item => item.id)
        .map(item => item.id);
      
      logger.log('📋 PASTE PROCESSING COMPLETE:', {
        totalItems: items.value.length,
        dirtyBlocks: Array.from(blockDirtyStates.value.entries()).filter(([_, dirty]) => dirty).length,
        newOrder: originalItemOrder.value
      });
      
      // Step 8: Emit the changes
      isInternalUpdate.value = true;
      const emitValue = prepareItemsForEmit(items.value, getSortField());
      emit('input', emitValue);
      
      await nextTick();
      isInternalUpdate.value = false;
      
    } catch (error) {
      logger.error('Error processing paste data:', error);
      notificationsStore.add({
        title: 'Paste Error',
        text: 'Failed to process pasted data',
        type: 'error'
      });
    }
  }
  
  /**
   * Process loaded records and update state
   * Handles both initial load and subsequent updates
   * On initial load:
   * - Stores original state for dirty tracking
   * - Sets initialValues to array of IDs only (Directus format)
   * - Avoids emitting to prevent dirty state
   * @param fullRecords - Array of junction records with full item data
   */
  function processLoadedRecords(fullRecords: JunctionRecord[], pastedIds?: Set<string | number>) {
    logger.log('📥 PROCESS LOADED RECORDS - Start:', {
      recordsCount: fullRecords.length,
      isInitialLoad: isInitialLoad.value,
      isInternalUpdate: isInternalUpdate.value,
      currentItemsCount: items.value.length,
      recordIds: fullRecords.map(r => r.id),
      hasFullObjects: fullRecords.some(r => r.collection && r.item),
      pastedIds: pastedIds ? Array.from(pastedIds) : []
    });
    
    try {
      // Sort records according to originalItemOrder if available
      if (originalItemOrder.value.length > 0) {
        const recordMap = new Map(fullRecords.map(r => [r.id, r]));
        const sortedRecords = originalItemOrder.value
          .map(id => recordMap.get(id))
          .filter(record => record !== undefined) as JunctionRecord[];
        
        if (sortedRecords.length > 0) {
          logger.debug('Sorted records according to originalItemOrder:', {
            originalOrder: originalItemOrder.value,
            beforeSort: fullRecords.map(r => r.id),
            afterSort: sortedRecords.map(r => r.id)
          });
          fullRecords = sortedRecords;
        }
      }
      
      // Initial load - don't emit
      if (isInitialLoad.value) {
        logger.log('📥 PROCESS - Initial load path');
        items.value = fullRecords;
        
        // Store original state for dirty tracking
        blockOriginalStates.value.clear();
        blockDirtyStates.value.clear();
        fullRecords.forEach(record => {
          // Only store original state for existing items (not new ones)
          if (record.id && record.item && typeof record.item === 'object' && !isNewItem(record)) {
            blockOriginalStates.value.set(
              record.id.toString(),
              deepClone(record.item)
            );
          }
        });
        
        // Store only IDs in initialValues
        if (initialValues.value && props.field) {
          const idsOnly = fullRecords.map(record => record.id);
          initialValues.value[props.field] = idsOnly;
        }
        
        isInitialLoad.value = false;
        logger.log('📥 PROCESS - Initial load complete, items.value set to:', items.value.length);
        return;
      }
      
      // Update items for post-save reloads
      logger.log('📥 PROCESS - Update path (not initial load)');
      items.value = fullRecords;
      logger.log('📥 PROCESS - items.value updated to:', {
        count: items.value.length,
        ids: items.value.map(i => i.id)
      });

      // Only update original states if they don't exist yet (new blocks)
      // or if this is a post-save reload (detected by checking if all current blocks are clean)
      const allBlocksClean = items.value.every(item => {
        const blockId = item.id?.toString();
        return blockId && !blockDirtyStates.value.get(blockId);
      });
      
      if (allBlocksClean || blockOriginalStates.value.size === 0) {
        logger.log('📥 PROCESS - Updating original states (all blocks clean or first load)');
        blockOriginalStates.value.clear();
        blockDirtyStates.value.clear();
        fullRecords.forEach(record => {
          if (record.id && record.item && typeof record.item === 'object') {
            // Skip new items - they should always be dirty
            if (isNewItem(record)) {
              logger.log('📥 PROCESS - Marking new item as dirty:', record.id);
              blockDirtyStates.value.set(record.id.toString(), true);
            } 
            // Skip pasted items - they should NOT have their original state updated
            else if (pastedIds && pastedIds.has(record.id)) {
              logger.log('📥 PROCESS - Skipping original state for pasted item:', record.id);
              blockDirtyStates.value.set(record.id.toString(), true);
            } else {
              blockOriginalStates.value.set(
                record.id.toString(),
                deepClone(record.item)
              );
            }
          }
        });
      } else {
        logger.log('📥 PROCESS - Keeping existing original states (blocks have changes)');
        // For pasted items, ensure they're marked as dirty
        if (pastedIds) {
          pastedIds.forEach(id => {
            blockDirtyStates.value.set(id.toString(), true);
          });
        }
      }

      // Check if we're processing pasted data
      // Only consider it pasted data if we explicitly have pastedIds
      const hasPastedData = pastedIds && pastedIds.size > 0;
      
      logger.log('📥 PROCESS - Paste check:', {
        hasPastedData,
        pastedIdsCount: pastedIds ? pastedIds.size : 0,
        isInternalUpdate: isInternalUpdate.value
      });

      // After save-reload all blocks should be clean
      // But for pasted data, we need to emit the full objects
      if (!isInternalUpdate.value) {
        // Always use prepareItemsForEmit which handles dirty tracking properly
        const emitValue = prepareItemsForEmit(items.value, getSortField());
        logger.log('📥 PROCESS - Emitting with prepareItemsForEmit:', {
          type: 'smart emit',
          count: emitValue.length,
          sample: emitValue[0]
        });
        emit('input', emitValue);
      } else {
        logger.log('📥 PROCESS - Skipping emit due to isInternalUpdate');
      }
    } catch (error) {
      logger.error('Error processing loaded records:', error);
    }
  }

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

  function toggleExpand(itemId: string) {
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

  function updateItem(index: number, newData: any) {
    if (props.disabled) return;
    
    const currentItem = items.value[index];
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

  function addNewItem(collection: string) {
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

  function showDeleteDialog(item: JunctionRecord, index: number) {
    itemToDelete.value = { item, index };
    deleteDialog.value = true;
  }

  async function confirmDeleteItem() {
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

  async function duplicateItem(item: JunctionRecord, index: number) {
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

  function discardChanges(item: JunctionRecord, index: number) {
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

  function onSort() {
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

  async function updateItemStatus(item: JunctionRecord, index: number, newStatus: string) {
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
    isBlockDirty
  };
}