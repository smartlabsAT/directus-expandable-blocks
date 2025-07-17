import { computed } from 'vue';
import { logger } from '../utils/logger';
import type { JunctionRecord, ItemRecord, M2AStructure } from '../types';
import type { ExpandableBlocksContext } from '../types/composable-context';

/**
 * Composable for managing data loading and M2A handling in the expandable blocks extension
 * 
 * Responsibilities:
 * - Data loading from API
 * - M2A structure analysis
 * - Collection and relation management
 * - Processing loaded and pasted data
 */
export function useM2AData(
  ctx: ExpandableBlocksContext,
  updateOriginalItemOrder: (order: (string | number)[]) => void,
  clearStateTracking: () => void
) {
  // Destructure what we need from context
  const { items, expandedItems, loading, blockOriginalStates, blockDirtyStates, originalItemOrder, isInternalUpdate, isInitialLoad, isFullyInitialized } = ctx.state;
  const { getItemId, isNewItem, updateOriginalState, markBlockDirty } = ctx.stateFns;
  const { api, props, stores: { relationsStore, fieldsStore }, helpers: { m2aHelper, deepEqual } } = ctx.deps;
  const { mergedOptions } = ctx.ui;
  const { relationInfo, allowedCollections, m2aStructure } = ctx.data;

  // Computed property for allowed collections map
  const allowedCollectionsMap = computed(() => {
    const map: Record<string, any> = {};
    allowedCollections.value.forEach(col => {
      if (typeof col === 'string') {
        map[col] = { collection: col };
      } else if (col && col.collection) {
        map[col.collection] = col;
      }
    });
    return map;
  });

  /**
   * Load allowed collections from various sources
   */
  async function loadAllowedCollections() {
    // Use merged options which already contains field store options
    const fieldOptions = mergedOptions.value || {};
    
    // First, always try to get the M2A configured collections
    const relations = relationsStore.getRelationsForField(props.collection, props.field);
    const junctionRelations = relations?.find(r => r.meta?.junction_field === props.field);
    const m2aRelatedCollection = junctionRelations?.related_collection;
    
    logger.debug('Looking for allowed collections:', {
      fieldOptions,
      hasIncludeCollections: !!fieldOptions.includeCollections,
      includeCollections: fieldOptions.includeCollections,
      hasAllowedCollections: !!fieldOptions.allowedCollections,
      allowedCollections: fieldOptions.allowedCollections,
      m2aRelatedCollection,
      junctionField: junctionRelations?.meta?.junction_field,
      currentField: props.field
    });
    
    // Determine allowed collections
    let collections: string[] = [];
    
    // Priority 1: includeCollections from field options (already includes field store settings)
    if (fieldOptions.includeCollections && Array.isArray(fieldOptions.includeCollections) && fieldOptions.includeCollections.length > 0) {
      collections = fieldOptions.includeCollections;
      logger.debug('Using includeCollections from options:', collections);
    }
    // Priority 2: allowedCollections from field options (legacy support)
    else if (fieldOptions.allowedCollections && Array.isArray(fieldOptions.allowedCollections) && fieldOptions.allowedCollections.length > 0) {
      collections = fieldOptions.allowedCollections;
      logger.debug('Using allowedCollections from options:', collections);
    }
    // Priority 3: Extract from relation config if it's an M2A relationship
    else if (m2aRelatedCollection) {
      // Look for the relation's collection whitelist
      const field = fieldsStore.getField(props.collection, props.field);
      const meta = field?.meta;
      
      logger.debug('M2A Field meta:', {
        field: props.field,
        meta,
        specialOptions: meta?.special,
        optionsString: meta?.options
      });
      
      // For M2A relations, get the collections from the one_allowed_collections field
      const relatedRelations = relationsStore.getRelations();
      const m2aConfig = relatedRelations.find(r => 
        r.collection === junctionRelations?.collection && 
        r.field === 'collection' &&
        r.schema?.table === junctionRelations?.collection
      );
      
      if (m2aConfig?.meta?.one_allowed_collections) {
        collections = m2aConfig.meta.one_allowed_collections;
        logger.debug('Found collections from M2A config:', collections);
      } else {
        // Fallback: try to parse from the interface options
        if (meta?.options && typeof meta.options === 'object') {
          const interfaceOptions = meta.options as any;
          if (interfaceOptions.allowedCollections) {
            collections = interfaceOptions.allowedCollections;
            logger.debug('Found collections from interface options:', collections);
          }
        }
      }
    }
    
    // Priority 4: If still no collections, check the field's special array
    if (collections.length === 0) {
      const field = fieldsStore.getField(props.collection, props.field);
      if (field?.meta?.special && Array.isArray(field.meta.special)) {
        // Look for m2a special type with collections
        const m2aSpecial = field.meta.special.find((s: string) => s.startsWith('m2a'));
        if (m2aSpecial) {
          logger.debug('Found m2a special type:', m2aSpecial);
        }
      }
    }
    
    // Map collections to proper format
    if (collections.length > 0) {
      try {
        const mappedCollections = await Promise.all(
          collections.map(async (col: string) => {
            try {
              const response = await api.get(`/collections/${col}`);
              const collectionData = response.data.data;
              return {
                collection: col,
                name: collectionData.meta?.display_name || collectionData.name || col,
                icon: collectionData.meta?.icon || 'box',
                singleton: collectionData.meta?.singleton || false
              };
            } catch (error) {
              logger.warn(`Failed to load collection details for ${col}:`, error);
              return {
                collection: col,
                name: col,
                icon: 'box',
                singleton: false
              };
            }
          })
        );
        allowedCollections.value = mappedCollections;
        logger.debug('Loaded allowed collections:', mappedCollections);
      } catch (error) {
        logger.error('Error loading collection details:', error);
        allowedCollections.value = collections.map(col => ({
          collection: col,
          name: col,
          icon: 'box',
          singleton: false
        }));
      }
    } else {
      logger.warn('No allowed collections found for field:', props.field);
      allowedCollections.value = [];
    }
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
    
    // Load additional junction metadata if needed
    if (relationInfo.value?.junctionCollection) {
      try {
        const junctionFields = await api.get(`/fields/${relationInfo.value.junctionCollection}`);
        logger.debug('Junction fields loaded:', junctionFields.data.data);
      } catch (error) {
        logger.warn('Failed to load junction fields:', error);
      }
    }
  }

  /**
   * Analyze M2A structure using helper
   */
  async function analyzeM2AStructure() {
    try {
      m2aStructure.value = await m2aHelper.analyzeM2AStructure(
        props.collection,
        props.field
      );
      logger.debug('M2A structure analyzed:', m2aStructure.value);
    } catch (error) {
      logger.warn('Failed to analyze M2A structure:', error);
      m2aStructure.value = null;
    }
  }

  /**
   * Load full item data from the API
   * @param isAfterSave - True if this is being called after a save operation
   */
  async function loadFullItemData(isAfterSave: boolean = false) {
    try {
      if (!props.primaryKey || props.primaryKey === '+' || props.primaryKey === 'new') {
        items.value = [];
        return;
      }

      // Only set isInitialLoad to true if it's actually the first load
      if (items.value.length === 0 && !isFullyInitialized.value) {
        isInitialLoad.value = true;
        clearStateTracking();
      }
      
      const fields = ['*'];
      
      // Ensure we always include the item field
      // For M2A relationships, the field is always 'item'
      fields.push('item.*');
      
      const query = {
        fields: fields,
        limit: -1,
        sort: relationInfo.value?.meta?.sort_field || undefined,
        filter: {
          [relationInfo.value?.foreignKeyField || `${props.collection}_id`]: {
            _eq: props.primaryKey
          }
        }
      };
      
      const junctionCollection = relationInfo.value?.junctionCollection || `${props.collection}_${props.field}`;
      const response = await api.get(`/items/${junctionCollection}`, { params: query });
      
      if (response.data.data) {
        const records = Array.isArray(response.data.data) ? response.data.data : [response.data.data];
        
        logger.log('📥 LOAD FULL ITEM DATA:', {
          recordsCount: records.length,
          junctionCollection,
          query,
          sampleRecord: records[0]
        });
        
        // Transform records to ensure consistent structure
        const transformedRecords = records.map((record: any) => {
          // Get the actual item data
          let itemData = record.item;
          
          // If item is just an ID, we need to load it
          if (typeof itemData === 'number' || typeof itemData === 'string') {
            logger.warn('Item is just an ID, full data may not be loaded:', itemData);
            itemData = { id: itemData };
          }
          
          return {
            ...record,
            id: record.id,
            collection: record.collection,
            item: itemData
          };
        });
        
        processLoadedRecords(transformedRecords, undefined, isAfterSave);
      }
      
      isFullyInitialized.value = true;
      
    } catch (error) {
      logger.error('Error loading data:', error);
      isFullyInitialized.value = true;
    } finally {
      isInitialLoad.value = false;
    }
  }

  /**
   * Process pasted data and merge with existing items
   * @param pastedData - The pasted array containing mixed data types
   */
  async function processPasteData(pastedData: any[]) {
    logger.log('📋 PROCESS PASTE DATA - Start:', {
      totalItems: pastedData.length,
      currentItemsCount: items.value.length
    });
    
    // Track pasted IDs for visual feedback
    const pastedIds = new Set<string | number>();
    
    // Save current dirty states before reloading
    const currentDirtyStates = new Map(blockDirtyStates.value);
    
    // First, ensure we have the latest data
    await loadFullItemData();
    
    // Process each pasted item
    const newItems: JunctionRecord[] = [];
    
    for (const pastedItem of pastedData) {
      logger.debug('Processing pasted item:', {
        type: typeof pastedItem,
        isObject: typeof pastedItem === 'object',
        hasId: pastedItem?.id !== undefined,
        hasItem: pastedItem?.item !== undefined,
        structure: pastedItem
      });
      
      // Handle different paste formats
      if (typeof pastedItem === 'object' && pastedItem !== null) {
        if (pastedItem.id && pastedItem.collection) {
          // Full junction record format
          pastedIds.add(pastedItem.id);
          
          // Load full item data if only ID is provided
          if (typeof pastedItem.item === 'number' || typeof pastedItem.item === 'string') {
            try {
              const itemResponse = await api.get(`/items/${pastedItem.collection}/${pastedItem.item}`);
              pastedItem.item = itemResponse.data.data;
            } catch (error) {
              logger.warn(`Failed to load item data for ${pastedItem.collection}/${pastedItem.item}:`, error);
            }
          }
          
          newItems.push(pastedItem);
        } else if (pastedItem.collection && pastedItem.item) {
          // Item without junction ID - create new junction
          const junctionData: any = {
            collection: pastedItem.collection,
            item: typeof pastedItem.item === 'object' ? pastedItem.item.id : pastedItem.item
          };
          
          // IMPORTANT: Copy over any existing fields from pastedItem (like extra_id)
          Object.keys(pastedItem).forEach(key => {
            if (key !== 'collection' && key !== 'item' && key !== 'id') {
              junctionData[key] = pastedItem[key];
            }
          });
          
          // Add foreign key if not already present
          if (relationInfo.value?.foreignKeyField && props.primaryKey && !junctionData[relationInfo.value.foreignKeyField]) {
            const primaryKeyValue = typeof props.primaryKey === 'string' && !isNaN(Number(props.primaryKey)) 
              ? Number(props.primaryKey) 
              : props.primaryKey;
            junctionData[relationInfo.value.foreignKeyField] = primaryKeyValue;
          }
          
          // Add sort value
          if (relationInfo.value?.meta?.sort_field) {
            junctionData[relationInfo.value.meta.sort_field] = items.value.length + newItems.length;
          }
          
          try {
            const junctionCollection = relationInfo.value?.junctionCollection || `${props.collection}_${props.field}`;
            const response = await api.post(`/items/${junctionCollection}`, junctionData);
            const createdJunction = response.data.data;
            
            createdJunction.item = pastedItem.item;
            pastedIds.add(createdJunction.id);
            newItems.push(createdJunction);
            
            logger.debug('Created junction for pasted item:', createdJunction);
          } catch (error) {
            logger.error('Failed to create junction for pasted item:', error);
          }
        }
      } else if (typeof pastedItem === 'number' || typeof pastedItem === 'string') {
        // Just an ID - might be a junction ID
        pastedIds.add(pastedItem);
        
        // Try to find this ID in our current items
        const existingItem = items.value.find(item => item.id === pastedItem);
        if (existingItem) {
          logger.debug('Found existing item for pasted ID:', existingItem);
        } else {
          logger.warn('Pasted ID not found in current items:', pastedItem);
        }
      }
    }
    
    // Restore dirty states from before the reload
    currentDirtyStates.forEach((isDirty, blockId) => {
      if (isDirty) {
        markBlockDirty(blockId, true);
      }
    });
    
    // If we have new items, reload to get the updated list
    if (newItems.length > 0) {
      logger.log('📋 Created new junction records, reloading data...');
      
      // Save dirty states again before second reload
      const dirtyStatesBeforeReload = new Map(blockDirtyStates.value);
      
      await loadFullItemData();
      
      // Restore dirty states after reload
      dirtyStatesBeforeReload.forEach((isDirty, blockId) => {
        if (isDirty) {
          markBlockDirty(blockId, true);
        }
      });
    }
    
    // Mark all pasted items as dirty
    pastedIds.forEach(id => {
      const item = items.value.find(i => i.id === id);
      if (item) {
        const itemId = getItemId(item);
        if (itemId) {
          markBlockDirty(itemId, true);
          logger.debug(`📋 Marked pasted item ${itemId} as dirty`);
        }
      }
    });
    
    logger.log('📋 PROCESS PASTE DATA - Complete:', {
      pastedCount: pastedIds.size,
      totalItems: items.value.length
    });
  }

  /**
   * Process loaded records and update state
   * @param fullRecords - Array of junction records with full item data
   * @param pastedIds - Optional set of IDs that were pasted
   * @param isAfterSave - True if this is being called after a save operation
   */
  function processLoadedRecords(fullRecords: JunctionRecord[], pastedIds?: Set<string | number>, isAfterSave: boolean = false) {
    logger.log('📥 PROCESS LOADED RECORDS - Start:', {
      recordsCount: fullRecords.length,
      isInitialLoad: isInitialLoad.value,
      isInternalUpdate: isInternalUpdate.value,
      currentItemsCount: items.value.length,
      hasPastedIds: !!pastedIds,
      pastedIdsCount: pastedIds?.size || 0
    });
    
    // Special handling for paste events
    if (pastedIds && pastedIds.size > 0) {
      logger.log('📋 PASTE EVENT - Updating dirty states for pasted items');
      
      fullRecords.forEach(record => {
        const itemId = getItemId(record);
        if (itemId && pastedIds.has(record.id)) {
          // Mark pasted items as dirty
          markBlockDirty(itemId, true);
          
          // Store current state as original (to enable revert)
          const itemData = record.item || record;
          if (itemData && typeof itemData === 'object') {
            updateOriginalState(itemId, { ...itemData });
          }
          
          logger.debug(`📋 Marked pasted item ${itemId} as dirty`);
        }
      });
    }
    
    // Update items array
    items.value = fullRecords;
    
    // Initialize block states for all items
    fullRecords.forEach(record => {
      const itemId = getItemId(record);
      if (!itemId) return;
      
      // Special handling for initial load - preserve existing original states
      if (isInitialLoad.value) {
        const itemData = record.item || record;
        if (itemData && typeof itemData === 'object' && !blockOriginalStates.value.has(itemId)) {
          updateOriginalState(itemId, { ...itemData });
          // On initial load, items are clean unless marked otherwise
          if (!pastedIds?.has(record.id)) {
            markBlockDirty(itemId, false);
          }
        }
      } else if (!isInternalUpdate.value) {
        // For non-initial loads
        const itemData = record.item || record;
        if (itemData && typeof itemData === 'object') {
          // After a save, always update original state to the new saved state
          if (isAfterSave || !blockOriginalStates.value.has(itemId)) {
            updateOriginalState(itemId, { ...itemData });
          }
          // After a save, mark all blocks as clean
          if (isAfterSave) {
            markBlockDirty(itemId, false);
          } else if (!blockDirtyStates.value.has(itemId)) {
            // Otherwise, only set dirty state if it doesn't exist
            markBlockDirty(itemId, false);
          }
        }
      }
    });
    
    // Update original item order
    // Skip updating order after save, as it's already updated in watchSaveEvents
    if (!isAfterSave) {
      const currentOrder = fullRecords
        .map(record => record.id)
        .filter((id): id is string | number => id !== undefined);
      updateOriginalItemOrder(currentOrder);
    }
    
    logger.log('📥 PROCESS LOADED RECORDS - Complete:', {
      itemsCount: items.value.length,
      dirtyStatesCount: blockDirtyStates.value.size,
      originalStatesCount: blockOriginalStates.value.size,
      originalOrder: originalItemOrder.value
    });
  }

  /**
   * Initialize M2A data loading
   */
  async function initialize() {
    try {
      // Analyze M2A structure
      await analyzeM2AStructure();
      
      // Load allowed collections
      await loadAllowedCollections();
      
      // Load relation info
      await loadRelationInfo();
      
      // Load initial data
      await loadFullItemData();
    } catch (error) {
      logger.error('Error initializing M2A data:', error);
      isFullyInitialized.value = true;
    }
  }

  return {
    // Data
    allowedCollectionsMap,
    
    // Data Loading
    loadFullItemData,
    processLoadedRecords,
    processPasteData,
    
    // M2A Structure
    analyzeM2AStructure,
    loadAllowedCollections,
    loadRelationInfo,
    
    // Initialize
    initialize
  };
}