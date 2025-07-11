<template>
  <div class="expandable-blocks">
    <draggable
      v-if="items.length > 0"
      v-model="items"
      :disabled="!sortable || disabled"
      item-key="id"
      handle=".drag-handle"
      :animation="200"
      @end="onSort"
    >
      <template #item="{ element: item, index }">
        <div 
          class="block-item" 
          :class="{ 
            expanded: expandedItems.includes(getItemId(item)),
            compact: mergedOptions?.compactMode,
            disabled: disabled
          }"
        >
          <!-- Block Header -->
          <div 
            class="block-header" 
            @click="!disabled && toggleExpand(getItemId(item))"
          >
            <!-- Drag Handle -->
            <v-icon 
              v-if="sortable && !disabled" 
              name="drag_indicator" 
              class="drag-handle" 
              @click.stop
            />
            
            <!-- Collection Icon with Dirty Indicator -->
            <div class="icon-wrapper">
              <v-icon 
                :name="getCollectionIcon(item) || 'box'" 
                class="collection-icon"
              />
              <div 
                v-if="isBlockDirty(getItemId(item), item.item)"
                class="dirty-indicator"
                v-tooltip="'Unsaved changes'"
              />
            </div>
            
            <!-- Main Info Section -->
            <div class="block-info">
              <div class="block-main">
                <span class="block-title">{{ getItemTitle(item) }}</span>
                <v-chip x-small outline class="collection-chip">
                  {{ getCollectionName(item) }}
                </v-chip>
                <span v-if="shouldShowItemId && !isNewItem(item)" class="item-id">
                  ID: {{ getActualItemId(item) }}
                </span>
              </div>
              
              <!-- Status Display -->
              <v-menu 
                v-if="hasStatusField(item) && !mergedOptions?.compactMode"
                placement="bottom" 
                show-arrow
              >
                <template #activator="{ toggle }">
                  <div 
                    class="status-display"
                    @click.stop="toggle"
                  >
                    <span class="status-dot" :class="`status-${getItemStatus(item)}`" />
                    <span class="status-text">{{ getStatusLabel(getItemStatus(item)) }}</span>
                  </div>
                </template>
                
                <v-list>
                  <v-list-item
                    v-for="status in availableStatuses"
                    :key="status.value"
                    :active="getItemStatus(item) === status.value"
                    clickable
                    @click="updateItemStatus(item, index, status.value)"
                  >
                    <v-list-item-icon>
                      <span class="status-dot" :class="`status-${status.value}`" />
                    </v-list-item-icon>
                    <v-list-item-content>{{ status.label }}</v-list-item-content>
                  </v-list-item>
                </v-list>
              </v-menu>
            </div>
            
            <!-- Right Section -->
            <div class="block-actions">
              <!-- AI Assistant Button -->

              
              <!-- DEBUG: Show AI status -->
