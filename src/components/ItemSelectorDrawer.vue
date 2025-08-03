<template>
  <v-drawer
      :model-value="open"
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
          :available-fields="allAvailableFields"
          :translation-info="translationInfo"
          :total-items="totalItems"
          @search="$emit('search', $event)"
      />

      <!-- Search Info Bar with Pagination -->
      <div class="search-info-bar">
        <div class="results-info">
          <span v-if="searchQuery">
            Showing <strong>{{ totalItems }}</strong> results for <strong>"{{ searchQuery }}"</strong>
          </span>
          <span v-else-if="totalItems !== null">
            <strong>{{ totalItems }}</strong> {{ totalItems === 1 ? 'item' : 'items' }}
          </span>
          <span v-if="selectedItems.length > 0" class="selection-info-inline">
            - <strong>{{ selectedItems.length }}</strong> selected
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
              :available-fields="allAvailableFields"
              :display-fields="displayFields"
              :selected-language="selectedLanguageLocal"
              :available-languages="availableLanguages"
              :translation-info="translationInfo"
              :loading="userPresets.loading.value"
              :is-field-translatable="isFieldTranslatable"
              :show-ids="showIds"
              :hide-empty-fields="hideEmptyFields"
              :sort-field="sortField"
              :sort-direction="sortDirection"
              :items-per-page="itemsPerPageLocal"
              :show-last-update="showLastUpdate"
              :remember-search="rememberSearch"
              :drawer-width="drawerWidth"
              @toggle-field="toggleFieldDisplay"
              @change-language="handleLanguageChange"
              @toggle-show-ids="toggleShowIds"
              @toggle-hide-empty-fields="toggleHideEmptyFields"
              @toggle-show-last-update="toggleShowLastUpdate"
              @update:sort-field="updateSortField"
              @toggle-sort-direction="toggleSortDirection"
              @update:items-per-page="updateItemsPerPage"
              @toggle-remember-search="toggleRememberSearch"
              @update:drawer-width="updateDrawerWidth"
              @reset-column-widths="handleResetColumnWidths"
          />
        </div>
      </div>

      <!-- List view removed - only table view available now -->
      <div v-if="false">
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
              
              <!-- Update Info -->
              <span v-if="showLastUpdate && item?.date_updated" class="update-info">
                · {{ formatRelativeTime(item.date_updated) }}
                <span v-if="item?.user_updated">
                  by {{ getUserDisplayName(item.user_updated) }}
                </span>
              </span>

              <!-- Spacer to push items to the right -->
              <div class="spacer"></div>

              <!-- Relations/Usage Indicator -->
              <UsagePopover
                v-if="itemRelations && itemRelations[item.id]"
                :item-relations="itemRelations[item.id]"
                :item-id="item.id"
                @item-click="handleUsageItemClick"
              />

              <!-- ID Badge -->
              <v-chip v-if="showIds && item.id" x-small label class="item-id-badge">
                <v-icon name="fingerprint" x-small />
                {{ item.id }}
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
            </div>

            <!-- Usage Warning -->
<!--            <div v-if="itemRelations && itemRelations[item.id]" class="usage-warning">-->
<!--              <v-icon name="warning" x-small/>-->
<!--              <span>Used in {{ getTotalUsageCount(item.id) }} place{{ getTotalUsageCount(item.id) > 1 ? 's' : '' }} - changes will affect all references</span>-->
<!--            </div>-->

            <!-- Additional Fields - darunter -->
            <div v-if="getDisplayFieldsForItem(item).length > 0" class="item-fields">
              <div
                  v-for="field in getDisplayFieldsForItem(item)"
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
      </div>
      
      <!-- Items Table View (always shown) -->
      <ItemSelectorTable
          v-if="items.length > 0"
          ref="tableRef"
          :items="items"
          :selected-items="selectedItems"
          :display-fields="displayFields"
          :collection-name="props.collection"
          :available-fields="allAvailableFields"
          :item-relations="itemRelations"
          :show-ids="showIds"
          :hide-empty-fields="hideEmptyFields"
          :show-last-update="showLastUpdate"
          :get-translated-field-value="getTranslatedFieldValue"
          :is-field-translatable="isFieldTranslatable"
          :user-presets="userPresets"
          :sort-field="sortField"
          :sort-direction="sortDirection"
          @toggle-selection="toggleSelection"
          @toggle-all="toggleAll"
          @open-edit="openEditDrawer"
          @usage-item-click="handleUsageItemClick"
          @update-sort="handleSortUpdate"
      />

      <!-- Search Issue State -->
      <v-notice v-else-if="apiError && searchQuery" type="info" icon="info">
        <div class="search-issue-content">
          <div class="search-issue-title">No results found</div>
          <div class="search-issue-hint">{{ formatSearchError(apiError) }}</div>
        </div>
      </v-notice>

      <!-- API Error State (non-search related) -->
      <v-notice v-else-if="apiError" type="danger" icon="error">
        <div>{{ apiError }}</div>
      </v-notice>

      <!-- Empty State -->
      <v-notice v-else :icon="searchQuery ? 'search_off' : 'inbox'">
        <div>{{ searchQuery ? 'No items found matching your search' : 'No items available' }}</div>
