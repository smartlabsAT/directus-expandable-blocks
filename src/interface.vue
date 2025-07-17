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
import { toRefs, inject, ref, onMounted } from 'vue';
import { useExpandableBlocks } from './composables/useExpandableBlocks';
import BlockList from './components/BlockList.vue';
import AddBlockButton from './components/AddBlockButton.vue';
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

// Initialize on mount
onMounted(() => {
  console.log('[ExpandableBlocks] Extension loaded - Version 1.0.7 - Phase 2 with wrapper functions');
  initialize();
});
</script>

<style scoped>
@import './interface.css';
</style>