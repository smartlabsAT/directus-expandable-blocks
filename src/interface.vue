<template>
  <div class="expandable-blocks">
    <block-list
        v-model="items"
        :expanded-items="expandedItems"
        :loading="loading"
        :sortable="sortable && canSort"
        :disabled="disabled"
        :compact-mode="mergedOptions?.compactMode"
        :show-item-id="shouldShowItemId"
        :show-collection-name="shouldShowCollectionName"
        :allow-duplicate="mergedOptions?.isAllowedDuplicate !== false && canDuplicate"
        :allow-delete="mergedOptions?.isAllowedDelete !== false && canDelete"
        :allow-status-change="canChangeStatus"
        :available-statuses="availableStatuses"
        :expandable-blocks="expandableBlocks"
        @toggle-expand="toggleExpand"
        @update-item="updateItem"
        @update-status="updateItemStatus"
        @duplicate="duplicateItem"
        @discard-changes="discardChanges"
        @unlink="unlinkItem"
        @delete="showDeleteDialog"
        @sort="onSort"
    />

    <add-block-button
        :disabled="disabled || !canAddBlocks"
        :collections="allowedCollectionsWithPermissions"
        :collections-for-existing="allowedCollectionsForExistingWithPermissions"
        :can-add="canAddMoreBlocks && canAddBlocks"
        :allow-link-existing="mergedOptions?.allowLinkExisting"
        :allow-duplicate-existing="mergedOptions?.allowDuplicateExisting"
        @add-item="addNewItem"
        @add-existing="itemSelector.open"
    />

    <!-- Item Selector Drawer -->
    <ItemSelectorDrawer
        :open="itemSelector.isOpen.value"
        :collection="itemSelector.selectedCollection.value"
        :collection-name="itemSelector.selectedCollectionName.value"
        :collection-icon="itemSelector.selectedCollectionIcon.value"
        :items="itemSelector.availableItems.value"
        :loading="itemSelector.loading.value"
        :loading-details="itemSelector.loadingDetails.value"
        :current-page="itemSelector.currentPage.value"
        :items-per-page="itemSelector.itemsPerPage.value"
        :total-items="itemSelector.totalItems.value"
        :available-fields="itemSelector.availableFields.value"
        :item-relations="itemSelector.itemRelations.value"
        :translation-info="itemSelector.translationInfo.value"
        :selected-language="itemSelector.selectedLanguage.value"
        :available-languages="itemSelector.availableLanguages.value"
        :get-translated-field-value="itemSelector.getTranslatedFieldValue"
        :is-field-translatable="itemSelector.isFieldTranslatable"
        :api-error="itemSelector.apiError.value"
        :allow-link="mergedOptions?.allowLinkExisting !== false"
        :allow-duplicate="mergedOptions?.allowDuplicateExisting !== false"
        :sort-field="itemSelector.sortField.value"
        :sort-direction="itemSelector.sortDirection.value"
        @close="itemSelector.close"
        @confirm="handleItemSelection"
        @confirm-copy="handleItemSelectionAsCopy"
        @search="itemSelector.handleSearch"
        @update:current-page="itemSelector.handlePageChange"
        @update:selected-language="(lang) => itemSelector.selectedLanguage.value = lang"
        @update:sort="(field, direction) => itemSelector.updateSort(field, direction)"
        @update:items-per-page="(value) => itemSelector.updateItemsPerPage(value)"
    />

    <!-- Delete Dialog -->
    <v-dialog :model-value="deleteDialog" @update:model-value="deleteDialog = $event">
      <v-card>
        <v-card-title>Delete Block</v-card-title>
        <v-card-text>
          Are you sure you want to delete this block? This action cannot be undone.
        </v-card-text>
        <v-card-actions>
          <v-button secondary @click="deleteDialog = false">Cancel</v-button>
          <v-button danger @click="confirmDeleteItem">Delete</v-button>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import {toRefs, inject, ref, onMounted, computed, watch} from 'vue';
import { debounce } from 'lodash-es';
import {useExpandableBlocks} from './composables/useExpandableBlocks';
import {useItemSelector} from './composables/useItemSelector';
import {useUserPresets} from './composables/useUserPresets';
import {useApi} from '@directus/extensions-sdk';
import BlockList from './components/BlockList.vue';
import AddBlockButton from './components/AddBlockButton.vue';
import ItemSelectorDrawer from './components/ItemSelectorDrawer.vue';
import type {UseExpandableBlocksProps} from './composables/useExpandableBlocks';
import { logDebug } from './utils/logger-wrapper';