<!--        <div v-if="searchQuery" class="empty-state-hint"><br/>Try adjusting your search terms</div>-->
      </v-notice>
    </div>

    <!--  Actions -->
    <template #actions>
      <div class="action-buttons-wrapper">
      <v-button
          v-if="allowDuplicate"
          :disabled="selectedItems.length === 0"
          kind="warning"
          icon
          @click="handleConfirmCopy"
          v-tooltip.top="'Creates an independent copy of the selected item. Changes to the copy will not affect the original.'"
      >
        <v-icon name="content_copy"/>
      </v-button>

      <v-button
          v-if="allowLink"
          :disabled="selectedItems.length === 0"
          icon
          @click="handleConfirm"

          v-tooltip.left="'Adds a reference to the selected item. Changes to the item will affect all places where it is used.'"
      >
        <v-icon name="link"/>
      </v-button>
      </div>
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
import {ref, computed, watch, onMounted, nextTick, defineProps, defineEmits, withDefaults} from 'vue';
import {extractItemTitle} from '../utils/helpers';
import ItemSearchPanel from './ItemSearchPanel.vue';
import FieldDisplay from './FieldDisplay.vue';
import UsagePopover from './UsagePopover.vue';
import FieldSettingsMenu from './FieldSettingsMenu.vue';
import ItemEditDrawer from './ItemEditDrawer.vue';
import ItemSelectorTable from './ItemSelectorTable.vue';
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
  allowLink?: boolean;
  allowDuplicate?: boolean;
  sortField?: string | null;
  sortDirection?: 'asc' | 'desc';
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  allowLink: true,
  allowDuplicate: true
});

const emit = defineEmits<{
  close: [];
  confirm: [items: any[]];
  confirmCopy: [items: any[]];
  search: [query: string];
  'update:current-page': [page: number];
  'update:selected-language': [language: string];
  'update:sort': [field: string | null, direction: 'asc' | 'desc'];
  'update:items-per-page': [value: number];
}>();

// Local state
const selectedItems = ref<(string | number)[]>([]);
const searchQuery = ref('');
const displayFields = ref<string[]>([]);
const selectedLanguageLocal = ref<string>('');
const showIds = ref(false);
const hideEmptyFields = ref(false);
const showLastUpdate = ref(false);
const sortField = ref<string | null>(null);
const sortDirection = ref<'asc' | 'desc'>('asc');
const itemsPerPageLocal = ref(100);
const rememberSearch = ref(false);
const drawerWidth = ref(856);
const showSearchHelp = ref(false);
const preferencesInitialized = ref(false);
const tableRef = ref<InstanceType<typeof ItemSelectorTable> | null>(null);
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


// Combine available fields with translation fields
const allAvailableFields = computed(() => {
  const fields = [...(props.availableFields || [])];
  
  // Add translation fields if they exist
  if (props.translationInfo?.translationFields) {
    logger.debug('Adding translation fields to available fields', {
      translationFields: props.translationInfo.translationFields
    });
    
    props.translationInfo.translationFields.forEach((tf: any) => {
      // Debug log for each translation field
      if (tf.field === 'description') {
        logger.debug('Translation field description raw data', {
          tf,
          hasInterface: 'interface' in tf,
          interfaceValue: tf.interface,
          allKeys: Object.keys(tf)
        });
      }
      
      // Don't add if already exists
      if (!fields.find(f => f.field === tf.field)) {
        const translationField = {
          ...tf,
          // Ensure the field has all necessary properties
          field: tf.field,
          name: tf.name || tf.field,
          type: tf.type,
          interface: tf.interface || null,
          display: tf.display || null,
          options: tf.options || null,
          translatable: true,
          translation_type: 'combined'
        };
        
        logger.debug('Adding translation field', {
          field: tf.field,
          interface: translationField.interface,
          tfInterface: tf.interface,
          originalTf: tf
        });
        
        fields.push(translationField);
      }
    });
  }
  
  logger.debug('All available fields computed', {
    totalFields: fields.length,
    hasDescriptionField: fields.some(f => f.field === 'description'),
    descriptionField: fields.find(f => f.field === 'description')
  });
  
  return fields;
});