<!--              <div v-if="!disabled" style="font-size: 10px; color: red;">-->
<!--                AI: {{ isAIEnabled ? '✅' : '❌' }}-->
<!--              </div>-->
              
              <!-- Expand/Collapse Icon or Placeholder -->
              <div class="expand-icon-container">
                <v-icon 
                  v-if="expandedItems.includes(getItemId(item))"
                  name="unfold_less"
                  class="expand-indicator"
                  @click.stop="toggleExpand(getItemId(item))"
                />
              </div>

              <v-button
                  v-if="!disabled && isAIEnabled"
                  v-tooltip="'AI Assistant'"
                  x-small
                  icon
                  secondary
                  class="ai-button"
                  @click.stop="openAIAssistant(item, index)"
              >
                <v-icon name="auto_awesome" />
              </v-button>
              <!-- More Options Menu -->
              <v-menu 
                v-if="!disabled && (mergedOptions?.isAllowedDuplicate !== false || mergedOptions?.isAllowedDelete !== false)"
                placement="bottom-end" 
                show-arrow
              >
                <template #activator="{ toggle }">
                  <v-button
                    v-tooltip="'More options'"
                    x-small
                    icon
                    secondary
                    @click.stop="toggle"
                  >
                    <v-icon name="more_vert" />
                  </v-button>
                </template>
                
                <v-list>
                  <v-list-item 
                    v-if="mergedOptions?.isAllowedDuplicate !== false"
                    clickable 
                    @click="duplicateItem(item, index)"
                  >
                    <v-list-item-icon>
                      <v-icon name="content_copy" />
                    </v-list-item-icon>
                    <v-list-item-content>Duplicate</v-list-item-content>
                  </v-list-item>
                  
                  <v-list-item 
                    v-if="isBlockDirty(getItemId(item), item.item)"
                    clickable 
                    @click="discardChanges(item, index)"
                  >
                    <v-list-item-icon>
                      <v-icon name="undo" />
                    </v-list-item-icon>
                    <v-list-item-content>Discard Changes</v-list-item-content>
                  </v-list-item>
                  
                  <v-divider v-if="(mergedOptions?.isAllowedDuplicate !== false || isBlockDirty(getItemId(item), item.item)) && mergedOptions?.isAllowedDelete !== false" />
                  
                  <v-list-item 
                    v-if="mergedOptions?.isAllowedDelete !== false"
                    clickable 
                    class="danger" 
                    @click="showDeleteDialog(item, index)"
                  >
                    <v-list-item-icon>
                      <v-icon name="delete" />
                    </v-list-item-icon>
                    <v-list-item-content>Delete</v-list-item-content>
                  </v-list-item>
                </v-list>
              </v-menu>
            </div>
          </div>
          
          <!-- Inline Form (Expanded Content) -->
          <transition name="expand">
            <div v-if="expandedItems.includes(getItemId(item))" class="block-content">
              <div v-if="loading[getItemId(item)]" class="loading-state">
                <v-progress-circular indeterminate />
              </div>
              
              <v-form
                v-else
                :initial-values="item.item || item"
                :fields="getFieldsForItem(item)"
                :model-value="item.item || item"
                :primary-key="(item.item || item).id"
                :disabled="disabled"
                :badge="null"
                :autofocus="false"
                :show-validation-errors="false"
                @update:model-value="updateItem(index, $event)"
              />
              
              <!-- Show nested M2A blocks if present -->
              <template v-if="hasNestedM2A(item)">
                <div v-for="(fieldValue, fieldName) in getM2AFields(item)" :key="fieldName">
                  <nested-blocks
                    v-if="fieldValue && fieldValue.length > 0"
                    :blocks="fieldValue"
                    :title="formatFieldName(fieldName)"
                  />
                </div>
              </template>
            </div>
          </transition>
        </div>
      </template>
    </draggable>
    
    <!-- Empty State -->
    <div v-else-if="!disabled" class="empty-state">
      <p>No blocks yet</p>
    </div>
    
    <!-- Add New Block Button -->
    <v-button 
      v-if="!disabled && allowedCollections.length === 1 && canAddMoreBlocks"
      class="add-block-button"
      :disabled="disabled"
      @click="addNewItem(allowedCollections[0].collection)"
    >
      <v-icon name="add" />
      Add Block
    </v-button>
    
    <v-menu 
      v-else-if="!disabled && allowedCollections.length > 1 && canAddMoreBlocks"
      placement="bottom-start" 
      show-arrow
    >
      <template #activator="{ toggle }">
        <v-button 
          class="add-block-button"
          :disabled="disabled"
          @click="toggle"
        >
          <v-icon name="add" />
          Add Block
        </v-button>
      </template>
      
      <v-list>
        <v-list-item
          v-for="collection in allowedCollections"
          :key="collection.collection"
          clickable
          @click="addNewItem(collection.collection)"
        >
          <v-list-item-icon>
            <v-icon :name="collection.meta?.icon || 'box'" />
          </v-list-item-icon>
          <v-list-item-content>
            {{ collection.name }}
          </v-list-item-content>
        </v-list-item>
      </v-list>
    </v-menu>
    
    <!-- Max blocks reached message -->
    <div 
      v-if="!disabled && allowedCollections.length > 0 && !canAddMoreBlocks" 
      class="max-blocks-message"
    >
      <v-notice type="info">
        Maximum number of blocks ({{ mergedOptions.maxBlocks }}) reached
      </v-notice>
    </div>
    
    <!-- Delete Confirmation Dialog -->
    <v-dialog 
      v-model="deleteDialog" 
      @esc="deleteDialog = false"
    >
      <v-card>
        <v-card-title>Delete Block</v-card-title>
        <v-card-text>
          Are you sure you want to delete this block? This action cannot be undone.
        </v-card-text>
        <v-card-actions>
          <v-button secondary @click="deleteDialog = false">
            Cancel
          </v-button>
          <v-button kind="danger" @click="confirmDeleteItem">
            Delete
          </v-button>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- AI Assistant Drawer -->
    <AIAssistantDrawer
      v-model="aiAssistantOpen"
      :item="aiCurrentItem"
      :all-items="items.map((item, index) => ({ item, index }))"
      :page-context="pageContext"
      @update-content="onAIContentUpdate"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, inject, nextTick, type Ref } from 'vue';
import { useApi, useStores } from '@directus/extensions-sdk';
import draggable from 'vuedraggable';
import { M2AHelper, type M2AFieldInfo } from './utils/m2a-helper';
import NestedBlocks from './components/NestedBlocks.vue';
import AIAssistantDrawer from './components/AIAssistantDrawer.vue';
import { logger } from './utils/logger';
import { aiService } from './services/ai-service';
import { 
  buildM2AFieldsString, 
  extractItemTitle, 
  getActualItemId as getItemActualId,
  isNewItem as checkIsNewItem,
  parseAllowedCollections,
  deepClone
} from './utils/helpers';
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
} from './types';