interface Props extends UseExpandableBlocksProps {
}

const props = defineProps<Props>();
const emit = defineEmits(['input']);

// Get injected values from Directus
const values = inject('values', ref({}));
const initialValues = inject('initialValues', ref({}));

// Get refs for reactive props
const {value: modelValue, collection, field, primaryKey, disabled, options} = toRefs(props);

// Initialize expandable blocks composable
const expandableBlocks = useExpandableBlocks(
    props,
    (event, value) => emit(event, value),
    values,
    initialValues
);

// Destructure everything we need
const {
  // State
  items,
  expandedItems,
  loading,
  deleteDialog,
  mergedOptions,
  availableStatuses,
  allowedCollections,
  allowedCollectionsForExisting,

  // Computed
  sortable,
  shouldShowItemId,
  shouldShowCollectionName,
  canAddMoreBlocks,
  allowedCollectionsWithPermissions,
  allowedCollectionsForExistingWithPermissions,

  // Methods
  initialize,
  getItemId,
  getActualItemId,
  isNewItem,
  isBlockDirty,
  getItemTitle,
  getCollectionName,
  getCollectionIcon,
  getFieldsForItem,
  toggleExpand,
  updateItem,
  addNewItem,
  addExistingItems,
  addAsNewItems,
  showDeleteDialog,
  unlinkItem,
  confirmDeleteItem,
  duplicateItem,
  discardChanges,
  updateItemStatus,
  onSort,
  hasStatusField,
  getItemStatus,
  getStatusLabel,
  hasNestedM2A,
  getM2AFields,
  formatFieldName,
  loadBlockUsageData,
  canReadItem,
  canUpdateItem,
  
  // Permissions
  canChangeStatus,
  canSort,
  canAddBlocks,
  canDelete,
  canDuplicate
} = expandableBlocks;

// Initialize API
const api = useApi();

// Initialize user presets
const userPresets = useUserPresets();
const userPresetsInitialized = ref(false);

// Initialize item selector composable
const itemSelector = useItemSelector(api, allowedCollections, mergedOptions.value);

// Override the open function to include user preferences
const originalOpen = itemSelector.open;
itemSelector.open = async (collection: string) => {
  // Get user preferences for the collection
  const userPrefs = {
    selectedLanguage: userPresets.getSelectedLanguage(collection),
    itemsPerPage: userPresets.getItemsPerPage(collection),
    sortField: userPresets.getSortField(collection),
    sortDirection: userPresets.getSortDirection(collection)
  };
  
  logDebug('Opening item selector with user preferences', { collection, userPrefs });
  
  // Call the original open function with preferences
  await originalOpen(collection, userPrefs);
};

// Handle item selection from drawer
function handleItemSelection(selectedItems: any[]) {
  if (selectedItems.length > 0 && itemSelector.selectedCollection.value) {
    // Use the addExistingItems function from the composable
    addExistingItems(itemSelector.selectedCollection.value, selectedItems);
  }
  itemSelector.close();
}

// Handle item selection as copy from drawer
function handleItemSelectionAsCopy(selectedItems: any[]) {
  if (selectedItems.length > 0 && itemSelector.selectedCollection.value) {
    // Use the addAsNewItems function from the composable
    addAsNewItems(itemSelector.selectedCollection.value, selectedItems);
  }
  itemSelector.close();
}

// Watch for changes in items to reload usage data
watch(items, debounce(async (newItems, oldItems) => {
  // Only reload if there are actual items and the count changed
  if (newItems && oldItems && newItems.length !== oldItems.length) {
    await loadBlockUsageData();
  }
}, 1000));

// Initialize on mount
onMounted(async () => {
  // Initialize user presets first
  try {
    await userPresets.initialize();
    userPresetsInitialized.value = true;
    logDebug('User presets initialized');
  } catch (err) {
    logDebug('Failed to initialize user presets', { error: err });
  }
  
  await initialize();
  // Load usage data for existing blocks
  await loadBlockUsageData();
});
</script>

<style lang="scss" scoped>
@use './interface.scss';
</style>