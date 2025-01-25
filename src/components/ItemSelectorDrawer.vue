<template>
  <v-drawer
      :model-value="open"
      class="item-selector-drawer"
      @update:model-value="$emit('close')"
      @cancel="handleClose"
      :icon="collectionIcon"
      :title="'Select Item(s)'"
      :small-header="false"
      :header-shadow="false"
  >
    <template #subtitle>
      <v-breadcrumb :items="[{ name: collectionName, disabled: true }]"/>
    </template>

    <template #title-outer:prepend>
      <v-button class="header-icon" rounded icon secondary disabled>
        <v-icon :name="collectionIcon"/>
      </v-button>
    </template>

    <!-- Main Content -->
    <div class="drawer-collection-body">
      <!-- Search Panel -->
      <ItemSearchPanel
          v-model:search-query="searchQuery"
          v-model:show-help="showSearchHelp"
          :loading="loading"
          :available-fields="availableFields"
          :translation-info="translationInfo"
          :total-items="totalItems"
          @search="$emit('search', $event)"
      />

      <!-- Search Info Bar with Pagination -->
      <div class="search-info-bar">
        <div class="results-info">
          <span v-if="searchQuery">
            Showing {{ totalItems }} results for "{{ searchQuery }}"
          </span>
          <span v-else-if="totalItems !== null">
            {{ totalItems }} {{ totalItems === 1 ? 'item' : 'items' }}
          </span>
          <span v-if="selectedItems.length > 0" class="selection-info-inline">
            - {{ selectedItems.length }} selected
            (<a class="deselect-link" @click="deselectAll">Deselect all</a>)
          </span>
        </div>

        <div class="pagination-controls">
          <v-pagination
              v-if="totalItems > itemsPerPage && totalPages > 1"
              v-model="currentPageLocal"
              :length="totalPages"
              :total-visible="3"
              :show-first-last="true"
              @update:model-value="emit('update:current-page', $event)"
          />

          <!-- Settings Button -->
          <FieldSettingsMenu
              :available-fields="availableFields"
              :display-fields="displayFields"
              :selected-language="selectedLanguageLocal"
              :available-languages="availableLanguages"
              :translation-info="translationInfo"
              :loading="userPresets.loading.value"
              :is-field-translatable="isFieldTranslatable"
              @toggle-field="toggleFieldDisplay"
              @change-language="handleLanguageChange"
          />
        </div>
      </div>

      <!-- Items List -->
      <v-list v-if="items.length > 0" class="items-list">
        <v-list-item
            v-for="item in items"
            :key="item.id || item"
            clickable
            :active="isSelected(item)"
            @click="toggleSelection(item)"
            class="custom-list-item"
        >
          <v-list-item-icon>
            <v-checkbox
                :model-value="isSelected(item)"
                @click.stop
                @update:model-value="toggleSelection(item)"
            />
          </v-list-item-icon>

          <v-list-item-content>
            <!-- Titel-Zeile mit fester Position -->
            <div class="item-title-row">
    <span
        v-if="item.status"
        class="status-dot"
        :class="`status-${item.status}`"
        v-tooltip.top="capitalizeField(item.status)"
    />
              <span class="item-title">{{ extractItemTitle(item) }}</span>
              <v-chip v-if="item.id" x-small label class="item-id-badge">
                ID: {{ item.id }}
              </v-chip>

              <!-- Edit Button -->
              <v-button
                x-small
                icon
                secondary
                class="item-edit-button"
                @click.stop="openEditDrawer(item)"
                v-tooltip.top="'Edit item'"
              >
                <v-icon name="edit" x-small />
              </v-button>

              <!-- Relations/Usage Indicator -->
              <UsagePopover
                v-if="itemRelations && itemRelations[item.id]"
                :item-relations="itemRelations[item.id]"
                :item-id="item.id"
                @item-click="handleUsageItemClick"
              />
            </div>

            <!-- Usage Warning -->
            <div v-if="itemRelations && itemRelations[item.id]" class="usage-warning">
              <v-icon name="warning" x-small/>
              <span>Used in {{ getTotalUsageCount(item.id) }} place{{ getTotalUsageCount(item.id) > 1 ? 's' : '' }} - changes will affect all references</span>
            </div>

            <!-- Additional Fields - darunter -->
            <div v-if="displayFields.length > 0" class="item-fields">
              <div
                  v-for="field in displayFields"
                  :key="field"
                  class="field-item"
              >
                <span class="field-label">
                  {{ capitalizeField(getFieldLabel(field)) }}
                  <v-icon 
                      v-if="isFieldTranslatable ? isFieldTranslatable(field) : false" 
                      name="translate" 
                      x-small
                      v-tooltip.top="'This field is translatable'"
                      class="field-translation-icon"
                  />:
                </span>
                <FieldDisplay
                    :value="getTranslatedValue(item, field)"
                    :field="field"
                    :field-info="getFieldInfo(field)"
                    :max-length="100"
                />
              </div>
            </div>
          </v-list-item-content>
        </v-list-item>
      </v-list>

      <!-- Error State -->
      <v-notice v-else-if="apiError" type="danger" icon="error">
        <div>{{ apiError }}</div>
      </v-notice>

      <!-- Empty State -->
      <v-notice v-else :icon="searchQuery ? 'search_off' : 'inbox'">
        <div>{{ searchQuery ? 'No items found matching your search' : 'No items available' }}</div>
        <div v-if="searchQuery" class="empty-state-hint"><br/>Try adjusting your search terms</div>
      </v-notice>
    </div>

    <!-- Footer Actions -->
    <template #actions>
      <v-button
          :disabled="selectedItems.length === 0"
          kind="warning"
          icon
          @click="handleConfirmCopy"
          v-tooltip.top="'Creates an independent copy of the selected item. Changes to the copy will not affect the original.'"
      >
        <v-icon name="content_copy"/>
      </v-button>

      <v-button
          :disabled="selectedItems.length === 0"
          icon
          @click="handleConfirm"
          v-tooltip.left="'Adds a reference to the selected item. Changes to the item will affect all places where it is used.'"
      >
        <v-icon name="link"/>
      </v-button>
    </template>
  </v-drawer>

  <!-- Item Edit Drawer -->
  <ItemEditDrawer
    v-if="editingItem"
    v-model="editDrawerOpen"
    :collection="collection"
    :primary-key="editingItem.id"
    @refresh="handleEditRefresh"
  />
