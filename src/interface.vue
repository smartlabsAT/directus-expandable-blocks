<template>
  <div class="expandable-blocks">
    <block-list
      v-model="items"
      :expanded-items="expandedItems"
      :loading="loading"
      :sortable="sortable"
      :disabled="disabled"
      :compact-mode="mergedOptions?.compactMode"
      :show-item-id="shouldShowItemId"
      :allow-duplicate="mergedOptions?.isAllowedDuplicate !== false"
      :allow-delete="mergedOptions?.isAllowedDelete !== false"
      :available-statuses="availableStatuses"
      :expandable-blocks="expandableBlocks"
      @toggle-expand="toggleExpand"
      @update-item="updateItem"
      @update-status="updateItemStatus"
      @duplicate="duplicateItem"
      @discard-changes="discardChanges"
      @delete="showDeleteDialog"
      @sort="onSort"
    />

    <add-block-button
      :disabled="disabled"
      :collections="allowedCollections"
      :can-add="canAddMoreBlocks"
      @add-item="addNewItem"
      @add-existing="itemSelector.open"
    />

    <!-- Item Selector Drawer -->
    <item-selector-drawer
      :open="itemSelector.isOpen.value"
      :collection="itemSelector.selectedCollection.value"
      :collections="allowedCollections"
      :items="itemSelector.availableItems.value"
      :loading="itemSelector.loading.value"
      @close="itemSelector.close"
      @confirm="handleItemSelection"
      @confirm-copy="handleItemSelectionAsCopy"
      @search="itemSelector.handleSearch"
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
import { toRefs, inject, ref, onMounted, computed } from 'vue';
import { useExpandableBlocks } from './composables/useExpandableBlocks';
import { useItemSelector } from './composables/useItemSelector';
import { useApi } from '@directus/extensions-sdk';
import BlockList from './components/BlockList.vue';
import AddBlockButton from './components/AddBlockButton.vue';
import ItemSelectorDrawer from './components/ItemSelectorDrawer.vue';
import type { UseExpandableBlocksProps } from './composables/useExpandableBlocks';

interface Props extends UseExpandableBlocksProps {}

const props = defineProps<Props>();
const emit = defineEmits(['input']);

// Get injected values from Directus
const values = inject('values', ref({}));
const initialValues = inject('initialValues', ref({}));

// Get refs for reactive props
const { value: modelValue, collection, field, primaryKey, disabled, options } = toRefs(props);

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
  
  // Computed
  sortable,
  shouldShowItemId,
  canAddMoreBlocks,
  
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
  formatFieldName
} = expandableBlocks;

// Initialize API
const api = useApi();

// Initialize item selector composable
const itemSelector = useItemSelector(api, allowedCollections);

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

// Initialize on mount
onMounted(() => {
  initialize();
});
</script>

<style lang="scss" scoped>
@use './interface.scss';
</style>