const currentPageLocal = computed({
  get: () => props.currentPage || 1,
  set: (value) => emit('update:current-page', value)
});

// Removed - filteredDisplayFields not used

// Methods
function handleClose() {
  emit('close');
}

// Removed clearSearch - not used

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
    } catch {
      // Error is already logged in the composable
      // Continue with local state even if save fails
    }
  }
}

function getFieldLabel(field: string): string {
  const fieldInfo = allAvailableFields.value?.find(f => f.field === field);
  return fieldInfo?.name || field;
}

function getFieldInfo(field: string) {
  return allAvailableFields.value?.find(f => f.field === field);
}

function getFieldValue(value: any): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

// Removed truncateText - not used

function capitalizeField(fieldName: string): string {
  return fieldName
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
}

// Removed getTotalUsageCount - commented out in template

function getTranslatedValue(item: any, field: string): string {
  // Use provided translation function if available
  if (props.getTranslatedFieldValue) {
    return props.getTranslatedFieldValue(item, field);
  }
  
  // Fallback to direct field value
  return getFieldValue(item[field]);
}

function isFieldEmpty(value: any): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') {
    // Check if object is empty
    return Object.keys(value).length === 0;
  }
  return false;
}

function getDisplayFieldsForItem(item: any): string[] {
  if (!hideEmptyFields.value) {
    return displayFields.value;
  }
  
  // Filter out fields that have empty values for this item
  return displayFields.value.filter(field => {
    const value = props.getTranslatedFieldValue 
      ? props.getTranslatedFieldValue(item, field)
      : item[field];
    return !isFieldEmpty(value);
  });
}

function handleUsageItemClick(payload: { collection: string; item: any }) {
  // For now, just log it. In the future, this could navigate to the item
  logger.debug('Usage item clicked', payload);
}

function formatSearchError(error: string): string {
  // Make technical error messages more user-friendly
  if (error.includes('does not contain the "_ends_with" filter operator')) {
    return 'Tip: The "$" operator cannot be used with number fields';
  }
  if (error.includes('does not contain the "_starts_with" filter operator')) {
    return 'Tip: The "^" operator cannot be used with number fields';
  }
  if (error.includes('does not contain the "_contains" filter operator')) {
    return 'Tip: The "~" operator cannot be used with number fields';
  }
  if (error.includes('Invalid query')) {
    // Extract the specific issue if possible
    const match = error.match(/"([^"]+)" field type does not contain the "([^"]+)" filter operator/);
    if (match) {
      const [, fieldType, operator] = match;
      return `Tip: The "${operator}" operator is not supported for ${fieldType} fields`;
    }
    return 'Tip: Check your search syntax';
  }
  
  // For other errors, return as-is but shortened if too long
  if (error.length > 100) {
    return error.substring(0, 97) + '...';
  }
  return error;
}

async function handleLanguageChange(language: string) {
  selectedLanguageLocal.value = language;
  emit('update:selected-language', language);
  
  // Save to presets if collection is set
  if (props.collection) {
    try {
      await userPresets.saveSelectedLanguage(props.collection, language);
      logger.debug('Saved language preference', { collection: props.collection, language });
    } catch {
      logger.error('Failed to save language preference');
    }
  }
}

async function toggleShowIds() {
  showIds.value = !showIds.value;
  
  // Save to presets if collection is set
  if (props.collection) {
    try {
      await userPresets.saveShowIds(props.collection, showIds.value);
      logger.debug('Saved show IDs preference', { collection: props.collection, showIds: showIds.value });
    } catch {
      logger.error('Failed to save show IDs preference');
    }
  }
}

async function toggleHideEmptyFields() {
  hideEmptyFields.value = !hideEmptyFields.value;
  
  // Save to presets if collection is set
  if (props.collection) {
    try {
      await userPresets.saveHideEmptyFields(props.collection, hideEmptyFields.value);
      logger.debug('Saved hide empty fields preference', { collection: props.collection, hideEmptyFields: hideEmptyFields.value });
    } catch {
      logger.error('Failed to save hide empty fields preference');
    }
  }
}