</template>

<script setup lang="ts">
import {ref, computed, watch, onMounted} from 'vue';
import {extractItemTitle} from '../utils/helpers';
import ItemSearchPanel from './ItemSearchPanel.vue';
import FieldDisplay from './FieldDisplay.vue';
import UsagePopover from './UsagePopover.vue';
import FieldSettingsMenu from './FieldSettingsMenu.vue';
import ItemEditDrawer from './ItemEditDrawer.vue';
import { createScopedLogger } from '../utils/logger-wrapper';
import { useUserPresets } from '../composables/useUserPresets';

// Create scoped logger for this component
const logger = createScopedLogger('ItemSelectorDrawer');

// Initialize user presets
const userPresets = useUserPresets();

interface Props {
  open: boolean;
  collection: string | null;
  collectionName?: string;
  collectionIcon?: string;
  items: any[];
  loading?: boolean;
  loadingDetails?: boolean;
  currentPage?: number;
  itemsPerPage?: number;
  totalItems?: number;
  availableFields?: Array<{
    field: string;
    name?: string;
    type: string;
    interface?: string;
    display?: string;
    options?: any;
    translatable?: boolean;
    translation_type?: string;
  }>;
  itemRelations?: Record<string, any[]>;
  loadingRelations?: boolean;
  apiError?: string | null;
  translationInfo?: any;
  selectedLanguage?: string;
  availableLanguages?: Array<{ code: string; name: string; }>;
  getTranslatedFieldValue?: (item: any, field: string) => string;
  isFieldTranslatable?: (field: string) => boolean;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false
});

const emit = defineEmits<{
  close: [];
  confirm: [items: any[]];
  confirmCopy: [items: any[]];
  search: [query: string];
  'update:current-page': [page: number];
  'update:selected-language': [language: string];
}>();

