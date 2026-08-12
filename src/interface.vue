<template>
  <div class="expandable-blocks">
    <!-- Deleted Items Notice -->
    <v-notice
      v-if="deletedItemsCount > 0"
      type="warning"
      icon="delete_sweep"
      class="deleted-items-notice"
    >
      <div class="deleted-items-content">
        <span>
          {{ deletedItemsCount }} {{ deletedItemsCount === 1 ? 'reference' : 'references' }} to deleted items found.
          These items no longer exist but are still linked to this record.
        </span>
        <v-button
          small
          kind="danger"
          @click="removeAllDeletedItems"
        >
          Remove All Deleted References
        </v-button>
      </div>
    </v-notice>

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
        @delete="handleShowDeleteDialog"
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

    <!-- Enhanced Delete Confirmation Dialog -->
    <DeleteConfirmationDialog
      v-model="deleteDialog"
      :item="itemToDelete?.item || null"
      :item-title="itemToDelete ? getItemTitle(itemToDelete.item) : 'Untitled'"
      :item-icon="itemToDelete ? (getCollectionIcon(itemToDelete.item) || 'box') : 'box'"
      :collection-name="itemToDelete ? (getCollectionName(itemToDelete.item) || 'Unknown') : 'Unknown'"
      :usage-info="deleteUsageInfo"
      :loading="deleteUsageLoading"
      :error="deleteUsageError || null"
      :current-page-id="primaryKey || null"
      :allow-force-delete="mergedOptions?.allowForceDelete || false"
      @confirm="handleDeleteConfirm"
      @cancel="handleDeleteCancel"
    />
  </div>
</template>

<script setup lang="ts">
import {toRefs, inject, ref, onMounted, onUnmounted, watch} from 'vue';
import { debounce } from 'lodash-es';
import {useExpandableBlocks} from './composables/useExpandableBlocks';
import {useItemSelector} from './composables/useItemSelector';
import {useUserPresets} from './composables/useUserPresets';
import {useApi} from '@directus/extensions-sdk';
import BlockList from './components/BlockList.vue';
import AddBlockButton from './components/AddBlockButton.vue';
import ItemSelectorDrawer from './components/ItemSelectorDrawer.vue';
import DeleteConfirmationDialog from './components/DeleteConfirmationDialog.vue';
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
const {value: _modelValue, collection: _collection, field: _field, primaryKey: _primaryKey, disabled, options: _options} = toRefs(props);

// Component lifecycle state
const isMounted = ref(false);

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
  itemToDelete,
  mergedOptions,
  availableStatuses,
  allowedCollections,
  allowedCollectionsForExisting: _allowedCollectionsForExisting,
  deletedItemsCount,

  // Computed
  sortable,
  shouldShowItemId,
  shouldShowCollectionName,
  canAddMoreBlocks,
  allowedCollectionsWithPermissions,
  allowedCollectionsForExistingWithPermissions,

  // Methods
  initialize,
  getItemId: _getItemId,
  getActualItemId: _getActualItemId,
  isNewItem: _isNewItem,
  isBlockDirty: _isBlockDirty,
  getItemTitle,
  getCollectionName,
  getCollectionIcon,
  getFieldsForItem: _getFieldsForItem,
  toggleExpand,
  updateItem,
  addNewItem,
  addExistingItems,
  addAsNewItems,
  showDeleteDialog: _showDeleteDialog,
  unlinkItem,
  confirmDeleteItem: _confirmDeleteItem,
  removeAllDeletedItems,
  duplicateItem,
  discardChanges,
  updateItemStatus,
  onSort,
  checkItemUsage,
  deleteItemWithConfirmation,
  hasStatusField: _hasStatusField,
  getItemStatus: _getItemStatus,
  getStatusLabel: _getStatusLabel,
  hasNestedM2A: _hasNestedM2A,
  getM2AFields: _getM2AFields,
  formatFieldName: _formatFieldName,
  loadBlockUsageData,
  canReadItem: _canReadItem,
  canUpdateItem: _canUpdateItem,
  
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

