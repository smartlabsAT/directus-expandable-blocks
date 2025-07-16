import { ref, computed, watch, onMounted, nextTick, type Ref } from 'vue';
import { useApi, useStores } from '@directus/extensions-sdk';
import { M2AHelper, type M2AFieldInfo } from '../utils/m2a-helper';
import { logger } from '../utils/logger';
import { 
  buildM2AFieldsString, 
  extractItemTitle, 
  getActualItemId as getItemActualId,
  isNewItem as checkIsNewItem,
  parseAllowedCollections,
  deepClone
} from '../utils/helpers';
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

  // State
  const items = ref<JunctionRecord[]>([]);
  const expandedItems = ref<string[]>([]);
  const loading = ref<Record<string | number, boolean>>({});
  const relationInfo = ref<RelationInfo | null>(null);
  const m2aStructure = ref<M2AFieldInfo | null>(null);
  const allowedCollections = ref<CollectionInfo[]>([]);
  const deleteDialog = ref(false);
  const itemToDelete = ref<{ item: JunctionRecord; index: number } | null>(null);
  const isInitialLoad = ref(true);
  const isInternalUpdate = ref(false);
  const isFullyInitialized = ref(false);

  // Store merged options
  const mergedOptions = ref<ExpandableBlocksOptions>({});

  // Store original state for each block to track changes
  const blockOriginalStates = ref<Map<string, any>>(new Map());

  // Store the original order of items as they came from props.value
  const originalItemOrder = ref<(string | number)[]>([]);

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

  /**
   * Check if a specific block is dirty (has unsaved changes)
   * Compares current item data with the original state stored when block was loaded
   * @param blockId - The unique identifier of the block
   * @param currentItemData - The current state of the item data
   * @returns true if the block has unsaved changes, false otherwise
   */
  function isBlockDirty(blockId: string, currentItemData: any): boolean {
    const originalData = blockOriginalStates.value.get(blockId);
    if (!originalData) return true; // New blocks are always dirty
    
    // Check if content has changed
    const contentChanged = JSON.stringify(currentItemData) !== JSON.stringify(originalData);
    
    // Check if position has changed
    const currentIndex = items.value.findIndex(item => getItemId(item) === blockId);
    
    // Convert both to strings for comparison since blockId is always a string
    const originalIndex = originalItemOrder.value.findIndex(id => String(id) === blockId);
    
    const positionChanged = currentIndex !== -1 && originalIndex !== -1 && currentIndex !== originalIndex;
    
    return contentChanged || positionChanged;
  }

  /**
   * Prepare items for emit (mix of IDs for clean blocks and full objects for dirty blocks)
   * This is the core solution for the dirty state tracking issue:
   * - Clean blocks: emit only their ID (matches Directus's expected format)
   * - Dirty blocks: emit full object (allows Directus to save the changes)
   * @param itemsArray - Array of junction records to process
   * @returns Array with IDs for clean blocks and full objects for dirty blocks
   */
  function prepareItemsForEmit(itemsArray: JunctionRecord[]): any[] {
    logger.log('🔧 PREPARE EMIT - Starting preparation:', {
      collection: props.collection,
      field: props.field,
      primaryKey: props.primaryKey,
      inputItemsCount: itemsArray.length,
      originalOrderLength: originalItemOrder.value.length,
      originalOrder: originalItemOrder.value,
      inputItems: itemsArray.map(item => ({
        id: item.id,
        collection: item.collection,
        itemType: typeof item.item,
        hasItem: !!item.item
      }))
    });
    
    const result = itemsArray.map((item, index) => {
      const blockId = item.id?.toString();
      if (!blockId) {
        logger.warn('🔧 PREPARE EMIT - Item without ID:', item);
        return item; // Safety fallback
      }
      
      const isDirty = isBlockDirty(blockId, item.item);
      
      if (isDirty) {
        // Wenn dirty, müssen wir das sort Feld aktualisieren
        const itemToEmit = { ...item };
        
        // Wenn es ein sort_field gibt, aktualisiere es mit dem aktuellen Index
        if (relationInfo.value?.meta?.sort_field) {
          itemToEmit[relationInfo.value.meta.sort_field] = index;
        }
        
        logger.log(`🔧 PREPARE EMIT - Item ${index}:`, {
          blockId,
          isDirty: true,
          returnType: 'full_object_with_sort',
          sortField: relationInfo.value?.meta?.sort_field,
          sortValue: index,
          itemStructure: {
            id: item.id,
            collection: item.collection,
            itemType: typeof item.item,
            hasItem: !!item.item,
            foreignKey: item[relationInfo.value?.foreignKeyField || 'unknown'],
            allKeys: Object.keys(itemToEmit)
          }
        });
        
        return itemToEmit;
      } else {
        // Clean blocks: nur ID
        logger.log(`🔧 PREPARE EMIT - Item ${index}:`, {
          blockId,
          isDirty: false,
          returnType: 'id_only',
          returnValue: item.id
        });
        
        return item.id;
      }
    });
    
    const dirtyCount = result.filter(item => typeof item === 'object').length;
    
    logger.log('🔧 PREPARE EMIT - Analysis:', {
      totalItems: result.length,
      dirtyCount,
      cleanCount: result.length - dirtyCount,
      allClean: dirtyCount === 0,
      hasOriginalOrder: originalItemOrder.value.length > 0
    });
    
    // If all blocks are clean, return them in the original order
    if (dirtyCount === 0 && originalItemOrder.value.length > 0) {
      // Create a map of current items by ID
      const itemMap = new Map();
      itemsArray.forEach(item => {
        itemMap.set(item.id, item);
      });
      
      // Return IDs in the original order
      const orderedResult = originalItemOrder.value.filter(id => itemMap.has(id));
      
      logger.log('🔧 PREPARE EMIT - Using original order:', {
        originalOrder: originalItemOrder.value,
        availableIds: Array.from(itemMap.keys()),
        finalResult: orderedResult
      });
      
      return orderedResult;
    }
    
    logger.log('🔧 PREPARE EMIT - Final result:', {
      resultType: 'standard_processing',
      sortField: relationInfo.value?.meta?.sort_field,
      result: result.map((item, i) => ({
        index: i,
        type: typeof item,
        value: typeof item === 'object' ? {
          id: item.id,
          collection: item.collection,
          sortValue: item[relationInfo.value?.meta?.sort_field || 'sort']
        } : item
      }))
    });
    
    return result;
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
    
    // NEU: Nach einem Save kommt die neue Reihenfolge von Directus
    // WICHTIG: Wir aktualisieren originalItemOrder nur, wenn ALLE Blöcke als IDs kommen (= clean state nach Save)
    if (Array.isArray(newVal) && newVal.length > 0 && originalItemOrder.value.length > 0) {
      // Prüfe ob alle Einträge nur IDs sind (keine Objekte)
      const allAreIds = newVal.every(item => typeof item !== 'object' || item === null);
      
      if (allAreIds) {
        const newOrder = newVal.map(item => 
          typeof item === 'object' && item !== null ? (item as any).id : item
        );
        
        // Wenn alle Blöcke nur als IDs kommen UND die Reihenfolge anders ist,
        // dann war das ein erfolgreicher Save
        if (JSON.stringify(newOrder) !== JSON.stringify(originalItemOrder.value)) {
          logger.debug('Save detected - all blocks are clean IDs, updating originalItemOrder:', {
            previousOriginal: originalItemOrder.value,
            newOrder: newOrder
          });
          originalItemOrder.value = newOrder;
          
          // Wichtig: Lade die Daten neu, damit sie in der neuen Reihenfolge sind
          if (props.primaryKey && props.primaryKey !== '+' && props.primaryKey !== 'new') {
            await loadFullItemData();
          }
          return;
        }
      }
    }
    
    if (isInitialLoad.value || isInternalUpdate.value) {
      isInternalUpdate.value = false;
      return;
    }
    
    // Check if actual items changed (add/remove)
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
        
        processLoadedRecords(fullRecords);
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
      
      processLoadedRecords(response.data.data || []);
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
   * Process loaded records and update state
   * Handles both initial load and subsequent updates
   * On initial load:
   * - Stores original state for dirty tracking
   * - Sets initialValues to array of IDs only (Directus format)
   * - Avoids emitting to prevent dirty state
   * @param fullRecords - Array of junction records with full item data
   */
  function processLoadedRecords(fullRecords: JunctionRecord[]) {
    
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
        items.value = fullRecords;
        
        // Store original state for dirty tracking
        blockOriginalStates.value.clear();
        fullRecords.forEach(record => {
          if (record.id && record.item && typeof record.item === 'object') {
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
        return;
      }
      
      // Update items for post-save reloads
      items.value = fullRecords;

      // Update original states with fresh server data
      blockOriginalStates.value.clear();
      fullRecords.forEach(record => {
        if (record.id && record.item && typeof record.item === 'object') {
          blockOriginalStates.value.set(
            record.id.toString(),
            deepClone(record.item)
          );
        }
      });

      // After save-reload all blocks should be clean
      // Emit only IDs in the original order
      if (!isInternalUpdate.value) {
        let cleanIds;
        
        // Use original order if available
        if (originalItemOrder.value.length > 0) {
          const recordMap = new Map(fullRecords.map(r => [r.id, r]));
          cleanIds = originalItemOrder.value.filter(id => recordMap.has(id));
        } else {
          cleanIds = fullRecords.map(record => record.id);
        }
        
        emit('input', cleanIds);
      }
    } catch (error) {
      logger.error('Error processing loaded records:', error);
    }
  }

  // UI Helper functions
  function getItemId(item: JunctionRecord): string {
    return item.id?.toString() || `temp_${items.value.indexOf(item)}`;
  }

  function getActualItemId(item: JunctionRecord): string | number {
    return getItemActualId(item);
  }

  function isNewItem(item: JunctionRecord): boolean {
    return checkIsNewItem(item);
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
    
    // Update local state
    const updatedItems = [...items.value];
    updatedItems[index] = {
      ...currentItem,
      item: { ...(currentItem.item as ItemRecord), ...newData }
    };
    items.value = updatedItems;
    
    // Emit with dirty tracking
    const emitValue = prepareItemsForEmit(items.value);
    emit('input', emitValue);
  }

  async function addNewItem(collection: string) {
    if (props.disabled) return;
    
    if (!props.primaryKey || props.primaryKey === '+' || props.primaryKey === 'new') {
      notificationsStore.add({
        title: 'Save Required',
        text: 'Please save the item first before adding blocks.',
        type: 'warning'
      });
      return;
    }
    
    const loadingKey = `new_${Date.now()}`;
    try {
      loading.value[loadingKey] = true;
      
      // Create item in target collection
      const defaultData = m2aHelper.getDefaultDataForCollection(collection);
      const newItemResponse = await api.post(`/items/${collection}`, defaultData);
      const createdItem = newItemResponse.data.data;
      
      // Create junction record
      const junctionData: any = {
        collection: collection,
        item: createdItem.id
      };
      
      const foreignKey = m2aStructure.value?.foreignKeyField || 
                        relationInfo.value?.foreignKeyField || 
                        `${props.collection}_id`;
      
      if (foreignKey && props.primaryKey) {
        // Convert primaryKey to number if it's a string number
        const primaryKeyValue = typeof props.primaryKey === 'string' && !isNaN(Number(props.primaryKey)) 
          ? Number(props.primaryKey) 
          : props.primaryKey;
        junctionData[foreignKey] = primaryKeyValue;
        
        logger.debug('Foreign key assignment:', {
          foreignKey,
          originalPrimaryKey: props.primaryKey,
          originalType: typeof props.primaryKey,
          convertedValue: primaryKeyValue,
          convertedType: typeof primaryKeyValue
        });
      }
      
      if (relationInfo.value?.meta?.sort_field) {
        junctionData[relationInfo.value.meta.sort_field] = items.value.length;
      }
      
      const junctionCollection = m2aStructure.value?.junctionCollection ||
                                relationInfo.value?.junctionCollection || 
                                `${props.collection}_${props.field}`;
      
      const junctionResponse = await api.post(`/items/${junctionCollection}`, junctionData);
      const junctionRecord = junctionResponse.data.data;
      
      // Create complete item structure
      const primaryKeyValue = typeof props.primaryKey === 'string' && !isNaN(Number(props.primaryKey)) 
        ? Number(props.primaryKey) 
        : props.primaryKey;
        
      const newItem: JunctionRecord = {
        id: junctionRecord.id,
        collection: collection,
        item: createdItem,
        [foreignKey]: primaryKeyValue
      };
      
      if (relationInfo.value?.meta?.sort_field) {
        newItem[relationInfo.value.meta.sort_field] = junctionRecord[relationInfo.value.meta.sort_field];
      }
      
      // Add to items
      items.value = [...items.value, newItem];
      
      // Emit changes
      isInternalUpdate.value = true;
      const emitValue = prepareItemsForEmit(items.value);
      
      logger.log('🔄 SAVE STATE - addNewItem:', {
        function: 'addNewItem',
        collection: props.collection,
        field: props.field,
        primaryKey: props.primaryKey,
        newCollection: collection,
        createdItem: {
          id: createdItem.id,
          data: createdItem
        },
        junctionRecord: {
          id: junctionRecord.id,
          data: junctionRecord
        },
        junctionData: junctionData,
        newItemStructure: {
          id: newItem.id,
          collection: newItem.collection,
          itemType: typeof newItem.item,
          foreignKey: newItem[foreignKey],
          allKeys: Object.keys(newItem)
        },
        apiCalls: {
          itemCreation: `POST /items/${collection}`,
          junctionCreation: `POST /items/${junctionCollection}`,
          defaultData: defaultData
        },
        totalItemsCount: items.value.length,
        emitValue,
        emitValueType: typeof emitValue,
        emitValueLength: Array.isArray(emitValue) ? emitValue.length : 'not array',
        relationInfo: {
          junctionCollection,
          foreignKey,
          m2aStructure: m2aStructure.value,
          relationInfoValue: relationInfo.value
        }
      });
      
      emit('input', emitValue);
      
      notificationsStore.add({
        title: 'Block Added',
        text: 'New block created successfully',
        type: 'success'
      });
      
    } catch (error) {
      logger.error('Error creating new block:', error);
      notificationsStore.add({
        title: 'Error',
        text: 'Failed to create new block',
        type: 'error'
      });
    } finally {
      delete loading.value[loadingKey];
    }
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
      const emitValue = prepareItemsForEmit(updatedItems);
      
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
      const emitValue = prepareItemsForEmit(updatedItems);
      
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
    
    
    // Update local state with original data
    const updatedItems = [...items.value];
    updatedItems[index] = {
      ...item,
      item: deepClone(originalData)
    };
    items.value = updatedItems;
    
    // Emit the change
    const emitValue = prepareItemsForEmit(items.value);
    
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
      emitValueLength: Array.isArray(emitValue) ? emitValue.length : 'not array'
    });
    
    emit('input', emitValue);
    
    // Show notification
    notificationsStore.add({
      title: 'Changes Discarded',
      text: 'Block reverted to last saved state',
      type: 'success'
    });
  }

  function onSort() {
    if (props.disabled) return;
    
    // Update sort values
    if (relationInfo.value?.meta?.sort_field) {
      items.value = items.value.map((item, index) => ({
        ...item,
        [relationInfo.value!.meta!.sort_field!]: index
      }));
    }
    
    isInternalUpdate.value = true;
    const emitValue = prepareItemsForEmit(items.value);
    
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
      
      loading.value[getItemId(item)] = true;
      
      await api.patch(`/items/${collection}/${itemId}`, {
        status: newStatus
      });
      
      // Update local state
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
          status: newStatus
        };
      }
      items.value = updatedItems;
      
      const emitValue = prepareItemsForEmit(items.value);
      
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
      
      notificationsStore.add({
        title: 'Status Updated',
        text: `Status changed to ${getStatusLabel(newStatus)}`,
        type: 'success'
      });
      
    } catch (error) {
      logger.error('Error updating status:', error);
      notificationsStore.add({
        title: 'Error',
        text: 'Failed to update status',
        type: 'error'
      });
    } finally {
      delete loading.value[getItemId(item)];
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