interface Props {
  value: JunctionRecord[] | null;
  collection: string;
  field: string;
  primaryKey?: string | number;
  disabled?: boolean;
  options?: ExpandableBlocksOptions;
}

const props = withDefaults(defineProps<Props>(), {
  value: () => [],
  disabled: false,
  options: () => ({})
});

const emit = defineEmits<{
  input: [value: any[]];
}>();

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

// Inject Directus form states
const values = inject<Ref<DirectusFormValues>>('values', ref({}));
const initialValues = inject<Ref<DirectusFormValues>>('initialValues', ref({}));


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

// AI Assistant state
const aiAssistantOpen = ref(false);
const aiCurrentItem = ref<{ item: JunctionRecord; index: number } | null>(null);

// Page context for AI
const pageContext = computed(() => {
  const currentValues = values.value || {};
  
  return {
    title: currentValues.title || currentValues.name || currentValues.headline || 'Untitled Page',
    type: currentValues.type || currentValues.template || 'page',
    description: currentValues.description || currentValues.summary || currentValues.excerpt || '',
    url: currentValues.slug || currentValues.path || ''
  };
});

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

const isAIEnabled = computed(() => {
  // Debug log to see what's happening
  console.log('🤖 AI Debug:', {
    mergedOptions: mergedOptions.value,
    enableAI: mergedOptions.value?.enableAI,
    aiApiKey: mergedOptions.value?.aiApiKey ? '***SET***' : 'NOT SET',
    aiProvider: mergedOptions.value?.aiProvider,
    propsOptions: props.options
  });
  
  // Check if AI is enabled in interface options and has required settings
  // Use default provider if not set
  const hasProvider = mergedOptions.value?.aiProvider || 'openai';
  
  return !!(
    mergedOptions.value?.enableAI && 
    mergedOptions.value?.aiApiKey && 
    hasProvider
  );
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
  
  return JSON.stringify(currentItemData) !== JSON.stringify(originalData);
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
  const result = itemsArray.map(item => {
    const blockId = item.id?.toString();
    if (!blockId) return item; // Safety fallback
    
    const isDirty = isBlockDirty(blockId, item.item);
    
    // Return full object if dirty, otherwise just ID
    return isDirty ? item : item.id;
  });
  
  const dirtyCount = result.filter(item => typeof item === 'object').length;
  
  // If all blocks are clean, return them in the original order
  if (dirtyCount === 0 && originalItemOrder.value.length > 0) {
    // Create a map of current items by ID
    const itemMap = new Map();
    itemsArray.forEach(item => {
      itemMap.set(item.id, item);
    });
    
    // Return IDs in the original order
    const orderedResult = originalItemOrder.value.filter(id => itemMap.has(id));
    
    return orderedResult;
  }
  
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
onMounted(async () => {
  logger.debug('Component mounted', {
    field: props.field,
    primaryKey: props.primaryKey
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
  
  // Check for delayed options (Directus sometimes loads them late)
  if (allowedCollections.value.length === 0) {
    setTimeout(() => checkDelayedOptions(), 1000);
  }
});

/**
 * Load allowed collections from various sources
 */
async function loadAllowedCollections() {
  // Use merged options which already contains field store options
  const fieldOptions = mergedOptions.value || {};
  
  // First check interface options
  if (fieldOptions?.allowedCollections && fieldOptions.allowedCollections.length > 0) {
    logger.debug('Found allowed collections in interface options');
    setAllowedCollections(fieldOptions.allowedCollections);
    return;
  }
  
  // Try to get from M2A relation metadata
  const relations = relationsStore.getRelationsForField(props.collection, props.field);
  if (relations && relations.length > 0) {
    const m2aRelation = relations[0];
    relationInfo.value = m2aRelation;
    
    const oneAllowedCollections = parseAllowedCollections(
      m2aRelation.meta?.one_allowed_collections ||
      m2aRelation.one_allowed_collections || undefined
    );
    
    if (oneAllowedCollections.length > 0) {
      logger.debug('Found allowed collections in M2A relation');
      setAllowedCollections(oneAllowedCollections);
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
watch(() => props.value, (newVal, oldVal) => {
  
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
 * Watch for global "Discard All Changes" events
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
  
  // For comparison, we need to check if it matches either initialValues OR originalItemOrder
  // because Directus might reset to the original order, not the processLoadedRecords order
  const isResetToInitial = JSON.stringify(newVal) === JSON.stringify(initialVal);
  const isResetToOriginal = originalItemOrder.value.length > 0 && 
    JSON.stringify(newVal) === JSON.stringify(originalItemOrder.value);
  
  const isReset = isResetToInitial || isResetToOriginal;
  
  
  if (isReset) {
    logger.debug('Global discard detected - resetting blocks');
    
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
    
    // Keep expanded items open for better UX
    // expandedItems.value = [];
    
    // Emit clean state (only IDs)
    const cleanIds = items.value.map(item => item.id);
    
    // Use original order if available
    if (originalItemOrder.value.length > 0) {
      const itemMap = new Map(items.value.map(item => [item.id, item]));
      const orderedIds = originalItemOrder.value.filter(id => itemMap.has(id));
      emit('input', orderedIds);
    } else {
      emit('input', cleanIds);
    }
  }
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
        sort: relationInfo.value?.sort_field || 'id'
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
      junctionData[foreignKey] = props.primaryKey;
    }
    
    if (relationInfo.value?.sort_field) {
      junctionData[relationInfo.value.sort_field] = items.value.length;
    }
    
    const junctionCollection = m2aStructure.value?.junctionCollection ||
                              relationInfo.value?.junctionCollection || 
                              `${props.collection}_${props.field}`;
    
    const junctionResponse = await api.post(`/items/${junctionCollection}`, junctionData);
    const junctionRecord = junctionResponse.data.data;
    
    // Create complete item structure
    const newItem: JunctionRecord = {
      id: junctionRecord.id,
      collection: collection,
      item: createdItem,
      [foreignKey]: props.primaryKey
    };
    
    if (relationInfo.value?.sort_field) {
      newItem[relationInfo.value.sort_field] = junctionRecord[relationInfo.value.sort_field];
    }
    
    // Add to items
    items.value = [...items.value, newItem];
    
    // Emit changes
    isInternalUpdate.value = true;
    emit('input', prepareItemsForEmit(items.value));
    
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
    if (relationInfo.value?.sort_field) {
      updatedItems.forEach((item, idx) => {
        if (item[relationInfo.value!.sort_field!] !== idx) {
          item[relationInfo.value!.sort_field!] = idx;
        }
      });
    }
    
    items.value = updatedItems;
    
    // Emit changes
    isInternalUpdate.value = true;
    emit('input', prepareItemsForEmit(updatedItems));
    
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
      junctionData[relationInfo.value.foreignKeyField] = props.primaryKey;
    }
    
    if (relationInfo.value?.sort_field) {
      junctionData[relationInfo.value.sort_field] = index + 1;
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
      newItem[relationInfo.value.foreignKeyField] = props.primaryKey;
    }
    
    // Insert at position
    const updatedItems = [...items.value];
    updatedItems.splice(index + 1, 0, newItem);
    items.value = updatedItems;
    
    // Auto-expand
    expandedItems.value.push(String(junctionRecord.id));
    
    // Emit changes
    isInternalUpdate.value = true;
    emit('input', prepareItemsForEmit(updatedItems));
    
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
  if (relationInfo.value?.sort_field) {
    items.value = items.value.map((item, index) => ({
      ...item,
      [relationInfo.value!.sort_field!]: index
    }));
  }
  
  isInternalUpdate.value = true;
  emit('input', prepareItemsForEmit(items.value));
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
    
    emit('input', prepareItemsForEmit(items.value));
    
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

// AI Assistant functions
function openAIAssistant(item: JunctionRecord, index: number): void {
  // Configure AI service with interface options
  if (mergedOptions.value?.enableAI) {
    const aiConfig = {
      provider: (mergedOptions.value.aiProvider || 'openai') as 'openai' | 'claude' | 'custom',
      apiKey: mergedOptions.value.aiApiKey || '',
      model: mergedOptions.value.aiModel || 'gpt-3.5-turbo',
      temperature: mergedOptions.value.aiTemperature || 0.7,
      maxTokens: mergedOptions.value.aiMaxTokens || 1000,
      baseUrl: mergedOptions.value.aiCustomUrl,
      enabled: true
    };
    
    console.log('🤖 Configuring AI with:', { ...aiConfig, apiKey: '***' });
    aiService.saveConfig(aiConfig);
  }
  
  aiCurrentItem.value = { item, index };
  aiAssistantOpen.value = true;
}

function onAIContentUpdate(updatedContent: any): void {
  if (!aiCurrentItem.value) return;

  const { item, index } = aiCurrentItem.value;
  const updatedItems = [...items.value];
  
  // Update the item's content
  if (updatedItems[index]) {
    updatedItems[index] = {
      ...updatedItems[index],
      item: {
        ...updatedItems[index].item,
        ...updatedContent
      }
    };
    
    items.value = updatedItems;
    emit('input', prepareItemsForEmit(items.value));
    
    // Close the AI assistant
    aiAssistantOpen.value = false;
    aiCurrentItem.value = null;
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

</script>

<style scoped>
@import './interface.css';
</style>