// Delete dialog state
const deleteUsageInfo = ref(null);
const deleteUsageLoading = ref(false);
const deleteUsageError = ref<string | null>(null);

// Check item usage BEFORE opening delete dialog
async function handleShowDeleteDialog(item: any, index: number) {
  logDebug('Preparing to show delete dialog', { item, index });
  
  // Set the item to delete
  itemToDelete.value = { item, index };
  
  // Load usage info first
  deleteUsageLoading.value = true;
  deleteUsageError.value = null;
  deleteUsageInfo.value = null;
  
  try {
    const usageInfo = await checkItemUsage(item);
    deleteUsageInfo.value = usageInfo;
    logDebug('Item usage check complete', { usageInfo });
    
    // Now show the dialog with the usage info already loaded
    deleteDialog.value = true;
  } catch (error) {
    deleteUsageError.value = 'Failed to check item usage. Please try again.';
    logDebug('Error checking item usage', { error });
    
    // Still show dialog even on error
    deleteDialog.value = true;
  } finally {
    deleteUsageLoading.value = false;
  }
}

// Handle delete confirmation
async function handleDeleteConfirm(options: { deleteContent: boolean; selectedLocations: string[] }) {
  if (!itemToDelete.value) return;
  
  deleteDialog.value = false;
  
  await deleteItemWithConfirmation(
    itemToDelete.value.item,
    itemToDelete.value.index,
    options
  );
  
  // Reset state
  itemToDelete.value = null;
  deleteUsageInfo.value = null;
  deleteUsageError.value = null;
}

// Handle delete cancel
function handleDeleteCancel() {
  deleteDialog.value = false;
  itemToDelete.value = null;
  deleteUsageInfo.value = null;
  deleteUsageError.value = null;
}

// Store debounced function for cleanup
const debouncedLoadUsageData = debounce(async (newItems, oldItems) => {
  // Only reload if there are actual items and the count changed
  if (newItems && oldItems && newItems.length !== oldItems.length && isMounted.value) {
    await loadBlockUsageData();
  }
}, 1000);

// Watch for changes in items to reload usage data
const stopWatcher = watch(items, debouncedLoadUsageData);

// Initialize on mount
onMounted(async () => {
  isMounted.value = true;
  
  // Initialize user presets first
  try {
    await userPresets.initialize();
    userPresetsInitialized.value = true;
  } catch (err) {
    logDebug('Failed to initialize user presets', { error: err });
  }
  
  await initialize();
  
  // Load usage data for existing blocks
  if (items.value.length > 0) {
    await loadBlockUsageData();
  }
});

// Cleanup on unmount
onUnmounted(() => {
  isMounted.value = false;
  
  // Cancel any pending debounced calls
  debouncedLoadUsageData.cancel?.();
  
  // Stop the watcher
  stopWatcher();
});
</script>

<style lang="scss" scoped>
/*
 * Build-critical: this block MUST contain at least one literal CSS rule.
 *
 * rollup-plugin-styler (used by the Directus extensions SDK build) decides whether a
 * style block still needs processing by trying to parse its content as JavaScript. A
 * block consisting solely of `@use` / `@import` parses cleanly as JS, so the plugin
 * treats it as already-processed and drops the whole stylesheet without failing the
 * build. Keeping a real rule here forces a parse error and the SCSS gets compiled.
 * See https://github.com/smartlabsAT/directus-expandable-blocks/issues/85
 *
 * Note: only C-style comments are allowed here - Vue's scoped-style transform parses
 * this block as plain CSS, where `//` is a syntax error. Rules from the @use'd file are
 * emitted globally (no data-v attribute), which is intentional: they style elements
 * rendered by child components.
 */
@use './interface.scss';

/* Root container of this interface (also declared in interface.scss). */
.expandable-blocks {
  display: flex;
  flex-direction: column;
}
</style>