// Local state
const selectedItems = ref<(string | number)[]>([]);
const searchQuery = ref('');
const displayFields = ref<string[]>([]);
const selectedLanguageLocal = ref<string>('');
const showSearchHelp = ref(false);
const preferencesInitialized = ref(false);
const editingItem = ref<any>(null);
const editDrawerOpen = ref(false);

// Debug watchers
watch(() => props.availableFields, (fields) => {
  logger.debug('availableFields changed', { fields });
});

watch(() => props.translationInfo, (info) => {
  logger.debug('translationInfo changed', { info });
});

watch(() => props.isFieldTranslatable, (fn) => {
  logger.debug('isFieldTranslatable function changed', { exists: !!fn });
});

watch(() => props.itemRelations, (relations) => {
  logger.debug('itemRelations changed', { 
    relations,
    hasRelations: !!relations,
    itemsWithRelations: relations ? Object.keys(relations).length : 0
  });
}, { immediate: true });


// Computed
const collectionIcon = computed(() => props.collectionIcon || 'box');
const collectionName = computed(() => props.collectionName || props.collection || 'Items');
const totalPages = computed(() => {
  if (!props.totalItems || !props.itemsPerPage) return 1;
  return Math.ceil(props.totalItems / props.itemsPerPage);
});

const currentPageLocal = computed({
  get: () => props.currentPage || 1,
  set: (value) => emit('update:current-page', value)
});

// Methods
function handleClose() {
  emit('close');
}

function clearSearch() {
  searchQuery.value = '';
  emit('search', '');
}

function deselectAll() {
  selectedItems.value = [];
}

function isSelected(item: any) {
  const itemId = item.id || item;
  return selectedItems.value.includes(itemId);
}

function toggleSelection(item: any) {
  const itemId = item.id || item;
  const index = selectedItems.value.indexOf(itemId);

  if (index > -1) {
    selectedItems.value.splice(index, 1);
  } else {
    selectedItems.value.push(itemId);
  }
}

function handleConfirm() {
  const selectedFullItems = selectedItems.value
      .map(itemId => props.items.find(item => item.id === itemId))
      .filter(item => item !== undefined);

  emit('confirm', selectedFullItems);
}

function handleConfirmCopy() {
  const selectedFullItems = selectedItems.value
      .map(itemId => props.items.find(item => item.id === itemId))
      .filter(item => item !== undefined);

  emit('confirmCopy', selectedFullItems);
}

async function toggleFieldDisplay(field: string) {
  // Debug: Check if field is translatable
  const isTranslatable = props.isFieldTranslatable ? props.isFieldTranslatable(field) : false;
  logger.debug('Field translatable check', { field, isTranslatable });
  
  const index = displayFields.value.indexOf(field);
  if (index > -1) {
    displayFields.value.splice(index, 1);
  } else {
    displayFields.value.push(field);
  }
  
  // Save to user presets if collection is set
  if (props.collection) {
    try {
      await userPresets.setDisplayFields(props.collection, displayFields.value);
    } catch (err) {
      // Error is already logged in the composable
      // Continue with local state even if save fails
    }
  }
}

function getFieldLabel(field: string): string {
  const fieldInfo = props.availableFields?.find(f => f.field === field);
  return fieldInfo?.name || field;
}

function getFieldInfo(field: string) {
  return props.availableFields?.find(f => f.field === field);
}

function getFieldValue(value: any): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

function capitalizeField(fieldName: string): string {
  return fieldName
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
}

function getTotalUsageCount(itemId: string | number): number {
  const relations = props.itemRelations?.[itemId];
  if (!relations) return 0;

  return relations.reduce((total, usage) => total + usage.count, 0);
}

function getTranslatedValue(item: any, field: string): string {
  // Use provided translation function if available
  if (props.getTranslatedFieldValue) {
    return props.getTranslatedFieldValue(item, field);
  }
  
  // Fallback to direct field value
  return getFieldValue(item[field]);
}

function handleUsageItemClick(payload: { collection: string; item: any }) {
  // For now, just log it. In the future, this could navigate to the item
  logger.debug('Usage item clicked', payload);
}

