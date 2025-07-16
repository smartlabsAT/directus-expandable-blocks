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

              <!-- More Options Menu -->
              <v-menu
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
                    clickable
                    :disabled="!isBlockDirty(getItemId(item), item.item)"
                    @click="discardChanges(item, index)"
                  >
                    <v-list-item-icon>
                      <v-icon name="undo" />
                    </v-list-item-icon>
                    <v-list-item-content>Discard Changes</v-list-item-content>
                  </v-list-item>

                  <v-divider v-if="mergedOptions?.isAllowedDelete !== false" />

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


    <div class="add-block-wrapper">
      <v-button
          v-if="!disabled && allowedCollections.length === 1 && canAddMoreBlocks"
          class="add-block-button"
          :disabled="disabled"
          @click="addNewItem(allowedCollections[0].collection)"
      >
        <v-icon name="add" />
        Create New
      </v-button>

      <v-menu
          v-else-if="!disabled && allowedCollections.length > 1 && canAddMoreBlocks"
          placement="bottom"
          show-arrow
      >
        <template #activator="{ toggle }">
          <v-button
              class="add-block-button with-dropdown"
              :disabled="disabled"
              @click="toggle"
          >

            <span>Create New</span>
            <v-icon name="arrow_drop_down"/>
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
              <v-icon :name="collection.meta?.icon || 'box'"/>
            </v-list-item-icon>
            <v-list-item-content>
              {{ collection.name }}
            </v-list-item-content>
          </v-list-item>
        </v-list>
      </v-menu>
    </div>


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

  </div>
</template>

<script setup lang="ts">
import { ref, inject, onMounted, type Ref } from 'vue';
import draggable from 'vuedraggable';
import NestedBlocks from './components/NestedBlocks.vue';
import { useExpandableBlocks, type UseExpandableBlocksProps } from './composables/useExpandableBlocks';
import type { DirectusFormValues } from './types';

interface Props extends UseExpandableBlocksProps {}

const props = withDefaults(defineProps<Props>(), {
  value: () => [],
  disabled: false,
  options: () => ({})
});

const emit = defineEmits<{
  input: [value: any[]];
}>();

// Inject Directus form states
const values = inject<Ref<DirectusFormValues>>('values', ref({}));
const initialValues = inject<Ref<DirectusFormValues>>('initialValues', ref({}));

// Use the composable
const {
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
} = useExpandableBlocks(props, emit, values, initialValues);

// Initialize on mount
onMounted(() => {
  initialize();
});
</script>

<style scoped>
@import './interface.css';
</style>