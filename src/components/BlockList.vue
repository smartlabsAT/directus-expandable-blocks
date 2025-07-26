<template>
  <div class="block-list">
    <draggable
      v-if="modelValue && modelValue.length > 0"
      v-model="itemsModel"
      :disabled="!sortable || disabled"
      item-key="id"
      handle=".drag-handle"
      :animation="200"
      @end="$emit('sort')"
    >
      <template #item="{ element: item, index }">
        <block-item
          :item="item"
          :is-expanded="expandedItems.includes(getItemId(item))"
          :loading="loading[getItemId(item)] || false"
          :fields="getFieldsForItem(item)"
          :disabled="disabled"
          :compact-mode="compactMode"
          :can-read="canReadItem(item)"
          :can-update="canUpdateItem(item)"
          :usage-data="getBlockUsageData(item)"
          @toggle-expand="$emit('toggle-expand', getItemId(item))"
          @update-item="$emit('update-item', index, $event)"
        >
          <template #header>
            <block-header
              :sortable="sortable"
              :disabled="disabled"
              :collection-icon="getCollectionIcon(item)"
              :is-new="isNewItem(item)"
              :is-dirty="canReadItem(item) && isBlockDirty(getItemId(item), item.item)"
              :title="getItemTitle(item)"
              :collection-name="getCollectionName(item)"
              :show-item-id="showItemId"
              :show-collection-name="showCollectionName"
              :item-id="getActualItemId(item)"
              :is-expanded="expandedItems.includes(getItemId(item))"
              :usage-count="getBlockUsageData(item)?.usageCount || 0"
              :usage-data="getBlockUsageData(item)"
              :has-any-usage-indicator="hasAnyUsageIndicator"
              :can-read="canReadItem(item)"
              @toggle-expand="$emit('toggle-expand', getItemId(item))"
            >
              <template #status>
                <block-status
                  v-if="hasStatusField(item)"
                  :has-status="true"
                  :compact-mode="compactMode"
                  :current-status="getItemStatus(item)"
                  :status-label="getStatusLabel(getItemStatus(item))"
                  :statuses="availableStatuses"
                  :allow-change="allowStatusChange && canUpdateItem(item)"
                  @update-status="$emit('update-status', item, index, $event)"
                />
              </template>

              <template #actions>
                <block-actions
                  :allow-duplicate="allowDuplicate && canUpdateItem(item)"
                  :allow-delete="allowDelete && canUpdateItem(item)"
                  :is-dirty="canReadItem(item) && isBlockDirty(getItemId(item), item.item)"
                  @duplicate="$emit('duplicate', item, index)"
                  @discard-changes="$emit('discard-changes', item, index)"
                  @unlink="$emit('unlink', item, index)"
                  @delete="$emit('delete', item, index)"
                />
              </template>
            </block-header>
          </template>

          <template #nested-blocks>
            <template v-if="hasNestedM2A(item)">
              <div v-for="(fieldValue, fieldName) in getM2AFields(item)" :key="fieldName">
                <nested-blocks
                  v-if="fieldValue && fieldValue.length > 0"
                  :blocks="fieldValue"
                  :title="formatFieldName(fieldName)"
                />
              </div>
            </template>
          </template>
        </block-item>
      </template>
    </draggable>

    <!-- Empty State -->
    <div v-else-if="!disabled" class="empty-state">
      <p>No blocks yet</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import draggable from 'vuedraggable';
import BlockItem from './BlockItem.vue';
import BlockHeader from './BlockHeader.vue';
import BlockStatus from './BlockStatus.vue';
import BlockActions from './BlockActions.vue';
import NestedBlocks from './NestedBlocks.vue';
import type { JunctionRecord } from '../types';

interface Props {
  modelValue: JunctionRecord[];
  expandedItems: string[];
  loading: Record<string | number, boolean>;
  sortable: boolean;
  disabled: boolean;
  compactMode: boolean;
  showItemId: boolean;
  showCollectionName: boolean;
  allowDuplicate: boolean;
  allowDelete: boolean;
  allowStatusChange: boolean;
  availableStatuses: Array<{ value: string; label: string }>;
  expandableBlocks: any; // The entire expandableBlocks instance
}

const props = defineProps<Props>();

// v-model support for items
const itemsModel = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
});

const emit = defineEmits<{
  'update:modelValue': [items: JunctionRecord[]];
  'toggle-expand': [itemId: string];
  'update-item': [index: number, data: any];
  'update-status': [item: JunctionRecord, index: number, status: string];
  'duplicate': [item: JunctionRecord, index: number];
  'discard-changes': [item: JunctionRecord, index: number];
  'unlink': [item: JunctionRecord, index: number];
  'delete': [item: JunctionRecord, index: number];
  'sort': [];
}>();

// Extract helper functions from expandableBlocks
const getItemId = (item: JunctionRecord) => props.expandableBlocks.getItemId(item);
const getActualItemId = (item: JunctionRecord) => props.expandableBlocks.getActualItemId(item);
const isNewItem = (item: JunctionRecord) => props.expandableBlocks.isNewItem(item);
const isBlockDirty = (itemId: string, itemData: any) => props.expandableBlocks.isBlockDirty(itemId, itemData);
const getItemTitle = (item: JunctionRecord) => props.expandableBlocks.getItemTitle(item);
const getCollectionName = (item: JunctionRecord) => props.expandableBlocks.getCollectionName(item);
const getCollectionIcon = (item: JunctionRecord) => props.expandableBlocks.getCollectionIcon(item);
const getFieldsForItem = (item: JunctionRecord) => props.expandableBlocks.getFieldsForItem(item);
const hasStatusField = (item: JunctionRecord) => props.expandableBlocks.hasStatusField(item);
const getItemStatus = (item: JunctionRecord) => props.expandableBlocks.getItemStatus(item);
const getStatusLabel = (status: string) => props.expandableBlocks.getStatusLabel(status);
const hasNestedM2A = (item: JunctionRecord) => props.expandableBlocks.hasNestedM2A(item);
const getM2AFields = (item: JunctionRecord) => props.expandableBlocks.getM2AFields(item);
const formatFieldName = (fieldName: string) => props.expandableBlocks.formatFieldName(fieldName);
const getBlockUsageData = (item: JunctionRecord) => props.expandableBlocks.getBlockUsageData(item);
const canReadItem = (item: JunctionRecord) => props.expandableBlocks.canReadItem(item);
const canUpdateItem = (item: JunctionRecord) => props.expandableBlocks.canUpdateItem(item);

// Check if any block has usage indicators
const hasAnyUsageIndicator = computed(() => {
  if (!props.modelValue || props.modelValue.length === 0) return false;
  
  return props.modelValue.some(item => {
    const usageData = getBlockUsageData(item);
    return usageData && usageData.usageCount > 0;
  });
});
</script>