async function handleLanguageChange(language: string) {
  selectedLanguageLocal.value = language;
  emit('update:selected-language', language);
  
  // Save to presets if collection is set
  if (props.collection) {
    try {
      await userPresets.saveSelectedLanguage(props.collection, language);
      logger.debug('Saved language preference', { collection: props.collection, language });
    } catch (err) {
      logger.error('Failed to save language preference', err);
    }
  }
}

function openEditDrawer(item: any) {
  logger.debug('Opening edit drawer for item', { item });
  editingItem.value = item;
  editDrawerOpen.value = true;
}

function handleEditRefresh() {
  logger.debug('Edit drawer requested refresh');
  // Emit search to trigger reload of items
  emit('search', searchQuery.value);
}

// Reset when drawer opens/closes
watch(() => props.open, async (isOpen) => {
  if (isOpen) {
    selectedItems.value = [];
    searchQuery.value = '';
    showSearchHelp.value = false;
    
    // Load presets if not already initialized
    if (!preferencesInitialized.value) {
      try {
        logger.debug('Initializing presets on drawer open');
        await userPresets.initialize();
        preferencesInitialized.value = true;
      } catch (err) {
        logger.error('Failed to initialize presets on drawer open', err);
      }
    }
    
    // Always load display fields and language for current collection when drawer opens
    if (props.collection && preferencesInitialized.value) {
      const fields = userPresets.getDisplayFields(props.collection);
      displayFields.value = fields;
      
      const savedLanguage = userPresets.getSelectedLanguage(props.collection);
      if (savedLanguage) {
        selectedLanguageLocal.value = savedLanguage;
      } else if (props.selectedLanguage) {
        selectedLanguageLocal.value = props.selectedLanguage;
      }
      
      logger.debug('Loaded preferences on drawer open', { 
        collection: props.collection, 
        fields,
        language: selectedLanguageLocal.value
      });
    }
  }
});

// Reset when collection changes
watch(() => props.collection, async (collection) => {
  selectedItems.value = [];
  searchQuery.value = '';
  showSearchHelp.value = false;
  
  if (collection && preferencesInitialized.value) {
    const fields = userPresets.getDisplayFields(collection);
    displayFields.value = fields;
    
    const savedLanguage = userPresets.getSelectedLanguage(collection);
    if (savedLanguage) {
      selectedLanguageLocal.value = savedLanguage;
    } else if (props.selectedLanguage) {
      selectedLanguageLocal.value = props.selectedLanguage;
    }
    
    logger.debug('Loaded preferences on collection change', { 
      collection, 
      fields,
      language: selectedLanguageLocal.value
    });
  }
});

// Watch for external language changes
watch(() => props.selectedLanguage, (newLanguage) => {
  if (newLanguage && newLanguage !== selectedLanguageLocal.value && !preferencesInitialized.value) {
    selectedLanguageLocal.value = newLanguage;
  }
});

// Initialize presets on mount
onMounted(async () => {
  try {
    await userPresets.initialize();
    preferencesInitialized.value = true;
    
    // Load display fields and language for current collection
    if (props.collection) {
      displayFields.value = userPresets.getDisplayFields(props.collection);
      
      const savedLanguage = userPresets.getSelectedLanguage(props.collection);
      if (savedLanguage) {
        selectedLanguageLocal.value = savedLanguage;
      } else if (props.selectedLanguage) {
        selectedLanguageLocal.value = props.selectedLanguage;
      }
    }
  } catch (err) {
    logger.error('Failed to initialize user presets', err);
    // Continue with empty display fields
  }
});
</script>

<style scoped>
/* Translation icon in field labels */
.field-translation-icon {
  color: var(--primary);
  opacity: 0.7;
  margin-left: 4px;
  vertical-align: middle;
}

.field-translation-icon:hover {
  opacity: 1;
}

.field-label {
  display: inline-flex;
  align-items: center;
}

.item-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  
  .item-title {
    flex: 0 1 auto;
  }
  
  .item-edit-button {
    opacity: 0.7;
    transition: opacity 0.2s;
    
    &:hover {
      opacity: 1;
    }
  }
  
  :deep(.usage-popover) {
    margin-left: auto;
  }
}
</style>