async function toggleShowLastUpdate() {
  showLastUpdate.value = !showLastUpdate.value;
  
  // Save to presets if collection is set
  if (props.collection) {
    try {
      await userPresets.saveShowLastUpdate(props.collection, showLastUpdate.value);
      logger.debug('Saved show last update preference', { collection: props.collection, showLastUpdate: showLastUpdate.value });
    } catch {
      logger.error('Failed to save show last update preference');
    }
  }
}

async function updateSortField(field: string | null) {
  sortField.value = field;
  
  // Save to presets and trigger search
  if (props.collection) {
    try {
      await userPresets.saveSortSettings(props.collection, field, sortDirection.value);
      logger.debug('Saved sort field preference', { collection: props.collection, sortField: field });
      
      // Emit sort update
      emit('update:sort', field, sortDirection.value);
      
      // Trigger new search with sort
      emit('search', searchQuery.value);
    } catch {
      logger.error('Failed to save sort field preference');
    }
  }
}

async function toggleSortDirection() {
  sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
  
  // Save to presets and trigger search if a field is selected
  if (props.collection && sortField.value) {
    try {
      await userPresets.saveSortSettings(props.collection, sortField.value, sortDirection.value);
      logger.debug('Saved sort direction preference', { collection: props.collection, sortDirection: sortDirection.value });
      
      // Emit sort update
      emit('update:sort', sortField.value, sortDirection.value);
      
      // Trigger new search with sort
      emit('search', searchQuery.value);
    } catch {
      logger.error('Failed to save sort direction preference');
    }
  }
}

