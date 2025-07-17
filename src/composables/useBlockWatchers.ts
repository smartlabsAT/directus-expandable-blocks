import { watch, nextTick, type Ref } from 'vue';
import { logger } from '../utils/logger';
import { deepClone } from '../utils/helpers';
import type { JunctionRecord, UseExpandableBlocksProps, DirectusFormValues } from '../types';

/**
 * Composable for managing all reactive watchers in the expandable blocks extension
 * 
 * Responsibilities:
 * - Watch for external value changes
 * - Detect save events
 * - Handle global form resets
 * - Watch for primary key changes
 * - Detect paste events
 */
export function useBlockWatchers(
  // State from useBlockState
  items: Ref<JunctionRecord[]>,
  expandedItems: Ref<string[]>,
  loading: Ref<Record<string | number, boolean>>,
  blockOriginalStates: Ref<Map<string, any>>,
  blockDirtyStates: Ref<Map<string, boolean>>,
  originalItemOrder: Ref<(string | number)[]>,
  isInitialLoad: Ref<boolean>,
  isInternalUpdate: Ref<boolean>,
  isFullyInitialized: Ref<boolean>,
  
  // Functions
  updateOriginalItemOrder: (order: (string | number)[]) => void,
  clearStateTracking: () => void,
  deepEqual: (a: any, b: any) => boolean,
  
  // Data loading functions
  loadFullItemData: (isAfterSave?: boolean) => Promise<void>,
  processPasteData: (pastedData: any[]) => Promise<void>,
  
  // Props and external
  props: UseExpandableBlocksProps,
  emit: (event: string, value: any) => void,
  values: Ref<DirectusFormValues>,
  initialValues: Ref<DirectusFormValues>
) {
  
  /**
   * Watch for external value changes
   * Handles:
   * - Initial data load
   * - Save event detection
   * - Paste event detection
   * - Item additions/removals
   */
  function watchValueChanges() {
    return watch(() => props.value, async (newVal, oldVal) => {
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
            
            // Update original states with current data immediately after save
            items.value.forEach(item => {
              const itemId = String(item.id);
              if (item.item && itemId) {
                blockOriginalStates.value.set(itemId, deepClone(item.item));
                logger.debug(`Updated original state for block ${itemId} after save`);
              }
            });
            
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
            
            // Update original states with current data immediately after save
            items.value.forEach(item => {
              const itemId = String(item.id);
              if (item.item && itemId) {
                blockOriginalStates.value.set(itemId, deepClone(item.item));
                logger.debug(`Updated original state for block ${itemId} after save`);
              }
            });
            
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
  }

  /**
   * Watch for global form resets (when user clicks "Discard Changes")
   * This happens when Directus resets values to initialValues
   */
  function watchGlobalReset() {
    return watch(() => values.value?.[props.field], (newVal, oldVal) => {
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
  }

  /**
   * Watch for save events by monitoring initialValues changes
   * When Directus saves, it updates initialValues to match the saved state
   */
  function watchSaveEvents() {
    return watch(() => initialValues.value?.[props.field], async (newVal, oldVal) => {
      
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
  }

  /**
   * Watch for primaryKey changes - Extension loads before primaryKey is available
   */
  function watchPrimaryKey() {
    return watch(() => props.primaryKey, async (newKey, oldKey) => {
      logger.debug('Primary key changed:', { oldKey, newKey });

      if (newKey && newKey !== '+' && newKey !== 'new' && newKey !== oldKey) {
        logger.debug('Valid primary key received, loading data...');
        await loadFullItemData();
      }
    }, { immediate: false });
  }

  /**
   * Setup all watchers
   * Call this in the initialize function
   */
  function setupWatchers() {
    watchValueChanges();
    watchGlobalReset();
    watchSaveEvents();
    watchPrimaryKey();
    
    logger.debug('All watchers setup complete');
  }

  return {
    setupWatchers,
    // Individual watchers if needed
    watchValueChanges,
    watchGlobalReset,
    watchSaveEvents,
    watchPrimaryKey
  };
}