async function updateItemsPerPage(value: number) {
  itemsPerPageLocal.value = value;
  
  // Save to presets if collection is set
  if (props.collection) {
    try {
      await userPresets.saveItemsPerPage(props.collection, value);
      logger.debug('Saved items per page preference', { collection: props.collection, itemsPerPage: value });
      
      // Emit update to parent
      emit('update:items-per-page', value);
      
      // Reset to first page and trigger search
      emit('update:current-page', 1);
      emit('search', searchQuery.value);
    } catch {
      logger.error('Failed to save items per page preference');
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

function toggleAll(value: boolean) {
  if (value) {
    // Select all items
    selectedItems.value = props.items.map(item => item.id || item);
  } else {
    // Deselect all
    selectedItems.value = [];
  }
}

// View mode switcher removed - always table view

async function toggleRememberSearch() {
  rememberSearch.value = !rememberSearch.value;
  
  // Save to presets if collection is set
  if (props.collection) {
    try {
      await userPresets.saveRememberSearch(props.collection, rememberSearch.value);
      logger.debug('Saved remember search preference', { collection: props.collection, rememberSearch: rememberSearch.value });
      
      // If disabling remember search, clear the saved search
      if (!rememberSearch.value) {
        await userPresets.saveLastSearch(props.collection, '');
      }
    } catch {
      logger.error('Failed to save remember search preference');
    }
  }
}

async function updateDrawerWidth(width: number) {
  drawerWidth.value = width;
  
  // Save to presets if collection is set
  if (props.collection) {
    try {
      await userPresets.saveDrawerWidth(props.collection, width);
      logger.debug('Saved drawer width preference', { collection: props.collection, drawerWidth: width });
    } catch {
      logger.error('Failed to save drawer width preference');
    }
  }
}

// Reset all column widths to defaults
function handleResetColumnWidths() {
  logger.debug('Resetting all column widths');
  if (tableRef.value) {
    tableRef.value.resetAllColumnWidths();
  }
}

async function handleSortUpdate(field: string | null, direction: 'asc' | 'desc') {
  logger.debug('Table header sort update', { field, direction });
  
  if (field !== sortField.value) {
    await updateSortField(field);
  }
  
  if (direction !== sortDirection.value && field) {
    sortDirection.value = direction;
    if (props.collection) {
      try {
        await userPresets.saveSortSettings(props.collection, field, direction);
        logger.debug('Saved sort settings from table header', { collection: props.collection, field, direction });
        emit('update:sort', field, direction);
      } catch {
        logger.error('Failed to save sort settings');
      }
    }
  }
}

function formatRelativeTime(dateString: string): string {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 7) {
    // Show absolute date for older items
    return date.toLocaleDateString();
  } else if (days > 0) {
    return `${days} day${days === 1 ? '' : 's'} ago`;
  } else if (hours > 0) {
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  } else if (minutes > 0) {
    return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  } else {
    return 'just now';
  }
}

function getUserDisplayName(user: any): string {
  if (!user) return '';
  
  // Try different combinations for display name
  if (user.first_name && user.last_name) {
    return `${user.first_name} ${user.last_name}`;
  } else if (user.first_name) {
    return user.first_name;
  } else if (user.last_name) {
    return user.last_name;
  } else if (user.email) {
    // Show only the part before @ for privacy
    return user.email.split('@')[0];
  }
  
  return 'Unknown';
}

// Reset when drawer opens/closes
watch(() => props.open, async (isOpen) => {
  if (isOpen) {
    selectedItems.value = [];
    showSearchHelp.value = false;
    
    // Load presets if not already initialized
    if (!preferencesInitialized.value) {
      try {
        logger.debug('Initializing presets on drawer open');
        await userPresets.initialize();
        preferencesInitialized.value = true;
      } catch {
        logger.error('Failed to initialize presets on drawer open');
      }
    }
    
    // Always load display fields, language and show IDs for current collection when drawer opens
    if (props.collection && preferencesInitialized.value) {
      const fields = userPresets.getDisplayFields(props.collection);
      displayFields.value = fields;
      
      const savedLanguage = userPresets.getSelectedLanguage(props.collection);
      if (savedLanguage) {
        selectedLanguageLocal.value = savedLanguage;
      } else if (props.selectedLanguage) {
        selectedLanguageLocal.value = props.selectedLanguage;
      }
      
      showIds.value = userPresets.getShowIds(props.collection);
      hideEmptyFields.value = userPresets.getHideEmptyFields(props.collection);
      showLastUpdate.value = userPresets.getShowLastUpdate(props.collection);
      sortField.value = userPresets.getSortField(props.collection);
      sortDirection.value = userPresets.getSortDirection(props.collection);
      itemsPerPageLocal.value = userPresets.getItemsPerPage(props.collection);
      // View mode is always table now
      rememberSearch.value = userPresets.getRememberSearch(props.collection);
      drawerWidth.value = userPresets.getDrawerWidth(props.collection);
      
      // Load last search if remember search is enabled
      if (rememberSearch.value) {
        const lastSearch = userPresets.getLastSearch(props.collection);
        if (lastSearch) {
          searchQuery.value = lastSearch;
          // Trigger search with the saved query
          emit('search', lastSearch);
        }
      } else {
        searchQuery.value = '';
      }
      
      logger.debug('Loaded preferences on drawer open', { 
        collection: props.collection, 
        fields,
        language: selectedLanguageLocal.value,
        showIds: showIds.value,
        hideEmptyFields: hideEmptyFields.value,
        showLastUpdate: showLastUpdate.value,
        sortField: sortField.value,
        sortDirection: sortDirection.value,
        itemsPerPage: itemsPerPageLocal.value,
        rememberSearch: rememberSearch.value,
        lastSearch: searchQuery.value,
        drawerWidth: drawerWidth.value
      });
    }
  }
});

// Reset when collection changes
watch(() => props.collection, async (collection) => {
  selectedItems.value = [];
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
    
    showIds.value = userPresets.getShowIds(collection);
    hideEmptyFields.value = userPresets.getHideEmptyFields(collection);
    showLastUpdate.value = userPresets.getShowLastUpdate(collection);
    sortField.value = userPresets.getSortField(collection);
    sortDirection.value = userPresets.getSortDirection(collection);
    itemsPerPageLocal.value = userPresets.getItemsPerPage(collection);
    // View mode is always table now
    rememberSearch.value = userPresets.getRememberSearch(collection);
    
    // Load last search if remember search is enabled
    if (rememberSearch.value) {
      const lastSearch = userPresets.getLastSearch(collection);
      if (lastSearch) {
        searchQuery.value = lastSearch;
        // Trigger search with the saved query
        emit('search', lastSearch);
      } else {
        searchQuery.value = '';
      }
    } else {
      searchQuery.value = '';
    }
    
    logger.debug('Loaded preferences on collection change', { 
      collection, 
      fields,
      language: selectedLanguageLocal.value,
      showIds: showIds.value,
      hideEmptyFields: hideEmptyFields.value,
      showLastUpdate: showLastUpdate.value,
      sortField: sortField.value,
      sortDirection: sortDirection.value,
      itemsPerPage: itemsPerPageLocal.value,
      // viewMode: 'table', // Always table, no longer saved
      rememberSearch: rememberSearch.value,
      lastSearch: searchQuery.value
    });
  }
});

// Watch for external language changes
watch(() => props.selectedLanguage, (newLanguage) => {
  if (newLanguage && newLanguage !== selectedLanguageLocal.value && !preferencesInitialized.value) {
    selectedLanguageLocal.value = newLanguage;
  }
});

// Watch for external sort changes
watch(() => props.sortField, (newSortField) => {
  if (newSortField !== undefined && newSortField !== sortField.value) {
    sortField.value = newSortField;
  }
});

watch(() => props.sortDirection, (newSortDirection) => {
  if (newSortDirection !== undefined && newSortDirection !== sortDirection.value) {
    sortDirection.value = newSortDirection;
  }
});

// Watch for search query changes to save if remember search is enabled
watch(searchQuery, async (newQuery) => {
  if (props.collection && rememberSearch.value && preferencesInitialized.value) {
    try {
      await userPresets.saveLastSearch(props.collection, newQuery);
      logger.debug('Saved last search', { collection: props.collection, search: newQuery });
    } catch {
      logger.error('Failed to save last search');
    }
  }
});

// Watch drawer width and apply it to the actual drawer element
watch([() => props.open, drawerWidth], ([isOpen, width]) => {
  if (isOpen) {
    // Wait for next tick to ensure drawer is rendered
    nextTick(() => {
      // Find the drawer element in the DOM
      const drawer = document.querySelector('.v-drawer');
      if (drawer) {
        (drawer as HTMLElement).style.maxWidth = `${width}px`;
        logger.debug('Applied drawer width directly to element', { width });
      }
    });
  }
}, { immediate: true });

// Initialize presets on mount
onMounted(async () => {
  try {
    await userPresets.initialize();
    preferencesInitialized.value = true;
    
    // Load display fields, language and show IDs for current collection
    if (props.collection) {
      displayFields.value = userPresets.getDisplayFields(props.collection);
      
      const savedLanguage = userPresets.getSelectedLanguage(props.collection);
      if (savedLanguage) {
        selectedLanguageLocal.value = savedLanguage;
      } else if (props.selectedLanguage) {
        selectedLanguageLocal.value = props.selectedLanguage;
      }
      
      showIds.value = userPresets.getShowIds(props.collection);
      hideEmptyFields.value = userPresets.getHideEmptyFields(props.collection);
      showLastUpdate.value = userPresets.getShowLastUpdate(props.collection);
      sortField.value = userPresets.getSortField(props.collection);
      sortDirection.value = userPresets.getSortDirection(props.collection);
      itemsPerPageLocal.value = userPresets.getItemsPerPage(props.collection);
      // View mode is always table now
      rememberSearch.value = userPresets.getRememberSearch(props.collection);
      drawerWidth.value = userPresets.getDrawerWidth(props.collection);
      
      // Load last search if remember search is enabled
      if (rememberSearch.value) {
        const lastSearch = userPresets.getLastSearch(props.collection);
        if (lastSearch) {
          searchQuery.value = lastSearch;
        }
      }
    }
  } catch {
    logger.error('Failed to initialize user presets');
    // Continue with empty display fields
  }
});
</script>


<style scoped>
/* Translation icon in field labels */

/* Bold text in search info */
.results-info strong {
  font-weight: 800;
}
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
  
  .spacer {
    flex: 1 1 auto;
  }
  
  .item-edit-button {
    opacity: 0.7;
    transition: opacity 0.2s;
    
    &:hover {
      opacity: 1;
    }
  }
  
  .item-id-badge {
    background-color: var(--background-subdued);
    color: var(--foreground-subdued);
    font-family: var(--family-monospace);
    font-size: 11px;
    min-width: 80px;
    text-align: center;
    justify-content: center;
    
    :deep(.v-icon) {
      margin-right: 4px;
      --v-icon-size: 14px;
      color: var(--foreground-subdued);
    }
  }
  
  :deep(.usage-popover) {
    /* Remove margin-left auto since we use spacer now */
  }
}

/* Update info styling */
.update-info {
  font-size: 12px;
  color: var(--foreground-subdued);
  margin-left: 8px;
  white-space: nowrap;
}

/* Action buttons wrapper */
.action-buttons-wrapper {
  margin-left: 12px;
  display: flex;
  gap: 8px;
}

/* Search issue styling */
.search-issue-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.search-issue-title {
  font-weight: 500;
}

.search-issue-hint {
  font-size: 13px;
  color: var(--foreground-subdued);
  font-style: italic;
}
</style>

<style>
/* Dynamic drawer width styles */
</style>